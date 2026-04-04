-- ============================================================
-- RUNME_complete_migration.sql
-- Chạy file này 1 lần trên Supabase SQL Editor để kích hoạt
-- toàn bộ tính năng của MotoCare Pro.
-- 
-- Tất cả câu lệnh đều dùng IF NOT EXISTS / OR REPLACE 
-- nên an toàn để chạy nhiều lần.
-- ============================================================

-- ============================================================
-- PHẦN 1: Bảng inventory_transactions (Lịch sử kho)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL DEFAULT 'Nhập kho',
  "partId" TEXT,
  "partName" TEXT,
  quantity NUMERIC DEFAULT 0,
  date TIMESTAMPTZ DEFAULT NOW(),
  "unitPrice" NUMERIC DEFAULT 0,
  "totalPrice" NUMERIC DEFAULT 0,
  "branchId" TEXT DEFAULT 'CN1',
  notes TEXT,
  "saleId" TEXT,
  "workOrderId" TEXT,
  "supplierId" TEXT,
  "userId" TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Enable all access for all users" ON public.inventory_transactions;
DROP POLICY IF EXISTS "Allow all access" ON public.inventory_transactions;

CREATE POLICY "Enable all access for all users" 
  ON public.inventory_transactions 
  FOR ALL 
  USING (true)
  WITH CHECK (true);

-- ============================================================
-- PHẦN 2: Sổ quỹ (payment_sources + cash_transactions)
-- ============================================================

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
  ON public.payment_sources FOR ALL USING (true) WITH CHECK (true);

INSERT INTO public.payment_sources (id, name, type, balance, is_default)
VALUES
  ('cash', 'Tiền mặt', 'cash', '{}'::jsonb, true),
  ('bank', 'Chuyển khoản', 'bank', '{}'::jsonb, false)
ON CONFLICT (id) DO UPDATE
SET
  name = EXCLUDED.name,
  type = COALESCE(public.payment_sources.type, EXCLUDED.type),
  balance = COALESCE(public.payment_sources.balance, '{}'::jsonb);

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
  ON public.cash_transactions FOR ALL USING (true) WITH CHECK (true);

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

