# Hướng dẫn Cập nhật Realtime - Motocare

## 📋 Tổng quan

Toàn bộ ứng dụng đã được cấu hình để **cập nhật giao diện ngay lập tức** sau mọi thao tác CRUD (Create, Read, Update, Delete) mà không cần reload trang. Hệ thống sử dụng **2 cơ chế** để đảm bảo dữ liệu luôn đồng bộ:

### 🔄 Cơ chế 1: React Query Auto-Invalidation
- Khi thực hiện thao tác (tạo, sửa, xóa), React Query tự động invalidate cache
- Dữ liệu được refetch ngay lập tức
- Hoạt động trên cùng một thiết bị/tab

### 📡 Cơ chế 2: Supabase Realtime Subscriptions
- Lắng nghe thay đổi từ database theo thời gian thực
- Khi có thiết bị khác thay đổi dữ liệu, các thiết bị khác nhận được cập nhật ngay
- Hoạt động **đa thiết bị, đa người dùng** - không cần refresh trang
- **MỚI**: Đã kích hoạt cho work_orders, sales, parts, customers, và các bảng quan trọng

## ✅ Các tính năng đã được cập nhật

### 🔥 1. **Phiếu Sửa Chữa (Work Orders)** - MỚI!

#### Khi tạo phiếu mới:
- ✅ Danh sách phiếu cập nhật ngay lập tức (tất cả devices)
- ✅ Tồn kho phụ tùng cập nhật real-time
- ✅ Thông báo gửi đến owner/manager ngay
- ✅ Thống kê dashboard cập nhật tự động

#### Khi cập nhật trạng thái phiếu:
- ✅ UI cập nhật ngay (không cần reload)
- ✅ Tất cả người dùng thấy trạng thái mới nhất
- ✅ Filter tự động cập nhật số lượng

#### Khi thanh toán/hoàn tiền:
- ✅ Tình trạng thanh toán cập nhật real-time
- ✅ Tồn kho được điều chỉnh ngay
- ✅ Lịch sử giao dịch hiển thị ngay

**Realtime Subscription:**
```typescript
// ServiceManager.tsx
supabase
  .channel("work_orders_realtime")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "work_orders",
  }, (payload) => {
    refetchWorkOrders(); // Auto refetch
  })
  .subscribe();
```

**Queries được invalidate:**
```typescript
qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] });
qc.invalidateQueries({ queryKey: ["partsRepo"] });
qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] });
qc.invalidateQueries({ queryKey: ["cashTransactions"] });
```

---

### 🛒 2. **Bán hàng (Sales)** - CẢI TIẾN!

#### Khi tạo đơn hàng mới:

- ✅ Danh sách đơn hàng cập nhật ngay (tất cả devices)
- ✅ Tồn kho giảm ngay lập tức
- ✅ Lịch sử xuất kho hiển thị ngay
- ✅ Thống kê doanh thu cập nhật tự động
- ✅ **MỚI**: Đồng nghiệp thấy đơn hàng mới ngay lập tức

**Realtime Subscription:**
```typescript
// SalesManager.tsx
supabase
  .channel("sales_realtime")
  .on("postgres_changes", {
    event: "*",
    schema: "public",
    table: "sales",
  }, (payload) => {
    queryClient.invalidateQueries({ queryKey: ["salesRepoPaged"] });
  })
  .subscribe();
```

**Queries được invalidate:**

```typescript
qc.invalidateQueries({ queryKey: ["salesRepo"] });
qc.invalidateQueries({ queryKey: ["salesRepoPaged"] });
qc.invalidateQueries({ queryKey: ["salesRepoKeyset"] });
qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Stock update
qc.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Stock update
qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Inventory history
```

#### Khi xóa/hoàn tiền đơn hàng:

- ✅ Đơn hàng biến mất khỏi danh sách ngay
- ✅ Tồn kho được hoàn lại ngay
- ✅ Lịch sử kho cập nhật real-time
- ✅ **MỚI**: Tất cả devices đồng bộ ngay

#### Khi trả hàng một phần:

- ✅ Số lượng trong đơn cập nhật
- ✅ Tồn kho tăng lại theo số lượng trả
- ✅ Lịch sử xuất/nhập kho cập nhật

---

### 📦 3. **Quản lý Kho (Inventory)**

#### Khi tạo phiếu nhập kho:

- ✅ Danh sách phiếu nhập hiển thị ngay
- ✅ Tồn kho tăng ngay lập tức
- ✅ Giá nhập/bán được cập nhật
- ✅ Lịch sử nhập kho hiển thị đầy đủ

**Queries được invalidate:**

```typescript
queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });
queryClient.invalidateQueries({ queryKey: ["inventoryTxRepo"] });
queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });
```

#### Khi thêm/sửa/xóa sản phẩm:

- ✅ Danh sách sản phẩm cập nhật ngay
- ✅ Bộ lọc và tìm kiếm hoạt động tức thì
- ✅ Thống kê tồn kho tự động refresh

