-- ============================================================
-- 2026-07-10_enable_rls_notifications_repair_templates.sql
--
-- MỤC TIÊU (P0): Bật RLS cho 2 bảng còn TẮT RLS trong schema public:
--   notifications, repair_templates (rls_enabled=false, 0 policy).
--
-- BỐI CẢNH:
--   Bảng ở schema public mà tắt RLS => mọi role có GRANT truy cập không lọc.
--   Đã REVOKE anon, nhưng authenticated vẫn đọc/ghi tự do (vd staff xem thông
--   báo chéo chi nhánh). Bật RLS + policy authenticated để khép kín.
--
-- MỨC SIẾT (P0 = chặn anon + bắt buộc authenticated, KHÔNG phá luồng):
--   - notifications  : authenticated toàn quyền. (Scope theo chi nhánh/role =
--                      P1 follow-up; hiện app lọc phía client qua useNotifications.)
--   - repair_templates: cấu hình mẫu sửa chữa dùng chung -> authenticated toàn quyền.
--
-- AN TOÀN: idempotent (DROP POLICY IF EXISTS), bọc transaction. App chạy bằng
--   user đã đăng nhập nên policy authenticated USING(true) không phá gì.
-- ============================================================

BEGIN;

-- ---------- notifications ----------
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated, service_role;

DROP POLICY IF EXISTS notifications_authenticated_all ON public.notifications;
CREATE POLICY notifications_authenticated_all ON public.notifications
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ---------- repair_templates ----------
ALTER TABLE public.repair_templates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.repair_templates FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.repair_templates TO authenticated, service_role;

DROP POLICY IF EXISTS repair_templates_authenticated_all ON public.repair_templates;
CREATE POLICY repair_templates_authenticated_all ON public.repair_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

COMMIT;

-- ============================================================
-- VERIFY (kỳ vọng: cả 2 bảng rls_enabled=true, policy_count=1)
-- ============================================================
-- SELECT c.relname, c.relrowsecurity AS rls_enabled,
--        (SELECT count(*) FROM pg_policies p
--         WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
-- FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
-- WHERE n.nspname='public' AND c.relname IN ('notifications','repair_templates');
