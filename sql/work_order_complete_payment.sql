-- ============================================================
-- work_order_complete_payment.sql
-- One-shot script to create/replace RPC function:
--   public.work_order_complete_payment(
--     p_order_id text,
--     p_payment_method text,
--     p_payment_amount numeric,
--     p_user_id text
--   )
--
-- Safe for mixed schemas (camelCase/lowercase payment columns).
-- ============================================================

-- 1) Ensure inventory_deducted exists (idempotent)
ALTER TABLE IF EXISTS public.work_orders
ADD COLUMN IF NOT EXISTS inventory_deducted BOOLEAN DEFAULT FALSE;

-- 2) Create/replace RPC
CREATE OR REPLACE FUNCTION public.work_order_complete_payment(
  p_order_id TEXT,
  p_payment_method TEXT,
  p_payment_amount NUMERIC,
  p_user_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row_json JSONB;
  v_current_total NUMERIC := 0;
  v_current_paid NUMERIC := 0;
  v_deposit NUMERIC := 0;
  v_add_paid NUMERIC := 0;
  v_new_paid NUMERIC := 0;
  v_remaining NUMERIC := 0;
  v_new_status TEXT := 'unpaid';
  v_branch_id TEXT := 'CN1';
  v_parts JSONB := '[]'::jsonb;
  v_inventory_deducted BOOLEAN := FALSE;
  v_wo_status TEXT := '';
  v_is_completion BOOLEAN := FALSE;

  v_set_clause TEXT := '';
  v_col_exists BOOLEAN := FALSE;

  v_item JSONB;
  v_part_id TEXT;
  v_part_name TEXT;
  v_qty NUMERIC;
  v_stock_json JSONB;
  v_current_stock NUMERIC;

  v_shortages JSONB := '[]'::jsonb;
BEGIN
  -- Lock target order
  SELECT to_jsonb(w)
  INTO v_row_json
  FROM public.work_orders w
  WHERE w.id = p_order_id
  FOR UPDATE;

  IF v_row_json IS NULL THEN
    RAISE EXCEPTION 'ORDER_NOT_FOUND';
  END IF;

  v_current_total := COALESCE((v_row_json ->> 'total')::numeric, 0);
  v_current_paid := COALESCE(
    (v_row_json ->> 'totalPaid')::numeric,
    (v_row_json ->> 'totalpaid')::numeric,
    0
  );
  v_deposit := COALESCE(
    (v_row_json ->> 'depositAmount')::numeric,
    (v_row_json ->> 'depositamount')::numeric,
    0
  );
  v_add_paid := GREATEST(0, COALESCE(p_payment_amount, 0));
  v_new_paid := v_current_paid + v_add_paid;
  v_remaining := GREATEST(0, v_current_total - v_new_paid);

  v_new_status := CASE
    WHEN v_remaining <= 0 THEN 'paid'
    WHEN v_new_paid > 0 THEN 'partial'
    ELSE 'unpaid'
  END;

  v_branch_id := COALESCE(
    NULLIF(v_row_json ->> 'branchId', ''),
    NULLIF(v_row_json ->> 'branchid', ''),
    'CN1'
  );

  v_parts := COALESCE(v_row_json -> 'partsUsed', v_row_json -> 'partsused', '[]'::jsonb);
  v_inventory_deducted := COALESCE((v_row_json ->> 'inventory_deducted')::boolean, FALSE);

  -- #3: Trừ kho khi phiếu đã hoàn tất/trả máy (phụ tùng đã dùng), không đợi
  -- thu đủ tiền. So khớp cả dạng có dấu lẫn không dấu của trạng thái.
  v_wo_status := lower(COALESCE(v_row_json ->> 'status', ''));
  v_is_completion := v_wo_status IN (
    'trả máy', 'tra may',
    'đã sửa xong', 'da sua xong',
    'hoàn tất', 'hoan tat',
    'completed'
  );

  -- Build dynamic update clause for mixed schemas
  -- payment status
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'paymentStatus'
  ) INTO v_col_exists;
  IF v_col_exists THEN
    v_set_clause := v_set_clause || '"paymentStatus" = ' || quote_literal(v_new_status) || ', ';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'paymentstatus'
    ) INTO v_col_exists;
    IF v_col_exists THEN
      v_set_clause := v_set_clause || 'paymentstatus = ' || quote_literal(v_new_status) || ', ';
    END IF;
  END IF;

  -- payment method
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'paymentMethod'
  ) INTO v_col_exists;
  IF v_col_exists THEN
    v_set_clause := v_set_clause || '"paymentMethod" = ' || quote_literal(COALESCE(p_payment_method, 'cash')) || ', ';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'paymentmethod'
    ) INTO v_col_exists;
    IF v_col_exists THEN
      v_set_clause := v_set_clause || 'paymentmethod = ' || quote_literal(COALESCE(p_payment_method, 'cash')) || ', ';
    END IF;
  END IF;

  -- total paid
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'totalPaid'
  ) INTO v_col_exists;
  IF v_col_exists THEN
    v_set_clause := v_set_clause || '"totalPaid" = ' || v_new_paid || ', ';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'totalpaid'
    ) INTO v_col_exists;
    IF v_col_exists THEN
      v_set_clause := v_set_clause || 'totalpaid = ' || v_new_paid || ', ';
    END IF;
  END IF;

  -- additional payment
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'additionalPayment'
  ) INTO v_col_exists;
  IF v_col_exists THEN
    v_set_clause := v_set_clause || '"additionalPayment" = ' || GREATEST(0, v_new_paid - v_deposit) || ', ';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'additionalpayment'
    ) INTO v_col_exists;
    IF v_col_exists THEN
      v_set_clause := v_set_clause || 'additionalpayment = ' || GREATEST(0, v_new_paid - v_deposit) || ', ';
    END IF;
  END IF;

  -- remaining amount
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'remainingAmount'
  ) INTO v_col_exists;
  IF v_col_exists THEN
    v_set_clause := v_set_clause || '"remainingAmount" = ' || v_remaining || ', ';
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'remainingamount'
    ) INTO v_col_exists;
    IF v_col_exists THEN
      v_set_clause := v_set_clause || 'remainingamount = ' || v_remaining || ', ';
    END IF;
  END IF;

  -- payment date when fully paid
  IF v_new_status = 'paid' THEN
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'paymentDate'
    ) INTO v_col_exists;
    IF v_col_exists THEN
      v_set_clause := v_set_clause || '"paymentDate" = NOW(), ';
    ELSE
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'paymentdate'
      ) INTO v_col_exists;
      IF v_col_exists THEN
        v_set_clause := v_set_clause || 'paymentdate = NOW(), ';
      END IF;
    END IF;
  END IF;

  -- updated_at
  SELECT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'work_orders' AND column_name = 'updated_at'
  ) INTO v_col_exists;
  IF v_col_exists THEN
    v_set_clause := v_set_clause || 'updated_at = NOW(), ';
  END IF;

  -- Trim trailing comma+space
  IF right(v_set_clause, 2) = ', ' THEN
    v_set_clause := left(v_set_clause, length(v_set_clause) - 2);
  END IF;

  IF v_set_clause <> '' THEN
    EXECUTE 'UPDATE public.work_orders SET ' || v_set_clause || ' WHERE id = ' || quote_literal(p_order_id);
  END IF;

  -- Deduct stock once when order becomes fully paid OR is completed/handed over
  IF (v_new_status = 'paid' OR v_is_completion) AND NOT v_inventory_deducted THEN
    -- Validate stock first
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_parts, '[]'::jsonb))
    LOOP
      v_part_id := COALESCE(v_item ->> 'partId', v_item ->> 'part_id');
      v_part_name := COALESCE(v_item ->> 'partName', v_item ->> 'part_name', v_part_id, '?');
      v_qty := COALESCE((v_item ->> 'quantity')::numeric, 0);

      IF v_part_id IS NULL OR v_part_id = '' OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT stock
      INTO v_stock_json
      FROM public.parts
      WHERE id = v_part_id
      FOR UPDATE;

      IF v_stock_json IS NULL THEN
        RAISE EXCEPTION 'PART_NOT_FOUND:%', v_part_id;
      END IF;

      v_current_stock := COALESCE((v_stock_json ->> v_branch_id)::numeric, 0);

      IF v_current_stock < v_qty THEN
        v_shortages := v_shortages || jsonb_build_object(
          'partId', v_part_id,
          'partName', v_part_name,
          'available', v_current_stock,
          'requested', v_qty
        );
      END IF;
    END LOOP;

    IF jsonb_array_length(v_shortages) > 0 THEN
      RAISE EXCEPTION 'INSUFFICIENT_STOCK:%', v_shortages::text;
    END IF;

    -- Deduct stock
    FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(v_parts, '[]'::jsonb))
    LOOP
      v_part_id := COALESCE(v_item ->> 'partId', v_item ->> 'part_id');
      v_qty := COALESCE((v_item ->> 'quantity')::numeric, 0);

      IF v_part_id IS NULL OR v_part_id = '' OR v_qty <= 0 THEN
        CONTINUE;
      END IF;

      SELECT stock
      INTO v_stock_json
      FROM public.parts
      WHERE id = v_part_id
      FOR UPDATE;

      v_current_stock := COALESCE((v_stock_json ->> v_branch_id)::numeric, 0);

      UPDATE public.parts
      SET stock = jsonb_set(
        COALESCE(stock, '{}'::jsonb),
        ARRAY[v_branch_id],
        to_jsonb(GREATEST(0, v_current_stock - v_qty)),
        TRUE
      )
      WHERE id = v_part_id;
    END LOOP;

    UPDATE public.work_orders
    SET inventory_deducted = TRUE
    WHERE id = p_order_id;
  END IF;

  -- Return fresh row in expected payload shape
  SELECT to_jsonb(w)
  INTO v_row_json
  FROM public.work_orders w
  WHERE w.id = p_order_id;

  RETURN jsonb_build_object(
    'workOrder', v_row_json,
    'paymentTransactionId', NULL,
    'newPaymentStatus', v_new_status,
    'inventoryDeducted', (v_new_status = 'paid' OR v_is_completion)
  );
END;
$$;

-- 3) Permissions
GRANT EXECUTE ON FUNCTION public.work_order_complete_payment(TEXT, TEXT, NUMERIC, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.work_order_complete_payment(TEXT, TEXT, NUMERIC, TEXT) TO service_role;

-- 4) Quick verify
-- SELECT public.work_order_complete_payment('WO-TEST', 'cash', 0, 'manual');
