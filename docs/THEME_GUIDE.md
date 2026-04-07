# 🎨 Hướng Dẫn Sử Dụng Theme - MotoCare

## Tổng quan

MotoCare sử dụng hệ thống theme chuẩn hóa với CSS Variables và Tailwind CSS, hỗ trợ tự động chuyển đổi giữa Light Mode và Dark Mode.

## 📋 Cấu trúc màu sắc

### 1. Màu nền (Background)

```tsx
// Màu nền chính (trắng/tối)
className = "bg-primary-bg";

// Màu nền phụ (xám nhạt/tối hơn)
className = "bg-secondary-bg";

// Màu nền thứ ba
className = "bg-tertiary-bg";
```

**Ví dụ thực tế:**

```tsx
// Card hoặc container chính
<div className="bg-primary-bg border border-primary-border rounded-lg p-4">
  {/* Nội dung */}
</div>

// Background toàn trang
<div className="min-h-screen bg-secondary-bg">
  {/* Nội dung */}
</div>
```

### 2. Màu chữ (Text)

```tsx
// Chữ chính (đậm nhất)
className = "text-primary-text";

// Chữ phụ (nhạt hơn)
className = "text-secondary-text";

// Chữ thứ ba (placeholder, hint)
className = "text-tertiary-text";
```

**Ví dụ thực tế:**

```tsx
<h1 className="text-2xl font-bold text-primary-text">Tiêu đề chính</h1>
<p className="text-secondary-text">Mô tả hoặc nội dung phụ</p>
<span className="text-tertiary-text text-sm">Gợi ý hoặc placeholder</span>
```

### 3. Màu viền (Border)

```tsx
// Viền chính
className = "border-primary-border";

// Viền phụ
className = "border-secondary-border";
```

**Ví dụ thực tế:**

```tsx
<input
  className="border border-secondary-border bg-primary-bg text-primary-text rounded-lg px-3 py-2"
  placeholder="Nhập dữ liệu..."
/>
```

### 4. Màu nhấn (Accent Colors)

#### 🔵 Blue - Thông tin, liên kết

```tsx
<div className="bg-accent-blue-bg border-2 border-accent-blue-border rounded-lg p-4">
  <span className="text-accent-blue-text font-semibold">Thông tin</span>
</div>
```

#### 🟢 Green - Thành công, hoàn thành

```tsx
<div className="bg-accent-green-bg border-2 border-accent-green-border rounded-lg p-4">
  <span className="text-accent-green-text font-semibold">Thành công</span>
</div>
```

#### 🟣 Purple - VIP, đặc biệt

```tsx
<div className="bg-accent-purple-bg border-2 border-accent-purple-border rounded-lg p-4">
  <span className="text-accent-purple-text font-semibold">VIP</span>
</div>
```

#### 🟠 Orange - Cảnh báo

```tsx
<div className="bg-accent-orange-bg border-2 border-accent-orange-border rounded-lg p-4">
  <span className="text-accent-orange-text font-semibold">Cảnh báo</span>
</div>
```

#### 🔴 Red - Lỗi, nguy hiểm

```tsx
<div className="bg-accent-red-bg border-2 border-accent-red-border rounded-lg p-4">
  <span className="text-accent-red-text font-semibold">Lỗi</span>
</div>
```

## 🎯 Các pattern thông dụng

### Pattern 1: Card với thông tin

```tsx
<div className="bg-primary-bg border border-primary-border rounded-lg p-4 shadow-sm">
  <h3 className="text-lg font-semibold text-primary-text mb-2">Tiêu đề card</h3>
  <p className="text-secondary-text">Nội dung mô tả</p>
</div>
```

### Pattern 2: Stats card với màu nhấn

```tsx
<div className="bg-accent-blue-bg border-2 border-accent-blue-border rounded-lg p-4">
  <div className="text-accent-blue-text text-sm font-medium mb-1">Tiêu đề</div>
  <div className="text-primary-text text-3xl font-bold">1,234</div>
  <div className="text-accent-blue-text text-xs mt-1">
    +12% so với tháng trước
  </div>
</div>
```

### Pattern 3: Form input

```tsx
<input
  type="text"
  className="w-full px-4 py-2 border border-secondary-border rounded-lg 
             bg-primary-bg text-primary-text placeholder-tertiary-text
             focus:outline-none focus:ring-2 focus:ring-blue-500"
  placeholder="Nhập thông tin..."
/>
```

### Pattern 4: Button

```tsx
{
  /* Primary button */
}
<button
  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg 
                   font-medium transition-colors"
>
  Xác nhận
</button>;

{
  /* Secondary button */
}
<button
  className="px-4 py-2 bg-primary-bg hover:bg-tertiary-bg text-primary-text 
                   border border-primary-border rounded-lg font-medium transition-colors"
>
  Hủy
</button>;
```

### Pattern 5: Table

