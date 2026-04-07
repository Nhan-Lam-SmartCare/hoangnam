# 🧪 HƯỚNG DẪN TEST PHIẾU SỬA CHỮA

## 📋 CHUẨN BỊ

### Bước 1: Chạy SQL Migration
1. Mở Supabase Dashboard
2. Vào **SQL Editor**
3. Tạo query mới
4. Copy toàn bộ nội dung file: `sql/MASTER_FIX_WORK_ORDER_2025_12_06.sql`
5. Paste vào SQL Editor
6. Click **Run** hoặc nhấn `Ctrl+Enter`

### Bước 2: Xác nhận Migration thành công
Chạy query kiểm tra:
```sql
-- Kiểm tra function CREATE
SELECT 
  routine_name,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'work_order_create_atomic'
GROUP BY routine_name;

-- Kiểm tra function UPDATE
SELECT 
  routine_name,
  string_agg(parameter_name || ' ' || data_type, ', ' ORDER BY ordinal_position) as parameters
FROM information_schema.parameters
WHERE specific_schema = 'public'
  AND routine_name = 'work_order_update_atomic'
GROUP BY routine_name;
```

**Kết quả mong đợi:** Phải thấy `p_vehicle_id` và `p_current_km` trong danh sách parameters

---

## ✅ TEST CASES

### TEST 1: Tạo phiếu sửa chữa mới - Tiếp nhận (unpaid)

#### Thao tác:
1. Vào menu **Dịch vụ** → **Phiếu sửa chữa**
2. Click nút **Tạo phiếu mới**
3. Nhập thông tin:
   ```
   Tên khách hàng: Nguyễn Văn A
   SĐT: 0901234567
   Biển số xe: 51F-12345
   Loại xe: Honda SH 150i
   Số km hiện tại: 15000 ⭐
   Mô tả vấn đề: Thay nhớt định kỳ
   Thợ sửa: Nguyễn Văn B
   Trạng thái: Tiếp nhận
   Tiền công: 100000
   ```
4. Thêm phụ tùng:
   ```
   - Nhớt Shell 1L: SL 2, Giá 150000 → Thành tiền: 300000
   ```
5. Trạng thái thanh toán: **Chưa thanh toán**
6. Click **Lưu**

#### Kỳ vọng:
- ✅ Phiếu được tạo thành công
- ✅ Hiển thị toast "Phiếu sửa chữa đã được tạo"
- ✅ Tổng tiền = 400,000 (tiền công 100k + phụ tùng 300k)

#### Kiểm tra database:
```sql
SELECT 
  id,
  customerName,
  licensePlate,
  currentKm,
  paymentStatus,
  total
FROM work_orders
WHERE customerPhone = '0901234567'
ORDER BY creationDate DESC
LIMIT 1;
```

**Kỳ vọng:**
- `currentKm` = 15000 ⭐
- `paymentStatus` = 'unpaid'
- `total` = 400000

#### Kiểm tra tồn kho (phải CHỈ RESERVE, CHƯA TRỪ):
```sql
SELECT 
  id,
  name,
  stock->'CN1' as stock_cn1,
  reserved->'CN1' as reserved_cn1
FROM parts
WHERE name LIKE '%Nhớt Shell%';
```

**Kỳ vọng:**
- `reserved` tăng 2 (được đặt trước)
- `stock` KHÔNG thay đổi (chưa trừ)

---

### TEST 2: Tạo phiếu trả máy ngay - Đã thanh toán (paid)

#### Thao tác:
1. Tạo phiếu mới
2. Nhập thông tin:
   ```
   Tên: Trần Thị B
   SĐT: 0987654321
   Biển số: 59C-67890
   Loại xe: Yamaha Exciter
   Số km: 22000 ⭐
   Mô tả: Thay lốp trước
   Thợ: Lê Văn C
   Trạng thái: Trả máy ⭐
   Tiền công: 50000
   ```
3. Thêm phụ tùng:
   ```
   - Lốp Michelin 70/90-17: SL 1, Giá 250000
   ```
4. Tổng tiền: 300,000
5. Trạng thái thanh toán: **Đã thanh toán** ⭐
6. Phương thức: **Tiền mặt**
7. Click **Lưu**

#### Kỳ vọng:
- ✅ Phiếu được tạo thành công
- ✅ Console log: "[handleSave] Calling completeWorkOrderPayment to deduct inventory..."
- ✅ Hiển thị toast "Thanh toán đã hoàn tất"

#### Kiểm tra database - Tồn kho PHẢI BỊ TRỪ:
```sql
-- Kiểm tra tồn kho lốp
SELECT 
  id,
  name,
  stock->'CN1' as stock_cn1,
  reserved->'CN1' as reserved_cn1
FROM parts
WHERE name LIKE '%Michelin%';
```

**Kỳ vọng:**
- `stock` giảm 1 ⭐ (đã trừ thật)
- `reserved` = 0 (đã giải phóng)

