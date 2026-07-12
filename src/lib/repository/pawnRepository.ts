import { supabase } from "../../supabaseClient";
import type { PawnRecord } from "../../types";
import { RepoResult, success, failure } from "./types";

const PAWN_TABLE = "pawn_records";

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
  created_at: row.created_at,
  updated_at: row.updated_at,
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
