# 🚀 Quick Start - Shop Website

## ✅ Đã Hoàn Thành

3 trang web mới đã được tạo và sẵn sàng sử dụng:

| Trang | URL | Mô tả |
|-------|-----|-------|
| 📦 Catalog | `/#/shop` | Xem & đặt hàng sản phẩm |
| 🎉 Khuyến mãi | `/#/promotions` | Chương trình ưu đãi |
| 📸 Gallery | `/#/gallery` | Ảnh bảo trì đã làm |

## 🎯 3 Bước Để Bắt Đầu

### Bước 1: Thêm Hình Ảnh

Copy ảnh sản phẩm vào folder:
```
public/images/products/PT-001.jpg
public/images/products/PT-002.jpg
...
```

💡 **Lưu ý:** Đặt tên file = SKU của sản phẩm

### Bước 2: Sửa Link Zalo

**File:** `src/pages/shop/ProductCatalog.tsx` (dòng 87)

```typescript
// Thay 'xxxx' bằng link Zalo group của bạn
window.open(`https://zalo.me/g/xxxx?message=${encodedMessage}`, "_blank");
```

**Cách lấy link Zalo:**
1. Mở Zalo PC/Web
2. Vào group muốn nhận đơn hàng
3. Click "Thông tin nhóm" → "Liên kết mời"
4. Copy link (dạng: https://zalo.me/g/abcdef)

### Bước 3: Test & Deploy

```bash
# Test local
npm run dev

# Deploy
git add .
git commit -m "Add shop website"
git push
```

## 📱 Test Checklist

- [ ] Vào `/shop` xem được danh sách sản phẩm
- [ ] Tìm kiếm hoạt động
- [ ] Thêm vào giỏ hàng OK
- [ ] Click "Đặt hàng" mở Zalo
- [ ] Vào `/promotions` xem khuyến mãi
- [ ] Vào `/gallery` xem ảnh bảo trì
- [ ] Test trên điện thoại

## 🎨 Tùy Chỉnh (Optional)

### Thêm Khuyến Mãi
Mở `src/pages/shop/PromotionsPage.tsx`, thêm vào array `promotions`

### Thêm Gallery
Mở `src/pages/shop/MaintenanceGallery.tsx`, thêm vào array `galleryItems`

### Thay Đổi Màu Sắc
Sửa trong các file `.tsx`, tìm các class `bg-blue-600`, `text-emerald-500`, etc.

## 📖 Tài Liệu Đầy Đủ

Xem chi tiết: [SHOP_WEBSITE_GUIDE.md](SHOP_WEBSITE_GUIDE.md)

## 🆘 Gặp Lỗi?

**Ảnh không hiển thị:**
- Kiểm tra tên file có đúng SKU không
- Thử thêm placeholder.jpg vào folder

**Zalo không mở:**
- Kiểm tra đã sửa link chưa
- Test link Zalo trên trình duyệt

**Sản phẩm không hiện:**
- Kiểm tra có tồn kho > 0 không
- Mở F12 Console xem lỗi

---

**🎊 Chúc mừng! Ready to go!** 🚀
