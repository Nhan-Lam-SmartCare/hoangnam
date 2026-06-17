-- ============================================================
-- 2026-06-17_work_order_payment_consistency.sql
--
-- Mục tiêu:
--   1. Đảm bảo cột work_orders.inventory_deducted tồn tại (cờ chống trừ kho 2 lần).
--   2. Tạo index cho cash_transactions theo cột tham chiếu phiếu sửa chữa
--      (reference / workorderid / workOrderId) để truy vấn idempotent
--      recordWorkOrderPaymentTransactions() nhanh và không quét toàn bảng.
--
-- Idempotent: chạy lại nhiều lần đều an toàn (IF NOT EXISTS + kiểm tra cột động).
-- Lưu ý: file này KHÔNG định nghĩa RPC. RPC thanh toán atomic nằm ở
--        sql/work_order_complete_payment.sql — chạy file đó trước (hoặc cùng đợt).
-- ============================================================

BEGIN;

-- 1) Cờ trừ kho (đồng bộ với work_order_complete_payment.sql)
ALTER TABLE IF EXISTS public.work_orders
  ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT FALSE;

-- 2) Index cho các cột tham chiếu phiếu trên cash_transactions.
--    Tên cột không nhất quán giữa các deployment nên tạo index theo cột thực có.
DO $$
DECLARE
  v_col TEXT;
  v_idx TEXT;
BEGIN
  FOREACH v_col IN ARRAY ARRAY['reference', 'workorderid', 'workOrderId']
  LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'cash_transactions'
        AND column_name = v_col
    ) THEN
      v_idx := 'idx_cash_transactions_' || lower(v_col);
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS %I ON public.cash_transactions (%I)',
        v_idx,
        v_col
      );
    END IF;
  END LOOP;
END $$;

COMMIT;

-- 3) Kiểm tra nhanh (tùy chọn):
-- SELECT indexname FROM pg_indexes
-- WHERE schemaname = 'public' AND tablename = 'cash_transactions'
--   AND indexname LIKE 'idx_cash_transactions_%';
