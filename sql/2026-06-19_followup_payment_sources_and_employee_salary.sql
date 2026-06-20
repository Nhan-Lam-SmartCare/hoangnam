-- ============================================================
-- 2026-06-19_followup_payment_sources_and_employee_salary.sql
--
-- Muc tieu (P1 - dut diem no ky thuat RLS da ghi trong CLAUDE.md):
--   A) payment_sources: SIET quyen UPDATE ve owran-only.
--      - Hien client cap nhat so du CHI qua RPC adjust_payment_source_balance_atomic
--        (SECURITY DEFINER) => khong can quyen UPDATE truc tiep cho staff/manager.
--      - File 2026-06-16_tighten_rls_sensitive_tables.sql da vo tinh mo lai
--        payment_sources_update = USING(true) (de lai do client tung tu ghi).
--        Gio quay ve owner-only de chong ghi so du tu client.
--
--   B) employees: AN cot luong (base_salary, allowances, bank_*, tax_code) khoi staff.
--      - RLS la ROW-level, KHONG an duoc COT => SELECT * van lo luong.
--      - Giai phap: KHOA bang goc `employees` chi cho owner/manager (doc+ghi),
--        va tao VIEW `employees_directory` (chi cot khong nhay cam) cho moi
--        authenticated dung lam danh sach chon tho trong phieu sua chua.
--
-- An toan / khong vo app:
--   - RPC so du da SECURITY DEFINER => van chay khi sieu chat UPDATE.
--   - Cac man hinh doc luong (Settings/Payroll/Employees) deu gate owner/manager
--     o route => khoa bang goc ve owner/manager KHONG anh huong.
--   - Worker dropdown trong phieu sua chua chuyen sang doc view (id, name, status,
--     position, department, branch) — khong can luong.
--   - Idempotent: CREATE OR REPLACE VIEW, DROP POLICY IF EXISTS, trong transaction.
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- A) payment_sources: UPDATE ve owner-only (client dung RPC cho so du).
-- ------------------------------------------------------------
DROP POLICY IF EXISTS payment_sources_update ON public.payment_sources;

CREATE POLICY payment_sources_update
ON public.payment_sources
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

-- Dam bao staff/manager van goi duoc RPC so du (SECURITY DEFINER).
GRANT EXECUTE ON FUNCTION public.adjust_payment_source_balance_atomic(TEXT, TEXT, NUMERIC)
  TO authenticated, service_role;

-- ------------------------------------------------------------
-- B) employees: khoa bang goc ve owner/manager (an cot luong khoi staff).
--    (Ghi de policy employees_select da tao o file P0 cung ngay.)
-- ------------------------------------------------------------
DROP POLICY IF EXISTS employees_select ON public.employees;

CREATE POLICY employees_select
ON public.employees
FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      NULLIF(public.current_user_branch_id(), '') IS NULL
      OR COALESCE(
           NULLIF(to_jsonb(employees) ->> 'branchId', ''),
           NULLIF(to_jsonb(employees) ->> 'branchid', ''),
           NULLIF(to_jsonb(employees) ->> 'branch_id', ''),
           'CN1'
         ) = public.current_user_branch_id()
    )
  )
);

-- ------------------------------------------------------------
-- VIEW danh ba nhan vien (KHONG co cot luong) cho worker dropdown.
-- security_invoker = false (mac dinh): view chay voi quyen owner view => doc
-- duoc bang goc du staff khong co quyen SELECT truc tiep. View CHI lo cot an toan.
-- Branch-scope: owner/manager xem het, staff chi xem nhan vien cung chi nhanh.
-- ------------------------------------------------------------
CREATE OR REPLACE VIEW public.employees_directory
WITH (security_invoker = false)
AS
SELECT
  e.id,
  e.name,
  e.phone,
  e.email,
  e.position,
  e.department,
  e.status,
  COALESCE(
    NULLIF(to_jsonb(e) ->> 'branchId', ''),
    NULLIF(to_jsonb(e) ->> 'branchid', ''),
    NULLIF(to_jsonb(e) ->> 'branch_id', '')
  ) AS branch_id,
  e.created_at,
  e.updated_at
FROM public.employees e
WHERE
  public.current_user_role() IN ('owner', 'manager')
  OR NULLIF(public.current_user_branch_id(), '') IS NULL
  OR COALESCE(
       NULLIF(to_jsonb(e) ->> 'branchId', ''),
       NULLIF(to_jsonb(e) ->> 'branchid', ''),
       NULLIF(to_jsonb(e) ->> 'branch_id', ''),
       'CN1'
     ) = public.current_user_branch_id();

REVOKE ALL ON public.employees_directory FROM anon;
GRANT SELECT ON public.employees_directory TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (chay tay trong Supabase SQL Editor)
-- ============================================================
-- 1) payment_sources UPDATE chi con owner:
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename='payment_sources' AND cmd='UPDATE';
--
-- 2) Dang nhap = staff:
--    SELECT base_salary FROM public.employees LIMIT 1;   => 0 rows (bi RLS chan)
--    SELECT * FROM public.employees_directory;           => co du lieu, KHONG co cot luong
--
-- 3) Dang nhap = staff thu ghi so du truc tiep (phai bi tu choi):
--    UPDATE public.payment_sources SET balance='{}'::jsonb WHERE id='cash';  => 0 rows
--    -- nhung goi RPC van duoc:
--    SELECT public.adjust_payment_source_balance_atomic('cash','CN1',0);     => OK
