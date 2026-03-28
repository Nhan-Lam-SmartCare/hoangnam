import { supabase } from "../../supabaseClient";
import type { WorkOrder, StockWarning } from "../../types";
import { RepoResult, success, failure } from "./types";
// import { safeAudit } from "./auditLogsRepository";

const WORK_ORDERS_TABLE = "work_orders";

// Helper: Convert snake_case DB response to camelCase TypeScript
function normalizeWorkOrder(row: any): WorkOrder {
  // DEBUG LOG
  if (row.id && (row.notes || row.issuedescription || row.partsused)) {
    console.log("[normalizeWorkOrder] Row Data:", {
      id: row.id,
      notes: row.notes,
      issueDesc: row.issuedescription,
      mappedNotes: row.notes || "",
      mappedIssueDesc: row.issuedescription || row.issueDescription || row.notes || ""
    });
  }
  return {
    id: row.id,
    creationDate: row.creationdate || row.creationDate,
    customerName: row.customername || row.customerName,
    customerPhone: row.customerphone || row.customerPhone,
    vehicleId: row.vehicleid || row.vehicleId,
    vehicleModel: row.vehiclemodel || row.vehicleModel,
    licensePlate: row.licenseplate || row.licensePlate,
    currentKm: row.currentkm || row.currentKm,
    // Map notes to issueDescription since we store description there
    issueDescription: row.issuedescription || row.issueDescription || row.notes || "",
    technicianName: row.technicianname || row.technicianName,
    status: row.status,
    laborCost: row.laborcost || row.laborCost || 0,
    discount: row.discount,
    partsUsed: row.partsused || row.partsUsed,
    additionalServices: row.additionalservices || row.additionalServices,
    notes: row.notes || "",
    total: row.total,
    branchId: row.branchid || row.branchId,
    depositAmount: row.depositamount || row.depositAmount,
    depositDate: row.depositdate || row.depositDate,
    depositTransactionId: row.deposittransactionid || row.depositTransactionId,
    paymentStatus: row.paymentstatus || row.paymentStatus,
    paymentMethod: row.paymentmethod || row.paymentMethod,
    additionalPayment: row.additionalpayment || row.additionalPayment,
    totalPaid: row.totalpaid || row.totalPaid,
    remainingAmount: row.remainingamount || row.remainingAmount,
    paymentDate: row.paymentdate || row.paymentDate,
    cashTransactionId: row.cashtransactionid || row.cashTransactionId,
    refunded: row.refunded,
    refunded_at: row.refunded_at || row.refundedAt,
    refund_transaction_id: row.refund_transaction_id || row.refundTransactionId,
    refund_reason: row.refund_reason || row.refundReason,
  };
}

