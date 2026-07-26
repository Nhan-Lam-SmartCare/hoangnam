-- ============================================================================
-- part_units — RPC nghiệp vụ: kiểm tra IMEI, bán, hoàn, xóa phiếu
-- Date: 2026-07-26
-- ============================================================================
--
-- PHỤ THUỘC: sql/2026-07-26_create_part_units.sql phải chạy TRƯỚC.
--
-- File này gồm 5 hàm:
--   1. part_units_check_imeis      — tiền kiểm IMEI trước khi lưu phiếu nhập
--   2. part_units_mark_sold        — đánh dấu máy đã bán (chống bán trùng)
--   3. part_units_release          — hoàn máy về kho theo danh sách id
--   4. part_units_release_by_sale  — hoàn toàn bộ máy của một đơn bán
--   5. receipt_delete_atomic       — GHI ĐÈ bản 2026-07-14, dạy nó biết part_units
--
-- VÌ SAO TẤT CẢ ĐỀU SECURITY DEFINER
--   IMEI phải là duy nhất trên TOÀN HỆ THỐNG, không phải trong một chi nhánh.
--   Máy đã nhập ở CN1 mà cho nhập lại ở CN2 là lỗ hổng nghiêm trọng. Nhưng RLS
--   của part_units chặn staff nhìn sang chi nhánh khác. Nên các hàm này chạy
--   quyền owner để kiểm tra xuyên chi nhánh, và CHỈ trả về thông tin tối thiểu
--   (imei, trạng thái, tên sản phẩm) — không rò rỉ giá vốn hay chi nhánh nào.
--
-- Idempotent.
-- ⚠️ APPLY bằng Supabase SQL Editor (dán nguyên nội dung file). KHÔNG dùng
--    scripts/setup/apply-sql.mjs: script đó chạy qua RPC exec_sql, mà DB này
--    không có (xem ghi chú ở sql/2026-07-13_sale_delete_atomic.sql).
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. part_units_check_imeis — tiền kiểm, gọi TRƯỚC khi lưu phiếu nhập
-- ════════════════════════════════════════════════════════════════════════════
-- receipt_create_atomic đã tự kiểm tra bên trong rồi. Hàm này để UI cảnh báo
-- SỚM, ngay lúc nhân viên vừa gõ xong IMEI, thay vì đợi bấm "NHẬP KHO" mới báo.
--
-- Trả về mảng rỗng [] nghĩa là tất cả IMEI đều dùng được.
CREATE OR REPLACE FUNCTION public.part_units_check_imeis(p_imeis text[])
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_imeis IS NULL OR array_length(p_imeis, 1) IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'imei',     u.imei,
           'status',   u.status,
           'partName', p.name,
           'soldAt',   u.sold_at
         )), '[]'::jsonb)
    INTO v_result
    FROM public.part_units u
    JOIN public.parts p ON p.id = u.part_id
   WHERE u.is_placeholder = false
     AND upper(btrim(u.imei)) = ANY (
           SELECT upper(btrim(x)) FROM unnest(p_imeis) AS t(x)
            WHERE btrim(COALESCE(x, '')) <> ''
         );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.part_units_check_imeis(text[]) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. part_units_mark_sold — đây là thứ chặn bán trùng một chiếc máy
