import { supabase } from "../../../supabaseClient";
import type { WorkOrder, StockWarning } from "../../../types";
import { RepoResult, success, failure } from "../types";
import { normalizeWorkOrder, normalizeStatusKey } from "./normalize";
import { encodeAdditionalServicesInNotes } from "./additionalServices";
import {
  getMissingColumnNameFromError,
  removeMissingColumnKeys,
  syncTechnicianAndLaborFallback,
  updateCustomerMetricsOnPayment,
  parseNotNullColumn,
  parseMissingWorkOrderColumn,
  normalizeColumnKey,
  removeMissingColumnFromPayload,
} from "./internal";
import { autoCreateWarrantyCardsForWorkOrder } from "./warranty";
import { adjustStockForUpdatedParts } from "./stock";
import { recordWorkOrderPaymentTransactions, syncAdditionalServicesTransactions } from "./payments";
import { syncCustomerDebtForWorkOrder } from "./debt";

const WORK_ORDERS_TABLE = "work_orders";

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

    // Fetch existing state of the work order before updating
    const { data: oldRow } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .eq("id", input.id)
      .maybeSingle();

    const oldOrder = oldRow ? normalizeWorkOrder(oldRow) : null;
    const oldParts = oldOrder?.partsUsed || [];
    const oldDeducted = oldRow ? (Boolean(oldRow.inventory_deducted) || Boolean(oldRow.inventoryDeducted)) : false;

    // 🔹 FALLBACK: Use direct update since RPC function is missing/broken on user's DB
    // Map input to DB columns (based on supabase_complete_setup.sql)
    const partsToSave = input.partsUsed || (input as any).parts || [];
    const additionalServicesToSave =
      input.additionalServices || (input as any).additionalservices || [];
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
    const notesWithAdditionalServices =
      input.issueDescription !== undefined
        ? encodeAdditionalServicesInNotes(
            String(input.issueDescription || ""),
            additionalServicesToSave as any[]
          )
        : undefined;

    // Ensure parts have valid structure (though JSONB accepts generic, we want consistency)
    // NOTE: WorkOrderMobileModal already cleans custom partIds.

    const updates = {
      "customerName": input.customerName,
      "customerPhone": input.customerPhone,
      "vehicleModel": input.vehicleModel,
      "licensePlate": input.licensePlate, // Stores Serial/IMEI
      vehicleId: input.vehicleId,
      currentKm: input.currentKm,

      status: input.status,
      "laborCost": input.laborCost,
      discount: input.discount,
      "partsUsed": partsToSave,
      "additionalServices": additionalServicesToSave,
      additionalservices: additionalServicesToSave,
      additional_services: additionalServicesToSave,

      // Ảnh thiết bị: undefined sẽ bị strip bên dưới → không ghi đè khi caller không gửi
      device_photos: input.devicePhotos,

      notes: notesWithAdditionalServices, // Mapped to 'notes'
      total: input.total,
      "branchId": input.branchId, // Might not allow changing branch?

      "paymentStatus": input.paymentStatus,
      "paymentMethod": input.paymentMethod,
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

    const normalizedOrder = normalizeWorkOrder(data);
    await autoCreateWarrantyCardsForWorkOrder(
      normalizedOrder
    );

    const completionStatusKey = normalizeStatusKey(normalizedOrder.status);
    const isCompletionStatus = [
      "tra may",
      "da sua xong",
      "hoan tat",
      "completed",
    ].includes(completionStatusKey);
    const isPaidStatus = normalizedOrder.paymentStatus === "paid";
    const branchId = normalizedOrder.branchId || "CN1";

    let finalInventoryDeducted = oldDeducted;
    if (oldDeducted) {
      await adjustStockForUpdatedParts(normalizedOrder.id, oldParts, partsToSave, branchId);
    }

    // Sync cash transactions
    const targetDeposit = normalizedOrder.depositAmount || 0;
    const targetIncome = normalizedOrder.additionalPayment || 0;

    const createdTxs = await recordWorkOrderPaymentTransactions({
      orderId: normalizedOrder.id,
      customerName: normalizedOrder.customerName || "",
      branchId: branchId,
      paymentMethod: normalizedOrder.paymentMethod || "cash",
      depositAmount: targetDeposit,
      servicePayment: targetIncome,
    });

    const depositTx = createdTxs.find(tx => tx.category === "service_deposit");
    const paymentTx = createdTxs.find(tx => tx.category === "service_income");
    const depositTransactionId = depositTx?.id;
    const paymentTransactionId = paymentTx?.id;

    if (depositTransactionId || paymentTransactionId) {
      const updates: Record<string, any> = {};
      if (depositTransactionId) {
        updates.deposittransactionid = depositTransactionId;
        updates.depositTransactionId = depositTransactionId;
      }
      if (paymentTransactionId) {
        updates.cashtransactionid = paymentTransactionId;
        updates.cashTransactionId = paymentTransactionId;
        updates.paymentDate = new Date().toISOString();
      }
      await supabase.from(WORK_ORDERS_TABLE).update(updates).eq("id", normalizedOrder.id);
    }

    await syncAdditionalServicesTransactions(normalizedOrder.id, additionalServicesToSave, branchId);

    const finalOrderToReturn = {
      ...normalizedOrder,
      depositTransactionId: depositTransactionId || normalizedOrder.depositTransactionId,
      cashTransactionId: paymentTransactionId || normalizedOrder.cashTransactionId,
      inventoryDeducted: finalInventoryDeducted,
    };

    await syncCustomerDebtForWorkOrder(finalOrderToReturn);

    // Update customer metrics
    const oldPaid = oldOrder ? Number(oldOrder.totalPaid || 0) : 0;
    const newPaid = Number(finalOrderToReturn.totalPaid || 0);
    const paymentDelta = newPaid - oldPaid;
    if (paymentDelta > 0) {
      await updateCustomerMetricsOnPayment(finalOrderToReturn, paymentDelta, oldPaid === 0);
    }

    return success(finalOrderToReturn);
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

    return success(normalizeWorkOrder(data));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phiếu sửa chữa",
      cause: e,
    });
  }
}

