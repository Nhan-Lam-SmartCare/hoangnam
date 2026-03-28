# Fix: Số KM hiện tại không được lưu trong phiếu sửa chữa

## Vấn đề

Khi tạo hoặc cập nhật phiếu sửa chữa, trường "Số KM hiện tại" không được lưu vào database.

## Nguyên nhân

1. ❌ Field `currentKm` không được truyền vào hàm create/update work order
2. ❌ Hàm `normalizeWorkOrder` thiếu mapping cho field này
3. ❌ SQL function `work_order_create_atomic` thiếu parameter `p_current_km`

## Giải pháp đã thực hiện

### 1. ✅ Cập nhật WorkOrderModal.tsx

- Thêm `currentKm: formData.currentKm` vào tất cả các object WorkOrder
- Thêm vào `createWorkOrderAtomicAsync` call
- Thêm vào database update object (với key `currentkm` - lowercase)

### 2. ✅ Cập nhật workOrdersRepository.ts

- Thêm mapping trong `normalizeWorkOrder`:
  ```typescript
  currentKm: row.currentkm || row.currentKm,
  ```

### 3. 📝 **CẦN CHẠY SQL MIGRATION**

**QUAN TRỌNG:** Bạn cần chạy file SQL sau trong Supabase SQL Editor:

```
sql/2025-12-06_add_currentkm_to_work_order_functions.sql
```

**Các bước thực hiện:**

1. Mở **Supabase Dashboard** → **SQL Editor**
2. Copy toàn bộ nội dung file `sql/2025-12-06_add_currentkm_to_work_order_functions.sql`
3. Paste vào SQL Editor
4. Click **Run** để thực thi

Migration này sẽ:

- ✅ Cập nhật function `work_order_create_atomic` để nhận parameter `p_current_km`
- ✅ Thêm `currentKm` vào INSERT statement
- ✅ Cấp quyền execute cho authenticated users

## Kiểm tra sau khi fix

1. **Refresh trang** trong trình duyệt
2. Tạo phiếu sửa chữa mới, nhập số km (ví dụ: 15000)
3. Lưu phiếu
4. Mở lại phiếu → Kiểm tra số km có hiển thị đúng không
5. Cập nhật số km → Lưu → Kiểm tra lại

## Kết quả mong đợi

- ✅ Số km được lưu khi tạo phiếu mới
- ✅ Số km được cập nhật khi sửa phiếu
- ✅ Số km hiển thị đúng khi xem chi tiết phiếu
- ✅ Dữ liệu được đồng bộ giữa UI và database

## Lưu ý

- Cột `currentKm` đã tồn tại trong database (migration `2025-11-28_add_currentKm_to_work_orders.sql`)
- Postgres tự động lowercase tên cột: `currentKm` → `currentkm`
- Code phải mapping cả 2 dạng: `row.currentkm || row.currentKm`
