-- 2026-07-12_update_worker_salary_bonus_penalty.sql
-- 1. Cập nhật get_worker_monthly_salary để đọc thưởng phạt từ payroll_records
-- 2. Thêm hàm upsert_employee_bonus_penalty

BEGIN;

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
  ),
  payroll_data AS (
    SELECT 
      COALESCE(pr.bonus, 0)::NUMERIC AS bonus_val,
      COALESCE(pr.deduction, 0)::NUMERIC AS penalty_val
    FROM public.payroll_records pr
    WHERE pr.employee_id::TEXT = p_worker_id 
      AND pr.month = p_year::TEXT || '-' || LPAD(p_month::TEXT, 2, '0')
    LIMIT 1
  )
  SELECT
    p_worker_id AS worker_id,
    COALESCE(MAX(month_rows.worker_name), emp.name, 'Chua phan cong') AS worker_name,
    COUNT(month_rows.worker_id)::INTEGER AS total_service_count,
    COALESCE(SUM(month_rows.worker_amount), 0)::NUMERIC AS total_worker_amount,
    COALESCE(emp.base_salary, 0)::NUMERIC AS base_salary,
    COALESCE((SELECT bonus_val FROM payroll_data), 0)::NUMERIC AS bonus,
    COALESCE((SELECT penalty_val FROM payroll_data), 0)::NUMERIC AS penalty,
    COALESCE((SELECT total_advance FROM advance_sum), 0)::NUMERIC AS advance,
    (
      COALESCE(emp.base_salary, 0) + 
      COALESCE(SUM(month_rows.worker_amount), 0) + 
      COALESCE((SELECT bonus_val FROM payroll_data), 0) - 
      COALESCE((SELECT penalty_val FROM payroll_data), 0) - 
      COALESCE((SELECT total_advance FROM advance_sum), 0)
    )::NUMERIC AS final_salary
  FROM public.employees emp
  LEFT JOIN month_rows ON month_rows.worker_id = emp.id
  WHERE emp.id = p_worker_id
  GROUP BY emp.id, emp.name, emp.base_salary;
$$;

-- Create upsert RPC
CREATE OR REPLACE FUNCTION public.upsert_employee_bonus_penalty(
  p_employee_id UUID,
  p_month INTEGER,
  p_year INTEGER,
  p_bonus NUMERIC,
  p_penalty NUMERIC,
  p_branch_id TEXT DEFAULT 'CN1'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_base_salary NUMERIC;
  v_exists BOOLEAN;
BEGIN
  -- Lấy base_salary hiện tại nếu cần tạo mới
  SELECT base_salary INTO v_base_salary FROM public.employees WHERE id = p_employee_id;
  
  -- Kiểm tra xem đã có bản ghi payroll_records cho tháng này chưa
  SELECT EXISTS(
    SELECT 1 FROM public.payroll_records 
    WHERE employee_id = p_employee_id 
      AND month = p_year::TEXT || '-' || LPAD(p_month::TEXT, 2, '0')
  ) INTO v_exists;

  IF v_exists THEN
    UPDATE public.payroll_records
    SET 
      bonus = p_bonus,
      deduction = p_penalty
    WHERE employee_id = p_employee_id 
      AND month = p_year::TEXT || '-' || LPAD(p_month::TEXT, 2, '0');
  ELSE
    INSERT INTO public.payroll_records (
      id, employee_id, employee_name, month, branch_id, base_salary, bonus, deduction, net_salary
    ) VALUES (
      'PR-' || p_employee_id || '-' || p_year::TEXT || LPAD(p_month::TEXT, 2, '0'),
      p_employee_id, 
      COALESCE((SELECT name FROM public.employees WHERE id = p_employee_id), 'Unknown'),
      p_year::TEXT || '-' || LPAD(p_month::TEXT, 2, '0'), 
      p_branch_id, 
      COALESCE(v_base_salary, 0), 
      p_bonus, 
      p_penalty, 
      0
    );
  END IF;
END;
$$;

COMMIT;
