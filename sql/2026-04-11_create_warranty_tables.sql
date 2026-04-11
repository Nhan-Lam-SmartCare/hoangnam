-- Create warranty tables and helper function used by WarrantyManager
-- Safe to run multiple times.

BEGIN;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.warranty_cards (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  customer_id TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  device_model TEXT NOT NULL,
  imei_serial TEXT,
  warranty_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  warranty_end_date DATE NOT NULL,
  warranty_period_months INTEGER NOT NULL DEFAULT 3,
  warranty_type TEXT NOT NULL DEFAULT 'standard',
  covered_parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  coverage_terms TEXT,
  work_order_id TEXT,
  issued_by TEXT,
  branch_id TEXT DEFAULT 'CN1',
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.warranty_claims (
  id TEXT PRIMARY KEY DEFAULT uuid_generate_v4()::text,
  warranty_card_id TEXT NOT NULL,
  work_order_id TEXT,
  claim_date DATE NOT NULL DEFAULT CURRENT_DATE,
  issue_description TEXT,
  is_covered BOOLEAN NOT NULL DEFAULT true,
  denial_reason TEXT,
  parts_replaced JSONB NOT NULL DEFAULT '[]'::jsonb,
  labor_hours NUMERIC,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  completed_by TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'warranty_claims_warranty_card_id_fkey'
  ) THEN
    ALTER TABLE public.warranty_claims
      ADD CONSTRAINT warranty_claims_warranty_card_id_fkey
      FOREIGN KEY (warranty_card_id)
      REFERENCES public.warranty_cards(id)
      ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_warranty_cards_customer_phone
  ON public.warranty_cards(customer_phone);

CREATE INDEX IF NOT EXISTS idx_warranty_cards_imei_serial
  ON public.warranty_cards(imei_serial);

CREATE INDEX IF NOT EXISTS idx_warranty_cards_work_order_id
  ON public.warranty_cards(work_order_id);

CREATE INDEX IF NOT EXISTS idx_warranty_cards_status
  ON public.warranty_cards(status);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_warranty_card_id
  ON public.warranty_claims(warranty_card_id);

CREATE INDEX IF NOT EXISTS idx_warranty_claims_status
  ON public.warranty_claims(status);

CREATE OR REPLACE FUNCTION public.check_active_warranty(
  p_imei TEXT DEFAULT NULL,
  p_phone TEXT DEFAULT NULL,
  p_device_model TEXT DEFAULT NULL
)
RETURNS SETOF public.warranty_cards
LANGUAGE sql
STABLE
AS $$
  SELECT wc.*
  FROM public.warranty_cards wc
  WHERE wc.status = 'active'
    AND wc.warranty_end_date >= CURRENT_DATE
    AND (p_imei IS NULL OR wc.imei_serial = p_imei)
    AND (p_phone IS NULL OR wc.customer_phone = p_phone)
    AND (p_device_model IS NULL OR wc.device_model ILIKE ('%' || p_device_model || '%'))
  ORDER BY wc.created_at DESC;
$$;

ALTER TABLE public.warranty_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.warranty_claims ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'warranty_cards'
      AND policyname = 'Enable all access for all users on warranty_cards'
  ) THEN
    CREATE POLICY "Enable all access for all users on warranty_cards"
      ON public.warranty_cards
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'warranty_claims'
      AND policyname = 'Enable all access for all users on warranty_claims'
  ) THEN
    CREATE POLICY "Enable all access for all users on warranty_claims"
      ON public.warranty_claims
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

COMMIT;