---

### 3. **Sửa chữa (Service/Work Orders)**

#### Khi tạo lệnh sửa chữa mới:

- ✅ Danh sách lệnh sửa chữa cập nhật ngay
- ✅ Phụ tùng sử dụng trừ kho tức thì
- ✅ Lịch sử xuất kho hiển thị ngay
- ✅ Trạng thái xe cập nhật tự động

**Queries được invalidate:**

```typescript
qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
qc.invalidateQueries({ queryKey: ["partsRepo"] });
qc.invalidateQueries({ queryKey: ["partsRepoPaged"] });
qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] });
```

#### Khi cập nhật/hủy/hoàn tiền lệnh sửa chữa:

- ✅ Trạng thái cập nhật ngay lập tức
- ✅ Tồn kho được hoàn lại (nếu hủy/refund)
- ✅ Lịch sử kho cập nhật đầy đủ

---

### 4. **Khách hàng (Customers)**

#### Khi thêm/sửa/xóa khách hàng:

- ✅ Danh sách khách hàng refresh ngay
- ✅ Thông tin chi tiết cập nhật tức thì
- ✅ Điểm thành viên hiển thị chính xác

**Queries được invalidate:**

```typescript
queryClient.invalidateQueries({ queryKey: ["customers"] });
```

---

### 5. **Nhà cung cấp (Suppliers)**

#### Khi thêm/sửa/xóa nhà cung cấp:

- ✅ Danh sách NCC cập nhật ngay
- ✅ Công nợ hiển thị chính xác
- ✅ Lịch sử giao dịch đồng bộ

**Queries được invalidate:**

```typescript
queryClient.invalidateQueries({ queryKey: ["suppliers"] });
```

---

## 🔧 Cơ chế hoạt động

### React Query + Invalidation

Ứng dụng sử dụng **React Query** để quản lý cache và tự động refetch data khi cần:

1. **Sau mỗi mutation thành công** → Invalidate queries liên quan
2. **React Query tự động refetch** → UI cập nhật ngay
3. **Background updates** → Không làm gián đoạn UX

### Optimistic Updates (Optional)

Có thể bật optimistic updates để UI phản hồi ngay cả trước khi server xác nhận:

```typescript
onMutate: async (newData) => {
  // Cancel outgoing refetches
  await qc.cancelQueries({ queryKey: ["salesRepo"] });

  // Snapshot previous value
  const previous = qc.getQueryData(["salesRepo"]);

  // Optimistically update
  qc.setQueryData(["salesRepo"], (old) => [...old, newData]);

  return { previous };
};
```

---

## 📊 Danh sách Query Keys

### Sales (Bán hàng)

- `salesRepo` - Danh sách đơn hàng
- `salesRepoPaged` - Đơn hàng phân trang (offset)
- `salesRepoKeyset` - Đơn hàng phân trang (keyset)

### Inventory (Kho)

- `partsRepo` - Danh sách sản phẩm
- `partsRepoPaged` - Sản phẩm phân trang
- `inventoryTxRepo` - Lịch sử xuất/nhập kho
- `inventoryTransactions` - Transaction history

### Service (Sửa chữa)

- `workOrdersRepo` - Danh sách lệnh sửa chữa

### Customers & Suppliers

- `customers` - Danh sách khách hàng
- `suppliers` - Danh sách nhà cung cấp

---

## 🎯 Best Practices

### 1. Luôn invalidate đủ queries liên quan

```typescript
// ❌ Sai - Chỉ invalidate một query
qc.invalidateQueries({ queryKey: ["salesRepo"] });

// ✅ Đúng - Invalidate tất cả queries liên quan
qc.invalidateQueries({ queryKey: ["salesRepo"] });
qc.invalidateQueries({ queryKey: ["salesRepoPaged"] });
qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Nếu có trừ kho
qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Nếu có lịch sử
```

### 2. Sử dụng atomic operations

```typescript
// ✅ Đúng - Dùng atomic RPC
await createSaleAtomic(saleData); // Tự động trừ kho + tạo lịch sử

// ❌ Sai - Tách rời operations
await createSale(saleData);
await updateStock(items); // Risk: Race condition
await createInventoryTx(items);
```

### 3. Toast messages hợp lý

```typescript
onSuccess: () => {
  showToast.success("Đã tạo đơn hàng"); // Short & clear
  // Không spam nhiều toast cùng lúc
};
```

---

## 🐛 Troubleshooting

### Vấn đề: UI không cập nhật sau mutation

**Nguyên nhân:** Thiếu invalidate queries

**Giải pháp:**

```typescript
// Kiểm tra console log
console.log("✅ Mutation success, invalidating queries...");
qc.invalidateQueries({ queryKey: ["yourQueryKey"] });
```

### Vấn đề: Tồn kho bị nhân đôi

**Nguyên nhân:** Trigger + Manual update cùng cập nhật stock

**Giải pháp:** Đã fix trong `receipt_create_atomic.sql` - chỉ trigger update stock