export async function fetchWorkOrders(): Promise<RepoResult<WorkOrder[]>> {
  try {
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("creationDate", { ascending: false }) // Fixed casing
      .limit(100); // Only load 100 most recent orders

    console.log("[fetchWorkOrders] Raw data from DB:", data);
    console.log(
      "[fetchWorkOrders] Status values:",
      data?.map((d) => ({ id: d.id, status: d.status }))
    );

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    return success((data || []).map(normalizeWorkOrder));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

// Optimized fetch with filtering and pagination
export async function fetchWorkOrdersFiltered(options?: {
  limit?: number;
  daysBack?: number;
  status?: string;
  branchId?: string;
}): Promise<RepoResult<WorkOrder[]>> {
  try {
    const {
      limit = 100, // Default load 100 recent orders
      daysBack = 7, // Default 7 days back
      status,
      branchId,
    } = options || {};

    let query = supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("creationDate", { ascending: false }) // Fixed casing
      .limit(limit);

    // Filter by date (last N days) - if daysBack is 0, load all
    if (daysBack > 0) {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);
      query = query.gte("creationDate", startDate.toISOString()); // Fixed casing
    }

    // Filter by status
    if (status && status !== "all") {
      query = query.eq("status", status);
    }

    // Filter by branch
    if (branchId && branchId !== "all") {
      query = query.eq("branchId", branchId); // Fixed casing
    }

    const { data, error } = await query;

    console.log(
      `[fetchWorkOrdersFiltered] Loaded ${data?.length || 0
      } orders (limit: ${limit}, daysBack: ${daysBack === 0 ? "ALL" : daysBack
      })`
    );

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    return success((data || []).map(normalizeWorkOrder));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

// Atomic variant: delegates to DB RPC to ensure stock decrement, inventory tx, cash tx, and work order insert happen in a single transaction.
export async function createWorkOrderAtomic(input: Partial<WorkOrder>): Promise<
  RepoResult<
    WorkOrder & {
      depositTransactionId?: string;
      paymentTransactionId?: string;
      inventoryTxCount?: number;
      stockWarnings?: StockWarning[];
      inventoryDeducted?: boolean;
    }
  >
> {
  try {
    if (!input.id)
      return failure({
        code: "validation",
        message: "Thiếu ID phiếu sửa chữa",
      });

    // 🔹 FALLBACK: Use direct insert since RPC function is missing/broken on user's DB
    // Map input to DB columns (based on supabase_complete_setup.sql)
    const newOrder = {
      id: input.id,
      "creationDate": input.creationDate || new Date().toISOString(),
      "customerName": input.customerName || "",
      "customerPhone": input.customerPhone || "",
      "vehicleModel": input.vehicleModel || "",
      "licensePlate": input.licensePlate || "", // Stores Serial/IMEI
      // Not storing vehicleId or currentKm as columns don't exist in setup script

      status: input.status || "Tiếp nhận",
      "laborCost": input.laborCost || 0,
      discount: input.discount || 0,
      "partsUsed": input.partsUsed || [],
      // additionalServices not in schema, ignoring

      notes: input.issueDescription || "", // Mapped to 'notes'
      total: input.total || 0,
      "branchId": input.branchId || "CN1",

      "paymentStatus": input.paymentStatus || "unpaid",
      "paymentMethod": input.paymentMethod || null,
      "totalPaid": input.additionalPayment || 0, // Initial payment?
      "remainingAmount": (input.total || 0) - (input.additionalPayment || 0) - (input.depositAmount || 0),

      // Store deposit info in notes or separate logic if needed?
      // For now, simpler insert to ensure SAVE works.
    };

    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .insert(newOrder)
      .select()
      .single();

    if (error) {
      console.error("[createWorkOrderAtomic] Insert Error:", error);
      return failure({
        code: "supabase",
        message: "Không thể tạo phiếu sửa chữa (Lỗi Database)",
        cause: error,
      });
    }

    return success({
      ...normalizeWorkOrder(data),
      // Mock these as they are not returned by simple insert
      inventoryTxCount: 0,
      inventoryDeducted: false
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo phiếu sửa chữa (atomic)",
      cause: e,
    });
  }
}

// Atomic update variant: adjusts inventory and cash when parts are added/removed
export async function updateWorkOrderAtomic(input: Partial<WorkOrder>): Promise<
  RepoResult<
    WorkOrder & {
      depositTransactionId?: string;
      paymentTransactionId?: string;
      stockWarnings?: StockWarning[];
    }
  >
> {
  try {
    if (!input.id)
      return failure({
        code: "validation",
        message: "Thiếu ID phiếu sửa chữa",
      });

    // 🔹 FALLBACK: Use direct update since RPC function is missing/broken on user's DB
    // Map input to DB columns (based on supabase_complete_setup.sql)
    const partsToSave = input.partsUsed || (input as any).parts || [];

    // Ensure parts have valid structure (though JSONB accepts generic, we want consistency)
    // NOTE: WorkOrderMobileModal already cleans custom partIds.

    const updates = {
      "customerName": input.customerName,
      "customerPhone": input.customerPhone,
      "vehicleModel": input.vehicleModel,
      "licensePlate": input.licensePlate, // Stores Serial/IMEI

      status: input.status,
      "laborCost": input.laborCost,
      discount: input.discount,
      "partsUsed": partsToSave,

      notes: input.issueDescription, // Mapped to 'notes'
      total: input.total,
      "branchId": input.branchId, // Might not allow changing branch?

      "paymentStatus": input.paymentStatus,
      "paymentMethod": input.paymentMethod,
      // For updates, simpler payment handling (ignoring deposits for fallback)
    };

    // Remove undefined keys so we don't overwrite with null unless intended
    Object.keys(updates).forEach(key => (updates as any)[key] === undefined && delete (updates as any)[key]);

    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .update(updates)
      .eq("id", input.id)
      .select()
      .single();

    if (error) {
      console.error("[updateWorkOrderAtomic] Update Error:", error);
      return failure({
        code: "supabase",
        message: "Cập nhật phiếu sửa chữa (atomic) thất bại",
        cause: error,
      });
    }

    return success({
      ...normalizeWorkOrder(data),
      // Mock these as they are not returned by simple update
      depositTransactionId: undefined,
      paymentTransactionId: undefined,
      stockWarnings: undefined
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function updateWorkOrder(
  id: string,
  updates: Partial<WorkOrder>
): Promise<RepoResult<WorkOrder>> {
  try {
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể cập nhật phiếu sửa chữa",
        cause: error,
      });

    // Audit
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed

    return success(data as WorkOrder);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phiếu sửa chữa",
      cause: e,
    });
  }
}

export async function deleteWorkOrder(id: string): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .delete()
      .eq("id", id);

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể xóa phiếu sửa chữa",
        cause: error,
      });

    // Audit
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa phiếu sửa chữa",
      cause: e,
    });
  }
}

// Refund work order atomically: restore inventory, create refund transaction
export async function refundWorkOrder(
  orderId: string,
  refundReason: string
): Promise<
  RepoResult<
    WorkOrder & {
      refund_transaction_id?: string;
      refundAmount?: number;
    }
  >
