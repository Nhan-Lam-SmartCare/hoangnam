import { supabase } from "../../supabaseClient";
import type { CashTransaction } from "../../types";
import { RepoResult, success, failure } from "./types";
// import { safeAudit } from "./auditLogsRepository";
import { canonicalizeMotocareCashTxCategory } from "../finance/cashTxCategories";

const TABLE = "cash_transactions";
const READ_TABLE = "cash_transactions_ledger";

export interface CreateCashTxInput {
  type: CashTransaction["type"]; // "income" | "expense"
  amount: number;
  branchId: string;
  paymentSourceId: string; // maps to paymentSource column in DB
  date?: string;
  notes?: string;
  category?: string; // e.g. sale_income, debt_collection
  saleId?: string;
  workOrderId?: string;
  payrollRecordId?: string;
  loanPaymentId?: string;
  supplierId?: string;
  customerId?: string;
  recipient?: string; // human readable target
}

// Fetch cash transactions (optional filters)
export async function fetchCashTransactions(params?: {
  branchId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
  type?: "income" | "expense";
}): Promise<RepoResult<CashTransaction[]>> {
  try {
    const runQuery = async (table: string) => {
      let query = supabase.from(table).select("*").order("date", { ascending: false });

      // Filter by branchId - PostgreSQL stores column as lowercase "branchid"
      if (params?.branchId) {
        query = query.eq("branchid", params.branchId);
      }
      if (params?.startDate) query = query.gte("date", params.startDate);
      if (params?.endDate) query = query.lte("date", params.endDate);
      if (params?.limit) query = query.limit(params.limit);
      // Don't filter by type at DB level - some old records may not have it

      return await query;
    };

    // Prefer normalized ledger view for consistent reads.
    // Safe fallback to base table when the view hasn't been deployed yet.
    let { data, error } = await runQuery(READ_TABLE);
    if (error && (error as any)?.message?.toLowerCase?.().includes("does not exist")) {
      ({ data, error } = await runQuery(TABLE));
    }

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải sổ quỹ",
        cause: error,
      });

    // Map DB columns to TypeScript interface (handle both lowercase and camelCase)
    let mappedData = (data || []).map((row: any) => ({
      ...row,
      paymentSourceId:
        row.paymentsource || row.paymentSource || row.paymentSourceId || "cash",
      branchId: row.branchid || row.branchId || row.branch_id,
      // Infer type from category if not present
      type:
        row.type ||
        ([
          "sale_income",
          "service_income",
          "other_income",
          "debt_collection",
          "general_income",
        ].includes(row.category)
          ? "income"
          : "expense"),
    })) as CashTransaction[];

    // Filter by type at client level (for backwards compatibility)
    if (params?.type) {
      mappedData = mappedData.filter((tx) => tx.type === params.type);
    }

    return success(mappedData);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải sổ quỹ",
      cause: e,
    });
  }
}

