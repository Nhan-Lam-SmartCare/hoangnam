-- ============================================================
-- 2026-07-11_labor_rpc_security_definer.sql
--
-- TIỀN ĐỀ cho việc siết labor RLS (2026-07-11_tighten_labor_rls_final.sql).
--
-- VẤN ĐỀ (verify prod 2026-07-11):
--   upsert_repair_order_labor_bundle(text, jsonb)  -> prosecdef = FALSE
--   recalculate_repair_order_labor_totals(text)    -> prosecdef = FALSE
--   => 2 hàm chạy bằng quyền NGƯỜI GỌI. Khi staff tạo phiếu, hàm bị RLS chặn
--      như chính staff. Nếu siết labor "chỉ owner/manager ghi" mà 2 hàm này
--      KHÔNG phải SECURITY DEFINER → staff KHÔNG tạo được phiếu sửa.
--
-- GIẢI PHÁP: chuyển 2 hàm sang SECURITY DEFINER + khóa search_path (bắt buộc
--   với SECURITY DEFINER để chống tấn công search_path). Không đụng thân hàm.
--
-- AN TOÀN:
--   - Hàm thuộc sở hữu của role migration (thường là postgres/owner) → định
--     nghĩa lại chế độ quyền không đổi logic.
--   - ALTER ... SECURITY DEFINER: staff gọi qua RPC sẽ chạy bằng quyền owner
--     hàm → bypass RLS → ghi được labor khi tạo phiếu (đúng thiết kế).
--   - Idempotent, bọc transaction.
--
-- SAU FILE NÀY: kiểm chứng prosecdef=true rồi mới chạy
--   sql/2026-07-11_tighten_labor_rls_final.sql
-- ============================================================

BEGIN;

-- upsert_repair_order_labor_bundle(text, jsonb)
ALTER FUNCTION public.upsert_repair_order_labor_bundle(text, jsonb)
  SECURITY DEFINER;
ALTER FUNCTION public.upsert_repair_order_labor_bundle(text, jsonb)
  SET search_path = public;

-- recalculate_repair_order_labor_totals(text)  (được upsert gọi lồng bên trong)
ALTER FUNCTION public.recalculate_repair_order_labor_totals(text)
  SECURITY DEFINER;
ALTER FUNCTION public.recalculate_repair_order_labor_totals(text)
  SET search_path = public;

-- Đảm bảo authenticated được EXECUTE (staff cần gọi khi tạo phiếu)
GRANT EXECUTE ON FUNCTION public.upsert_repair_order_labor_bundle(text, jsonb)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.recalculate_repair_order_labor_totals(text)
  TO authenticated, service_role;

COMMIT;

-- ============================================================
-- VERIFY (kỳ vọng: cả 2 hàm security_definer = true)
-- ============================================================
-- SELECT proname, prosecdef AS security_definer,
--        proconfig  -- kỳ vọng chứa search_path=public
-- FROM pg_proc
-- WHERE pronamespace='public'::regnamespace
--   AND proname IN ('upsert_repair_order_labor_bundle',
--                   'recalculate_repair_order_labor_totals');
