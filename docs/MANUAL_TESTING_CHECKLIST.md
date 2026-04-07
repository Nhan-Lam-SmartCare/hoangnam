# ✅ MANUAL TESTING CHECKLIST

## 🎯 Mục đích

Kiểm tra thủ công các tính năng vừa implement trên giao diện người dùng để đảm bảo:

- UI hoạt động mượt mà
- Data được lưu và hiển thị chính xác
- Error handling hoạt động đúng
- Loading states hiển thị đúng

---

## 1️⃣ KIỂM TRA CÔNG NỢ (Debt Manager)

### ✅ Công nợ Khách hàng:

**Test Case 1: Thêm công nợ mới**

- [ ] Vào trang **Công nợ** → Tab **Khách hàng**
- [ ] Click nút **"Thu nợ"** hoặc tương tự
- [ ] Nhập thông tin:
  - Tên khách hàng: "Test Customer"
  - SĐT: "0909123456"
  - Biển số: "29A-12345"
  - Mô tả: "Công nợ test"
  - Số tiền: 1,000,000đ
- [ ] Click **"Lưu"**
- [ ] ✅ Kiểm tra: Toast thành công xuất hiện
- [ ] ✅ Kiểm tra: Công nợ mới xuất hiện trong danh sách
- [ ] ✅ Kiểm tra: Refresh trang → data vẫn còn

**Test Case 2: Thanh toán công nợ**

- [ ] Tick chọn 1 công nợ
- [ ] Click **"Thanh toán"**
- [ ] Chọn phương thức: Tiền mặt
- [ ] Xác nhận thanh toán
- [ ] ✅ Kiểm tra: Số tiền "Còn nợ" giảm xuống 0
- [ ] ✅ Kiểm tra: Công nợ được đánh dấu đã thanh toán

**Test Case 3: Tìm kiếm**

- [ ] Nhập SĐT vào ô tìm kiếm
- [ ] ✅ Kiểm tra: Chỉ hiển thị công nợ của khách hàng đó

### ✅ Công nợ Nhà cung cấp:

**Test Case 4: Thêm công nợ NCC**

- [ ] Chuyển sang tab **Nhà cung cấp**
- [ ] Thêm công nợ mới với:
  - Tên NCC: "Test Supplier"
  - Mô tả: "Test supplier debt"
  - Số tiền: 5,000,000đ
- [ ] ✅ Kiểm tra: Data được lưu và hiển thị đúng

---

## 2️⃣ KIỂM TRA VAY NỢ (Loans Manager)

### ✅ Quản lý khoản vay:

**Test Case 5: Thêm khoản vay mới**

- [ ] Vào trang **Tài chính** → Tab **Vay nợ**
- [ ] Click **"Thêm khoản vay"**
- [ ] Nhập thông tin:
  - Người cho vay: "Ngân hàng ABC"
  - Loại vay: Chọn "Ngân hàng"
  - Số tiền gốc: 100,000,000đ
  - Lãi suất: 8.5%
  - Kỳ hạn: 12 tháng
  - Ngày bắt đầu: Hôm nay
  - Ngày kết thúc: 1 năm sau
  - Trả hàng tháng: 8,700,000đ
- [ ] Click **"Lưu"**
- [ ] ✅ Kiểm tra: Toast "Đã thêm khoản vay thành công"
- [ ] ✅ Kiểm tra: Khoản vay xuất hiện trong danh sách **"Đang vay"**
- [ ] ✅ Kiểm tra: Card hiển thị đầy đủ thông tin

**Test Case 6: Thanh toán khoản vay**

- [ ] Click **"Thanh toán"** trên card khoản vay vừa tạo
- [ ] Nhập:
  - Số tiền gốc: 7,000,000đ
  - Số tiền lãi: 700,000đ
  - Phương thức: Tiền mặt
  - Ghi chú: "Trả tháng 1"
- [ ] Click **"Xác nhận"**
- [ ] ✅ Kiểm tra: Toast "Đã ghi nhận thanh toán thành công"
- [ ] ✅ Kiểm tra: Số tiền còn nợ giảm xuống 93,000,000đ
- [ ] ✅ Kiểm tra: Refresh trang → data vẫn đúng

**Test Case 7: Kiểm tra thống kê**

- [ ] ✅ Kiểm tra card "Tổng vay" hiển thị đúng
- [ ] ✅ Kiểm tra card "Còn nợ" hiển thị đúng
- [ ] ✅ Kiểm tra card "Đã trả" hiển thị đúng
- [ ] ✅ Kiểm tra số lượng "Khoản vay đang hoạt động"

---

## 3️⃣ KIỂM TRA NHÂN VIÊN (Employees)

### ✅ Quản lý nhân viên:

**Test Case 8: Thêm nhân viên mới**

- [ ] Vào trang **Nhân viên**
- [ ] Click **"Thêm nhân viên"**
- [ ] Nhập thông tin:
  - Họ tên: "Nguyễn Văn Test"
  - SĐT: "0909888777"
  - Email: "test@example.com"
  - Chức vụ: "Nhân viên"
  - Phòng ban: "Kỹ thuật"
  - Lương cơ bản: 10,000,000đ
  - Ngày vào làm: Hôm nay
  - Trạng thái: "Đang làm việc"
- [ ] Click **"Lưu"**
- [ ] ✅ Kiểm tra: Toast thành công
- [ ] ✅ Kiểm tra: Nhân viên xuất hiện trong danh sách
- [ ] ✅ Kiểm tra: Refresh trang → nhân viên vẫn còn

**Test Case 9: Sửa thông tin nhân viên**