/** Cập nhật phiếu sửa chữa cũ, tự động loại bỏ cột thiếu. */
export async function updateWorkOrderLegacy(
  orderId: string,
  payload: Record<string, any>
): Promise<RepoResult<{ data: any; payload: Record<string, any> }>> {
  let attemptPayload = { ...payload };
  let lastError: any = null;

  for (let i = 0; i < 20; i++) {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .update(attemptPayload)
        .eq("id", orderId)
        .select();

      if (!error) {
        return success({ data, payload: attemptPayload });
      }

      lastError = error;

      const notNullColumn = parseNotNullColumn(error);
      if (
        notNullColumn &&
        normalizeColumnKey(notNullColumn) === normalizeColumnKey("creationDate")
      ) {
        attemptPayload = {
          ...attemptPayload,
          creationDate:
            attemptPayload.creationDate ||
            attemptPayload.creationdate ||
            new Date().toISOString(),
        };
        if (!Object.prototype.hasOwnProperty.call(attemptPayload, "creationdate")) {
          attemptPayload.creationdate = attemptPayload.creationDate;
        }
        continue;
      }

      const missingColumn = parseMissingWorkOrderColumn(error);
      if (!missingColumn) {
        break;
      }

      const { nextPayload, removedCount } = removeMissingColumnFromPayload(
        attemptPayload,
        missingColumn
      );
      if (removedCount === 0) {
        break;
      }

      attemptPayload = nextPayload;
    } catch (e) {
      lastError = e;
      break;
    }
  }

  return failure({
    code: "supabase",
    message: "Cập nhật phiếu sửa chữa thất bại sau khi loại bỏ cột thiếu",
    cause: lastError,
  });
}

/** Xóa dịch vụ gia công/đặt ngoài cho phiếu. */
export async function clearWorkOrderAdditionalServices(
  orderId: string
): Promise<RepoResult<null>> {
  try {
    const payloads = [
      { additionalservices: null },
      { additionalServices: null }
    ];
    let lastError: any = null;
    for (const payload of payloads) {
      const { error } = await supabase
        .from("work_orders")
        .update(payload)
        .eq("id", orderId);
      if (!error) return success(null);
      lastError = error;
    }
    return failure({
      code: "supabase",
      message: "Lỗi xóa dịch vụ gia công/đặt hàng ngoài",
      cause: lastError,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa dịch vụ gia công/đặt hàng ngoài",
      cause: e,
    });
  }
}
