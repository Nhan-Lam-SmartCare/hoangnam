CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'services'
  ) THEN
    RAISE EXCEPTION 'Missing table public.services. Run sql/2026-04-01_add_repair_labor_module.sql first.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.services
    WHERE name IN ('Thay bugi', 'Thay bom xang', 'Ve sinh hong ga', 'Sua FI', 'Ve sinh noi')
  ) THEN
    RAISE EXCEPTION 'Missing service configs. Run sql/2026-04-01_add_repair_labor_module.sql first.';
  END IF;
END $$;

BEGIN;

INSERT INTO public.employees (
  id,
  name,
  phone,
  email,
  position,
  department,
  base_salary,
  allowances,
  start_date,
  status,
  branch_id
)
VALUES
  (
    'EMP-LABOR-DEMO-001',
    'Nguyen Van Duc',
    '0909000001',
    'duc.demo@motocare.vn',
    'Ky thuat vien chinh',
    'Ky thuat',
    12000000,
    500000,
    CURRENT_DATE - INTERVAL '400 days',
    'active',
    'CN1'
  ),
  (
    'EMP-LABOR-DEMO-002',
    'Pham Van Son',
    '0909000002',
    'son.demo@motocare.vn',
    'Ky thuat vien',
    'Ky thuat',
    9000000,
    300000,
    CURRENT_DATE - INTERVAL '220 days',
    'active',
    'CN1'
  ),
  (
    'EMP-LABOR-DEMO-003',
    'Tran Minh Tuan',
    '0909000003',
    'tuan.demo@motocare.vn',
    'Tho may',
    'Ky thuat',
    8500000,
    250000,
    CURRENT_DATE - INTERVAL '180 days',
    'active',
    'CN1'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  phone = EXCLUDED.phone,
  email = EXCLUDED.email,
  position = EXCLUDED.position,
  department = EXCLUDED.department,
  base_salary = EXCLUDED.base_salary,
  allowances = EXCLUDED.allowances,
  start_date = EXCLUDED.start_date,
  status = EXCLUDED.status,
  branch_id = EXCLUDED.branch_id;

DELETE FROM public.repair_order_service_workers
WHERE repair_order_service_id IN (
  SELECT id
  FROM public.repair_order_services
  WHERE repair_order_id IN (
    'WO-LABOR-DEMO-001',
    'WO-LABOR-DEMO-002',
    'WO-LABOR-DEMO-003'
  )
);

DELETE FROM public.repair_order_service_items
WHERE repair_order_service_id IN (
  SELECT id
  FROM public.repair_order_services
  WHERE repair_order_id IN (
    'WO-LABOR-DEMO-001',
    'WO-LABOR-DEMO-002',
    'WO-LABOR-DEMO-003'
  )
);

DELETE FROM public.repair_order_services
WHERE repair_order_id IN (
  'WO-LABOR-DEMO-001',
  'WO-LABOR-DEMO-002',
  'WO-LABOR-DEMO-003'
);

DELETE FROM public.work_orders
WHERE id IN (
  'WO-LABOR-DEMO-001',
  'WO-LABOR-DEMO-002',
  'WO-LABOR-DEMO-003'
);

INSERT INTO public.work_orders (
  id,
  "creationDate",
  "customerName",
  "customerPhone",
  "vehicleModel",
  "licensePlate",
  "technicianName",
  status,
  "laborCost",
  labor_total,
  worker_total,
  discount,
  "partsUsed",
  notes,
  total,
  "branchId",
  "paymentStatus",
  "paymentMethod",
  "totalPaid",
  "remainingAmount"
)
VALUES
  (
    'WO-LABOR-DEMO-001',
    NOW() - INTERVAL '6 days',
    'Nguyen Van Khoa',
    '0901234501',
    'Honda Air Blade 125',
    '59A1-12345',
    'Nguyen Van Duc',
    'completed',
    120000,
    120000,
    36000,
    0,
    '[
      {"id":"part-demo-labor-001","name":"Bugi Iridium","quantity":1,"price":180000,"costPrice":140000},
      {"id":"part-demo-labor-002","name":"Loc gio Air Blade","quantity":1,"price":130000,"costPrice":90000}
    ]'::jsonb,
    'Demo labor: 1 tho + cong co dinh + cong theo phan tram gia nhap.',
    430000,
    'CN1',
    'paid',
    'cash',
    430000,
    0
  ),
  (
    'WO-LABOR-DEMO-002',
    NOW() - INTERVAL '4 days',
    'Le Minh Quan',
    '0901234502',
    'Yamaha NVX 155',
    '59B2-67890',
    'Pham Van Son',
    'completed',
    164000,
    164000,
    94000,
    0,
    '[
      {"id":"part-demo-labor-003","name":"Bom xang NVX","quantity":1,"price":1190000,"costPrice":800000}
    ]'::jsonb,
    'Demo labor: 2 tho chia 70/30 + tong cong theo test case.',
    1354000,
    'CN1',
    'paid',
    'bank_transfer',
    1354000,
    0
  ),
  (
    'WO-LABOR-DEMO-003',
    NOW() - INTERVAL '2 days',
    'Tran Gia Bao',
    '0901234503',
    'Honda Winner X',
    '59C3-24680',
    'Tran Minh Tuan',
    'completed',
    180000,
    180000,
    63000,
    0,
    '[]'::jsonb,
    'Demo labor: cong manual + 1 muc bao hanh khong tinh bill/luong.',
    180000,
    'CN1',
    'partial',
    'cash',
    100000,
    80000
  );