export async function createCashTransaction(
  input: CreateCashTxInput
): Promise<RepoResult<CashTransaction>> {
  try {
    if (!input.amount || input.amount <= 0)
      return failure({ code: "validation", message: "Số tiền phải > 0" });
    if (!input.branchId)
      return failure({ code: "validation", message: "Thiếu chi nhánh" });
    if (!input.paymentSourceId)
      return failure({ code: "validation", message: "Thiếu nguồn tiền" });
    if (!input.type)
      return failure({ code: "validation", message: "Thiếu loại thu/chi" });

    // Build payload with lowercase column names (PostgreSQL converts to lowercase)
    // DB columns: id, type, category, amount, date, description, branchid, paymentsource, reference, created_at, recipient
    const payload: any = {
      id: crypto.randomUUID(),
      type: input.type, // Required: "income" or "expense"
      amount: input.amount,
      branchid: input.branchId,
      paymentsource: input.paymentSourceId,
      category:
        canonicalizeMotocareCashTxCategory(input.category) ||
        (input.type === "income" ? "general_income" : "general_expense"),
      date: input.date || new Date().toISOString(),
      description: input.notes || "",
      recipient: input.recipient || null,
    };

    console.log("[CashTx] Creating transaction with payload:", payload);

    const { data, error } = await supabase
      .from(TABLE)
      .insert([payload])
      .select()
      .single();

    if (error) {
      console.error("[CashTx] Supabase error:", error);
      console.error(
        "[CashTx] Error details - code:",
        error.code,
        "message:",
        error.message,
        "details:",
        error.details,
        "hint:",
        error.hint
      );
    }

    if (error || !data)
      return failure({
        code: "supabase",
        message: "Ghi sổ quỹ thất bại",
        cause: error,
      });

    // Map lowercase DB columns to camelCase for TypeScript interface
    const created: CashTransaction = {
      ...data,
      branchId: data.branchid || data.branchId,
      paymentSourceId:
        data.paymentsource ||
        data.paymentSource ||
        data.paymentSourceId ||
        "cash",
    };

    // Best-effort audit: manual cash entry (exclude those tied to sale/debt if category already specific?)
    try {
      // Determine if this is manual: no saleId/workOrderId/payrollRecordId/loanPaymentId
      const isManual =
        !payload.saleId &&
        !payload.workOrderId &&
        !payload.payrollRecordId &&
        !payload.loanPaymentId;
      if (isManual) {
        const { data: userRes } = await supabase.auth.getUser();
        const userId = userRes?.user?.id || null;
        // Audit removed
      }
    } catch { }
    return success(created);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi ghi sổ quỹ",
      cause: e,
    });
  }
}

export interface UpdateCashTxInput {
  id: string;
  type?: CashTransaction["type"];
  amount?: number;
  paymentSourceId?: string;
  date?: string;
  notes?: string;
  category?: string;
  recipient?: string;
}

// Update cash transaction
export async function updateCashTransaction(
  input: UpdateCashTxInput
): Promise<RepoResult<CashTransaction>> {
  try {
    if (!input.id) {
      return failure({ code: "validation", message: "Thiếu ID giao dịch" });
    }

    // Build payload with only provided fields, using lowercase column names
    const payload: any = {};
    if (input.type !== undefined) payload.type = input.type;
    if (input.amount !== undefined) payload.amount = input.amount;
    if (input.paymentSourceId !== undefined)
      payload.paymentsource = input.paymentSourceId;
    if (input.date !== undefined) payload.date = input.date;
    if (input.notes !== undefined) payload.description = input.notes;
    if (input.category !== undefined)
      payload.category =
        canonicalizeMotocareCashTxCategory(input.category) ?? input.category;
    if (input.recipient !== undefined) payload.recipient = input.recipient;

    // Get old data for audit
    const { data: oldData } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", input.id)
      .single();

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", input.id)
      .select()
      .single();

    if (error || !data) {
      return failure({
        code: "supabase",
        message: "Cập nhật giao dịch thất bại",
        cause: error,
      });
    }

    // Map to TypeScript interface
    const updated: CashTransaction = {
      ...data,
      branchId: data.branchid || data.branchId,
      paymentSourceId:
        data.paymentsource ||
        data.paymentSource ||
        data.paymentSourceId ||
        "cash",
    };

    // Audit
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id || null;
      // Audit removed
    } catch { }

    return success(updated);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật giao dịch",
      cause: e,
    });
  }
}

// Delete cash transaction
export async function deleteCashTransaction(
  id: string
): Promise<RepoResult<{ id: string }>> {
  try {
    if (!id) {
      return failure({ code: "validation", message: "Thiếu ID giao dịch" });
    }

    // Get old data for audit
    const { data: oldData } = await supabase
      .from(TABLE)
      .select("*")
      .eq("id", id)
      .single();

    const { error } = await supabase.from(TABLE).delete().eq("id", id);

    if (error) {
      return failure({
        code: "supabase",
        message: "Xóa giao dịch thất bại",
        cause: error,
      });
    }

    // Audit
    try {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id || null;
      // Audit removed
    } catch { }

    return success({ id });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa giao dịch",
      cause: e,
    });
  }
}
