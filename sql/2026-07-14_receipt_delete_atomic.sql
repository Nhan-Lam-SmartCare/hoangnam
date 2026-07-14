-- SQL Migration: receipt_delete_atomic
-- Xóa phiếu nhập kho và hoàn trả tồn kho atomically.

BEGIN;

CREATE OR REPLACE FUNCTION public.receipt_delete_atomic(
  p_receipt_code text,
  p_branch_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tx      record;
  v_tx_json jsonb;
  v_part_id text;
  v_qty     numeric;
  v_branch  text;
BEGIN
  IF p_receipt_code IS NULL OR length(trim(p_receipt_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã phiếu nhập');
  END IF;

  IF p_branch_id IS NULL OR length(trim(p_branch_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã chi nhánh');
  END IF;

  -- 1. Hoàn trả tồn kho cho từng giao dịch
  FOR v_tx IN 
    SELECT * 
    FROM public.inventory_transactions 
    WHERE notes ILIKE '%' || p_receipt_code || '%'
  LOOP
    v_tx_json := to_jsonb(v_tx);
    v_part_id := COALESCE(v_tx_json->>'partId', v_tx_json->>'part_id', v_tx_json->>'partid');
    v_qty     := COALESCE((v_tx_json->>'quantity')::numeric, (v_tx_json->>'quantity_change')::numeric, 0);
    v_branch  := COALESCE(v_tx_json->>'branchId', v_tx_json->>'branch_id', v_tx_json->>'branchid', p_branch_id);

    IF v_part_id IS NOT NULL AND v_qty > 0 THEN
      -- Khóa hàng để cập nhật an toàn trong transaction.
      PERFORM 1 FROM public.parts WHERE id = v_part_id FOR UPDATE;

      UPDATE public.parts
      SET stock = jsonb_set(
        COALESCE(stock, '{}'::jsonb),
        ARRAY[v_branch],
        to_jsonb(GREATEST(0, COALESCE((stock->>v_branch)::numeric, 0) - v_qty))
      )
      WHERE id = v_part_id;
    END IF;
  END LOOP;

  -- 2. Xóa các bản ghi liên quan
  DELETE FROM public.inventory_transactions 
  WHERE notes ILIKE '%' || p_receipt_code || '%';

  DELETE FROM public.supplier_debts 
  WHERE description ILIKE '%' || p_receipt_code || '%';

  DELETE FROM public.cash_transactions 
  WHERE notes ILIKE '%' || p_receipt_code || '%' 
     OR description ILIKE '%' || p_receipt_code || '%';

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.receipt_delete_atomic(text, text) TO authenticated;

COMMIT;
