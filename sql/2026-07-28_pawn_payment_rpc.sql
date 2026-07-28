-- ============================================================
-- 2026-07-28_pawn_payment_rpc.sql
-- RPC atomic cho nghiệp vụ cầm đồ (tiền + trạng thái hợp đồng phải cùng 1 transaction).
--
--   public.pawn_record_payment(...)      -- THU tiền: đóng lãi / trả bớt gốc / chuộc / thanh lý
--   public.pawn_record_disbursement(...) -- CHI tiền: giải ngân khi lập biên nhận / cho vay thêm
--   public.pawn_void_payment(...)        -- huỷ phiếu ghi sai (chỉ phiếu mới nhất)
--
-- Phụ thuộc: sql/2026-07-28_pawn_payments_ledger.sql (chạy trước).
-- Idempotent (CREATE OR REPLACE).
-- ============================================================

BEGIN;

-- ------------------------------------------------------------
-- Helper: cộng/trừ số dư 1 nguồn tiền trên đúng chi nhánh
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pawn_apply_source_delta(
  p_source_id TEXT,
  p_branch_id TEXT,
  p_delta     NUMERIC
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current NUMERIC := 0;
BEGIN
  IF p_source_id IS NULL OR p_source_id = '' OR COALESCE(p_delta, 0) = 0 THEN
    RETURN;
  END IF;

  PERFORM 1 FROM public.payment_sources WHERE id = p_source_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN; -- nguồn tiền không tồn tại -> bỏ qua, không chặn giao dịch
  END IF;

  SELECT COALESCE((balance ->> p_branch_id)::numeric, 0)
    INTO v_current
    FROM public.payment_sources
   WHERE id = p_source_id;

  UPDATE public.payment_sources
     SET balance = jsonb_set(
           COALESCE(balance, '{}'::jsonb),
           ARRAY[p_branch_id],
           to_jsonb(v_current + p_delta),
           TRUE
         )
   WHERE id = p_source_id;
END;
$$;

-- ------------------------------------------------------------
-- 1) THU tiền
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pawn_record_payment(
  p_pawn_id           TEXT,
  p_kind              TEXT,
  p_interest          NUMERIC DEFAULT 0,
  p_principal         NUMERIC DEFAULT 0,
  p_period_to         TIMESTAMPTZ DEFAULT NULL,
  p_new_end_date      TIMESTAMPTZ DEFAULT NULL,
  p_payment_source_id TEXT DEFAULT NULL,
  p_payment_date      TIMESTAMPTZ DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_payment_id        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec               public.pawn_records%ROWTYPE;
  v_role              TEXT;
  v_user_branch       TEXT;
  v_branch            TEXT;
  v_interest          NUMERIC := GREATEST(0, COALESCE(p_interest, 0));
  v_principal         NUMERIC := GREATEST(0, COALESCE(p_principal, 0));
  v_amount            NUMERIC;
  v_principal_before  NUMERIC;
  v_principal_after   NUMERIC;
  v_paid_until_before TIMESTAMPTZ;
  v_end_before        TIMESTAMPTZ;
  v_period_from       TIMESTAMPTZ;
  v_period_to         TIMESTAMPTZ;
  v_new_end_date      TIMESTAMPTZ;
  v_days              INTEGER;
  v_new_status        TEXT;
  v_payment_id        TEXT;
  v_tx_id             TEXT := NULL;
  v_category          TEXT;
  v_desc              TEXT;
  v_date              TIMESTAMPTZ := COALESCE(p_payment_date, now());
  v_uid               TEXT := COALESCE(auth.uid()::text, NULL);
  v_renew_inc         INTEGER := 0;
  v_payment           JSONB;
BEGIN
  IF p_kind NOT IN ('interest', 'principal', 'redeem', 'liquidation') THEN
    RAISE EXCEPTION 'INVALID_KIND:%', p_kind;
  END IF;

  SELECT * INTO v_rec FROM public.pawn_records WHERE id = p_pawn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAWN_NOT_FOUND';
  END IF;

  IF v_rec.status <> 'active' THEN
    RAISE EXCEPTION 'PAWN_NOT_ACTIVE';
  END IF;

  v_branch      := COALESCE(NULLIF(v_rec.branch_id, ''), 'CN1');
  v_role        := COALESCE(public.current_user_role(), 'staff');
  v_user_branch := COALESCE(public.current_user_branch_id(), 'CN1');

  IF v_role <> 'owner' AND v_branch <> v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_FORBIDDEN';
  END IF;

  v_principal_before  := COALESCE(v_rec.principal_outstanding, v_rec.loan_amount, 0);
  v_paid_until_before := COALESCE(v_rec.interest_paid_until, v_rec.start_date, v_rec.created_at);
  v_end_before        := v_rec.end_date;
  v_period_from       := v_paid_until_before;
  v_period_to         := COALESCE(p_period_to, v_paid_until_before);
  v_new_end_date      := COALESCE(p_new_end_date, v_rec.end_date);
  v_days              := GREATEST(0, (v_period_to::date - v_period_from::date));

  IF v_period_to < v_period_from THEN
    RAISE EXCEPTION 'PERIOD_TO_BEFORE_PAID_UNTIL';
  END IF;

  IF p_kind = 'liquidation' THEN
    v_principal_after := 0;
  ELSE
    v_principal_after := v_principal_before - v_principal;
    IF v_principal_after < 0 THEN
      RAISE EXCEPTION 'PRINCIPAL_EXCEEDS_OUTSTANDING';
    END IF;
  END IF;

  IF p_kind = 'redeem' AND v_principal_after > 0 THEN
    RAISE EXCEPTION 'PRINCIPAL_NOT_CLEARED';
  END IF;

  v_amount := v_interest + v_principal;

  IF p_kind IN ('interest', 'principal') AND v_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  v_new_status := CASE
    WHEN p_kind = 'redeem'      THEN 'redeemed'
    WHEN p_kind = 'liquidation' THEN 'liquidated'
    ELSE 'active'
  END;

  IF p_kind IN ('interest', 'principal') AND v_period_to > v_paid_until_before THEN
    v_renew_inc := 1;
  END IF;

  v_payment_id := COALESCE(
    NULLIF(p_payment_id, ''),
    'PP-' || to_char(v_date, 'YYYYMMDD') || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8)
  );

  v_category := CASE p_kind
    WHEN 'interest'    THEN 'pawn_interest'
    WHEN 'principal'   THEN 'pawn_principal'
    WHEN 'redeem'      THEN 'pawn_redeem'
    WHEN 'liquidation' THEN 'pawn_liquidation'
  END;

  v_desc := CASE p_kind
    WHEN 'interest'    THEN 'Thu lãi cầm đồ ' || p_pawn_id
    WHEN 'principal'   THEN 'Thu lãi + gốc cầm đồ ' || p_pawn_id
    WHEN 'redeem'      THEN 'Khách chuộc tài sản cầm đồ ' || p_pawn_id
    WHEN 'liquidation' THEN 'Thanh lý tài sản cầm đồ ' || p_pawn_id
  END;
  IF COALESCE(NULLIF(p_notes, ''), '') <> '' THEN
    v_desc := v_desc || ' - ' || p_notes;
  END IF;

  -- Ghi sổ quỹ (nếu có chọn nguồn tiền và có tiền thực thu)
  IF p_payment_source_id IS NOT NULL AND p_payment_source_id <> '' AND v_amount > 0 THEN
    v_tx_id := 'CTX-' || v_payment_id;

    INSERT INTO public.cash_transactions
      (id, type, amount, branchid, category, date, description, paymentsource, recipient, pawn_id, userid)
    VALUES
      (v_tx_id, 'income', v_amount, v_branch, v_category, v_date, v_desc,
       p_payment_source_id, COALESCE(v_rec.customer_name, 'Khách cầm đồ'), p_pawn_id, v_uid);

    PERFORM public.pawn_apply_source_delta(p_payment_source_id, v_branch, v_amount);
  END IF;

  INSERT INTO public.pawn_payments (
    id, pawn_id, kind, payment_date,
    interest_amount, principal_amount, amount,
    period_from, period_to, days,
    principal_before, principal_after,
    interest_paid_until_before, end_date_before, new_end_date,
    payment_source_id, cash_transaction_id,
    notes, created_by, branch_id
  ) VALUES (
    v_payment_id, p_pawn_id, p_kind, v_date,
    v_interest, v_principal, v_amount,
    v_period_from, v_period_to, v_days,
    v_principal_before, v_principal_after,
    v_paid_until_before, v_end_before, v_new_end_date,
    NULLIF(p_payment_source_id, ''), v_tx_id,
    NULLIF(p_notes, ''), v_uid, v_branch
  );

  UPDATE public.pawn_records
     SET principal_outstanding = v_principal_after,
         interest_paid_until   = v_period_to,
         end_date              = v_new_end_date,
         total_interest_paid   = COALESCE(total_interest_paid, 0) + v_interest,
         total_principal_paid  = COALESCE(total_principal_paid, 0) + v_principal,
         last_payment_date     = v_date,
         renew_count           = COALESCE(renew_count, 0) + v_renew_inc,
         status                = v_new_status,
         closed_at             = CASE WHEN v_new_status <> 'active' THEN v_date ELSE NULL END,
         closed_by             = CASE WHEN v_new_status <> 'active' THEN v_uid ELSE NULL END,
         updated_at            = now()
   WHERE id = p_pawn_id
   RETURNING * INTO v_rec;

  SELECT to_jsonb(p) INTO v_payment FROM public.pawn_payments p WHERE p.id = v_payment_id;

  RETURN jsonb_build_object(
    'record',  to_jsonb(v_rec),
    'payment', v_payment,
    'cashTransactionId', v_tx_id
  );
