-- ============================================================================
-- Dạy sale_delete_atomic / sale_return_partial_atomic biết bảng part_units
-- Date: 2026-07-26
-- ============================================================================
--
-- VẤN ĐỀ ĐANG SỬA
--   Phase 6 nhả máy có IMEI về kho bằng cách gọi part_units_release_by_sale từ
--   CLIENT, SAU khi RPC xóa/trả đơn đã chạy xong. Hai lời gọi tách rời nhau:
--   mất mạng (hoặc đóng tab) đúng khoảng giữa thì đơn đã bị xóa, parts.stock đã
--   cộng lại, nhưng chiếc máy vẫn mang trạng thái 'sold' — biến mất khỏi kho dù
--   chưa bán được cho ai. Không tự phát hiện được, chỉ lòi ra ở cảnh báo lệch
--   trong bảng tồn kho.
--
--   Đưa việc nhả máy vào CHÍNH transaction của RPC thì hoặc cả hai cùng xong,
--   hoặc cả hai cùng không — đúng lý do các RPC này tồn tại.
--
-- GIỮ NGUYÊN 100% LOGIC CŨ
--   Toàn bộ thân hàm chép nguyên từ 2026-07-13_sale_delete_atomic.sql và
--   2026-07-13_sale_return_partial_atomic.sql; chỉ THÊM bước nhả máy và thêm
--   khóa 'unitsReleased' vào kết quả trả về. Client dùng khóa này để biết RPC đã
--   được nâng cấp hay chưa (thiếu khóa = bản cũ -> client tự nhả như trước).
--
-- VÌ SAO DÙNG EXECUTE THAY VÌ THAM CHIẾU THẲNG part_units
--   Để file này áp được kể cả khi 2026-07-26_create_part_units.sql chưa chạy:
--   plpgsql phân giải tên bảng lúc THỰC THI, nên tham chiếu tĩnh tới bảng chưa
--   tồn tại sẽ làm hỏng luôn chức năng xóa đơn — thứ đang chạy tốt trên
--   production. Có bảng thì nhả máy, chưa có thì bỏ qua.
--
-- TRẢ HÀNG MỘT PHẦN
--   Chỉ nhả máy của dòng đã trả HẾT. Trả 1 trong 2 chiếc giống nhau thì không ai
--   biết khách mang chiếc nào về; đoán bừa sẽ biến một IMEI sai thành hàng bán
--   được trong khi máy thật vẫn ở nhà khách. Ở đây server tính chính xác hơn
--   client vì nó cộng được cả các lần trả trước từ bảng sale_returns.
--
-- ⚠️ Idempotent (CREATE OR REPLACE, bọc BEGIN/COMMIT).
-- ⚠️ exec_sql RPC KHÔNG tồn tại trên DB này -> APPLY bằng Supabase SQL Editor
--    (dán nguyên nội dung file), KHÔNG dùng scripts/setup/apply-sql.mjs.
-- ============================================================================

BEGIN;

