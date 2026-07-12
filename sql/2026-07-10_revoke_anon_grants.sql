-- ============================================================
-- 2026-07-10_revoke_anon_grants.sql
--
-- MỤC TIÊU (P0): Thu hồi mọi quyền của vai trò `anon` trên các đối tượng
-- còn hở sau khi đã xóa policy mở. Kiểm tra role_table_grants (2026-07-10)
-- cho thấy anon vẫn còn full grant trên:
--   - VIEW: cash_transactions_ledger, inventory_balances_view
--     (view KHÔNG có RLS → anon SELECT = đọc thẳng sổ quỹ / tồn kho) 🔴
--   - TABLE: audit_logs, notifications, repair_templates (cần xác nhận RLS)
--   - TABLE: sales, work_orders (đã có RLS authenticated; revoke cho sạch)
--
-- AN TOÀN: grant của anon độc lập với authenticated → REVOKE không ảnh hưởng
--   app (app luôn chạy bằng user đã đăng nhập). App này không đọc bảng nào
--   trước khi đăng nhập nên anon không cần quyền gì trên schema public.
--   Idempotent, bọc trong transaction.
-- ============================================================

BEGIN;

-- Views lộ dữ liệu tài chính/kho
REVOKE ALL ON public.cash_transactions_ledger FROM anon;
REVOKE ALL ON public.inventory_balances_view  FROM anon;

-- Tables
REVOKE ALL ON public.audit_logs        FROM anon;
REVOKE ALL ON public.notifications      FROM anon;
REVOKE ALL ON public.repair_templates   FROM anon;
REVOKE ALL ON public.sales              FROM anon;
REVOKE ALL ON public.work_orders        FROM anon;

COMMIT;

-- ============================================================
-- VERIFY (kỳ vọng: RỖNG)
-- ============================================================
-- SELECT table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee='anon' AND table_schema='public'
-- ORDER BY table_name;
