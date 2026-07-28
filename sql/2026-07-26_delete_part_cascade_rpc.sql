-- SQL RPC to safely delete a product and all its non-sale dependent rows across all branches
CREATE OR REPLACE FUNCTION public.delete_part_cascade(p_part_id text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_sale_count int;
  v_part_name text;
BEGIN
  -- 1. Check if part exists
  SELECT name INTO v_part_name FROM public.parts WHERE id = p_part_id;
  IF v_part_name IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Không tìm thấy sản phẩm để xóa');
  END IF;

  -- 2. Check if part was sold in any sale_items
  SELECT count(*) INTO v_sale_count FROM public.sale_items WHERE part_id = p_part_id;
  IF v_sale_count > 0 THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Sản phẩm "' || v_part_name || '" đã có trong hóa đơn bán hàng. Không thể xóa để bảo đảm báo cáo doanh thu.');
  END IF;

  -- 3. Delete dependent records across all branches bypassing RLS
  DELETE FROM public.part_units WHERE part_id = p_part_id;
  DELETE FROM public.inventory_receipt_items WHERE part_id = p_part_id;
  DELETE FROM public.inventory_transactions WHERE part_id = p_part_id;
  DELETE FROM public.inventory_transfers WHERE part_id = p_part_id;
  DELETE FROM public.repair_order_service_items WHERE part_id = p_part_id;
  DELETE FROM public.ticket_items WHERE part_id = p_part_id;
  DELETE FROM public.warranty_claims WHERE part_id = p_part_id;

  -- 4. Delete the main part record
  DELETE FROM public.parts WHERE id = p_part_id;

  RETURN jsonb_build_object('ok', true, 'message', 'Đã xóa phụ tùng "' || v_part_name || '"');
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('ok', false, 'message', 'Lỗi khi xóa sản phẩm: ' || SQLERRM);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_part_cascade(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_part_cascade(text) TO anon;
GRANT EXECUTE ON FUNCTION public.delete_part_cascade(text) TO service_role;
