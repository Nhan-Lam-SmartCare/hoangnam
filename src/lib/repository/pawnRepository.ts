import { supabase } from "../../supabaseClient";
import type { PawnPayment, PawnPaymentKind, PawnRecord } from "../../types";
import { RepoResult, success, failure } from "./types";

const PAWN_TABLE = "pawn_records";
const PAWN_PAYMENTS_TABLE = "pawn_payments";

/** Mã lỗi do RPC ném ra -> thông báo tiếng Việt cho người dùng. */
const RPC_ERROR_MESSAGES: Record<string, string> = {
  PAWN_NOT_FOUND: "Không tìm thấy hợp đồng cầm đồ",
  PAWN_NOT_ACTIVE: "Hợp đồng đã tất toán, không thể thu tiền tiếp",
  BRANCH_FORBIDDEN: "Bạn không có quyền thao tác trên hợp đồng của chi nhánh khác",
  PRINCIPAL_EXCEEDS_OUTSTANDING: "Số tiền gốc thu vượt quá gốc còn lại",
  PRINCIPAL_NOT_CLEARED: "Muốn chuộc thì phải trả hết gốc còn lại",
  PERIOD_TO_BEFORE_PAID_UNTIL: "Ngày đóng lãi tới không được nhỏ hơn ngày đã đóng lãi trước đó",
  AMOUNT_MUST_BE_POSITIVE: "Số tiền phải lớn hơn 0",
  PAYMENT_NOT_FOUND: "Không tìm thấy phiếu thu/chi",
  PAYMENT_ALREADY_VOIDED: "Phiếu này đã được huỷ trước đó",
  NOT_LATEST_PAYMENT: "Chỉ được huỷ phiếu mới nhất của hợp đồng",
  FORBIDDEN: "Bạn không có quyền huỷ phiếu",
  INVALID_KIND: "Loại giao dịch không hợp lệ",
};

/** Bóc mã lỗi từ message của Postgres (dạng "PAWN_NOT_ACTIVE" hoặc "INVALID_KIND:xxx"). */
const mapRpcError = (error: any, fallback: string): string => {
  const raw = String(error?.message || "");
  for (const code of Object.keys(RPC_ERROR_MESSAGES)) {
    if (raw.includes(code)) return RPC_ERROR_MESSAGES[code];
  }
  return raw || fallback;
};

const mapRow = (row: any): PawnRecord => ({
  id: row.id,
  customerName: row.customer_name,
  customerPhone: row.customer_phone || "",
  customerAddress: row.customer_address || "",
  customerCccd: row.customer_cccd || "",
  assetType: row.asset_type,
  assetModel: row.asset_model || "",
  assetSerial: row.asset_serial || "",
  loanAmount: Number(row.loan_amount || 0),
  interestRate: Number(row.interest_rate || 0),
  interestPeriod: row.interest_period || "day",
  startDate: row.start_date,
  endDate: row.end_date,
  minInterest: Number(row.min_interest || 0),
  status: row.status,
  notes: row.notes || "",
  branchId: row.branch_id,
  principalOutstanding:
    row.principal_outstanding != null
      ? Number(row.principal_outstanding)
      : Number(row.loan_amount || 0),
  interestPaidUntil: row.interest_paid_until || row.start_date || undefined,
  totalInterestPaid: Number(row.total_interest_paid || 0),
  totalPrincipalPaid: Number(row.total_principal_paid || 0),
  lastPaymentDate: row.last_payment_date || undefined,
  renewCount: Number(row.renew_count || 0),
  disbursementCashTxId: row.disbursement_cash_tx_id || undefined,
  closedAt: row.closed_at || undefined,
  closedBy: row.closed_by || undefined,
  created_at: row.created_at,
  updated_at: row.updated_at,
});

const mapPaymentRow = (row: any): PawnPayment => ({
  id: row.id,
  pawnId: row.pawn_id,
  kind: row.kind as PawnPaymentKind,
  paymentDate: row.payment_date,
  interestAmount: Number(row.interest_amount || 0),
  principalAmount: Number(row.principal_amount || 0),
  amount: Number(row.amount || 0),
  periodFrom: row.period_from || undefined,
  periodTo: row.period_to || undefined,
  days: row.days != null ? Number(row.days) : undefined,
  principalBefore: row.principal_before != null ? Number(row.principal_before) : undefined,
  principalAfter: row.principal_after != null ? Number(row.principal_after) : undefined,
  interestPaidUntilBefore: row.interest_paid_until_before || undefined,
  endDateBefore: row.end_date_before || undefined,
  newEndDate: row.new_end_date || undefined,
  paymentSourceId: row.payment_source_id || undefined,
  cashTransactionId: row.cash_transaction_id || undefined,
  isVoided: Boolean(row.is_voided),
  voidedAt: row.voided_at || undefined,
  voidedBy: row.voided_by || undefined,
  notes: row.notes || "",
  createdBy: row.created_by || undefined,
  branchId: row.branch_id,
  created_at: row.created_at,
});

