# Hướng dẫn Tối ưu Performance cho Trang Dịch vụ Sửa chữa

## ✅ Đã Triển khai

### 1. **Pagination + Date Filtering (Frontend)**

- ✅ Mặc định load **7 ngày gần đây** (thay vì toàn bộ)
- ✅ Người dùng có thể chọn:
  - Hôm nay (1 ngày)
  - 7 ngày qua (mặc định)
  - 30 ngày qua
  - Tất cả (load toàn bộ - chậm hơn)

### 2. **Optimized Database Query**

- ✅ Filter trên server-side (database)
- ✅ Giới hạn 100 records per query
- ✅ Cache 30 giây để giảm tải

### 3. **Database Indexes (Cần chạy SQL)**

File: `sql/2025-12-12_optimize_workorders_indexes.sql`

## 🚀 Cách Chạy SQL Indexes

### Bước 1: Vào Supabase Dashboard

1. Truy cập: https://supabase.com/dashboard
2. Chọn project **Motocare**
3. Vào **SQL Editor** (menu bên trái)

### Bước 2: Copy & Run SQL

1. Mở file `sql/2025-12-12_optimize_workorders_indexes.sql`
2. Copy toàn bộ nội dung
3. Paste vào SQL Editor
4. Click **Run** hoặc nhấn `Ctrl+Enter`

### Bước 3: Verify

Chạy query kiểm tra:

```sql
SELECT
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'work_orders'
ORDER BY indexname;
```

Kết quả phải có các indexes:

- ✅ `idx_work_orders_creationdate`
- ✅ `idx_work_orders_status`
- ✅ `idx_work_orders_branchid`
- ✅ `idx_work_orders_date_branch_status`
- ✅ `idx_work_orders_paymentstatus`
- ✅ `idx_work_orders_customerphone`
- ✅ `idx_work_orders_licenseplate`

## 📊 Kết quả Mong đợi

### Trước tối ưu:

- Load **TẤT CẢ** phiếu (VD: 1000 phiếu)
- Thời gian: ~2-5 giây
- Filter chạy trên client

### Sau tối ưu:

- Load **7 ngày gần đây** (VD: 50-100 phiếu)
- Thời gian: ~0.3-0.8 giây
- Filter chạy trên database
- Có cache 30 giây

### Với 1000 phiếu:

- **7 ngày**: Load ~50-100 phiếu → **Nhanh gấp 10-20 lần**
- **30 ngày**: Load ~200-300 phiếu → **Nhanh gấp 3-5 lần**
- **Tất cả**: Load toàn bộ → Vẫn nhanh hơn nhờ indexes

## 💡 Lưu ý cho User

### UI thay đổi:

1. Dropdown "Lọc theo ngày" mặc định là "7 ngày qua"
2. Option "Tất cả (chậm hơn)" để nhắc user

### Khi nào dùng "Tất cả"?

- Tìm phiếu cũ (> 30 ngày)
- Báo cáo tổng quan dài hạn
- Export dữ liệu

### Khi nào dùng filter ngắn hơn?

- Làm việc hàng ngày (dùng "Hôm nay" hoặc "7 ngày")
- Check phiếu gần đây
- Mobile (để load nhanh)

## 🔍 Monitoring

### Check hiệu suất trong Console:

Mở DevTools > Console, sẽ thấy log:

```
[fetchWorkOrdersFiltered] Loaded 52 orders (limit: 100, daysBack: 7)
```

### Nếu vẫn chậm:

1. Check số lượng records trong 7 ngày
2. Nếu > 100, có thể giảm limit hoặc daysBack
3. Check indexes đã chạy chưa

## 📈 Mở rộng trong tương lai

### Infinite Scroll (nếu cần):

- Load thêm 50 records khi scroll đến cuối
- Giữ filter hiện tại

### Real-time Updates:

- Dùng Supabase Realtime cho phiếu mới
- Chỉ subscribe trong khoảng thời gian đang xem

### Export Reports:

- Tạo background job để export dữ liệu lớn
- Gửi email khi xong thay vì load trực tiếp
