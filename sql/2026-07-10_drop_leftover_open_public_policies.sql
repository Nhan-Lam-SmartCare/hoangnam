-- ============================================================
-- 2026-07-10_drop_leftover_open_public_policies.sql
--
-- MỤC TIÊU (P0 KHẨN): Xóa các policy mở "Enable all access for all users"
-- (roles = public, USING true) còn sót trên 7 bảng nhạy cảm.
--
-- BỐI CẢNH:
--   Kiểm tra pg_policies trên production (2026-07-10) cho thấy các policy
--   siết theo vai trò ĐÃ được apply, NHƯNG policy mở cũ vẫn tồn tại song song.
--   Trong PostgreSQL, các policy permissive được cộng dồn bằng OR → chừng nào
--   còn 1 policy {public} USING(true) thì mọi policy an toàn khác đều vô nghĩa:
--   bất kỳ ai (kể cả anon/chưa đăng nhập) vẫn đọc/ghi/xóa được.
--   Policy mở tái sinh do RUNME_complete_migration.sql / 2026-04-01 labor bị
--   chạy lại sau khi apply tighten (đã hardening 2 file đó để chống tái phát).
--
-- AN TOÀN:
--   - CHỈ xóa policy mở. Các policy an toàn TO authenticated đã có sẵn:
--       cash_transactions_*, payment_sources_*, inventory_transactions_*,
--       <labor>_authenticated_all  → app vẫn hoạt động bình thường sau khi chạy.
--   - REVOKE lại quyền của anon (defense-in-depth).
--   - Idempotent (DROP ... IF EXISTS), bọc trong transaction.
-- ============================================================

BEGIN;

-- Bảng tài chính / kho
DROP POLICY IF EXISTS "Enable all access for all users" ON public.cash_transactions;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.payment_sources;

-- Bảng tiền công / cấu hình dịch vụ (labor)
DROP POLICY IF EXISTS "Enable all access for all users" ON public.services;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.repair_order_services;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.repair_order_service_workers;
DROP POLICY IF EXISTS "Enable all access for all users" ON public.repair_order_service_items;

-- Chặn anon (defense-in-depth; sau khi xóa policy public, anon vốn đã bị RLS từ chối)
REVOKE ALL ON public.cash_transactions            FROM anon;
REVOKE ALL ON public.inventory_transactions       FROM anon;
REVOKE ALL ON public.payment_sources              FROM anon;
REVOKE ALL ON public.services                     FROM anon;
REVOKE ALL ON public.repair_order_services        FROM anon;
REVOKE ALL ON public.repair_order_service_workers FROM anon;
REVOKE ALL ON public.repair_order_service_items   FROM anon;

COMMIT;

-- ============================================================
-- VERIFY (chạy sau khi apply — kỳ vọng: RỖNG)
-- ============================================================
-- SELECT tablename, policyname, roles, qual
-- FROM pg_policies
-- WHERE schemaname='public'
--   AND policyname = 'Enable all access for all users';
-- (kết quả mong đợi: 0 dòng)
