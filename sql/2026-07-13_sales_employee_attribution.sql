-- ============================================================================
-- Gắn NHÂN VIÊN BÁN HÀNG vào đơn — phục vụ báo cáo doanh số/thưởng theo tháng
-- Date: 2026-07-13
-- ============================================================================
--
-- Vấn đề gốc đã phát hiện:
--   * Bảng `sales` KHÔNG có cột lưu TÊN người bán (chỉ có userid).
--   * RPC sale_create_atomic chỉ INSERT userid, bỏ userName client gửi lên.
--   => Khi đọc lại luôn fallback "Local User" -> báo cáo doanh số NV = 0.
--
-- Migration này:
--   1) Thêm cột sales.username (idempotent).
--   2) CREATE OR REPLACE sale_create_atomic để GHI THÊM username vào sales.
--
-- ⚠️ exec_sql RPC KHÔNG tồn tại trên DB này -> APPLY BẰNG Supabase SQL Editor
--    (dán toàn bộ file, Run), KHÔNG dùng scripts/setup/apply-sql.mjs.

BEGIN;

ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS username text;

CREATE OR REPLACE FUNCTION public.sale_create_atomic(
  p_sale jsonb,
  p_items jsonb,
  p_branch_id text,
  p_paid_amount numeric,
  p_cash_tx_id text DEFAULT NULL
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
  v_paid         numeric := GREATEST(0, LEAST(COALESCE(p_paid_amount, 0), COALESCE((p_sale->>'total')::numeric, 0)));
  v_remaining    numeric;
  v_cash_tx_id   text := COALESCE(p_cash_tx_id, 'CT-' || v_sale_id);
  v_payment      text := COALESCE(p_sale->>'paymentMethod', 'cash');
  v_customer_id  text := NULLIF(p_sale->>'customerId', '');
BEGIN
  IF v_sale_id IS NULL OR length(trim(v_sale_id)) = 0 THEN
    RAISE EXCEPTION 'SALE_ID_REQUIRED';
  END IF;
  IF p_branch_id IS NULL OR length(trim(p_branch_id)) = 0 THEN
    RAISE EXCEPTION 'BRANCH_ID_REQUIRED';
  END IF;

  v_remaining := v_total - v_paid;

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

  -- 2) Trừ kho (hàng vẫn đang khóa trong transaction).
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

  -- 3) Insert phiếu bán (GHI THÊM username = tên nhân viên bán hàng).
  INSERT INTO public.sales (id, date, items, subtotal, discount, total, customer, paymentmethod, userid, username, branchid, note, refunded)
  VALUES (
    v_sale_id,
    COALESCE((p_sale->>'date')::timestamptz, now()),
    COALESCE(p_sale->'items', '[]'::jsonb),
    COALESCE((p_sale->>'subtotal')::numeric, 0),
    COALESCE((p_sale->>'discount')::numeric, 0),
    v_total,
    p_sale->'customer',
    v_payment,
    NULLIF(p_sale->>'userId', ''),
    NULLIF(p_sale->>'userName', ''),
    p_branch_id,
    NULLIF(p_sale->>'note', ''),
    false
  );

  -- 4) Thực thu -> ghi sổ quỹ + cộng số dư nguồn tiền.
  IF v_paid > 0 THEN
    INSERT INTO public.cash_transactions (id, type, amount, branchid, category, date, description, paymentsource, saleid, recipient)
    VALUES (
      v_cash_tx_id, 'income', v_paid, p_branch_id, 'sale_income',
      COALESCE((p_sale->>'date')::timestamptz, now()),
      COALESCE(NULLIF(p_sale->>'note', ''), 'Thu tiền bán hàng'),
      v_payment, v_sale_id,
      COALESCE(p_sale#>>'{customer,name}', 'Khách lẻ')
    );

    UPDATE public.sales SET cashtransactionid = v_cash_tx_id WHERE id = v_sale_id;

    PERFORM 1 FROM public.payment_sources WHERE id = v_payment FOR UPDATE;
    UPDATE public.payment_sources
    SET balance = jsonb_set(
      COALESCE(balance, '{}'::jsonb),
      ARRAY[p_branch_id],
      to_jsonb(COALESCE((balance->>p_branch_id)::numeric, 0) + v_paid)
    )
    WHERE id = v_payment;
  END IF;

  -- 5) Còn thiếu -> tạo công nợ (cột sale_id, id CDEBT-SALE-...).
  IF v_remaining > 0 THEN
    INSERT INTO public.customer_debts (id, customer_id, customer_name, phone, description, total_amount, paid_amount, remaining_amount, created_date, branch_id, sale_id)
    VALUES (
      'CDEBT-SALE-' || v_sale_id,
      COALESCE(v_customer_id, NULLIF(p_sale#>>'{customer,phone}', ''), 'CUST-ANON-' || v_sale_id),
      COALESCE(NULLIF(p_sale#>>'{customer,name}', ''), 'Khách lẻ'),
      NULLIF(p_sale#>>'{customer,phone}', ''),
      'Mua hàng (Hóa đơn #' || v_sale_id || ')',
      v_total, v_paid, v_remaining,
      to_char(now(), 'YYYY-MM-DD'),
      p_branch_id, v_sale_id
    )
    ON CONFLICT (id) DO UPDATE
      SET total_amount = EXCLUDED.total_amount,
          paid_amount = EXCLUDED.paid_amount,
          remaining_amount = EXCLUDED.remaining_amount;
  END IF;

  -- 6) Cộng thống kê khách hàng nguyên tử (#8) + phân hạng segment (khớp client).
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET totalspent = COALESCE(totalspent, 0) + v_total,
        visitcount = COALESCE(visitcount, 0) + 1,
        lastvisit = now(),
        segment = CASE
          WHEN COALESCE(totalspent, 0) + v_total > 10000000 THEN 'VIP'
          WHEN COALESCE(totalspent, 0) + v_total > 3000000 THEN 'Loyal'
          WHEN COALESCE(visitcount, 0) + 1 > 1 THEN 'Potential'
          ELSE 'New'
        END
    WHERE id = v_customer_id;
  END IF;

  RETURN jsonb_build_object('success', true, 'saleId', v_sale_id, 'cashTransactionId', CASE WHEN v_paid > 0 THEN v_cash_tx_id ELSE NULL END);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_create_atomic(jsonb, jsonb, text, numeric, text) TO authenticated;

COMMIT;
