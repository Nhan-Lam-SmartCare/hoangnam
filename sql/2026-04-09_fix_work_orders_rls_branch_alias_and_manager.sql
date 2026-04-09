-- ============================================================
-- Fix work_orders RLS for branch alias + manager role
-- Date: 2026-04-09
-- Reason:
-- 1) Existing policy checks only branchId/branchid, but many schemas use branch_id.
-- 2) Existing policy allows only owner/staff, while app has owner/manager/staff.
-- ============================================================

BEGIN;

ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;

-- Resolve role with fallback from profiles and JWT metadata.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
AS $$
  WITH role_source AS (
    SELECT LOWER(
      COALESCE(
        NULLIF((
          SELECT p.role
          FROM public.profiles p
          WHERE p.id = auth.uid()
          LIMIT 1
        ), ''),
        NULLIF((auth.jwt() -> 'user_metadata' ->> 'role'), ''),
        NULLIF((auth.jwt() -> 'app_metadata' ->> 'role'), ''),
        'staff'
      )
    ) AS role_raw
  )
  SELECT CASE
    WHEN role_raw IN ('owner', 'manager', 'staff') THEN role_raw
    WHEN role_raw IN (
      'employee',
      'nhanvien',
      'nhan_vien',
      'nhan-vien',
      'technician',
      'tech',
      'sales',
      'sale'
    ) THEN 'staff'
    ELSE 'staff'
  END
  FROM role_source
$$;

-- Resolve current user's branch from profiles (all naming styles) then JWT fallback.
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

-- Replace legacy policies.
DROP POLICY IF EXISTS "Enable all access for all users" ON public.work_orders;
DROP POLICY IF EXISTS "Allow all access" ON public.work_orders;
DROP POLICY IF EXISTS work_orders_select_owner_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_insert_owner_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_update_owner_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_delete_owner_staff ON public.work_orders;

DROP POLICY IF EXISTS work_orders_select_owner_manager_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_insert_owner_manager_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_update_owner_manager_staff ON public.work_orders;
DROP POLICY IF EXISTS work_orders_delete_owner_manager_staff ON public.work_orders;

-- SELECT:
-- owner: all rows
-- manager: rows in own branch
-- staff: own-created rows OR rows in own branch
CREATE POLICY work_orders_select_owner_manager_staff
ON public.work_orders
FOR SELECT
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
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
          NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
          NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
        ) = public.current_user_branch_id()
      )
    )
  )
);

-- INSERT:
-- owner/manager: create rows (manager constrained to own branch)
-- staff: creator must be self when present; if schema has no creator column,
-- allow insert by branch scope to avoid hard-lock on legacy tables.
CREATE POLICY work_orders_insert_owner_manager_staff
ON public.work_orders
FOR INSERT
TO authenticated
WITH CHECK (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
  OR (
    public.current_user_role() = 'staff'
    AND (
      COALESCE(
        to_jsonb(work_orders) ->> 'created_by',
        to_jsonb(work_orders) ->> 'createdBy',
        to_jsonb(work_orders) ->> 'createdby',
        ''
      ) = ''
      OR COALESCE(
        to_jsonb(work_orders) ->> 'created_by',
        to_jsonb(work_orders) ->> 'createdBy',
        to_jsonb(work_orders) ->> 'createdby',
        ''
      ) = auth.uid()::text
    )
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
);

-- UPDATE:
-- owner: any row
-- manager: only rows in own branch
-- staff: only own-created row and branch-constrained when branch exists
CREATE POLICY work_orders_update_owner_manager_staff
ON public.work_orders
FOR UPDATE
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
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
    public.current_user_role() = 'manager'
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
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
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
);

-- DELETE:
-- owner: any row
-- manager: rows in own branch
-- staff: own-created rows only
CREATE POLICY work_orders_delete_owner_manager_staff
ON public.work_orders
FOR DELETE
TO authenticated
USING (
  public.current_user_role() = 'owner'
  OR (
    public.current_user_role() = 'manager'
    AND (
      public.current_user_branch_id() IS NULL
      OR public.current_user_branch_id() = ''
      OR COALESCE(
        NULLIF(to_jsonb(work_orders) ->> 'branchId', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branchid', ''),
        NULLIF(to_jsonb(work_orders) ->> 'branch_id', '')
      ) = public.current_user_branch_id()
    )
  )
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
