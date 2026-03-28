# Sửa Lỗi Trùng Lặp Khách Hàng

## Vấn đề

Khách hàng bị trùng lặp nhiều lần với cùng số điện thoại (ví dụ: "Anh cánh" với SĐT 0967019101 bị tạo nhiều bản ghi).

## Nguyên nhân

Trong các file sau, code kiểm tra xem khách hàng có tồn tại hay không bằng số điện thoại, **NHƯNG vẫn tạo khách hàng mới** ngay cả khi đã tồn tại:

1. `src/components/service/ServiceManager.tsx` - ✅ **ĐÃ SỬA**
2. `src/components/service/components/WorkOrderModal.tsx` - ⚠️ **CẦN SỬA THỦ CÔNG**

## Giải pháp đã áp dụng cho ServiceManager.tsx

### Trước khi sửa:

```typescript
if (!existingCustomer) {
  // Warning về trùng lặp
  // Nhưng VẪN TẠO khách hàng mới
  upsertCustomer({
    id: `CUST-${Date.now()}`,
    ...
  });
}
// KHÔNG CÓ ELSE - không xử lý khi khách đã tồn tại
```

### Sau khi sửa:

```typescript
if (!existingCustomer) {
  // Chỉ tạo khách hàng mới nếu SĐT chưa tồn tại
  upsertCustomer({
    id: `CUST-${Date.now()}`,
    ...
  });
  console.log(`Created new customer: ${name} (${phone})`);
} else {
  // Khách hàng đã tồn tại - chỉ cập nhật thông tin xe nếu cần
  if (formData.vehicleModel && existingCustomer.vehicleModel !== formData.vehicleModel) {
    upsertCustomer({
      ...existingCustomer,
      vehicleModel: formData.vehicleModel,
      licensePlate: formData.licensePlate,
    });
    console.log(`Updated vehicle info for existing customer: ${existingCustomer.name}`);
  }
}
```

## TODO: Sửa WorkOrderModal.tsx

File `src/components/service/components/WorkOrderModal.tsx` có **3 vị trí** cần sửa:

### Vị trí 1: Dòng ~695-745 (handleSubmitWithoutPayment)

Tìm đoạn code:

```typescript
// Add/update customer
if (formData.customerName && formData.customerPhone) {
  const existingCustomer = customers.find(
    (c) => c.phone === formData.customerPhone
  );

  if (!existingCustomer) {
    // ... kiểm tra trùng lặp ...
    upsertCustomer({
      id: `CUST-${Date.now()}`,
      ...
    });
  }
}
```

Thêm ELSE branch:

```typescript
if (!existingCustomer) {
  // ... giữ nguyên code tạo mới ...
  console.log(
    `[WorkOrderModal] Created new customer: ${formData.customerName} (${formData.customerPhone})`
  );
} else {
  // Khách hàng đã tồn tại - chỉ cập nhật thông tin xe nếu cần
  if (
    formData.vehicleModel &&
    existingCustomer.vehicleModel !== formData.vehicleModel
  ) {
    upsertCustomer({
      ...existingCustomer,
      vehicleModel: formData.vehicleModel,
      licensePlate: formData.licensePlate,
    });
    console.log(
      `[WorkOrderModal] Updated vehicle info for existing customer: ${existingCustomer.name}`
    );
  }
}
```

### Vị trí 2: Dòng ~870-920 (handleSave)

Tương tự vị trí 1 - áp dụng cùng logic.

### Vị trí 3: Dòng ~3000-3070 (Add Customer Modal)

Tương tự - thêm else branch để xử lý khách hàng đã tồn tại.

## Dọn dẹp dữ liệu trùng lặp trong Database

### Bước 1: Xem danh sách khách hàng trùng lặp

```sql
-- Tìm các SĐT bị trùng lặp
SELECT
  phone,
  COUNT(*) as duplicate_count,
  STRING_AGG(name, ', ') as customer_names,
  STRING_AGG(id::text, ', ') as customer_ids
FROM customers
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC;
```

### Bước 2: Giữ lại bản ghi cũ nhất, xóa các bản còn lại

**⚠️ QUAN TRỌNG: Backup database trước khi chạy!**

```sql
-- XÓA KHÁCH HÀNG TRÙNG LẶP (giữ lại bản ghi tạo sớm nhất)
WITH ranked_customers AS (
  SELECT
    id,
    phone,
    name,
    created_at,
    ROW_NUMBER() OVER (PARTITION BY phone ORDER BY created_at ASC) as rn
  FROM customers
  WHERE phone IS NOT NULL AND phone != ''
)
DELETE FROM customers
WHERE id IN (
  SELECT id
  FROM ranked_customers
  WHERE rn > 1
);

-- Kiểm tra kết quả
SELECT
  phone,
  COUNT(*) as count
FROM customers
WHERE phone IS NOT NULL AND phone != ''
GROUP BY phone
HAVING COUNT(*) > 1;
-- Kết quả phải trả về 0 dòng nếu thành công
```

### Bước 3: Tạo UNIQUE constraint để ngăn trùng lặp trong tương lai

```sql
-- Tạo unique constraint cho số điện thoại
ALTER TABLE customers
ADD CONSTRAINT customers_phone_unique
UNIQUE (phone);
```

## Cập nhật lại totalSpent cho khách hàng

Sau khi xóa khách trùng lặp, cần tính lại tổng chi tiêu:

```sql
-- Cập nhật lại totalSpent từ bảng sales
UPDATE customers c
SET
  "totalSpent" = COALESCE((
    SELECT SUM(total)
    FROM sales s
    WHERE s.customerphone = c.phone
  ), 0),
  "visitCount" = COALESCE((
    SELECT COUNT(DISTINCT id)
    FROM sales s
    WHERE s.customerphone = c.phone
  ), 0);

-- Cập nhật thêm từ work_orders
UPDATE customers c
SET
  "totalSpent" = COALESCE(c."totalSpent", 0) + COALESCE((
    SELECT SUM(total)
    FROM work_orders w
    WHERE w.customerphone = c.phone
  ), 0),
  "visitCount" = COALESCE(c."visitCount", 0) + COALESCE((
    SELECT COUNT(DISTINCT id)
    FROM work_orders w
    WHERE w.customerphone = c.phone
  ), 0);
```

## Kiểm tra kết quả

```sql
-- Xem khách hàng với tổng chi tiêu
SELECT
  id,
  name,
  phone,
  "totalSpent",
  "visitCount",
  "lastVisit",
  created_at
FROM customers
WHERE phone = '0967019101'
ORDER BY created_at DESC;
```

## Cách test

1. Tạo phiếu sửa chữa mới với số điện thoại đã tồn tại
2. Kiểm tra console log - phải thấy "Updated vehicle info for existing customer" thay vì "Created new customer"
3. Kiểm tra database - KHÔNG được tạo thêm bản ghi mới trong bảng customers
4. Kiểm tra `totalSpent` được cập nhật đúng cho khách hàng hiện có

## Tổng kết

✅ **ServiceManager.tsx** - Đã sửa 2 vị trí (handleMobileSave)
⚠️ **WorkOrderModal.tsx** - Cần sửa thủ công 3 vị trí (do lỗi encoding file)
📊 **SQL cleanup** - Chạy các câu SQL trên để dọn dẹp dữ liệu cũ
🔒 **Prevent future** - Tạo unique constraint cho phone number