```tsx
<div className="bg-primary-bg border border-primary-border rounded-lg overflow-hidden">
  <table className="w-full">
    <thead className="bg-tertiary-bg">
      <tr>
        <th className="px-4 py-3 text-left text-xs font-medium text-secondary-text uppercase">
          Cột 1
        </th>
      </tr>
    </thead>
    <tbody className="divide-y divide-primary-border">
      <tr className="hover:bg-tertiary-bg">
        <td className="px-4 py-3 text-sm text-primary-text">Dữ liệu</td>
      </tr>
    </tbody>
  </table>
</div>
```

## 🌓 Chuyển đổi Light/Dark Mode

Theme tự động chuyển đổi dựa trên class `dark` ở `<html>` element:

```tsx
// Trong ThemeContext
const toggleTheme = () => {
  setTheme((prev) => (prev === "light" ? "dark" : "light"));
  document.documentElement.classList.toggle("dark");
};
```

## ⚠️ Lưu ý quan trọng

### ✅ NÊN làm:

- Sử dụng các class theme đã định nghĩa (`bg-primary-bg`, `text-primary-text`, v.v.)
- Giữ tính nhất quán trong toàn bộ ứng dụng
- Test cả Light và Dark mode khi phát triển tính năng mới

### ❌ KHÔNG NÊN làm:

- Sử dụng hardcode màu như `bg-white`, `bg-gray-100`, `text-black`
- Quên thêm `dark:` prefix khi cần custom màu
- Mix các hệ thống màu khác nhau

## 🔄 Migration từ code cũ

### Trước:

```tsx
<div className="bg-white dark:bg-slate-800">
  <p className="text-slate-900 dark:text-slate-100">Text</p>
</div>
```

### Sau:

```tsx
<div className="bg-primary-bg">
  <p className="text-primary-text">Text</p>
</div>
```

## 📚 Tham khảo CSS Variables

Tất cả CSS variables được định nghĩa trong `src/index.css`:

```css
:root {
  --color-bg-primary: 255 255 255;
  --color-text-primary: 15 23 42;
  /* ... */
}

.dark {
  --color-bg-primary: 30 41 59;
  --color-text-primary: 248 250 252;
  /* ... */
}
```

Sử dụng với Tailwind: `bg-primary-bg` → `rgb(var(--color-bg-primary))`

## 🎨 Color Palette

### Light Mode

- Background: White → Slate-50 → Slate-100
- Text: Slate-900 → Slate-600 → Slate-400
- Border: Slate-200 → Slate-300

### Dark Mode

- Background: Slate-800 → Slate-900 → Slate-700
- Text: Slate-50 → Slate-200 → Slate-400
- Border: Slate-700 → Slate-600

## 🔧 Troubleshooting

### Vấn đề: Chế độ sáng nhưng vẫn hiển thị màu tối

**Nguyên nhân:** Component đang hardcode màu tối mà không có điều kiện `dark:`

**Ví dụ SAI:**

```tsx
// ❌ SAI - Luôn hiển thị màu tối
<div className="bg-slate-700 text-white">Content</div>
```

**Cách sửa ĐÚNG:**

```tsx
// ✅ ĐÚNG - Tự động thích ứng theme
<div className="bg-primary-bg text-primary-text">
  Content
</div>

// Hoặc nếu cần dùng trực tiếp slate colors
<div className="bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
  Content
</div>
```

### Vấn đề: Gradient không phù hợp với light mode

**Ví dụ SAI:**

```tsx
// ❌ SAI - Gradient tối cho cả 2 mode
<div className="bg-gradient-to-br from-slate-800 to-slate-900">
```

**Cách sửa ĐÚNG:**

```tsx
// ✅ ĐÚNG - Gradient khác cho mỗi mode
<div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-900">
```

### Kiểm tra nhanh các vấn đề thường gặp:

1. **Tìm kiếm hardcode màu tối:**

   ```bash
   # Tìm bg-slate-7xx hoặc bg-slate-8xx mà không có dark:
   grep -r "bg-slate-[78]" src/components --include="*.tsx" | grep -v "dark:"
   ```

2. **Tìm text màu cứng:**

   ```bash
   # Tìm text-white hoặc text-black không có dark:
   grep -r "text-white\|text-black" src/components --include="*.tsx" | grep -v "dark:"
   ```

3. **Kiểm tra gradient:**
   ```bash
   # Tìm gradient không có dark variant
   grep -r "from-slate-[78]" src/components --include="*.tsx" | grep -v "dark:"
   ```

## 📝 Checklist Migration

Khi cập nhật component sang hệ thống theme mới:

- [ ] Thay thế `bg-white` → `bg-primary-bg`
- [ ] Thay thế `bg-gray-50/bg-slate-50` → `bg-secondary-bg`
- [ ] Thay thế `text-gray-900/text-slate-900` → `text-primary-text`
- [ ] Thay thế `text-gray-600/text-slate-600` → `text-secondary-text`
- [ ] Thay thế `border-gray-200/border-slate-200` → `border-primary-border`
- [ ] Kiểm tra các gradient có variant cho dark mode
- [ ] Loại bỏ hardcode `bg-slate-700`, `bg-slate-800` (nếu không có `dark:`)
- [ ] Test cả Light và Dark mode
- [ ] Đảm bảo contrast đủ cho accessibility

---

**Cập nhật lần cuối:** 09/11/2025