### Vấn đề: Queries bị refetch quá nhiều

**Nguyên nhân:** Invalidate quá rộng

**Giải pháp:**

```typescript
// ❌ Tránh invalidate toàn bộ
qc.invalidateQueries(); // Too broad!

// ✅ Chỉ invalidate cụ thể
qc.invalidateQueries({ queryKey: ["salesRepo"] });
```

---

## 📝 Checklist khi thêm feature mới

Khi implement feature CRUD mới, đảm bảo:

- [ ] Mutation hook có `onSuccess` callback
- [ ] `onSuccess` invalidate đủ queries liên quan
- [ ] Test thêm/sửa/xóa → UI cập nhật ngay
- [ ] Test trên mobile và desktop
- [ ] Toast message rõ ràng và không spam
- [ ] Console log để debug (có thể remove sau)

---

## 🎉 Kết luận

Toàn bộ ứng dụng đã được tối ưu để:

- ✅ **Realtime updates** - Không cần reload trang
- ✅ **Multi-device sync** - Cập nhật đồng thời trên tất cả thiết bị
- ✅ **Consistent UI** - Luôn đồng bộ với server
- ✅ **Fast UX** - Background refetch không block UI
- ✅ **Reliable** - Atomic operations đảm bảo data integrity

**Nguyên tắc vàng:** Mỗi mutation → Invalidate đủ queries → Realtime subscription → UI tự cập nhật! 🚀

---

## 🚀 Hướng dẫn Kích hoạt Realtime (Migration)

### Bước 1: Chạy Migration SQL

Vào **Supabase Dashboard** → **SQL Editor** và chạy file:

```bash
sql/2026-01-03_enable_realtime_for_core_tables.sql
```

Hoặc copy-paste nội dung sau:

```sql
-- Enable Realtime for core tables
ALTER PUBLICATION supabase_realtime ADD TABLE work_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE sales;
ALTER PUBLICATION supabase_realtime ADD TABLE parts;
ALTER PUBLICATION supabase_realtime ADD TABLE customers;
ALTER PUBLICATION supabase_realtime ADD TABLE cash_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE inventory_transactions;
```

### Bước 2: Kiểm tra Realtime đã được bật

Chạy query kiểm tra:

```sql
SELECT schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
ORDER BY schemaname, tablename;
```

Kết quả phải bao gồm:
- ✅ work_orders
- ✅ sales
- ✅ parts
- ✅ customers
- ✅ cash_transactions
- ✅ inventory_transactions

### Bước 3: Restart Dev Server

```bash
npm run dev
```

### Bước 4: Test Realtime

1. **Mở 2 tab/thiết bị** với cùng tài khoản
2. **Tab 1**: Tạo phiếu sửa chữa mới
3. **Tab 2**: Xem danh sách phiếu → Phải thấy phiếu mới **xuất hiện ngay** (không cần F5)
4. **Tab 1**: Cập nhật trạng thái phiếu
5. **Tab 2**: Trạng thái phải thay đổi **ngay lập tức**

### Bước 5: Kiểm tra Console Log

Mở Developer Tools (F12), vào tab **Console**, bạn sẽ thấy:

```
[ServiceManager] Setting up realtime subscription...
[Realtime] Subscription status: SUBSCRIBED
[Realtime] Work order changed: { event: 'INSERT', ... }
```

### Troubleshooting

#### ❌ Realtime không hoạt động

1. **Kiểm tra Supabase Dashboard**:
   - Settings → API → Realtime → Phải là **Enabled**

2. **Kiểm tra Network**:
   - F12 → Network → WS (WebSocket) → Phải có kết nối `realtime-v1.supabase.co`

3. **Kiểm tra RLS**:
   - User phải có quyền SELECT trên table để nhận realtime updates

4. **Restart browser**:
   - Clear cache và restart để lấy connection mới

#### ❌ Chỉ thấy cập nhật trên cùng tab

- Đây là React Query invalidation (bình thường)
- Realtime subscription chỉ hoạt động **giữa các tab/thiết bị khác nhau**

#### ❌ Console báo lỗi "Channel already exists"

- Bình thường khi hot reload trong development
- Production không có vấn đề này

---

## 📊 Performance Impact

### Before (Chỉ có React Query):
- ✅ Cập nhật trong cùng tab/device
- ❌ Cần F5 để thấy thay đổi từ thiết bị khác
- ❌ Nhiều người dùng không thấy data realtime

### After (React Query + Realtime):
- ✅ Cập nhật trong cùng tab/device
- ✅ Tự động sync giữa tất cả thiết bị
- ✅ Không cần F5
- ✅ Team collaboration tốt hơn
- ⚠️ Tăng ~5-10 WebSocket connections (chấp nhận được)

---

**Nguyên tắc vàng:** Mỗi mutation → Invalidate đủ queries → Realtime subscription → UI tự cập nhật trên TẤT CẢ thiết bị! 🚀