export async function fetchPawnRecords(branchId?: string): Promise<RepoResult<PawnRecord[]>> {
  try {
    let query = supabase.from(PAWN_TABLE).select("*").order("created_at", { ascending: false });
    
    if (branchId) {
      query = query.eq("branch_id", branchId);
    }

    const { data, error } = await query;
    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách hợp đồng cầm đồ",
        cause: error,
      });
    }

    return success((data || []).map(mapRow));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function createPawnRecord(
  record: Omit<PawnRecord, "created_at" | "updated_at">
): Promise<RepoResult<PawnRecord>> {
  try {
    const dbRow = {
      id: record.id,
      customer_name: record.customerName,
      customer_phone: record.customerPhone,
      customer_address: record.customerAddress,
      customer_cccd: record.customerCccd,
      asset_type: record.assetType,
      asset_model: record.assetModel,
      asset_serial: record.assetSerial,
      loan_amount: record.loanAmount,
      interest_rate: record.interestRate,
      interest_period: record.interestPeriod || "day",
      start_date: record.startDate,
      end_date: record.endDate || null,
      min_interest: record.minInterest,
      status: record.status || "active",
      notes: record.notes,
      branch_id: record.branchId || "CN1",
    };

    const { data, error } = await supabase.from(PAWN_TABLE).insert(dbRow).select().single();

    if (error || !data) {
      return failure({
        code: "supabase",
        message: error?.message || "Không thể tạo hợp đồng cầm đồ",
        cause: error,
      });
    }

    return success(mapRow(data));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo hợp đồng cầm đồ",
      cause: e,
    });
  }
}

export async function updatePawnRecord(
  id: string,
  updates: Partial<PawnRecord>
): Promise<RepoResult<PawnRecord>> {
  try {
    const dbUpdates: any = {};
    if (updates.customerName !== undefined) dbUpdates.customer_name = updates.customerName;
    if (updates.customerPhone !== undefined) dbUpdates.customer_phone = updates.customerPhone;
    if (updates.customerAddress !== undefined) dbUpdates.customer_address = updates.customerAddress;
    if (updates.customerCccd !== undefined) dbUpdates.customer_cccd = updates.customerCccd;
    if (updates.assetType !== undefined) dbUpdates.asset_type = updates.assetType;
    if (updates.assetModel !== undefined) dbUpdates.asset_model = updates.assetModel;
    if (updates.assetSerial !== undefined) dbUpdates.asset_serial = updates.assetSerial;
    if (updates.loanAmount !== undefined) dbUpdates.loan_amount = updates.loanAmount;
    if (updates.interestRate !== undefined) dbUpdates.interest_rate = updates.interestRate;
    if (updates.interestPeriod !== undefined) dbUpdates.interest_period = updates.interestPeriod;
    if (updates.startDate !== undefined) dbUpdates.start_date = updates.startDate;
    if (updates.endDate !== undefined) dbUpdates.end_date = updates.endDate;
    if (updates.minInterest !== undefined) dbUpdates.min_interest = updates.minInterest;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.notes !== undefined) dbUpdates.notes = updates.notes;
    if (updates.branchId !== undefined) dbUpdates.branch_id = updates.branchId;

    dbUpdates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(PAWN_TABLE)
      .update(dbUpdates)
      .eq("id", id)
      .select()
      .single();

    if (error || !data) {
      return failure({
        code: "supabase",
        message: error?.message || "Không thể cập nhật hợp đồng cầm đồ",
        cause: error,
      });
    }

    return success(mapRow(data));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật hợp đồng cầm đồ",
      cause: e,
    });
  }
}

export async function deletePawnRecord(id: string): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase.from(PAWN_TABLE).delete().eq("id", id);

    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể xóa hợp đồng cầm đồ",
        cause: error,
      });
    }

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa hợp đồng cầm đồ",
      cause: e,
    });
  }
}
