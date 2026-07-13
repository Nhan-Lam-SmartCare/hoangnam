import { supabase } from "../../supabaseClient";
import type { PaymentSource } from "../../types";
import { RepoResult, success, failure } from "./types";
import { safeAudit } from "./auditLogsRepository";

const TABLE = "payment_sources";

export async function fetchPaymentSources(): Promise<
  RepoResult<PaymentSource[]>
> {
  try {
    const { data, error } = await supabase.from(TABLE).select("*");
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải nguồn tiền",
        cause: error,
      });
    return success((data || []) as PaymentSource[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải nguồn tiền",
      cause: e,
    });
  }
}

/**
 * Lấy raw rows nguồn tiền, thử lần lượt tên bảng "payment_sources" rồi
 * "paymentsources" (tương thích schema cũ). Trả rows của bảng ĐẦU TIÊN có dữ
 * liệu. Dùng cho luồng nhập kho cần resolve payment source id (giữ shape raw).
 */
export async function fetchPaymentSourceRows(): Promise<RepoResult<any[]>> {
  const tableCandidates = ["payment_sources", "paymentsources"];
  try {
    for (const tableName of tableCandidates) {
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .limit(100);
      if (error || !data || data.length === 0) continue;
      return success(data);
    }
    return success([]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải nguồn tiền",
      cause: e,
    });
  }
}

// Atomic balance update (fetch current -> merge -> update). Expect balance JSON shape.
export async function updatePaymentSourceBalance(
  id: string,
  branchId: string,
  delta: number
): Promise<RepoResult<PaymentSource>> {
  try {
    const { data, error } = await supabase.rpc("adjust_payment_source_balance_atomic", {
      p_source_id: id,
      p_branch_id: branchId,
      p_delta: delta,
    });

    if (error || !data)
      return failure({
        code: "supabase",
        message: "Cập nhật số dư thất bại",
        cause: error,
      });

    // Audit balance adjustment
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    safeAudit(userId, { action: "payment_source.balance_update", entityType: "payment_source", entityId: id, details: { delta, branchId } });
    return success(data as PaymentSource);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật số dư",
      cause: e,
    });
  }
}
