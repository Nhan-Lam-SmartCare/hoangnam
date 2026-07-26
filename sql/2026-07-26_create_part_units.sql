-- ============================================================================
-- part_units — Quản lý tồn kho theo ĐƠN VỊ (serialized inventory)
-- Date: 2026-07-26
-- ============================================================================
--
-- BỐI CẢNH
--   Hàng có IMEI (điện thoại, máy) không quản lý được bằng con số tồn kho.
--   "Note 70 tồn 2" không cho biết máy nào còn, máy nào bán rồi, giá vốn từng
--   máy, hay hạn bảo hành theo IMEI. Bảng này lưu TỪNG MÁY VẬT LÝ là 1 dòng.
--
-- QUYẾT ĐỊNH THIẾT KẾ
--   1. parts.stock VẪN là nguồn sự thật cho con số tồn kho. part_units chạy
--      SONG SONG như sổ chi tiết. Lý do: đổi nguồn sự thật phải sửa ~40 chỗ đọc
--      stock[branch] (Dashboard, Báo cáo, Sửa chữa, Cầm đồ) — quá rủi ro.
--      View v_part_units_reconcile phát hiện lệch giữa hai bên.
--   2. KHÔNG có policy DELETE. Máy vật lý không biến mất khỏi sổ sách, chỉ đổi
--      status. Giữ vết kiểm toán.
--   3. Máy bán rồi khách trả lại -> UPDATE status về 'in_stock' trên CÙNG dòng,
--      không tạo dòng mới. Nhờ vậy IMEI unique không vỡ và lịch sử liền mạch.
--
-- KHẢO SÁT DB TRƯỚC KHI VIẾT (2026-07-26, đã xác nhận trên Primary Database):
--   - Không có trigger nào trên inventory_transactions -> stock do RPC cộng tay.
--   - parts.imei / parts.color TỒN TẠI nhưng RỖNG 0/359 dòng -> không cần
--     migrate dữ liệu cũ. Hai cột này sẽ DROP ở Phase 8 sau khi ổn định.
--   - current_user_role() và current_user_branch_id() đã deploy -> RLS dùng được.
--
-- Idempotent. Apply: node scripts/setup/apply-sql.mjs sql/2026-07-26_create_part_units.sql
-- ============================================================================

BEGIN;

-- ── 1. Đánh dấu sản phẩm nào quản lý theo IMEI ──────────────────────────────
-- Mặc định false: toàn bộ 359 sản phẩm hiện có giữ nguyên hành vi cũ.
-- Bật dần theo từng danh mục ở Phase 8, không bật đại trà.
ALTER TABLE public.parts
  ADD COLUMN IF NOT EXISTS is_serialized boolean NOT NULL DEFAULT false;

-- categories.is_serialized = giá trị mặc định cho sản phẩm mới thuộc danh mục đó.
DO $$
BEGIN
  IF to_regclass('public.categories') IS NOT NULL THEN
    ALTER TABLE public.categories
      ADD COLUMN IF NOT EXISTS is_serialized boolean NOT NULL DEFAULT false;
  END IF;
END $$;

-- ── 2. Bảng đơn vị ──────────────────────────────────────────────────────────
-- parts.id là TEXT (xem supabase_complete_setup.sql) -> part_id phải là TEXT.
CREATE TABLE IF NOT EXISTS public.part_units (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  part_id          text NOT NULL REFERENCES public.parts(id) ON DELETE RESTRICT,
  branch_id        text NOT NULL,

  imei             text NOT NULL,
  color            text,

  import_price     numeric(14,0) NOT NULL DEFAULT 0,   -- giá vốn THẬT của máy này
  selling_price    numeric(14,0),                      -- giá bán dự kiến khi nhập

  status           text NOT NULL DEFAULT 'in_stock',
  is_placeholder   boolean NOT NULL DEFAULT false,     -- backfill, chưa có IMEI thật

  -- Truy vết nhập
  receipt_code     text,
  supplier_id      text,
  received_at      timestamptz NOT NULL DEFAULT now(),

  -- Truy vết xuất
  sold_at          timestamptz,
  sale_id          text,
  work_order_id    text,
  warranty_card_id uuid,

  note             text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT part_units_status_chk CHECK (
    status IN ('in_stock','reserved','sold','returned','warranty','lost')
  ),
  CONSTRAINT part_units_imei_not_blank_chk CHECK (btrim(imei) <> '')
);

-- ── 3. Index ────────────────────────────────────────────────────────────────

