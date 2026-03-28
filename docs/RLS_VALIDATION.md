# RLS_VALIDATION

> Ngày xác nhận: 2025-11-10
> Môi trường: Project host `uvaxkefgehiokxkvaqge.supabase.co`

## Cập nhật 2025-11-11

- sale_create_atomic: thêm kiểm tra nội bộ UNAUTHORIZED (chỉ owner/manager) và BRANCH_MISMATCH (không cho phép khác chi nhánh).
- Bật RLS cho audit_logs, cho phép SELECT/INSERT cho authenticated (xem dữ liệu qua view mask audit_logs_with_user), UPDATE/DELETE chỉ owner.
- Thêm index `idx_sales_branch_date` cho sales(branchId, date DESC) để tối ưu lọc theo chi nhánh/thời gian.

## Vai trò

| Role    | Mô tả             | Phạm vi dự kiến                                                                                                                               |
| ------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| owner   | Chủ hệ thống      | Toàn quyền trên mọi bảng (trong branch của mình hoặc tất cả nếu policy cho phép)                                                              |
| manager | Quản lý chi nhánh | CRUD các bảng vận hành (work_orders, sales, inventory_transactions, cash_transactions...) trong branch                                        |
| staff   | Nhân viên         | Giới hạn đọc/ghi (ví dụ: có thể xem `sales`, tạo `work_orders` được phân công; bị chặn với các bảng dòng tiền & tồn kho nếu thiết kế như vậy) |

## Bảng trọng yếu

```
customers
parts
work_orders
sales
cash_transactions
payment_sources
inventory_transactions
categories
```

(Được tạo chuẩn trong `sql/2025-11-10_schema_setup_clean.sql`)

## Quy trình test sử dụng script `scripts/test-rls.mjs`

1. Đăng nhập tuần tự từng user thật (manager / staff / owner).
2. In ra Project host + UserID để đảm bảo đúng môi trường.
3. Truy vấn role theo `id` và theo `email` để đối chiếu lệch môi trường.
4. Kiểm tra tồn tại bảng qua `information_schema.tables` trước khi SELECT.
5. SELECT hạn chế `id` từ từng bảng để xác định có quyền đọc (RLS chặn sẽ trả về lỗi; bảng không tồn tại sẽ được đánh dấu bỏ qua).

## Kết quả cuối cùng (sau khi đồng bộ .env đúng project)

| Email                            | Role(id) | Role(email) | Khớp kỳ vọng | Ghi chú |
| -------------------------------- | -------- | ----------- | ------------ | ------- |
| truongcuongya123@gmail.com       | manager  | manager     | ✔            |         |
| nguyenthanhloc28052007@gmail.com | staff    | staff       | ✔            |         |
| lam.tcag@gmail.com               | owner    | owner       | ✔            |         |

Staff bị chặn đúng trên bảng nhạy cảm (`inventory_transactions`, `cash_transactions`) theo thiết kế.

## Các điểm kiểm chứng bổ sung nên làm thủ công

- Staff tạo `work_orders`: được phép.
- Staff tạo `inventory_transactions`: bị chặn (kỳ vọng).
- Owner xoá `cash_transactions`: được phép.
- Manager sửa `sales`: được phép nếu policy cho chi nhánh.

## Sai lệch đã xử lý

- Trước đó role trả về luôn `staff` do trỏ sai Supabase project trong `.env`.
- Script test đã thêm đối chiếu host để phát hiện lệch môi trường.

## Khuyến nghị tiếp theo

1. Viết test tự động (Vitest) mock Supabase client cho 1–2 policy quan trọng.
2. Thêm RPC helper audit (ví dụ: `mc_current_role()` trả về role hiện tại) và đưa vào script test.
3. Ghi chú chính sách chi tiết vào `AUTH_IMPLEMENTATION_SUMMARY.md` (liên kết file này).
4. Tạo dashboard nội bộ hiển thị vai trò & branch hiện hành + trạng thái RLS (dev only).

## Phụ lục: Câu lệnh SQL nhanh kiểm tra profiles

```sql
SELECT email, role, branch_id FROM public.profiles
WHERE lower(email) IN (
  'truongcuongya123@gmail.com',
  'nguyenthanhloc28052007@gmail.com',
  'lam.tcag@gmail.com'
);
```

---

Đã xác nhận RLS ở mức cơ bản. Nếu thay đổi policies, cập nhật lại bảng “Kết quả cuối cùng” và ngày xác nhận.
