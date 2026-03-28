import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure, RepoSuccess, RepoError } from "./types";
import { InventoryTransaction } from "../../types";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
// import { safeAudit } from "./auditLogsRepository";

const TABLE = "inventory_transactions";

export interface CreateInventoryTxInput {
  type: InventoryTransaction["type"]; // "Nhập kho" | "Xuất kho"
  partId: string;
  partName: string;
  quantity: number; // positive number, will be signed logically by type
  branchId: string;
  date?: string; // ISO
  unitPrice?: number; // optional for Xuất kho
  totalPrice?: number; // if omitted -> quantity * unitPrice (if unitPrice provided)
  notes?: string;
  saleId?: string;
  workOrderId?: string;
}

// Fetch latest transactions (optionally by branch, limit, date range)
export async function fetchInventoryTransactions(params?: {
  branchId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}): Promise<RepoResult<InventoryTransaction[]>> {
  try {
    let query = supabase
      .from(TABLE)
      .select(
        "id,type,partId,partName,quantity,date,unitPrice,totalPrice,branchId,notes,saleId,workOrderId,created_at"
      )
      .order("created_at", { ascending: false });
    if (params?.branchId) query = query.eq("branchId", params.branchId);
    if (params?.startDate) query = query.gte("date", params.startDate);
    if (params?.endDate) query = query.lte("date", params.endDate);
    if (params?.limit) query = query.limit(params.limit);
    const { data, error } = await query;
    if (error)
      return failure({
        code: "supabase",
        message:
          (error as any)?.message ||
          (error as any)?.details ||
          "Không thể tải lịch sử kho",
        cause: error,
      });
    return success((data || []) as InventoryTransaction[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải lịch sử kho",
      cause: e,
    });
  }
}

export async function createInventoryTransaction(
  input: CreateInventoryTxInput
): Promise<RepoResult<InventoryTransaction>> {
  try {
    if (!input.partId || !input.partName)
      return failure({
        code: "validation",
        message: "Thiếu thông tin phụ tùng",
      });
    if (!input.quantity || input.quantity <= 0)
      return failure({ code: "validation", message: "Số lượng phải > 0" });
    if (!input.branchId)
      return failure({ code: "validation", message: "Thiếu chi nhánh" });
    if (!input.type)
      return failure({
        code: "validation",
        message: "Thiếu loại giao dịch kho",
      });

    const unitPrice = input.unitPrice ?? 0;
    const totalPrice = input.totalPrice ?? unitPrice * input.quantity;

    const payload: any = {
      id:
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
      type: input.type,
      partId: input.partId,
      partName: input.partName,
      quantity: input.quantity,
      date: input.date || new Date().toISOString(),
      unitPrice: unitPrice || null,
      totalPrice,
      branchId: input.branchId,
      notes: input.notes,
      saleId: input.saleId,
      workOrderId: input.workOrderId,
    };

    const { data, error } = await supabase
      .from(TABLE)
      .insert([payload])
      .select()
      .single();
    if (error || !data)
      return failure({
        code: "supabase",
        message:
          (error as any)?.message ||
          (error as any)?.details ||
          "Ghi lịch sử kho thất bại",
        cause: error,
      });
    // Audit inventory transaction
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed
    return success(data as InventoryTransaction);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi ghi lịch sử kho",
      cause: e,
    });
  }
}

export async function createReceiptAtomic(
  items: any[],
  supplierId: string,
  branchId: string,
  userId: string,
  notes: string
): Promise<RepoResult<any>> {
  try {
    const { data, error } = await supabase.rpc("receipt_create_atomic", {
      p_items: items,
      p_supplier_id: supplierId,
      p_branch_id: branchId,
      p_user_id: userId,
      p_notes: notes,
    });

    if (error) {
      return failure({
        code: "supabase",
        message: error.message,
        cause: error,
      });
    }

    if (data && !data.success) {
      return failure({
        code: "validation",
        message: data.message,
      });
    }

    return success(data);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo phiếu nhập",
      cause: e,
    });
  }
}

export function useCreateReceiptAtomicRepo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      items: any[];
      supplierId: string;
      branchId: string;
      userId: string;
      notes: string;
    }) => {
      const res = await createReceiptAtomic(
        params.items,
        params.supplierId,
        params.branchId,
        params.userId,
        params.notes
      );
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Update inventory history
      queryClient.invalidateQueries({ queryKey: ["partsRepo"] }); // Update stock display
      queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Update stock display
      queryClient.invalidateQueries({ queryKey: ["allPartsForTotals"] }); // Refresh inventory health
    },
  });
}
