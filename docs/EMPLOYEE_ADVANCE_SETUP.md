# Hướng dẫn Setup Employee Advance (Ứng lương) trên Supabase

## Bước 1: Chạy Migration SQL

1. Đăng nhập vào Supabase Dashboard: https://app.supabase.com
2. Chọn project của bạn
3. Vào **SQL Editor** (biểu tượng 🔍 ở sidebar)
4. Tạo query mới và copy nội dung file `sql/employee_advance_schema.sql`
5. Click **RUN** để thực thi

## Bước 2: Kiểm tra Tables đã tạo

Vào **Table Editor** và kiểm tra 2 tables mới:

- ✅ `employee_advances` - Quản lý đơn ứng lương
- ✅ `employee_advance_payments` - Lịch sử thanh toán trả góp

## Bước 3: Kiểm tra RLS Policies

Vào **Authentication** → **Policies** và kiểm tra các policies:

- Owner/Manager có thể xem/tạo/cập nhật/xóa ứng lương
- Nhân viên chỉ xem ứng lương của mình

## Bước 4: Test tính năng

1. Vào trang **Nhân viên** → Tab **Ứng lương**
2. Thử tạo đơn ứng lương mới
3. Kiểm tra dữ liệu đã lưu vào Supabase
4. Test các chức năng:
   - ✅ Tạo đơn ứng lương
   - ✅ Chọn nguồn tiền (Tiền mặt/Chuyển khoản)
   - ✅ Trả góp hàng tháng
   - ✅ Duyệt/Từ chối đơn
   - ✅ Chi trả
   - ✅ Xóa đơn (pending/rejected)

## Schema Details

### Table: employee_advances

```sql
id                  UUID PRIMARY KEY
employee_id         UUID → employees(id)
employee_name       TEXT
advance_amount      NUMERIC(12,2)
advance_date        TIMESTAMPTZ
reason              TEXT
payment_method      TEXT (cash/transfer) ← MỚI
status              TEXT (pending/approved/rejected/paid)
approved_by         TEXT
approved_date       TIMESTAMPTZ
is_installment      BOOLEAN
installment_months  INTEGER
monthly_deduction   NUMERIC(12,2)
remaining_amount    NUMERIC(12,2)
paid_amount         NUMERIC(12,2)
branch_id           UUID
created_at          TIMESTAMPTZ
updated_at          TIMESTAMPTZ
```

### Table: employee_advance_payments

```sql
id                  UUID PRIMARY KEY
advance_id          UUID → employee_advances(id)
employee_id         UUID → employees(id)
amount              NUMERIC(12,2)
payment_date        TIMESTAMPTZ
payment_month       TEXT (YYYY-MM)
payroll_record_id   UUID (optional)
notes               TEXT
branch_id           UUID
created_at          TIMESTAMPTZ
```

## Triggers

1. **update_employee_advance_updated_at**: Tự động cập nhật `updated_at` khi có thay đổi
2. **update_advance_amounts_on_payment**: Tự động cập nhật `paid_amount` và `remaining_amount` khi có payment mới

## View: employee_advances_summary

Tổng hợp thông tin ứng lương với:

- Thông tin nhân viên (position, department)
- Số lần thanh toán
- Tổng tiền đã trả qua payments

## Tích hợp với Sổ quỹ

Khi chi trả ứng lương (status = "paid"), cần ghi nhận vào sổ quỹ:

- `payment_method = "cash"` → Giảm quỹ tiền mặt
- `payment_method = "transfer"` → Giảm tài khoản ngân hàng

**TODO**: Tích hợp với cash_transactions hoặc inventory_transactions để tự động ghi sổ khi chi trả.

## Notes

- Chỉ Owner/Manager mới có quyền tạo/duyệt/xóa đơn ứng lương
- Nhân viên có thể xem đơn ứng lương của mình (RLS policy)
- Đơn ứng lương pending/rejected có thể xóa, đơn approved/paid không thể xóa
- Hỗ trợ trả góp hàng tháng với tự động tính monthly_deduction
