-- ============================================================
-- 2026-06-19_secure_profiles_and_remaining_tables.sql
--
-- Muc tieu (P0 security - VA LO HONG LEO THANG DAC QUYEN):
--   1) Bang `profiles` chua bat RLS => bat ky `authenticated` nao cung co the
--      tu chay `update profiles set role='owner'` => chiem quyen owner, vo hieu
--      hoa toan bo phan quyen (vi current_user_role() doc tu profiles.role).
--      => BAT RLS + chi owner moi duoc INSERT/UPDATE/DELETE profiles.
--   2) Cac bang nhay cam con lai chua duoc siet o 2026-06-16 va van mo cho `anon`:
--        employees (chua base_salary - LUONG), customer_debts, supplier_debts,
--        store_settings, customers, parts.
--      => REVOKE anon + policy theo role/branch.
--
-- LUU Y QUAN TRONG (chong de quy / recursion):
--   current_user_role() & current_user_branch_id() doc tu public.profiles.
--   Sau khi BAT RLS tren profiles, neu policy SELECT cua profiles goi lai 2 ham
--   nay (cung doc profiles) => de quy vo han.
--   => Tai khai bao 2 ham la SECURITY DEFINER + search_path co dinh de chung
--      BYPASS RLS khi doc profiles (an toan, chi doc role/branch cua chinh user).
--
-- An toan / khong lam vo app dang chay:
--   - KHONG co flow client nao ghi truc tiep vao `profiles`: tao/sua/xoa tai khoan
--     deu di qua /api/staff/* (dung service_role => bypass RLS).
--     => Khoa INSERT/UPDATE/DELETE profiles ve owner-only la AN TOAN.
--   - service_role luon bypass RLS nen API server van chay binh thuong.
--   - Idempotent: CREATE OR REPLACE, DROP POLICY IF EXISTS, bao trong transaction.
--   - Dung mo hinh `to_jsonb(row) ->> 'col'` cho cot chi nhanh (branchId/branchid/
--     branch_id) de an toan ca khi ten cot khac nhau giua cac bang.
--
-- No ky thuat con lai (follow-up, NGOAI pham vi P0):
--   - employees.base_salary van lo cho staff cung chi nhanh qua SELECT * (RLS la
--     row-level, khong an cot). Buoc tiep: tao view an cot luong cho staff.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper functions: tai khai bao la SECURITY DEFINER de bypass RLS profiles.
-- (Giu nguyen logic resolve role/branch nhu 2026-04-09 / 2026-06-16.)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH role_source AS (
    SELECT LOWER(
      COALESCE(
        NULLIF((
          SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
        ), ''),
        -- Uu tien app_metadata (chi service_role ghi duoc) hon user_metadata.
        NULLIF((auth.jwt() -> 'app_metadata' ->> 'role'), ''),
        NULLIF((auth.jwt() -> 'user_metadata' ->> 'role'), ''),
        'staff'
      )
    ) AS role_raw
  )
  SELECT CASE
    WHEN role_raw IN ('owner', 'manager', 'staff') THEN role_raw
    WHEN role_raw IN ('employee','nhanvien','nhan_vien','nhan-vien','technician','tech','sales','sale') THEN 'staff'
    ELSE 'staff'
  END
  FROM role_source
$$;

CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT COALESCE(
        NULLIF(to_jsonb(p) ->> 'branch_id', ''),
        NULLIF(to_jsonb(p) ->> 'branchId', ''),
        NULLIF(to_jsonb(p) ->> 'branchid', '')
      )
      FROM public.profiles p
      WHERE p.id = auth.uid()
      LIMIT 1
    ),
    NULLIF((auth.jwt() -> 'app_metadata' ->> 'branch_id'), ''),
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'branch_id'), ''),
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'branchId'), ''),
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'branchid'), '')
  )
$$;

GRANT EXECUTE ON FUNCTION public.current_user_role() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_branch_id() TO authenticated, anon, service_role;

-- ============================================================
-- profiles  -- NGUON SU THAT cua role/branch => chong leo thang dac quyen
--   SELECT: owner all; manager/staff doc dong cua minh + dong cung chi nhanh.
--   INSERT/UPDATE/DELETE: chi owner (client thuong KHONG ghi; server dung
--     service_role nen bypass). Khoa o owner = staff khong the tu nang role.
-- ============================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.profiles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Allow all access" ON public.profiles;
DROP POLICY IF EXISTS profiles_select ON public.profiles;
DROP POLICY IF EXISTS profiles_insert ON public.profiles;
DROP POLICY IF EXISTS profiles_update ON public.profiles;
DROP POLICY IF EXISTS profiles_delete ON public.profiles;

CREATE POLICY profiles_select
ON public.profiles
FOR SELECT
TO authenticated
USING (
  id = auth.uid()
  OR public.current_user_role() = 'owner'
  OR (
    public.current_user_role() IN ('manager', 'staff')
    AND (
      NULLIF(public.current_user_branch_id(), '') IS NULL
      OR COALESCE(
           NULLIF(to_jsonb(profiles) ->> 'branch_id', ''),
           NULLIF(to_jsonb(profiles) ->> 'branchId', ''),
           NULLIF(to_jsonb(profiles) ->> 'branchid', ''),
           'CN1'
         ) = public.current_user_branch_id()
    )
  )
);

CREATE POLICY profiles_insert
ON public.profiles
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() = 'owner');

CREATE POLICY profiles_update
ON public.profiles
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

CREATE POLICY profiles_delete
ON public.profiles
FOR DELETE
TO authenticated
USING (public.current_user_role() = 'owner');

-- ============================================================
-- employees  -- chua base_salary (LUONG) => khong de mo cho anon.
--   SELECT: owner/manager all; staff cung chi nhanh (can doc ten tho de phan cong).
--   INSERT/UPDATE/DELETE: chi owner/manager.
-- ============================================================
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.employees FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.employees;
DROP POLICY IF EXISTS employees_select ON public.employees;
DROP POLICY IF EXISTS employees_write ON public.employees;
DROP POLICY IF EXISTS employees_insert ON public.employees;
DROP POLICY IF EXISTS employees_update ON public.employees;
DROP POLICY IF EXISTS employees_delete ON public.employees;

CREATE POLICY employees_select
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
  OR COALESCE(
       NULLIF(to_jsonb(employees) ->> 'branchId', ''),
       NULLIF(to_jsonb(employees) ->> 'branchid', ''),
       NULLIF(to_jsonb(employees) ->> 'branch_id', ''),
       'CN1'
     ) = COALESCE(NULLIF(public.current_user_branch_id(), ''), 'CN1')
);

CREATE POLICY employees_insert
ON public.employees
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY employees_update
ON public.employees
FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'))
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY employees_delete
ON public.employees
FOR DELETE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'));

-- ============================================================
-- customer_debts / supplier_debts  -- cong no
--   SELECT: owner/manager all; staff cung chi nhanh.
--   INSERT: moi authenticated (staff tao no khi ban/sua chua chua thu du tien).
--   UPDATE/DELETE: chi owner/manager.
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY['customer_debts', 'supplier_debts'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);

    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_delete', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR SELECT TO authenticated
      USING (
        public.current_user_role() IN ('owner', 'manager')
        OR COALESCE(
             NULLIF(to_jsonb(%I) ->> 'branchId', ''),
             NULLIF(to_jsonb(%I) ->> 'branchid', ''),
             NULLIF(to_jsonb(%I) ->> 'branch_id', ''),
             'CN1'
           ) = COALESCE(NULLIF(public.current_user_branch_id(), ''), 'CN1')
      );
    $f$, t || '_select', t, t, t, t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR INSERT TO authenticated
      WITH CHECK (true);
    $f$, t || '_insert', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR UPDATE TO authenticated
      USING (public.current_user_role() IN ('owner', 'manager'))
      WITH CHECK (public.current_user_role() IN ('owner', 'manager'));
    $f$, t || '_update', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR DELETE TO authenticated
      USING (public.current_user_role() IN ('owner', 'manager'));
    $f$, t || '_delete', t);
  END LOOP;
END $$;

-- ============================================================
-- store_settings  -- cau hinh cua hang (so TK ngan hang...).
--   SELECT: moi authenticated (can cho in phieu / hien thi).
--   INSERT/UPDATE/DELETE: chi owner/manager.
-- ============================================================
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.store_settings FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.store_settings TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.store_settings;
DROP POLICY IF EXISTS store_settings_select ON public.store_settings;
DROP POLICY IF EXISTS store_settings_write ON public.store_settings;

CREATE POLICY store_settings_select
ON public.store_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY store_settings_write
ON public.store_settings
FOR ALL
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'))
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

-- ============================================================
-- customers / parts  -- du lieu van hanh, staff can doc+ghi trong luong binh thuong
--   (tao khach khi lap phieu, dieu chinh kho khi ban). Pham vi P0: chi CHAN anon,
--   bat buoc authenticated. XOA: chi owner/manager.
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY['customers', 'parts'];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);

    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_select', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_write', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_insert', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_update', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_delete', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR SELECT TO authenticated USING (true);
    $f$, t || '_select', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR INSERT TO authenticated WITH CHECK (true);
    $f$, t || '_insert', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
    $f$, t || '_update', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR DELETE TO authenticated
      USING (public.current_user_role() IN ('owner', 'manager'));
    $f$, t || '_delete', t);
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- VERIFY (chay tay trong Supabase SQL Editor sau khi apply)
-- ============================================================
-- 1) profiles da bat RLS va KHONG con policy USING(true) cho ghi:
-- SELECT tablename, policyname, cmd, roles, qual, with_check
-- FROM pg_policies WHERE schemaname='public' AND tablename='profiles' ORDER BY cmd;
--
-- 2) Helper la SECURITY DEFINER:
-- SELECT proname, prosecdef FROM pg_proc
-- WHERE proname IN ('current_user_role','current_user_branch_id');
-- (prosecdef = true)
--
-- 3) anon khong con quyen tren bang nhay cam:
-- SELECT table_name, privilege_type FROM information_schema.role_table_grants
-- WHERE grantee='anon' AND table_schema='public'
--   AND table_name IN ('profiles','employees','customer_debts','supplier_debts',
--                      'store_settings','customers','parts');
-- (ket qua mong doi: rong)
--
-- 4) Test leo thang dac quyen (dang nhap = staff):
--   UPDATE public.profiles SET role='owner' WHERE id = auth.uid();
--   => phai bi tu choi (0 rows / RLS violation).