-- ════════════════════════════════════════════════════════════════════════════
-- Hoặc TẤT CẢ máy trong lô chuyển sang 'sold', hoặc KHÔNG máy nào chuyển.
-- FOR UPDATE khóa hàng: hai nhân viên bấm bán cùng chiếc máy cùng lúc thì một
-- người phải thua, không thể cả hai cùng thắng.
CREATE OR REPLACE FUNCTION public.part_units_mark_sold(
  p_unit_ids uuid[],
  p_sale_id  text,
  p_sold_at  timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expected int;
  v_locked   int;
  v_bad      text;
  v_updated  int;
BEGIN
  IF p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  SELECT count(DISTINCT x) INTO v_expected FROM unnest(p_unit_ids) AS t(x);

  -- Khóa trước, kiểm tra sau. Thứ tự này quan trọng: kiểm tra rồi mới khóa sẽ
  -- để lọt khoảng trống cho phiên khác chen vào giữa.
  SELECT count(*) INTO v_locked
    FROM (SELECT id FROM public.part_units
           WHERE id = ANY (p_unit_ids) FOR UPDATE) AS locked;

  IF v_locked <> v_expected THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Không tìm thấy %s máy trong hệ thống', v_expected - v_locked));
  END IF;

  SELECT string_agg(format('%s (%s)', imei, status), ', ')
    INTO v_bad
    FROM public.part_units
   WHERE id = ANY (p_unit_ids)
     AND status NOT IN ('in_stock', 'reserved');

  IF v_bad IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Máy không còn khả dụng để bán: ' || v_bad,
      'unavailable', v_bad);
  END IF;

  UPDATE public.part_units
     SET status  = 'sold',
         sale_id = NULLIF(btrim(COALESCE(p_sale_id, '')), ''),
         sold_at = COALESCE(p_sold_at, now())
   WHERE id = ANY (p_unit_ids);

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.part_units_mark_sold(uuid[], text, timestamptz) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 3. part_units_release — hoàn máy về kho
-- ════════════════════════════════════════════════════════════════════════════
-- Dùng khi hủy đơn / khách trả hàng. Cập nhật trên CÙNG dòng cũ, không tạo dòng
-- mới — nhờ vậy IMEI unique không vỡ và lịch sử chiếc máy liền mạch.
CREATE OR REPLACE FUNCTION public.part_units_release(
  p_unit_ids uuid[],
  p_reason   text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_updated int;
BEGIN
  IF p_unit_ids IS NULL OR array_length(p_unit_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  UPDATE public.part_units
     SET status  = 'in_stock',
         sale_id = NULL,
         sold_at = NULL,
         note    = CASE
                     WHEN btrim(COALESCE(p_reason, '')) = '' THEN note
                     ELSE concat_ws(' | ', note,
                            to_char(now(), 'DD/MM/YYYY') || ': ' || p_reason)
                   END
   WHERE id = ANY (p_unit_ids)
     AND status <> 'in_stock';

  GET DIAGNOSTICS v_updated = ROW_COUNT;

  RETURN jsonb_build_object('success', true, 'updated', v_updated);
END;
$$;

GRANT EXECUTE ON FUNCTION public.part_units_release(uuid[], text) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 4. part_units_release_by_sale — hoàn toàn bộ máy của một đơn
-- ════════════════════════════════════════════════════════════════════════════
-- Dành cho sale_delete_atomic / sale_return_partial_atomic gọi tới ở Phase 6.
CREATE OR REPLACE FUNCTION public.part_units_release_by_sale(
  p_sale_id text,
  p_reason  text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ids uuid[];
BEGIN
  IF btrim(COALESCE(p_sale_id, '')) = '' THEN
    RETURN jsonb_build_object('success', true, 'updated', 0);
  END IF;

  SELECT array_agg(id) INTO v_ids
    FROM public.part_units
   WHERE sale_id = p_sale_id AND status = 'sold';

  RETURN public.part_units_release(
           v_ids,
           COALESCE(p_reason, 'Hoàn kho do hủy/trả đơn ' || p_sale_id));
END;
$$;

GRANT EXECUTE ON FUNCTION
  public.part_units_release_by_sale(text, text) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 5. receipt_delete_atomic — GHI ĐÈ bản 2026-07-14
-- ════════════════════════════════════════════════════════════════════════════
-- Bản cũ trừ stock + xóa tx/công nợ/sổ quỹ nhưng KHÔNG biết part_units tồn tại.
-- Hậu quả nếu để nguyên: xóa phiếu nhập -> stock về 0 nhưng IMEI vẫn nằm đó ở
-- trạng thái 'in_stock' -> v_part_units_reconcile báo lệch vĩnh viễn, và tệ hơn
-- là mấy chiếc máy ma đó vẫn hiện ra ở màn Bán hàng.
--
-- THAY ĐỔI SO VỚI BẢN CŨ (giữ nguyên phần còn lại từng dòng một):
--   (a) Chặn xóa nếu có máy trong phiếu ĐÃ BÁN. Không thể xóa lịch sử nhập của
--       một chiếc máy đang nằm trong tay khách.
--   (b) Xóa các part_units còn in_stock thuộc phiếu này.
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
  v_tx        record;
  v_tx_json   jsonb;
  v_part_id   text;
  v_qty       numeric;
  v_branch    text;
  v_sold      text;
  v_units_del int := 0;
BEGIN
  IF p_receipt_code IS NULL OR length(trim(p_receipt_code)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã phiếu nhập');
  END IF;

  IF p_branch_id IS NULL OR length(trim(p_branch_id)) = 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Thiếu mã chi nhánh');
  END IF;

  -- (a) MỚI: chặn xóa nếu máy trong phiếu đã bán ra.
  SELECT string_agg(imei, ', ')
    INTO v_sold
    FROM public.part_units
   WHERE receipt_code = p_receipt_code
     AND status <> 'in_stock';

  IF v_sold IS NOT NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Không thể xóa phiếu: các máy sau đã xuất kho — ' || v_sold);
  END IF;

  -- 1. Hoàn trả tồn kho cho từng giao dịch  (giữ nguyên bản 2026-07-14)
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

  -- (b) MỚI: gỡ các máy đã nhập theo phiếu này (chắc chắn đều còn in_stock
  --     nhờ chốt chặn ở bước (a) phía trên).
  DELETE FROM public.part_units WHERE receipt_code = p_receipt_code;
  GET DIAGNOSTICS v_units_del = ROW_COUNT;

  -- 2. Xóa các bản ghi liên quan  (giữ nguyên bản 2026-07-14)
  DELETE FROM public.inventory_transactions
  WHERE notes ILIKE '%' || p_receipt_code || '%';

  DELETE FROM public.supplier_debts
  WHERE description ILIKE '%' || p_receipt_code || '%';

  DELETE FROM public.cash_transactions
  WHERE notes ILIKE '%' || p_receipt_code || '%'
     OR description ILIKE '%' || p_receipt_code || '%';

  RETURN jsonb_build_object('success', true, 'unitsDeleted', v_units_del);
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.receipt_delete_atomic(text, text) TO authenticated;

COMMIT;
