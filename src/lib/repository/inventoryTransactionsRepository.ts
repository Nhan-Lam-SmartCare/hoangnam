import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";
import { InventoryTransaction } from "../../types";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { safeAudit } from "./auditLogsRepository";

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
    const tableCandidates = ["inventory_transactions", "inventorytransactions"];
    const branchColumns: Array<"branchId" | "branchid" | "branch_id" | undefined> = [
      "branchId",
      "branchid",
      "branch_id",
      undefined,
    ];

    let data: any[] | null = null;
    let error: any = null;
    let matchedTable = "";
    let matchedColumn = "";

    outerLoop: for (const tableName of tableCandidates) {
      for (const branchColumn of branchColumns) {
        let query = supabase.from(tableName).select("*");

        if (params?.branchId && branchColumn) {
          query = query.eq(branchColumn, params.branchId);
        }

        if (params?.startDate) query = query.gte("date", params.startDate);
        if (params?.endDate) query = query.lte("date", params.endDate);
        if (params?.limit) query = query.limit(params.limit);

        const res = await query;
        if (!res.error) {
          data = res.data || [];
          error = null;
          matchedTable = tableName;
          matchedColumn = branchColumn || "(no branch filter)";
          break outerLoop;
        }

        error = res.error;
      }
    }

    // If first successful combo returned 0 rows with a branch filter,
    // try again WITHOUT branch filter to detect branchId column mismatch
    if (data && data.length === 0 && matchedColumn !== "(no branch filter)" && params?.branchId) {
      const checkQuery = await supabase.from(matchedTable).select("*").limit(5);
      if (!checkQuery.error && checkQuery.data && checkQuery.data.length > 0) {
        console.warn("⚠️ [fetchInventoryTransactions] Branch filter returned 0 rows but unfiltered has data. Fetching all and filtering in JS.");
        // Re-fetch ALL without branch filter and let JS-side filter handle it
        const fullQuery = await supabase.from(matchedTable).select("*");
        if (!fullQuery.error && fullQuery.data) {
          data = fullQuery.data;
        }
      }
    }

    if (error && (!data || data.length === 0)) {
      return failure({
        code: "supabase",
        message:
          (error as any)?.message ||
          (error as any)?.details ||
          "Không thể tải lịch sử kho",
        cause: error,
      });
    }

    const mapped = (data || []).map((row: any) => ({
      id: row.id,
      type: row.type,
      partId: row.partId || row.partid || row.part_id,
      partName: row.partName || row.partname || row.part_name,
      quantity: Number(row.quantity || row.quantity_change || 0),
      date: row.date || row.created_at,
      unitPrice: Number(row.unitPrice || row.unitprice || row.unit_price || 0),
      totalPrice: Number(row.totalPrice || row.totalprice || row.total_price || 0),
      branchId: row.branchId || row.branchid || row.branch_id,
      notes: row.notes || row.note || "",
      saleId: row.saleId || row.saleid || row.sale_id,
      workOrderId: row.workOrderId || row.workorderid || row.work_order_id,
      supplierId: row.supplierId || row.supplierid || row.supplier_id,
      created_at: row.created_at,
    })) as InventoryTransaction[];

    const branchFiltered = params?.branchId
      ? mapped.filter((tx) => !tx.branchId || tx.branchId === params.branchId)
      : mapped;

    const sorted = [...branchFiltered].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );

    return success(sorted);
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
    safeAudit(userId, {
      action: "inventory.create",
      entityType: "inventory_transaction",
      entityId: (data as any)?.id,
      details: { type: input.type, partName: input.partName, quantity: input.quantity, branchId: input.branchId },
    });
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
    const isMissingReceiptRpc = (err: any) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      return (
        code === "PGRST202" &&
        (message.includes("receipt_create_atomic") ||
          details.includes("receipt_create_atomic"))
      );
    };

    const getMissingColumnFromError = (err: any): string | null => {
      const message = String(err?.message || "");
      const details = String(err?.details || "");
      const text = `${message} ${details}`;
      const match = text.match(/Could not find the '([^']+)' column/i);
      return match?.[1] || null;
    };

    const insertInventoryTxWithFallback = async (payload: Record<string, any>) => {
      const workingPayload: Record<string, any> = { ...payload };
      for (let i = 0; i < 6; i++) {
        const { error } = await supabase
          .from("inventory_transactions")
          .insert([workingPayload]);
        if (!error) return true;

        const missingColumn = getMissingColumnFromError(error);
        if (!missingColumn || !(missingColumn in workingPayload)) {
          console.warn("[createReceiptAtomic:fallback] Cannot insert inventory transaction", {
            error,
            workingPayload,
          });
          return false;
        }
        delete workingPayload[missingColumn];
      }
      return false;
    };

    const runFallbackDirectReceipt = async () => {
      const now = new Date().toISOString();

      for (const item of items || []) {
        const partId = String(item?.partId || "").trim();
        const quantity = Math.max(0, Number(item?.quantity || 0));
        if (!partId || quantity <= 0) continue;

        const { data: partRow, error: partFetchError } = await supabase
          .from("parts")
          .select("id,name,stock")
          .eq("id", partId)
          .single();

        if (partFetchError || !partRow) {
          return failure({
            code: "supabase",
            message: `Không tìm thấy sản phẩm để nhập kho: ${item?.partName || partId}`,
            cause: partFetchError,
          });
        }

        const currentStock = (partRow as any).stock || {};
        const nextStock = {
          ...currentStock,
          [branchId]: Number(currentStock?.[branchId] || 0) + quantity,
        };

        const { error: stockUpdateError } = await supabase
          .from("parts")
          .update({ stock: nextStock })
          .eq("id", partId);

        if (stockUpdateError) {
          return failure({
            code: "supabase",
            message: `Không thể cập nhật tồn kho cho ${item?.partName || partId}`,
            cause: stockUpdateError,
          });
        }

        const txPayload: Record<string, any> = {
          id:
            typeof crypto !== "undefined" && (crypto as any).randomUUID
              ? (crypto as any).randomUUID()
              : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
          type: "Nhập kho",
          partId,
          partName: String(item?.partName || (partRow as any).name || "Sản phẩm"),
          quantity,
          date: now,
          unitPrice: Number(item?.importPrice || 0),
          totalPrice: Number(item?.importPrice || 0) * quantity,
          branchId,
          supplierId,
          notes: notes || `Nhập kho thủ công` ,
          userId,
        };

        const inserted = await insertInventoryTxWithFallback(txPayload);
        if (!inserted) {
          // Keep going if transaction row cannot be written, because stock already updated.
          console.warn("[createReceiptAtomic:fallback] Stock updated but inventory transaction insert skipped", txPayload);
        }
      }

      return success({
        success: true,
        message: "Đã nhập kho bằng fallback (không dùng RPC)",
        mode: "fallback",
      });
    };

    const { data, error } = await supabase.rpc("receipt_create_atomic", {
      p_items: items,
      p_supplier_id: supplierId,
      p_branch_id: branchId,
      p_user_id: userId,
      p_notes: notes,
    });

    if (error) {
      if (isMissingReceiptRpc(error)) {
        return await runFallbackDirectReceipt();
      }

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
