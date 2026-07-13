-- ============================================================================
-- CHỐT CA / ĐỐI SOÁT QUỸ — bảng cash_sessions
-- Date: 2026-07-13
-- ============================================================================
--
-- Mở ca: chụp số dư các nguồn tiền tại thời điểm mở (opening_balance).
-- Đóng ca: nhập tiền ĐẾM thực tế (counted) + số dư KỲ VỌNG hiện tại (expected =
--          số dư nguồn tiền đang có trên hệ thống). Chênh lệch = counted - expected.
-- opening_balance/expected/counted đều là jsonb { "<source>": <amount> } theo nguồn.
--
-- Ghi qua repository (RLS branch-scoped cho authenticated) — không cần RPC vì đây
-- là bản ghi đối soát, không đụng số dư/kho.
--
-- ⚠️ exec_sql RPC KHÔNG tồn tại -> APPLY qua Supabase SQL Editor.

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_sessions (
  id              text PRIMARY KEY,
  branch_id       text,
  status          text NOT NULL DEFAULT 'open',   -- 'open' | 'closed'
  opened_by       text,
  opened_by_name  text,
  opened_at       timestamptz NOT NULL DEFAULT now(),
  opening_balance jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_by       text,
  closed_by_name  text,
  closed_at       timestamptz,
  counted         jsonb NOT NULL DEFAULT '{}'::jsonb,
  expected        jsonb NOT NULL DEFAULT '{}'::jsonb,
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_cash_sessions_branch_status
  ON public.cash_sessions (branch_id, status);

ALTER TABLE public.cash_sessions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.cash_sessions FROM anon;

-- Đọc: owner tất cả; còn lại theo chi nhánh.
DROP POLICY IF EXISTS cash_sessions_select ON public.cash_sessions;
CREATE POLICY cash_sessions_select ON public.cash_sessions
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
    OR branch_id IS NULL
  );

-- Tạo ca: chỉ cho đúng chi nhánh của người dùng (owner mọi chi nhánh).
DROP POLICY IF EXISTS cash_sessions_insert ON public.cash_sessions;
CREATE POLICY cash_sessions_insert ON public.cash_sessions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  );

-- Đóng/cập nhật ca: cùng phạm vi chi nhánh.
DROP POLICY IF EXISTS cash_sessions_update ON public.cash_sessions;
CREATE POLICY cash_sessions_update ON public.cash_sessions
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  )
  WITH CHECK (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  );

COMMIT;
