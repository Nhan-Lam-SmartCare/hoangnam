# 🔧 Maintenance Scripts

Scripts để kiểm tra, debug và maintenance hệ thống.

## 📋 Phân loại Scripts

### 🔍 Check/Verify Scripts

**Database Schema:**

- **check-all-columns.mjs** - Kiểm tra tất cả columns trong database
- **check-columns.mjs** - Kiểm tra columns của bảng cụ thể
- **check-tables.mjs** - Kiểm tra cấu trúc tables
- **check-additional-services-column.mjs** - Check column additionalServices
- **check-vehicleid-column.mjs** - Check column vehicleId

**Authentication:**

- **check-auth-session.mjs** - Kiểm tra auth session
- **check-current-user.mjs** - Kiểm tra user hiện tại
- **check-user.mjs** - Kiểm tra thông tin user

**Data Integrity:**

- **check-debts.mjs** - Kiểm tra dữ liệu công nợ
- **check-sales.mjs** - Kiểm tra dữ liệu sales
- **check-stock-after-sale.mjs** - Kiểm tra tồn kho sau bán hàng
- **check-payment-methods.mjs** - Kiểm tra payment methods

**Functions:**

- **check-function.mjs** - Kiểm tra function cụ thể
- **check-functions.mjs** - Kiểm tra tất cả functions
- **check-sale-atomic.mjs** - Kiểm tra sale_create_atomic function
- **check-refund-function.mjs** - Kiểm tra refund function

**System Status:**

- **check-supabase-status.mjs** - Kiểm tra connection và status Supabase

### 🗑️ Cleanup Scripts

- **cleanup-test-data.mjs** - Xóa dữ liệu test
- **clear-all-data.mjs** - ⚠️ Xóa toàn bộ dữ liệu (NGUY HIỂM!)

### 📊 Data Export/Utility Scripts

- **export-revenue.mjs** - Export báo cáo doanh thu ra CSV
- **get-parts.mjs** - Lấy danh sách parts
- **get-sales-schema.mjs** - Lấy schema của bảng sales

## 🚀 Cách sử dụng

### Kiểm tra hệ thống

```bash
# Kiểm tra kết nối Supabase
node scripts/maintenance/check-supabase-status.mjs

# Kiểm tra tables
node scripts/maintenance/check-tables.mjs

# Kiểm tra auth
node scripts/maintenance/check-auth-session.mjs
```

### Debug vấn đề

```bash
# Kiểm tra tồn kho sau bán hàng
node scripts/maintenance/check-stock-after-sale.mjs

# Kiểm tra functions
node scripts/maintenance/check-functions.mjs

# Kiểm tra sales data
node scripts/maintenance/check-sales.mjs
```

### Cleanup dữ liệu test

```bash
# Xóa dữ liệu test (an toàn)
node scripts/maintenance/cleanup-test-data.mjs

# ⚠️ XÓA TOÀN BỘ - CHỈ DÙNG TRONG DEV!
node scripts/maintenance/clear-all-data.mjs
```

### Export dữ liệu

```bash
# Export báo cáo doanh thu
node scripts/maintenance/export-revenue.mjs
```

## ⚠️ Cảnh báo

### 🔴 Scripts nguy hiểm (chỉ dùng trong development):

- **clear-all-data.mjs** - Xóa TOÀN BỘ dữ liệu, không thể khôi phục!

### 🟡 Scripts cần thận trọng:

- **cleanup-test-data.mjs** - Xóa data có prefix TEST-, test-, kiểm tra kỹ trước khi chạy

### 🟢 Scripts an toàn (read-only):

- Tất cả check-\*.mjs scripts (chỉ đọc, không sửa đổi)
- get-\*.mjs scripts
- export-\*.mjs scripts

## 📝 Best Practices

1. **Trước khi chạy cleanup:**

   - Backup database
   - Chạy check scripts trước để xem sẽ xóa gì

2. **Khi debug:**

   - Chạy check-supabase-status.mjs trước
   - Kiểm tra logs trong console

3. **Khi export:**
   - Kiểm tra date range nếu có
   - Verify file output path

## 🔄 Workflow thường dùng

### Kiểm tra sức khỏe hệ thống:

```bash
node scripts/maintenance/check-supabase-status.mjs
node scripts/maintenance/check-tables.mjs
node scripts/maintenance/check-functions.mjs
```

### Debug lỗi bán hàng:

```bash
node scripts/maintenance/check-sales.mjs
node scripts/maintenance/check-stock-after-sale.mjs
node scripts/maintenance/check-sale-atomic.mjs
```

### Cleanup sau development:

```bash
node scripts/maintenance/cleanup-test-data.mjs
node scripts/maintenance/check-sales.mjs  # Verify
```
