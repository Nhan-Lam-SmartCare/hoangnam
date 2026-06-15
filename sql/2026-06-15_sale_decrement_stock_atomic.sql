-- Atomic stock decrement for sales (chống bán âm kho khi nhiều thiết bị bán cùng lúc)
--
-- parts.stock là JSONB dạng {"CN1": 10}. Hàm này khóa hàng (FOR UPDATE) rồi
-- kiểm tra + trừ kho trong cùng một transaction nên không xảy ra race condition
-- read-modify-write như khi cập nhật từ phía client.
--
-- p_items: JSONB array [{ "partId": "P001", "quantity": 2 }, ...]
-- p_branch_id: mã chi nhánh (key trong cột stock)
--
-- Trả về:
--   { "success": true }
--   { "success": false, "message": "...", "insufficient": [{ partId, available, requested }] }

CREATE OR REPLACE FUNCTION public.sale_decrement_stock_atomic(
  p_items jsonb,
  p_branch_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item        jsonb;
  v_part_id     text;
  v_qty         numeric;
  v_current     numeric;
  v_stock       jsonb;
  v_insufficient jsonb := '[]'::jsonb;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Danh sách sản phẩm không hợp lệ');
  END IF;

  IF p_branch_id IS NULL OR length(trim(p_branch_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã chi nhánh');
  END IF;

  -- Pass 1: khóa hàng và kiểm tra tồn kho.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := v_item->>'partId';
    v_qty     := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    SELECT stock INTO v_stock FROM public.parts WHERE id = v_part_id FOR UPDATE;

    IF NOT FOUND THEN
      v_insufficient := v_insufficient || jsonb_build_object(
        'partId', v_part_id, 'available', 0, 'requested', v_qty
      );
      CONTINUE;
    END IF;

    v_current := COALESCE((v_stock->>p_branch_id)::numeric, 0);
    IF v_current < v_qty THEN
      v_insufficient := v_insufficient || jsonb_build_object(
        'partId', v_part_id, 'available', v_current, 'requested', v_qty
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_insufficient) > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Không đủ tồn kho để xuất bán',
      'insufficient', v_insufficient
    );
  END IF;

  -- Pass 2: trừ kho (hàng vẫn đang được khóa trong transaction này).
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := v_item->>'partId';
    v_qty     := COALESCE((v_item->>'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[p_branch_id],
      to_jsonb(GREATEST(0, COALESCE((stock->>p_branch_id)::numeric, 0) - v_qty))
    )
    WHERE id = v_part_id;
  END LOOP;

  RETURN jsonb_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_decrement_stock_atomic(jsonb, text) TO authenticated;
