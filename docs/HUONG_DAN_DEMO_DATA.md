# Hướng dẫn thêm dữ liệu Demo

## 📋 Tổng quan

File này hướng dẫn cách thêm dữ liệu mẫu vào bản demo để khách hàng dễ xem và trải nghiệm.

## 🎯 Bước 1: Truy cập Supabase Demo

1. Mở https://supabase.com/dashboard
2. Chọn project **vljriacfxuvtzfbosebx** (motocare-demo)
3. Vào **SQL Editor**

## 📦 Bước 2: Chạy Script Dữ liệu Demo

Copy toàn bộ nội dung file `sql/DEMO_SAMPLE_DATA.sql` và chạy trong SQL Editor.

File này sẽ tạo:
- ✅ **8 khách hàng mẫu** với số điện thoại
- ✅ **8 danh mục phụ tùng** (Nhớt, Lọc gió, Bugi, Dây curoa, Bố thắng, Lốp xe, Ắc quy, Đèn xe)
- ✅ **16 phụ tùng mẫu** với đầy đủ thông tin kho, giá, SKU

## 🔧 Bước 3: Thêm dữ liệu nâng cao (Tùy chọn)

### 3.1. Thêm Nhà cung cấp

```sql
INSERT INTO public.suppliers (id, name, phone, address, email) VALUES
('sup-demo-001', 'Công ty TNHH Phụ Tùng Hồng Hà', '0281234567', '123 Nguyễn Văn Linh, Q.7, TP.HCM', 'contact@honghaauto.vn'),
('sup-demo-002', 'Công ty CP Phát Thịnh', '0282345678', '456 Lê Văn Việt, Q.9, TP.HCM', 'info@phatthinhparts.vn'),
('sup-demo-003', 'Đại lý Honda chính hãng', '0283456789', '789 Quốc lộ 1A, Bình Tân, TP.HCM', 'honda@dealer.vn')
ON CONFLICT (id) DO NOTHING;
```

### 3.2. Thêm Nhân viên

```sql
INSERT INTO public.employees (id, name, phone, role, salary, "branchId", active) VALUES
('emp-demo-001', 'Nguyễn Văn Tài', '0909111222', 'technician', 8000000, 'CN1', true),
('emp-demo-002', 'Trần Minh Tuấn', '0909333444', 'technician', 7500000, 'CN1', true),
('emp-demo-003', 'Lê Thị Hoa', '0909555666', 'cashier', 6000000, 'CN1', true)
ON CONFLICT (id) DO NOTHING;
```

### 3.3. Thêm Cài đặt cửa hàng

```sql
INSERT INTO public.store_settings (
  id, 
  "storeName", 
  "storeAddress", 
  "storePhone", 
  "storeEmail",
  "bankName",
  "bankAccount",
  "bankAccountName"
) VALUES (
  'default',
  'Motocare Demo - Trung tâm sửa chữa xe máy',
  '123 Nguyễn Huệ, Quận 1, TP.HCM',
  '0281234567',
  'demo@motocare.vn',
  'Vietcombank',
  '1234567890',
  'CONG TY TNHH MOTOCARE'
)
ON CONFLICT (id) DO UPDATE SET
  "storeName" = EXCLUDED."storeName",
  "storeAddress" = EXCLUDED."storeAddress",
  "storePhone" = EXCLUDED."storePhone",
  "storeEmail" = EXCLUDED."storeEmail",
  "bankName" = EXCLUDED."bankName",
  "bankAccount" = EXCLUDED."bankAccount",
  "bankAccountName" = EXCLUDED."bankAccountName";
```

## 📊 Bước 4: Tạo dữ liệu giao dịch mẫu (Tùy chọn)

### 4.1. Tạo phiếu sửa chữa mẫu

