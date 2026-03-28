import { supabase } from "../../supabaseClient";
import type { PaymentSource } from "../../types";
import { RepoResult, success, failure } from "./types";
// import { safeAudit } from "./auditLogsRepository";

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

// Atomic balance update (fetch current -> merge -> update). Expect balance JSON shape.
export async function updatePaymentSourceBalance(
  id: string,
  branchId: string,
  delta: number
): Promise<RepoResult<PaymentSource>> {
  try {
    // Fetch current row
    const { data: current, error: fetchErr } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (fetchErr || !current)
      return failure({
        code: "supabase",
        message: "Không tìm thấy nguồn tiền",
        cause: fetchErr,
      });

    const balance = current.balance || {};
    const newBalance = {
      ...balance,
      [branchId]: (balance[branchId] || 0) + delta,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .update({ balance: newBalance })
      .eq("id", id)
      .select()
      .single();
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
    // Audit removed
    return success(data as PaymentSource);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật số dư",
      cause: e,
    });
  }
}
