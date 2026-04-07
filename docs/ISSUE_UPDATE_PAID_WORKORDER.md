# ⚠️ VẤN ĐỀ: Cập Nhật Phiếu Đã Thanh Toán

**Ngày:** 6 tháng 12, 2025
**Mức độ:** 🔴 CRITICAL
**Trạng thái:** ⚠️ CẦN XỬ LÝ

---

## 📋 TÓM TẮT VẤN ĐỀ

### 🔴 Vấn đề 1: Thông tin currentKm (số km) KHÔNG được lưu
**Hiện trạng:**
- Frontend có input field để nhập currentKm
- Frontend truyền `currentKm` trong `workOrderData`
- **NHƯNG** Repository `workOrdersRepository.ts` KHÔNG truyền `p_current_km` vào SQL function
- Kết quả: Thông tin km KHÔNG được lưu vào database ❌

**Kịch bản tái hiện:**
1. Tạo phiếu sửa chữa mới
2. Nhập số km: 15,000 km
3. Lưu phiếu
4. Mở lại phiếu → Số km = null/empty ❌

### 🔴 Vấn đề 2: Cập nhật phiếu đã thanh toán → Dữ liệu sai lệch nghiêm trọng
**Hiện trạng:**
- Khi phiếu đã thanh toán đủ (`paymentStatus = 'paid'`), kho đã bị trừ
- Nếu cập nhật phiếu (sửa sản phẩm hoặc số tiền), logic hiện tại:
  - **Trường hợp 1:** Thêm sản phẩm → Reserve thêm, nhưng KHÔNG trừ kho thêm
  - **Trường hợp 2:** Bớt sản phẩm → Release reserved, nhưng KHÔNG hoàn kho
  - **Trường hợp 3:** Đổi sản phẩm → Reserve mới, release cũ, nhưng kho thực không đồng bộ

**Kịch bản tái hiện:**
```
Bước 1: Tạo phiếu
- Sản phẩm: 1x Lọc dầu (50k)
- Thanh toán: 50k (paid)
- Kho: Lọc dầu -1 ✅

Bước 2: Nhận ra chọn nhầm, cần đổi sang
- Sản phẩm: 1x Lọc gió (80k)
- Cập nhật phiếu

Kết quả sau cập nhật:
- Phiếu: 1x Lọc gió, 80k
- Kho: Lọc dầu vẫn -1 ❌ (Không hoàn lại)
- Kho: Lọc gió vẫn nguyên ❌ (Không trừ)
- Tiền: Vẫn là 50k ❌ (Thiếu 30k)
```

---

## 🔍 PHÂN TÍCH NGUYÊN NHÂN

### Vấn đề 1: currentKm không được lưu

**Root Cause:**
File `src/lib/repository/workOrdersRepository.ts`:
```typescript
// ❌ Code CŨ - Thiếu p_current_km
const payload = {
  p_order_id: input.id,
  p_customer_name: input.customerName || "",
  // ... other fields ...
  p_user_id: null,
  // ❌ THIẾU: p_current_km: input.currentKm || null,
};
```

SQL function có nhận parameter `p_current_km`, nhưng repository không truyền → Luôn luôn NULL.

### Vấn đề 2: Cập nhật phiếu đã thanh toán

**Root Cause:**
- Logic hiện tại chỉ xử lý **RESERVED stock**, không xử lý **ACTUAL stock**
- Khi phiếu đã thanh toán (`paymentStatus = 'paid'`):
  - Kho thực đã bị trừ (actual stock deducted)
  - Nhưng khi cập nhật, code chỉ điều chỉnh reserved, không điều chỉnh actual stock
  
**Workflow hiện tại:**
```
CREATE phiếu → RESERVE stock
THANH TOÁN → DEDUCT actual stock (reserved → actual)
UPDATE phiếu → CHỈ điều chỉnh RESERVED ❌
```

**Workflow đúng phải là:**
```
CREATE phiếu → RESERVE stock
THANH TOÁN → DEDUCT actual stock (reserved → actual)
UPDATE phiếu:
  - Nếu chưa thanh toán → Điều chỉnh RESERVED
  - Nếu đã thanh toán → Điều chỉnh ACTUAL STOCK + Điều chỉnh TIỀN
```

---

## ✅ GIẢI PHÁP

### ✅ Fix Vấn đề 1: Lưu currentKm

**Đã sửa:**
1. Repository `workOrdersRepository.ts`:
   - Thêm `p_current_km: input.currentKm || null` vào payload CREATE
   - Thêm `p_current_km: input.currentKm || null` vào payload UPDATE

2. SQL function `work_order_update_atomic`:
   - Thêm parameter `p_current_km INTEGER DEFAULT NULL`
   - Update query: `currentKm = COALESCE(p_current_km, currentKm)`

**Files changed:**
- `src/lib/repository/workOrdersRepository.ts`
- `sql/2025-12-06_add_currentkm_to_update_function.sql`

### ⚠️ Fix Vấn đề 2: Cập nhật phiếu đã thanh toán

**Có 3 phương án:**

#### Phương án 1: 🚫 KHÓA cập nhật phiếu đã thanh toán (KHUYẾN NGHỊ)
**Ưu điểm:**
- Đơn giản, rõ ràng
- Tránh sai sót dữ liệu
- Tuân thủ nguyên tắc kế toán (không sửa chứng từ đã ghi sổ)

**Nhược điểm:**
- Không linh hoạt
- Nếu sai phải hủy và tạo lại

