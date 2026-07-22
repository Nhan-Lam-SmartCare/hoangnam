-- Add device_photos column to work_orders.
-- Bug fix: ảnh thiết bị (devicePhotos) được upload lên storage nhưng URL chưa
-- bao giờ được lưu vào phiếu — đóng modal là mất liên kết ảnh.
-- Idempotent: can be re-run safely.

BEGIN;

-- 1) Canonical snake_case column (same convention as additional_services).
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS device_photos JSONB;

-- 2) Backfill from variant columns if they exist (defensive — schema drift).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'devicePhotos'
  ) THEN
    EXECUTE $sql$
      UPDATE public.work_orders
      SET device_photos = COALESCE(device_photos, "devicePhotos")
      WHERE device_photos IS NULL
        AND "devicePhotos" IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'devicephotos'
  ) THEN
    EXECUTE $sql$
      UPDATE public.work_orders
      SET device_photos = COALESCE(device_photos, devicephotos)
      WHERE device_photos IS NULL
        AND devicephotos IS NOT NULL
    $sql$;
  END IF;
END $$;

COMMIT;
