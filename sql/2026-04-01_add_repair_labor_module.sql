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
  worker_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_repair_order_services_order_id
  ON public.repair_order_services(repair_order_id);

CREATE INDEX IF NOT EXISTS idx_repair_order_service_workers_worker_id
  ON public.repair_order_service_workers(worker_id);

CREATE INDEX IF NOT EXISTS idx_repair_order_service_workers_service_id
  ON public.repair_order_service_workers(repair_order_service_id);

CREATE INDEX IF NOT EXISTS idx_repair_order_service_items_service_id
  ON public.repair_order_service_items(repair_order_service_id);

ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_service_workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_order_service_items ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'services' AND policyname = 'Enable all access for all users'
  ) THEN
    CREATE POLICY "Enable all access for all users" ON public.services FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'repair_order_services' AND policyname = 'Enable all access for all users'
  ) THEN
    CREATE POLICY "Enable all access for all users" ON public.repair_order_services FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'repair_order_service_workers' AND policyname = 'Enable all access for all users'
  ) THEN
    CREATE POLICY "Enable all access for all users" ON public.repair_order_service_workers FOR ALL USING (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'repair_order_service_items' AND policyname = 'Enable all access for all users'
  ) THEN
    CREATE POLICY "Enable all access for all users" ON public.repair_order_service_items FOR ALL USING (true);
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.recalculate_repair_order_labor_totals(p_repair_order_id TEXT)
RETURNS TABLE(labor_total NUMERIC, worker_total NUMERIC)
LANGUAGE plpgsql
AS $$
DECLARE
  v_labor_total NUMERIC(12,2) := 0;
  v_worker_total NUMERIC(12,2) := 0;
