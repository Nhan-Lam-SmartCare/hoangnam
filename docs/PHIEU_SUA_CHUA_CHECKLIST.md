# ✅ CHECKLIST KIỂM TRA PHIẾU SỬA CHỮA

## 📋 TÓM TẮT

Tài liệu này kiểm tra toàn bộ các thông tin nhập trên phiếu sửa chữa có được lưu đúng và hoạt động chính xác không.

## 🔍 DANH SÁCH THÔNG TIN CẦN KIỂM TRA

### 1️⃣ THÔNG TIN KHÁCH HÀNG
- [ ] **Tên khách hàng** (`customerName`)
- [ ] **Số điện thoại** (`customerPhone`)
- [ ] **Biển số xe** (`licensePlate`)
- [ ] **Loại xe** (`vehicleModel`)
- [ ] **Số km hiện tại** (`currentKm`) ⚠️ **ĐÃ SỬA**

### 2️⃣ THÔNG TIN XE & CÔNG VIỆC
- [ ] **Mô tả vấn đề** (`issueDescription`)
- [ ] **Thợ sửa** (`technicianName`)
- [ ] **Trạng thái** (`status`)
- [ ] **Chi nhánh** (`branchId`)
- [ ] **Ngày tạo** (`creationDate`)

### 3️⃣ THÔNG TIN TÀI CHÍNH
- [ ] **Tiền công** (`laborCost`)
- [ ] **Giảm giá** (`discount`)
- [ ] **Tổng tiền** (`total`)
- [ ] **Trạng thái thanh toán** (`paymentStatus`)
- [ ] **Phương thức thanh toán** (`paymentMethod`)

### 4️⃣ THANH TOÁN CHI TIẾT
- [ ] **Tiền đặt cọc** (`depositAmount`)
- [ ] **Tiền thanh toán thêm** (`additionalPayment`) ⚠️ **ĐÃ SỬA BUG**
- [ ] **Tổng đã trả** (`totalPaid`)
- [ ] **Còn nợ** (`remainingAmount`)
- [ ] **ID giao dịch đặt cọc** (`depositTransactionId`)
- [ ] **ID giao dịch thanh toán** (`cashTransactionId`)

### 5️⃣ PHỤ TÙNG SỬ DỤNG
- [ ] **Danh sách phụ tùng** (`partsUsed`)
  - Mã phụ tùng (`partId`)
  - Tên phụ tùng (`partName`)
  - Số lượng (`quantity`)
  - Đơn giá (`price`)
  - Thành tiền
- [ ] **Trừ tồn kho tự động** khi tạo phiếu trả máy ⚠️ **ĐÃ SỬA**
- [ ] **Không cho sửa phụ tùng** khi đã thanh toán ⚠️ **ĐÃ KHÓA UI**

### 6️⃣ DỊCH VỤ THÊM
- [ ] **Danh sách dịch vụ** (`additionalServices`)
  - Tên dịch vụ
  - Giá dịch vụ

---

## 🐛 CÁC LỖI ĐÃ PHÁT HIỆN VÀ SỬA

### ❌ **LỖI 1: Có thể thanh toán 2 lần cho 1 phiếu**
**Nguyên nhân:** 
- Khi bỏ tích checkbox "Thanh toán một phần", giá trị `totalAdditionalPayment` lấy giá trị cũ từ `order.additionalPayment` thay vì về 0
- Code cũ: `totalAdditionalPayment = showPartialPayment ? partialPayment : (order.additionalPayment || 0)`

**Đã sửa:** 
```typescript
// WorkOrderModal.tsx - Line ~397
const totalAdditionalPayment = showPartialPayment ? partialPayment : 0;
```

✅ **Đã fix trong:** `src/components/service/components/WorkOrderModal.tsx`

---

### ❌ **LỖI 2: Tạo phiếu trả máy nhưng không trừ tồn kho**
**Nguyên nhân:** 
- Hàm `work_order_create_atomic` chỉ RESERVE phụ tùng, không trừ tồn kho thật
- Khi tạo phiếu có status "Trả máy" và đã thanh toán, phải gọi thêm `completeWorkOrderPayment`

**Đã sửa:** 
```typescript
// WorkOrderModal.tsx - sau khi tạo/cập nhật phiếu
if (paymentStatus === "paid" && selectedParts.length > 0) {
  console.log("[handleSave] Calling completeWorkOrderPayment to deduct inventory...");
  await completeWorkOrderPayment(orderId, formData.paymentMethod || "cash", 0);
}
```

