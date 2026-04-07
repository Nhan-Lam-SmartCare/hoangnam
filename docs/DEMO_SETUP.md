# Hướng dẫn Setup Database Demo

## Bước 1: Truy cập Supabase Demo

1. Mở https://supabase.com/dashboard
2. Chọn project **vljriacfxuvtzfbosebx** (motocare-demo)
3. Vào **SQL Editor**

## Bước 2: Chạy các SQL Scripts theo thứ tự

Copy và chạy từng file SQL theo thứ tự sau trong SQL Editor:

### Nhóm 1: Base Schema (BẮT BUỘC)
1. `sql/2025-11-10_schema_setup_clean.sql` - Tạo bảng cơ bản
2. `sql/2025-11-13_ALL_MISSING_TABLES.sql` - Bảng bổ sung
3. `sql/2025-11-13_employees_table.sql` - Bảng nhân viên
4. `sql/2025-11-13_debts_tables.sql` - Bảng công nợ

### Nhóm 2: Seed Data
5. `sql/2025-11-10_seed_roles.sql` - Tạo roles
6. `sql/2025-11-10_seed_owner_lam.sql` - Tạo user owner

### Nhóm 3: RLS & Functions
7. `sql/2025-11-10_rls_policies.sql` - Chính sách bảo mật
8. `sql/2025-11-13_disable_rls_user_profiles.sql` - (Tạm thời để test)

## Bước 3: Deploy lên Vercel

1. Push code lên repo demo:
```bash
git remote add demo https://github.com/Nhan-Lam-SmartCare/MotocarePro-demo.git
git push demo main
```

2. Truy cập https://vercel.com
3. Import repo `MotocarePro-demo`
4. Thêm Environment Variables:
   - `VITE_SUPABASE_URL` = https://vljriacfxuvtzfbosebx.supabase.co
   - `VITE_SUPABASE_ANON_KEY` = [anon key đã cung cấp]
5. Click Deploy

## Lưu ý

- File `.env.demo` đã được tạo sẵn với credentials demo
- Có thể copy nội dung vào Vercel env hoặc dùng local

---
*Tạo ngày: 2025-12-23*
