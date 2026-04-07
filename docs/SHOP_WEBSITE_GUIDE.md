# 🛍️ Trang Web Shop Online - Hướng Dẫn

## 📋 Tổng Quan

Hệ thống trang web shop online cho phép khách hàng:
- 📦 Xem catalog sản phẩm phụ tùng
- 🛒 Đặt hàng online qua Zalo/Telegram
- 🎉 Xem các chương trình khuyến mãi
- 📸 Xem gallery các công việc bảo trì đã thực hiện

## 🎯 Các Trang Đã Tạo

### 1. Product Catalog (`/shop`)
**File:** `src/pages/shop/ProductCatalog.tsx`

**Tính năng:**
- ✅ Hiển thị danh sách sản phẩm từ database (parts)
- ✅ Tìm kiếm theo tên/SKU
- ✅ Lọc theo danh mục
- ✅ Chế độ xem: Grid/List
- ✅ Giỏ hàng
- ✅ Đặt hàng qua Zalo (message tự động)
- ✅ Responsive mobile-friendly

**Hình ảnh sản phẩm:**
- Đường dẫn: `/images/products/{SKU}.jpg`
- Placeholder: `/images/products/placeholder.jpg`

### 2. Promotions Page (`/promotions`)
**File:** `src/pages/shop/PromotionsPage.tsx`

**Tính năng:**
- ✅ Hiển thị các chương trình khuyến mãi
- ✅ Khuyến mãi nổi bật (featured)
- ✅ Đếm ngược thời gian còn lại
- ✅ Phân loại theo % giảm giá, giảm tiền, tặng quà
- ✅ Call-to-action liên hệ

**Hình ảnh khuyến mãi:**
- Đường dẫn: `/images/promotions/{promotion-name}.jpg`

### 3. Maintenance Gallery (`/gallery`)
**File:** `src/pages/shop/MaintenanceGallery.tsx`

**Tính năng:**
- ✅ Gallery ảnh xe đã bảo trì/sửa chữa
- ✅ Before/After comparison
- ✅ Lọc theo loại dịch vụ
- ✅ Lightbox xem ảnh full
- ✅ Đánh giá 5 sao
- ✅ Trust badges (số xe đã sửa, khách hài lòng, etc.)

**Hình ảnh bảo trì:**
- Đường dẫn: `/images/maintenance/{work-name}.jpg`

## 📁 Cấu Trúc Thư Mục Hình Ảnh

```
public/
├── images/
│   ├── products/           # Hình ảnh sản phẩm phụ tùng
│   │   ├── placeholder.jpg # Ảnh mặc định khi không có ảnh
│   │   ├── SKU-001.jpg     # Đặt tên theo SKU của sản phẩm
│   │   ├── SKU-002.jpg
│   │   └── ...
│   ├── promotions/         # Hình ảnh khuyến mãi
│   │   ├── grand-opening.jpg
│   │   ├── weekend-sale.jpg
│   │   └── ...
│   └── maintenance/        # Hình ảnh bảo trì
│       ├── placeholder.jpg
│       ├── winner-engine-1.jpg
│       ├── winner-before.jpg
│       ├── winner-after.jpg
│       └── ...
```

## 🖼️ Hướng Dẫn Thêm Hình Ảnh

### 1. Hình Ảnh Sản Phẩm

**Bước 1:** Chụp hoặc chuẩn bị ảnh sản phẩm
- Định dạng: JPG hoặc PNG
- Kích thước khuyến nghị: 800x800px (vuông)
- Chất lượng: HD, nền sáng

**Bước 2:** Đặt tên file theo SKU
```bash
# Ví dụ: Nếu SKU là "PT-001"
PT-001.jpg

# Hoặc: Nếu SKU là "PHANH-TRUOC-123"
PHANH-TRUOC-123.jpg
```

**Bước 3:** Copy vào folder
```bash
# Copy ảnh vào:
public/images/products/
```

**Bước 4:** Deploy lên production
- Commit và push code
- Ảnh sẽ tự động được deploy cùng với website

### 2. Hình Ảnh Khuyến Mãi

**Bước 1:** Tạo banner khuyến mãi
- Kích thước khuyến nghị: 1200x630px (landscape)
- Thiết kế bắt mắt với text rõ ràng

**Bước 2:** Lưu vào folder
```bash
public/images/promotions/
```

**Bước 3:** Cập nhật code trong `PromotionsPage.tsx`
```typescript
{
  id: "promo1",
  title: "🎉 Tên Chương Trình",
  description: "Mô tả...",
  imageUrl: "/images/promotions/ten-chuong-trinh.jpg", // ← Đường dẫn ảnh
  // ...
}
```

### 3. Hình Ảnh Bảo Trì

**Bước 1:** Chụp ảnh xe trước/sau bảo trì
- Before: Chụp trước khi sửa
- After: Chụp sau khi hoàn thành
- Kích thước: 1280x720px (16:9)

**Bước 2:** Đặt tên file mô tả
```bash
# Ví dụ:
winner-engine-1.jpg        # Ảnh chính
winner-before.jpg          # Ảnh trước
winner-after.jpg           # Ảnh sau
```

**Bước 3:** Copy vào folder
```bash
public/images/maintenance/
```

**Bước 4:** Cập nhật code trong `MaintenanceGallery.tsx`
```typescript
{
  id: "work1",
  title: "Đại Tu Động Cơ Honda Winner X",
  imageUrl: "/images/maintenance/winner-engine-1.jpg",
  beforeImage: "/images/maintenance/winner-before.jpg",
  afterImage: "/images/maintenance/winner-after.jpg",
  // ...
}
```

## 🚀 Deploy & Hosting

### Hình Ảnh Local vs Online

