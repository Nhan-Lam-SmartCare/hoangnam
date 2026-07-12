-- ============================================================
-- 2026-07-11_tighten_labor_rls_final.sql
--
-- MỤC TIÊU (P1): Siết RLS 4 bảng labor theo vai trò.
--   Hiện trạng (verify 2026-07-10): 4 bảng chỉ còn policy
--   "<table>_authenticated_all" (FOR ALL, authenticated, USING true) →
--   BẤT KỲ user đăng nhập nào (kể cả staff) cũng tự sửa tiền công / % chia /
--   worker_amount của chính mình. Cần siết: chỉ owner/manager được GHI.
--
-- ⚠️  ĐIỀU KIỆN TIÊN QUYẾT — CHỈ CHẠY KHI THỎA:
--   RPC public.upsert_repair_order_labor_bundle TỒN TẠI và security_definer=true.
--   Kiểm chứng:
--     SELECT proname, prosecdef FROM pg_proc
--     WHERE pronamespace='public'::regnamespace
--       AND proname='upsert_repair_order_labor_bundle';
--   Lý do: staff GHI labor khi TẠO PHIẾU qua RPC này (SECURITY DEFINER, bypass
--   RLS). Nếu RPC chưa có, syncRepairOrderServices rơi vào fallback GHI TRỰC
--   TIẾP → siết xong staff KHÔNG tạo được phiếu sửa. Chưa có RPC thì DEPLOY
--   RPC trước (sql/2026-04-01_add_repair_labor_module.sql chứa định nghĩa),
--   KHÔNG chạy file này.
--
-- AN TOÀN (đường hoàn phiếu): clearWorkerCompensationForCanceledOrder GHI trực
--   tiếp labor nhưng CHỈ chạy trong nhánh hoàn phiếu, mà quyền work_order.refund
--   = owner/manager (utils/permissions.ts) → policy owner/manager vẫn cho phép.
--
--   SELECT vẫn mở cho authenticated (cần đọc để hiển thị phiếu).
--   Idempotent: DROP POLICY IF EXISTS + CREATE. Bọc transaction.
-- ============================================================

BEGIN;

DO $$
DECLARE
  t TEXT;
  labor_tbls TEXT[] := ARRAY[
    'repair_order_services',
    'repair_order_service_workers',
    'repair_order_service_items'
  ];
BEGIN
  FOREACH t IN ARRAY labor_tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);

    -- Gỡ policy mở (bao gồm *_authenticated_all cho phép staff ghi)
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_authenticated_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_modify', t);

    -- SELECT: mọi authenticated (đọc để hiển thị phiếu)
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR SELECT TO authenticated
      USING (true);
    $f$, t || '_select', t);

    -- INSERT/UPDATE/DELETE: chỉ owner/manager (staff ghi qua RPC SECURITY DEFINER)
    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (public.current_user_role() IN ('owner','manager'))
      WITH CHECK (public.current_user_role() IN ('owner','manager'));
    $f$, t || '_modify', t);
  END LOOP;
END $$;

-- services (cấu hình dịch vụ dùng chung): SELECT authenticated; GHI chỉ owner
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.services FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.services TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.services;
DROP POLICY IF EXISTS services_authenticated_all ON public.services;
DROP POLICY IF EXISTS services_select ON public.services;
DROP POLICY IF EXISTS services_modify ON public.services;

CREATE POLICY services_select ON public.services
  FOR SELECT TO authenticated USING (true);

CREATE POLICY services_modify ON public.services
  FOR ALL TO authenticated
  USING (public.current_user_role() = 'owner')
  WITH CHECK (public.current_user_role() = 'owner');

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
-- 1) Policy mới đúng vai trò:
-- SELECT tablename, policyname, cmd, roles::text, qual FROM pg_policies
-- WHERE schemaname='public' AND tablename IN
--   ('services','repair_order_services','repair_order_service_workers','repair_order_service_items')
-- ORDER BY tablename, cmd;
--
-- 2) Staff KHÔNG còn ghi trực tiếp được (đăng nhập = staff):
--    UPDATE public.repair_order_service_workers SET worker_amount=99999 WHERE id='<id>';
--    => 0 rows
-- 3) Staff TẠO phiếu (gọi RPC) vẫn OK:
--    SELECT public.upsert_repair_order_labor_bundle('<order>', '[...]'::jsonb);
--    => thành công
