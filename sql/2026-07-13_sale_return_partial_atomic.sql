-- ============================================================================
-- Đổi/TRẢ HÀNG MỘT PHẦN — bảng sale_returns + RPC sale_return_partial_atomic
-- Date: 2026-07-13
-- ============================================================================
--
-- Cho phép trả một phần (chọn item + số lượng) của một đơn bán, NGUYÊN TỬ:
--   1) Khóa phiếu, chặn trả quá (đã bán − đã trả trước đó).
--   2) Hoàn kho từng item (parts.stock[branch] += qty).
--   3) Ghi 1 dòng sale_returns (lịch sử).
--   4) Hoàn tiền: ghi cash_transactions type 'expense' + trừ payment_sources.
--   5) set sales.refunded=true khi ĐÃ trả hết toàn bộ số lượng.
-- Lỗi bất kỳ -> rollback toàn bộ.
--
-- ⚠️ exec_sql RPC KHÔNG tồn tại -> APPLY qua Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.sale_returns (
  id           text PRIMARY KEY,
  sale_id      text NOT NULL,
  branch_id    text,
  items        jsonb NOT NULL DEFAULT '[]'::jsonb,
  refund_amount numeric NOT NULL DEFAULT 0,
  refund_source text,
  reason       text,
  created_by   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sale_returns_sale_id ON public.sale_returns (sale_id);

ALTER TABLE public.sale_returns ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.sale_returns FROM anon;

-- Đọc: owner xem tất cả; còn lại theo chi nhánh. Ghi đi qua RPC SECURITY DEFINER.
DROP POLICY IF EXISTS sale_returns_select ON public.sale_returns;
CREATE POLICY sale_returns_select ON public.sale_returns
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
    OR branch_id IS NULL
  );

CREATE OR REPLACE FUNCTION public.sale_return_partial_atomic(
  p_sale_id text,
  p_branch_id text,
  p_items jsonb,
  p_refund_amount numeric DEFAULT 0,
  p_refund_source text DEFAULT 'cash',
  p_reason text DEFAULT NULL,
  p_return_id text DEFAULT NULL,
  p_created_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale         public.sales%ROWTYPE;
  v_sale_json    jsonb;
  v_sale_items   jsonb;
  v_branch       text;
  v_item         jsonb;
  v_part_id      text;
  v_qty          numeric;
  v_sold         numeric;
  v_already      numeric;
  v_invalid      jsonb := '[]'::jsonb;
  v_return_id    text := COALESCE(NULLIF(p_return_id, ''), 'RET-' || p_sale_id || '-' || floor(extract(epoch from now()))::text);
  v_refund       numeric := GREATEST(0, COALESCE(p_refund_amount, 0));
  v_total_sold   numeric := 0;
  v_total_ret    numeric := 0;
  v_this_ret     numeric := 0;
  v_refunds      jsonb := '{}'::jsonb;
BEGIN
  IF p_sale_id IS NULL OR length(trim(p_sale_id)) = 0 THEN
    RAISE EXCEPTION 'SALE_ID_REQUIRED';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'SALE_NOT_FOUND');
  END IF;

  v_sale_json  := to_jsonb(v_sale);
  v_sale_items := COALESCE(v_sale_json -> 'items', '[]'::jsonb);
  v_branch := COALESCE(
    NULLIF(p_branch_id, ''),
    v_sale_json ->> 'branchId',
    v_sale_json ->> 'branchid',
    v_sale_json ->> 'branch_id'
  );
  IF v_branch IS NULL OR length(trim(v_branch)) = 0 THEN
    RAISE EXCEPTION 'BRANCH_ID_REQUIRED';
  END IF;

  -- 1) Kiểm tra từng item trả: không vượt (đã bán − đã trả trước).
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_part_id := v_item ->> 'partId';
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_sold
    FROM jsonb_array_elements(v_sale_items) it
    WHERE it ->> 'partId' = v_part_id;

    SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_already
    FROM public.sale_returns sr, jsonb_array_elements(sr.items) it
    WHERE sr.sale_id = p_sale_id AND it ->> 'partId' = v_part_id;

    IF v_qty > (v_sold - v_already) THEN
      v_invalid := v_invalid || jsonb_build_object(
        'partId', v_part_id, 'requested', v_qty,
        'returnable', GREATEST(0, v_sold - v_already)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_invalid) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số lượng trả vượt quá số còn lại', 'invalid', v_invalid);
  END IF;

  -- 2) Hoàn kho + cộng tổng số lượng trả lần này.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_part_id := v_item ->> 'partId';
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    v_this_ret := v_this_ret + v_qty;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[v_branch],
      to_jsonb(GREATEST(0, COALESCE((stock ->> v_branch)::numeric, 0) + v_qty))
    )
    WHERE id = v_part_id;
  END LOOP;

  -- 3) Ghi lịch sử trả.
  INSERT INTO public.sale_returns (id, sale_id, branch_id, items, refund_amount, refund_source, reason, created_by)
  VALUES (v_return_id, p_sale_id, v_branch, COALESCE(p_items, '[]'::jsonb), v_refund, NULLIF(p_refund_source, ''), NULLIF(p_reason, ''), NULLIF(p_created_by, ''));

  -- 4) Hoàn tiền (chi) nếu có.
  IF v_refund > 0 AND NULLIF(p_refund_source, '') IS NOT NULL THEN
    INSERT INTO public.cash_transactions (id, type, amount, branchid, category, date, description, paymentsource, saleid, recipient)
    VALUES (
      'CT-' || v_return_id, 'expense', v_refund, v_branch, 'sale_refund',
      now(),
      'Hoàn tiền trả hàng (Hóa đơn #' || p_sale_id || ')',
      p_refund_source, p_sale_id,
      COALESCE(v_sale_json #>> '{customer,name}', 'Khách lẻ')
    );

    PERFORM 1 FROM public.payment_sources WHERE id = p_refund_source FOR UPDATE;
    UPDATE public.payment_sources
    SET balance = jsonb_set(
      COALESCE(balance, '{}'::jsonb),
      ARRAY[v_branch],
      to_jsonb(COALESCE((balance ->> v_branch)::numeric, 0) - v_refund)
    )
    WHERE id = p_refund_source;

    v_refunds := jsonb_set(v_refunds, ARRAY[p_refund_source], to_jsonb(v_refund));
  END IF;

  -- 5) Nếu đã trả HẾT toàn bộ số lượng -> đánh dấu phiếu refunded.
  SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_total_sold
  FROM jsonb_array_elements(v_sale_items) it;

  SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_total_ret
  FROM public.sale_returns sr, jsonb_array_elements(sr.items) it
  WHERE sr.sale_id = p_sale_id;

  IF v_total_sold > 0 AND v_total_ret >= v_total_sold THEN
    UPDATE public.sales SET refunded = true WHERE id = p_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'returnId', v_return_id,
    'branchId', v_branch,
    'refunds', v_refunds,
    'fullyReturned', (v_total_sold > 0 AND v_total_ret >= v_total_sold)
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_return_partial_atomic(text, text, jsonb, numeric, text, text, text, text) TO authenticated;

COMMIT;