-- ============================================================
-- PHẦN 3: Module Sửa chữa (repair labor)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  labor_calc_type VARCHAR(30) NOT NULL DEFAULT 'fixed',
  labor_fixed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_percent_of_cost NUMERIC(5,2) NOT NULL DEFAULT 0,
  minimum_labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  default_worker_share_percent NUMERIC(5,2) NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS labor_total NUMERIC(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS worker_total NUMERIC(12,2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.repair_order_services (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_order_id TEXT NOT NULL REFERENCES public.work_orders(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE SET NULL,
  service_name TEXT NOT NULL,
  labor_calc_type VARCHAR(30) NOT NULL DEFAULT 'fixed',
  labor_fixed_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_percent_of_cost NUMERIC(5,2) NOT NULL DEFAULT 0,
  minimum_labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  related_product_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  labor_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  worker_share_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  worker_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  is_billable BOOLEAN NOT NULL DEFAULT true,
  is_payable_to_worker BOOLEAN NOT NULL DEFAULT true,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.repair_order_service_workers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_order_service_id UUID NOT NULL REFERENCES public.repair_order_services(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL,
  worker_name TEXT,
  share_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  worker_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.repair_order_service_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  repair_order_service_id UUID NOT NULL REFERENCES public.repair_order_services(id) ON DELETE CASCADE,
  part_id TEXT NOT NULL,
  part_name TEXT,
  quantity NUMERIC(12,2) NOT NULL DEFAULT 1,
  unit_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  line_cost NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_order_services_order_id ON public.repair_order_services(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_repair_order_service_workers_worker_id ON public.repair_order_service_workers(worker_id);
CREATE INDEX IF NOT EXISTS idx_repair_order_service_workers_service_id ON public.repair_order_service_workers(repair_order_service_id);
CREATE INDEX IF NOT EXISTS idx_repair_order_service_items_service_id ON public.repair_order_service_items(repair_order_service_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_service_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_service_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Enable all access for all users') THEN
    CREATE POLICY "Enable all access for all users" ON public.services FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repair_order_services' AND policyname = 'Enable all access for all users') THEN
    CREATE POLICY "Enable all access for all users" ON public.repair_order_services FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repair_order_service_workers' AND policyname = 'Enable all access for all users') THEN
    CREATE POLICY "Enable all access for all users" ON public.repair_order_service_workers FOR ALL USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'repair_order_service_items' AND policyname = 'Enable all access for all users') THEN
    CREATE POLICY "Enable all access for all users" ON public.repair_order_service_items FOR ALL USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_repair_order_labor_totals(p_repair_order_id TEXT)
RETURNS TABLE(labor_total NUMERIC, worker_total NUMERIC)
LANGUAGE plpgsql AS $$
DECLARE
  v_labor_total NUMERIC(12,2) := 0;
  v_worker_total NUMERIC(12,2) := 0;
BEGIN
  SELECT COALESCE(SUM(labor_amount), 0) INTO v_labor_total
  FROM public.repair_order_services
  WHERE repair_order_id = p_repair_order_id AND is_billable = true;

  SELECT COALESCE(SUM(worker_amount_value), 0) INTO v_worker_total
  FROM (
    SELECT CASE
      WHEN ros.is_payable_to_worker = false THEN 0
      WHEN EXISTS (SELECT 1 FROM public.repair_order_service_workers rosw WHERE rosw.repair_order_service_id = ros.id)
        THEN (SELECT COALESCE(SUM(rosw.worker_amount), 0) FROM public.repair_order_service_workers rosw WHERE rosw.repair_order_service_id = ros.id)
      ELSE COALESCE(ros.worker_amount, 0)
    END AS worker_amount_value
    FROM public.repair_order_services ros WHERE ros.repair_order_id = p_repair_order_id
  ) worker_rows;

  UPDATE public.work_orders
  SET labor_total = v_labor_total, worker_total = v_worker_total, "laborCost" = v_labor_total, updated_at = NOW()
  WHERE id = p_repair_order_id;

  RETURN QUERY SELECT v_labor_total, v_worker_total;
END; $$;

CREATE OR REPLACE FUNCTION public.upsert_repair_order_labor_bundle(p_repair_order_id TEXT, p_services JSONB)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE
  v_service JSONB; v_worker JSONB; v_item JSONB; v_service_id UUID;
BEGIN
  DELETE FROM public.repair_order_service_workers WHERE repair_order_service_id IN (SELECT id FROM public.repair_order_services WHERE repair_order_id = p_repair_order_id);
  DELETE FROM public.repair_order_service_items WHERE repair_order_service_id IN (SELECT id FROM public.repair_order_services WHERE repair_order_id = p_repair_order_id);
  DELETE FROM public.repair_order_services WHERE repair_order_id = p_repair_order_id;

  IF p_services IS NULL OR jsonb_typeof(p_services) <> 'array' THEN
    PERFORM public.recalculate_repair_order_labor_totals(p_repair_order_id);
    RETURN;
  END IF;

  FOR v_service IN SELECT * FROM jsonb_array_elements(p_services) LOOP
    INSERT INTO public.repair_order_services (repair_order_id, service_id, service_name, labor_calc_type, labor_fixed_amount, labor_percent_of_cost, minimum_labor_amount, related_product_cost, labor_amount, worker_share_percent, worker_amount, is_billable, is_payable_to_worker, note)
    VALUES (p_repair_order_id, NULLIF(v_service->>'service_id','')::UUID, COALESCE(v_service->>'service_name',''), COALESCE(v_service->>'labor_calc_type','fixed'), COALESCE((v_service->>'labor_fixed_amount')::NUMERIC,0), COALESCE((v_service->>'labor_percent_of_cost')::NUMERIC,0), COALESCE((v_service->>'minimum_labor_amount')::NUMERIC,0), COALESCE((v_service->>'related_product_cost')::NUMERIC,0), COALESCE((v_service->>'labor_amount')::NUMERIC,0), COALESCE((v_service->>'worker_share_percent')::NUMERIC,0), COALESCE((v_service->>'worker_amount')::NUMERIC,0), COALESCE((v_service->>'is_billable')::BOOLEAN,true), COALESCE((v_service->>'is_payable_to_worker')::BOOLEAN,true), NULLIF(v_service->>'note',''))
    RETURNING id INTO v_service_id;

    IF jsonb_typeof(v_service->'workers') = 'array' THEN
      FOR v_worker IN SELECT * FROM jsonb_array_elements(v_service->'workers') LOOP
        INSERT INTO public.repair_order_service_workers (repair_order_service_id, worker_id, worker_name, share_percent, worker_amount)
        VALUES (v_service_id, v_worker->>'worker_id', NULLIF(v_worker->>'worker_name',''), COALESCE((v_worker->>'share_percent')::NUMERIC,0), COALESCE((v_worker->>'worker_amount')::NUMERIC,0));
      END LOOP;
    END IF;

    IF jsonb_typeof(v_service->'related_items') = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_service->'related_items') LOOP
        INSERT INTO public.repair_order_service_items (repair_order_service_id, part_id, part_name, quantity, unit_cost, line_cost)
        VALUES (v_service_id, COALESCE(v_item->>'part_id',''), NULLIF(v_item->>'part_name',''), COALESCE((v_item->>'quantity')::NUMERIC,1), COALESCE((v_item->>'unit_cost')::NUMERIC,0), COALESCE((v_item->>'line_cost')::NUMERIC,0));
      END LOOP;
    END IF;
  END LOOP;

  PERFORM public.recalculate_repair_order_labor_totals(p_repair_order_id);
END; $$;

-- Seed dịch vụ mẫu
INSERT INTO public.services (name, labor_calc_type, labor_fixed_amount, labor_percent_of_cost, minimum_labor_amount, default_worker_share_percent, category, description)
VALUES
  ('Thay bugi', 'percent_of_cost', 0, 5, 20000, 30, 'Bảo dưỡng', 'Công tính theo 5% giá nhập bugi'),
  ('Thay lọc gió', 'percent_of_cost', 0, 5, 20000, 30, 'Bảo dưỡng', 'Công tính theo 5% giá nhập lọc gió'),
  ('Thay bơm xăng', 'percent_of_cost', 0, 8, 50000, 30, 'Sửa chữa', 'Công tính theo 8% giá nhập bơm xăng'),
  ('Vệ sinh họng ga', 'fixed', 100000, 0, 0, 30, 'Bảo dưỡng', 'Công cố định'),
  ('Súc kim phun', 'fixed', 120000, 0, 0, 30, 'Bảo dưỡng', 'Công cố định'),
  ('Vệ sinh nồi', 'fixed', 150000, 0, 0, 30, 'Bảo dưỡng', 'Công cố định'),
  ('Sửa FI', 'manual', 150000, 0, 0, 35, 'Sửa chữa', 'Cho phép nhập tay tiền công'),
  ('Đại tu máy', 'manual', 500000, 0, 0, 40, 'Đại tu', 'Cho phép nhập tay tiền công')
ON CONFLICT (name) DO UPDATE SET
  labor_calc_type = EXCLUDED.labor_calc_type,
  labor_fixed_amount = EXCLUDED.labor_fixed_amount,
  labor_percent_of_cost = EXCLUDED.labor_percent_of_cost,
  minimum_labor_amount = EXCLUDED.minimum_labor_amount,
  default_worker_share_percent = EXCLUDED.default_worker_share_percent,
  updated_at = NOW();

-- ============================================================
-- PHẦN 4: Thanh toán phiếu sửa chữa + trừ kho tự động
-- ============================================================

ALTER TABLE IF EXISTS public.work_orders
  ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT FALSE;

CREATE OR REPLACE FUNCTION public.work_order_complete_payment(
  p_order_id TEXT,
  p_payment_method TEXT,
  p_payment_amount NUMERIC,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row_json JSONB;
  v_current_total NUMERIC := 0;
  v_current_paid NUMERIC := 0;
  v_add_paid NUMERIC := 0;
  v_new_paid NUMERIC := 0;
  v_remaining NUMERIC := 0;
  v_new_status TEXT := 'unpaid';
  v_branch_id TEXT := 'CN1';
  v_parts JSONB := '[]'::jsonb;
  v_inventory_deducted BOOLEAN := FALSE;
  v_set_clause TEXT := '';
  v_col_exists BOOLEAN := FALSE;
  v_item JSONB;
  v_part_id TEXT;
  v_part_name TEXT;
  v_qty NUMERIC;
  v_stock_json JSONB;
  v_current_stock NUMERIC;
  v_shortages JSONB := '[]'::jsonb;
BEGIN
  SELECT to_jsonb(w) INTO v_row_json FROM public.work_orders w WHERE w.id = p_order_id FOR UPDATE;
  IF v_row_json IS NULL THEN RAISE EXCEPTION 'ORDER_NOT_FOUND'; END IF;

  v_current_total := COALESCE((v_row_json->>'total')::numeric, 0);
  v_current_paid := COALESCE((v_row_json->>'totalPaid')::numeric, (v_row_json->>'totalpaid')::numeric, 0);
  v_add_paid := GREATEST(0, COALESCE(p_payment_amount, 0));
  v_new_paid := v_current_paid + v_add_paid;
  v_remaining := GREATEST(0, v_current_total - v_new_paid);
  v_new_status := CASE WHEN v_remaining <= 0 THEN 'paid' WHEN v_new_paid > 0 THEN 'partial' ELSE 'unpaid' END;
  v_branch_id := COALESCE(NULLIF(v_row_json->>'branchId',''), NULLIF(v_row_json->>'branchid',''), 'CN1');
  v_parts := COALESCE(v_row_json->'partsUsed', v_row_json->'partsused', '[]'::jsonb);
  v_inventory_deducted := COALESCE((v_row_json->>'inventory_deducted')::boolean, FALSE);

  -- Build dynamic update clause
  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='paymentStatus') INTO v_col_exists;
  IF v_col_exists THEN v_set_clause := v_set_clause || '"paymentStatus" = ' || quote_literal(v_new_status) || ', ';
  ELSE
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='paymentstatus') INTO v_col_exists;
    IF v_col_exists THEN v_set_clause := v_set_clause || 'paymentstatus = ' || quote_literal(v_new_status) || ', '; END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='paymentMethod') INTO v_col_exists;
  IF v_col_exists THEN v_set_clause := v_set_clause || '"paymentMethod" = ' || quote_literal(COALESCE(p_payment_method,'cash')) || ', ';
  ELSE
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='paymentmethod') INTO v_col_exists;
    IF v_col_exists THEN v_set_clause := v_set_clause || 'paymentmethod = ' || quote_literal(COALESCE(p_payment_method,'cash')) || ', '; END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='totalPaid') INTO v_col_exists;
  IF v_col_exists THEN v_set_clause := v_set_clause || '"totalPaid" = ' || v_new_paid || ', ';
  ELSE
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='totalpaid') INTO v_col_exists;
    IF v_col_exists THEN v_set_clause := v_set_clause || 'totalpaid = ' || v_new_paid || ', '; END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='remainingAmount') INTO v_col_exists;
  IF v_col_exists THEN v_set_clause := v_set_clause || '"remainingAmount" = ' || v_remaining || ', ';
  ELSE
    SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='remainingamount') INTO v_col_exists;
    IF v_col_exists THEN v_set_clause := v_set_clause || 'remainingamount = ' || v_remaining || ', '; END IF;
  END IF;

  SELECT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='work_orders' AND column_name='updated_at') INTO v_col_exists;
  IF v_col_exists THEN v_set_clause := v_set_clause || 'updated_at = NOW(), '; END IF;

  IF right(v_set_clause, 2) = ', ' THEN v_set_clause := left(v_set_clause, length(v_set_clause) - 2); END IF;
  IF v_set_clause <> '' THEN
    EXECUTE 'UPDATE public.work_orders SET ' || v_set_clause || ' WHERE id = ' || quote_literal(p_order_id);
  END IF;

  -- Deduct stock when fully paid
  IF v_new_status = 'paid' AND NOT v_inventory_deducted THEN
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_parts, '[]'::jsonb)) LOOP
      v_part_id := COALESCE(v_item->>'partId', v_item->>'part_id');
      v_qty := COALESCE((v_item->>'quantity')::numeric, 0);
      IF v_part_id IS NULL OR v_part_id = '' OR v_qty <= 0 THEN CONTINUE; END IF;
      SELECT stock INTO v_stock_json FROM public.parts WHERE id = v_part_id FOR UPDATE;
      v_current_stock := COALESCE((v_stock_json->>v_branch_id)::numeric, 0);
      UPDATE public.parts SET stock = jsonb_set(COALESCE(stock,'{}'::jsonb), ARRAY[v_branch_id], to_jsonb(GREATEST(0, v_current_stock - v_qty)), TRUE) WHERE id = v_part_id;
    END LOOP;
    UPDATE public.work_orders SET inventory_deducted = TRUE WHERE id = p_order_id;
  END IF;

  SELECT to_jsonb(w) INTO v_row_json FROM public.work_orders w WHERE w.id = p_order_id;
  RETURN jsonb_build_object('workOrder', v_row_json, 'paymentTransactionId', NULL, 'newPaymentStatus', v_new_status, 'inventoryDeducted', (v_new_status = 'paid'));
