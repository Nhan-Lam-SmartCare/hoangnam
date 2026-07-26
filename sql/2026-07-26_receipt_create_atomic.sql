-- ============================================================================
-- receipt_create_atomic — Tạo phiếu nhập kho NGUYÊN TỬ (+ ghi part_units)
-- Date: 2026-07-26
-- ============================================================================
--
-- ⚠️ VÌ SAO FILE NÀY TỒN TẠI
--   Client đã gọi RPC này từ lâu (inventoryTransactionsRepository.ts:352) nhưng
--   KHẢO SÁT 2026-07-26 cho thấy hàm CHƯA TỪNG ĐƯỢC DEPLOY (pg_proc không có).
--   Nghĩa là mọi phiếu nhập tới nay đều rơi vào nhánh dự phòng
--   runFallbackDirectReceipt() ở tầng JS, vốn có 2 lỗi thật:
--
--     1. Read-modify-write không khóa hàng: đọc parts.stock rồi ghi đè. Hai
--        người nhập cùng 1 sản phẩm cùng lúc -> mất 1 lần cộng, kho thiếu hàng.
--     2. Không có transaction: phiếu 5 dòng lỗi ở dòng 3 -> 2 dòng đã cộng kho,
--        3 dòng chưa. Chính comment ở dòng :340 đã thừa nhận điều này.
--
--   Hàm dưới đây vá cả hai (SELECT ... FOR UPDATE + một transaction duy nhất)
--   VÀ ghi luôn part_units trong cùng transaction. Nhờ vậy không bao giờ xảy ra
--   cảnh "kho đã cộng nhưng IMEI chưa ghi".
--
-- HỢP ĐỒNG VỚI CLIENT (giữ nguyên, không được đổi)
--   Tham số : p_items, p_supplier_id, p_branch_id, p_user_id, p_notes
--   Trả về  : { success: bool, message: text, ... }
--   p_items[] = { partId, partName, quantity, importPrice, sellingPrice,
--                 laborCost, wholesalePrice, imeis: string[], color }
--
-- ĐỐI XỨNG VỚI receipt_delete_atomic (2026-07-14)
--   Hàm xóa tìm giao dịch bằng  notes ILIKE '%<mã phiếu>%'  rồi TRỪ stock.
--   Nên hàm tạo phải CỘNG stock và nhét mã phiếu vào notes. p_notes do client
--   dựng sẵn dạng: "NH-20260726-A3F1 | NV:... NCC:...".
--
-- PHỤ THUỘC: sql/2026-07-26_create_part_units.sql phải chạy TRƯỚC.
--
-- Idempotent (CREATE OR REPLACE).
-- Apply: node scripts/setup/apply-sql.mjs sql/2026-07-26_receipt_create_atomic.sql
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.receipt_create_atomic(
  p_items       jsonb,
  p_supplier_id text,
  p_branch_id   text,
  p_user_id     text,
  p_notes       text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item         jsonb;
  v_part_id      text;
  v_part_name    text;
  v_db_name      text;
  v_qty          numeric;
  v_import       numeric;
  v_selling      numeric;
  v_color        text;
  v_imeis        jsonb;
  v_imei         text;
  v_is_serial    boolean;
  v_imei_count   int;
  v_all_imeis    text[] := '{}';
  v_dup          text;
  v_receipt_code text;
  v_now          timestamptz := now();
  v_lines        int := 0;
  v_units        int := 0;
  v_total        numeric := 0;
BEGIN
  -- ══ Kiểm tra đầu vào ══════════════════════════════════════════════════════
  IF p_branch_id IS NULL OR btrim(p_branch_id) = '' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã chi nhánh');
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phiếu nhập không có sản phẩm');
  END IF;

  -- Bóc mã phiếu từ notes để gắn vào part_units.receipt_code.
  v_receipt_code := substring(COALESCE(p_notes, '') FROM 'NH-[0-9]{8}-[A-Za-z0-9]+');

  -- ══ LƯỢT 1 — THẨM ĐỊNH, CHƯA GHI GÌ ══════════════════════════════════════
  -- Mục tiêu: mọi lỗi nghiệp vụ phải lộ ra ở đây, khi kho còn nguyên vẹn.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := NULLIF(btrim(COALESCE(v_item ->> 'partId', '')), '');
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);

    IF v_part_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;                      -- dòng rỗng: bỏ qua, không phải lỗi
    END IF;

    SELECT name, COALESCE(is_serialized, false)
      INTO v_db_name, v_is_serial
      FROM public.parts
     WHERE id = v_part_id;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'Không tìm thấy sản phẩm: '
                   || COALESCE(NULLIF(v_item ->> 'partName', ''), v_part_id));
    END IF;

    v_part_name := COALESCE(NULLIF(btrim(COALESCE(v_item ->> 'partName', '')), ''), v_db_name);

    v_imeis := CASE WHEN jsonb_typeof(v_item -> 'imeis') = 'array'
                    THEN v_item -> 'imeis' ELSE '[]'::jsonb END;

    SELECT count(*) INTO v_imei_count
      FROM jsonb_array_elements_text(v_imeis) AS t(x)
     WHERE btrim(COALESCE(x, '')) <> '';

    -- Sản phẩm quản lý theo IMEI: số IMEI phải khớp số lượng, không thiếu không thừa.
    IF v_is_serial AND v_imei_count <> v_qty::int THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', format('«%s» cần đúng %s số IMEI (đang có %s)',
                          v_part_name, v_qty::int, v_imei_count));
    END IF;

    -- Gom IMEI + bắt trùng NGAY TRONG cùng một phiếu.
    FOR v_imei IN
      SELECT btrim(x) FROM jsonb_array_elements_text(v_imeis) AS t(x)
       WHERE btrim(COALESCE(x, '')) <> ''
    LOOP
      IF upper(v_imei) = ANY (v_all_imeis) THEN
        RETURN jsonb_build_object(
          'success', false,
          'message', 'IMEI bị nhập lặp trong cùng phiếu: ' || v_imei);
      END IF;
      v_all_imeis := array_append(v_all_imeis, upper(v_imei));
    END LOOP;
  END LOOP;

  -- Bắt trùng với IMEI đã có sẵn trong hệ thống (chống nhập lại máy đã bán).
  IF array_length(v_all_imeis, 1) > 0 THEN
    SELECT string_agg(DISTINCT imei, ', ')
      INTO v_dup
      FROM public.part_units
     WHERE is_placeholder = false
       AND upper(btrim(imei)) = ANY (v_all_imeis);

    IF v_dup IS NOT NULL THEN
      RETURN jsonb_build_object(
        'success', false,
        'message', 'IMEI đã tồn tại trong hệ thống: ' || v_dup,
        'duplicates', v_dup);
    END IF;
  END IF;

  -- ══ LƯỢT 2 — GHI DỮ LIỆU ═════════════════════════════════════════════════
  -- Tới đây mọi thứ đã hợp lệ. Từ điểm này trở đi hoặc thành công trọn vẹn,
  -- hoặc rollback sạch nhờ khối EXCEPTION ở cuối.
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items)
  LOOP
    v_part_id := NULLIF(btrim(COALESCE(v_item ->> 'partId', '')), '');
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);

    IF v_part_id IS NULL OR v_qty <= 0 THEN
      CONTINUE;
    END IF;

    v_import  := COALESCE((v_item ->> 'importPrice')::numeric, 0);
    v_selling := NULLIF(COALESCE((v_item ->> 'sellingPrice')::numeric, 0), 0);
    v_color   := NULLIF(btrim(COALESCE(v_item ->> 'color', '')), '');

    -- KHÓA HÀNG: đây là thứ nhánh fallback JS không làm được.
    SELECT name INTO v_db_name
      FROM public.parts
     WHERE id = v_part_id
       FOR UPDATE;

    v_part_name := COALESCE(NULLIF(btrim(COALESCE(v_item ->> 'partName', '')), ''), v_db_name);

    -- (a) Cộng tồn kho. Không có trigger nào làm việc này -> RPC phải tự làm.
    UPDATE public.parts
       SET stock = jsonb_set(
             COALESCE(stock, '{}'::jsonb),
             ARRAY[p_branch_id],
             to_jsonb(COALESCE((stock ->> p_branch_id)::numeric, 0) + v_qty))
     WHERE id = v_part_id;

    -- (b) Ghi lịch sử kho. notes chứa mã phiếu để receipt_delete_atomic tìm lại.
    INSERT INTO public.inventory_transactions
      (id, type, "partId", "partName", quantity, date,
       "unitPrice", "totalPrice", "branchId", "supplierId", "userId", notes)
    VALUES
      (gen_random_uuid()::text, 'Nhập kho', v_part_id, v_part_name, v_qty, v_now,
       v_import, v_import * v_qty, p_branch_id,
       NULLIF(btrim(COALESCE(p_supplier_id, '')), ''),
       NULLIF(btrim(COALESCE(p_user_id, '')), ''),
       p_notes);

    -- (c) Ghi từng máy vật lý.
    v_imeis := CASE WHEN jsonb_typeof(v_item -> 'imeis') = 'array'
                    THEN v_item -> 'imeis' ELSE '[]'::jsonb END;

    FOR v_imei IN
      SELECT btrim(x) FROM jsonb_array_elements_text(v_imeis) AS t(x)
       WHERE btrim(COALESCE(x, '')) <> ''
    LOOP
      INSERT INTO public.part_units
        (part_id, branch_id, imei, color, import_price, selling_price,
         status, receipt_code, supplier_id, received_at)
      VALUES
        (v_part_id, p_branch_id, v_imei, v_color, v_import, v_selling,
         'in_stock', v_receipt_code,
         NULLIF(btrim(COALESCE(p_supplier_id, '')), ''), v_now);

      v_units := v_units + 1;
    END LOOP;

    v_lines := v_lines + 1;
    v_total := v_total + v_import * v_qty;
  END LOOP;

  IF v_lines = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Phiếu nhập không có dòng hợp lệ');
  END IF;

  RETURN jsonb_build_object(
    'success',     true,
    'message',     'Nhập kho thành công',
    'receiptCode', v_receipt_code,
    'lines',       v_lines,
    'unitsCreated', v_units,
    'totalAmount', v_total);

EXCEPTION
  -- Khối EXCEPTION tạo subtransaction bao trọn thân hàm: bắt được lỗi nghĩa là
  -- MỌI thay đổi ở lượt 2 đã rollback. Client nhận success=false, kho nguyên vẹn.
  WHEN unique_violation THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'IMEI trùng, phiếu nhập đã được hoàn tác: ' || SQLERRM);
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Lỗi nhập kho, đã hoàn tác toàn bộ: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.receipt_create_atomic(jsonb, text, text, text, text) TO authenticated;

COMMIT;
