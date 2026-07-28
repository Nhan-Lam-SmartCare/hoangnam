-- ============================================================
-- 2026-07-28_pawn_payments_ledger.sql
-- Sổ cái giao dịch cầm đồ: đóng lãi / trả bớt gốc / chuộc / thanh lý.
--
-- Nội dung:
--   1) Mở rộng public.pawn_records (gốc còn lại, đã đóng lãi tới ngày, totals)
--   2) Tạo public.pawn_payments (ledger, chỉ thêm - không sửa)
--   3) RLS cho pawn_payments theo đúng quy ước CLAUDE.md
--   4) Thêm cash_transactions.pawn_id để truy vết ngược
--   5) Backfill dữ liệu cũ
--
-- Idempotent - chạy lại nhiều lần an toàn.
-- Apply: node scripts/setup/apply-sql.mjs sql/2026-07-28_pawn_payments_ledger.sql
--        (nếu môi trường không có exec_sql RPC -> dán vào Supabase SQL Editor)
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- 1) Mở rộng pawn_records
-- ------------------------------------------------------------
ALTER TABLE public.pawn_records
  ADD COLUMN IF NOT EXISTS principal_outstanding   NUMERIC,
  ADD COLUMN IF NOT EXISTS interest_paid_until     TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_interest_paid     NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_principal_paid    NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_payment_date       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS renew_count             INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS disbursement_cash_tx_id TEXT,
  ADD COLUMN IF NOT EXISTS closed_at               TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS closed_by               TEXT;

COMMENT ON COLUMN public.pawn_records.principal_outstanding IS 'Gốc còn lại (cho phép trả bớt gốc); khởi tạo = loan_amount';
COMMENT ON COLUMN public.pawn_records.interest_paid_until   IS 'Khách đã đóng lãi tới ngày này; mốc tính lãi kỳ kế tiếp';

-- ------------------------------------------------------------
-- 2) Bảng sổ cái pawn_payments
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.pawn_payments (
  id                  TEXT PRIMARY KEY,
  pawn_id             TEXT NOT NULL REFERENCES public.pawn_records(id) ON DELETE CASCADE,
  -- disbursement | interest | principal | redeem | additional_loan | liquidation
  kind                TEXT NOT NULL,
  payment_date        TIMESTAMPTZ NOT NULL DEFAULT now(),
  interest_amount     NUMERIC DEFAULT 0,   -- phần LÃI  -> doanh thu
  principal_amount    NUMERIC DEFAULT 0,   -- phần GỐC  -> thu hồi vốn, KHÔNG phải doanh thu
  amount              NUMERIC NOT NULL DEFAULT 0, -- tổng tiền thực vào/ra quỹ
  period_from         TIMESTAMPTZ,
  period_to           TIMESTAMPTZ,         -- đóng lãi tới ngày này
  days                INTEGER,
  principal_before    NUMERIC,             -- snapshot để huỷ phiếu / audit
  principal_after     NUMERIC,
  interest_paid_until_before TIMESTAMPTZ,  -- snapshot để huỷ phiếu
  end_date_before     TIMESTAMPTZ,
  new_end_date        TIMESTAMPTZ,
  payment_source_id   TEXT,
  cash_transaction_id TEXT,
  is_voided           BOOLEAN NOT NULL DEFAULT FALSE,
  voided_at           TIMESTAMPTZ,
  voided_by           TEXT,
  notes               TEXT,
  created_by          TEXT,
  created_by_name     TEXT,
  branch_id           TEXT DEFAULT 'CN1',
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Cột thêm sau (an toàn khi bảng đã tồn tại từ lần chạy trước)
ALTER TABLE public.pawn_payments
  ADD COLUMN IF NOT EXISTS interest_paid_until_before TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS end_date_before            TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_at                  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by                  TEXT,
  ADD COLUMN IF NOT EXISTS created_by_name            TEXT;

CREATE INDEX IF NOT EXISTS idx_pawn_payments_pawn
  ON public.pawn_payments (pawn_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_pawn_payments_branch_date
  ON public.pawn_payments (branch_id, payment_date DESC);

-- ------------------------------------------------------------
-- 3) RLS cho pawn_payments
--    Đọc: owner xem tất cả; manager/staff giới hạn theo chi nhánh.
--    Ghi: chỉ qua RPC SECURITY DEFINER -> không cấp INSERT/UPDATE cho client.
-- ------------------------------------------------------------
ALTER TABLE public.pawn_payments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.pawn_payments FROM anon;
REVOKE ALL ON public.pawn_payments FROM authenticated;
GRANT SELECT ON public.pawn_payments TO authenticated;
GRANT ALL    ON public.pawn_payments TO service_role;

DROP POLICY IF EXISTS pawn_payments_select ON public.pawn_payments;
CREATE POLICY pawn_payments_select ON public.pawn_payments
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'owner'
    OR COALESCE(branch_id, 'CN1') = COALESCE(public.current_user_branch_id(), 'CN1')
  );

-- Không tạo policy INSERT/UPDATE/DELETE: mọi thay đổi đi qua RPC SECURITY DEFINER
-- (pawn_record_payment / pawn_record_disbursement / pawn_void_payment).
DROP POLICY IF EXISTS pawn_payments_insert ON public.pawn_payments;
DROP POLICY IF EXISTS pawn_payments_update ON public.pawn_payments;
DROP POLICY IF EXISTS pawn_payments_delete ON public.pawn_payments;

-- ------------------------------------------------------------
-- 4) Truy vết ngược từ sổ quỹ về hợp đồng cầm đồ
-- ------------------------------------------------------------
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS pawn_id TEXT;

CREATE INDEX IF NOT EXISTS idx_cash_transactions_pawn
  ON public.cash_transactions (pawn_id);

-- ------------------------------------------------------------
-- 5) Backfill dữ liệu cũ
-- ------------------------------------------------------------
UPDATE public.pawn_records
   SET principal_outstanding = COALESCE(principal_outstanding, loan_amount, 0),
       interest_paid_until   = COALESCE(interest_paid_until, start_date, created_at, now()),
       total_interest_paid   = COALESCE(total_interest_paid, 0),
       total_principal_paid  = COALESCE(total_principal_paid, 0),
       renew_count           = COALESCE(renew_count, 0)
 WHERE principal_outstanding IS NULL
    OR interest_paid_until IS NULL
    OR total_interest_paid IS NULL
    OR total_principal_paid IS NULL
    OR renew_count IS NULL;

COMMIT;

-- Kiểm tra nhanh:
--   SELECT id, loan_amount, principal_outstanding, interest_paid_until FROM public.pawn_records LIMIT 5;
--   SELECT * FROM public.pawn_payments LIMIT 5;
