-- 2026-06-21_add_category_pricing_rules.sql
-- Thêm cột cấu hình tỉ lệ markup và làm tròn giá vào bảng categories để đồng bộ giữa các thiết bị.

BEGIN;

ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS markup_percent INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS rounding_rule TEXT DEFAULT 'integer';

COMMIT;
