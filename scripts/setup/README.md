# ⚙️ Setup Scripts

Scripts để khởi tạo và cấu hình hệ thống.

## 📋 Danh sách Scripts

### Database Setup

- **apply-sql.mjs** - Áp dụng SQL migrations lên Supabase
- **apply-sql-direct.mjs** - Áp dụng SQL trực tiếp không qua file

### Data Bootstrap

- **bootstrap-demo-users.mjs** - Tạo users demo để test
- **apply-vehicle-migration.mjs** - Migration dữ liệu xe

## 🚀 Cách sử dụng

### 1. Setup Database ban đầu

```bash
# Áp dụng tất cả migrations
node scripts/setup/apply-sql.mjs

# Áp dụng một file SQL cụ thể
node scripts/setup/apply-sql.mjs path/to/migration.sql
```

### 2. Tạo dữ liệu demo

```bash
# Tạo users demo (owner, manager, staff)
node scripts/setup/bootstrap-demo-users.mjs
```

### 3. Migration dữ liệu

```bash
# Migration dữ liệu xe từ hệ thống cũ
node scripts/setup/apply-vehicle-migration.mjs
```

## 📝 Thứ tự Setup (First Time)

1. **Cấu hình Supabase Project**

   - Tạo project trên Supabase
   - Copy URL và anon key

2. **Cấu hình Environment**

   ```bash
   # Tạo file .env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Chạy Migrations**

   ```bash
   node scripts/setup/apply-sql.mjs
   ```

4. **Tạo Users Demo**

   ```bash
   node scripts/setup/bootstrap-demo-users.mjs
   ```

5. **Kiểm tra Setup**
   ```bash
   node scripts/maintenance/check-supabase-status.mjs
   ```

## ⚠️ Lưu ý

- Chạy các scripts này theo thứ tự trên
- Backup database trước khi chạy migrations
- Demo users sẽ có password mặc định (xem trong script)
- Sau khi setup xong, đổi password cho các tài khoản quan trọng

## 🔐 Demo Users

Sau khi chạy `bootstrap-demo-users.mjs`:

| Email               | Role    | Password     |
| ------------------- | ------- | ------------ |
| owner@example.com   | owner   | (xem script) |
| manager@example.com | manager | (xem script) |
| staff@example.com   | staff   | (xem script) |
