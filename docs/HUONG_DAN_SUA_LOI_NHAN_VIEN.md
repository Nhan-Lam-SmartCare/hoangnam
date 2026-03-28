# Hướng Dẫn Sửa Lỗi "Bạn không có quyền tạo phiếu sửa chữa"

## 🔍 Nguyên nhân

Lỗi này xảy ra khi:
1. Tài khoản nhân viên chưa có profile trong database
2. Profile không có `branch_id` (chi nhánh) được gán
3. Hàm `work_order_create_atomic` kiểm tra quyền và yêu cầu user phải có `branch_id`

## ✅ Cách Sửa

### Bước 1: Truy cập Supabase SQL Editor

1. Đăng nhập vào [Supabase Dashboard](https://supabase.com/dashboard)
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng database ở sidebar bên trái)

### Bước 2: Chạy Script Sửa Lỗi

Mở file `sql/2026-01-04_fix_staff_work_order_permission.sql` và chạy từng phần:

#### 2.1. Kiểm tra user hiện tại
```sql
SELECT 
  u.id,
  u.email,
  u.email_confirmed_at,
  p.role,
  p.branch_id,
  p.full_name
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email LIKE '%@gmail.com'
ORDER BY u.created_at DESC
LIMIT 20;
```

**Kết quả mong đợi:** Bạn sẽ thấy danh sách user. Nếu cột `branch_id` là `NULL`, đó là nguyên nhân lỗi.

#### 2.2. Tự động tạo/cập nhật profile cho tất cả user
```sql
INSERT INTO public.profiles (id, email, role, branch_id, full_name, created_at, updated_at)
SELECT 
  u.id,
  u.email,
  COALESCE(p.role, 'staff') as role,
  COALESCE(p.branch_id, 'CN1') as branch_id,
  COALESCE(p.full_name, SPLIT_PART(u.email, '@', 1)) as full_name,
  NOW(),
  NOW()
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email_confirmed_at IS NOT NULL
ON CONFLICT (id) 
DO UPDATE SET
  branch_id = COALESCE(EXCLUDED.branch_id, profiles.branch_id, 'CN1'),
  role = COALESCE(profiles.role, 'staff'),
  updated_at = NOW();
```

**Giải thích:** 
- Script này sẽ tự động tạo profile cho user chưa có
- Gán `branch_id = 'CN1'` (Chi nhánh 1) cho user chưa có chi nhánh
- Gán `role = 'staff'` cho user chưa có vai trò

#### 2.3. Xác nhận đã sửa thành công
```sql
SELECT 
  COUNT(*) as total_users,
  COUNT(p.branch_id) as users_with_branch,
  COUNT(*) - COUNT(p.branch_id) as users_without_branch
FROM auth.users u
LEFT JOIN public.profiles p ON u.id = p.id
WHERE u.email_confirmed_at IS NOT NULL;
```

**Kết quả mong đợi:** `users_without_branch` phải bằng `0`

### Bước 3: Cấp Quyền Cho Nhân Viên Cụ Thể

Nếu bạn muốn gán chi nhánh cụ thể cho từng nhân viên:

```sql
-- Thay 'email@example.com' bằng email của nhân viên
-- Thay 'CN1' bằng mã chi nhánh (CN1, CN2, etc.)
UPDATE public.profiles
SET 
  branch_id = 'CN1',
  role = 'staff',
  full_name = 'Tên Nhân Viên',
  updated_at = NOW()
WHERE email = 'email@example.com';
```

### Bước 4: Kiểm tra RLS Policies

Đảm bảo RLS policies cho phép staff tạo work orders:

```sql
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'work_orders'
ORDER BY policyname;
```

## 🧪 Kiểm Tra Sau Khi Sửa

1. Đăng xuất khỏi ứng dụng
2. Đăng nhập lại bằng tài khoản nhân viên
3. Thử tạo phiếu sửa chữa mới
4. Lỗi sẽ biến mất!

## 📋 Thông Tin Chi Nhánh

Các mã chi nhánh có sẵn:
- `CN1` - Chi nhánh 1 (mặc định)
- `CN2` - Chi nhánh 2
- `CN3` - Chi nhánh 3

## ⚠️ Lưu Ý Quan Trọng

1. **Backup trước khi chạy:** Luôn backup database trước khi chạy script SQL
2. **Kiểm tra kỹ email:** Đảm bảo email trong script khớp với email user thực tế
3. **Chi nhánh đúng:** Gán đúng chi nhánh cho từng nhân viên
4. **Vai trò phù hợp:** Các vai trò có sẵn:
   - `owner` - Chủ cửa hàng (full quyền)
   - `manager` - Quản lý (hầu hết quyền)
   - `staff` - Nhân viên (quyền cơ bản)

## 🔧 Troubleshooting

### Vẫn còn lỗi sau khi chạy script?

1. **Kiểm tra console log:**
   - Mở DevTools (F12)
   - Xem tab Console
   - Tìm thông báo lỗi chi tiết

2. **Kiểm tra profile:**
```sql
SELECT * FROM public.profiles 
WHERE email = 'email_cua_nhan_vien@gmail.com';
```

3. **Kiểm tra auth.uid():**
```sql
SELECT auth.uid();
```
Nếu trả về `NULL`, user chưa đăng nhập đúng cách.

4. **Xóa cache và đăng nhập lại:**
   - Clear browser cache
   - Đăng xuất hoàn toàn
   - Đăng nhập lại

## 📞 Liên Hệ Hỗ Trợ

Nếu vẫn gặp vấn đề, vui lòng cung cấp:
1. Email của nhân viên gặp lỗi
2. Screenshot lỗi từ Console (F12)
3. Kết quả của query kiểm tra profile