-- ════════════════════════════════════════════════════════════════════════════
-- 1. sale_delete_atomic — xóa đơn thì MỌI máy của đơn trở lại bán được
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sale_delete_atomic(
  p_sale_id text,
  p_branch_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale        public.sales%ROWTYPE;
  v_sale_json   jsonb;
  v_branch      text;
  v_total       numeric;
  v_customer_id text;
  v_item        jsonb;
  v_part_id     text;
  v_qty         numeric;
  v_tx          record;
  v_src         text;
  v_amt         numeric;
  v_refunds     jsonb := '{}'::jsonb;
  v_tx_ids      jsonb := '[]'::jsonb;
  v_units       int := 0;
BEGIN
  IF p_sale_id IS NULL OR length(trim(p_sale_id)) = 0 THEN
    RAISE EXCEPTION 'SALE_ID_REQUIRED';
  END IF;

  -- 1) Khóa phiếu.
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'SALE_NOT_FOUND');
  END IF;

  v_sale_json := to_jsonb(v_sale);
  v_branch := COALESCE(
    NULLIF(p_branch_id, ''),
    v_sale_json ->> 'branchId',
    v_sale_json ->> 'branchid',
    v_sale_json ->> 'branch_id'
  );
  IF v_branch IS NULL OR length(trim(v_branch)) = 0 THEN
    RAISE EXCEPTION 'BRANCH_ID_REQUIRED';
  END IF;

  v_total := COALESCE((v_sale_json ->> 'total')::numeric, 0);
  v_customer_id := NULLIF(v_sale_json #>> '{customer,id}', '');

  -- 2) Hoàn kho (cộng lại từng item).
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(v_sale_json -> 'items', '[]'::jsonb))
  LOOP
    v_part_id := v_item ->> 'partId';
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[v_branch],
      to_jsonb(GREATEST(0, COALESCE((stock ->> v_branch)::numeric, 0) + v_qty))
    )
    WHERE id = v_part_id;
  END LOOP;

  -- 2b) Nhả máy có IMEI về kho — MỚI.
  -- Cập nhật trên chính dòng cũ (không tạo dòng mới) để ràng buộc IMEI duy nhất
  -- không vỡ và lịch sử của chiếc máy còn liền mạch.
  -- Chỉ đụng tới status = 'sold', đúng như part_units_release_by_sale: máy đã
  -- chuyển sang 'warranty' hay 'lost' thì đang ở chỗ khác, kéo về kho là bịa tồn.
  IF to_regclass('public.part_units') IS NOT NULL THEN
    EXECUTE $q$
      UPDATE public.part_units
         SET status  = 'in_stock',
             sale_id = NULL,
             sold_at = NULL,
             note    = concat_ws(' | ', note,
                         to_char(now(), 'DD/MM/YYYY') || ': Hoàn kho do xóa đơn ' || $1)
       WHERE sale_id = $1
         AND status = 'sold'
    $q$ USING p_sale_id;
    GET DIAGNOSTICS v_units = ROW_COUNT;
  END IF;

  -- 3) Đảo sổ quỹ + số dư nguồn tiền (theo đúng giao dịch đã ghi cho đơn).
  FOR v_tx IN
    SELECT
      t.id AS id,
      COALESCE(
        to_jsonb(t) ->> 'paymentsource',
        to_jsonb(t) ->> 'paymentSource',
        to_jsonb(t) ->> 'paymentSourceId'
      ) AS src,
      COALESCE(t.amount, 0) AS amt
    FROM public.cash_transactions t
    WHERE to_jsonb(t) ->> 'saleid' = p_sale_id
       OR to_jsonb(t) ->> 'saleId' = p_sale_id
    FOR UPDATE
  LOOP
    v_src := COALESCE(v_tx.src, v_sale_json ->> 'paymentmethod', 'cash');
    v_amt := COALESCE(v_tx.amt, 0);

    IF v_amt > 0 AND v_src IS NOT NULL THEN
      UPDATE public.payment_sources
      SET balance = jsonb_set(
        COALESCE(balance, '{}'::jsonb),
        ARRAY[v_branch],
        to_jsonb(COALESCE((balance ->> v_branch)::numeric, 0) - v_amt)
      )
      WHERE id = v_src;

      v_refunds := jsonb_set(
        v_refunds,
        ARRAY[v_src],
        to_jsonb(COALESCE((v_refunds ->> v_src)::numeric, 0) + v_amt)
      );
    END IF;

    v_tx_ids := v_tx_ids || to_jsonb(v_tx.id);
    DELETE FROM public.cash_transactions WHERE id = v_tx.id;
  END LOOP;

  -- 4) Xóa công nợ liên kết (cột sale_id hoặc saleId).
  DELETE FROM public.customer_debts d
  WHERE to_jsonb(d) ->> 'sale_id' = p_sale_id
     OR to_jsonb(d) ->> 'saleId' = p_sale_id;

  -- 5) Đảo thống kê khách hàng (best-effort; chỉ khi phiếu lưu customer.id).
  IF v_customer_id IS NOT NULL THEN
    UPDATE public.customers
    SET totalspent = GREATEST(0, COALESCE(totalspent, 0) - v_total),
        visitcount = GREATEST(0, COALESCE(visitcount, 0) - 1)
    WHERE id = v_customer_id;
  END IF;

  -- 6) Xóa phiếu.
  DELETE FROM public.sales WHERE id = p_sale_id;

  RETURN jsonb_build_object(
    'success', true,
    'branchId', v_branch,
    'refunds', v_refunds,
    'removedCashTxIds', v_tx_ids,
    'unitsReleased', v_units
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_delete_atomic(text, text) TO authenticated;


-- ════════════════════════════════════════════════════════════════════════════
-- 2. sale_return_partial_atomic — nhả máy của dòng đã trả HẾT
-- ════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.sale_return_partial_atomic(
  p_sale_id text,
  p_branch_id text,
  p_items jsonb,
  p_refund_amount numeric DEFAULT 0,
  p_refund_source text DEFAULT 'cash',
  p_reason text DEFAULT NULL,
  p_return_id text DEFAULT NULL,
  p_created_by text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sale         public.sales%ROWTYPE;
  v_sale_json    jsonb;
  v_sale_items   jsonb;
  v_branch       text;
  v_item         jsonb;
  v_part_id      text;
  v_qty          numeric;
  v_sold         numeric;
  v_already      numeric;
  v_invalid      jsonb := '[]'::jsonb;
  v_return_id    text := COALESCE(NULLIF(p_return_id, ''), 'RET-' || p_sale_id || '-' || floor(extract(epoch from now()))::text);
  v_refund       numeric := GREATEST(0, COALESCE(p_refund_amount, 0));
  v_total_sold   numeric := 0;
  v_total_ret    numeric := 0;
  v_this_ret     numeric := 0;
  v_refunds      jsonb := '{}'::jsonb;
  v_units        int := 0;
  v_units_line   int := 0;
  v_partial      jsonb := '[]'::jsonb;
  v_has_units    boolean := (to_regclass('public.part_units') IS NOT NULL);
BEGIN
  IF p_sale_id IS NULL OR length(trim(p_sale_id)) = 0 THEN
    RAISE EXCEPTION 'SALE_ID_REQUIRED';
  END IF;

  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'message', 'SALE_NOT_FOUND');
  END IF;

  v_sale_json  := to_jsonb(v_sale);
  v_sale_items := COALESCE(v_sale_json -> 'items', '[]'::jsonb);
  v_branch := COALESCE(
    NULLIF(p_branch_id, ''),
    v_sale_json ->> 'branchId',
    v_sale_json ->> 'branchid',
    v_sale_json ->> 'branch_id'
  );
  IF v_branch IS NULL OR length(trim(v_branch)) = 0 THEN
    RAISE EXCEPTION 'BRANCH_ID_REQUIRED';
  END IF;

  -- 1) Kiểm tra từng item trả: không vượt (đã bán − đã trả trước).
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_part_id := v_item ->> 'partId';
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_sold
    FROM jsonb_array_elements(v_sale_items) it
    WHERE it ->> 'partId' = v_part_id;

    SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_already
    FROM public.sale_returns sr, jsonb_array_elements(sr.items) it
    WHERE sr.sale_id = p_sale_id AND it ->> 'partId' = v_part_id;

    IF v_qty > (v_sold - v_already) THEN
      v_invalid := v_invalid || jsonb_build_object(
        'partId', v_part_id, 'requested', v_qty,
        'returnable', GREATEST(0, v_sold - v_already)
      );
    END IF;
  END LOOP;

  IF jsonb_array_length(v_invalid) > 0 THEN
    RETURN jsonb_build_object('success', false, 'message', 'Số lượng trả vượt quá số còn lại', 'invalid', v_invalid);
  END IF;

  -- 2) Hoàn kho + cộng tổng số lượng trả lần này.
  FOR v_item IN SELECT * FROM jsonb_array_elements(COALESCE(p_items, '[]'::jsonb))
  LOOP
    v_part_id := v_item ->> 'partId';
    v_qty     := COALESCE((v_item ->> 'quantity')::numeric, 0);
    IF v_part_id IS NULL OR v_qty <= 0 THEN CONTINUE; END IF;

    v_this_ret := v_this_ret + v_qty;

    UPDATE public.parts
    SET stock = jsonb_set(
      COALESCE(stock, '{}'::jsonb),
      ARRAY[v_branch],
      to_jsonb(GREATEST(0, COALESCE((stock ->> v_branch)::numeric, 0) + v_qty))
    )
    WHERE id = v_part_id;

    -- 2b) Nhả máy có IMEI — MỚI. Chỉ khi dòng này đã trả HẾT.
    IF v_has_units THEN
      -- Dòng này có máy nào gắn với đơn không? Hàng thường (dầu nhớt, phụ tùng
      -- rời) không có, và không được lọt vào danh sách cảnh báo 'unitsPartial'.
      EXECUTE $q$
        SELECT count(*) FROM public.part_units
         WHERE sale_id = $1 AND part_id = $2 AND status = 'sold'
      $q$ INTO v_units_line USING p_sale_id, v_part_id;
    ELSE
      v_units_line := 0;
    END IF;

    IF v_units_line > 0 THEN
      SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_sold
      FROM jsonb_array_elements(v_sale_items) it
      WHERE it ->> 'partId' = v_part_id;

      SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_already
      FROM public.sale_returns sr, jsonb_array_elements(sr.items) it
      WHERE sr.sale_id = p_sale_id AND it ->> 'partId' = v_part_id;

      IF (v_already + v_qty) >= v_sold THEN
        EXECUTE $q$
          UPDATE public.part_units
             SET status  = 'in_stock',
                 sale_id = NULL,
                 sold_at = NULL,
                 note    = concat_ws(' | ', note,
                             to_char(now(), 'DD/MM/YYYY') || ': Hoàn kho do khách trả (HĐ ' || $1 || ')')
           WHERE sale_id = $1
             AND part_id = $2
             AND status = 'sold'
        $q$ USING p_sale_id, v_part_id;
        GET DIAGNOSTICS v_units_line = ROW_COUNT;
        v_units := v_units + v_units_line;
      ELSE
        -- Trả một phần: người dùng phải tự chỉ ra chiếc nào ở màn Kho.
        v_partial := v_partial || to_jsonb(v_part_id);
      END IF;
    END IF;
  END LOOP;

  -- 3) Ghi lịch sử trả.
  INSERT INTO public.sale_returns (id, sale_id, branch_id, items, refund_amount, refund_source, reason, created_by)
  VALUES (v_return_id, p_sale_id, v_branch, COALESCE(p_items, '[]'::jsonb), v_refund, NULLIF(p_refund_source, ''), NULLIF(p_reason, ''), NULLIF(p_created_by, ''));

  -- 4) Hoàn tiền (chi) nếu có.
  IF v_refund > 0 AND NULLIF(p_refund_source, '') IS NOT NULL THEN
    INSERT INTO public.cash_transactions (id, type, amount, branchid, category, date, description, paymentsource, saleid, recipient)
    VALUES (
      'CT-' || v_return_id, 'expense', v_refund, v_branch, 'sale_refund',
      now(),
      'Hoàn tiền trả hàng (Hóa đơn #' || p_sale_id || ')',
      p_refund_source, p_sale_id,
      COALESCE(v_sale_json #>> '{customer,name}', 'Khách lẻ')
    );

    PERFORM 1 FROM public.payment_sources WHERE id = p_refund_source FOR UPDATE;
    UPDATE public.payment_sources
    SET balance = jsonb_set(
      COALESCE(balance, '{}'::jsonb),
      ARRAY[v_branch],
      to_jsonb(COALESCE((balance ->> v_branch)::numeric, 0) - v_refund)
    )
    WHERE id = p_refund_source;

    v_refunds := jsonb_set(v_refunds, ARRAY[p_refund_source], to_jsonb(v_refund));
  END IF;

  -- 5) Nếu đã trả HẾT toàn bộ số lượng -> đánh dấu phiếu refunded.
  SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_total_sold
  FROM jsonb_array_elements(v_sale_items) it;

  SELECT COALESCE(SUM((it ->> 'quantity')::numeric), 0) INTO v_total_ret
  FROM public.sale_returns sr, jsonb_array_elements(sr.items) it
  WHERE sr.sale_id = p_sale_id;

  IF v_total_sold > 0 AND v_total_ret >= v_total_sold THEN
    UPDATE public.sales SET refunded = true WHERE id = p_sale_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'returnId', v_return_id,
    'branchId', v_branch,
    'refunds', v_refunds,
    'fullyReturned', (v_total_sold > 0 AND v_total_ret >= v_total_sold),
    'unitsReleased', v_units,
    'unitsPartial', v_partial
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.sale_return_partial_atomic(text, text, jsonb, numeric, text, text, text, text) TO authenticated;

