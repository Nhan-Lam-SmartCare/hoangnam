# Hướng dẫn triển khai Database cho Quản lý Vốn & Tài sản

## 📋 Tổng quan

Tài liệu này hướng dẫn cách triển khai cơ sở dữ liệu cho 2 chức năng mới:

1. **Quản lý Vốn đầu tư** (Capital Management)
2. **Quản lý Tài sản cố định** (Fixed Assets Management)

## 🗂️ File SQL cần chạy

```
sql/
├── 2025-11-24_capital_management.sql       # Quản lý vốn
└── 2025-11-24_fixed_assets_management.sql  # Quản lý tài sản cố định
```

## 🚀 Các bước triển khai

### Bước 1: Truy cập Supabase SQL Editor

1. Đăng nhập vào [Supabase Dashboard](https://app.supabase.com)
2. Chọn project của bạn
3. Vào **SQL Editor** ở menu bên trái

### Bước 2: Chạy file Capital Management

1. Mở file `sql/2025-11-24_capital_management.sql`
2. Copy toàn bộ nội dung
3. Paste vào SQL Editor trong Supabase
4. Click **Run** hoặc nhấn `Ctrl + Enter`

**Kết quả mong đợi:**

- ✅ Tạo bảng `capital`
- ✅ Tạo các indexes
- ✅ Thiết lập RLS policies
- ✅ Tạo view `capital_summary`
- ✅ Tạo trigger cho `updated_at`

### Bước 3: Chạy file Fixed Assets Management

1. Mở file `sql/2025-11-24_fixed_assets_management.sql`
2. Copy toàn bộ nội dung
3. Paste vào SQL Editor
4. Click **Run**

**Kết quả mong đợi:**

- ✅ Tạo bảng `fixed_assets`
- ✅ Tạo bảng `fixed_asset_depreciation`
- ✅ Tạo các indexes
- ✅ Thiết lập RLS policies
- ✅ Tạo views và functions
- ✅ Tạo trigger tự động tính khấu hao

### Bước 4: Verify Database

Kiểm tra các bảng đã được tạo thành công:

```sql
-- Kiểm tra bảng capital
SELECT * FROM capital LIMIT 1;

-- Kiểm tra bảng fixed_assets
SELECT * FROM fixed_assets LIMIT 1;

-- Kiểm tra views
SELECT * FROM capital_summary;
SELECT * FROM fixed_assets_summary;
```

## 📊 Cấu trúc Database

### 1. Capital (Vốn đầu tư)

**Bảng: `capital`**

```
- id (UUID)
- type (TEXT) → owner | investor | loan
- source_name (TEXT)
- amount (NUMERIC)
- date (TIMESTAMPTZ)
- notes (TEXT)
- interest_rate (NUMERIC) → Lãi suất %/năm
- interest_type (TEXT) → simple | compound
- payment_frequency (TEXT) → monthly | quarterly | yearly
- maturity_date (TIMESTAMPTZ)
- branch_id (TEXT)
- created_at, updated_at
```

**View: `capital_summary`**

- Tổng hợp vốn theo loại và chi nhánh

### 2. Fixed Assets (Tài sản cố định)

**Bảng: `fixed_assets`**

```
- id (UUID)
- name (TEXT)
- asset_type (TEXT) → equipment | vehicle | building | furniture | other
- purchase_date (TIMESTAMPTZ)
- purchase_price (NUMERIC)
- current_value (NUMERIC)
- depreciation_rate (NUMERIC)
- depreciation_method (TEXT) → straight-line | declining-balance
- useful_life (NUMERIC)
- status (TEXT) → active | disposed | maintenance
- location, serial_number, supplier, warranty
- notes (TEXT)
- branch_id (TEXT)
- created_at, updated_at
```

**Bảng: `fixed_asset_depreciation`**

```
- id (UUID)
- asset_id (UUID FK)
- year (INTEGER)
- month (INTEGER)
- depreciation_amount (NUMERIC)
- accumulated_depreciation (NUMERIC)
- book_value (NUMERIC)
- created_at
```

**Views:**

- `fixed_assets_summary` → Tổng hợp tài sản theo loại
- `fixed_assets_with_depreciation` → Chi tiết tài sản kèm khấu hao

**Functions:**

- `calculate_monthly_depreciation(asset_id, year, month)` → Tính khấu hao hàng tháng

## 🔐 Row Level Security (RLS)

### Capital

- **SELECT**: Owner & Manager
- **INSERT**: Owner & Manager
- **UPDATE**: Owner & Manager
- **DELETE**: Owner only

### Fixed Assets

- **SELECT**: Owner & Manager
- **INSERT**: Owner & Manager
- **UPDATE**: Owner & Manager
- **DELETE**: Owner only

## ⚡ Tính năng tự động

### 1. Auto Calculate Depreciation

Khi thêm/sửa tài sản, hệ thống tự động:

- Tính số năm đã sử dụng
- Tính khấu hao lũy kế
- Cập nhật giá trị hiện tại

### 2. Auto Update Timestamps

- Tự động cập nhật `updated_at` khi có thay đổi

## 📝 Ví dụ sử dụng

### Thêm vốn đầu tư

```sql
INSERT INTO capital (type, source_name, amount, date, interest_rate, interest_type, payment_frequency, maturity_date, branch_id)
VALUES (
  'investor',
  'Nhà đầu tư ABC',
  500000000,
  '2025-01-01',
  12.0,
  'simple',
  'quarterly',
  '2027-01-01',
  'CN1'
);
```

### Thêm tài sản cố định

```sql
INSERT INTO fixed_assets (
  name, asset_type, purchase_date, purchase_price,
  depreciation_rate, useful_life, status, branch_id
)
VALUES (
  'Máy rửa xe cao áp',
  'equipment',
  '2025-01-15',
  15000000,
  20.0,
  5,
  'active',
  'CN1'
);
-- Hệ thống tự động tính current_value
```

### Truy vấn báo cáo

```sql
-- Tổng vốn theo loại
SELECT * FROM capital_summary WHERE branch_id = 'CN1';

-- Tài sản cần bảo trì
SELECT * FROM fixed_assets
WHERE warranty < NOW()
AND status = 'active';

-- Tài sản đã khấu hao > 80%
SELECT * FROM fixed_assets_with_depreciation
WHERE depreciation_percentage > 80;
```

## 🧪 Test Data (Optional)

Chạy các lệnh sau để tạo dữ liệu mẫu:

```sql
-- Vốn chủ sở hữu
INSERT INTO capital (type, source_name, amount, date, branch_id)
VALUES ('owner', 'Vốn chủ - Nguyễn Văn A', 1000000000, '2024-01-01', 'CN1');

-- Vốn đầu tư có lãi suất
INSERT INTO capital (type, source_name, amount, date, interest_rate, interest_type, payment_frequency, maturity_date, branch_id)
VALUES ('investor', 'Nhà đầu tư XYZ', 500000000, '2024-06-01', 15.0, 'compound', 'monthly', '2026-06-01', 'CN1');

-- Máy móc thiết bị
INSERT INTO fixed_assets (name, asset_type, purchase_date, purchase_price, depreciation_rate, useful_life, status, serial_number, branch_id)
VALUES ('Máy nâng 2 trụ', 'equipment', '2023-01-01', 50000000, 20.0, 10, 'active', 'MN-2023-001', 'CN1');

-- Xe ô tô
INSERT INTO fixed_assets (name, asset_type, purchase_date, purchase_price, depreciation_rate, useful_life, status, serial_number, branch_id)
VALUES ('Toyota Camry 2023', 'vehicle', '2023-03-15', 1200000000, 15.0, 8, 'active', '51A-12345', 'CN1');
```

## ❓ Troubleshooting

### Lỗi: relation "user_profiles" does not exist

→ Chạy lại migration cho user authentication trước

### Lỗi: permission denied

→ Kiểm tra user có role Owner hoặc Manager

### Depreciation không tự động tính

→ Kiểm tra trigger đã được tạo:

```sql
SELECT * FROM pg_trigger WHERE tgname = 'calculate_depreciation_trigger';
```

## 📞 Hỗ trợ

Nếu gặp vấn đề trong quá trình triển khai:

1. Kiểm tra logs trong Supabase Dashboard
2. Verify RLS policies đã enable
3. Test với user có quyền Owner/Manager

---

✅ **Hoàn tất!** Database đã sẵn sàng cho chức năng Quản lý Vốn & Tài sản.
