# 🐛 FIX: Lỗi Cập Nhật Thanh Toán Trên Mobile

## 📋 MÔ TẢ VẤN ĐỀ

**Triệu chứng:**
- Trên giao diện **MOBILE** khi vào cập nhật thanh toán cho phiếu sửa chữa
- Hệ thống báo **THÀNH CÔNG** nhưng trạng thái vẫn hiển thị **CHƯA THANH TOÁN**
- Trên **DESKTOP** hoạt động bình thường

**Môi trường:** Giao diện mobile (điện thoại)

## 🔍 NGUYÊN NHÂN

Khi so sánh code giữa Desktop Modal và Mobile Modal, phát hiện:

### ✅ Desktop (WorkOrderModal.tsx) - ĐÚNG
```typescript
// Dòng 2239-2270
onSave(finalOrder);

// 🔹 FIX: Nếu cập nhật phiếu thành paymentStatus = 'paid', gọi complete_payment để trừ kho
const wasUnpaidOrPartial = order.paymentStatus !== "paid";
if (
  paymentStatus === "paid" &&
  wasUnpaidOrPartial &&
  selectedParts.length > 0
) {
  try {
    console.log(
      "[handleSave] Order became fully paid, calling completeWorkOrderPayment to deduct inventory"
    );
    const result = await completeWorkOrderPayment(
      order.id,
      formData.paymentMethod || "cash",
      0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
    );
    if (!result.ok) {
      showToast.warning(
        "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " +
        (result.error.message || "Unknown error")
      );
    }
  } catch (error: any) {
    console.error("[handleSave] Error deducting inventory:", error);
    showToast.warning(
      "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " + error.message
    );
  }
}
```

### ❌ Mobile (ServiceManager.tsx - handleMobileSave) - LỖI

**TRƯỚC KHI SỬA:**
```typescript
// Dòng 1096-1158 (UPDATE ORDER section)
await updateWorkOrderAtomicAsync({
  // ... update parameters
});

// ❌ THIẾU logic gọi completeWorkOrderPayment
// Chỉ tạo finalOrderData và show toast success

finalOrderData = {
  ...editingOrder,
  // ... updated fields
};

showToast.success("Cập nhật phiếu sửa chữa thành công!");
```

**VẤN ĐỀ:**
- Desktop có logic gọi `completeWorkOrderPayment` khi cập nhật phiếu từ `unpaid/partial` → `paid`
- Mobile (ServiceManager.tsx) **CHỈ CÓ** logic này khi **TẠO MỚI** phiếu (dòng 1052-1062)
- Mobile **KHÔNG CÓ** logic này khi **CẬP NHẬT** phiếu (UPDATE ORDER section)

## ✅ GIẢI PHÁP

### 1️⃣ ServiceManager.tsx

**SAU KHI SỬA:**
```typescript
// Dòng 1096-1180
await updateWorkOrderAtomicAsync({
  // ... update parameters
});

// 🔹 FIX Mobile: Nếu cập nhật phiếu thành paymentStatus = 'paid', gọi complete_payment để trừ kho
const wasUnpaidOrPartial = editingOrder.paymentStatus !== "paid";
if (
  paymentStatus === "paid" &&
  wasUnpaidOrPartial &&
  parts.length > 0
) {
  try {
    console.log(
      "[handleMobileSave] Order became fully paid, calling completeWorkOrderPayment to deduct inventory"
    );
    await completeWorkOrderPayment(
      editingOrder.id,
      paymentMethod || "cash",
      0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
    );
  } catch (err: any) {
    console.error("[handleMobileSave] Error deducting inventory:", err);
    showToast.warning(
      "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " +
      (err.message || "Unknown error")
    );
  }
}

finalOrderData = {
  ...editingOrder,
  // ... updated fields
};

showToast.success("Cập nhật phiếu sửa chữa thành công!");
```

### 2️⃣ ServiceManager.legacy.tsx

Áp dụng fix tương tự cho file legacy.

## 📝 FILES THAY ĐỔI

1. ✅ `src/components/service/ServiceManager.tsx`
   - Đã có import `completeWorkOrderPayment`
   - Thêm logic gọi function khi update phiếu từ unpaid/partial → paid

2. ✅ `src/components/service/ServiceManager.legacy.tsx`
   - Thêm import `completeWorkOrderPayment`
   - Thêm logic gọi function khi update phiếu từ unpaid/partial → paid

## 🧪 CÁCH KIỂM TRA

1. Mở app trên **điện thoại** (mobile)
2. Tạo một phiếu sửa chữa có phụ tùng, trạng thái **chưa thanh toán**
3. Vào **cập nhật** phiếu đó
4. Chuyển trạng thái thành "Trả máy" và tick **thanh toán khi trả xe** với 100%
5. **Lưu phiếu**

**KẾT QUẢ MONG ĐỢI:**
- ✅ Phiếu được cập nhật thành công
- ✅ Trạng thái thanh toán chuyển sang **ĐÃ THANH TOÁN** (màu xanh)
- ✅ Tồn kho phụ tùng được trừ đúng
- ✅ Không còn hiển thị "Chưa thanh toán" sau khi đã thanh toán

## 🔗 LIÊN QUAN

- [FIX_PAYMENT_DOUBLE_DEDUCTION.md](FIX_PAYMENT_DOUBLE_DEDUCTION.md) - Logic trừ kho khi tạo phiếu mới
- [ISSUE_UPDATE_PAID_WORKORDER.md](ISSUE_UPDATE_PAID_WORKORDER.md) - Vấn đề cập nhật phiếu đã thanh toán
- [PHIEU_SUA_CHUA_CHECKLIST.md](PHIEU_SUA_CHUA_CHECKLIST.md) - Checklist toàn bộ logic phiếu sửa chữa

## 📅 THÔNG TIN

- **Ngày fix:** 2026-01-07
- **Người fix:** GitHub Copilot
- **Loại lỗi:** Logic thiếu trên mobile
- **Mức độ nghiêm trọng:** 🔴 HIGH (Ảnh hưởng thanh toán và tồn kho)
