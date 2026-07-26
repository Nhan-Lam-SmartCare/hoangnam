-- receipt_edit_atomic — chặn sửa phiếu nhập đã có máy ghi IMEI.
--
-- BỐI CẢNH
-- Hàm này (bản 2026-07-14) hoạt động theo kiểu "xóa phiếu cũ rồi tạo lại":
-- gọi receipt_delete_atomic, sau đó cộng lại stock và insert lại
-- inventory_transactions theo p_new_items.
--
-- Từ khi có bảng part_units (sql/2026-07-26_create_part_units.sql), luồng đó
-- SAI LẶNG LẼ với hàng có IMEI:
--   * receipt_delete_atomic XÓA các part_units của phiếu (đúng), nhưng
--   * bước tạo lại KHÔNG dựng lại part_units, vì p_new_items do EditReceiptModal
--     gửi lên không mang mảng imei.
-- Kết quả: stock vẫn đúng số, nhưng toàn bộ IMEI biến mất. Máy nằm trong kho mà
-- không còn danh tính — đúng thứ mà part_units sinh ra để chống.
--
-- QUYẾT ĐỊNH: chặn, không "sửa cho có".
-- Sửa phiếu có IMEI đòi hỏi biết IMEI nào giữ / IMEI nào bỏ / IMEI nào thêm, kèm
-- kiểm tra trùng toàn hệ thống — tức là gần như viết lại receipt_create_atomic.
-- Cho đến khi UI gửi được mảng imei khi sửa, thà báo lỗi rõ ràng và buộc xóa rồi
-- nhập lại (receipt_delete_atomic đã chặn đúng khi máy đã bán) còn hơn âm thầm
-- làm mất dữ liệu.
--
-- Phiếu KHÔNG có máy nào ghi IMEI thì hành vi giữ nguyên 100% như trước.
--
-- Idempotent: CREATE OR REPLACE, chạy lại nhiều lần vô hại.

BEGIN;

