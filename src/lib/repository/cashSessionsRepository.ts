import { supabase } from "../../supabaseClient";
import { success, failure, type RepoResult } from "./types";
import type { CashSession } from "../../types";

/** Map row DB (snake_case) -> CashSession. */
const mapRow = (row: any): CashSession => ({
  id: row.id,
  branchId: row.branch_id ?? row.branchId ?? undefined,
  status: row.status === "closed" ? "closed" : "open",
  openedBy: row.opened_by ?? undefined,
  openedByName: row.opened_by_name ?? undefined,
  openedAt: row.opened_at ?? row.created_at,
  openingBalance: row.opening_balance || {},
  closedBy: row.closed_by ?? undefined,
  closedByName: row.closed_by_name ?? undefined,
  closedAt: row.closed_at ?? undefined,
  counted: row.counted || {},
  expected: row.expected || {},
  note: row.note ?? undefined,
});

/** Ca đang mở của chi nhánh (nếu có). */
export async function fetchOpenCashSession(
  branchId: string
): Promise<RepoResult<CashSession | null>> {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("branch_id", branchId)
    .eq("status", "open")
    .order("opened_at", { ascending: false })
    .limit(1);
  if (error) return failure({ code: "supabase", message: error.message });
  return success(data && data.length ? mapRow(data[0]) : null);
}

/** Lịch sử ca gần đây. */
export async function fetchRecentCashSessions(
  branchId: string,
  limit = 10
): Promise<RepoResult<CashSession[]>> {
  const { data, error } = await supabase
    .from("cash_sessions")
    .select("*")
    .eq("branch_id", branchId)
    .order("opened_at", { ascending: false })
    .limit(limit);
  if (error) return failure({ code: "supabase", message: error.message });
  return success((data || []).map(mapRow));
}

/** Mở ca: chụp số dư nguồn tiền hiện tại làm opening_balance. */
export async function openCashSession(input: {
  branchId: string;
  openedBy?: string;
  openedByName?: string;
  openingBalance: Record<string, number>;
}): Promise<RepoResult<CashSession>> {
  const id = `SESS-${input.branchId}-${Date.now()}`;
  const { data, error } = await supabase
    .from("cash_sessions")
    .insert([
      {
        id,
        branch_id: input.branchId,
        status: "open",
        opened_by: input.openedBy || null,
        opened_by_name: input.openedByName || null,
        opening_balance: input.openingBalance,
      },
    ])
    .select("*")
    .single();
  if (error) return failure({ code: "supabase", message: error.message });
  return success(mapRow(data));
}

/** Đóng ca: lưu tiền đếm thực tế + số dư kỳ vọng. */
export async function closeCashSession(input: {
  id: string;
  counted: Record<string, number>;
  expected: Record<string, number>;
  note?: string;
  closedBy?: string;
  closedByName?: string;
}): Promise<RepoResult<CashSession>> {
  const { data, error } = await supabase
    .from("cash_sessions")
    .update({
      status: "closed",
      counted: input.counted,
      expected: input.expected,
      note: input.note || null,
      closed_by: input.closedBy || null,
      closed_by_name: input.closedByName || null,
      closed_at: new Date().toISOString(),
    })
    .eq("id", input.id)
    .select("*")
    .single();
  if (error) return failure({ code: "supabase", message: error.message });
  return success(mapRow(data));
}
