# Hướng dẫn triển khai Mã phiếu bán hàng

## Tổng quan

Đã thêm mã phiếu bán hàng với định dạng **BH-YYYYMMDD-XXX** (ví dụ: `BH-20241117-001`)
lấy tiền tố từ cài đặt hệ thống trong bảng `store_settings`.

## Các thay đổi

### 1. Database Schema

- ✅ Thêm cột `sale_code` vào bảng `sales`
- ✅ Thêm cột `sale_prefix` vào bảng `store_settings` (mặc định: "BH")
- ✅ Tạo function `generate_sale_code()` để sinh mã tự động
- ✅ Tạo trigger tự động sinh mã khi insert sale mới
- ✅ Backfill mã cho các đơn hàng cũ

### 2. Backend

- ✅ Cập nhật function `sale_create_atomic` để tự động tạo mã khi tạo đơn

### 3. Frontend

- ✅ Thêm trường `sale_code?` vào interface `Sale`
- ✅ Hiển thị mã phiếu trong modal chi tiết đơn hàng
- ✅ Hiển thị mã phiếu trong modal chỉnh sửa
- ✅ Hiển thị mã phiếu trong danh sách lịch sử bán hàng
- ✅ Cập nhật tìm kiếm để tìm theo mã phiếu
- ✅ Sử dụng mã phiếu khi in hóa đơn

## Cách triển khai

### Bước 1: Chạy migration SQL

Chạy 2 file SQL theo thứ tự:

```bash
# File 1: Thêm cột sale_code và function generate_sale_code
node scripts/apply-sql.mjs sql/2025-11-17_add_sale_code_to_sales.sql

# File 2: Cập nhật function sale_create_atomic
node scripts/apply-sql.mjs sql/2025-11-17_update_sale_create_atomic_with_code.sql
```

### Bước 2: Kiểm tra kết quả

Sau khi chạy migration:

1. **Kiểm tra cột đã được thêm:**

```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'sales' AND column_name = 'sale_code';
```

2. **Kiểm tra function đã tồn tại:**

```sql
SELECT proname FROM pg_proc WHERE proname = 'generate_sale_code';
```

3. **Kiểm tra dữ liệu cũ đã có mã:**

```sql
SELECT id, sale_code, date
FROM sales
ORDER BY date DESC
LIMIT 10;
```

### Bước 3: Test tạo đơn hàng mới

Tạo một đơn hàng mới từ giao diện và kiểm tra:

- Mã phiếu hiển thị đúng định dạng `BH-20241117-XXX`
- Số thứ tự tăng dần trong cùng một ngày
- Mã phiếu hiển thị trong danh sách lịch sử
- Mã phiếu hiển thị khi in hóa đơn

## Tùy chỉnh tiền tố

Để thay đổi tiền tố từ "BH" sang giá trị khác:

```sql
UPDATE store_settings
SET sale_prefix = 'HD'  -- Hoặc 'DH', 'PB', etc.
WHERE id = (SELECT id FROM store_settings LIMIT 1);
```

## Format mã phiếu

- **Tiền tố**: Lấy từ `store_settings.sale_prefix` (mặc định: "BH")
- **Ngày**: YYYYMMDD (20241117)
- **Số thứ tự**: 3 chữ số (001, 002, 003...)
- **Ví dụ**: BH-20241117-001, BH-20241117-002, BH-20241118-001

## Lưu ý

- Mỗi ngày số thứ tự sẽ reset về 001
- Mã phiếu là duy nhất (UNIQUE constraint)
- Trigger tự động tạo mã nếu không cung cấp
- Các đơn hàng cũ đã được backfill với mã tương ứng với ngày tạo

## Troubleshooting

### Lỗi: "duplicate key value violates unique constraint"

Nguyên nhân: Có xung đột mã phiếu
Giải pháp: Hàm `generate_sale_code` sẽ tự động tìm số tiếp theo, không nên xảy ra lỗi này.

### Mã phiếu không hiển thị

1. Kiểm tra migration đã chạy thành công
2. Kiểm tra trigger đã được tạo:

```sql
SELECT tgname FROM pg_trigger WHERE tgname = 'trigger_set_sale_code';
```

3. Reload lại trang để lấy dữ liệu mới nhất
