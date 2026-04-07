BEGIN;

DO $$
DECLARE
  rec RECORD;
  v_prefix TEXT;
  v_digits TEXT;
  v_candidate TEXT;
  v_try INTEGER;
  v_cols TEXT;
  v_select_cols TEXT;
  v_updated INTEGER := 0;
BEGIN
  CREATE TEMP TABLE _wo_id_map (
    old_id TEXT PRIMARY KEY,
    new_id TEXT NOT NULL UNIQUE
  ) ON COMMIT DROP;

  FOR rec IN
    SELECT w.id
    FROM public.work_orders w
    WHERE w.id IS NOT NULL
      AND w.id !~ '^[A-Z0-9]{1,6}-[A-Z0-9]{6}$'
      AND (w.id ~ '(WO-)?[0-9]{10,}' OR w.id ~ '[0-9]{10,}')
    ORDER BY COALESCE(w.updated_at, w.created_at, NOW()) ASC
  LOOP
    v_prefix := split_part(rec.id, '-', 1);
    v_prefix := upper(regexp_replace(COALESCE(v_prefix, ''), '[^A-Z0-9]', '', 'g'));

    IF v_prefix = '' OR v_prefix ~ '^[0-9]+$' OR v_prefix = 'WO' THEN
      v_prefix := 'SC';
    END IF;

    v_prefix := left(v_prefix, 4);

    SELECT (regexp_match(rec.id, '([0-9]{10,})'))[1] INTO v_digits;
    IF v_digits IS NULL OR length(v_digits) = 0 THEN
      CONTINUE;
    END IF;

    v_candidate := v_prefix || '-' || lpad(right(v_digits, 6), 6, '0');
    v_try := 0;

    WHILE EXISTS (SELECT 1 FROM public.work_orders w WHERE w.id = v_candidate AND w.id <> rec.id)
       OR EXISTS (SELECT 1 FROM _wo_id_map m WHERE m.new_id = v_candidate)
    LOOP
      v_try := v_try + 1;
      v_candidate := v_prefix || '-' || substring(upper(md5(rec.id || ':' || v_try::text)) FROM 1 FOR 6);
    END LOOP;

    INSERT INTO _wo_id_map (old_id, new_id) VALUES (rec.id, v_candidate);
  END LOOP;

  IF NOT EXISTS (SELECT 1 FROM _wo_id_map) THEN
    RAISE NOTICE 'No legacy work_order IDs found. Nothing to migrate.';
    RETURN;
  END IF;

  SELECT string_agg(format('%I', a.attname), ', ' ORDER BY a.attnum),
         string_agg(format('w.%I', a.attname), ', ' ORDER BY a.attnum)
    INTO v_cols, v_select_cols
  FROM pg_attribute a
  WHERE a.attrelid = 'public.work_orders'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped
    AND a.attname <> 'id';

  EXECUTE format(
    'INSERT INTO public.work_orders (id, %s)
     SELECT m.new_id, %s
     FROM public.work_orders w
     JOIN _wo_id_map m ON m.old_id = w.id',
    v_cols,
    v_select_cols
  );

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'repair_order_services' AND column_name = 'repair_order_id'
  ) THEN
    UPDATE public.repair_order_services ros
    SET repair_order_id = m.new_id
    FROM _wo_id_map m
    WHERE ros.repair_order_id = m.old_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'customer_debts' AND column_name = 'work_order_id'
  ) THEN
    UPDATE public.customer_debts cd
    SET work_order_id = m.new_id
    FROM _wo_id_map m
    WHERE cd.work_order_id = m.old_id;

    UPDATE public.customer_debts cd
    SET id = 'CDEBT-WO-' || m.new_id
    FROM _wo_id_map m
    WHERE cd.id = 'CDEBT-WO-' || m.old_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.customer_debts x
        WHERE x.id = 'CDEBT-WO-' || m.new_id
      );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'workOrderId'
  ) THEN
    EXECUTE '
      UPDATE public.inventory_transactions it
      SET "workOrderId" = m.new_id
      FROM _wo_id_map m
      WHERE it."workOrderId" = m.old_id
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_transactions' AND column_name = 'workorderid'
  ) THEN
    UPDATE public.inventory_transactions it
    SET workorderid = m.new_id
    FROM _wo_id_map m
    WHERE it.workorderid = m.old_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_transactions' AND column_name = 'workOrderId'
  ) THEN
    EXECUTE '
      UPDATE public.cash_transactions ct
      SET "workOrderId" = m.new_id
      FROM _wo_id_map m
      WHERE ct."workOrderId" = m.old_id
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_transactions' AND column_name = 'workorderid'
  ) THEN
    UPDATE public.cash_transactions ct
    SET workorderid = m.new_id
    FROM _wo_id_map m
    WHERE ct.workorderid = m.old_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cashtransactions' AND column_name = 'workOrderId'
  ) THEN
    EXECUTE '
      UPDATE public.cashtransactions ct
      SET "workOrderId" = m.new_id
      FROM _wo_id_map m
      WHERE ct."workOrderId" = m.old_id
    ';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cashtransactions' AND column_name = 'workorderid'
  ) THEN
    UPDATE public.cashtransactions ct
    SET workorderid = m.new_id
    FROM _wo_id_map m
    WHERE ct.workorderid = m.old_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cash_transactions' AND column_name = 'reference'
  ) THEN
    UPDATE public.cash_transactions ct
    SET reference = m.new_id
    FROM _wo_id_map m
    WHERE ct.reference = m.old_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cashtransactions' AND column_name = 'reference'
  ) THEN
    UPDATE public.cashtransactions ct
    SET reference = m.new_id
    FROM _wo_id_map m
    WHERE ct.reference = m.old_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'warranty_cards' AND column_name = 'work_order_id'
  ) THEN
    UPDATE public.warranty_cards wc
    SET work_order_id = m.new_id
    FROM _wo_id_map m
    WHERE wc.work_order_id = m.old_id;
  END IF;

  DELETE FROM public.work_orders w
  USING _wo_id_map m
  WHERE w.id = m.old_id;

  SELECT COUNT(*) INTO v_updated FROM _wo_id_map;
  RAISE NOTICE 'Migrated % work_order IDs to compact format.', v_updated;
END
$$;

COMMIT;
