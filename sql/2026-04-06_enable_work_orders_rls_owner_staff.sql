-- ============================================================
-- Enable RLS for work_orders with owner/staff role rules
-- Date: 2026-04-06
-- ============================================================

BEGIN;

-- Ensure table has RLS enabled.
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- Helper: current authenticated role from profiles.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT LOWER(COALESCE(p.role, ''))
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- Helper: branch id from profiles across possible naming styles.
CREATE OR REPLACE FUNCTION public.current_user_branch_id()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(
    NULLIF(to_jsonb(p) ->> 'branch_id', ''),
    NULLIF(to_jsonb(p) ->> 'branchId', ''),
    NULLIF(to_jsonb(p) ->> 'branchid', '')
  )
  FROM public.profiles p
  WHERE p.id = auth.uid()
  LIMIT 1
$$;

-- Drop legacy permissive policies if present.
DROP POLICY IF EXISTS "Enable all access for all users" ON public.work_orders;
DROP POLICY IF EXISTS "Allow all access" ON public.work_orders;

-- Drop current work_orders policies (idempotent migration).
DROP POLICY IF EXISTS work_orders_select_owner_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_insert_owner_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_update_owner_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_delete_owner_staff ON public.work_orders;

-- Read:
-- owner: see all orders
-- staff: see own-created orders OR orders in own branch
CREATE POLICY work_orders_select_owner_staff
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'staff'
    AND (
      COALESCE(
        to_jsonb(work_orders) ->> 'created_by',
        to_jsonb(work_orders) ->> 'createdBy',
        to_jsonb(work_orders) ->> 'createdby',
        ''
      ) = auth.uid()::text
      OR (
        public.current_user_branch_id() IS NOT NULL
        AND public.current_user_branch_id() <> ''
        AND COALESCE(
          NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
          NULLIF(to_jsonb(work_orders) ->> 'branchid', '')
        ) = public.current_user_branch_id()
      )
    )
  )
);

-- Insert:
-- owner: create for any branch
-- staff: must set creator to self and branch must match own branch (when branch present)
CREATE POLICY work_orders_insert_owner_staff
ON public.work_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'staff'
    AND COALESCE(
      to_jsonb(work_orders) ->> 'created_by',
      to_jsonb(work_orders) ->> 'createdBy',
      to_jsonb(work_orders) ->> 'createdby',
      ''
    ) = auth.uid()::text
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', '')
      ) = public.current_user_branch_id()
    )
  )
);

-- Update:
-- owner: update any order
-- staff: update only orders created by self
CREATE POLICY work_orders_update_owner_staff
ON public.work_orders
FOR UPDATE
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'staff'
    AND COALESCE(
      to_jsonb(work_orders) ->> 'created_by',
      to_jsonb(work_orders) ->> 'createdBy',
      to_jsonb(work_orders) ->> 'createdby',
      ''
    ) = auth.uid()::text
  )
)
WITH CHECK (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'staff'
    AND COALESCE(
      to_jsonb(work_orders) ->> 'created_by',
      to_jsonb(work_orders) ->> 'createdBy',
      to_jsonb(work_orders) ->> 'createdby',
      ''
    ) = auth.uid()::text
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', '')
      ) = public.current_user_branch_id()
    )
  )
);

-- Delete:
-- owner: delete any order
-- staff: delete only orders created by self
CREATE POLICY work_orders_delete_owner_staff
ON public.work_orders
FOR DELETE
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'staff'
    AND COALESCE(
      to_jsonb(work_orders) ->> 'created_by',
      to_jsonb(work_orders) ->> 'createdBy',
      to_jsonb(work_orders) ->> 'createdby',
      ''
    ) = auth.uid()::text
  )
);

COMMIT;
