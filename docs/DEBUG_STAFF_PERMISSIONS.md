# Debug Lỗi "Timeout/Mạng" cho User nguyenthanhloc28052007@gmail.com

**Ngày**: 2026-01-03  
**Vấn đề**: User staff không thể tạo phiếu sửa chữa, báo lỗi "Timeout/Mạng" mặc dù kết nối internet bình thường.

## 🔍 Nguyên nhân có thể

1. **User chưa được gán role/branch_id trong database**
2. **Token cũ không có thông tin branch mới** (cần logout/login lại)
3. **RLS policy chặn do branch mismatch**
4. **Function `mc_current_branch()` trả về NULL**

## ✅ Các bước khắc phục

### Bước 1: Chạy migration để cập nhật role

Chạy file SQL này trên Supabase Dashboard:

```bash
sql/2026-01-03_fix_staff_permissions.sql
```

Hoặc copy-paste vào SQL Editor trên Supabase:

### Bước 2: Kiểm tra thông tin user

Chạy script kiểm tra:

```bash
node scripts/test/check-user-info.mjs
```

Script này sẽ hiển thị:
- User ID
- Role (phải là 'staff')
- Branch ID (phải là 'CN1')
- Kết quả của `mc_current_branch()` (phải là 'CN1')
- Có đọc được work_orders không

### Bước 3: Yêu cầu user LOGOUT và LOGIN lại

**QUAN TRỌNG**: Sau khi cập nhật profile trong database, user PHẢI:

1. **Đăng xuất hoàn toàn** khỏi ứng dụng
2. **Xóa cache của trình duyệt** (hoặc trên mobile: xóa dữ liệu app)
3. **Đăng nhập lại** với email/password

Lý do: Token cũ không chứa thông tin role/branch mới, cần lấy token mới.

### Bước 4: Test lại việc tạo phiếu

Sau khi login lại, thử tạo phiếu mới. Nếu vẫn lỗi, kiểm tra console log:

1. Mở Developer Tools (F12)
2. Vào tab Console
3. Tạo phiếu sửa chữa
4. Xem error message chi tiết

Bây giờ thông báo lỗi sẽ rõ ràng hơn:
- ❌ "Bạn không có quyền tạo phiếu sửa chữa"
- ❌ "Chi nhánh không khớp"
- ❌ "Tồn kho không đủ"
- etc.

## 🔧 Thay đổi đã thực hiện

### 1. Cải thiện thông báo lỗi (WorkOrderMobileModal.tsx)

Thay vì thông báo chung chung "Timeout/Mạng", giờ sẽ hiển thị lỗi cụ thể:

```typescript
// Trước:
alert("Có lỗi khi lưu (Timeout/Mạng). Vui lòng thử lại hoặc chụp màn hình.");

// Sau:
if (msg.includes("UNAUTHORIZED")) {
  errorMessage = "❌ Bạn không có quyền tạo phiếu sửa chữa...";
} else if (msg.includes("BRANCH_MISMATCH")) {
  errorMessage = "❌ Chi nhánh không khớp...";
}
// ... các trường hợp khác
```

### 2. Thêm logging chi tiết

Console log giờ sẽ hiển thị đầy đủ:
- Error message
- Error code
- Error details
- Error hint

## 📊 Kiểm tra trực tiếp trên Supabase

Vào Supabase Dashboard → SQL Editor, chạy:

```sql
-- Kiểm tra profile của user
SELECT 
  id,
  email,
  role,
  branch_id,
  full_name,
  created_at
FROM public.profiles
WHERE email = 'nguyenthanhloc28052007@gmail.com';

-- Kỳ vọng:
-- role = 'staff'
-- branch_id = 'CN1'

-- Kiểm tra auth user
SELECT 
  id,
  email,
  email_confirmed_at
FROM auth.users
WHERE email = 'nguyenthanhloc28052007@gmail.com';

-- Nếu cần, cập nhật thủ công:
UPDATE public.profiles
SET role = 'staff', branch_id = 'CN1', updated_at = NOW()
WHERE email = 'nguyenthanhloc28052007@gmail.com';
```

## 🎯 Checklist

- [ ] Chạy migration `2026-01-03_fix_staff_permissions.sql`
- [ ] Chạy script kiểm tra `check-user-info.mjs`
- [ ] Xác nhận role = 'staff' và branch_id = 'CN1'
- [ ] Yêu cầu user LOGOUT
- [ ] Yêu cầu user xóa cache/dữ liệu app
- [ ] Yêu cầu user LOGIN lại
- [ ] Test tạo phiếu sửa chữa mới
- [ ] Kiểm tra console log nếu vẫn lỗi

## 🆘 Nếu vẫn không được

Nếu sau tất cả các bước trên vẫn lỗi, có thể là:

1. **RLS policy quá chặt**: Staff không được phép INSERT work_orders
   - Kiểm tra: `SELECT * FROM pg_policies WHERE tablename = 'work_orders';`
   - Policy phải cho phép: `branchId = mc_current_branch()`

2. **Function mc_current_branch() trả về NULL**
   - Test: `SELECT mc_current_branch();` (sau khi login)
   - Nếu NULL, kiểm tra function definition

3. **Session token bị cache ở client**
   - Hard refresh: Ctrl+Shift+R (PC) hoặc Cmd+Shift+R (Mac)
   - Hoặc xóa LocalStorage: `localStorage.clear()`

## 📞 Liên hệ

Nếu cần hỗ trợ thêm, cung cấp:
- Screenshot console log đầy đủ
- Kết quả của query kiểm tra profile
- Kết quả của `check-user-info.mjs`
