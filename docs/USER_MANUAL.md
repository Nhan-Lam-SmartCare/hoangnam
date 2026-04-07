# Hướng dẫn Sử dụng Motocare

> **Phiên bản**: 1.3.0  
> **Cập nhật**: 23/11/2025  
> **Đối tượng**: Chủ cửa hàng, Quản lý, Nhân viên

---

## 📚 Mục lục

1. [Giới thiệu](#1-giới-thiệu)
2. [Đăng nhập và Quản lý Tài khoản](#2-đăng-nhập-và-quản-lý-tài-khoản)
3. [Dashboard - Tổng quan](#3-dashboard---tổng-quan)
4. [Bán hàng](#4-bán-hàng)
5. [Sửa chữa](#5-sửa-chữa)
6. [Quản lý Kho](#6-quản-lý-kho)
7. [Quản lý Khách hàng](#7-quản-lý-khách-hàng)
8. [Công nợ](#8-công-nợ)
9. [Tài chính](#9-tài-chính)
10. [Nhân viên](#10-nhân-viên)
11. [Báo cáo](#11-báo-cáo)
12. [Tips và Tricks](#12-tips-và-tricks)
13. [FAQs](#13-faqs)

---

## 1. Giới thiệu

### 1.1 Motocare là gì?

Motocare là hệ thống quản lý toàn diện dành cho cửa hàng xe máy, bao gồm:

- ✅ Bán phụ tùng
- ✅ Dịch vụ sửa chữa
- ✅ Quản lý kho hàng
- ✅ Quản lý tài chính
- ✅ Báo cáo kinh doanh

### 1.2 Vai trò Người dùng

| Vai trò     | Quyền hạn                                |
| ----------- | ---------------------------------------- |
| **Owner**   | Full quyền: Xem, thêm, sửa, xóa tất cả   |
| **Manager** | Quản lý: Xem, thêm, sửa (không xóa)      |
| **Staff**   | Nhân viên: Xem, thêm đơn hàng (giới hạn) |

### 1.3 Yêu cầu Hệ thống

- **Trình duyệt**: Chrome, Firefox, Edge (phiên bản mới nhất)
- **Kết nối Internet**: Stable connection (tốc độ tối thiểu 2Mbps)
- **Màn hình**: Tối thiểu 1366x768px

---

## 2. Đăng nhập và Quản lý Tài khoản

### 2.1 Đăng nhập

**Bước 1**: Truy cập URL của hệ thống (ví dụ: `https://motocare.yourdomain.com`)

**Bước 2**: Nhập thông tin:

```
Email: your-email@example.com
Password: ********
```

**Bước 3**: Click **"Đăng nhập"**

> ⚠️ **Lưu ý**: Sau 3 lần đăng nhập sai, tài khoản sẽ bị khóa 15 phút.

### 2.2 Quên mật khẩu

**Bước 1**: Click **"Quên mật khẩu?"** trên màn hình đăng nhập

**Bước 2**: Nhập email đã đăng ký

**Bước 3**: Kiểm tra email và click link reset password

**Bước 4**: Nhập mật khẩu mới (tối thiểu 8 ký tự)

### 2.3 Đổi mật khẩu

**Bước 1**: Click vào **Avatar** → **"Cài đặt"**

**Bước 2**: Chọn **"Đổi mật khẩu"**

**Bước 3**: Nhập:

- Mật khẩu cũ
- Mật khẩu mới
- Xác nhận mật khẩu mới

**Bước 4**: Click **"Cập nhật"**

---

## 3. Dashboard - Tổng quan

### 3.1 Thống kê Nhanh

Dashboard hiển thị 4 thẻ thống kê chính:

1. **Doanh thu hôm nay**

   - Tổng doanh thu từ bán hàng + sửa chữa
   - So sánh với hôm qua (% tăng/giảm)

2. **Chi phí hôm nay**

   - Tổng chi phí (nhập hàng, chi phí khác)
   - Tỷ lệ chi phí/doanh thu

3. **Lợi nhuận hôm nay**

   - Doanh thu - Chi phí
   - Biên lợi nhuận (%)

4. **Tồn kho**
   - Tổng giá trị tồn kho
   - Số sản phẩm tồn thấp

### 3.2 Biểu đồ Doanh thu

**Biểu đồ Line Chart**:

- Trục X: Thời gian (ngày/tháng)
- Trục Y: Doanh thu (VNĐ)
- Filters: Hôm nay, 7 ngày, 30 ngày, Tùy chỉnh

**Cách sử dụng**:

1. Click vào dropdown "7 ngày qua"
2. Chọn khoảng thời gian
3. Biểu đồ tự động cập nhật

### 3.3 Top Sản phẩm

Hiển thị **Top 5 sản phẩm bán chạy nhất**:

- Tên sản phẩm
- Số lượng bán
- Doanh thu
- % đóng góp

---

## 4. Bán hàng

### 4.1 Tạo Đơn bán hàng mới

**Bước 1**: Click menu **"Bán hàng"** → **"Tạo đơn mới"**

**Bước 2**: Chọn khách hàng

- Click **"Chọn khách hàng"**
- Tìm kiếm theo tên/SĐT
- Hoặc click **"+ Thêm khách hàng mới"**

**Bước 3**: Thêm sản phẩm vào giỏ

- Tìm sản phẩm bằng tên hoặc SKU
- Click **"Thêm vào giỏ"**
- Điều chỉnh số lượng (nếu cần)
- Thêm giảm giá (nếu có)

**Bước 4**: Kiểm tra giỏ hàng

```
Sản phẩm A   x2   100.000 đ   -10%   = 180.000 đ
Sản phẩm B   x1   50.000 đ             = 50.000 đ
                              Tổng cộng: 230.000 đ
```

**Bước 5**: Thanh toán

- Chọn phương thức: Tiền mặt / Chuyển khoản / Công nợ
- Click **"Hoàn tất"**
- In hóa đơn (nếu cần)

> ✅ **Mã hóa đơn tự động**: `BH-20251123-001`

### 4.2 Giảm giá

**Giảm giá theo sản phẩm**:

1. Click icon **"Edit"** trên dòng sản phẩm
2. Nhập % hoặc số tiền giảm
3. Click **"OK"**

**Giảm giá toàn đơn**:

1. Scroll xuống phần **"Tổng cộng"**
2. Nhập giảm giá (tối đa 100%)
3. Tổng tiền tự động cập nhật

### 4.3 In Hóa đơn

**Sau khi hoàn tất đơn**:

1. Popup hiển thị **"Đơn hàng thành công"**
2. Click **"In hóa đơn"**
3. Chọn máy in hoặc **"Save as PDF"**

**Hóa đơn bao gồm**:

- Logo cửa hàng
- Thông tin khách hàng
- Chi tiết sản phẩm, số lượng, đơn giá
- Tổng tiền, giảm giá, thanh toán
- Chữ ký (nếu cần)

### 4.4 Hoàn tiền

**Điều kiện**:

- Chỉ Owner/Manager có quyền hoàn tiền
- Trong vòng 7 ngày (có thể cấu hình)

**Bước 1**: Tìm đơn hàng cần hoàn

- Menu **"Bán hàng"** → **"Lịch sử"**
- Tìm theo mã đơn/SĐT khách

**Bước 2**: Click **"Hoàn tiền"**

**Bước 3**: Chọn sản phẩm hoàn và số lượng

```
☑ Sản phẩm A   (hoàn 1/2)
☑ Sản phẩm B   (hoàn 1/1)
```

**Bước 4**: Xác nhận

- Nhập lý do hoàn tiền
- Click **"Xác nhận hoàn tiền"**

> ✅ **Tồn kho tự động cập nhật**: Sản phẩm hoàn sẽ được cộng lại vào kho

---

## 5. Sửa chữa

### 5.1 Tạo Phiếu Sửa chữa

**Bước 1**: Menu **"Sửa chữa"** → **"Tạo phiếu mới"**

**Bước 2**: Nhập thông tin xe

```
Biển số xe: 59A-12345
Loại xe: Honda Wave RSX
Tên khách: Nguyễn Văn A
SĐT: 0901234567
```

**Bước 3**: Thêm dịch vụ

- Click **"+ Thêm dịch vụ"**
- Chọn: Thay nhớt / Sửa phanh / Điện / v.v.
- Nhập giá dịch vụ

**Bước 4**: Thêm phụ tùng (nếu cần)

- Click **"+ Thêm phụ tùng"**
- Chọn sản phẩm từ kho
- Số lượng tự động trừ vào tồn kho

**Bước 5**: Tính tiền

```
Dịch vụ thay nhớt:      100.000 đ
Nhớt Shell Advance:      80.000 đ
Lọc nhớt:                20.000 đ
                 Tổng:  200.000 đ
```

**Bước 6**: Đặt cọc (tùy chọn)

- Nhập số tiền đặt cọc (ví dụ: 50.000 đ)
- Còn lại: 150.000 đ

**Bước 7**: Click **"Lưu phiếu"**

> ✅ **Mã phiếu tự động**: `SC-20251123-001`

### 5.2 Cập nhật Trạng thái

**Trạng thái phiếu sửa chữa**:

1. **Đang chờ**: Mới tạo, chưa bắt đầu
2. **Đang sửa**: Đang thực hiện
3. **Hoàn thành**: Đã xong, chưa thanh toán
4. **Đã thanh toán**: Hoàn tất

**Cách thay đổi trạng thái**:

1. Vào chi tiết phiếu
2. Click dropdown **"Trạng thái"**
3. Chọn trạng thái mới
4. Click **"Cập nhật"**

### 5.3 Thanh toán Phiếu

**Bước 1**: Vào phiếu cần thanh toán

**Bước 2**: Click **"Thanh toán"**

**Bước 3**: Nhập số tiền thanh toán

```
Tổng tiền:      200.000 đ
Đã đặt cọc:      50.000 đ
Còn lại:        150.000 đ
Thanh toán:     150.000 đ  ← Nhập ở đây
```

**Bước 4**: Chọn phương thức

- ☑ Tiền mặt
- ☐ Chuyển khoản
- ☐ Công nợ

**Bước 5**: Click **"Xác nhận"**

### 5.4 In Phiếu Sửa chữa

1. Vào chi tiết phiếu
2. Click **"In phiếu"**
3. Kiểm tra thông tin:
   - Biển số xe, tên khách
   - Danh sách dịch vụ + phụ tùng
   - Tổng tiền, đặt cọc, còn lại
4. Click **"Print"** hoặc **"Save PDF"**

### 5.5 Hoàn tiền Sửa chữa

**Bước 1**: Vào phiếu cần hoàn

**Bước 2**: Click **"Hoàn tiền"**

**Bước 3**: Chọn items hoàn

```
☑ Dịch vụ thay nhớt    100.000 đ
☑ Nhớt Shell Advance    80.000 đ
☐ Lọc nhớt              20.000 đ
```

**Bước 4**: Xác nhận

- Lý do hoàn tiền: **\_\_\_**
- Click **"Hoàn tiền"**

> ✅ **Tự động khôi phục tồn kho**: Phụ tùng hoàn sẽ cộng lại vào kho

---

## 6. Quản lý Kho

### 6.1 Thêm Sản phẩm mới

**Bước 1**: Menu **"Kho"** → **"+ Thêm sản phẩm"**

**Bước 2**: Nhập thông tin

```
SKU:         NHOT-001
Tên:         Nhớt Shell Advance AX7 1L
Danh mục:    Nhớt xe máy
Giá bán:     80.000 đ
Giá nhập:    60.000 đ
Tồn tối thiểu: 5
Mô tả:       Nhớt cao cấp cho xe số
```

**Bước 3**: Upload hình ảnh (tùy chọn)

**Bước 4**: Click **"Lưu"**

### 6.2 Nhập Hàng

**Bước 1**: Menu **"Kho"** → **"Phiếu nhập"** → **"+ Tạo phiếu nhập"**

**Bước 2**: Chọn nhà cung cấp

- Tìm trong danh sách
- Hoặc **"+ Thêm NCC mới"**

**Bước 3**: Thêm sản phẩm

```
Nhớt Shell Advance   x10   60.000 đ   = 600.000 đ
Lọc nhớt Honda       x20   15.000 đ   = 300.000 đ
                              Tổng:     900.000 đ
```

**Bước 4**: Thanh toán

- Tiền mặt / Chuyển khoản / Công nợ
- Click **"Hoàn tất nhập hàng"**

> ✅ **Tồn kho tự động cập nhật**: +10 Nhớt, +20 Lọc

### 6.3 Xuất Hàng

**Bước 1**: Menu **"Kho"** → **"Phiếu xuất"** → **"+ Tạo phiếu xuất"**

**Bước 2**: Chọn chi nhánh nhận (nếu có nhiều CN)

**Bước 3**: Thêm sản phẩm xuất

```
Nhớt Shell Advance   x5
Lọc nhớt Honda       x10
```

**Bước 4**: Ghi chú (tùy chọn)

- Lý do xuất: Chuyển kho, khuyến mãi, hỏng, v.v.

**Bước 5**: Click **"Xác nhận xuất"**

### 6.4 Chuyển Kho

**Bước 1**: Menu **"Kho"** → **"Chuyển kho"** → **"+ Tạo phiếu chuyển"**

**Bước 2**: Chọn:

- Chi nhánh nguồn: CN1
- Chi nhánh đích: CN2

**Bước 3**: Thêm sản phẩm chuyển

**Bước 4**: Click **"Xác nhận chuyển"**

> 🔄 **Atomic transaction**: CN1 trừ, CN2 cộng đồng thời

### 6.5 Điều chỉnh Tồn kho

**Khi nào dùng**: Kiểm kê, hàng hỏng, mất mát

**Bước 1**: Vào sản phẩm cần điều chỉnh

**Bước 2**: Click **"Điều chỉnh tồn"**

**Bước 3**: Nhập số lượng mới

```
Tồn hiện tại: 10
Tồn thực tế:   8  ← Sau kiểm kê
Chênh lệch:   -2  (Tự động tính)
```

**Bước 4**: Chọn lý do

- ☑ Kiểm kê
- ☐ Hàng hỏng
- ☐ Mất mát
- ☐ Khác

**Bước 5**: Ghi chú (bắt buộc)

- Ví dụ: "Hàng hỏng trong quá trình vận chuyển"

**Bước 6**: Click **"Xác nhận"**

### 6.6 Cảnh báo Tồn thấp

**Tự động cảnh báo khi**:

- Tồn kho ≤ Tồn tối thiểu

**Xem cảnh báo**:

1. Dashboard → Card **"Tồn kho"**
2. Click **"Xem chi tiết"**
3. Danh sách sản phẩm tồn thấp

**Hành động**:

- Click **"Nhập hàng nhanh"** để tạo phiếu nhập

---

## 7. Quản lý Khách hàng

### 7.1 Thêm Khách hàng

**Bước 1**: Menu **"Khách hàng"** → **"+ Thêm khách hàng"**

**Bước 2**: Nhập thông tin

```
Họ tên:        Nguyễn Văn A
SĐT:           0901234567  ← Bắt buộc
Email:         nguyenvana@example.com
Biển số xe:    59A-12345
Địa chỉ:       123 Nguyễn Huệ, Q1, TP.HCM
Ghi chú:       Khách quen, ưu tiên phục vụ
```

**Bước 3**: Click **"Lưu"**

> ✅ **Validation**: Số điện thoại phải đúng format VN (10-11 số)

### 7.2 Tìm Khách hàng

**Tìm kiếm nhanh**:

- Nhập tên, SĐT, hoặc biển số vào ô tìm kiếm
- Kết quả hiển thị realtime

**Filters**:

- Tất cả / Có công nợ / VIP

### 7.3 Lịch sử Giao dịch

**Xem lịch sử**:

1. Click vào tên khách hàng
2. Tab **"Lịch sử"**
3. Hiển thị:
   - Đơn bán hàng
   - Phiếu sửa chữa
   - Thanh toán công nợ
   - Tổng chi tiêu

**Filters lịch sử**:

- Tất cả / Bán hàng / Sửa chữa
- Khoảng thời gian: Tùy chỉnh

---

## 8. Công nợ

### 8.1 Công nợ Khách hàng

**Xem tổng quan**:

1. Menu **"Công nợ"** → **"Khách hàng"**
2. Danh sách khách có nợ với:
   - Tên khách
   - Số tiền nợ
   - Ngày phát sinh
   - Số ngày quá hạn

**Thu nợ**:

1. Click **"Thu nợ"** bên cạnh khách hàng
2. Nhập số tiền thu (có thể thu từng phần)
3. Chọn phương thức thu
4. Click **"Xác nhận"**

### 8.2 Công nợ Nhà cung cấp

**Xem tổng quan**:

- Menu **"Công nợ"** → **"Nhà cung cấp"**

**Trả nợ NCC**:

1. Click **"Trả nợ"**
2. Nhập số tiền trả
3. Chọn phương thức
4. Click **"Xác nhận"**

### 8.3 Báo cáo Công nợ

**Export Excel**:

1. Click **"Xuất báo cáo"**
2. Chọn khoảng thời gian
3. File Excel bao gồm:
   - Sheet 1: Công nợ khách hàng
   - Sheet 2: Công nợ NCC
   - Sheet 3: Lịch sử thanh toán

---

## 9. Tài chính

### 9.1 Sổ quỹ

**Xem số dư**:

- Dashboard → Card **"Quỹ"**
- Hoặc Menu **"Tài chính"** → **"Sổ quỹ"**

**Các quỹ**:

- Tiền mặt
- Ngân hàng (từng TK)
- Tổng cộng

### 9.2 Thu/Chi

**Ghi thu**:

1. Menu **"Tài chính"** → **"+ Phiếu thu"**
2. Nhập:
   - Loại thu: Bán hàng, Dịch vụ, Thu nợ, Thu khác
   - Số tiền
   - Nguồn tiền: Tiền mặt / Ngân hàng
   - Ghi chú
3. Click **"Lưu"**

**Ghi chi**:

1. Menu **"Tài chính"** → **"+ Phiếu chi"**
2. Nhập:
   - Loại chi: Nhập hàng, Lương, Thuê mặt bằng, Chi khác
   - Số tiền
   - Nguồn tiền
   - Ghi chú
3. Click **"Lưu"**

### 9.3 Vay/Cho vay

**Ghi vay tiền**:

1. Menu **"Tài chính"** → **"Vay/Cho vay"** → **"+ Vay tiền"**
2. Nhập:
   - Người cho vay
   - Số tiền vay
   - Lãi suất (nếu có)
   - Hạn trả
   - Ghi chú
3. Click **"Lưu"**

**Trả nợ vay**:

1. Vào khoản vay
2. Click **"Trả nợ"**
3. Nhập số tiền trả
4. Click **"Xác nhận"**

---

## 10. Nhân viên

### 10.1 Thêm Nhân viên

**Bước 1**: Menu **"Nhân viên"** → **"+ Thêm nhân viên"**

**Bước 2**: Nhập thông tin

```
Họ tên:        Trần Văn B
Email:         tranvanb@example.com
SĐT:           0909999999
Vai trò:       Staff / Manager / Owner
Lương cơ bản:  5.000.000 đ
Ngày vào làm:  01/01/2024
```

**Bước 3**: Click **"Lưu"**

> ⚠️ **Chú ý**: Mỗi email chỉ tạo được 1 tài khoản

### 10.2 Phân quyền

**Owner**:

- Full quyền: Xem, thêm, sửa, xóa tất cả
- Quản lý nhân viên
- Cấu hình hệ thống

**Manager**:

- Quản lý: Xem, thêm, sửa (không xóa)
- Không xem báo cáo tài chính nhạy cảm

**Staff**:

- Nhân viên: Xem, thêm đơn hàng
- Không xem giá nhập, lợi nhuận

### 10.3 Chấm công & Lương

_(Tính năng đang phát triển)_

---

## 11. Báo cáo

### 11.1 Báo cáo Doanh thu

**Xuất báo cáo**:

1. Menu **"Báo cáo"** → Tab **"Doanh thu"**
2. Chọn khoảng thời gian
3. Click **"Xuất Excel"**

**Nội dung báo cáo**:

- Tổng doanh thu
- Doanh thu từ bán hàng
- Doanh thu từ sửa chữa
- Chi tiết từng đơn hàng

### 11.2 Báo cáo Top sản phẩm (NEW)

**Xuất báo cáo**:

1. Tab **"Doanh thu"** → Dropdown **"Báo cáo nâng cao"**
2. Hover → Click **"Top sản phẩm bán chạy"**
3. File Excel bao gồm:
   - Ranking
   - Tên sản phẩm
   - Số lượng bán
   - Doanh thu
   - Số đơn hàng
   - Giá trị trung bình/đơn

### 11.3 Báo cáo Lợi nhuận (NEW)

**Xuất báo cáo**:

1. Dropdown **"Báo cáo nâng cao"** → **"Lợi nhuận theo sản phẩm"**
2. File Excel bao gồm:
   - Revenue (Doanh thu)
   - Cost (Giá vốn)
   - Profit (Lợi nhuận)
   - Margin (%) - Biên lợi nhuận

**Phân tích**:

- Sản phẩm có margin cao nhất
- Sản phẩm bán chạy nhưng margin thấp
- Tối ưu giá bán

### 11.4 Báo cáo Tồn kho Chi tiết (NEW)

**Xuất báo cáo**:

1. Tab **"Tồn kho"** → Click **"Tồn kho chi tiết"**
2. File Excel gồm 4 sheets:

**Sheet 1: Tổng quan**

- Tổng số sản phẩm
- Tổng giá trị tồn kho
- Số sản phẩm tồn thấp
- Số sản phẩm hết hàng

**Sheet 2: Tất cả sản phẩm**

- Danh sách full inventory
- SKU, Tên, Tồn, Giá vốn, Giá bán

**Sheet 3: Tồn thấp**

- Sản phẩm có tồn ≤ 5
- Cảnh báo cần nhập hàng

**Sheet 4: Hết hàng**

- Sản phẩm có tồn = 0
- Ưu tiên nhập gấp

### 11.5 Báo cáo Thu chi

**Xuất báo cáo**:

1. Menu **"Báo cáo"** → Tab **"Thu chi"**
2. Chọn khoảng thời gian
3. Click **"Xuất Excel"**

**Nội dung**:

- Tổng thu
- Tổng chi
- Cash flow (Dòng tiền)
- Chi tiết từng khoản thu/chi

---

## 12. Tips và Tricks

### 12.1 Phím tắt

| Phím tắt   | Chức năng      |
| ---------- | -------------- |
| `Ctrl + K` | Tìm kiếm nhanh |
| `Ctrl + N` | Tạo đơn mới    |
| `Ctrl + P` | In             |
| `Ctrl + S` | Lưu            |
| `Esc`      | Đóng popup     |

### 12.2 Tìm kiếm nhanh

**Trong bất kỳ màn hình nào**:

1. Nhấn `Ctrl + K`
2. Gõ từ khóa:
   - Tên khách hàng
   - Mã đơn hàng
   - SKU sản phẩm
   - Biển số xe
3. Enter để mở kết quả

### 12.3 Backup dữ liệu

**Tự động backup**:

- Supabase tự động backup hàng ngày
- Lưu trữ 7 ngày gần nhất

**Manual backup**:

1. Supabase Dashboard → Database → Backups
2. Click **"Create Backup"**

### 12.4 Xuất dữ liệu

**Xuất tất cả dữ liệu**:

1. Menu **"Cài đặt"** → **"Xuất dữ liệu"**
2. Chọn bảng cần xuất
3. Format: Excel / CSV
4. Click **"Xuất"**

---

## 13. FAQs

### Q1: Làm sao để thêm nhiều chi nhánh?

**A**: Hiện tại hệ thống hỗ trợ multi-branch nhưng UI chưa có selector. Branch ID mặc định là "CN1". Để thêm chi nhánh:

1. Thêm branch mới vào bảng `branches` (qua SQL)
2. Cập nhật `currentBranchId` trong code

_(UI selector sẽ có trong version 1.4.0)_

### Q2: Tại sao không xóa được đơn hàng?

**A**: Chỉ Owner có quyền xóa. Manager/Staff chỉ có thể hoàn tiền.

### Q3: Làm sao biết sản phẩm nào bán chạy?

**A**: Xem Dashboard → Top sản phẩm, hoặc xuất **"Báo cáo Top sản phẩm"** từ menu Báo cáo.

### Q4: Tồn kho bị âm, làm sao?

**A**: Không thể xảy ra nếu dùng đúng hệ thống. Nếu xảy ra:

1. Menu **"Kho"** → Sản phẩm bị âm
2. Click **"Điều chỉnh tồn"**
3. Nhập tồn thực tế
4. Lý do: "Điều chỉnh sau kiểm kê"

### Q5: Quên mật khẩu Owner account?

**A**: Liên hệ admin Supabase để reset qua email.

### Q6: Làm sao tùy chỉnh template hóa đơn?

**A**: Sửa file `src/utils/pdfExport.ts` (cần kiến thức code). Hoặc đợi version 1.4.0 có UI customization.

### Q7: Có thể dùng offline không?

**A**: Không. Hệ thống yêu cầu kết nối internet để đồng bộ Supabase realtime.

### Q8: Giới hạn số lượng sản phẩm/khách hàng?

**A**: Không giới hạn. Supabase free tier hỗ trợ 500MB database (khoảng 50,000 records).

### Q9: Có app mobile không?

**A**: Chưa có. Đang trong roadmap version 2.0.0.

### Q10: Liên hệ support ở đâu?

**A**: GitHub Issues: https://github.com/Nhan-Lam-SmartCare/Motocare/issues

---

## 📞 Hỗ trợ

**Email**: support@smartcare.vn  
**Hotline**: 0909 xxx xxx  
**GitHub**: [Motocare Issues](https://github.com/Nhan-Lam-SmartCare/Motocare/issues)

---

**Chúc bạn sử dụng Motocare hiệu quả! 🚀**