END; $$;

GRANT EXECUTE ON FUNCTION public.work_order_complete_payment(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.work_order_complete_payment(TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- ============================================================
-- PHẦN 5: View tồn kho theo chi nhánh
-- ============================================================

DROP VIEW IF EXISTS public.inventory_balances_view;
CREATE VIEW public.inventory_balances_view AS
WITH parts_json AS (
  SELECT p.id, p.name, p.sku, p.category, p.description, p.created_at, to_jsonb(p) AS row_data FROM public.parts p
),
branch_rows AS (
  SELECT
    pj.id AS part_id, pj.name AS part_name, pj.sku, pj.category, pj.description, pj.created_at,
    bs.key AS branch_id,
    COALESCE(NULLIF(bs.value,'')::numeric, 0) AS on_hand_qty,
    COALESCE(NULLIF(COALESCE((COALESCE(pj.row_data->'reservedStock', pj.row_data->'reservedstock', pj.row_data->'reserved', '{}'::jsonb)->>bs.key),'0'),'')::numeric,0) AS reserved_qty,
    COALESCE(NULLIF(COALESCE((COALESCE(pj.row_data->'costPrice', pj.row_data->'costprice', '{}'::jsonb)->>bs.key),'0'),'')::numeric,0) AS cost_price,
    COALESCE(NULLIF(COALESCE((COALESCE(pj.row_data->'retailPrice', pj.row_data->'retailprice', '{}'::jsonb)->>bs.key),'0'),'')::numeric,0) AS retail_price,
    COALESCE(NULLIF(COALESCE((COALESCE(pj.row_data->'wholesalePrice', pj.row_data->'wholesaleprice', '{}'::jsonb)->>bs.key),'0'),'')::numeric,0) AS wholesale_price,
    COALESCE(NULLIF(COALESCE((COALESCE(pj.row_data->'laborCost', pj.row_data->'laborcost', '{}'::jsonb)->>bs.key),'0'),'')::numeric,0) AS labor_cost
  FROM parts_json pj
  CROSS JOIN LATERAL jsonb_each_text(COALESCE(pj.row_data->'stock', '{}'::jsonb)) bs
)
SELECT part_id, part_name, sku, category, description, branch_id, on_hand_qty, reserved_qty, GREATEST(on_hand_qty - reserved_qty, 0) AS available_qty, cost_price, retail_price, wholesale_price, labor_cost, GREATEST(on_hand_qty - reserved_qty, 0) * cost_price AS inventory_value, created_at
FROM branch_rows ORDER BY branch_id, part_name;

GRANT SELECT ON public.inventory_balances_view TO anon, authenticated, service_role;

-- ============================================================
-- PHẦN 6: Thêm cột còn thiếu cho work_orders
-- ============================================================

ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS "vehicleId" TEXT,
  ADD COLUMN IF NOT EXISTS "currentKm" NUMERIC,
  ADD COLUMN IF NOT EXISTS "additionalServices" JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS "depositAmount" NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "depositDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "depositTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS "additionalPayment" NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "totalPaid" NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "remainingAmount" NUMERIC DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "paymentDate" TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS "cashTransactionId" TEXT,
  ADD COLUMN IF NOT EXISTS refunded BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refund_transaction_id TEXT,
  ADD COLUMN IF NOT EXISTS refund_reason TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- ============================================================
-- KIỂM TRA KẾT QUẢ
-- ============================================================
SELECT 
  'inventory_transactions' AS table_name, COUNT(*) AS rows FROM public.inventory_transactions
UNION ALL SELECT 'payment_sources', COUNT(*) FROM public.payment_sources
UNION ALL SELECT 'services', COUNT(*) FROM public.services;
