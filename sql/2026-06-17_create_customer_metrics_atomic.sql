-- ============================================================
-- 2026-06-17_create_customer_metrics_atomic.sql
--
-- RPC atomic update for customer visit metrics and segments.
-- Resolves client-side read-modify-write race conditions.
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.update_customer_metrics_atomic(
  p_customer_id UUID,
  p_payment_amount NUMERIC,
  p_is_first_payment BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_totalspent NUMERIC;
  v_visitcount INT;
  v_segment TEXT;
BEGIN
  -- Query and lock the target customer record to prevent concurrent updates
  SELECT totalspent, visitcount INTO v_totalspent, v_visitcount
  FROM public.customers
  WHERE id = p_customer_id
  FOR UPDATE;

  IF FOUND THEN
    v_totalspent := COALESCE(v_totalspent, 0) + COALESCE(p_payment_amount, 0);
    
    IF p_is_first_payment THEN
      v_visitcount := COALESCE(v_visitcount, 0) + 1;
    ELSE
      v_visitcount := COALESCE(v_visitcount, 0);
    END IF;

    -- Determine user segment based on total spent and visit count
    IF v_totalspent > 10000000 THEN
      v_segment := 'VIP';
    ELSIF v_totalspent > 3000000 THEN
      v_segment := 'Loyal';
    ELSIF v_visitcount > 1 THEN
      v_segment := 'Potential';
    ELSE
      v_segment := 'New';
    END IF;

    UPDATE public.customers
    SET totalspent = v_totalspent,
        visitcount = v_visitcount,
        lastvisit = NOW(),
        segment = v_segment
    WHERE id = p_customer_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_customer_metrics_atomic(UUID, NUMERIC, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_customer_metrics_atomic(UUID, NUMERIC, BOOLEAN) TO service_role;

COMMIT;