END;
$$;

-- ------------------------------------------------------------
-- 2) CHI tiền (giải ngân / cho vay thêm)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pawn_record_disbursement(
  p_pawn_id           TEXT,
  p_amount            NUMERIC,
  p_payment_source_id TEXT DEFAULT NULL,
  p_kind              TEXT DEFAULT 'disbursement',
  p_payment_date      TIMESTAMPTZ DEFAULT NULL,
  p_notes             TEXT DEFAULT NULL,
  p_payment_id        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rec              public.pawn_records%ROWTYPE;
  v_role             TEXT;
  v_user_branch      TEXT;
  v_branch           TEXT;
  v_amount           NUMERIC := GREATEST(0, COALESCE(p_amount, 0));
  v_principal_before NUMERIC;
  v_principal_after  NUMERIC;
  v_payment_id       TEXT;
  v_tx_id            TEXT := NULL;
  v_date             TIMESTAMPTZ := COALESCE(p_payment_date, now());
  v_uid              TEXT := COALESCE(auth.uid()::text, NULL);
  v_desc             TEXT;
  v_payment          JSONB;
BEGIN
  IF p_kind NOT IN ('disbursement', 'additional_loan') THEN
    RAISE EXCEPTION 'INVALID_KIND:%', p_kind;
  END IF;

  IF v_amount <= 0 THEN
    RAISE EXCEPTION 'AMOUNT_MUST_BE_POSITIVE';
  END IF;

  SELECT * INTO v_rec FROM public.pawn_records WHERE id = p_pawn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAWN_NOT_FOUND';
  END IF;

  IF p_kind = 'additional_loan' AND v_rec.status <> 'active' THEN
    RAISE EXCEPTION 'PAWN_NOT_ACTIVE';
  END IF;

  v_branch      := COALESCE(NULLIF(v_rec.branch_id, ''), 'CN1');
  v_role        := COALESCE(public.current_user_role(), 'staff');
  v_user_branch := COALESCE(public.current_user_branch_id(), 'CN1');

  IF v_role <> 'owner' AND v_branch <> v_user_branch THEN
    RAISE EXCEPTION 'BRANCH_FORBIDDEN';
  END IF;

  v_principal_before := COALESCE(v_rec.principal_outstanding, v_rec.loan_amount, 0);
  v_principal_after  := CASE WHEN p_kind = 'additional_loan'
                             THEN v_principal_before + v_amount
                             ELSE v_principal_before END;

  v_payment_id := COALESCE(
    NULLIF(p_payment_id, ''),
    'PP-' || to_char(v_date, 'YYYYMMDD') || '-' || substr(md5(random()::text || clock_timestamp()::text), 1, 8)
  );

  v_desc := CASE p_kind
    WHEN 'disbursement'    THEN 'Giải ngân cầm đồ ' || p_pawn_id
    WHEN 'additional_loan' THEN 'Cho vay thêm - cầm đồ ' || p_pawn_id
  END;
  IF COALESCE(NULLIF(p_notes, ''), '') <> '' THEN
    v_desc := v_desc || ' - ' || p_notes;
  END IF;

  IF p_payment_source_id IS NOT NULL AND p_payment_source_id <> '' THEN
    v_tx_id := 'CTX-' || v_payment_id;

    INSERT INTO public.cash_transactions
      (id, type, amount, branchid, category, date, description, paymentsource, recipient, pawn_id, userid)
    VALUES
      (v_tx_id, 'expense', v_amount, v_branch, 'pawn_loan', v_date, v_desc,
       p_payment_source_id, COALESCE(v_rec.customer_name, 'Khách cầm đồ'), p_pawn_id, v_uid);

    PERFORM public.pawn_apply_source_delta(p_payment_source_id, v_branch, -v_amount);
  END IF;

  INSERT INTO public.pawn_payments (
    id, pawn_id, kind, payment_date,
    interest_amount, principal_amount, amount,
    principal_before, principal_after,
    interest_paid_until_before, end_date_before,
    payment_source_id, cash_transaction_id,
    notes, created_by, branch_id
  ) VALUES (
    v_payment_id, p_pawn_id, p_kind, v_date,
    0, 0, v_amount,
    v_principal_before, v_principal_after,
    COALESCE(v_rec.interest_paid_until, v_rec.start_date), v_rec.end_date,
    NULLIF(p_payment_source_id, ''), v_tx_id,
    NULLIF(p_notes, ''), v_uid, v_branch
  );

  UPDATE public.pawn_records
     SET principal_outstanding    = v_principal_after,
         disbursement_cash_tx_id  = CASE WHEN p_kind = 'disbursement'
                                         THEN COALESCE(v_tx_id, disbursement_cash_tx_id)
                                         ELSE disbursement_cash_tx_id END,
         updated_at               = now()
   WHERE id = p_pawn_id
   RETURNING * INTO v_rec;

  SELECT to_jsonb(p) INTO v_payment FROM public.pawn_payments p WHERE p.id = v_payment_id;

  RETURN jsonb_build_object(
    'record',  to_jsonb(v_rec),
    'payment', v_payment,
    'cashTransactionId', v_tx_id
  );
END;
$$;

-- ------------------------------------------------------------
-- 3) Huỷ phiếu ghi sai (chỉ phiếu mới nhất của hợp đồng)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.pawn_void_payment(
  p_payment_id TEXT,
  p_reason     TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pay      public.pawn_payments%ROWTYPE;
  v_rec      public.pawn_records%ROWTYPE;
  v_latest   TEXT;
  v_role     TEXT;
  v_branch   TEXT;
  v_prev     TIMESTAMPTZ;
  v_uid      TEXT := COALESCE(auth.uid()::text, NULL);
  v_delta    NUMERIC;
BEGIN
  v_role := COALESCE(public.current_user_role(), 'staff');
  IF v_role NOT IN ('owner', 'manager') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT * INTO v_pay FROM public.pawn_payments WHERE id = p_payment_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_NOT_FOUND';
  END IF;

  IF v_pay.is_voided THEN
    RAISE EXCEPTION 'PAYMENT_ALREADY_VOIDED';
  END IF;

  SELECT * INTO v_rec FROM public.pawn_records WHERE id = v_pay.pawn_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAWN_NOT_FOUND';
  END IF;

  v_branch := COALESCE(NULLIF(v_rec.branch_id, ''), 'CN1');
  IF v_role <> 'owner' AND v_branch <> COALESCE(public.current_user_branch_id(), 'CN1') THEN
    RAISE EXCEPTION 'BRANCH_FORBIDDEN';
  END IF;

  -- Chỉ cho huỷ phiếu mới nhất: huỷ phiếu giữa chuỗi sẽ phá mắt xích snapshot
  SELECT id INTO v_latest
    FROM public.pawn_payments
   WHERE pawn_id = v_pay.pawn_id AND is_voided = FALSE
   ORDER BY payment_date DESC, created_at DESC
   LIMIT 1;

  IF v_latest IS DISTINCT FROM p_payment_id THEN
    RAISE EXCEPTION 'NOT_LATEST_PAYMENT';
  END IF;

  -- Đảo giao dịch sổ quỹ
  IF v_pay.cash_transaction_id IS NOT NULL THEN
    SELECT CASE WHEN type = 'income' THEN -amount ELSE amount END
      INTO v_delta
      FROM public.cash_transactions
     WHERE id = v_pay.cash_transaction_id;

    DELETE FROM public.cash_transactions WHERE id = v_pay.cash_transaction_id;

    IF v_delta IS NOT NULL THEN
      PERFORM public.pawn_apply_source_delta(v_pay.payment_source_id, v_branch, v_delta);
    END IF;
  END IF;

  -- Thời điểm thu gần nhất còn lại sau khi huỷ
  SELECT MAX(payment_date) INTO v_prev
    FROM public.pawn_payments
   WHERE pawn_id = v_pay.pawn_id AND is_voided = FALSE AND id <> p_payment_id;

  UPDATE public.pawn_records
     SET principal_outstanding = v_pay.principal_before,
         interest_paid_until   = COALESCE(v_pay.interest_paid_until_before, interest_paid_until),
         end_date              = COALESCE(v_pay.end_date_before, end_date),
         total_interest_paid   = GREATEST(0, COALESCE(total_interest_paid, 0) - COALESCE(v_pay.interest_amount, 0)),
         total_principal_paid  = GREATEST(0, COALESCE(total_principal_paid, 0) - COALESCE(v_pay.principal_amount, 0)),
         last_payment_date     = v_prev,
         renew_count           = GREATEST(0, COALESCE(renew_count, 0) - CASE WHEN v_pay.kind IN ('interest', 'principal') THEN 1 ELSE 0 END),
         status                = 'active',
         closed_at             = NULL,
         closed_by             = NULL,
         disbursement_cash_tx_id = CASE WHEN v_pay.kind = 'disbursement' THEN NULL ELSE disbursement_cash_tx_id END,
         updated_at            = now()
   WHERE id = v_pay.pawn_id
   RETURNING * INTO v_rec;

  UPDATE public.pawn_payments
     SET is_voided = TRUE,
         voided_at = now(),
         voided_by = v_uid,
         notes     = COALESCE(notes, '') ||
                     CASE WHEN COALESCE(NULLIF(p_reason, ''), '') <> ''
                          THEN ' [Huỷ: ' || p_reason || ']' ELSE ' [Đã huỷ]' END
   WHERE id = p_payment_id;

  RETURN jsonb_build_object('record', to_jsonb(v_rec), 'voidedPaymentId', p_payment_id);
END;
$$;

-- ------------------------------------------------------------
-- Quyền thực thi
-- ------------------------------------------------------------
REVOKE ALL ON FUNCTION public.pawn_apply_source_delta(TEXT, TEXT, NUMERIC) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.pawn_record_payment(TEXT, TEXT, NUMERIC, NUMERIC, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pawn_record_disbursement(TEXT, NUMERIC, TEXT, TEXT, TIMESTAMPTZ, TEXT, TEXT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pawn_void_payment(TEXT, TEXT) TO authenticated, service_role;

COMMIT;

-- Kiểm tra nhanh:
--   SELECT public.pawn_record_payment('CD-XXXX', 'interest', 180000, 0, now(), now(), 'cash', now(), 'test');
--   SELECT * FROM public.pawn_payments ORDER BY created_at DESC LIMIT 5;