#### Kiểm tra giao dịch tiền mặt:
```sql
SELECT 
  id,
  category,
  amount,
  description,
  paymentSource
FROM cash_transactions
WHERE reference LIKE 'PHSC-%'
ORDER BY date DESC
LIMIT 1;
```

**Kỳ vọng:**
- `category` = 'service_income'
- `amount` = 300000
- `paymentSource` = 'cash'

#### Kiểm tra inventory_transactions:
```sql
SELECT 
  type,
  partName,
  quantity,
  notes
FROM inventory_transactions
WHERE workOrderId LIKE 'PHSC-%'
ORDER BY date DESC
LIMIT 1;
```

**Kỳ vọng:**
- `type` = 'Xuất kho'
- `quantity` = 1
- `notes` = 'Hoàn tất thanh toán phiếu sửa chữa'

---

### TEST 3: Cập nhật phiếu - Thay đổi số km

#### Thao tác:
1. Mở phiếu đã tạo ở TEST 1 (Nguyễn Văn A)
2. Cập nhật số km: **15500** (tăng 500km)
3. Thêm phụ tùng mới:
   ```
   - Lọc gió: SL 1, Giá 80000
   ```
4. Trạng thái: Đang sửa
5. Click **Lưu**

#### Kỳ vọng:
- ✅ Phiếu được cập nhật
- ✅ Tổng tiền tăng lên 480,000

#### Kiểm tra database:
```sql
SELECT 
  currentKm,
  status,
  total,
  partsUsed
FROM work_orders
WHERE customerPhone = '0901234567';
```

**Kỳ vọng:**
- `currentKm` = 15500 ⭐ (đã cập nhật)
- `status` = 'Đang sửa'
- `total` = 480000
- `partsUsed` có 2 phụ tùng (Nhớt Shell + Lọc gió)

---

### TEST 4: Không cho sửa phụ tùng khi đã thanh toán

#### Thao tác:
1. Mở phiếu ở TEST 2 (Trần Thị B - đã thanh toán)
2. Quan sát giao diện

#### Kỳ vọng:
- ✅ Hiển thị banner cảnh báo màu vàng: "Phiếu này đã thanh toán. Không thể sửa giá và phụ tùng." ⭐
- ✅ Nút **"Thêm phụ tùng"** bị disable (màu xám)
- ✅ Ô nhập **số lượng** phụ tùng bị disable
- ✅ Nút **xóa phụ tùng** (icon thùng rác) bị disable
- ✅ Có thể sửa: Tên khách hàng, SĐT, Mô tả vấn đề, Thợ sửa
- ✅ KHÔNG thể sửa: Tiền công, Giảm giá, Phụ tùng

#### Thử vi phạm (nếu có cách bypass):
- Không thể thêm phụ tùng mới
- Không thể xóa phụ tùng hiện tại
- Không thể thay đổi số lượng phụ tùng

---

### TEST 5: Thanh toán một phần (partial payment)

#### Thao tác:
1. Tạo phiếu mới
2. Nhập:
   ```
   Tên: Phạm Văn D
   SĐT: 0912345678
   Biển số: 60A-11111
   Số km: 30000
   Tiền công: 200000
   ```
3. Phụ tùng:
   ```
   - Dây curoa: SL 1, Giá 180000
   ```
4. Tổng: 380,000
5. Trạng thái thanh toán: **Thanh toán một phần**
6. Tích checkbox "Thanh toán một phần"
7. Nhập: **200,000** (đặt cọc)
8. Phương thức: Tiền mặt
9. Click **Lưu**

#### Kỳ vọng:
- ✅ `depositAmount` = 200,000
- ✅ `totalPaid` = 200,000
- ✅ `remainingAmount` = 180,000
- ✅ `paymentStatus` = 'partial'

#### Kiểm tra database:
```sql
SELECT 
  depositAmount,
  additionalPayment,
  totalPaid,
  remainingAmount,
  paymentStatus
FROM work_orders
WHERE customerPhone = '0912345678';
```

---

### TEST 6: BUG FIX - Không cho thanh toán 2 lần

#### Thao tác:
1. Mở phiếu ở TEST 5 (Phạm Văn D - còn nợ 180k)
2. Trạng thái: Trả máy
3. Tích checkbox **"Thanh toán một phần"**
4. Nhập: **180,000** (trả nốt)
5. **BỎ TÍCH** checkbox "Thanh toán một phần" ⭐
6. Click **Lưu**

#### Kỳ vọng:
- ✅ `additionalPayment` = 0 ⭐ (KHÔNG phải 180,000)
- ✅ `totalPaid` = 200,000 (không đổi)
- ✅ `paymentStatus` = 'partial' (vẫn còn nợ)

**Giải thích:** Trước đây bị bug, khi bỏ tích checkbox vẫn lấy giá trị cũ (180k) → Khách phải trả 2 lần

