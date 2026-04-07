-- ============================================================
-- FIX CASH BOOK WRITE FAILURES (cash_transactions / payment_sources)
-- Muc tieu:
-- 1) Tao bang neu chua co
-- 2) Dam bao cot can thiet ton tai
-- 3) Bat RLS + policy cho phep ghi doc (demo/internal app)
-- 4) Seed nguon tien mac dinh: cash, bank
-- ============================================================

-- 1) payment_sources
CREATE TABLE IF NOT EXISTS public.payment_sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  balance JSONB DEFAULT '{}'::jsonb,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payment_sources
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS balance JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS is_default BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.payment_sources ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.payment_sources;
CREATE POLICY "Enable all access for all users"
  ON public.payment_sources
  FOR ALL
  USING (true)
  WITH CHECK (true);

INSERT INTO public.payment_sources (id, name, type, balance, is_default)
VALUES
  ('cash', 'Tien mat', 'cash', '{}'::jsonb, true),
  ('bank', 'Chuyen khoan', 'bank', '{}'::jsonb, false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  type = COALESCE(public.payment_sources.type, EXCLUDED.type),
  balance = COALESCE(public.payment_sources.balance, '{}'::jsonb);

-- 2) cash_transactions
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  amount NUMERIC NOT NULL DEFAULT 0,
  date TIMESTAMPTZ DEFAULT now(),
  category TEXT,
  description TEXT,
  notes TEXT,
  recipient TEXT,
  branchid TEXT,
  "branchId" TEXT,
  paymentsource TEXT,
  "paymentSource" TEXT,
  "paymentSourceId" TEXT,
  saleid TEXT,
  "saleId" TEXT,
  workorderid TEXT,
  "workOrderId" TEXT,
  supplierid TEXT,
  "supplierId" TEXT,
  customerid TEXT,
  "customerId" TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS type TEXT,
  ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS date TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS category TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS recipient TEXT,
  ADD COLUMN IF NOT EXISTS branchid TEXT,
  ADD COLUMN IF NOT EXISTS "branchId" TEXT,
  ADD COLUMN IF NOT EXISTS paymentsource TEXT,
  ADD COLUMN IF NOT EXISTS "paymentSource" TEXT,
  ADD COLUMN IF NOT EXISTS "paymentSourceId" TEXT,
  ADD COLUMN IF NOT EXISTS saleid TEXT,
  ADD COLUMN IF NOT EXISTS "saleId" TEXT,
  ADD COLUMN IF NOT EXISTS workorderid TEXT,
  ADD COLUMN IF NOT EXISTS "workOrderId" TEXT,
  ADD COLUMN IF NOT EXISTS supplierid TEXT,
  ADD COLUMN IF NOT EXISTS "supplierId" TEXT,
  ADD COLUMN IF NOT EXISTS customerid TEXT,
  ADD COLUMN IF NOT EXISTS "customerId" TEXT,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.cash_transactions;
CREATE POLICY "Enable all access for all users"
  ON public.cash_transactions
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- 3) cash_transactions_ledger view (optional read view used by app)
DROP VIEW IF EXISTS public.cash_transactions_ledger;

CREATE VIEW public.cash_transactions_ledger AS
SELECT
  id,
  COALESCE(type, 'expense') AS type,
  COALESCE(amount, 0) AS amount,
  COALESCE(date, created_at, now()) AS date,
  COALESCE(category, 'general_expense') AS category,
  COALESCE(notes, description, '') AS notes,
  recipient,
  COALESCE(branchid, "branchId") AS branchid,
  COALESCE(paymentsource, "paymentSource", "paymentSourceId", 'cash') AS paymentsource,
  COALESCE(saleid, "saleId") AS saleid,
  COALESCE(workorderid, "workOrderId") AS workorderid,
  COALESCE(supplierid, "supplierId") AS supplierid,
  COALESCE(customerid, "customerId") AS customerid,
  created_at
FROM public.cash_transactions;

GRANT SELECT ON public.cash_transactions TO anon, authenticated, service_role;
GRANT SELECT ON public.payment_sources TO anon, authenticated, service_role;
GRANT SELECT ON public.cash_transactions_ledger TO anon, authenticated, service_role;

-- Quick checks
-- SELECT id, name, type FROM public.payment_sources ORDER BY id;
-- SELECT id, type, amount, date, category, branchid, paymentsource FROM public.cash_transactions ORDER BY date DESC LIMIT 20;
