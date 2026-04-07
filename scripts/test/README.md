# 🧪 Test Scripts

Scripts để test các chức năng và logic của hệ thống.

## 📋 Danh sách Scripts

### Core CRUD Tests

- **test-crud.mjs** - Test CRUD operations cơ bản cho tất cả entities
- **test-crud-results.json** - Kết quả test CRUD

### Sales Tests

- **test-sales-logic.mjs** - Test logic tính toán bán hàng
- **test-sales-insert.mjs** - Test insert sales records
- **test-sale-atomic-direct.mjs** - Test sale atomic function trực tiếp
- **test-sale-now.mjs** - Test bán hàng realtime

### Service Tests

- **test-refund-workorder.mjs** - Test hoàn tiền phiếu sửa chữa
- **test-delete-with-restore.mjs** - Test xóa và khôi phục

### Inventory Tests

- **test-inventory-logic.mjs** - Test logic quản lý kho (FIFO/Moving Average)

### Security Tests

- **test-rls.mjs** - Test Row Level Security policies
- **test-login.mjs** - Test authentication

### Integration Tests

- **test-new-features.mjs** - Test các tính năng mới

## 🚀 Cách sử dụng

```bash
# Chạy một test cụ thể
node scripts/test/test-crud.mjs

# Chạy test sales logic
node scripts/test/test-sales-logic.mjs

# Chạy test inventory
node scripts/test/test-inventory-logic.mjs
```

## 📝 Lưu ý

- Đảm bảo đã cấu hình `.env` với Supabase credentials
- Các test có thể tạo dữ liệu test trong database
- Sử dụng `test-delete-with-restore.mjs` để cleanup sau khi test
- Test prefix: `TEST-`, `test-` để dễ phân biệt dữ liệu test

## 🔍 Test Coverage

| Module          | Status | Script                    |
| --------------- | ------ | ------------------------- |
| CRUD Operations | ✅     | test-crud.mjs             |
| Sales Logic     | ✅     | test-sales-logic.mjs      |
| Inventory       | ✅     | test-inventory-logic.mjs  |
| Work Orders     | ✅     | test-refund-workorder.mjs |
| Authentication  | ✅     | test-login.mjs            |
| RLS Policies    | ✅     | test-rls.mjs              |