BEGIN
  SELECT COALESCE(SUM(labor_amount), 0)
  INTO v_labor_total
  FROM public.repair_order_services
  WHERE repair_order_id = p_repair_order_id
    AND is_billable = true;

  SELECT COALESCE(SUM(worker_amount_value), 0)
  INTO v_worker_total
  FROM (
    SELECT
      CASE
        WHEN ros.is_payable_to_worker = false THEN 0
        WHEN EXISTS (
          SELECT 1
          FROM public.repair_order_service_workers rosw
          WHERE rosw.repair_order_service_id = ros.id
        )
          THEN (
            SELECT COALESCE(SUM(rosw.worker_amount), 0)
            FROM public.repair_order_service_workers rosw
            WHERE rosw.repair_order_service_id = ros.id
          )
        ELSE COALESCE(ros.worker_amount, 0)
      END AS worker_amount_value
    FROM public.repair_order_services ros
    WHERE ros.repair_order_id = p_repair_order_id
  ) worker_rows;

  UPDATE public.work_orders
  SET labor_total = v_labor_total,
      worker_total = v_worker_total,
      "laborCost" = v_labor_total,
      updated_at = NOW()
  WHERE id = p_repair_order_id;

  RETURN QUERY SELECT v_labor_total, v_worker_total;
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_repair_order_labor_bundle(
  p_repair_order_id TEXT,
  p_services JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
  v_service JSONB;
  v_worker JSONB;
  v_item JSONB;
  v_service_id UUID;
BEGIN
  DELETE FROM public.repair_order_service_workers
  WHERE repair_order_service_id IN (
    SELECT id FROM public.repair_order_services WHERE repair_order_id = p_repair_order_id
  );

  DELETE FROM public.repair_order_service_items
  WHERE repair_order_service_id IN (
    SELECT id FROM public.repair_order_services WHERE repair_order_id = p_repair_order_id
  );

  DELETE FROM public.repair_order_services
  WHERE repair_order_id = p_repair_order_id;

  IF p_services IS NULL OR jsonb_typeof(p_services) <> 'array' THEN
    PERFORM public.recalculate_repair_order_labor_totals(p_repair_order_id);
    RETURN;
  END IF;

  FOR v_service IN SELECT * FROM jsonb_array_elements(p_services)
  LOOP
    INSERT INTO public.repair_order_services (
      repair_order_id,
      service_id,
      service_name,
      labor_calc_type,
      labor_fixed_amount,
      labor_percent_of_cost,
      minimum_labor_amount,
      related_product_cost,
      labor_amount,
      worker_share_percent,
      worker_amount,
      is_billable,
      is_payable_to_worker,
      note
    )
    VALUES (
      p_repair_order_id,
      NULLIF(v_service->>'service_id', '')::UUID,
      COALESCE(v_service->>'service_name', ''),
      COALESCE(v_service->>'labor_calc_type', 'fixed'),
      COALESCE((v_service->>'labor_fixed_amount')::NUMERIC, 0),
      COALESCE((v_service->>'labor_percent_of_cost')::NUMERIC, 0),
      COALESCE((v_service->>'minimum_labor_amount')::NUMERIC, 0),
      COALESCE((v_service->>'related_product_cost')::NUMERIC, 0),
      COALESCE((v_service->>'labor_amount')::NUMERIC, 0),
      COALESCE((v_service->>'worker_share_percent')::NUMERIC, 0),
      COALESCE((v_service->>'worker_amount')::NUMERIC, 0),
      COALESCE((v_service->>'is_billable')::BOOLEAN, true),
      COALESCE((v_service->>'is_payable_to_worker')::BOOLEAN, true),
      NULLIF(v_service->>'note', '')
    )
    RETURNING id INTO v_service_id;

    IF jsonb_typeof(v_service->'workers') = 'array' THEN
      FOR v_worker IN SELECT * FROM jsonb_array_elements(v_service->'workers')
      LOOP
        INSERT INTO public.repair_order_service_workers (
          repair_order_service_id,
          worker_id,
          worker_name,
          share_percent,
          worker_amount
        )
        VALUES (
          v_service_id,
          v_worker->>'worker_id',
          NULLIF(v_worker->>'worker_name', ''),
          COALESCE((v_worker->>'share_percent')::NUMERIC, 0),
          COALESCE((v_worker->>'worker_amount')::NUMERIC, 0)
        );
      END LOOP;
    END IF;

    IF jsonb_typeof(v_service->'related_items') = 'array' THEN
      FOR v_item IN SELECT * FROM jsonb_array_elements(v_service->'related_items')
      LOOP
        INSERT INTO public.repair_order_service_items (
          repair_order_service_id,
          part_id,
          part_name,
          quantity,
          unit_cost,
          line_cost
        )
        VALUES (
          v_service_id,
          COALESCE(v_item->>'part_id', ''),
          NULLIF(v_item->>'part_name', ''),
          COALESCE((v_item->>'quantity')::NUMERIC, 1),
          COALESCE((v_item->>'unit_cost')::NUMERIC, 0),
          COALESCE((v_item->>'line_cost')::NUMERIC, 0)
        );
      END LOOP;
    END IF;
  END LOOP;

  PERFORM public.recalculate_repair_order_labor_totals(p_repair_order_id);
END;
$$;

CREATE OR REPLACE FUNCTION public.get_worker_monthly_salary(
  p_worker_id TEXT,
  p_month INTEGER,
  p_year INTEGER
)
RETURNS TABLE(
  worker_id TEXT,
  worker_name TEXT,
  total_service_count INTEGER,
  total_worker_amount NUMERIC,
  base_salary NUMERIC,
  bonus NUMERIC,
  penalty NUMERIC,
  final_salary NUMERIC
)
LANGUAGE sql
AS $$
  WITH month_rows AS (
    SELECT
      rosw.worker_id,
      COALESCE(rosw.worker_name, e.name) AS worker_name,
      rosw.worker_amount
    FROM public.repair_order_service_workers rosw
    JOIN public.repair_order_services ros ON ros.id = rosw.repair_order_service_id
    LEFT JOIN public.employees e ON e.id = rosw.worker_id
    WHERE rosw.worker_id = p_worker_id
      AND EXTRACT(MONTH FROM COALESCE(ros.updated_at, ros.created_at)) = p_month
      AND EXTRACT(YEAR FROM COALESCE(ros.updated_at, ros.created_at)) = p_year
  )
  SELECT
    p_worker_id AS worker_id,
    COALESCE(MAX(month_rows.worker_name), emp.name, 'Chua phan cong') AS worker_name,
    COUNT(month_rows.worker_id)::INTEGER AS total_service_count,
    COALESCE(SUM(month_rows.worker_amount), 0)::NUMERIC AS total_worker_amount,
    COALESCE(emp.base_salary, emp."base_salary", 0)::NUMERIC AS base_salary,
    0::NUMERIC AS bonus,
    0::NUMERIC AS penalty,
    (COALESCE(emp.base_salary, emp."base_salary", 0) + COALESCE(SUM(month_rows.worker_amount), 0))::NUMERIC AS final_salary
  FROM public.employees emp
  LEFT JOIN month_rows ON month_rows.worker_id = emp.id
  WHERE emp.id = p_worker_id
  GROUP BY emp.id, emp.name, emp.base_salary, emp."base_salary";
$$;

INSERT INTO public.services (
  name,
  labor_calc_type,
  labor_fixed_amount,
  labor_percent_of_cost,
  minimum_labor_amount,
  default_worker_share_percent,
  category,
  description
)
VALUES
  ('Thay bugi', 'percent_of_cost', 0, 5, 20000, 30, 'Bao duong', 'Cong tinh theo 5% gia nhap bugi'),
  ('Thay loc gio', 'percent_of_cost', 0, 5, 20000, 30, 'Bao duong', 'Cong tinh theo 5% gia nhap loc gio'),
  ('Thay bom xang', 'percent_of_cost', 0, 8, 50000, 30, 'Sua chua', 'Cong tinh theo 8% gia nhap bom xang'),
  ('Ve sinh hong ga', 'fixed', 100000, 0, 0, 30, 'Bao duong', 'Cong co dinh'),
  ('Suc kim phun', 'fixed', 120000, 0, 0, 30, 'Bao duong', 'Cong co dinh'),
  ('Ve sinh noi', 'fixed', 150000, 0, 0, 30, 'Bao duong', 'Cong co dinh'),
  ('Sua FI', 'manual', 150000, 0, 0, 35, 'Sua chua', 'Cho phep nhap tay tien cong'),
  ('Dai tu may', 'manual', 500000, 0, 0, 40, 'Dai tu', 'Cho phep nhap tay tien cong')
ON CONFLICT (name) DO UPDATE SET
  labor_calc_type = EXCLUDED.labor_calc_type,
  labor_fixed_amount = EXCLUDED.labor_fixed_amount,
  labor_percent_of_cost = EXCLUDED.labor_percent_of_cost,
  minimum_labor_amount = EXCLUDED.minimum_labor_amount,
  default_worker_share_percent = EXCLUDED.default_worker_share_percent,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  updated_at = NOW();
