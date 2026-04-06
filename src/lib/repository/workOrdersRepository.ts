import { supabase } from "../../supabaseClient";
import type { WorkOrder, StockWarning } from "../../types";
import { RepoResult, success, failure } from "./types";
import { formatWorkOrderId } from "../../utils/format";
// import { safeAudit } from "./auditLogsRepository";

const WORK_ORDERS_TABLE = "work_orders";

function getMissingColumnNameFromError(error: any): string | null {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  if (code !== "PGRST204" && !message.toLowerCase().includes("column")) {
    return null;
  }

  const singleQuoteMatch = message.match(/'([^']+)'\s+column/i);
  if (singleQuoteMatch?.[1]) return singleQuoteMatch[1];

  const doubleQuoteMatch = message.match(/"([^"]+)"\s+column/i);
  if (doubleQuoteMatch?.[1]) return doubleQuoteMatch[1];

  return null;
}

function removeMissingColumnKeys(payload: Record<string, any>, missingColumn: string): number {
  const normalizedMissing = String(missingColumn || "").replace(/['"]/g, "").toLowerCase();
  if (!normalizedMissing) return 0;

  let removed = 0;
  Object.keys(payload).forEach((key) => {
    if (String(key).toLowerCase() === normalizedMissing) {
      delete payload[key];
      removed += 1;
    }
  });
  return removed;
}

async function resolveRefundTargetWorkOrder(
  orderId: string
): Promise<{ id: string; row: any } | null> {
  const { data: exactRow } = await supabase
    .from(WORK_ORDERS_TABLE)
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (exactRow?.id) {
    return { id: String(exactRow.id), row: exactRow };
  }

  const normalizedInput = formatWorkOrderId(orderId);
  if (!normalizedInput) return null;

  const suffix = normalizedInput.split("-").pop() || "";
  let candidates: any[] = [];

  if (suffix) {
    const { data } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .ilike("id", `%${suffix}`)
      .limit(30);
    candidates = data || [];
  }

  if (candidates.length === 0) {
    const { data } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    candidates = data || [];
  }

  const matched = candidates.find(
    (row) => formatWorkOrderId(String(row?.id || "")) === normalizedInput
  );

  if (!matched?.id) return null;
  return { id: String(matched.id), row: matched };
}

async function clearWorkerCompensationForCanceledOrder(orderId: string): Promise<void> {
  try {
    let serviceIds: string[] = [];

    const serviceIdQueries = [
      supabase
        .from("repair_order_services")
        .select("id")
        .eq("repair_order_id", orderId),
      supabase
        .from("repair_order_services")
        .select("id")
        .eq("repairOrderId", orderId),
    ];

    for (const query of serviceIdQueries) {
      const { data, error } = await query;
      if (!error && data) {
        serviceIds = data.map((row: any) => String(row.id)).filter(Boolean);
        if (serviceIds.length > 0) break;
      }
    }

    if (serviceIds.length > 0) {
      await supabase
        .from("repair_order_service_workers")
        .update({ worker_amount: 0 })
        .in("repair_order_service_id", serviceIds);

      const servicePayloads: Array<Record<string, any>> = [
        {
          worker_amount: 0,
          worker_share_percent: 0,
          is_payable_to_worker: false,
        },
        {
          workerAmount: 0,
          workerSharePercent: 0,
          isPayableToWorker: false,
        },
      ];

      for (const payload of servicePayloads) {
        const { error } = await supabase
          .from("repair_order_services")
          .update(payload)
          .in("id", serviceIds);
        if (!error) break;
      }
    }

    const orderPayloads: Array<Record<string, any>> = [
      { worker_total: 0 },
      { workerTotal: 0 },
      { worker_total: 0, workerTotal: 0 },
    ];

    for (const payload of orderPayloads) {
      const { error } = await supabase
        .from(WORK_ORDERS_TABLE)
        .update(payload)
        .eq("id", orderId);
      if (!error) break;
    }
  } catch (error) {
    console.warn("[refundWorkOrder] Failed clearing worker compensation for canceled order", {
      orderId,
      error,
    });
  }
}

// Some deployments use camelCase columns, others use lowercase columns.
// This helper writes technician/labor with multiple key variants so data is persisted reliably.
async function syncTechnicianAndLaborFallback(
  orderId: string,
  technicianName: string,
  laborCost: number
): Promise<void> {
  const payloads: Array<Record<string, any>> = [
    {
      technicianname: technicianName,
      laborcost: laborCost,
    },
    {
      technicianName: technicianName,
      laborCost: laborCost,
    },
  ];

  for (const payload of payloads) {
    const { error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .update(payload)
      .eq("id", orderId);
    if (!error) return;
  }
}

// Helper: Convert snake_case DB response to camelCase TypeScript
function normalizeWorkOrder(row: any): WorkOrder {
  // DEBUG LOG
  if (row.id && (row.notes || row.issuedescription || row.partsused)) {
    // noop: retained as a lightweight debug checkpoint for suspicious row shapes
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
    laborTotal: row.labor_total || row.laborTotal || row.laborcost || row.laborCost || 0,
    discount: row.discount,
    partsUsed: row.partsused || row.partsUsed,
    additionalServices: row.additionalservices || row.additionalServices,
    notes: row.notes || "",
    total: row.total,
    workerTotal: row.worker_total || row.workerTotal || 0,
    branchId: row.branchid || row.branchId,
    created_by: row.created_by || row.createdBy || row.createdby || null,
    createdBy: row.createdBy || row.created_by || row.createdby || null,
    createdby: row.createdby || row.created_by || row.createdBy || null,
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
    refunded:
      row.refunded === true ||
      row.status === "Đã hủy" ||
      row.status === "Da huy",
    refunded_at: row.refunded_at || row.refundedAt,
    refund_transaction_id: row.refund_transaction_id || row.refundTransactionId,
    refund_reason: row.refund_reason || row.refundReason,
  };
}

async function attachRepairServices(workOrders: WorkOrder[]): Promise<WorkOrder[]> {
  if (workOrders.length === 0) return workOrders;

  const orderIds = workOrders.map((order) => order.id);
  const { data, error } = await supabase
    .from("repair_order_services")
    .select("*, repair_order_service_workers(*), repair_order_service_items(*)")
    .in("repair_order_id", orderIds);

  if (error || !data) {
    return workOrders;
  }

  const serviceMap = new Map<string, any[]>();
  for (const row of data) {
    const existing = serviceMap.get(row.repair_order_id) || [];
    existing.push({
      id: row.id,
      repairOrderId: row.repair_order_id,
      serviceId: row.service_id || undefined,
      serviceName: row.service_name,
      laborCalcType: row.labor_calc_type || "fixed",
      laborFixedAmount: Number(row.labor_fixed_amount || 0),
      laborPercentOfCost: Number(row.labor_percent_of_cost || 0),
      minimumLaborAmount: Number(row.minimum_labor_amount || 0),
      relatedProductCost: Number(row.related_product_cost || 0),
      laborAmount: Number(row.labor_amount || 0),
      workerSharePercent: Number(row.worker_share_percent || 0),
      workerAmount: Number(row.worker_amount || 0),
      isBillable: row.is_billable ?? true,
      isPayableToWorker: row.is_payable_to_worker ?? true,
      note: row.note || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workers: (row.repair_order_service_workers || []).map((worker: any) => ({
        id: worker.id,
        repairOrderServiceId: worker.repair_order_service_id,
        workerId: worker.worker_id,
        workerName: worker.worker_name || "",
        sharePercent: Number(worker.share_percent || 0),
        workerAmount: Number(worker.worker_amount || 0),
        createdAt: worker.created_at,
      })),
      relatedItems: (row.repair_order_service_items || []).map((item: any) => ({
        id: item.id,
        repairOrderServiceId: item.repair_order_service_id,
        partId: item.part_id,
        partName: item.part_name || "",
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unit_cost || 0),
        lineCost: Number(item.line_cost || 0),
        createdAt: item.created_at,
      })),
    });
    serviceMap.set(row.repair_order_id, existing);
  }

  return workOrders.map((order) => ({
    ...order,
    repairServices: serviceMap.get(order.id) || [],
  }));
}

export async function fetchWorkOrders(): Promise<RepoResult<WorkOrder[]>> {
  try {
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("creationDate", { ascending: false }) // Fixed casing
      .limit(100); // Only load 100 most recent orders

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    const normalized = (data || []).map(normalizeWorkOrder);
    return success(await attachRepairServices(normalized));
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
  ownerUserId?: string;
  ownerDisplayName?: string;
}): Promise<RepoResult<WorkOrder[]>> {
  try {
    const {
      limit = 100, // Default load 100 recent orders
      daysBack = 7, // Default 7 days back
      status,
      branchId,
      ownerUserId,
      ownerDisplayName,
    } = options || {};

    const normalizedOwnerId = String(ownerUserId || "").trim();
    const normalizedOwnerName = String(ownerDisplayName || "").trim().toLowerCase();

    const applyCommonFilters = (query: any) => {
      let nextQuery = query
        .order("creationDate", { ascending: false }) // Fixed casing
        .limit(limit);

      // Filter by date (last N days) - if daysBack is 0, load all
      if (daysBack > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        nextQuery = nextQuery.gte("creationDate", startDate.toISOString()); // Fixed casing
      }

      // Filter by status
      if (status && status !== "all") {
        nextQuery = nextQuery.eq("status", status);
      }

      // Filter by branch
      if (branchId && branchId !== "all") {
        nextQuery = nextQuery.eq("branchId", branchId); // Fixed casing
      }

      return nextQuery;
    };

    const isMissingColumnError = (err: any, columnName: string) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      const hint = String(err?.hint || "").toLowerCase();
      const needle = columnName.toLowerCase();
      return (
        code === "PGRST204" ||
        message.includes("column") ||
        details.includes("column") ||
        hint.includes("column")
      ) && (message.includes(needle) || details.includes(needle) || hint.includes(needle));
    };

    let data: any[] | null = null;
    let error: any = null;

    if (normalizedOwnerId) {
      const ownerColumns = ["created_by", "createdBy", "createdby"];

      for (let i = 0; i < ownerColumns.length; i++) {
        const ownerColumn = ownerColumns[i];
        const query = applyCommonFilters(
          supabase.from(WORK_ORDERS_TABLE).select("*")
        ).eq(ownerColumn, normalizedOwnerId);

        const res = await query;
        data = res.data;
        error = res.error;

        if (!error) {
          break;
        }

        // Try next ownership column when current schema does not have this column.
        if (isMissingColumnError(error, ownerColumn) && i < ownerColumns.length - 1) {
          continue;
        }

        break;
      }

      // Final fallback for old schema: filter by assigned technician name to avoid showing all tickets.
      if (error && isMissingColumnError(error, "createdby")) {
        const fallbackRes = await applyCommonFilters(
          supabase.from(WORK_ORDERS_TABLE).select("*")
        );
        data = fallbackRes.data;
        error = fallbackRes.error;
        if (!error) {
          if (!normalizedOwnerName) {
            data = [];
          } else {
            const allOrders = (data || []).map(normalizeWorkOrder);
            const filteredByTechnician = allOrders.filter(
              (order) => String(order.technicianName || "").trim().toLowerCase() === normalizedOwnerName
            );
            return success(await attachRepairServices(filteredByTechnician));
          }
        }
      }
    } else {
      const res = await applyCommonFilters(
        supabase.from(WORK_ORDERS_TABLE).select("*")
      );
      data = res.data;
      error = res.error;
    }

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    const normalized = (data || []).map(normalizeWorkOrder);
    return success(await attachRepairServices(normalized));
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
    const creatorId = (input as any).created_by || (input as any).createdBy || null;
    const depositAmount = Math.max(0, Number(input.depositAmount || 0));
    const additionalPayment = Math.max(0, Number(input.additionalPayment || 0));
    const providedTotalPaid = Number(input.totalPaid);
    const totalPaid = Number.isFinite(providedTotalPaid)
      ? Math.max(0, providedTotalPaid)
      : depositAmount + additionalPayment;
    const providedRemaining = Number(input.remainingAmount);
    const remainingAmount = Number.isFinite(providedRemaining)
      ? Math.max(0, providedRemaining)
      : Math.max(0, Number(input.total || 0) - totalPaid);

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
      "depositAmount": depositAmount,
      "additionalPayment": additionalPayment,
      "totalPaid": totalPaid,
      "remainingAmount": remainingAmount,
      "paymentDate": input.paymentStatus === "paid" ? new Date().toISOString() : null,
    };

    const insertPayloads: Array<Record<string, any>> = creatorId
      ? [
        { ...newOrder, created_by: creatorId },
        { ...newOrder, createdBy: creatorId },
        { ...newOrder, createdby: creatorId },
        { ...newOrder },
      ]
      : [{ ...newOrder }];

    let data: any = null;
    let error: any = null;

    for (const payload of insertPayloads) {
      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      ) as Record<string, any>;

      while (true) {
        const res = await supabase
          .from(WORK_ORDERS_TABLE)
          .insert(sanitizedPayload)
          .select()
          .single();

        data = res.data;
        error = res.error;

        if (!error) {
          break;
        }

        const missingColumn = getMissingColumnNameFromError(error);
        if (!missingColumn) {
          break;
        }

        const removedCount = removeMissingColumnKeys(sanitizedPayload, missingColumn);
        if (removedCount === 0) {
          break;
        }

        console.warn("[createWorkOrderAtomic] Retry insert without missing column", {
          missingColumn,
        });
      }

      if (!error) {
        break;
      }
    }

    if (error) {
      console.error("[createWorkOrderAtomic] Insert Error:", error);
      return failure({
        code: "supabase",
        message: "Không thể tạo phiếu sửa chữa (Lỗi Database)",
        cause: error,
      });
    }

    await syncTechnicianAndLaborFallback(
      input.id,
      String(input.technicianName || ""),
      Number(input.laborCost || 0)
    );

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
    const normalizedDepositAmount =
      input.depositAmount !== undefined
        ? Math.max(0, Number(input.depositAmount || 0))
        : undefined;
    const normalizedAdditionalPayment =
      input.additionalPayment !== undefined
        ? Math.max(0, Number(input.additionalPayment || 0))
        : undefined;
    const normalizedTotalPaid =
      input.totalPaid !== undefined
        ? Math.max(0, Number(input.totalPaid || 0))
        : normalizedDepositAmount !== undefined || normalizedAdditionalPayment !== undefined
          ? Math.max(0, Number(normalizedDepositAmount || 0) + Number(normalizedAdditionalPayment || 0))
          : undefined;
    const normalizedRemainingAmount =
      input.remainingAmount !== undefined
        ? Math.max(0, Number(input.remainingAmount || 0))
        : normalizedTotalPaid !== undefined && input.total !== undefined
          ? Math.max(0, Number(input.total || 0) - normalizedTotalPaid)
          : undefined;

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
      "depositAmount": normalizedDepositAmount,
      "additionalPayment": normalizedAdditionalPayment,
      "totalPaid": normalizedTotalPaid,
      "remainingAmount": normalizedRemainingAmount,
      "paymentDate": input.paymentStatus === "paid" ? new Date().toISOString() : undefined,
    };

    // Remove undefined keys so we don't overwrite with null unless intended
    Object.keys(updates).forEach(key => (updates as any)[key] === undefined && delete (updates as any)[key]);

    const sanitizedUpdates = { ...(updates as Record<string, any>) };

    let data: any = null;
    let error: any = null;

    while (true) {
      const res = await supabase
        .from(WORK_ORDERS_TABLE)
        .update(sanitizedUpdates)
        .eq("id", input.id)
        .select()
        .single();

      data = res.data;
      error = res.error;

      if (!error) {
        break;
      }

      const missingColumn = getMissingColumnNameFromError(error);
      if (!missingColumn) {
        break;
      }

      const removedCount = removeMissingColumnKeys(sanitizedUpdates, missingColumn);
      if (removedCount === 0) {
        break;
      }

      console.warn("[updateWorkOrderAtomic] Retry update without missing column", {
        missingColumn,
      });
    }

    if (error) {
      console.error("[updateWorkOrderAtomic] Update Error:", error);
      return failure({
        code: "supabase",
        message: "Cập nhật phiếu sửa chữa (atomic) thất bại",
        cause: error,
      });
    }

    await syncTechnicianAndLaborFallback(
      input.id,
      String(input.technicianName || ""),
      Number(input.laborCost || 0)
    );

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
    let _userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      _userId = userData?.user?.id || null;
    } catch {
      // noop: audit path is optional
    }
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
    let _userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      _userId = userData?.user?.id || null;
    } catch {
      // noop: audit path is optional
    }
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
    const resolvedOrder = await resolveRefundTargetWorkOrder(orderId);
    const refundTargetOrderId = resolvedOrder?.id || orderId;

    const isMissingRefundRpcSignature = (err: any) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      return (
        code === "PGRST202" &&
        (message.includes("work_order_refund_atomic") ||
          details.includes("work_order_refund_atomic"))
      );
    };

    const runFallbackDirectRefundUpdate = async () => {
      let existingRow = resolvedOrder?.row;
      let existingError: any = null;

      if (!existingRow) {
        const fallbackFetch = await supabase
          .from(WORK_ORDERS_TABLE)
          .select("*")
          .eq("id", refundTargetOrderId)
          .single();
        existingRow = fallbackFetch.data;
        existingError = fallbackFetch.error;
      }

      if (existingError || !existingRow) {
        return failure({
          code: "supabase",
          message: "Không tìm thấy phiếu sửa chữa để hoàn tiền",
          cause: existingError,
        });
      }

      const currentOrder = normalizeWorkOrder(existingRow);
      if (currentOrder.refunded) {
        return failure({
          code: "validation",
          message: "Phiếu này đã được hoàn tiền rồi",
        });
      }

      const inventoryWasDeducted =
        Boolean((existingRow as any).inventory_deducted) ||
        Boolean((existingRow as any).inventoryDeducted);

      const branchId = currentOrder.branchId || "CN1";
      const refundAmount = Math.max(0, Number(currentOrder.totalPaid || 0));
      const nowIso = new Date().toISOString();

      // 1) Restore stock for used parts only when this order was previously deducted.
      if (inventoryWasDeducted) {
        const partsUsed = (currentOrder.partsUsed || []) as any[];
        for (const part of partsUsed) {
          const partId = String(part?.partId || "").trim();
          const qty = Math.max(0, Number(part?.quantity || 0));
          if (!partId || qty <= 0) continue;

          const { data: partRow, error: partFetchError } = await supabase
            .from("parts")
            .select("id,name,stock")
            .eq("id", partId)
            .single();

          if (partFetchError || !partRow) {
            console.warn("[refundWorkOrder:fallback] Skip restore stock: part not found", {
              partId,
              partFetchError,
            });
            continue;
          }

          const currentStock = (partRow as any).stock || {};
          const nextStock = {
            ...currentStock,
            [branchId]: Number(currentStock?.[branchId] || 0) + qty,
          };

          const { error: partUpdateError } = await supabase
            .from("parts")
            .update({ stock: nextStock })
            .eq("id", partId);

          if (partUpdateError) {
            console.warn("[refundWorkOrder:fallback] Failed restoring part stock", {
              partId,
              partUpdateError,
            });
            continue;
          }

          // Best-effort inventory history line
          await supabase.from("inventory_transactions").insert([
            {
              id:
                typeof crypto !== "undefined" && (crypto as any).randomUUID
                  ? (crypto as any).randomUUID()
                  : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
              type: "Nhập kho",
              partId,
              partName: String(part?.partName || (partRow as any).name || "Phụ tùng"),
              quantity: qty,
              date: nowIso,
              branchId,
              notes: `Hoàn kho do hủy phiếu ${refundTargetOrderId}`,
              workOrderId: refundTargetOrderId,
            },
          ]);
        }
      } else {
        console.warn("[refundWorkOrder:fallback] Skip stock restore because inventory_deducted is false", {
          refundTargetOrderId,
        });
      }

      // 2) Create refund cash transaction + adjust payment source balance (if any)
      let refundTransactionId: string | undefined;
      if (refundAmount > 0 && currentOrder.paymentMethod) {
        refundTransactionId =
          typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : `${Math.random().toString(36).slice(2)}-${Date.now()}`;

        const cashTxAttempts: Array<{ table: string; payload: any }> = [
          {
            table: "cash_transactions",
            payload: {
              id: refundTransactionId,
              type: "expense",
              category: "refund",
              amount: refundAmount,
              date: nowIso,
              description: `Hoàn tiền hủy phiếu ${refundTargetOrderId} - ${refundReason}`,
              branchid: branchId,
              paymentsource: currentOrder.paymentMethod,
              reference: refundTargetOrderId,
            },
          },
          {
            table: "cash_transactions",
            payload: {
              id: refundTransactionId,
              type: "expense",
              category: "refund",
              amount: refundAmount,
              date: nowIso,
              description: `Hoàn tiền hủy phiếu ${refundTargetOrderId} - ${refundReason}`,
              branchId,
              paymentSource: currentOrder.paymentMethod,
              reference: refundTargetOrderId,
            },
          },
          {
            table: "cashtransactions",
            payload: {
              id: refundTransactionId,
              type: "expense",
              category: "refund",
              amount: refundAmount,
              date: nowIso,
              description: `Hoàn tiền hủy phiếu ${refundTargetOrderId} - ${refundReason}`,
              branchid: branchId,
              paymentsource: currentOrder.paymentMethod,
              reference: refundTargetOrderId,
            },
          },
        ];

        let cashTxInserted = false;
        for (const attempt of cashTxAttempts) {
          const { error: cashTxError } = await supabase
            .from(attempt.table)
            .insert([attempt.payload]);
          if (!cashTxError) {
            cashTxInserted = true;
            break;
          }
          console.warn("[refundWorkOrder:fallback] Failed creating cash transaction", {
            table: attempt.table,
            cashTxError,
          });
        }

        if (!cashTxInserted) {
          refundTransactionId = undefined;
        }

        if (cashTxInserted) {
          const paymentSourceTables = ["payment_sources", "paymentsources"];
          for (const tableName of paymentSourceTables) {
            const { data: sourceRow, error: sourceFetchError } = await supabase
              .from(tableName)
              .select("id,balance")
              .eq("id", currentOrder.paymentMethod)
              .single();

            if (sourceFetchError || !sourceRow) {
              continue;
            }

            const currentBalance = (sourceRow as any).balance || {};
            const nextBalance = {
              ...currentBalance,
              [branchId]: Number(currentBalance?.[branchId] || 0) - refundAmount,
            };

            const updateAttempts = [
              { balance: nextBalance },
              { balance: nextBalance, updated_at: nowIso },
            ];

            for (const payload of updateAttempts) {
              const { error: sourceUpdateError } = await supabase
                .from(tableName)
                .update(payload)
                .eq("id", currentOrder.paymentMethod);
              if (!sourceUpdateError) {
                break;
              }
              console.warn("[refundWorkOrder:fallback] Failed updating payment source balance", {
                tableName,
                sourceUpdateError,
              });
            }
            break;
          }
        }
      }

      // 3) Mark work order as refunded/canceled
      const updateCandidates: Array<Record<string, any>> = [
        {
          refunded: true,
          status: "Đã hủy",
          refund_reason: refundReason,
          refunded_at: nowIso,
          refund_transaction_id: refundTransactionId,
          inventory_deducted: false,
        },
        {
          refunded: true,
          status: "Đã hủy",
          refundReason: refundReason,
          refundedAt: nowIso,
          refundTransactionId: refundTransactionId,
          inventoryDeducted: false,
        },
        {
          refunded: true,
          status: "Đã hủy",
          inventory_deducted: false,
        },
        {
          status: "Đã hủy",
          inventory_deducted: false,
        },
      ];

      let updateError: any = null;
      let updated = false;
      for (const candidate of updateCandidates) {
        const payload = Object.fromEntries(
          Object.entries(candidate).filter(([, value]) => value !== undefined)
        );
        const res = await supabase
          .from(WORK_ORDERS_TABLE)
          .update(payload)
          .eq("id", refundTargetOrderId);
        if (!res.error) {
          updated = true;
          break;
        }
        updateError = res.error;
      }

      if (!updated) {
        return failure({
          code: "supabase",
          message: "Không thể cập nhật phiếu sau khi hoàn tiền",
          cause: updateError,
        });
      }

      await clearWorkerCompensationForCanceledOrder(refundTargetOrderId);

      let updatedRow: any = null;
      const { data: refreshedRow } = await supabase
        .from(WORK_ORDERS_TABLE)
        .select("*")
        .eq("id", refundTargetOrderId)
        .single();
      updatedRow = refreshedRow || { ...existingRow, status: "Đã hủy", refunded: true };

      console.warn(
        "[refundWorkOrder] RPC work_order_refund_atomic chưa tồn tại, đã dùng fallback xử lý trực tiếp"
      );

      return success({
        ...normalizeWorkOrder(updatedRow),
        refund_transaction_id: refundTransactionId,
        refundAmount,
      });
    };

    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {
      // noop: fallback still works without user id
    }

    const rpcAttempts: Array<Record<string, any>> = [
      {
        p_order_id: refundTargetOrderId,
        p_refund_reason: refundReason,
        p_user_id: userId || "unknown",
      },
      {
        p_order_id: refundTargetOrderId,
        p_refund_reason: refundReason,
      },
      {
        order_id: refundTargetOrderId,
        refund_reason: refundReason,
      },
    ];

    let data: any = null;
    let error: any = null;

    for (let i = 0; i < rpcAttempts.length; i++) {
      const attempt = rpcAttempts[i];
      const res = await supabase.rpc("work_order_refund_atomic", attempt);
      data = res.data;
      error = res.error;

      if (!error) {
        break;
      }

      // If this is not a signature mismatch, don't continue trying other shapes.
      if (!isMissingRefundRpcSignature(error)) {
        break;
      }
    }

    if (error || !data) {
      console.error("[refundWorkOrder] RPC error:", error);
      console.error("[refundWorkOrder] Error code:", error?.code);
      console.error("[refundWorkOrder] Error message:", error?.message);
      console.error("[refundWorkOrder] Error details:", error?.details);

      if (error && isMissingRefundRpcSignature(error)) {
        return await runFallbackDirectRefundUpdate();
      }

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

    await clearWorkerCompensationForCanceledOrder(refundTargetOrderId);

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
    const isMissingCompletePaymentRpc = (err: any) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      return (
        code === "PGRST202" ||
        message.includes("work_order_complete_payment") ||
        details.includes("work_order_complete_payment")
      );
    };

    const runFallbackDirectPaymentUpdate = async () => {
      const { data: existingRow, error: existingError } = await supabase
        .from(WORK_ORDERS_TABLE)
        .select("*")
        .eq("id", orderId)
        .single();

      if (existingError || !existingRow) {
        return failure({
          code: "supabase",
          message: "Không tìm thấy phiếu sửa chữa để thanh toán",
          cause: existingError,
        });
      }

      const currentOrder = normalizeWorkOrder(existingRow);
      const currentTotal = Number(currentOrder.total || 0);
      const currentPaid = Number(currentOrder.totalPaid || 0);
      const currentDeposit = Math.max(0, Number(currentOrder.depositAmount || 0));
      const addPaid = Math.max(0, Number(paymentAmount || 0));
      const nextPaid = currentPaid + addPaid;
      const remainingAmount = Math.max(0, currentTotal - nextPaid);
      const nextAdditionalPayment = Math.max(0, nextPaid - currentDeposit);
      const nextStatus =
        remainingAmount <= 0 ? "paid" : nextPaid > 0 ? "partial" : "unpaid";

      const updates: any = {
        paymentStatus: nextStatus,
        paymentMethod: paymentMethod || currentOrder.paymentMethod || null,
        additionalPayment: nextAdditionalPayment,
        totalPaid: nextPaid,
        remainingAmount,
      };

      if (nextStatus === "paid") {
        updates.paymentDate = new Date().toISOString();
      }

      const { data: updatedRow, error: updateError } = await supabase
        .from(WORK_ORDERS_TABLE)
        .update(updates)
        .eq("id", orderId)
        .select("*")
        .single();

      if (updateError || !updatedRow) {
        return failure({
          code: "supabase",
          message: "Thanh toán thất bại (fallback)",
          cause: updateError,
        });
      }

      console.warn(
        "[completeWorkOrderPayment] RPC work_order_complete_payment chưa tồn tại, đã dùng fallback update trực tiếp"
      );

      return success({
        ...normalizeWorkOrder(updatedRow),
        paymentTransactionId: undefined,
        newPaymentStatus: nextStatus,
        inventoryDeducted: false,
      });
    };

    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch {
      // noop: payment can continue without user id in fallback mode
    }

    const { data, error } = await supabase.rpc("work_order_complete_payment", {
      p_order_id: orderId,
      p_payment_method: paymentMethod,
      p_payment_amount: paymentAmount,
      p_user_id: userId || "unknown",
    });

    if (error || !data) {
      if (isMissingCompletePaymentRpc(error)) {
        return await runFallbackDirectPaymentUpdate();
      }

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
          } catch {
            // noop: keep generic stock error message when payload is not JSON
          }
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