#### Cách test đúng (trả nốt 180k):
1. Mở lại phiếu
2. Tích checkbox "Thanh toán một phần"
3. Nhập: 180,000
4. **GIỮ NGUYÊN** checkbox được tích ⭐
5. Chọn trạng thái: **Đã thanh toán**
6. Lưu

**Kỳ vọng lần này:**
- ✅ `additionalPayment` = 180,000
- ✅ `totalPaid` = 380,000 (200k + 180k)
- ✅ `remainingAmount` = 0
- ✅ `paymentStatus` = 'paid'

---

### TEST 7: Tồn kho không đủ (Stock Warning)

#### Thao tác:
1. Kiểm tra tồn kho hiện tại:
```sql
SELECT name, stock->'CN1' as stock
FROM parts
WHERE name LIKE '%Phanh%'
LIMIT 1;
```
2. Giả sử có 3 má phanh
3. Tạo phiếu mới, thêm phụ tùng:
   ```
   - Má phanh: SL 5 (nhiều hơn tồn kho)
   ```
4. Click **Lưu**

#### Kỳ vọng:
- ⚠️ Hiển thị cảnh báo: "Tồn kho không đủ: Má phanh. Yêu cầu: 5, Còn: 3"
- ✅ Phiếu VẪN được tạo (chỉ cảnh báo, không chặn)
- ✅ Reserved = 3 (đặt trước hết số có)

---

## 🔍 CHECKLIST TỔNG HỢP

| # | Test Case | Trạng thái |
|---|-----------|------------|
| 1 | Tạo phiếu tiếp nhận - currentKm được lưu | ⬜ |
| 2 | Tạo phiếu trả máy paid - Tồn kho bị trừ | ⬜ |
| 3 | Cập nhật số km - currentKm được update | ⬜ |
| 4 | Khóa UI khi đã thanh toán | ⬜ |
| 5 | Thanh toán một phần | ⬜ |
| 6 | Không thanh toán 2 lần | ⬜ |
| 7 | Cảnh báo tồn kho không đủ | ⬜ |

---

## 📊 QUERIES KIỂM TRA TỔ TỔNG

### Kiểm tra tất cả phiếu sửa chữa mới tạo:
```sql
SELECT 
  id,
  customerName,
  licensePlate,
  currentKm,
  status,
  paymentStatus,
  total,
  totalPaid,
  remainingAmount,
  creationDate
FROM work_orders
WHERE creationDate > NOW() - INTERVAL '1 hour'
ORDER BY creationDate DESC;
```

### Kiểm tra giao dịch tiền mặt:
```sql
SELECT 
  category,
  amount,
  description,
  paymentSource,
  date
FROM cash_transactions
WHERE date > NOW() - INTERVAL '1 hour'
  AND category IN ('service_deposit', 'service_income')
ORDER BY date DESC;
```

### Kiểm tra inventory transactions:
```sql
SELECT 
  type,
  partName,
  quantity,
  notes,
  date
FROM inventory_transactions
WHERE date > NOW() - INTERVAL '1 hour'
ORDER BY date DESC;
```

### Kiểm tra reserved stock:
```sql
SELECT 
  id,
  name,
  stock->'CN1' as stock,
  reserved->'CN1' as reserved,
  (stock->'CN1')::int - COALESCE((reserved->'CN1')::int, 0) as available
FROM parts
WHERE (reserved->'CN1')::int > 0;
```

---

## ⚠️ LƯU Ý

1. **currentKm CHỈ hoạt động SAU KHI chạy migration SQL**
2. **Tồn kho chỉ bị trừ khi:**
   - Phiếu có status = "Trả máy"
   - paymentStatus = "paid"
   - Có gọi `completeWorkOrderPayment()`
3. **Không thể sửa phụ tùng/giá sau khi đã thanh toán**
4. **additionalPayment chỉ lưu khi checkbox "Thanh toán một phần" ĐƯỢC TÍCH**

---

## 🐛 NẾU GẶP LỖI

### Lỗi: currentKm = null sau khi lưu
**Nguyên nhân:** Chưa chạy SQL migration

**Giải pháp:**
1. Chạy file: `sql/MASTER_FIX_WORK_ORDER_2025_12_06.sql`
2. Kiểm tra function đã có parameter `p_current_km`

### Lỗi: Tồn kho không bị trừ khi tạo phiếu paid
**Nguyên nhân:** Không thấy log "Calling completeWorkOrderPayment"

**Giải pháp:**
1. Mở DevTools Console (F12)
2. Kiểm tra log
3. Verify code trong `WorkOrderModal.tsx` line ~1240

### Lỗi: Vẫn sửa được phụ tùng khi đã paid
**Nguyên nhân:** UI lock chưa hoạt động

**Giải pháp:**
1. Hard refresh: Ctrl+Shift+R
2. Clear cache
3. Kiểm tra code `canEditPriceAndParts` trong WorkOrderModal.tsx

---

**Ngày tạo:** 2025-12-06  
**Người tạo:** GitHub Copilot  
**Phiên bản:** 1.0
