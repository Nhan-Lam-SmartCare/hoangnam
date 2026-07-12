# Runbook — Vá bảo mật RLS trên DB production (P0)

> Dành cho người có `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`. App đang **live** → làm theo đúng trình tự: **đọc-kiểm-tra → apply → verify**. Mọi file SQL dưới đây đều idempotent (chạy lại an toàn, không mất dữ liệu).

## Bước 1 — Kiểm tra trạng thái hiện tại (READ-ONLY, chạy trong Supabase SQL Editor)

```sql
-- (A) Policy đang áp dụng trên các bảng nhạy cảm
SELECT tablename, policyname, cmd, roles, qual
FROM pg_policies
WHERE schemaname='public'
  AND tablename IN ('payroll_records','cash_transactions','payment_sources',
                    'inventory_transactions','branches','services',
                    'repair_order_services','repair_order_service_workers',
                    'repair_order_service_items','warranty_cards','warranty_claims',
                    'profiles','sales')
ORDER BY tablename, cmd;

-- (B) anon còn quyền trên bảng nhạy cảm không (kỳ vọng cuối cùng: RỖNG)
SELECT table_name, privilege_type
FROM information_schema.role_table_grants
WHERE grantee='anon' AND table_schema='public'
  AND table_name IN ('payroll_records','cash_transactions','payment_sources',
                     'inventory_transactions','branches');

-- (C) RPC atomic đã deploy chưa (kỳ vọng: đủ 6 dòng)
SELECT proname FROM pg_proc
WHERE proname IN ('sale_create_atomic','sale_decrement_stock_atomic',
                  'sale_increment_stock_atomic','work_order_complete_payment',
                  'adjust_payment_source_balance_atomic','create_customer_metrics_atomic');
```

**Đọc kết quả:**
- (A) còn dòng nào `policyname = 'Enable all access for all users'` hoặc `qual = true` với `roles` chứa `public`/`anon` → **lỗ hổng còn mở → sang Bước 2**.
- (B) không rỗng → anon còn quyền → **sang Bước 2**.
- (C) thiếu proname nào → RPC đó chưa deploy → **apply file tương ứng ở Bước 3**.

## Bước 2 — Apply các migration siết RLS (đúng thứ tự)

Từ thư mục gốc repo, đảm bảo env có `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`, rồi chạy lần lượt:

```bash
node scripts/setup/apply-sql.mjs sql/2026-06-16_tighten_rls_sensitive_tables.sql
node scripts/setup/apply-sql.mjs sql/2026-06-19_secure_profiles_and_remaining_tables.sql
node scripts/setup/apply-sql.mjs sql/2026-06-19_followup_payment_sources_and_employee_salary.sql
node scripts/setup/apply-sql.mjs sql/2026-06-20_tighten_labor_rls.sql
```

> Nếu chưa quen `apply-sql.mjs`: có thể mở từng file `.sql` này, copy toàn bộ nội dung, dán vào **Supabase SQL Editor** và bấm Run. Nội dung nằm trong `BEGIN...COMMIT` nên hoặc chạy trọn vẹn hoặc rollback — an toàn.

## Bước 3 — Apply RPC atomic còn thiếu (chỉ file nào Bước 1-(C) báo thiếu)

```bash
node scripts/setup/apply-sql.mjs sql/2026-06-17_sale_create_atomic.sql
node scripts/setup/apply-sql.mjs sql/2026-06-17_sale_increment_stock_atomic.sql
node scripts/setup/apply-sql.mjs sql/2026-06-17_work_order_payment_consistency.sql
node scripts/setup/apply-sql.mjs sql/work_order_complete_payment.sql
```

Sau khi RPC `sale_create_atomic` chắc chắn tồn tại, luồng bán hàng sẽ **không** rơi vào nhánh fallback không-atomic nữa (app sẽ hiện toast cảnh báo nếu vẫn rơi vào — báo hiệu RPC chưa có).

## Bước 4 — Verify sau khi apply

Chạy lại (A), (B), (C) ở Bước 1. Kỳ vọng:
- (A): mỗi bảng nhạy cảm có các policy `*_select/_insert/_update/_delete` (hoặc `*_modify`) `TO authenticated` theo vai trò; **không còn** `qual = true` cho `public`.
- (B): **rỗng**.
- (C): đủ 6 RPC.

**Kiểm tra hành vi thực tế (quan trọng nhất):**
1. Đăng nhập bằng 1 tài khoản `staff` thuộc chi nhánh A → mở Sổ quỹ / Lương → **không** thấy dữ liệu chi nhánh B, không thấy lương.
2. Với staff, thử `UPDATE public.repair_order_service_workers SET worker_amount=99999 WHERE id='<một id>';` trong SQL Editor (dùng session của staff) → kỳ vọng **0 rows** (bị RLS chặn).
3. Tạo thử 1 đơn bán nhỏ bằng app → xác nhận trừ kho + ghi sổ quỹ đúng, **không** hiện toast "chế độ dự phòng".

## Ghi chú
- File `sql/RUNME_complete_migration.sql` và `sql/2026-04-01_add_repair_labor_module.sql` đã được sửa để **không còn tạo policy mở** (fail-closed). Nếu cài instance mới, luôn chạy các file tighten ở Bước 2 + 3 sau khi chạy RUNME.
- Chưa có bảng `schema_migrations` tracking → nên ghi lại (ví dụ trong file này) ngày đã apply từng migration lên production.
