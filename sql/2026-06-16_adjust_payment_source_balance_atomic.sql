-- Migration: adjust_payment_source_balance_atomic
-- Mô tả: Cập nhật số dư nguồn tiền nguyên tử trên DB và thắt chặt RLS bảng payment_sources.

BEGIN;

-- 1. Tạo hàm RPC nguyên tử với SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.adjust_payment_source_balance_atomic(
  p_source_id TEXT,
  p_branch_id TEXT,
  p_delta NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_current_balance JSONB;
  v_new_balance JSONB;
  v_updated_row RECORD;
BEGIN
  -- Khóa dòng dữ liệu để tránh ghi đè đồng thời
  SELECT balance INTO v_current_balance
  FROM public.payment_sources
  WHERE id = p_source_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'PAYMENT_SOURCE_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  v_current_balance := COALESCE(v_current_balance, '{}'::jsonb);
  v_new_balance := jsonb_set(
    v_current_balance,
    ARRAY[p_branch_id],
    to_jsonb(COALESCE((v_current_balance ->> p_branch_id)::numeric, 0) + p_delta)
  );

  UPDATE public.payment_sources
  SET balance = v_new_balance
  WHERE id = p_source_id
  RETURNING * INTO v_updated_row;

  RETURN to_jsonb(v_updated_row);
END;
$$;

-- 2. Thắt chặt RLS: Chỉ Owner được phép cập nhật bảng trực tiếp qua API client, staff phải dùng RPC.
DROP POLICY IF EXISTS payment_sources_update ON public.payment_sources;

CREATE POLICY payment_sources_update
ON public.payment_sources
FOR UPDATE
TO authenticated
USING (public.current_user_role() = 'owner')
WITH CHECK (public.current_user_role() = 'owner');

COMMIT;