-- Chốt chặn cuối chống nhập/bán trùng IMEI trên toàn hệ thống.
-- Loại trừ placeholder vì chúng mang mã tạm 'TMP-...' sinh hàng loạt.
-- Đã kiểm tra: hiện 0 IMEI trong DB -> index tạo được ngay, không cần dọn trùng.
CREATE UNIQUE INDEX IF NOT EXISTS uq_part_units_imei
  ON public.part_units (upper(btrim(imei)))
  WHERE is_placeholder = false;

-- Đếm tồn theo sản phẩm/chi nhánh (dùng cho view đối soát + màn tồn kho).
CREATE INDEX IF NOT EXISTS idx_part_units_part_branch_status
  ON public.part_units (part_id, branch_id, status);

-- Tra ngược từ đơn bán (hoàn tác, trả hàng).
CREATE INDEX IF NOT EXISTS idx_part_units_sale
  ON public.part_units (sale_id) WHERE sale_id IS NOT NULL;

-- Tìm kiếm theo IMEI ở ô search kho + tra bảo hành.
CREATE INDEX IF NOT EXISTS idx_part_units_imei_search
  ON public.part_units (upper(btrim(imei)) text_pattern_ops);

-- Danh sách máy còn bán được (truy vấn nóng nhất ở màn Bán hàng).
CREATE INDEX IF NOT EXISTS idx_part_units_available
  ON public.part_units (part_id, branch_id) WHERE status = 'in_stock';

-- ── 4. RLS ──────────────────────────────────────────────────────────────────
-- Theo quy tắc CLAUDE.md: owner xem tất cả, manager/staff giới hạn theo chi
-- nhánh. Policy đặt TO authenticated, thu hồi sạch quyền của anon.
ALTER TABLE public.part_units ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.part_units FROM anon;
GRANT SELECT, INSERT, UPDATE ON public.part_units TO authenticated;

DROP POLICY IF EXISTS part_units_select ON public.part_units;
CREATE POLICY part_units_select ON public.part_units
  FOR SELECT TO authenticated
  USING (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  );

DROP POLICY IF EXISTS part_units_insert ON public.part_units;
CREATE POLICY part_units_insert ON public.part_units
  FOR INSERT TO authenticated
  WITH CHECK (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  );

DROP POLICY IF EXISTS part_units_update ON public.part_units;
CREATE POLICY part_units_update ON public.part_units
  FOR UPDATE TO authenticated
  USING (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  )
  WITH CHECK (
    public.current_user_role() = 'owner'
    OR branch_id = public.current_user_branch_id()
  );

-- Cố ý KHÔNG có policy FOR DELETE.

-- ── 5. updated_at tự động ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.part_units_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_part_units_touch ON public.part_units;
CREATE TRIGGER trg_part_units_touch
  BEFORE UPDATE ON public.part_units
  FOR EACH ROW EXECUTE FUNCTION public.part_units_touch_updated_at();

-- ── 6. View đối soát ────────────────────────────────────────────────────────
-- Số máy còn trong part_units PHẢI khớp parts.stock[branch]. Lệch = có nghiệp
-- vụ nào đó đụng stock mà không đụng units (hoặc ngược lại). UI hiện badge
-- cảnh báo trên đúng dòng sản phẩm bị lệch.
-- security_invoker: view tôn trọng RLS của người gọi (xem 2026-07-11_views_security_invoker.sql).
CREATE OR REPLACE VIEW public.v_part_units_reconcile
WITH (security_invoker = true) AS
SELECT
  p.id                                                        AS part_id,
  p.name                                                      AS part_name,
  u.branch_id,
  count(*) FILTER (WHERE u.status = 'in_stock')               AS unit_count,
  COALESCE((p.stock ->> u.branch_id)::numeric, 0)             AS stock_count,
  count(*) FILTER (WHERE u.status = 'in_stock')
    - COALESCE((p.stock ->> u.branch_id)::numeric, 0)         AS lech,
  count(*) FILTER (WHERE u.is_placeholder)                    AS placeholder_count
FROM public.parts p
JOIN public.part_units u ON u.part_id = p.id
GROUP BY p.id, p.name, u.branch_id, p.stock;

COMMENT ON TABLE  public.part_units IS
  'Sổ chi tiết từng máy vật lý có IMEI. parts.stock vẫn là nguồn sự thật cho con số tồn; bảng này cho biết CỤ THỂ máy nào.';
COMMENT ON COLUMN public.part_units.is_placeholder IS
  'true = dòng sinh tự động từ backfill để khớp số tồn, IMEI là mã tạm TMP-*, cần kiểm kê tay điền IMEI thật.';
COMMENT ON COLUMN public.part_units.import_price IS
  'Giá vốn thật của ĐÚNG máy này, không phải bình quân. Dùng tính lãi thực từng máy.';

COMMIT;
