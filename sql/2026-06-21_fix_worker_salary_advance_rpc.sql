-- 2026-06-21_fix_worker_salary_advance_rpc.sql
-- Thêm cột employee_id vào cash_transactions, cập nhật view ledger và sửa RPC get_worker_monthly_salary.

BEGIN;

-- 1. Thêm các cột liên kết nhân viên vào bảng cash_transactions
ALTER TABLE public.cash_transactions
  ADD COLUMN IF NOT EXISTS employee_id TEXT,
  ADD COLUMN IF NOT EXISTS "employeeId" TEXT;

-- 2. Cập nhật view cash_transactions_ledger để hiển thị cột employee_id
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
  COALESCE(employee_id, "employeeId") AS employee_id,
  created_at
FROM public.cash_transactions;

GRANT SELECT ON public.cash_transactions_ledger TO anon, authenticated, service_role;

-- 3. Sửa RPC get_worker_monthly_salary để ghép tạm ứng qua ID (hoặc Tên làm fallback)
DROP FUNCTION IF EXISTS public.get_worker_monthly_salary(TEXT, INTEGER, INTEGER);

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
  advance NUMERIC,
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
      AND EXTRACT(MONTH FROM ros.created_at) = p_month
      AND EXTRACT(YEAR FROM ros.created_at) = p_year
  ),
  advance_sum AS (
    SELECT COALESCE(SUM(ct.amount), 0)::NUMERIC AS total_advance
    FROM public.cash_transactions ct
    JOIN public.employees e ON e.id = p_worker_id
    WHERE ct.category = 'employee_advance'
      AND ct.type = 'expense'
      AND (
        ct.employee_id = p_worker_id 
        OR ct."employeeId" = p_worker_id
        OR (
          ct.employee_id IS NULL 
          AND ct."employeeId" IS NULL 
          AND LOWER(TRIM(ct.recipient)) = LOWER(TRIM(e.name))
        )
      )
      AND EXTRACT(MONTH FROM ct.date) = p_month
      AND EXTRACT(YEAR FROM ct.date) = p_year
  )
  SELECT
    p_worker_id AS worker_id,
    COALESCE(MAX(month_rows.worker_name), emp.name, 'Chua phan cong') AS worker_name,
    COUNT(month_rows.worker_id)::INTEGER AS total_service_count,
    COALESCE(SUM(month_rows.worker_amount), 0)::NUMERIC AS total_worker_amount,
    COALESCE(emp.base_salary, 0)::NUMERIC AS base_salary,
    0::NUMERIC AS bonus,
    0::NUMERIC AS penalty,
    COALESCE((SELECT total_advance FROM advance_sum), 0)::NUMERIC AS advance,
    (COALESCE(emp.base_salary, 0) + COALESCE(SUM(month_rows.worker_amount), 0) - COALESCE((SELECT total_advance FROM advance_sum), 0))::NUMERIC AS final_salary
  FROM public.employees emp
  LEFT JOIN month_rows ON month_rows.worker_id = emp.id
  WHERE emp.id = p_worker_id
  GROUP BY emp.id, emp.name, emp.base_salary;
$$;

COMMIT;
