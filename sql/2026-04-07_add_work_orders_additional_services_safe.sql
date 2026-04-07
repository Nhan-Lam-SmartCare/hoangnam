-- Safe one-time migration: normalize external services storage for work_orders
-- Idempotent: can be re-run safely.

BEGIN;

-- 1) Ensure canonical column exists.
ALTER TABLE public.work_orders
  ADD COLUMN IF NOT EXISTS additional_services JSONB;

-- 2) If canonical column is empty/null, backfill from known variant columns when available.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'additionalServices'
  ) THEN
    EXECUTE $sql$
      UPDATE public.work_orders
      SET additional_services = COALESCE(additional_services, "additionalServices")
      WHERE additional_services IS NULL
        AND "additionalServices" IS NOT NULL
    $sql$;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'work_orders'
      AND column_name = 'additionalservices'
  ) THEN
    EXECUTE $sql$
      UPDATE public.work_orders
      SET additional_services = COALESCE(additional_services, additionalservices)
      WHERE additional_services IS NULL
        AND additionalservices IS NOT NULL
    $sql$;
  END IF;
END $$;

-- 3) Backfill from notes marker [ADDITIONAL_SERVICES]:<json>
--    Only for rows still missing canonical data.
DO $$
DECLARE
  r RECORD;
  payload_text TEXT;
  payload_json JSONB;
BEGIN
  FOR r IN
    SELECT id, notes
    FROM public.work_orders
    WHERE additional_services IS NULL
      AND notes IS NOT NULL
      AND notes LIKE '%[ADDITIONAL_SERVICES]:%'
  LOOP
    payload_text := trim(split_part(r.notes, '[ADDITIONAL_SERVICES]:', 2));
    IF payload_text IS NULL OR payload_text = '' THEN
      CONTINUE;
    END IF;

    BEGIN
      payload_json := payload_text::jsonb;
      IF jsonb_typeof(payload_json) = 'array' THEN
        UPDATE public.work_orders
        SET additional_services = payload_json
        WHERE id = r.id
          AND additional_services IS NULL;
      END IF;
    EXCEPTION
      WHEN others THEN
        -- Skip malformed payload rows without aborting whole migration.
        CONTINUE;
    END;
  END LOOP;
END $$;

-- 4) Optional cleanup: remove marker blob from notes when backfill was successful.
UPDATE public.work_orders
SET notes = NULLIF(trim(split_part(notes, '[ADDITIONAL_SERVICES]:', 1)), '')
WHERE notes IS NOT NULL
  AND notes LIKE '%[ADDITIONAL_SERVICES]:%'
  AND additional_services IS NOT NULL;

-- 5) Normalize nulls to empty array for easier reads.
UPDATE public.work_orders
SET additional_services = '[]'::jsonb
WHERE additional_services IS NULL;

-- 6) Helpful index for JSONB queries.
CREATE INDEX IF NOT EXISTS idx_work_orders_additional_services_gin
  ON public.work_orders USING gin (additional_services);

COMMIT;