✅ **Hình ảnh local hoàn toàn OK!**
- Khi deploy lên Vercel, tất cả file trong `public/` sẽ được host tự động
- **KHÔNG CẦN** Supabase Storage (tiết kiệm quota)
- Tải nhanh, không giới hạn bandwidth

### Quy Trình Deploy

1. **Thêm hình ảnh vào folder `public/images/`**
2. **Commit và push lên GitHub**
   ```bash
   git add public/images/
   git commit -m "Add product images"
   git push
   ```
3. **Vercel tự động deploy** (nếu đã setup auto-deploy)
4. **Ảnh sẽ có URL**: `https://your-site.vercel.app/images/products/SKU-001.jpg`

### Tối Ưu Hóa Hình Ảnh

**Giảm dung lượng file:**
```bash
# Sử dụng online tools:
- TinyPNG.com (nén PNG/JPG)
- Squoosh.app (nén + convert WebP)
- ImageOptim (Mac)
- FileOptimizer (Windows)

# Hoặc command line:
npm install -g sharp-cli
sharp -i input.jpg -o output.jpg --quality 80
```

**Khuyến nghị:**
- Sản phẩm: < 200KB/ảnh
- Banner: < 300KB/ảnh
- Bảo trì: < 400KB/ảnh

## 🔗 Truy Cập Trang Web

### Development (Local)
```
http://localhost:5173/#/shop          - Catalog sản phẩm
http://localhost:5173/#/promotions    - Khuyến mãi
http://localhost:5173/#/gallery       - Gallery bảo trì
```

### Production
```
https://your-site.vercel.app/#/shop
https://your-site.vercel.app/#/promotions
https://your-site.vercel.app/#/gallery
```

## 📝 Tùy Chỉnh

### 1. Thay Đổi Link Zalo/Telegram

**File:** `src/pages/shop/ProductCatalog.tsx`

Tìm và sửa dòng này (line ~87):
```typescript
// Thay 'xxxx' bằng ID Zalo group của bạn
window.open(`https://zalo.me/g/xxxx?message=${encodedMessage}`, "_blank");

// Hoặc dùng Telegram:
window.open(`https://t.me/your_bot?text=${encodedMessage}`, "_blank");
```

### 2. Thêm Khuyến Mãi Mới

**File:** `src/pages/shop/PromotionsPage.tsx`

Thêm vào array `promotions`:
```typescript
{
  id: "promo-new",
  title: "🎉 Tên Khuyến Mãi",
  description: "Mô tả chi tiết...",
  discountPercent: 20,           // % giảm (hoặc dùng discountAmount)
  startDate: "2026-01-01",
  endDate: "2026-01-31",
  imageUrl: "/images/promotions/new-promo.jpg",
  minPurchase: 500000,           // Đơn tối thiểu (optional)
  isActive: true,
  featured: true,                // Hiển thị nổi bật
}
```

### 3. Thêm Gallery Mới

**File:** `src/pages/shop/MaintenanceGallery.tsx`

Thêm vào array `galleryItems`:
```typescript
{
  id: "work-new",
  title: "Tên Công Việc",
  description: "Mô tả chi tiết...",
  imageUrl: "/images/maintenance/work-main.jpg",
  beforeImage: "/images/maintenance/work-before.jpg",  // Optional
  afterImage: "/images/maintenance/work-after.jpg",    // Optional
  vehicleModel: "Honda Winner X",
  serviceType: "Đại tu động cơ",
  date: "2026-01-07",
  rating: 5,
  featured: true,
}
```

## 📱 Tích Hợp Social Media

### Chia Sẻ Link

Thêm meta tags vào `index.html`:
```html
<!-- Open Graph / Facebook -->
<meta property="og:type" content="website">
<meta property="og:url" content="https://your-site.vercel.app/">
<meta property="og:title" content="Motocare - Phụ Tùng Xe Máy">
<meta property="og:description" content="Phụ tùng chính hãng, giá tốt">
<meta property="og:image" content="https://your-site.vercel.app/images/og-image.jpg">

<!-- Twitter -->
<meta property="twitter:card" content="summary_large_image">
<meta property="twitter:url" content="https://your-site.vercel.app/">
<meta property="twitter:title" content="Motocare - Phụ Tùng Xe Máy">
<meta property="twitter:description" content="Phụ tùng chính hãng, giá tốt">
<meta property="twitter:image" content="https://your-site.vercel.app/images/og-image.jpg">
```

## 🆘 Troubleshooting

### Ảnh không hiển thị?

1. **Kiểm tra tên file:**
   - Tên file có đúng với SKU không?
   - Có gõ sai chữ hoa/thường không?

2. **Kiểm tra đường dẫn:**
   ```typescript
   // Đúng:
   /images/products/SKU-001.jpg
   
   // Sai:
   ./images/products/SKU-001.jpg
   images/products/SKU-001.jpg
   ```

3. **Kiểm tra file có trong folder không:**
   ```bash
   ls public/images/products/
   ```

4. **Clear cache browser:**
   - Ctrl + F5 (Windows)
   - Cmd + Shift + R (Mac)

### Ảnh bị lỗi trên production?

1. **Re-deploy:**
   ```bash
   git add public/images/
   git commit -m "Update images"
   git push
   ```

2. **Kiểm tra file size:**
   - Nếu file > 10MB, nén lại
   - Vercel có giới hạn file size

## 📞 Liên Hệ & Hỗ Trợ

Nếu cần hỗ trợ thêm, liên hệ:
- 📧 Email: support@motocare.vn
- 📱 Zalo: 0123 456 789
- 💬 Telegram: @motocare_support

---

**Ngày tạo:** 2026-01-07  
**Phiên bản:** 1.0  
**Tác giả:** GitHub Copilot
