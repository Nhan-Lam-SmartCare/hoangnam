# Dashboard

Mô tả ngắn:
Giao diện tổng quan hiển thị các chỉ số chính (KPIs) và nhanh chóng truy cập tới các chức năng chính của hệ thống.

Quyền truy cập:
- Roles thường có: Admin, Manager, Staff (tùy cấu hình)

Các tác vụ/flow chính:
1. Xem bảng điều khiển tổng quan về doanh số, số lượng dịch vụ, tồn kho, phiếu bảo hành, v.v.
2. Lọc khoảng thời gian (ngày/tuần/tháng/quý)
3. Bấm vào một widget để điều hướng tới trang chi tiết (ví dụ: Reports, Sales)

Thành phần giao diện liên quan:
- Các widget KPI (card)
- Biểu đồ (chart) — doanh thu, số lượng giao dịch
- Bảng tóm tắt giao dịch gần nhất
- Bộ lọc thời gian, bộ lọc chi nhánh/tiệm

API / endpoint liên quan (ví dụ):
- GET /api/dashboard/summary
- GET /api/dashboard/sales?from=...&to=...

Lưu ý / Edge cases:
- Dữ liệu cache vs realtime: cần chỉ rõ tần suất làm mới số liệu
- Quyền xem báo cáo nhạy cảm (doanh thu) cần kiểm tra role
- Khi không có dữ liệu, hiển thị trạng thái rỗng rõ ràng

Test cases:
- Hiển thị đúng KPI cho user có quyền
- Bấm vào widget điều hướng đúng
- Thay đổi khoảng thời gian cập nhật biểu đồ