INSERT INTO public.repair_order_services (
  id,
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
  note,
  created_at,
  updated_at
)
SELECT
  '61111111-1111-4111-8111-111111111111',
  'WO-LABOR-DEMO-001',
  s.id,
  s.name,
  'percent_of_cost',
  0,
  5,
  20000,
  140000,
  20000,
  30,
  6000,
  true,
  true,
  'Thay bugi tinh 5% gia nhap, min 20,000.',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
FROM public.services s
WHERE s.name = 'Thay bugi';

INSERT INTO public.repair_order_services (
  id,
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
  note,
  created_at,
  updated_at
)
SELECT
  '62222222-2222-4222-8222-222222222222',
  'WO-LABOR-DEMO-001',
  s.id,
  s.name,
  'fixed',
  100000,
  0,
  0,
  0,
  100000,
  30,
  30000,
  true,
  true,
  'Ve sinh hong ga cong co dinh.',
  NOW() - INTERVAL '6 days',
  NOW() - INTERVAL '6 days'
FROM public.services s
WHERE s.name = 'Ve sinh hong ga';

INSERT INTO public.repair_order_services (
  id,
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
  note,
  created_at,
  updated_at
)
SELECT
  '63333333-3333-4333-8333-333333333333',
  'WO-LABOR-DEMO-002',
  s.id,
  s.name,
  'percent_of_cost',
  0,
  8,
  50000,
  800000,
  64000,
  0,
  0,
  true,
  true,
  'Thay bom xang, cong chia cho 2 tho.',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
FROM public.services s
WHERE s.name = 'Thay bom xang';

INSERT INTO public.repair_order_services (
  id,
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
  note,
  created_at,
  updated_at
)
SELECT
  '64444444-4444-4444-8444-444444444444',
  'WO-LABOR-DEMO-002',
  s.id,
  s.name,
  'fixed',
  100000,
  0,
  0,
  0,
  100000,
  30,
  30000,
  true,
  true,
  'Cong co dinh de khop tong labor 164,000.',
  NOW() - INTERVAL '4 days',
  NOW() - INTERVAL '4 days'
FROM public.services s
WHERE s.name = 'Ve sinh hong ga';

INSERT INTO public.repair_order_services (
  id,
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
  note,
  created_at,
  updated_at
)
SELECT
  '65555555-5555-4555-8555-555555555555',
  'WO-LABOR-DEMO-003',
  s.id,
  s.name,
  'manual',
  150000,
  0,
  0,
  0,
  180000,
  35,
  63000,
  true,
  true,
  'Nhap tay cong sua FI.',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
FROM public.services s
WHERE s.name = 'Sua FI';

INSERT INTO public.repair_order_services (
  id,
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
  note,
  created_at,
  updated_at
)
SELECT
  '66666666-6666-4666-8666-666666666666',
  'WO-LABOR-DEMO-003',
  s.id,
  s.name,
  'fixed',
  150000,
  0,
  0,
  0,
  150000,
  0,
  0,
  false,
  false,
  'Bao hanh hau mai: khong tinh bill va khong tinh luong.',
  NOW() - INTERVAL '2 days',
  NOW() - INTERVAL '2 days'