✅ **Đã fix trong:** `src/components/service/components/WorkOrderModal.tsx`

---

### ❌ **LỖI 3: Số km hiện tại (currentKm) không được lưu**
**Nguyên nhân:** 
- Repository không truyền parameter `p_current_km` và `p_vehicle_id` cho SQL function

**Đã sửa:**
```typescript
// workOrdersRepository.ts - Line ~95-113 (CREATE)
p_vehicle_id: input.vehicleId || null,
p_current_km: input.currentKm || null,

// workOrdersRepository.ts - Line ~322-340 (UPDATE)
p_vehicle_id: input.vehicleId || null,
p_current_km: input.currentKm || null,
```

✅ **Đã fix trong:** 
- `src/lib/repository/workOrdersRepository.ts`
- SQL Migration: `sql/2025-12-06_add_currentkm_to_work_order_functions.sql`
- SQL Migration: `sql/2025-12-06_add_currentkm_to_update_function.sql`

---

### ❌ **LỖI 4: Có thể sửa giá & phụ tùng sau khi đã thanh toán**
**Nguyên nhân:** 
- UI không khóa các trường nhạy cảm khi phiếu đã thanh toán
- Gây mất đồng bộ dữ liệu giữa thanh toán và phụ tùng

**Đã sửa:**
```typescript
// WorkOrderModal.tsx - Line ~397-400
const isOrderPaid = order?.paymentStatus === "paid";
const canEditPriceAndParts = !isOrderPaid && !isOrderRefunded;

// Hiển thị cảnh báo
{isOrderPaid && (
  <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mb-4">
    <div className="flex items-center gap-2">
      <AlertCircle className="w-5 h-5 text-amber-600" />
      <p className="text-amber-800 font-medium">
        Phiếu này đã thanh toán. Không thể sửa giá và phụ tùng.
      </p>
    </div>
  </div>
)}

// Disable nút "Thêm phụ tùng"
<button disabled={!canEditPriceAndParts}>Thêm phụ tùng</button>

// Disable ô nhập số lượng
<input disabled={!canEditPriceAndParts} />

// Disable nút xóa phụ tùng
<button disabled={!canEditPriceAndParts}>Xóa</button>
```

✅ **Đã fix trong:** `src/components/service/components/WorkOrderModal.tsx`

---

## 📊 BẢNG TỔNG HỢP TRẠNG THÁI

| # | Trường dữ liệu | Frontend nhập | Repository truyền | SQL Function nhận | SQL INSERT/UPDATE | Trạng thái |
|---|----------------|---------------|-------------------|-------------------|-------------------|------------|
| 1 | customerName | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 2 | customerPhone | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 3 | vehicleModel | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 4 | licensePlate | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 5 | currentKm | ✅ | ✅ (ĐÃ SỬA) | ✅ (CẦN MIGRATION) | ✅ (CẦN MIGRATION) | ⚠️ CẦN CHẠY SQL |
| 6 | vehicleId | ✅ | ✅ (ĐÃ SỬA) | ✅ (CẦN MIGRATION) | ✅ (CẦN MIGRATION) | ⚠️ CẦN CHẠY SQL |
| 7 | issueDescription | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 8 | technicianName | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 9 | status | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 10 | laborCost | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 11 | discount | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 12 | partsUsed | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 13 | additionalServices | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 14 | total | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 15 | branchId | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 16 | paymentStatus | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 17 | paymentMethod | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 18 | depositAmount | ✅ | ✅ | ✅ | ✅ | ✅ OK |
| 19 | additionalPayment | ✅ | ✅ (ĐÃ SỬA BUG) | ✅ | ✅ | ✅ OK |
| 20 | totalPaid | ✅ (tính toán) | ✅ | ✅ | ✅ | ✅ OK |
| 21 | remainingAmount | ✅ (tính toán) | ✅ | ✅ | ✅ | ✅ OK |

---

## 🚀 HÀNH ĐỘNG CẦN THỰC HIỆN

### ⚠️ **QUAN TRỌNG: Chạy các SQL Migration**

Để hoàn tất việc lưu `currentKm` và `vehicleId`, bạn CẦN chạy các file SQL sau trong Supabase SQL Editor:

#### **Bước 1: Chạy migration cho CREATE function**
```sql
-- File: sql/2025-12-06_add_currentkm_to_work_order_functions.sql
```
Mở Supabase Dashboard → SQL Editor → Paste toàn bộ nội dung file → Run

#### **Bước 2: Chạy migration cho UPDATE function**
```sql
-- File: sql/2025-12-06_add_currentkm_to_update_function.sql
```
Mở Supabase Dashboard → SQL Editor → Paste toàn bộ nội dung file → Run

