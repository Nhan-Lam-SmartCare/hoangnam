import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";

export interface InventorySummaryRow {
  branch_id: string;
  total_quantity: number;
  total_value: number;
}

const VIEW = "inventory_summary_by_branch";

export async function fetchInventorySummary(params?: {
  branchId?: string;
}): Promise<RepoResult<InventorySummaryRow[]>> {
  try {
    let query = supabase.from(VIEW).select("*");
    if (params?.branchId) query = query.eq("branch_id", params.branchId);
    const { data, error } = await query;
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải tổng hợp tồn kho",
        cause: error,
      });
    return success((data || []) as InventorySummaryRow[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải tổng hợp tồn kho",
      cause: e,
    });
  }
}
