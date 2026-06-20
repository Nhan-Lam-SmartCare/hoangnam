-- ============================================================
-- 2026-06-20_tighten_labor_rls.sql
--
-- Mục tiêu: Siết RLS trên 4 bảng liên quan đến tiền công sửa chữa.
--
-- Vấn đề hiện tại:
--   repair_order_services, repair_order_service_workers,
--   repair_order_service_items, services đều có policy "Enable all
--   access for all users" USING(true) — cho phép staff tự sửa tiền công,
--   % chia, worker_amount của chính mình.
--
-- Giải pháp:
--   - SELECT: tất cả authenticated (cần đọc để hiển thị phiếu sửa)
--   - INSERT/UPDATE/DELETE: chỉ owner + manager
--   - Staff ghi dữ liệu qua RPC upsert_repair_order_labor_bundle
--     (SECURITY DEFINER) — vẫn hoạt động bình thường.
--   - Bảng services (config dịch vụ): INSERT/UPDATE/DELETE chỉ owner.
--
-- An toàn:
--   - syncRepairOrderServices đã gọi RPC upsert_repair_order_labor_bundle
--     (SECURITY DEFINER) → bypass RLS → staff vẫn lưu được labor khi tạo
--     phiếu sửa.
--   - recalculate_repair_order_labor_totals cũng SECURITY DEFINER.
--   - Idempotent: DROP POLICY IF EXISTS + CREATE POLICY.
-- ============================================================

BEGIN;

-- ============================================================
-- A) repair_order_services
-- ============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.repair_order_services;
DROP POLICY IF EXISTS repair_order_services_select ON public.repair_order_services;
DROP POLICY IF EXISTS repair_order_services_modify ON public.repair_order_services;

CREATE POLICY repair_order_services_select
ON public.repair_order_services
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY repair_order_services_modify
ON public.repair_order_services
FOR ALL
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  public.current_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- B) repair_order_service_workers
-- ============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.repair_order_service_workers;
DROP POLICY IF EXISTS repair_order_service_workers_select ON public.repair_order_service_workers;
DROP POLICY IF EXISTS repair_order_service_workers_modify ON public.repair_order_service_workers;

CREATE POLICY repair_order_service_workers_select
ON public.repair_order_service_workers
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY repair_order_service_workers_modify
ON public.repair_order_service_workers
FOR ALL
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  public.current_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- C) repair_order_service_items
-- ============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.repair_order_service_items;
DROP POLICY IF EXISTS repair_order_service_items_select ON public.repair_order_service_items;
DROP POLICY IF EXISTS repair_order_service_items_modify ON public.repair_order_service_items;

CREATE POLICY repair_order_service_items_select
ON public.repair_order_service_items
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY repair_order_service_items_modify
ON public.repair_order_service_items
FOR ALL
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
)
WITH CHECK (
  public.current_user_role() IN ('owner', 'manager')
);

-- ============================================================
-- D) services (service config) — chỉ owner mới được sửa
-- ============================================================
DROP POLICY IF EXISTS "Enable all access for all users" ON public.services;
DROP POLICY IF EXISTS services_select ON public.services;
DROP POLICY IF EXISTS services_modify ON public.services;

CREATE POLICY services_select
ON public.services
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY services_modify
ON public.services
FOR ALL
TO authenticated
USING (
  public.current_user_role() = 'owner'
)
WITH CHECK (
  public.current_user_role() = 'owner'
);

-- ============================================================
-- Đảm bảo các RPC SECURITY DEFINER vẫn có GRANT
-- ============================================================
DO $$
BEGIN
  -- upsert_repair_order_labor_bundle
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'upsert_repair_order_labor_bundle') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.upsert_repair_order_labor_bundle TO authenticated, service_role';
  END IF;

  -- recalculate_repair_order_labor_totals
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'recalculate_repair_order_labor_totals') THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION public.recalculate_repair_order_labor_totals(TEXT) TO authenticated, service_role';
  END IF;
END $$;

COMMIT;

-- ============================================================
-- VERIFY (chạy tay trong Supabase SQL Editor)
-- ============================================================
-- 1) Đăng nhập = staff:
--    UPDATE public.repair_order_service_workers SET worker_amount=99999 WHERE id='...';
--    => 0 rows (bị RLS chặn)
--
-- 2) Đăng nhập = staff, gọi RPC (phải OK):
--    SELECT public.upsert_repair_order_labor_bundle('...', '[...]'::jsonb);
--    => thành công (SECURITY DEFINER bypass RLS)
--
-- 3) Đăng nhập = owner:
--    UPDATE public.repair_order_service_workers SET worker_amount=99999 WHERE id='...';
--    => 1 row (owner được phép)
--
-- 4) Kiểm tra policy mới:
--    SELECT policyname, cmd, qual FROM pg_policies
--    WHERE schemaname='public' AND tablename IN (
--      'repair_order_services', 'repair_order_service_workers',
--      'repair_order_service_items', 'services'
--    );
