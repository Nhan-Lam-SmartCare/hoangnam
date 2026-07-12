-- ============================================
-- SCRIPT KHỞI TẠO ĐẦY ĐỦ (FULL SETUP) - PHIÊN BẢN ĐIỆN TỬ
-- Bao gồm: Tạo bảng (Schema) + Dữ liệu mẫu (Seed Data)
-- Dành cho: Cửa hàng Sửa chữa Điện tử (Điện thoại, Máy tính, Điện máy)
-- ============================================

-- I. TẠO SCHEMA (CẤU TRÚC BẢNG)
-- --------------------------------------------

-- 1. Enable Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ⚠️ XÓA BẢNG CŨ ĐỂ RESET DỮ LIỆU (Tránh lỗi policy exists và dữ liệu cũ)
DROP TABLE IF EXISTS public.customer_debts CASCADE;
DROP TABLE IF EXISTS public.supplier_debts CASCADE;
DROP TABLE IF EXISTS public.repair_templates CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.store_settings CASCADE;
DROP TABLE IF EXISTS public.employees CASCADE;
DROP TABLE IF EXISTS public.suppliers CASCADE;
DROP TABLE IF EXISTS public.categories CASCADE;
DROP TABLE IF EXISTS public.work_orders CASCADE;
DROP TABLE IF EXISTS public.parts CASCADE;
DROP TABLE IF EXISTS public.customers CASCADE;

