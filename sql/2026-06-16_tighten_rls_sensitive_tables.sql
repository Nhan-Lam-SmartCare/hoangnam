-- ============================================================
-- 2026-06-16_tighten_rls_sensitive_tables.sql
--
-- Muc tieu (P0 security):
--   Thay cac policy "Enable all access for all users" (USING true) dang mo
--   tren cac bang nhay cam bang policy theo role/branch.
--
-- Cac van de dang ton tai (truoc migration nay):
--   1) Nhieu bang GRANT ... TO anon + USING(true) => bat ky ai co anon key
--      (ke ca CHUA DANG NHAP) deu doc/ghi/xoa duoc, gom ca bang luong.
--   2) Staff o chi nhanh A doc duoc du lieu tai chinh cua chi nhanh B.
--
-- Nguyen tac thiet ke (de KHONG lam vo app dang chay):
--   - Chan hoan toan vai tro `anon`: REVOKE grant + policy chi TO authenticated.
--   - Doc (SELECT): owner/manager xem toan bo; staff gioi han theo chi nhanh.
--   - Ghi (INSERT/UPDATE) giu mo cho `authenticated` o nhung bang ma client
--     ghi truc tiep trong luong nghiep vu binh thuong cua staff:
--       * cash_transactions  : staff INSERT khi thu/chi tu phieu sua chua, ban hang.
--       * inventory_transactions : staff INSERT khi ban/nhap kho.
--       * payment_sources    : updatePaymentSourceBalance() chay client-side
--                              (cap nhat so du khi ban hang) => UPDATE phai mo.
--   - XOA (DELETE) so cai tai chinh: chi owner/manager.
--   - payroll_records (LUONG - nhay cam nhat): chi owner (toan bo) + manager
--     (chi nhanh cua minh). Staff KHONG truy cap. UI da gate o owner/manager.
--
-- An toan: idempotent (DROP POLICY IF EXISTS), bao trong transaction,
--   dung mo hinh helper `to_jsonb(row) ->> 'col'` nen khong loi du cot branch
--   co the ten khac nhau (branchId / branchid / branch_id) hay khong ton tai.
--
-- Han che con lai (khuyen nghi follow-up, NGOAI pham vi P0):
--   - Quyen ghi cua cac bang tai chinh van con rong cho `authenticated` vi
--     hien tai client tu ghi (vd cap nhat so du). Buoc tiep theo nen chuyen
--     cac mutation so du / so cai sang RPC SECURITY DEFINER roi sieu chat ghi.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper functions (tai khai bao de file tu chua, idempotent).
-- Giong het ban da tao o 2026-04-09; OR REPLACE nen an toan chay lai.
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  WITH role_source AS (
    SELECT LOWER(
      COALESCE(
        NULLIF((
          SELECT p.role FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1
        ), ''),
        NULLIF((auth.jwt() -> 'user_metadata' ->> 'role'), ''),
        NULLIF((auth.jwt() -> 'app_metadata' ->> 'role'), ''),
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
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'branch_id'), ''),
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'branchId'), ''),
    NULLIF((auth.jwt() -> 'user_metadata' ->> 'branchid'), '')
  )
$$;

-- ============================================================
-- payroll_records  -- LUONG: chi owner (all) + manager (chi nhanh minh)
-- ============================================================
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payroll_records FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_records TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.payroll_records;
DROP POLICY IF EXISTS payroll_records_management ON public.payroll_records;

CREATE POLICY payroll_records_management
ON public.payroll_records
FOR ALL
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      NULLIF(public.current_user_branch_id(), '') IS NULL
      OR COALESCE(NULLIF(to_jsonb(payroll_records) ->> 'branch_id', ''), 'CN1')
         = public.current_user_branch_id()
    )
  )
)
WITH CHECK (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      NULLIF(public.current_user_branch_id(), '') IS NULL
      OR COALESCE(NULLIF(to_jsonb(payroll_records) ->> 'branch_id', ''), 'CN1')
         = public.current_user_branch_id()
    )
  )
);

-- ============================================================
-- cash_transactions  -- so cai tien mat/ngan hang
--   SELECT: owner/manager all; staff theo chi nhanh.
--   INSERT: moi authenticated (staff thu/chi tu phieu, ban hang).
--   UPDATE/DELETE: chi owner/manager (client khong sua/xoa truc tiep).
-- ============================================================
ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.cash_transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_transactions TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.cash_transactions;
DROP POLICY IF EXISTS cash_transactions_select ON public.cash_transactions;
DROP POLICY IF EXISTS cash_transactions_insert ON public.cash_transactions;
DROP POLICY IF EXISTS cash_transactions_update ON public.cash_transactions;
DROP POLICY IF EXISTS cash_transactions_delete ON public.cash_transactions;

CREATE POLICY cash_transactions_select
ON public.cash_transactions
FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
  OR COALESCE(
       NULLIF(to_jsonb(cash_transactions) ->> 'branchId', ''),
       NULLIF(to_jsonb(cash_transactions) ->> 'branchid', ''),
       NULLIF(to_jsonb(cash_transactions) ->> 'branch_id', ''),
       'CN1'
     ) = COALESCE(NULLIF(public.current_user_branch_id(), ''), 'CN1')
);

CREATE POLICY cash_transactions_insert
ON public.cash_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY cash_transactions_update
ON public.cash_transactions
FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'))
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY cash_transactions_delete
ON public.cash_transactions
FOR DELETE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'));

