-- ============================================================================
-- sale_delete_atomic — Xóa/hoàn phiếu bán hàng NGUYÊN TỬ (đối xứng sale_create_atomic)
-- Date: 2026-07-13
-- ============================================================================
--
-- Gom toàn bộ luồng hoàn kho/hoàn tiền/xóa công nợ của một đơn bán vào MỘT
-- transaction (chống trạng thái nửa vời khi xóa đơn):
--   1) Khóa phiếu sales (FOR UPDATE). Không tìm thấy -> success=false.
--   2) Hoàn kho: cộng lại số lượng từng item vào parts.stock[branch].
--   3) Đảo sổ quỹ: xóa cash_transactions liên kết + trừ số dư payment_sources.
--   4) Xóa customer_debts liên kết (cột sale_id / saleId).
--   5) Đảo thống kê khách hàng (totalspent/visitcount) — best-effort.
--   6) Xóa phiếu sales.
-- Bất kỳ bước nào lỗi -> RAISE -> rollback toàn bộ.
--
-- p_sale_id:   id phiếu bán cần xóa
-- p_branch_id: mã chi nhánh của phiếu (client truyền sale.branchId); nếu NULL thì
--              suy ra từ chính phiếu (an toàn với cả branchId/branchid/branch_id).
--
-- Trả về:
--   { success: true,  branchId, refunds: {<sourceId>: <amount>}, removedCashTxIds: [...] }
--   { success: false, message }
--
-- ⚠️ Idempotent: CREATE OR REPLACE, bọc trong BEGIN/COMMIT.
-- ⚠️ exec_sql RPC KHÔNG tồn tại trên DB này -> apply bằng Supabase SQL Editor
--    (dán nội dung file), KHÔNG dùng scripts/setup/apply-sql.mjs.

BEGIN;

CREATE OR REPLACE FUNCTION public.sale_delete_atomic(
  p_sale_id text,
  p_branch_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale        public.sales%ROWTYPE;
  v_sale_json   jsonb;
  v_branch      text;
  v_total       numeric;
  v_customer_id text;
  v_item        jsonb;
  v_part_id     text;
  v_qty         numeric;
  v_tx          record;
  v_src         text;
  v_amt         numeric;
  v_refunds     jsonb := '{}'::jsonb;
  v_tx_ids      jsonb := '[]'::jsonb;
BEGIN
  IF p_sale_id IS NULL OR length(trim(p_sale_id)) = 0 THEN
    RAISE EXCEPTION 'SALE_ID_REQUIRED';
  END IF;

  -- 1) Khóa phiếu.
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'SALE_NOT_FOUND');
  END IF;

  v_sale_json := to_jsonb(v_sale);
  v_branch := COALESCE(
    NULLIF(p_branch_id, ''),
    v_sale_json ->> 'branchId',
    v_sale_json ->> 'branchid',
    v_sale_json ->> 'branch_id'
  );
  IF v_branch IS NULL OR length(trim(v_branch)) = 0 THEN
    RAISE EXCEPTION 'BRANCH_ID_REQUIRED';
  END IF;

  v_total := COALESCE((v_sale_json ->> 'total')::numeric, 0);
  v_customer_id := NULLIF(v_sale_json #>> '{customer,id}', '');

  -- 2) Hoàn kho (cộng lại từng item).
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_sale_json -> 'items', '[]'::jsonb))
  LOOP
    v_part_id := v_item ->> 'partId';
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[v_branch],
      to_jsonb(GREATEST(0, COALESCE((stock ->> v_branch)::numeric, 0) + v_qty))
    )
    WHERE id = v_part_id;
  END LOOP;

  -- 3) Đảo sổ quỹ + số dư nguồn tiền (theo đúng giao dịch đã ghi cho đơn).
  FOR v_tx IN
    SELECT
      t.id AS id,
      COALESCE(
        to_jsonb(t) ->> 'paymentsource',
        to_jsonb(t) ->> 'paymentSource',
        to_jsonb(t) ->> 'paymentSourceId'
      ) AS src,
      COALESCE(t.amount, 0) AS amt
    FROM public.cash_transactions t
    WHERE to_jsonb(t) ->> 'saleid' = p_sale_id
       OR to_jsonb(t) ->> 'saleId' = p_sale_id
    FOR UPDATE
  LOOP
    v_src := COALESCE(v_tx.src, v_sale_json ->> 'paymentmethod', 'cash');
    v_amt := COALESCE(v_tx.amt, 0);

    IF v_amt > 0 AND v_src IS NOT NULL THEN
      UPDATE public.payment_sources
      SET balance = jsonb_set(
        COALESCE(balance, '{}'::jsonb),
        ARRAY[v_branch],
        to_jsonb(COALESCE((balance ->> v_branch)::numeric, 0) - v_amt)
      )
      WHERE id = v_src;

      v_refunds := jsonb_set(
        v_refunds,
        ARRAY[v_src],
        to_jsonb(COALESCE((v_refunds ->> v_src)::numeric, 0) + v_amt)
      );
    END IF;

    v_tx_ids := v_tx_ids || to_jsonb(v_tx.id);
    DELETE FROM public.cash_transactions WHERE id = v_tx.id;
  END LOOP;

  -- 4) Xóa công nợ liên kết (cột sale_id hoặc saleId).
  DELETE FROM public.customer_debts d
  WHERE to_jsonb(d) ->> 'sale_id' = p_sale_id
     OR to_jsonb(d) ->> 'saleId' = p_sale_id;

  -- 5) Đảo thống kê khách hàng (best-effort; chỉ khi phiếu lưu customer.id).
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET totalspent = GREATEST(0, COALESCE(totalspent, 0) - v_total),
        visitcount = GREATEST(0, COALESCE(visitcount, 0) - 1)
    WHERE id = v_customer_id;
  END IF;

  -- 6) Xóa phiếu.
  DELETE FROM public.sales WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'branchId', v_branch,
    'refunds', v_refunds,
    'removedCashTxIds', v_tx_ids
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_delete_atomic(text, text) TO authenticated;

COMMIT;