#### **Bước 3: Kiểm tra function đã được cập nhật**
```sql
-- Kiểm tra signature của function CREATE
SELECT 
  routine_name,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'work_order_create_atomic'
GROUP BY routine_name;

-- Phải thấy: p_vehicle_id text, p_current_km integer trong danh sách

-- Kiểm tra signature của function UPDATE
SELECT 
  routine_name,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'work_order_update_atomic'
GROUP BY routine_name;

-- Phải thấy: p_vehicle_id text, p_current_km integer trong danh sách
```

---

## 🧪 TEST CASE

### Test 1: Tạo phiếu sửa chữa mới với đầy đủ thông tin
1. Mở form tạo phiếu sửa chữa
2. Nhập tất cả thông tin:
   - Tên khách hàng: "Nguyễn Văn A"
   - SĐT: "0901234567"
   - Biển số: "51F-12345"
   - Loại xe: "Honda SH 150i"
   - **Số km hiện tại: 15000** ⚠️
   - Mô tả: "Thay nhớt, lọc gió"
   - Thợ sửa: "Nguyễn Văn B"
   - Tiền công: 100,000
3. Thêm phụ tùng:
   - Nhớt Shell 1L - SL: 2 - Giá: 150,000
4. Chọn trạng thái: "Trả máy"
5. Chọn thanh toán: "Đã thanh toán"
6. Phương thức: "Tiền mặt"
7. Lưu phiếu

**Kỳ vọng:**
- ✅ Phiếu được tạo thành công
- ✅ Tồn kho nhớt giảm 2
- ✅ Giao dịch tiền mặt được tạo
- ✅ **currentKm = 15000 được lưu** (sau khi chạy migration)

### Test 2: Cập nhật phiếu đang sửa, thêm phụ tùng
1. Mở phiếu có status "Đang sửa"
2. Thêm phụ tùng mới: Lọc gió - SL: 1 - Giá: 50,000
3. Cập nhật số km: 15500
4. Lưu

**Kỳ vọng:**
- ✅ Tồn kho lọc gió giảm 1
- ✅ **currentKm cập nhật lên 15500** (sau khi chạy migration)
- ✅ Tổng tiền tăng thêm 50,000

### Test 3: Không cho sửa phụ tùng khi đã thanh toán
1. Mở phiếu có paymentStatus = "paid"
2. Thử thêm/xóa/sửa phụ tùng

**Kỳ vọng:**
- ✅ Hiển thị banner cảnh báo màu vàng
- ✅ Nút "Thêm phụ tùng" bị disable
- ✅ Ô nhập số lượng bị disable
- ✅ Nút xóa phụ tùng bị disable

### Test 4: Không thanh toán 2 lần
1. Tạo phiếu mới
2. Tích "Thanh toán một phần" - Nhập 100,000
3. Bỏ tích checkbox
4. Lưu phiếu

**Kỳ vọng:**
- ✅ additionalPayment = 0 (không phải 100,000)
- ✅ paymentStatus = "unpaid"

---

## 📝 TÀI LIỆU LIÊN QUAN

- `FIX_CURRENTKM_NOT_SAVED.md` - Chi tiết fix lỗi currentKm
- `CUSTOMER_DUPLICATION_FIX.md` - Cấu trúc database customers
- `sql/2025-12-06_add_currentkm_to_work_order_functions.sql` - Migration CREATE
- `sql/2025-12-06_add_currentkm_to_update_function.sql` - Migration UPDATE
- `sql/2025-12-06_fix_payment_double_deduction.sql` - Fix thanh toán 2 lần

---

## ✅ TỔNG KẾT

### Đã hoàn thành trong code:
- ✅ Fix bug thanh toán 2 lần
- ✅ Fix bug không trừ tồn kho khi tạo phiếu trả máy
- ✅ Thêm `p_current_km` và `p_vehicle_id` vào repository
- ✅ Khóa UI khi phiếu đã thanh toán
- ✅ Tạo file migration SQL cho CREATE và UPDATE function

### Cần thực hiện:
- ⚠️ **CHẠY 2 FILE MIGRATION SQL** trong Supabase
- ⚠️ Test lại toàn bộ luồng tạo/cập nhật phiếu
- ⚠️ Kiểm tra dữ liệu trong database

---

**Ngày tạo:** 2025-12-06  
**Phiên bản:** 1.0  
**Trạng thái:** Code hoàn thành - Chờ chạy SQL migration