CREATE OR REPLACE FUNCTION public.receipt_edit_atomic(
  p_old_receipt_code text,
  p_new_items jsonb,
  p_supplier_id text,
  p_branch_id text,
  p_user_id text,
  p_new_notes text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_del_res jsonb;
  v_item    jsonb;
  v_part_id text;
  v_qty     numeric;
  v_import_price numeric;
  v_selling_price numeric;
  v_wholesale_price numeric;
  v_part_name text;
  v_tx_id     text;
  v_unit_count int;
BEGIN
  -- 0. GUARD: phiếu có máy ghi IMEI thì không sửa được.
  -- Đếm TRƯỚC khi gọi delete, vì delete sẽ xóa chính các dòng cần đếm.
  SELECT count(*) INTO v_unit_count
  FROM public.part_units
  WHERE upper(btrim(receipt_code)) = upper(btrim(p_old_receipt_code));

  IF v_unit_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'has_units',
      'unitCount', v_unit_count,
      'message',
        'Phiếu ' || COALESCE(p_old_receipt_code, '?') || ' có ' || v_unit_count ||
        ' máy đã ghi IMEI. Sửa phiếu sẽ làm mất IMEI của các máy này. ' ||
        'Hãy XÓA phiếu rồi nhập lại để giữ đúng IMEI.'
    );
  END IF;

  -- 1. Gọi receipt_delete_atomic để xóa toàn bộ phiếu cũ và hoàn trả kho
  v_del_res := public.receipt_delete_atomic(p_old_receipt_code, p_branch_id);
  IF NOT COALESCE((v_del_res->>'success')::boolean, false) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Không thể xóa phiếu cũ: ' || COALESCE(v_del_res->>'message', 'Lỗi không xác định'));
  END IF;

  -- 2. Tạo mới các giao dịch và cập nhật kho theo p_new_items
  IF p_new_items IS NOT NULL AND jsonb_typeof(p_new_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_new_items)
    LOOP
      v_part_id := COALESCE(v_item->>'partId', v_item->>'part_id', v_item->>'partid');
      v_qty     := COALESCE((v_item->>'quantity')::numeric, 0);
      v_part_name := v_item->>'partName';
      v_import_price := COALESCE((v_item->>'importPrice')::numeric, 0);
      v_selling_price := COALESCE((v_item->>'sellingPrice')::numeric, 0);
      v_wholesale_price := COALESCE((v_item->>'wholesalePrice')::numeric, 0);

      IF v_part_id IS NULL OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      -- Khóa hàng để cập nhật an toàn
      PERFORM 1 FROM public.parts WHERE id = v_part_id FOR UPDATE;

      -- Cập nhật tồn kho và giá cả của hàng.
      -- LƯU Ý QUAN TRỌNG:
      --  * Cột giá trên bảng parts đặt theo camelCase ("retailPrice",
      --    "wholesalePrice") nên trong SQL thô PHẢI nháy kép, nếu không Postgres
      --    fold về chữ thường (retailprice) và không khớp cột thật.
      --  * KHÔNG đụng costPrice / laborCost: hai cột này không có trong schema
      --    parts hiện tại (xem partsRepository.createPart) — tham chiếu sẽ làm
      --    UPDATE lỗi cứng "column does not exist". Chỉ mirror đúng các cột mà
      --    createPart ghi: stock, "retailPrice", "wholesalePrice".
      UPDATE public.parts
      SET
        stock = jsonb_set(
          COALESCE(stock, '{}'::jsonb),
          ARRAY[p_branch_id],
          to_jsonb(COALESCE((stock->>p_branch_id)::numeric, 0) + v_qty)
        ),
        "retailPrice" = jsonb_set(
          COALESCE("retailPrice", '{}'::jsonb),
          ARRAY[p_branch_id],
          to_jsonb(v_selling_price)
        ),
        "wholesalePrice" = jsonb_set(
          COALESCE("wholesalePrice", '{}'::jsonb),
          ARRAY[p_branch_id],
          to_jsonb(v_wholesale_price)
        )
      WHERE id = v_part_id;

      -- Tạo inventory transaction mới (cột có dấu nháy kép vì Postgres case-sensitive với camelCase)
      v_tx_id := md5(random()::text || clock_timestamp()::text);
      INSERT INTO public.inventory_transactions (
        id, type, "partId", "partName", quantity, date, "unitPrice", "totalPrice", "branchId", "supplierId", notes, "userId"
      ) VALUES (
        v_tx_id, 'Nhập kho', v_part_id, v_part_name, v_qty, now(), v_import_price, v_import_price * v_qty, p_branch_id, p_supplier_id, p_new_notes, p_user_id
      );

    END LOOP;
  END IF;

  RETURN jsonb_build_object('success', true);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.receipt_edit_atomic(text, jsonb, text, text, text, text) TO authenticated;

COMMIT;

-- KIỂM TRA sau khi apply
--
-- 1) Phiếu không có IMEI vẫn sửa được (thay NH-... bằng mã phiếu thật):
--      SELECT public.receipt_edit_atomic('NH-KHONG-CO-IMEI', '[]'::jsonb, NULL, 'CN1', NULL, 'test');
--    -> {"success": true}
--
-- 2) Phiếu có IMEI bị chặn, và stock KHÔNG bị đụng tới:
--      SELECT jsonb_pretty(public.receipt_edit_atomic(
--        (SELECT receipt_code FROM public.part_units WHERE receipt_code IS NOT NULL LIMIT 1),
--        '[]'::jsonb, NULL, 'CN2', NULL, 'test'));
--    -> {"success": false, "code": "has_units", "unitCount": N, "message": "..."}
--
-- 3) Xác nhận guard chạy TRƯỚC delete — số máy phải không đổi sau lần gọi ở (2):
--      SELECT count(*) FROM public.part_units;
