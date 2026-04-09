-- ============================================
-- Migration: Create audit_logs table
-- Motocare Pro - Audit Trail System
-- Date: 2026-04-09
-- ============================================

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,                    -- e.g. 'auth.login', 'work_order.create', 'inventory.update'
  entity_type TEXT,                        -- e.g. 'work_order', 'cash_transaction', 'part'
  entity_id TEXT,                          -- ID of the affected record
  details JSONB DEFAULT '{}',             -- Additional context (old_value, new_value, etc.)
  ip_address TEXT,                         -- Client IP (if available)
  user_agent TEXT,                         -- Browser/device info
  branch_id TEXT DEFAULT 'CN1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast queries by user and time
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_entity ON audit_logs(entity_type, entity_id);

-- RLS: Allow authenticated users to insert their own audit logs
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Any authenticated user can INSERT audit logs
CREATE POLICY "Users can insert own audit logs"
  ON audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Policy: Only owner can SELECT audit logs (for viewing audit trail)
CREATE POLICY "Owner can view all audit logs"
  ON audit_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'owner'
    )
  );

-- Auto-cleanup: delete audit logs older than 90 days (optional, run via cron)
-- SELECT cron.schedule('cleanup-audit-logs', '0 3 * * 0', $$
--   DELETE FROM audit_logs WHERE created_at < NOW() - INTERVAL '90 days';
-- $$);

COMMENT ON TABLE audit_logs IS 'Audit trail for tracking important user actions in Motocare Pro';
