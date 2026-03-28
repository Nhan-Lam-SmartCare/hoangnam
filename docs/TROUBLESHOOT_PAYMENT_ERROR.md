# 🔧 TROUBLESHOOT: Lỗi Thanh Toán

## 🐛 Lỗi Hiện Tại

Modal hiện thông báo: **"Có lỗi dữ liệu. Thử lại hoặc liên hệ quản trị"**

Từ console:

- ❌ POST 404 Error khi gọi API Supabase
- ❌ Lỗi trong `handleSave` Error

## 🔍 Nguyên Nhân Có Thể

### 1. Function RPC chưa được deploy lên Supabase

Function `work_order_complete_payment` có thể chưa tồn tại trên Supabase.

### 2. Function bị xóa hoặc tên sai

Tên function trong code và database không khớp.

### 3. Thiếu permissions

User không có quyền EXECUTE function.

## ✅ CÁCH KIỂM TRA

### Bước 1: Kiểm tra function có tồn tại không

Vào **Supabase Dashboard** → **SQL Editor**, chạy lệnh:

```sql
SELECT
    proname as function_name,
    pg_get_function_identity_arguments(oid) as arguments
FROM pg_proc
WHERE proname LIKE '%work_order%payment%'
    AND pronamespace = 'public'::regnamespace;
```

**Kết quả mong đợi:**

```
function_name                 | arguments
------------------------------|--------------------------------
work_order_complete_payment   | p_order_id text, p_payment_method text, p_payment_amount numeric, p_user_id text
```

### Bước 2: Nếu function KHÔNG tồn tại

Chạy file SQL sau **THEO THỨ TỰ**:

1. `sql/2025-11-30_reserve_stock_instead_of_deduct.sql`

   - Tạo function `work_order_create_atomic` và `work_order_update_atomic`

2. `sql/2025-12-06_fix_payment_double_deduction.sql`

   - Tạo function `work_order_complete_payment` với logic chống trừ kho 2 lần

3. `sql/2025-12-08_diagnose_and_fix_stock_deduction.sql`
   - Script tự động sửa lỗi và cập nhật function mới nhất

### Bước 3: Kiểm tra permissions

```sql
-- Kiểm tra permissions
SELECT
    grantee,
    privilege_type
FROM information_schema.routine_privileges
WHERE routine_name = 'work_order_complete_payment'
    AND routine_schema = 'public';
```

**Kết quả mong đợi:**

```
grantee        | privilege_type
---------------|---------------
authenticated  | EXECUTE
```

Nếu KHÔNG có, chạy:

```sql
GRANT EXECUTE ON FUNCTION public.work_order_complete_payment TO authenticated;
```

### Bước 4: Kiểm tra cột `inventory_deducted`

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'work_orders'
    AND column_name = 'inventory_deducted';
```

Nếu KHÔNG tồn tại:

```sql
ALTER TABLE public.work_orders
ADD COLUMN inventory_deducted BOOLEAN DEFAULT FALSE;
```

## 🚀 CÁCH SỬA NHANH

### Option 1: Chạy Script Tự Động (KHUYẾN NGHỊ)

Chạy file này trên Supabase SQL Editor:

```sql
-- File: sql/2025-12-08_diagnose_and_fix_stock_deduction.sql
```

Script này sẽ tự động:

- ✅ Tạo cột `inventory_deducted` nếu chưa có
- ✅ Cập nhật function `work_order_complete_payment`
- ✅ Sửa tất cả phiếu đã thanh toán nhưng chưa trừ kho
- ✅ Hiển thị báo cáo chi tiết

### Option 2: Chạy Từng Bước

#### Bước 1: Tạo function `work_order_complete_payment`

```sql
-- Copy toàn bộ nội dung từ file:
-- sql/2025-12-06_fix_payment_double_deduction.sql
-- Tìm phần "CREATE OR REPLACE FUNCTION public.work_order_complete_payment"
-- và chạy
```

#### Bước 2: Grant permissions

```sql
GRANT EXECUTE ON FUNCTION public.work_order_complete_payment TO authenticated;
```

#### Bước 3: Refresh lại trang

Hard refresh trình duyệt (Ctrl + Shift + R) để clear cache.

## 📝 KIỂM TRA SAU KHI SỬA

### Test 1: Tạo phiếu mới và thanh toán

1. Tạo phiếu sửa chữa mới
2. Thêm sản phẩm
3. Đổi trạng thái sang "Trả máy"
4. Click "Thanh toán"
5. **Mong đợi:** Không có lỗi, stock giảm, inventory_transactions có record "Xuất kho"

### Test 2: Kiểm tra console

Mở Chrome DevTools (F12) → Console tab

**Mong đợi:** Không có lỗi 404 hoặc RPC error

### Test 3: Kiểm tra database

```sql
-- Kiểm tra phiếu vừa thanh toán
SELECT
    id,
    paymentstatus,
    inventory_deducted,
    total,
    totalpaid
FROM work_orders
WHERE id = 'SC-...'  -- Thay bằng ID phiếu vừa test
LIMIT 1;
```

**Mong đợi:**

- `paymentstatus` = 'paid'
- `inventory_deducted` = true
- `total` = `totalpaid`

```sql
-- Kiểm tra inventory transactions
SELECT
    type,
    "partName",
    quantity,
    date
FROM inventory_transactions
WHERE "workOrderId" = 'SC-...'  -- Thay bằng ID phiếu vừa test
ORDER BY date DESC;
```

**Mong đợi:** Có record với `type` = 'Xuất kho'

## 🆘 NẾU VẪN LỖI

### Lỗi "Function không tồn tại"

**Giải pháp:**

1. Đảm bảo đã chạy tất cả migration files
2. Check lại schema name (phải là `public`)
3. Xem Supabase logs: Dashboard → Logs → Postgres Logs

### Lỗi "Permission denied"

**Giải pháp:**

```sql
-- Grant quyền cho authenticated role
GRANT EXECUTE ON FUNCTION public.work_order_complete_payment TO authenticated;
GRANT EXECUTE ON FUNCTION public.work_order_create_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION public.work_order_update_atomic TO authenticated;
```

### Lỗi "Insufficient stock"

**Giải pháp:**
Kiểm tra tồn kho của sản phẩm:

```sql
SELECT
    name,
    stock,
    "reservedStock"
FROM parts
WHERE id = '...' -- ID sản phẩm đang bán
```

Nếu stock không đủ:

- Nhập kho thêm
- Hoặc giảm số lượng trong phiếu

### Lỗi "Already deducted"

**Giải pháp:**
Function đã chặn việc trừ kho 2 lần. Kiểm tra:

```sql
SELECT inventory_deducted
FROM work_orders
WHERE id = 'SC-...'
```

Nếu = `true` → Phiếu đã trừ kho rồi, không cần làm gì thêm.

## 📞 Liên Hệ Support

Nếu sau khi làm theo hướng dẫn vẫn lỗi, cung cấp thông tin sau:

1. **Screenshot console error** (F12 → Console tab)
2. **Kết quả query kiểm tra function**
3. **ID phiếu sửa chữa đang lỗi**
4. **Supabase project URL**