-- ============================================================
-- payment_sources  -- nguon tien + so du (JSONB theo chi nhanh)
--   Khong co cot branch (so du la JSONB per-branch) => SELECT cho authenticated.
--   UPDATE phai mo: updatePaymentSourceBalance() cap nhat so du client-side.
--   INSERT/DELETE (them/xoa nguon tien): chi owner/manager.
-- ============================================================
ALTER TABLE public.payment_sources ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.payment_sources FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_sources TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.payment_sources;
DROP POLICY IF EXISTS payment_sources_select ON public.payment_sources;
DROP POLICY IF EXISTS payment_sources_insert ON public.payment_sources;
DROP POLICY IF EXISTS payment_sources_update ON public.payment_sources;
DROP POLICY IF EXISTS payment_sources_delete ON public.payment_sources;

CREATE POLICY payment_sources_select
ON public.payment_sources
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY payment_sources_update
ON public.payment_sources
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY payment_sources_insert
ON public.payment_sources
FOR INSERT
TO authenticated
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY payment_sources_delete
ON public.payment_sources
FOR DELETE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'));

-- ============================================================
-- inventory_transactions  -- so cai nhap/xuat kho
--   SELECT: owner/manager all; staff theo chi nhanh.
--   INSERT: moi authenticated (staff ban/nhap kho).
--   UPDATE/DELETE: chi owner/manager.
-- ============================================================
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.inventory_transactions FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_transactions TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Allow all access" ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_select ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_insert ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_update ON public.inventory_transactions;
DROP POLICY IF EXISTS inventory_transactions_delete ON public.inventory_transactions;

CREATE POLICY inventory_transactions_select
ON public.inventory_transactions
FOR SELECT
TO authenticated
USING (
  public.current_user_role() IN ('owner', 'manager')
  OR COALESCE(
       NULLIF(to_jsonb(inventory_transactions) ->> 'branchId', ''),
       NULLIF(to_jsonb(inventory_transactions) ->> 'branchid', ''),
       NULLIF(to_jsonb(inventory_transactions) ->> 'branch_id', ''),
       'CN1'
     ) = COALESCE(NULLIF(public.current_user_branch_id(), ''), 'CN1')
);

CREATE POLICY inventory_transactions_insert
ON public.inventory_transactions
FOR INSERT
TO authenticated
WITH CHECK (true);

CREATE POLICY inventory_transactions_update
ON public.inventory_transactions
FOR UPDATE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'))
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

CREATE POLICY inventory_transactions_delete
ON public.inventory_transactions
FOR DELETE
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'));

-- ============================================================
-- branches  -- du lieu tham chieu chi nhanh
--   SELECT: moi authenticated (can cho selector chi nhanh).
--   INSERT/UPDATE/DELETE: chi owner/manager.
-- ============================================================
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.branches FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO authenticated, service_role;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.branches;
DROP POLICY IF EXISTS branches_select ON public.branches;
DROP POLICY IF EXISTS branches_write ON public.branches;

CREATE POLICY branches_select
ON public.branches
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY branches_write
ON public.branches
FOR ALL
TO authenticated
USING (public.current_user_role() IN ('owner', 'manager'))
WITH CHECK (public.current_user_role() IN ('owner', 'manager'));

-- ============================================================
-- services + repair_order_* + warranty_*  -- du lieu van hanh (it nhay cam)
--   Staff can doc/ghi trong luong tao phieu sua chua / bao hanh.
--   Pham vi P0: chi CHAN anon, bat buoc authenticated. Giu full access cho
--   authenticated de khong lam vo luong nghiep vu hien tai.
-- ============================================================
DO $$
DECLARE
  t TEXT;
  tbls TEXT[] := ARRAY[
    'services',
    'repair_order_services',
    'repair_order_service_workers',
    'repair_order_service_items',
    'warranty_cards',
    'warranty_claims'
  ];
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    IF to_regclass('public.' || t) IS NULL THEN
      CONTINUE; -- bang chua ton tai tren instance nay, bo qua
    END IF;

    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon;', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated, service_role;', t);

    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users" ON public.%I;', t);
    EXECUTE format('DROP POLICY IF EXISTS "Enable all access for all users on %s" ON public.%I;', t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', t || '_authenticated_all', t);

    EXECUTE format($f$
      CREATE POLICY %I ON public.%I
      FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
    $f$, t || '_authenticated_all', t);
  END LOOP;
END $$;

COMMIT;

-- ============================================================
-- VERIFY (chay tay trong Supabase SQL Editor sau khi apply)
-- ============================================================
-- 1) Khong con policy USING(true) "mo toang" tren bang nhay cam:
-- SELECT tablename, policyname, cmd, roles, qual
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('payroll_records','cash_transactions','payment_sources',
--                     'inventory_transactions','branches','services',
--                     'repair_order_services','repair_order_service_workers',
--                     'repair_order_service_items','warranty_cards','warranty_claims')
-- ORDER BY tablename, cmd, policyname;
--
-- 2) anon khong con quyen bang:
-- SELECT table_name, privilege_type
-- FROM information_schema.role_table_grants
-- WHERE grantee = 'anon' AND table_schema = 'public'
--   AND table_name IN ('payroll_records','cash_transactions','payment_sources',
--                      'inventory_transactions','branches');
-- (ket qua mong doi: rong)