-- 2. Core Tables
CREATE TABLE IF NOT EXISTS public.customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  "totalSpent" NUMERIC DEFAULT 0,
  vehicles JSONB DEFAULT '[]'::jsonb, -- Lưu danh sách Thiết bị (Devices)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.parts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sku TEXT UNIQUE,
  category TEXT,
  description TEXT,
  stock JSONB DEFAULT '{}'::jsonb, -- {"CN1": 10}
  "retailPrice" JSONB DEFAULT '{}'::jsonb,
  "wholesalePrice" JSONB DEFAULT '{}'::jsonb,
  "costPrice" JSONB DEFAULT '{}'::jsonb,
  barcode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.work_orders (
  id TEXT PRIMARY KEY,
  "creationDate" TIMESTAMPTZ NOT NULL,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT,
  
  -- Tái sử dụng cột cũ cho HỆ ĐIỆN TỬ:
  "vehicleModel" TEXT, -- Tên thiết bị (VD: iPhone 13, Dell XPS)
  "licensePlate" TEXT, -- Serial Number / IMEI
  
  status TEXT NOT NULL DEFAULT 'Tiếp nhận',
  "laborCost" NUMERIC DEFAULT 0,
  discount NUMERIC DEFAULT 0,
  "partsUsed" JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  total NUMERIC DEFAULT 0,
  "branchId" TEXT NOT NULL DEFAULT 'CN1',
  
  -- Payment fields
  "paymentStatus" TEXT DEFAULT 'unpaid',
  "paymentMethod" TEXT,
  "totalPaid" NUMERIC DEFAULT 0,
  "remainingAmount" NUMERIC DEFAULT 0,
  "paymentDate" TIMESTAMPTZ,
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  icon TEXT,
  color TEXT,
  markup_percent INTEGER DEFAULT 50,
  rounding_rule TEXT DEFAULT 'integer',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.suppliers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.employees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  position TEXT, -- 'technician', 'manager'
  "base_salary" NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'active',
  "branchId" TEXT DEFAULT 'CN1',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.store_settings (
  id TEXT PRIMARY KEY DEFAULT 'default',
  "storeName" TEXT,
  "storeAddress" TEXT,
  "storePhone" TEXT,
  "storeEmail" TEXT,
  "bankName" TEXT,
  "bankAccount" TEXT,
  "bankAccountName" TEXT,
  "bankQrUrl" TEXT,
  "branchId" TEXT DEFAULT 'CN1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  role TEXT DEFAULT 'staff',
  name TEXT,
  full_name TEXT,
  avatar_url TEXT,
  branch_id TEXT DEFAULT 'CN1',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  data JSONB DEFAULT '{}'::jsonb,
  created_by UUID,
  recipient_id UUID,
  recipient_role TEXT,
  branch_id TEXT DEFAULT 'CN1',
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.repair_templates (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  branch_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  duration INTEGER DEFAULT 30,
  labor_cost NUMERIC DEFAULT 0,
  parts JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.customer_debts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  phone TEXT,
  license_plate TEXT,
  description TEXT,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  branch_id TEXT DEFAULT 'CN1',
  work_order_id TEXT,
  sale_id TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.supplier_debts (
  id TEXT PRIMARY KEY,
  supplier_id TEXT NOT NULL,
  supplier_name TEXT,
  description TEXT,
  total_amount NUMERIC DEFAULT 0,
  paid_amount NUMERIC DEFAULT 0,
  remaining_amount NUMERIC DEFAULT 0,
  created_date TIMESTAMPTZ DEFAULT NOW(),
  branch_id TEXT DEFAULT 'CN1',
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- II. CẤU HÌNH BẢO MẬT (RLS)
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all access for all users" ON public.customers FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.parts FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.work_orders FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.categories FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.suppliers FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.employees FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.store_settings FOR ALL USING (true);
CREATE POLICY "Enable all access for all users" ON public.inventory_transactions FOR ALL USING (true);


-- III. DỮ LIỆU MẪU (SEED DATA) - ĐIỆN TỬ
-- --------------------------------------------

-- 1. CÀI ĐẶT CỬA HÀNG
INSERT INTO public.store_settings (
  id,
  "storeName",
  "storeAddress",
  "storePhone",
  "storeEmail",
  "bankName",
  "bankAccount",
  "bankAccountName",
  "bankQrUrl",
  "updated_at"
) VALUES (
  'default',
  'TechCare Pro - Sửa chữa Điện tử & Máy tính',
  '456 Đường Công Nghệ, Quận 3, TP.HCM',
  '0988777666',
  'support@techcare.vn',
  'Techcombank',
  '19033334444',
  'NGUYEN CONG NGHE',
  NULL,
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  "storeName" = EXCLUDED."storeName",
  "storeAddress" = EXCLUDED."storeAddress",
  "storePhone" = EXCLUDED."storePhone";

-- 2. DANH MỤC LINH KIỆN
INSERT INTO public.categories (id, name, icon, color) VALUES
('cat-elec-01', 'Linh kiện Điện thoại', '📱', '#0ea5e9'), -- Sky
('cat-elec-02', 'Linh kiện Laptop/PC', '💻', '#6366f1'), -- Indigo
('cat-elec-03', 'Điện gia dụng', '🔌', '#f59e0b'), -- Amber
('cat-elec-04', 'Phụ kiện', '🎧', '#ec4899'), -- Pink
('cat-elec-05', 'Màn hình & Cảm ứng', '🖥️', '#10b981'), -- Emerald
('cat-elec-06', 'Pin & Nguồn', '🔋', '#dc2626')  -- Red
ON CONFLICT (id) DO NOTHING;

-- 3. NHÀ CUNG CẤP
INSERT INTO public.suppliers (id, name, phone, address, created_at) VALUES
('sup-e-01', 'Linh Kiện Tín Thành', '02839393939', 'Quận 10, TP.HCM', NOW()),
('sup-e-02', 'Viễn Thông A (Kho sỉ)', '0901222333', 'Quận 1, TP.HCM', NOW()),
('sup-e-03', 'Phụ tùng Điện Máy Xanh', '18001061', 'Thủ Đức', NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. KHO LINH KIỆN
INSERT INTO public.parts (id, name, sku, category, stock, "retailPrice", "costPrice", description, created_at) VALUES
-- Màn hình / Điện thoại
('part-e-001', 'Màn hình iPhone 13 Pro Max Zin', 'SCR-IP13PM', 'Màn hình & Cảm ứng', '{"CN1": 5}'::jsonb, '{"CN1": 8500000}'::jsonb, '{"CN1": 7200000}'::jsonb, 'Màn hình bóc máy chính hãng', NOW()),
('part-e-002', 'Màn hình Samsung S22 Ultra', 'SCR-S22U', 'Màn hình & Cảm ứng', '{"CN1": 3}'::jsonb, '{"CN1": 4800000}'::jsonb, '{"CN1": 4100000}'::jsonb, 'Màn hình hãng full khung', NOW()),

-- Pin
('part-e-003', 'Pin Pisen iPhone 11', 'BAT-IP11-P', 'Pin & Nguồn', '{"CN1": 20}'::jsonb, '{"CN1": 850000}'::jsonb, '{"CN1": 550000}'::jsonb, 'Pin dung lượng chuẩn', NOW()),
('part-e-004', 'Pin Laptop Dell XPS 13 9360', 'BAT-DELL-9360', 'Pin & Nguồn', '{"CN1": 8}'::jsonb, '{"CN1": 1250000}'::jsonb, '{"CN1": 950000}'::jsonb, 'Pin zin chính hãng Dell', NOW()),

-- Laptop/PC
('part-e-005', 'RAM DDR4 8GB 3200MHz Kingston', 'RAM-D4-8G', 'Linh kiện Laptop/PC', '{"CN1": 15}'::jsonb, '{"CN1": 750000}'::jsonb, '{"CN1": 550000}'::jsonb, 'RAM Laptop bảo hành 36 tháng', NOW()),
('part-e-006', 'SSD NVMe Samsung 980 500GB', 'SSD-SS-500', 'Linh kiện Laptop/PC', '{"CN1": 10}'::jsonb, '{"CN1": 1450000}'::jsonb, '{"CN1": 1100000}'::jsonb, 'Ổ cứng tốc độ cao', NOW()),

-- Điện gia dụng
('part-e-007', 'Tụ điện máy lạnh 35uF', 'TU-35UF', 'Điện gia dụng', '{"CN1": 30}'::jsonb, '{"CN1": 150000}'::jsonb, '{"CN1": 80000}'::jsonb, 'Tụ đề block máy lạnh', NOW()),
('part-e-008', 'Bo mạch máy giặt Toshiba A800', 'BOARD-TOS-A800', 'Điện gia dụng', '{"CN1": 4}'::jsonb, '{"CN1": 1200000}'::jsonb, '{"CN1": 900000}'::jsonb, 'Bo mạch điều khiển chính', NOW())
ON CONFLICT (id) DO NOTHING;

-- 5. KHÁCH HÀNG & THIẾT BỊ
INSERT INTO public.customers (id, name, phone, "totalSpent", created_at, vehicles) VALUES
('cust-e-01', 'Nguyễn Minh Tuấn', '0909888777', 9500000, NOW() - INTERVAL '15 days', 
  -- vehicles ở đây được dùng để lưu THIẾT BỊ
  -- model -> Tên máy
  -- licensePlate -> S/N hoặc IMEI
  '[{"id": "dev-01", "model": "iPhone 13 Pro Max", "licensePlate": "IMEI: 356789123456789", "currentKm": 0, "isPrimary": true}]'::jsonb
),
('cust-e-02', 'Lê Thị Thanh', '0912333444', 1850000, NOW() - INTERVAL '5 days',
  '[{"id": "dev-02", "model": "Laptop Dell XPS 15", "licensePlate": "SN: JF83H2X", "currentKm": 0, "isPrimary": true}]'::jsonb
),
('cust-e-03', 'Phạm Văn Ba', '0933555666', 450000, NOW() - INTERVAL '2 days',
  '[{"id": "dev-03", "model": "Nồi cơm điện Cuckoo", "licensePlate": "Model: CR-1055", "currentKm": 0, "isPrimary": true}]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 6. NHÂN VIÊN
INSERT INTO public.employees (id, name, phone, position, "base_salary", status, "branchId", created_at) VALUES
('emp-e-01', 'Trần Kỹ Thuật', '0901999888', 'KTV Điện thoại', 15000000, 'active', 'CN1', NOW()),
('emp-e-02', 'Phạm Điện Máy', '0902888777', 'KTV Điện lạnh', 12000000, 'active', 'CN1', NOW())
ON CONFLICT (id) DO NOTHING;

-- 7. PHIẾU SỬA CHỮA
-- Phiếu 1: Thay màn hình iPhone
INSERT INTO public.work_orders (
  id,
  "customerName",
  "customerPhone",
  "vehicleModel", -- Thiết bị
  "licensePlate", -- IMEI/SN
  status,
  "laborCost",
  discount,
  total,
  "paymentStatus",
  "branchId",
  "creationDate",
  "partsUsed", 
  notes
) VALUES (
  'WO-ELEC-001',
  'Nguyễn Minh Tuấn',
  '0909888777',
  'iPhone 13 Pro Max',
  'IMEI: 356789123456789',
  'Đã sửa xong', 
  500000, -- Công thay
  0,
  9000000, -- 500k + 8.5tr màn
  'paid',
  'CN1',
  NOW() - INTERVAL '2 days',
  '[{"partId": "part-e-001", "partName": "Màn hình iPhone 13 Pro Max Zin", "quantity": 1, "price": 8500000}]'::jsonb,
  'Máy rớt bể màn hình, sọc xanh'
),
-- Phiếu 2: Cài Win & Nâng cấp RAM Laptop
(
  'WO-ELEC-002',
  'Lê Thị Thanh',
  '0912333444',
  'Laptop Dell XPS 15',
  'SN: JF83H2X',
  'Đang sửa',
  150000, -- Công cài Win
  0,
  900000,
  'unpaid',
  'CN1',
  NOW() - INTERVAL '4 hours',
  '[{"partId": "part-e-005", "partName": "RAM DDR4 8GB 3200MHz Kingston", "quantity": 1, "price": 750000}]'::jsonb,
  'Nâng cấp RAM + Cài lại Windows 11'
),
-- Phiếu 3: Sửa nồi cơm điện
(
  'WO-ELEC-003',
  'Phạm Văn Ba',
  '0933555666',
  'Nồi cơm điện Cuckoo',
  'Model: CR-1055',
  'Tiếp nhận',
  0,
  0,
  0, -- Chưa báo giá
  'unpaid',
  'CN1',
  NOW() - INTERVAL '30 minutes',
  '[]'::jsonb,
  'Nồi không vào điện, kiểm tra nguồn'
)
ON CONFLICT (id) DO NOTHING;

SELECT 'Đã thiết lập dữ liệu Cửa hàng Điện tử thành công!' as "Thông báo";