COMMIT;

-- ════════════════════════════════════════════════════════════════════════════
-- KIỂM TRA SAU KHI ÁP
-- ════════════════════════════════════════════════════════════════════════════
-- 1. Hai hàm đã có khóa unitsReleased chưa:
--    SELECT proname FROM pg_proc
--     WHERE proname IN ('sale_delete_atomic','sale_return_partial_atomic')
--       AND prosrc LIKE '%unitsReleased%';   -- phải ra 2 dòng
--
-- 2. Máy nào đang kẹt ở 'sold' của đơn không còn tồn tại (nợ dữ liệu cũ):
--    SELECT u.id, u.imei, u.sale_id
--      FROM public.part_units u
--     WHERE u.status = 'sold'
--       AND u.sale_id IS NOT NULL
--       AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.id = u.sale_id);
--
-- 3. Nhả các máy kẹt ở câu 2 (chạy sau khi đã xem kỹ kết quả):
--    SELECT public.part_units_release(
--             array_agg(u.id),
--             'Hoàn kho: đơn đã bị xóa trước khi RPC biết tới part_units')
--      FROM public.part_units u
--     WHERE u.status = 'sold' AND u.sale_id IS NOT NULL
--       AND NOT EXISTS (SELECT 1 FROM public.sales s WHERE s.id = u.sale_id);