```sql
-- Phiếu sửa chữa đã hoàn thành
INSERT INTO public.work_orders (
  id,
  "customerName",
  "customerPhone",
  "vehiclePlate",
  "vehicleModel",
  "partsUsed",
  "additionalServices",
  "totalAmount",
  "paidAmount",
  "paymentStatus",
  status,
  "createdAt",
  "updatedAt"
) VALUES
(
  'WO-DEMO-001',
  'Nguyễn Văn An',
  '0901234567',
  '59-A1 12345',
  'Honda Air Blade 125',
  '[{"id": "part-demo-001", "name": "Nhớt Castrol Power1 10W40 0.8L", "quantity": 1, "price": 120000, "costPrice": 90000}]'::jsonb,
  '[{"name": "Thay nhớt", "price": 50000, "costPrice": 30000}]'::jsonb,
  170000,
  170000,
  'paid',
  'completed',
  NOW() - INTERVAL '7 days',
  NOW() - INTERVAL '7 days'
),
(
  'WO-DEMO-002',
  'Trần Thị Bình',
  '0912345678',
  '59-B2 67890',
  'Yamaha NVX 155',
  '[{"id": "part-demo-009", "name": "Dây curoa Air Blade 125", "quantity": 1, "price": 380000, "costPrice": 300000}]'::jsonb,
  '[{"name": "Thay dây curoa", "price": 100000, "costPrice": 60000}, {"name": "Kiểm tra hệ thống truyền động", "price": 0, "costPrice": 0}]'::jsonb,
  480000,
  480000,
  'paid',
  'completed',
  NOW() - INTERVAL '5 days',
  NOW() - INTERVAL '5 days'
),
(
  'WO-DEMO-003',
  'Lê Hoàng Cường',
  '0923456789',
  '59-C3 11111',
  'Honda Winner X',
  '[{"id": "part-demo-008", "name": "Bugi Denso Iridium", "quantity": 1, "price": 180000, "costPrice": 140000}]'::jsonb,
  '[{"name": "Thay bugi", "price": 30000, "costPrice": 20000}, {"name": "Vệ sinh kim phun xăng", "price": 120000, "costPrice": 80000}]'::jsonb,
  330000,
  200000,
  'partial',
  'completed',
  NOW() - INTERVAL '3 days',
  NOW() - INTERVAL '3 days'
)
ON CONFLICT (id) DO NOTHING;
```

### 4.2. Tạo hóa đơn bán lẻ mẫu

```sql
-- Hóa đơn bán phụ tùng lẻ
INSERT INTO public.sales (
  id,
  "saleCode",
  items,
  "totalAmount",
  "paidAmount",
  "paymentMethod",
  "customerName",
  "customerPhone",
  status,
  "createdAt"
) VALUES
(
  'SALE-DEMO-001',
  'BH001',
  '[{"id": "part-demo-007", "name": "Bugi NGK CPR8EA-9", "quantity": 2, "price": 35000, "costPrice": 25000}]'::jsonb,
  70000,
  70000,
  'cash',
  'Phạm Minh Đức',
  '0934567890',
  'completed',
  NOW() - INTERVAL '2 days'
),
(
  'SALE-DEMO-002',
  'BH002',
  '[{"id": "part-demo-002", "name": "Nhớt Shell Advance AX7 1L", "quantity": 1, "price": 145000, "costPrice": 110000}]'::jsonb,
  145000,
  145000,
  'bank_transfer',
  'Hoàng Thị Em',
  '0945678901',
  'completed',
  NOW() - INTERVAL '1 day'
)
ON CONFLICT (id) DO NOTHING;
```

## ✅ Bước 5: Xác nhận dữ liệu

Chạy query sau để kiểm tra:

```sql
-- Thống kê dữ liệu demo
SELECT 
  'Khách hàng' as type, COUNT(*)::text as count FROM customers WHERE id LIKE 'cust-demo%'
UNION ALL
SELECT 'Danh mục', COUNT(*)::text FROM categories WHERE id LIKE 'cat-demo%'
UNION ALL
SELECT 'Phụ tùng', COUNT(*)::text FROM parts WHERE id LIKE 'part-demo%'
UNION ALL
SELECT 'Phiếu sửa chữa', COUNT(*)::text FROM work_orders WHERE id LIKE 'WO-DEMO%'
UNION ALL
SELECT 'Hóa đơn bán lẻ', COUNT(*)::text FROM sales WHERE id LIKE 'SALE-DEMO%';
```

Kết quả mong đợi:
- ✅ Khách hàng: 8
- ✅ Danh mục: 8
- ✅ Phụ tùng: 16
- ✅ Phiếu sửa chữa: 3 (nếu chạy bước 4.1)
- ✅ Hóa đơn bán lẻ: 2 (nếu chạy bước 4.2)

## 🎨 Bước 6: Tùy chỉnh dữ liệu

Bạn có thể chỉnh sửa:
- Tên khách hàng, số điện thoại
- Tên phụ tùng, giá bán
- Số lượng tồn kho
- Thông tin cửa hàng

Lưu ý: Các ID có prefix `demo` để dễ xóa khi cần:
```sql
-- Xóa tất cả dữ liệu demo
DELETE FROM work_orders WHERE id LIKE 'WO-DEMO%';
DELETE FROM sales WHERE id LIKE 'SALE-DEMO%';
DELETE FROM parts WHERE id LIKE 'part-demo%';
DELETE FROM categories WHERE id LIKE 'cat-demo%';
DELETE FROM customers WHERE id LIKE 'cust-demo%';
```

## 🚀 Hoàn tất!

Sau khi setup xong, bản demo sẽ có đầy đủ dữ liệu để:
- ✅ Khách hàng xem danh sách sản phẩm đa dạng
- ✅ Thực hiện thao tác tạo phiếu sửa chữa
- ✅ Tìm kiếm và quản lý khách hàng
- ✅ Xem báo cáo và thống kê có ý nghĩa

---
*Cập nhật: 2026-01-10*
