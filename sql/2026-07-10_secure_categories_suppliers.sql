-- ============================================================
-- 2026-07-10_secure_categories_suppliers.sql
--
-- MỤC TIÊU (P0): Chặn anon/public trên 2 bảng còn sót policy mở
-- "Enable all access for all users" ({public}, USING true): categories, suppliers.
--
-- BỐI CẢNH:
--   Sau khi xóa policy mở trên 7 bảng tài chính/labor (2026-07-10_drop_leftover_
--   open_public_policies.sql), verify pg_policies vẫn còn categories + suppliers
--   dính policy {public} USING(true) → anon vẫn đọc/ghi/xóa được.
--   2 bảng này không nằm trong file tighten nào → CHỈ có mỗi policy mở, nên phải
--   TẠO policy authenticated thay thế TRƯỚC/ĐỒNG THỜI khi xóa policy mở, nếu
--   không app sẽ mất quyền đọc.
--
-- MỨC SIẾT: dữ liệu vận hành ít nhạy cảm (danh mục, nhà cung cấp) → chỉ cần
--   CHẶN anon, cho authenticated toàn quyền (staff cần tạo NCC khi nhập kho,
--   sửa danh mục). Không phá luồng hiện tại.
--
-- AN TOÀN: idempotent (DROP ... IF EXISTS trước CREATE), bọc trong transaction.
-- ============================================================

BEGIN;

-- ---------- categories ----------
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.categories FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categories TO authenticated, service_role;

DROP POLICY IF EXISTS categories_authenticated_all ON public.categories;
CREATE POLICY categories_authenticated_all ON public.categories
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.categories;

-- ---------- suppliers ----------
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.suppliers FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.suppliers TO authenticated, service_role;

DROP POLICY IF EXISTS suppliers_authenticated_all ON public.suppliers;
CREATE POLICY suppliers_authenticated_all ON public.suppliers
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Enable all access for all users" ON public.suppliers;

COMMIT;

-- ============================================================
-- VERIFY (kỳ vọng: 0 dòng)
-- ============================================================
-- SELECT tablename, policyname, roles FROM pg_policies
-- WHERE schemaname='public' AND policyname = 'Enable all access for all users';
