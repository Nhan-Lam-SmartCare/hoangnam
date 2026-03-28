# 🐛 FIX: Lỗi Thanh Toán & Trả Máy 2 Lần

**Ngày:** 6 tháng 12, 2025
**Mức độ:** 🔴 CRITICAL
**Trạng thái:** ✅ ĐÃ SỬA

---

## 📋 TÓM TẮT VẤN ĐỀ

Phát hiện 2 lỗi nghiêm trọng trong hệ thống phiếu sửa chữa:

### 🔴 Vấn đề 1: Có thể thanh toán 2 lần cho cùng 1 phiếu
**Nguyên nhân:**
- Logic tính `totalAdditionalPayment` trong `WorkOrderModal.tsx` sai
- Code cũ:
  ```typescript
  const totalAdditionalPayment = showPartialPayment ? partialPayment : (order.additionalPayment || 0);
  ```
- Khi `showPartialPayment = false`, code lấy giá trị cũ `order.additionalPayment` → cộng 2 lần!

**Kịch bản tái hiện:**
1. Tạo phiếu với trạng thái "Trả máy" + thanh toán 500k
2. Lưu phiếu → `additionalPayment = 500k` được lưu vào DB
3. Mở lại phiếu → `showPartialPayment = true` (vì có `additionalPayment`)
4. Lưu lại phiếu mà KHÔNG check checkbox "Thanh toán khi trả xe"
5. Code lấy `order.additionalPayment` (500k) → Thanh toán lại 500k!
6. Tổng thanh toán = 1,000k (sai!)

### 🔴 Vấn đề 2: Tạo phiếu + thanh toán luôn → Kho không bị trừ
**Nguyên nhân:**
- Hàm `work_order_create_atomic` chỉ RESERVE stock, không trừ kho thực
- Logic cũ: Chỉ trừ kho khi gọi hàm `work_order_complete_payment` riêng
- Nhưng khi tạo phiếu mới với `paymentStatus = 'paid'`, không có logic gọi `work_order_complete_payment`

**Kịch bản tái hiện:**
1. Tạo phiếu mới
2. Chọn trạng thái "Trả máy"
3. Nhập số tiền thanh toán = 100% tổng tiền
4. Lưu phiếu
5. Phiếu được tạo với `paymentStatus = 'paid'`
6. Nhưng kho vẫn chưa bị trừ → Tồn kho sai!

---

## ✅ GIẢI PHÁP

### 1️⃣ Frontend Fix (WorkOrderModal.tsx)

#### Sửa logic tính totalAdditionalPayment:
```typescript
// ❌ Code CŨ (SAI):
const totalAdditionalPayment = showPartialPayment ? partialPayment : (order.additionalPayment || 0);

// ✅ Code MỚI (ĐÚNG):
const totalAdditionalPayment = showPartialPayment ? partialPayment : 0;
```

**Giải thích:** Chỉ lấy giá trị MỚI từ `partialPayment` khi checkbox được check. Không lấy giá trị cũ để tránh cộng 2 lần.

#### Thêm logic trừ kho khi tạo phiếu mới với paymentStatus = 'paid':
```typescript
// Sau khi tạo phiếu thành công
onSave(finalOrder);

// 🔹 Nếu tạo phiếu mới với paymentStatus = 'paid', gọi complete_payment để trừ kho
if (paymentStatus === "paid" && selectedParts.length > 0) {
  const result = await completeWorkOrderPayment(
    orderId,
    formData.paymentMethod || "cash",
    0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
  );
}
```

#### Thêm logic trừ kho khi cập nhật phiếu từ chưa paid sang paid:
```typescript
// Sau khi cập nhật phiếu thành công
onSave(finalOrder);

// 🔹 Nếu cập nhật phiếu thành paymentStatus = 'paid', gọi complete_payment để trừ kho
const wasUnpaidOrPartial = order.paymentStatus !== "paid";
if (paymentStatus === "paid" && wasUnpaidOrPartial && selectedParts.length > 0) {
  const result = await completeWorkOrderPayment(
    order.id,
    formData.paymentMethod || "cash",
    0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
  );
}
```

### 2️⃣ Backend Fix (SQL Function)

#### Thêm cột inventory_deducted:
```sql
ALTER TABLE public.work_orders 
ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT FALSE;
```

#### Cập nhật hàm work_order_complete_payment:
- Thêm logic check `inventory_deducted` để tránh trừ kho 2 lần
- Chỉ trừ kho NẾU: (1) Thanh toán đủ VÀ (2) Chưa trừ kho trước đó

```sql
v_should_deduct_inventory := (v_new_status = 'paid' AND v_order.inventory_deducted = FALSE);

IF v_should_deduct_inventory AND v_order.partsUsed IS NOT NULL THEN
  -- Trừ kho logic...
END IF;

UPDATE work_orders
SET
  -- ... other fields ...
  inventory_deducted = CASE WHEN v_should_deduct_inventory THEN TRUE ELSE inventory_deducted END
WHERE id = p_order_id;
```

---

## 📁 FILES MODIFIED

