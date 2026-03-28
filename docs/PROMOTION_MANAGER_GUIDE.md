# 🎉 QUẢN LÝ KHUYẾN MÃI - HƯỚNG DẪN SỬ DỤNG

## 📋 Tổng Quan

Giờ đây bạn có thể **tự quản lý khuyến mãi** mà không cần chỉnh code! Hệ thống mới bao gồm:
- ✅ Trang Admin để thêm/sửa/xóa khuyến mãi
- ✅ Upload hình ảnh trực tiếp lên Supabase Storage
- ✅ Trang khuyến mãi tự động lấy dữ liệu từ database
- ✅ Không cần động vào code nữa!

---

## 🚀 BƯỚC 1: Cài Đặt Database (CHỈ LÀM 1 LẦN)

### 1.1. Tạo Bảng Promotions

1. Vào **Supabase Dashboard** → SQL Editor
2. Mở file `sql/create_promotions_table.sql`
3. Copy toàn bộ nội dung và dán vào SQL Editor
4. Nhấn **Run** để tạo bảng
5. Kiểm tra: Vào Table Editor → Sẽ thấy bảng `promotions` với 3 khuyến mãi mẫu

### 1.2. Kích Hoạt Supabase Storage (Upload Ảnh)

1. Vào **Supabase Dashboard** → Storage
2. Nhấn **New bucket**
3. Đặt tên: `images`
4. Chọn **Public bucket** (để ảnh hiển thị được)
5. Nhấn **Create bucket**

6. Vào bucket `images` vừa tạo
7. Nhấn **New folder** → Đặt tên `promotions`
8. Nhấn **Create**

9. **Cấu hình Policy để upload được:**
   - Vào **Storage** → Bucket `images` → **Policies** tab
   - Nhấn **New policy** → **Custom policy**
   - Policy name: `Allow public upload promotions`
   - Policy definition:
   ```sql
   CREATE POLICY "Allow public upload promotions"
   ON storage.objects FOR INSERT
   WITH CHECK (bucket_id = 'images' AND (storage.foldername(name))[1] = 'promotions');
   ```
   - Hoặc đơn giản hơn, chọn **Allow all operations** (nếu muốn dễ dàng)

---

## 📝 BƯỚC 2: Sử Dụng Trang Admin

### 2.1. Vào Trang Quản Lý

1. Đăng nhập với tài khoản **Owner** hoặc **Manager**
2. Truy cập: `/#/admin/promotions`
3. Hoặc có thể thêm vào menu chính (tùy chọn)

### 2.2. Thêm Khuyến Mãi Mới

1. Nhấn nút **"Thêm Khuyến Mãi"** (góc phải màn hình)
2. **Upload hình ảnh:**
   - Nhấn vào khung "Chọn hình ảnh..."
   - Chọn file ảnh từ máy tính (PNG/JPG, khuyến nghị 16:9)
   - Xem trước ảnh ngay lập tức
3. **Điền thông tin:**
   - **Tiêu đề*** (bắt buộc): VD: "🔧 Thay Chén Cổ Honda"
   - **Mô tả**: Chi tiết chương trình, giá cả, điều kiện...
   - **Ngày bắt đầu*** và **Ngày kết thúc*** (bắt buộc)
   - **Giảm giá (%)**  : VD: 20 (= giảm 20%)
   - **Giảm giá (VNĐ)**: VD: 100000 (= giảm 100.000đ)
   - **Đơn tối thiểu**: VD: 500000 (= áp dụng từ đơn 500k)
   - **Kích hoạt**: ✓ để hiển thị trên trang web
   - **Nổi bật**: ✓ để hiện ở vị trí đầu trang
4. Nhấn **"Lưu"**

### 2.3. Sửa Khuyến Mãi

1. Tìm khuyến mãi trong danh sách
2. Nhấn nút **✏️ (Edit)** bên phải
3. Form mở ra với thông tin cũ
4. Thay đổi nội dung (có thể upload ảnh mới)
5. Nhấn **"Lưu"**

