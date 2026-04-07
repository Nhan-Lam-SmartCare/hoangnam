# Hướng dẫn cấu hình thông tin ngân hàng trên phiếu in

## ✅ Đã cải thiện

Phiếu in đã được nâng cấp với:

- ✅ Hiển thị thông tin thanh toán chi tiết (Đã thanh toán / Còn lại)
- ✅ Thông tin ngân hàng nổi bật với QR code
- ✅ Hotline hỗ trợ
- ✅ Chính sách bảo hành

## 📝 Cách thêm thông tin ngân hàng

### Bước 1: Cập nhật thông tin trong database

Chạy file SQL: `sql/insert_sample_store_settings.sql`

**Lưu ý:** Sửa các thông tin sau trong file SQL trước khi chạy:

```sql
bank_name: 'VietcomBank'              -- Tên ngân hàng của bạn
bank_account_number: '1234567890'      -- Số tài khoản
bank_account_holder: 'NGUYEN VAN A'    -- Tên chủ tài khoản
bank_branch: 'Chi nhánh Đồng Tháp'    -- Chi nhánh
```

### Bước 2: Upload QR Code (Optional)

1. Vào Supabase Dashboard → Storage
2. Chọn bucket `public-assets` (tự động tạo khi chạy migration)
3. Upload file QR code của bạn (PNG/JPG)
4. Copy URL của ảnh
5. Chạy query:

```sql
UPDATE store_settings
SET bank_qr_url = 'URL_CUA_QR_CODE'
WHERE branch_id = 'your-branch-id';
```

### Bước 3: Kiểm tra

1. Mở ứng dụng
2. Vào module Dịch vụ sửa chữa
3. Click "In phiếu" trên một work order
4. Xem preview → Phải thấy thông tin ngân hàng ở cuối phiếu

## 🔍 Kiểm tra nhanh trong Supabase

```sql
SELECT
  store_name,
  phone,
  bank_name,
  bank_account_number,
  bank_account_holder,
  bank_qr_url
FROM store_settings
WHERE branch_id = 'your-branch-id';
```

## 🎨 Giao diện phiếu in

### Preview Modal (Xem trước)

- Hiển thị đầy đủ thông tin
- QR code 25mm x 25mm
- Thông tin ngân hàng trong khung màu xanh

### Print Version (In thật)

- Giống preview
- Tối ưu cho khổ giấy A5 (148mm)
- Cả 2 version đều hiển thị bank info

## ⚠️ Lưu ý

1. **branch_id**: Phải khớp với branch hiện tại của user
2. **QR Code**: Nên có kích thước tối thiểu 300x300px
3. **Storage**: QR code phải ở bucket `public-assets` (public access)
4. **Fallback**: Nếu không có bank info, phần này sẽ tự động ẩn

## 🐛 Troubleshooting

### Không thấy thông tin ngân hàng?

1. Kiểm tra `store_settings` table có data chưa
2. Kiểm tra `branch_id` có đúng không
3. Mở DevTools → Console xem có lỗi không
4. Kiểm tra RLS policies cho `store_settings`

### QR Code không hiển thị?

1. Kiểm tra URL có đúng format không
2. Kiểm tra Storage bucket `public-assets` có public access
3. Thử access trực tiếp URL từ browser

### Lỗi TypeScript?

- Đã fix tất cả, chạy `npm run typecheck` để verify

## 📞 Hỗ trợ

Nếu gặp vấn đề, check:

1. Console logs khi click "In phiếu"
2. Network tab → request đến `store_settings`
3. State `storeSettings` trong React DevTools
