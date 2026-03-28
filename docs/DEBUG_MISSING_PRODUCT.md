# Debug: Sản phẩm không tìm thấy sau khi nhập kho

## Vấn đề

Phiếu nhập `NH-20251207-011` đã nhập 4 sản phẩm, nhưng sản phẩm **"Bộ nắp trước tay lái "NHB35P""** không tìm thấy trong kho.

## Các bước kiểm tra

### Bước 1: Chạy SQL debug trên Supabase

Mở file `sql/debug_missing_part.sql` và chạy từng query để kiểm tra:

1. **Kiểm tra sản phẩm có tồn tại không**

```sql
SELECT id, name, sku, stock, category
FROM parts
WHERE name LIKE '%nắp trước tay lái%';
```

2. **Kiểm tra theo SKU**

```sql
SELECT id, name, sku, stock, category
FROM parts
WHERE sku = 'NHB35P';
```

3. **Kiểm tra lịch sử nhập kho**

```sql
SELECT
  it."partId",
  it."partName",
  it.quantity,
  p.name as part_actual_name,
  p.stock
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE it.notes LIKE '%NH-20251207-011%'
ORDER BY it.date DESC;
```

### Bước 2: Kiểm tra kết quả

#### Trường hợp 1: Sản phẩm TỒN TẠI trong database

- ✅ Có record trong bảng `parts`
- ✅ Có stock > 0
- ❌ **Nhưng search không tìm thấy**

**Nguyên nhân:** Tên sản phẩm có ký tự đặc biệt (dấu ngoặc kép `"NHB35P"`) làm search không khớp.

**Giải pháp:**

- ✅ Đã cập nhật code search để loại bỏ dấu ngoặc kép
- Refresh lại trang và thử search lại: `Bộ nắp` hoặc `NHB35P`

#### Trường hợp 2: Sản phẩm KHÔNG TỒN TẠI

- ❌ Không có record trong bảng `parts`
- ✅ Có record trong `inventory_transactions`

**Nguyên nhân:**

1. Sản phẩm không được tạo trước khi nhập kho
2. Trigger `trg_inventory_tx_after_insert` không hoạt động
3. Function `adjust_part_stock` bị lỗi

**Giải pháp:**

```sql
-- Kiểm tra trigger có hoạt động không
SELECT
  tgname as trigger_name,
  tgenabled as enabled,
  tgrelid::regclass as table_name
FROM pg_trigger
WHERE tgname = 'trg_inventory_tx_after_insert';

-- Kiểm tra function adjust_part_stock
SELECT proname, prosrc
FROM pg_proc
WHERE proname = 'adjust_part_stock';
```

Nếu trigger/function không tồn tại, chạy lại:

- `sql/2025-11-11_adjust_part_stock.sql`
- `sql/2025-11-11_inventory_tx_trigger.sql`

### Bước 3: Fix thủ công (nếu cần)

Nếu sản phẩm không tồn tại nhưng có trong inventory_transactions, tạo lại:

```sql
-- Lấy thông tin từ inventory_transactions
SELECT "partId", "partName", "branchId", quantity
FROM inventory_transactions
WHERE "partName" LIKE '%Bộ nắp trước tay lái%'
LIMIT 1;

-- Tạo part mới (thay <partId>, <branchId>, <quantity> từ query trên)
INSERT INTO parts (id, name, sku, stock, "retailPrice", "wholesalePrice", category)
VALUES (
  '<partId>',
  'Bộ nắp trước tay lái "NHB35P"',
  'NHB35P',
  jsonb_build_object('<branchId>', <quantity>),
  jsonb_build_object('<branchId>', 285000),
  jsonb_build_object('<branchId>', 0),
  'Phụ tùng'
);
```

### Bước 4: Test lại tìm kiếm

Sau khi fix, thử search với các từ khóa:

- ✅ `Bộ nắp`
- ✅ `nắp trước`
- ✅ `NHB35P`
- ✅ `tay lái`

## Cải thiện đã thực hiện

### 1. Search code (`src/lib/repository/partsRepository.ts`)

- ✅ Loại bỏ dấu ngoặc kép/đơn khỏi search term
- ✅ Tìm kiếm trong 4 trường: name, sku, category, description

### 2. Client-side filter (`src/components/inventory/InventoryManager.tsx`)

- ✅ Multi-keyword search: Tất cả từ phải xuất hiện
- ✅ VD: "Bộ nắp trước" → Tìm sản phẩm có cả 3 từ

### 3. Database indexes (`sql/fix_search_parts.sql`)

- ✅ GIN trigram indexes cho fuzzy search
- ✅ pg_trgm extension

## Khuyến nghị

1. **Khi nhập kho:**

   - Tránh dùng dấu ngoặc kép trong tên sản phẩm
   - Tên nên đơn giản: `Bộ nắp trước tay lái NHB35P` (không có dấu ngoặc)

2. **Khi tìm kiếm:**

   - Dùng từ khóa ngắn: `NHB35P` thay vì tên đầy đủ
   - Hoặc tìm theo từng phần: `nắp trước`, `tay lái`

3. **Kiểm tra định kỳ:**
   - Chạy query kiểm tra sản phẩm orphan (có trong inventory_transactions nhưng không có trong parts)

```sql
SELECT DISTINCT it."partId", it."partName"
FROM inventory_transactions it
LEFT JOIN parts p ON it."partId" = p.id
WHERE p.id IS NULL;
```
