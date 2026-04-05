-- ============================================================
-- 2026-04-05_add_branches_and_payroll_records.sql
-- Muc tieu:
-- 1) Chuan hoa 2 bang public.branches va public.payroll_records
-- 2) Idempotent: an toan khi chay nhieu lan
-- 3) Khoi phuc nhanh cac endpoint PostgREST dang 404
-- ============================================================

BEGIN;

-- ============================================================
-- PHAN 1: branches
-- ============================================================

CREATE TABLE IF NOT EXISTS public.branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Bao dam du lieu cot name khong null
UPDATE public.branches
SET name = COALESCE(NULLIF(TRIM(name), ''), id, 'Unknown Branch')
WHERE name IS NULL OR TRIM(name) = '';

ALTER TABLE public.branches
  ALTER COLUMN name SET NOT NULL;

INSERT INTO public.branches (id, name)
VALUES ('CN1', 'Chi nhanh 1')
ON CONFLICT (id) DO UPDATE
SET name = COALESCE(NULLIF(EXCLUDED.name, ''), public.branches.name);

CREATE INDEX IF NOT EXISTS idx_branches_name ON public.branches(name);

ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.branches;
CREATE POLICY "Enable all access for all users"
  ON public.branches
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.branches TO anon, authenticated, service_role;

-- ============================================================
-- PHAN 2: payroll_records
-- ============================================================

CREATE TABLE IF NOT EXISTS public.payroll_records (
  id TEXT PRIMARY KEY,
  employee_id UUID NOT NULL,
  employee_name TEXT NOT NULL,
  month TEXT NOT NULL,
  base_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  allowances NUMERIC(12,2) NOT NULL DEFAULT 0,
  bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
  deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
  work_days NUMERIC(5,2) NOT NULL DEFAULT 26,
  standard_work_days NUMERIC(5,2) NOT NULL DEFAULT 26,
  social_insurance NUMERIC(12,2) NOT NULL DEFAULT 0,
  health_insurance NUMERIC(12,2) NOT NULL DEFAULT 0,
  unemployment_insurance NUMERIC(12,2) NOT NULL DEFAULT 0,
  personal_income_tax NUMERIC(12,2) NOT NULL DEFAULT 0,
  net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  payment_date TIMESTAMPTZ,
  payment_method TEXT,
  notes TEXT,
  branch_id TEXT NOT NULL DEFAULT 'CN1',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS employee_id UUID,
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS month TEXT,
  ADD COLUMN IF NOT EXISTS base_salary NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS allowances NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS bonus NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deduction NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS work_days NUMERIC(5,2) DEFAULT 26,
  ADD COLUMN IF NOT EXISTS standard_work_days NUMERIC(5,2) DEFAULT 26,
  ADD COLUMN IF NOT EXISTS social_insurance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS health_insurance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unemployment_insurance NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS personal_income_tax NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS net_salary NUMERIC(12,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS payment_method TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'CN1',
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

-- Dat default + NOT NULL cho cac cot can thiet de on dinh ghi du lieu
UPDATE public.payroll_records
SET
  employee_name = COALESCE(NULLIF(TRIM(employee_name), ''), 'Unknown Employee'),
  month = COALESCE(NULLIF(TRIM(month), ''), to_char(current_date, 'YYYY-MM')),
  base_salary = COALESCE(base_salary, 0),
  allowances = COALESCE(allowances, 0),
  bonus = COALESCE(bonus, 0),
  deduction = COALESCE(deduction, 0),
  work_days = COALESCE(work_days, 26),
  standard_work_days = COALESCE(standard_work_days, 26),
  social_insurance = COALESCE(social_insurance, 0),
  health_insurance = COALESCE(health_insurance, 0),
  unemployment_insurance = COALESCE(unemployment_insurance, 0),
  personal_income_tax = COALESCE(personal_income_tax, 0),
  net_salary = COALESCE(net_salary, 0),
  payment_status = COALESCE(NULLIF(TRIM(payment_status), ''), 'pending'),
  branch_id = COALESCE(NULLIF(TRIM(branch_id), ''), 'CN1'),
  created_at = COALESCE(created_at, now());

ALTER TABLE public.payroll_records
  ALTER COLUMN employee_name SET NOT NULL,
  ALTER COLUMN month SET NOT NULL,
  ALTER COLUMN base_salary SET NOT NULL,
  ALTER COLUMN allowances SET NOT NULL,
  ALTER COLUMN bonus SET NOT NULL,
  ALTER COLUMN deduction SET NOT NULL,
  ALTER COLUMN work_days SET NOT NULL,
  ALTER COLUMN standard_work_days SET NOT NULL,
  ALTER COLUMN social_insurance SET NOT NULL,
  ALTER COLUMN health_insurance SET NOT NULL,
  ALTER COLUMN unemployment_insurance SET NOT NULL,
  ALTER COLUMN personal_income_tax SET NOT NULL,
  ALTER COLUMN net_salary SET NOT NULL,
  ALTER COLUMN payment_status SET NOT NULL,
  ALTER COLUMN branch_id SET NOT NULL,
  ALTER COLUMN created_at SET NOT NULL;

ALTER TABLE public.payroll_records
  ALTER COLUMN base_salary SET DEFAULT 0,
  ALTER COLUMN allowances SET DEFAULT 0,
  ALTER COLUMN bonus SET DEFAULT 0,
  ALTER COLUMN deduction SET DEFAULT 0,
  ALTER COLUMN work_days SET DEFAULT 26,
  ALTER COLUMN standard_work_days SET DEFAULT 26,
  ALTER COLUMN social_insurance SET DEFAULT 0,
  ALTER COLUMN health_insurance SET DEFAULT 0,
  ALTER COLUMN unemployment_insurance SET DEFAULT 0,
  ALTER COLUMN personal_income_tax SET DEFAULT 0,
  ALTER COLUMN net_salary SET DEFAULT 0,
  ALTER COLUMN payment_status SET DEFAULT 'pending',
  ALTER COLUMN branch_id SET DEFAULT 'CN1',
  ALTER COLUMN created_at SET DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_payroll_records_employee_id ON public.payroll_records(employee_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_month ON public.payroll_records(month);
CREATE INDEX IF NOT EXISTS idx_payroll_records_branch_id ON public.payroll_records(branch_id);

ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.payroll_records;
CREATE POLICY "Enable all access for all users"
  ON public.payroll_records
  FOR ALL
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_records TO anon, authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY NHANH (copy tung block trong Supabase SQL Editor)
-- ============================================================
-- 1) Bang co ton tai chua?
-- SELECT to_regclass('public.branches') AS branches_table,
--        to_regclass('public.payroll_records') AS payroll_table;
--
-- 2) Test read endpoint chinh:
-- SELECT id, name FROM public.branches ORDER BY name;
-- SELECT id, employee_name, month, net_salary, branch_id
-- FROM public.payroll_records
-- ORDER BY created_at DESC
-- LIMIT 10;
--
-- 3) Kiem tra policy RLS:
-- SELECT tablename, policyname, permissive, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('branches', 'payroll_records')
-- ORDER BY tablename, policyname;
