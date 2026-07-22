-- ============================================================================
-- sale_create_atomic_v2 — Tạo đơn bán với THANH TOÁN TÁCH (nhiều nguồn tiền)
-- Date: 2026-07-13
-- ============================================================================
--
-- Cho phép một đơn trả bằng NHIỀU nguồn (vd tiền mặt + chuyển khoản). Đối xứng
-- sale_create_atomic (v1) nhưng thay p_paid_amount (scalar) bằng:
--   p_payments jsonb = [{ "source": "cash", "amount": 100000 },
--                       { "source": "bank", "amount": 50000 }, ...]
-- Với mỗi payment amount>0: ghi 1 cash_transactions + cộng số dư đúng nguồn.
-- Nợ còn lại = total - Σamount -> customer_debts như v1.
--
-- v1 vẫn giữ nguyên (client chỉ gọi v2 khi thực sự tách nguồn; đơn 1 nguồn dùng v1).
--
-- ⚠️ exec_sql RPC KHÔNG tồn tại -> APPLY qua Supabase SQL Editor.

BEGIN;

CREATE OR REPLACE FUNCTION public.sale_create_atomic_v2(
  p_sale jsonb,
  p_items jsonb,
  p_branch_id text,
  p_payments jsonb,
  p_cash_tx_prefix text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item         jsonb;
  v_part_id      text;
  v_qty          numeric;
  v_current      numeric;
  v_stock        jsonb;
  v_insufficient jsonb := '[]'::jsonb;
  v_sale_id      text := p_sale->>'id';
  v_total        numeric := COALESCE((p_sale->>'total')::numeric, 0);
  v_pay          jsonb;
  v_pay_src      text;
  v_pay_amt      numeric;
  v_paid_total   numeric := 0;
  v_remaining    numeric;
  v_cash_prefix  text := COALESCE(p_cash_tx_prefix, 'CT-' || (p_sale->>'id'));
  v_pay_count    int := 0;
  v_pay_idx      int := 0;
  v_first_tx_id  text := NULL;
  v_payment_label text;
  v_customer_id  text := NULLIF(p_sale->>'customerId', '');
BEGIN
  IF v_sale_id IS NULL OR length(trim(v_sale_id)) = 0 THEN
    RAISE EXCEPTION 'SALE_ID_REQUIRED';
  END IF;
  IF p_branch_id IS NULL OR length(trim(p_branch_id)) = 0 THEN
    RAISE EXCEPTION 'BRANCH_ID_REQUIRED';
  END IF;

  -- Tổng thực thu (kẹp trong [0, total]).
  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    v_pay_amt := COALESCE((v_pay->>'amount')::numeric, 0);
    IF v_pay_amt > 0 THEN
      v_paid_total := v_paid_total + v_pay_amt;
      v_pay_count := v_pay_count + 1;
    END IF;
  END LOOP;
  IF v_paid_total > v_total THEN
    v_paid_total := v_total;   -- không cho thu quá tổng (phần dư = tiền thối, không ghi)
  END IF;
  v_remaining := v_total - v_paid_total;

  v_payment_label := CASE WHEN v_pay_count > 1 THEN 'mixed'
                          ELSE COALESCE((p_payments->0->>'source'), 'cash') END;

  -- 1) Khóa + kiểm tra tồn kho.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_part_id := v_item->>'partId';
    v_qty     := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT stock INTO v_stock FROM public.parts WHERE id = v_part_id FOR UPDATE;
    IF NOT FOUND THEN
      v_insufficient := v_insufficient || jsonb_build_object('partId', v_part_id, 'available', 0, 'requested', v_qty);
      CONTINUE;
    END IF;

    v_current := COALESCE((v_stock->>p_branch_id)::numeric, 0);
    IF v_current < v_qty THEN
      v_insufficient := v_insufficient || jsonb_build_object('partId', v_part_id, 'available', v_current, 'requested', v_qty);
    END IF;
  END LOOP;

  IF jsonb_array_length(v_insufficient) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không đủ tồn kho để xuất bán', 'insufficient', v_insufficient);
  END IF;

  -- 2) Trừ kho.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_part_id := v_item->>'partId';
    v_qty     := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[p_branch_id],
      to_jsonb(GREATEST(0, COALESCE((stock->>p_branch_id)::numeric, 0) - v_qty))
    )
    WHERE id = v_part_id;
  END LOOP;

  -- 3) Insert phiếu bán (paymentmethod = 'mixed' nếu tách nguồn).
  INSERT INTO public.sales (id, date, items, subtotal, discount, total, customer, paymentmethod, userid, username, branchid, note, refunded)
  VALUES (
    v_sale_id,
    COALESCE((p_sale->>'date')::timestamptz, now()),
    COALESCE(p_sale->'items', '[]'::jsonb),
    COALESCE((p_sale->>'subtotal')::numeric, 0),
    COALESCE((p_sale->>'discount')::numeric, 0),
    v_total,
    p_sale->'customer',
    v_payment_label,
    NULLIF(p_sale->>'userId', ''),
    NULLIF(p_sale->>'userName', ''),
    p_branch_id,
    NULLIF(p_sale->>'note', ''),
    false
  );

  -- 4) Ghi sổ quỹ + cộng số dư cho TỪNG nguồn thanh toán (amount>0).
  FOR v_pay IN SELECT * FROM jsonb_array_elements(COALESCE(p_payments, '[]'::jsonb))
  LOOP
    v_pay_src := COALESCE(v_pay->>'source', 'cash');
    v_pay_amt := COALESCE((v_pay->>'amount')::numeric, 0);
    IF v_pay_amt <= 0 THEN CONTINUE; END IF;

    v_pay_idx := v_pay_idx + 1;
    DECLARE
      v_tx_id text := CASE WHEN v_pay_count > 1
                           THEN v_cash_prefix || '-' || v_pay_idx
                           ELSE v_cash_prefix END;
    BEGIN
      INSERT INTO public.cash_transactions (id, type, amount, branchid, category, date, description, paymentsource, saleid, recipient)
      VALUES (
        v_tx_id, 'income', v_pay_amt, p_branch_id, 'sale_income',
        COALESCE((p_sale->>'date')::timestamptz, now()),
        COALESCE(NULLIF(p_sale->>'note', ''), 'Thu tiền bán hàng'),
        v_pay_src, v_sale_id,
        COALESCE(p_sale#>>'{customer,name}', 'Khách lẻ')
      );

      IF v_first_tx_id IS NULL THEN v_first_tx_id := v_tx_id; END IF;

      PERFORM 1 FROM public.payment_sources WHERE id = v_pay_src FOR UPDATE;
      UPDATE public.payment_sources
      SET balance = jsonb_set(
        COALESCE(balance, '{}'::jsonb),
        ARRAY[p_branch_id],
        to_jsonb(COALESCE((balance->>p_branch_id)::numeric, 0) + v_pay_amt)
      )
      WHERE id = v_pay_src;
    END;
  END LOOP;

  IF v_first_tx_id IS NOT NULL THEN
    UPDATE public.sales SET cashtransactionid = v_first_tx_id WHERE id = v_sale_id;
  END IF;

  -- 5) Còn thiếu -> tạo công nợ.
  IF v_remaining > 0 THEN
    INSERT INTO public.customer_debts (id, customer_id, customer_name, phone, description, total_amount, paid_amount, remaining_amount, created_date, branch_id, sale_id)
    VALUES (
      'CDEBT-SALE-' || v_sale_id,
      COALESCE(v_customer_id, NULLIF(p_sale#>>'{customer,phone}', ''), 'CUST-ANON-' || v_sale_id),
      COALESCE(NULLIF(p_sale#>>'{customer,name}', ''), 'Khách lẻ'),
      NULLIF(p_sale#>>'{customer,phone}', ''),
      'Mua hàng (Hóa đơn #' || v_sale_id || ')',
      v_total, v_paid_total, v_remaining,
      now(),
      p_branch_id, v_sale_id
    )
    ON CONFLICT (id) DO UPDATE
      SET total_amount = EXCLUDED.total_amount,
          paid_amount = EXCLUDED.paid_amount,
          remaining_amount = EXCLUDED.remaining_amount;
  END IF;

  -- 6) Cộng thống kê khách hàng.
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET "totalSpent" = COALESCE("totalSpent", 0) + v_total
    WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'saleId', v_sale_id, 'cashTransactionId', v_first_tx_id, 'paidTotal', v_paid_total);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_create_atomic_v2(jsonb, jsonb, text, jsonb, text) TO authenticated;

COMMIT;
