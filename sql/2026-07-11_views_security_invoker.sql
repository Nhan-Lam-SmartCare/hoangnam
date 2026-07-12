-- ============================================================
-- 2026-07-11_views_security_invoker.sql
--
-- MỤC TIÊU (P1): Bắt 2 view tôn trọng RLS của bảng gốc.
--   Mặc định view Postgres chạy bằng quyền OWNER của view (security_definer
--   ngầm) → BỎ QUA RLS bảng gốc. Hệ quả: user đăng nhập đọc view có thể thấy
--   dữ liệu CHÉO CHI NHÁNH:
--     - cash_transactions_ledger  (đọc sổ quỹ, app dùng ở cashTransactionsRepository)
--     - inventory_balances_view   (tồn kho)
--
--   security_invoker=on → view chạy bằng quyền NGƯỜI GỌI → áp RLS bảng gốc:
--     owner/manager: xem toàn bộ (policy cash_transactions_select cho phép);
--     staff: chỉ thấy chi nhánh của mình. Đúng ý định phân quyền.
--
-- YÊU CẦU: PostgreSQL 15+ (Supabase hiện đại đáp ứng). Kiểm tra: SHOW server_version;
--   Nếu < 15, bỏ qua file này (fallback: chỉ REVOKE anon — đã làm ở bước trước).
--
-- ĐIỀU KIỆN: role authenticated phải có SELECT trên bảng gốc (đã GRANT ở các
--   file tighten trước) để view invoker đọc được.
--
-- AN TOÀN: chỉ đổi thuộc tính view, không đổi dữ liệu. Idempotent.
-- ============================================================

BEGIN;

ALTER VIEW public.cash_transactions_ledger SET (security_invoker = on);
ALTER VIEW public.inventory_balances_view  SET (security_invoker = on);

COMMIT;

-- ============================================================
-- VERIFY
-- ============================================================
-- 1) Thuoc tinh view:
-- SELECT relname, reloptions FROM pg_class
-- WHERE relname IN ('cash_transactions_ledger','inventory_balances_view');
--   (ky vong: reloptions chua 'security_invoker=on')
--
-- 2) Dang nhap = staff chi nhanh A -> doc cash_transactions_ledger
--    => chi thay dong chi nhanh A (khong thay chi nhanh khac).