### 2.4. Xóa Khuyến Mãi

1. Tìm khuyến mãi cần xóa
2. Nhấn nút **🗑️ (Delete)** bên phải
3. Xác nhận xóa
4. **Lưu ý**: Chỉ Owner mới có quyền xóa

### 2.5. Tắt Tạm Thời (Không Xóa)

- Sửa khuyến mãi → Bỏ tick **"Kích hoạt"**
- Khuyến mãi sẽ ẩn khỏi trang web nhưng vẫn lưu trong database

---

## 🖼️ BƯỚC 3: Chuẩn Bị Hình Ảnh

### 3.1. Yêu Cầu Hình Ảnh

- **Định dạng**: PNG hoặc JPG
- **Kích thước khuyến nghị**: 800x450px (tỷ lệ 16:9)
- **Dung lượng**: Dưới 2MB để tải nhanh
- **Nội dung**: 
  - Tiêu đề rõ ràng, to
  - Giá/giảm giá nổi bật
  - Hình ảnh minh họa sản phẩm/dịch vụ
  - Màu sắc bắt mắt

### 3.2. Tạo Ảnh Nhanh với Canva (Miễn Phí)

1. Vào [Canva.com](https://www.canva.com/)
2. Tìm template "Instagram Post" (1080x1080) hoặc "Presentation" (1920x1080)
3. Chọn template khuyến mãi/sale có sẵn
4. Thay đổi:
   - Tiêu đề → VD: "Thay Chén Cổ Honda 200k"
   - Nội dung → VD: "Chính hãng - Bảo hành 6 tháng"
   - Màu sắc → Màu cam/đỏ nổi bật
5. Download → Chọn PNG/JPG

### 3.3. Tối Ưu Ảnh (Giảm Dung Lượng)

- Vào [TinyPNG.com](https://tinypng.com/)
- Kéo thả ảnh vào
- Download ảnh đã nén (giảm 50-70% dung lượng)

---

## 🎯 BƯỚC 4: Kiểm Tra Kết Quả

### 4.1. Xem Trên Trang Khuyến Mãi

1. Vào trang: `/#/promotions` (hoặc share link cho khách)
2. Khuyến mãi **"Nổi bật"** hiện ở đầu trang
3. Khuyến mãi **"Kích hoạt"** hiện dưới dạng danh sách
4. Ảnh tự động hiển thị từ Supabase Storage

### 4.2. Test Trên Điện Thoại

1. Mở trang `/#/promotions` trên điện thoại
2. Kiểm tra:
   - Ảnh hiển thị rõ nét
   - Chữ đọc được
   - Không bị vỡ layout
   - Tải nhanh

---

## 🛠️ Xử Lý Lỗi Thường Gặp

### ❌ Lỗi 1: "Failed to upload image"
**Nguyên nhân**: Chưa cấu hình Storage hoặc Policy không đúng

**Giải pháp:**
1. Vào Supabase → Storage → Bucket `images`
2. Kiểm tra có folder `promotions` chưa
3. Vào Policies → Đảm bảo có policy cho phép INSERT
4. Hoặc tạm thời chọn **"Public bucket"** và **"Allow all operations"**

### ❌ Lỗi 2: Ảnh không hiển thị (broken image)
**Nguyên nhân**: URL ảnh không đúng hoặc bucket không public

**Giải pháp:**
1. Vào Storage → Bucket `images` → Settings
2. Bật **"Public bucket"**
3. Vào ảnh đã upload → Copy URL → Paste vào trình duyệt để test

### ❌ Lỗi 3: "Permission denied" khi thêm khuyến mãi
**Nguyên nhân**: Tài khoản không có quyền Owner/Manager

**Giải pháp:**
1. Kiểm tra role trong bảng `profiles`: `SELECT role FROM profiles WHERE id = auth.uid();`
2. Nếu cần, update role: `UPDATE profiles SET role = 'manager' WHERE id = 'USER_ID';`

### ❌ Lỗi 4: Không thấy bảng `promotions`
**Nguyên nhân**: Chưa chạy file SQL setup

**Giải pháp:**
1. Mở `sql/create_promotions_table.sql`
2. Copy toàn bộ nội dung
3. Vào Supabase SQL Editor → Paste → Run
4. Refresh Table Editor để thấy bảng mới

---

## 📊 Quản Lý Nâng Cao

### Tìm Kiếm Khuyến Mãi Trong Database

```sql
-- Xem tất cả khuyến mãi
SELECT * FROM promotions ORDER BY created_at DESC;

-- Chỉ xem khuyến mãi đang chạy
SELECT * FROM promotions WHERE is_active = TRUE;

-- Xem khuyến mãi hết hạn
SELECT * FROM promotions WHERE end_date < NOW();

-- Khuyến mãi sắp hết hạn (7 ngày)
SELECT * FROM promotions 
WHERE end_date BETWEEN NOW() AND NOW() + INTERVAL '7 days'
AND is_active = TRUE;
```

### Thống Kê

```sql
-- Đếm số khuyến mãi
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE is_active = TRUE) as active,
  COUNT(*) FILTER (WHERE featured = TRUE) as featured
FROM promotions;

-- Khuyến mãi theo tháng
SELECT 
  DATE_TRUNC('month', start_date) as month,
  COUNT(*) as total
FROM promotions
GROUP BY month
ORDER BY month DESC;
```

---

## 💡 Mẹo Sử Dụng

### ✅ Nên Làm:
- Upload ảnh rõ nét, tỷ lệ 16:9
- Đặt tiêu đề ngắn gọn, có emoji để nổi bật
- Điền đầy đủ mô tả để khách hiểu rõ chương trình
- Đặt ngày kết thúc để tạo cảm giác cấp bách
- Tick **"Nổi bật"** cho 3-5 khuyến mãi chính
- Test trên điện thoại trước khi share

### ❌ Không Nên:
- Upload ảnh quá lớn (>5MB) → Trang web tải chậm
- Để trống tiêu đề hoặc ngày tháng
- Kích hoạt quá nhiều khuyến mãi cùng lúc → Khách bối rối
- Xóa khuyến mãi ngay khi hết hạn → Giữ lại để tham khảo

---

## 🎨 Ý Tưởng Khuyến Mãi

### Theo Mùa/Sự Kiện:
- 🎊 Tết Nguyên Đán: Giảm 30% bảo dưỡng
- 🎉 Sinh nhật shop: Mua 2 tặng 1
- 🏍️ Ngày xe máy Việt Nam (1/6): Flash sale phụ tùng
- ☀️ Hè: Combo kiểm tra hệ thống làm mát

### Theo Loại Khách:
- 👤 Khách mới: Giảm 20% đơn đầu tiên
- ⭐ Khách thân thiết: Tích điểm đổi quà
- 👨‍👩‍👧 Giới thiệu bạn bè: Cả 2 được giảm 10%

### Theo Sản Phẩm/Dịch Vụ:
- 🔧 Thay nhớt: Mua 2 chai giảm 50.000đ
- 🛞 Thay vỏ xe: Tặng kèm vá săm miễn phí 3 tháng
- 🔍 Bảo dưỡng định kỳ: Giảm 30% vào T2-T5
- 🚀 Dịch vụ cấp tốc: +20k xong trong 30 phút

---

## 📞 Liên Hệ Kỹ Thuật

Nếu gặp vấn đề không giải quyết được:
1. Chụp ảnh màn hình lỗi
2. Mô tả bước đang làm
3. Gửi cho team IT để hỗ trợ

**Chúc bạn quản lý khuyến mãi hiệu quả! 🎉**