### Frontend:
- `src/components/service/components/WorkOrderModal.tsx`
  - Import `completeWorkOrderPayment` từ repository
  - Sửa logic tính `totalAdditionalPayment` (line ~583)
  - Thêm logic gọi `completeWorkOrderPayment` sau khi CREATE phiếu mới (line ~1442-1458)
  - Thêm logic gọi `completeWorkOrderPayment` sau khi UPDATE phiếu (line ~1791-1810)

### Backend:
- `sql/2025-12-06_fix_payment_double_deduction.sql` (NEW)
  - Thêm cột `inventory_deducted`
  - Cập nhật hàm `work_order_complete_payment`
  - Đánh dấu các phiếu cũ đã thanh toán đủ

---

## 🧪 TESTING CHECKLIST

### ✅ Test Case 1: Tạo phiếu mới + thanh toán đủ
1. Tạo phiếu sửa chữa mới
2. Thêm phụ tùng (ví dụ: 1x Lọc dầu, giá 50k)
3. Chọn trạng thái "Trả máy"
4. Check "Thanh toán khi trả xe" và nhập 100% (50k)
5. Lưu phiếu
6. **Kiểm tra:**
   - Phiếu có `paymentStatus = 'paid'` ✅
   - Tồn kho bị trừ 1 (Lọc dầu) ✅
   - Cash transaction được tạo ✅
   - Inventory transaction được tạo ✅

### ✅ Test Case 2: Cập nhật phiếu từ chưa paid → paid
1. Tạo phiếu mới, không thanh toán
2. Lưu phiếu (paymentStatus = 'unpaid')
3. Mở lại phiếu
4. Check "Thanh toán khi trả xe" và nhập 100%
5. Lưu phiếu
6. **Kiểm tra:**
   - Phiếu có `paymentStatus = 'paid'` ✅
   - Tồn kho bị trừ 1 lần duy nhất ✅
   - Cash transaction được tạo ✅

### ✅ Test Case 3: Mở lại phiếu đã thanh toán → Không thanh toán lại
1. Tạo phiếu + thanh toán 50k
2. Lưu phiếu
3. Mở lại phiếu (checkbox "Thanh toán khi trả xe" đã check)
4. **UNCHECK** checkbox "Thanh toán khi trả xe"
5. Lưu phiếu
6. **Kiểm tra:**
   - Không tạo thêm cash transaction ✅
   - `totalPaid` vẫn là 50k (không tăng lên 100k) ✅

### ✅ Test Case 4: Tránh trừ kho 2 lần
1. Tạo phiếu + thanh toán đủ → Kho bị trừ lần 1
2. Mở lại phiếu, thay đổi ghi chú
3. Lưu phiếu
4. **Kiểm tra:**
   - Kho KHÔNG bị trừ lần 2 ✅
   - `inventory_deducted = TRUE` ✅

---

## 🚀 DEPLOYMENT STEPS

### Bước 1: Deploy Frontend
```bash
# Commit changes
git add src/components/service/components/WorkOrderModal.tsx
git commit -m "fix: Ngăn chặn thanh toán 2 lần và đảm bảo trừ kho đúng"
git push
```

### Bước 2: Deploy Backend (SQL Migration)
```bash
# Chạy SQL script trên Supabase Dashboard > SQL Editor
# Hoặc sử dụng Supabase CLI:
supabase db push
```

### Bước 3: Verify Production
1. Kiểm tra logs trong Console
2. Tạo 1-2 phiếu test theo các test case trên
3. Xác nhận tồn kho và cash transactions đúng

---

## 📊 IMPACT ANALYSIS

### Trước khi sửa:
- ❌ Có thể thanh toán 2 lần cho 1 phiếu
- ❌ Tạo phiếu + thanh toán đủ → Kho không trừ
- ❌ Dữ liệu tồn kho và doanh thu không chính xác

### Sau khi sửa:
- ✅ Mỗi phiếu chỉ thanh toán 1 lần
- ✅ Kho được trừ ngay khi thanh toán đủ
- ✅ Dữ liệu tồn kho và doanh thu chính xác
- ✅ Có cột `inventory_deducted` để track trạng thái

---

## 🔍 MONITORING

Sau khi deploy, theo dõi:

1. **Console Logs:**
   - `[handleSave] New order is fully paid, calling completeWorkOrderPayment`
   - `[handleSave] Order became fully paid, calling completeWorkOrderPayment`

2. **Database:**
   - Kiểm tra `work_orders.inventory_deducted` = TRUE cho phiếu đã thanh toán
   - Kiểm tra `inventory_transactions` có đủ records cho phiếu mới

3. **User Reports:**
   - Theo dõi phản hồi từ user về tính chính xác của tồn kho
   - Kiểm tra không còn báo cáo về thanh toán 2 lần

---

## 📞 SUPPORT

Nếu có vấn đề:
1. Kiểm tra browser console cho errors
2. Kiểm tra Supabase logs
3. Verify SQL function đã được deploy đúng
4. Liên hệ dev team với logs đầy đủ

---

**Người sửa:** GitHub Copilot  
**Người review:** [TBD]  
**Approved by:** [TBD]
