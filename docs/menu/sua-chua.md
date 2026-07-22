# Sửa chữa

Mô tả:
- Quản lý dịch vụ sửa chữa: tạo phiếu sửa, theo dõi trạng thái, cập nhật tiến trình sửa chữa.

Quyền truy cập:
- Mọi người dùng có thể thấy mục này (NavLink to="/service").

Đường dẫn (route):
- /service

Các tác vụ chính:
- Tạo phiếu sửa chữa mới.
- Cập nhật trạng thái (nhận máy, đang sửa, hoàn thành).
- Thêm ghi chú, phụ tùng, chi phí sửa chữa.
- In hoá đơn / phiếu giao trả.

Thành phần giao diện liên quan:
- NavLink (label="Sửa chữa") trong src/components/layout/Nav.tsx
- Các component tạo/hiển thị phiếu sửa trong src/components/service hoặc tương ứng.

API/endpoint liên quan:
- Route frontend: /service
- API backend: các endpoint liên quan đến `service`/`repair` (xem mã backend).

Kiểm tra / Lưu ý:
- Kiểm tra quy trình cập nhật trạng thái và thông báo cho khách hàng.
- Kiểm tra việc tính chi phí và ghi log thay đổi.
