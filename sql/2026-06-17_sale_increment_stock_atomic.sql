-- Atomic stock increment khi hủy/hoàn một phiếu bán hàng (cộng trả lại tồn kho).
--
-- Đối xứng với sale_decrement_stock_atomic: khóa hàng (FOR UPDATE) rồi cộng kho
-- trong cùng một transaction nên tránh race condition read-modify-write như khi
-- cập nhật từ phía client (deleteSale/hoàn đơn).
--
-- p_items: JSONB array [{ "partId": "P001", "quantity": 2 }, ...]
-- p_branch_id: mã chi nhánh (key trong cột stock JSONB dạng {"CN1": 10})
--
-- Trả về:
--   { "success": true }
--   { "success": false, "message": "..." }

BEGIN;

CREATE OR REPLACE FUNCTION public.sale_increment_stock_atomic(
  p_items jsonb,
  p_branch_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item    jsonb;
  v_part_id text;
  v_qty     numeric;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Danh sách sản phẩm không hợp lệ');
  END IF;

  IF p_branch_id IS NULL OR length(trim(p_branch_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã chi nhánh');
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := v_item->>'partId';
    v_qty     := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    -- Khóa hàng để cộng kho an toàn trong transaction.
    PERFORM 1 FROM public.parts WHERE id = v_part_id FOR UPDATE;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[p_branch_id],
      to_jsonb(GREATEST(0, COALESCE((stock->>p_branch_id)::numeric, 0) + v_qty))
    )
    WHERE id = v_part_id;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_increment_stock_atomic(jsonb, text) TO authenticated;

COMMIT;
