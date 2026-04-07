-- ============================================
-- Add missing sales table + branch-aware RLS
-- Date: 2026-04-05
-- ============================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sales (
  id TEXT PRIMARY KEY,
  date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC NOT NULL DEFAULT 0,
  discount NUMERIC NOT NULL DEFAULT 0,
  total NUMERIC NOT NULL DEFAULT 0,
  customer JSONB,
  paymentMethod TEXT,
  userId TEXT,
  branchid TEXT DEFAULT 'CN1',
  "branchId" TEXT,
  branch_id TEXT,
  refunded BOOLEAN NOT NULL DEFAULT FALSE,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Keep all branch column variants in sync for legacy/new code paths
UPDATE public.sales
SET
  branchid = COALESCE(NULLIF(branchid, ''), NULLIF("branchId", ''), NULLIF(branch_id, ''), 'CN1'),
  "branchId" = COALESCE(NULLIF("branchId", ''), NULLIF(branchid, ''), NULLIF(branch_id, ''), 'CN1'),
  branch_id = COALESCE(NULLIF(branch_id, ''), NULLIF(branchid, ''), NULLIF("branchId", ''), 'CN1')
WHERE TRUE;

CREATE OR REPLACE FUNCTION public.sync_sales_branch_columns()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  resolved_branch TEXT;
BEGIN
  resolved_branch := COALESCE(NULLIF(NEW."branchId", ''), NULLIF(NEW.branchid, ''), NULLIF(NEW.branch_id, ''), 'CN1');
  NEW.branchid := resolved_branch;
  NEW."branchId" := resolved_branch;
  NEW.branch_id := resolved_branch;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_sales_branch_columns ON public.sales;
CREATE TRIGGER trg_sync_sales_branch_columns
BEFORE INSERT OR UPDATE ON public.sales
FOR EACH ROW
EXECUTE FUNCTION public.sync_sales_branch_columns();

CREATE OR REPLACE FUNCTION public.mc_current_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.mc_current_branch()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(NULLIF(p.branch_id, ''), 'CN1')
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1;
$$;

ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS sales_select_branch ON public.sales;
DROP POLICY IF EXISTS sales_insert_branch ON public.sales;
DROP POLICY IF EXISTS sales_update_branch ON public.sales;
DROP POLICY IF EXISTS sales_delete_manager_owner ON public.sales;

CREATE POLICY sales_select_branch
ON public.sales
FOR SELECT
TO authenticated
USING (
  COALESCE(public.mc_current_role(), 'staff') IN ('owner', 'manager')
  OR COALESCE(NULLIF("branchId", ''), NULLIF(branchid, ''), NULLIF(branch_id, ''), 'CN1') = COALESCE(public.mc_current_branch(), 'CN1')
);

CREATE POLICY sales_insert_branch
ON public.sales
FOR INSERT
TO authenticated
WITH CHECK (
  COALESCE(public.mc_current_role(), 'staff') IN ('owner', 'manager')
  OR COALESCE(NULLIF("branchId", ''), NULLIF(branchid, ''), NULLIF(branch_id, ''), 'CN1') = COALESCE(public.mc_current_branch(), 'CN1')
);

CREATE POLICY sales_update_branch
ON public.sales
FOR UPDATE
TO authenticated
USING (
  COALESCE(public.mc_current_role(), 'staff') IN ('owner', 'manager')
  OR COALESCE(NULLIF("branchId", ''), NULLIF(branchid, ''), NULLIF(branch_id, ''), 'CN1') = COALESCE(public.mc_current_branch(), 'CN1')
)
WITH CHECK (
  COALESCE(public.mc_current_role(), 'staff') IN ('owner', 'manager')
  OR COALESCE(NULLIF("branchId", ''), NULLIF(branchid, ''), NULLIF(branch_id, ''), 'CN1') = COALESCE(public.mc_current_branch(), 'CN1')
);

CREATE POLICY sales_delete_manager_owner
ON public.sales
FOR DELETE
TO authenticated
USING (
  COALESCE(public.mc_current_role(), 'staff') IN ('owner', 'manager')
);

CREATE INDEX IF NOT EXISTS idx_sales_branchid_date ON public.sales (branchid, date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branchId_date ON public.sales ("branchId", date DESC);
CREATE INDEX IF NOT EXISTS idx_sales_branch_id_date ON public.sales (branch_id, date DESC);

COMMIT;