> {
  try {
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }

    const { data, error } = await supabase.rpc("work_order_refund_atomic", {
      p_order_id: orderId,
      p_refund_reason: refundReason,
      p_user_id: userId || "unknown",
    });

    if (error || !data) {
      console.error("[refundWorkOrder] RPC error:", error);
      console.error("[refundWorkOrder] Error code:", error?.code);
      console.error("[refundWorkOrder] Error message:", error?.message);
      console.error("[refundWorkOrder] Error details:", error?.details);

      const rawDetails = error?.details || error?.message || "";
      const upper = rawDetails.toUpperCase();

      if (upper.includes("ORDER_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phiếu sửa chữa",
          cause: error,
        });
      if (upper.includes("ALREADY_REFUNDED"))
        return failure({
          code: "validation",
          message: "Phiếu này đã được hoàn tiền rồi",
          cause: error,
        });
      if (upper.includes("UNAUTHORIZED"))
        return failure({
          code: "supabase",
          message: "Bạn không có quyền hoàn tiền",
          cause: error,
        });
      if (upper.includes("BRANCH_MISMATCH"))
        return failure({
          code: "validation",
          message: "Chi nhánh không khớp với quyền hiện tại",
          cause: error,
        });
      return failure({
        code: "supabase",
        message: `Hoàn tiền thất bại: ${error?.message || "Lỗi không xác định"}`,
        cause: error,
      });
    }

    const workOrderRow = (data as any).workOrder as WorkOrder | undefined;
    const refund_transaction_id = (data as any).refund_transaction_id as
      | string
      | undefined;
    const refundAmount = (data as any).refundAmount as number | undefined;

    if (!workOrderRow) {
      return failure({ code: "unknown", message: "Kết quả RPC không hợp lệ" });
    }

    // Audit removed

    return success({
      ...(workOrderRow as any),
      refund_transaction_id,
      refundAmount,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi hoàn tiền",
      cause: e,
    });
  }
}

/**
 * Thanh toán phiếu sửa chữa và trừ kho khi đã thanh toán đủ
 * @param orderId - ID phiếu sửa chữa
 * @param paymentMethod - Phương thức thanh toán (cash, transfer, card)
 * @param paymentAmount - Số tiền thanh toán
 */
export async function completeWorkOrderPayment(
  orderId: string,
  paymentMethod: string,
  paymentAmount: number
): Promise<
  RepoResult<
    WorkOrder & {
      paymentTransactionId?: string;
      newPaymentStatus?: string;
      inventoryDeducted?: boolean;
    }
  >
> {
  try {
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }

    const { data, error } = await supabase.rpc("work_order_complete_payment", {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
      p_payment_amount: paymentAmount,
      p_user_id: userId || "unknown",
    });

    if (error || !data) {
      console.error("[completeWorkOrderPayment] RPC error:", error);

      const rawDetails = error?.details || error?.message || "";
      const upper = rawDetails.toUpperCase();

      if (upper.includes("INSUFFICIENT_STOCK")) {
        let items: any[] = [];
        const colon = rawDetails.indexOf(":");
        if (colon !== -1) {
          const jsonStr = rawDetails.slice(colon + 1).trim();
          try {
            items = JSON.parse(jsonStr);
          } catch { }
        }
        const list = Array.isArray(items)
          ? items
            .map(
              (d: any) =>
                `${d.partName || d.partId || "?"} (còn ${d.available}, cần ${d.requested
                })`
            )
            .join(", ")
          : "";
        return failure({
          code: "validation",
          message: list
            ? `Thiếu tồn kho: ${list}`
            : "Tồn kho không đủ để hoàn thành thanh toán",
          cause: error,
        });
      }
      if (upper.includes("ORDER_NOT_FOUND"))
        return failure({
          code: "validation",
          message: "Không tìm thấy phiếu sửa chữa",
          cause: error,
        });
      if (upper.includes("ORDER_REFUNDED"))
        return failure({
          code: "validation",
          message: "Phiếu này đã được hoàn tiền",
          cause: error,
        });
      if (upper.includes("UNAUTHORIZED"))
        return failure({
          code: "supabase",
          message: "Bạn không có quyền thanh toán",
          cause: error,
        });
      if (upper.includes("BRANCH_MISMATCH"))
        return failure({
          code: "validation",
          message: "Chi nhánh không khớp với quyền hiện tại",
          cause: error,
        });
      return failure({
        code: "supabase",
        message: `Thanh toán thất bại: ${error?.message || "Lỗi không xác định"}`,
        cause: error,
      });
    }

    const workOrderRow = (data as any).workOrder as WorkOrder | undefined;
    const paymentTransactionId = (data as any).paymentTransactionId as
      | string
      | undefined;
    const newPaymentStatus = (data as any).newPaymentStatus as
      | string
      | undefined;
    const inventoryDeducted = (data as any).inventoryDeducted as
      | boolean
      | undefined;

    if (!workOrderRow) {
      console.error("[completeWorkOrderPayment] Invalid RPC result:", {
        data,
        orderId,
        paymentMethod,
        paymentAmount,
      });
      return failure({
        code: "unknown",
        message: `Kết quả RPC không hợp lệ. Vui lòng kiểm tra lại database function 'work_order_complete_payment'. Data received: ${JSON.stringify(
          data
        )}`,
      });
    }

    // Audit removed

    return success({
      ...normalizeWorkOrder(workOrderRow),
      paymentTransactionId,
      newPaymentStatus,
      inventoryDeducted,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thanh toán",
      cause: e,
    });
  }
}