- [ ] Click icon **"Sửa"** trên nhân viên vừa tạo
- [ ] Thay đổi lương thành 12,000,000đ
- [ ] Click **"Cập nhật"**
- [ ] ✅ Kiểm tra: Lương mới hiển thị đúng

**Test Case 10: Xóa nhân viên**

- [ ] Click icon **"Xóa"**
- [ ] Xác nhận xóa
- [ ] ✅ Kiểm tra: Nhân viên biến mất khỏi danh sách

**Test Case 11: Tìm kiếm nhân viên**

- [ ] Nhập tên hoặc SĐT vào ô tìm kiếm
- [ ] ✅ Kiểm tra: Chỉ hiển thị nhân viên đúng

---

## 4️⃣ KIỂM TRA SỬA CHỮA (Service Orders)

### ✅ Phiếu sửa chữa (đã có sẵn, test lại):

**Test Case 12: Tạo phiếu sửa chữa**

- [ ] Vào trang **Sửa chữa**
- [ ] Click **"Tạo phiếu mới"**
- [ ] Nhập đầy đủ thông tin
- [ ] Chọn phụ tùng
- [ ] ✅ Kiểm tra: Validation hoạt động (không cho submit nếu thiếu thông tin)
- [ ] Lưu phiếu
- [ ] ✅ Kiểm tra: Phiếu được tạo thành công
- [ ] ✅ Kiểm tra: Tồn kho phụ tùng giảm đúng

**Test Case 13: Hoàn tiền phiếu sửa chữa**

- [ ] Click **"Hoàn tiền"** trên 1 phiếu
- [ ] Nhập lý do hoàn tiền
- [ ] Xác nhận
- [ ] ✅ Kiểm tra: Toast thành công
- [ ] ✅ Kiểm tra: Tồn kho được khôi phục
- [ ] ✅ Kiểm tra: Phiếu hiển thị trạng thái "Đã hoàn tiền"

---

## 5️⃣ KIỂM TRA DATA PERSISTENCE

### ✅ Kiểm tra dữ liệu lưu bền vững:

**Test Case 14: Hard Refresh**

- [ ] Thực hiện các thao tác thêm/sửa/xóa ở trên
- [ ] Nhấn **Ctrl + Shift + R** (hard refresh)
- [ ] ✅ Kiểm tra: Tất cả data vẫn còn nguyên
- [ ] ✅ Kiểm tra: Không có data bị mất

**Test Case 15: Close & Reopen Browser**

- [ ] Đóng hoàn toàn trình duyệt
- [ ] Mở lại và đăng nhập
- [ ] ✅ Kiểm tra: Data vẫn còn đầy đủ

**Test Case 16: Check Supabase directly**

- [ ] Vào Supabase Dashboard
- [ ] Mở Table Editor
- [ ] Kiểm tra tables:
  - `customer_debts` → ✅ Có data
  - `supplier_debts` → ✅ Có data
  - `loans` → ✅ Có data
  - `loan_payments` → ✅ Có data
  - `employees` → ✅ Có data

---

## 6️⃣ KIỂM TRA ERROR HANDLING

### ✅ Kiểm tra xử lý lỗi:

**Test Case 17: Network Error Simulation**

- [ ] Mở DevTools → Network tab
- [ ] Set throttling to "Offline"
- [ ] Thử thêm 1 record mới
- [ ] ✅ Kiểm tra: Toast lỗi xuất hiện
- [ ] ✅ Kiểm tra: Loading state kết thúc
- [ ] Bật lại network
- [ ] Retry
- [ ] ✅ Kiểm tra: Thao tác thành công

**Test Case 18: Invalid Data**

- [ ] Thử nhập số tiền âm
- [ ] Thử bỏ trống các field required
- [ ] ✅ Kiểm tra: Validation ngăn không cho submit
- [ ] ✅ Kiểm tra: Hiển thị message lỗi rõ ràng

---

## 7️⃣ KIỂM TRA UI/UX

### ✅ Trải nghiệm người dùng:

**Test Case 19: Loading States**

- [ ] ✅ Loading spinner hiển thị khi fetch data
- [ ] ✅ Button disabled khi đang submit
- [ ] ✅ Skeleton loader (nếu có) hoạt động mượt

**Test Case 20: Toast Messages**

- [ ] ✅ Toast thành công: màu xanh, icon ✓
- [ ] ✅ Toast lỗi: màu đỏ, icon ✗
- [ ] ✅ Toast tự động biến mất sau vài giây

**Test Case 21: Responsive**

- [ ] Resize browser window
- [ ] ✅ Layout vẫn đẹp ở nhiều kích thước màn hình

---

## 📊 KẾT QUẢ TESTING

### Summary:

- **Total Test Cases**: 21
- **Passed**: **\_** / 21
- **Failed**: **\_** / 21
- **Issues Found**: **\_**

### Issues/Bugs Found:

1. ***
2. ***
3. ***

### Notes:

- ***
- ***

---

## ✅ SIGN-OFF

**Tested by**: **********\_**********  
**Date**: **********\_**********  
**Status**: [ ] Ready for Production / [ ] Needs Fixes

---

## 🔍 ADDITIONAL CHECKS (Optional)

**Performance**:

- [ ] Page load < 3s
- [ ] Query response < 500ms
- [ ] No memory leaks

**Security**:

- [ ] RLS policies enabled (when ready)
- [ ] No sensitive data in console
- [ ] Auth tokens secure

**Accessibility**:

- [ ] Keyboard navigation works
- [ ] Screen reader friendly
- [ ] Color contrast OK