**Implementation:**
```typescript
// Trong WorkOrderModal.tsx
const handleSave = async () => {
  // 🔹 Kiểm tra nếu phiếu đã thanh toán + có thay đổi sản phẩm
  if (order?.paymentStatus === "paid" && order?.partsUsed) {
    const partsChanged = JSON.stringify(order.partsUsed) !== JSON.stringify(selectedParts);
    const totalChanged = order.total !== total;
    
    if (partsChanged || totalChanged) {
      showToast.error(
        "Không thể sửa sản phẩm/giá tiền cho phiếu đã thanh toán. " +
        "Vui lòng hủy phiếu này và tạo phiếu mới."
      );
      return;
    }
  }
  
  // Continue with save...
};
```

#### Phương án 2: ⚠️ CHO PHÉP cập nhật + Điều chỉnh kho & tiền (PHỨC TẠP)
**Ưu điểm:**
- Linh hoạt
- Không cần hủy và tạo lại

**Nhược điểm:**
- Logic phức tạp, dễ lỗi
- Khó audit, truy vết thay đổi
- Vi phạm nguyên tắc kế toán

**Implementation:**
Cần viết thêm function SQL `work_order_update_paid_order`:
```sql
-- Xử lý:
1. So sánh old parts vs new parts
2. Hoàn kho các parts bị xóa/giảm (ACTUAL stock + inventory_transactions)
3. Trừ kho các parts mới thêm/tăng (ACTUAL stock + inventory_transactions)
4. Điều chỉnh tiền (refund/collect thêm tiền)
5. Tạo audit log chi tiết
```

#### Phương án 3: ✅ CHO PHÉP sửa thông tin, KHÔNG cho sửa sản phẩm/giá
**Ưu điểm:**
- Cân bằng giữa linh hoạt và an toàn
- Có thể sửa thông tin khách hàng, ghi chú, kỹ thuật viên
- Không ảnh hưởng kho và tiền

**Nhược điểm:**
- Hơi phức tạp để implement UI

**Implementation:**
```typescript
// Trong WorkOrderModal.tsx
const isPaymentCompleted = order?.paymentStatus === "paid";

// Disable các field nhạy cảm
<input 
  value={formData.laborCost}
  disabled={isPaymentCompleted}
/>

<PartSelector
  disabled={isPaymentCompleted}
/>

// Cho phép sửa các field không nhạy cảm
<input 
  value={formData.technicianName}
  disabled={false} // Luôn cho sửa
/>
```

---

## 🎯 KHUYẾN NGHỊ

### ✅ Đã implement (Vấn đề 1)
- [x] Fix currentKm không được lưu
- [x] Cập nhật repository truyền p_current_km
- [x] Cập nhật SQL function nhận p_current_km

### ⏭️ Cần implement (Vấn đề 2)

**Khuyến nghị: Phương án 3 - Khóa sản phẩm/giá, cho phép sửa thông tin**

**Lý do:**
1. An toàn về dữ liệu kho và tiền
2. Tuân thủ nguyên tắc kế toán cơ bản
3. Dễ implement và maintain
4. Vẫn cho phép sửa thông tin cần thiết (ghi chú, kỹ thuật viên, etc.)

**Nếu thực sự cần sửa sản phẩm/giá:**
→ Workflow: Hủy phiếu cũ (hoàn tiền + hoàn kho) → Tạo phiếu mới

---

## 📝 DEPLOYMENT PLAN

### Phase 1: Fix currentKm (IMMEDIATE)
1. Deploy SQL migration: `2025-12-06_add_currentkm_to_update_function.sql`
2. Code đã sửa trong `workOrdersRepository.ts`
3. Test tạo/cập nhật phiếu với currentKm

### Phase 2: Khóa cập nhật phiếu đã thanh toán (THIS WEEK)
1. Implement phương án 3:
   - Disable các field: parts, services, laborCost, discount
   - Hiển thị warning message
   - Cho phép sửa: customerName, technicianName, notes, status
2. Test kỹ các trường hợp
3. Update user documentation

### Phase 3: Implement workflow hủy phiếu (NEXT SPRINT)
1. Cải thiện UI workflow hủy phiếu
2. Thêm lý do hủy
3. Tự động gợi ý tạo phiếu mới với thông tin tương tự

---

## 🧪 TESTING CHECKLIST

### Test Case 1: currentKm được lưu
- [x] Tạo phiếu mới với currentKm = 15000
- [x] Kiểm tra DB: work_orders.currentKm = 15000 ✅
- [x] Mở lại phiếu: currentKm hiển thị 15000 ✅
- [x] Cập nhật currentKm = 20000
- [x] Kiểm tra DB: work_orders.currentKm = 20000 ✅

### Test Case 2: Không thể sửa sản phẩm phiếu đã thanh toán
- [ ] Tạo phiếu + thanh toán đủ
- [ ] Mở lại phiếu
- [ ] Try to change parts → Disabled ✅
- [ ] Try to change price → Disabled ✅
- [ ] Can change technician name → Enabled ✅
- [ ] Can change notes → Enabled ✅

### Test Case 3: Workflow hủy phiếu
- [ ] Phiếu đã thanh toán → Click "Hủy phiếu"
- [ ] Nhập lý do hủy
- [ ] Confirm → Phiếu status = "Đã hủy"
- [ ] Kho được hoàn lại ✅
- [ ] Tiền được hoàn lại (tạo refund transaction) ✅
- [ ] Gợi ý "Tạo phiếu mới?" với pre-fill data ✅

---

## 📞 NEXT STEPS

1. ✅ **DONE:** Deploy SQL migration cho currentKm
2. ⏭️ **TODO:** Discuss với team về phương án xử lý cập nhật phiếu đã thanh toán
3. ⏭️ **TODO:** Implement phương án đã chọn
4. ⏭️ **TODO:** Update user manual
5. ⏭️ **TODO:** Train user về quy trình mới

---

**Người phát hiện:** User  
**Người phân tích:** GitHub Copilot  
**Quyết định phương án:** [TBD - Cần discuss với team]