FROM public.services s
WHERE s.name = 'Ve sinh noi';

INSERT INTO public.repair_order_service_items (
  repair_order_service_id,
  part_id,
  part_name,
  quantity,
  unit_cost,
  line_cost
)
VALUES
  (
    '61111111-1111-4111-8111-111111111111',
    'part-demo-labor-001',
    'Bugi Iridium',
    1,
    140000,
    140000
  ),
  (
    '63333333-3333-4333-8333-333333333333',
    'part-demo-labor-003',
    'Bom xang NVX',
    1,
    800000,
    800000
  );

INSERT INTO public.repair_order_service_workers (
  repair_order_service_id,
  worker_id,
  worker_name,
  share_percent,
  worker_amount,
  created_at
)
VALUES
  (
    '61111111-1111-4111-8111-111111111111',
    'EMP-LABOR-DEMO-001',
    'Nguyen Van Duc',
    30,
    6000,
    NOW() - INTERVAL '6 days'
  ),
  (
    '62222222-2222-4222-8222-222222222222',
    'EMP-LABOR-DEMO-001',
    'Nguyen Van Duc',
    30,
    30000,
    NOW() - INTERVAL '6 days'
  ),
  (
    '63333333-3333-4333-8333-333333333333',
    'EMP-LABOR-DEMO-002',
    'Pham Van Son',
    70,
    44800,
    NOW() - INTERVAL '4 days'
  ),
  (
    '63333333-3333-4333-8333-333333333333',
    'EMP-LABOR-DEMO-003',
    'Tran Minh Tuan',
    30,
    19200,
    NOW() - INTERVAL '4 days'
  ),
  (
    '64444444-4444-4444-8444-444444444444',
    'EMP-LABOR-DEMO-002',
    'Pham Van Son',
    30,
    30000,
    NOW() - INTERVAL '4 days'
  ),
  (
    '65555555-5555-4555-8555-555555555555',
    'EMP-LABOR-DEMO-003',
    'Tran Minh Tuan',
    35,
    63000,
    NOW() - INTERVAL '2 days'
  );

SELECT * FROM public.recalculate_repair_order_labor_totals('WO-LABOR-DEMO-001');
SELECT * FROM public.recalculate_repair_order_labor_totals('WO-LABOR-DEMO-002');
SELECT * FROM public.recalculate_repair_order_labor_totals('WO-LABOR-DEMO-003');

UPDATE public.work_orders
SET
  total = 430000,
  "totalPaid" = 430000,
  "remainingAmount" = 0,
  "paymentStatus" = 'paid'
WHERE id = 'WO-LABOR-DEMO-001';

UPDATE public.work_orders
SET
  total = 1354000,
  "totalPaid" = 1354000,
  "remainingAmount" = 0,
  "paymentStatus" = 'paid'
WHERE id = 'WO-LABOR-DEMO-002';

UPDATE public.work_orders
SET
  total = 180000,
  "totalPaid" = 100000,
  "remainingAmount" = 80000,
  "paymentStatus" = 'partial'
WHERE id = 'WO-LABOR-DEMO-003';

COMMIT;

SELECT
  wo.id,
  wo."customerName",
  wo.total AS grand_total,
  wo.labor_total,
  wo.worker_total,
  wo."paymentStatus"
FROM public.work_orders wo
WHERE wo.id IN (
  'WO-LABOR-DEMO-001',
  'WO-LABOR-DEMO-002',
  'WO-LABOR-DEMO-003'
)
ORDER BY wo.id;

SELECT
  rosw.worker_id,
  COALESCE(rosw.worker_name, e.name) AS worker_name,
  COUNT(*)::INTEGER AS total_service_count,
  SUM(rosw.worker_amount)::NUMERIC(12,2) AS total_worker_amount
FROM public.repair_order_service_workers rosw
LEFT JOIN public.employees e ON e.id = rosw.worker_id
WHERE rosw.worker_id IN (
  'EMP-LABOR-DEMO-001',
  'EMP-LABOR-DEMO-002',
  'EMP-LABOR-DEMO-003'
)
GROUP BY rosw.worker_id, COALESCE(rosw.worker_name, e.name)
ORDER BY worker_name;
