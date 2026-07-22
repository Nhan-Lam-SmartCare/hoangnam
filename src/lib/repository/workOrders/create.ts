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
import { autoCreateWarrantyCardsForWorkOrder, withWarrantyFallbackContext } from "./warranty";
import { recordWorkOrderPaymentTransactions, syncAdditionalServicesTransactions } from "./payments";
import { syncCustomerDebtForWorkOrder } from "./debt";

const WORK_ORDERS_TABLE = "work_orders";

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
    const { data: authData } = await supabase.auth.getUser();
    const authUser = authData.user;

    // Always trust the authenticated session user for creator identity.
    // This avoids RLS mismatch when UI payload carries a stale/non-auth profile id.
    const creatorId =
      authUser?.id ||
      (input as any).created_by ||
      (input as any).createdBy ||
      (input as any).createdby ||
      null;
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

    const createdAtIso = input.creationDate || new Date().toISOString();
    const customerName = input.customerName || "";
    const customerPhone = input.customerPhone || "";
    const vehicleModel = input.vehicleModel || "";
    const licensePlate = input.licensePlate || "";
    const laborCost = input.laborCost || 0;
    const partsUsed = input.partsUsed || [];
    const additionalServices = input.additionalServices || [];
    const branchCandidates = [
      (input as any).branchId,
      (input as any).branchid,
      (input as any).branch_id,
    ];
    const rawBranchId = String(
      branchCandidates.find((value) => String(value || "").trim().length > 0) ||
      ""
    ).trim();

    const isWildcardBranch = (value: string) => {
      const normalized = value.trim().toLowerCase();
      return (
        normalized === "all" ||
        normalized === "all-branches" ||
        normalized === "all_branches" ||
        normalized === "tatca" ||
        normalized === "tat-ca"
      );
    };

    let branchId = !rawBranchId || isWildcardBranch(rawBranchId) ? "" : rawBranchId;

    if (!branchId && creatorId) {
      const profileBranchRes = await supabase
        .from("profiles")
        .select("branch_id, branchId, branchid")
        .eq("id", String(creatorId))
        .maybeSingle();

      if (!profileBranchRes.error && profileBranchRes.data) {
        branchId = String(
          (profileBranchRes.data as any).branch_id ||
          (profileBranchRes.data as any).branchId ||
          (profileBranchRes.data as any).branchid ||
          ""
        ).trim();
      }
    }

    if (!branchId) {
      branchId = String(
        authUser?.user_metadata?.branch_id ||
        authUser?.user_metadata?.branchId ||
        authUser?.user_metadata?.branchid ||
        ""
      ).trim();
    }

    if (!branchId) {
      branchId = "CN1";
    }
    const paymentStatus = input.paymentStatus || "unpaid";
    const paymentMethod = input.paymentMethod || null;
    const paymentDate =
      input.paymentStatus === "paid" ? new Date().toISOString() : null;
    const notesWithAdditionalServices = encodeAdditionalServicesInNotes(
      String(input.issueDescription || ""),
      additionalServices as any[]
    );

    const newOrder = {
      id: input.id,
      "creationDate": createdAtIso,
      "customerName": customerName,
      "customerPhone": customerPhone,
      "vehicleModel": vehicleModel,
      "licensePlate": licensePlate, // Stores Serial/IMEI
      vehicleId: input.vehicleId || null,
      currentKm: input.currentKm || null,

      status: input.status || "Tiếp nhận",
      "laborCost": laborCost,
      discount: input.discount || 0,
      "partsUsed": partsUsed,
      "additionalServices": additionalServices,
      additionalservices: additionalServices,
      additional_services: additionalServices,

      notes: notesWithAdditionalServices, // Mapped to 'notes'
      total: input.total || 0,
      "branchId": branchId,
      branchid: branchId,
      branch_id: branchId,

      created_by: creatorId || undefined,
      createdBy: creatorId || undefined,
      createdby: creatorId || undefined,

      "paymentStatus": paymentStatus,
      "paymentMethod": paymentMethod,
      "totalPaid": totalPaid,
      "remainingAmount": remainingAmount,
      "paymentDate": paymentDate,
    };

    const insertPayloads: Array<Record<string, any>> = [{ ...newOrder }];

    let data: any = null;
    let error: any = null;

    for (const payload of insertPayloads) {
      const sanitizedPayload = Object.fromEntries(
        Object.entries(payload).filter(([, value]) => value !== undefined)
      ) as Record<string, any>;

      // Defensive: ensure required creationDate is never null/empty on legacy schemas.
      const ensureCreationDate = () => {
        const safeNow = new Date().toISOString();
        const currentCamel = String(sanitizedPayload["creationDate"] || "").trim();
        if (!currentCamel) sanitizedPayload["creationDate"] = safeNow;
      };
      ensureCreationDate();

      let retryCount = 0;
      while (retryCount < 12) {
        retryCount += 1;
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

        // Retry once when DB rejects null creationDate.
        const errCode = String((error as any)?.code || "").toUpperCase();
        const errMessage = String((error as any)?.message || "");
        if (
          errCode === "23502" &&
          errMessage.toLowerCase().includes("creationdate")
        ) {
          ensureCreationDate();
          continue;
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

      if (retryCount >= 12 && error) {
        console.warn("[createWorkOrderAtomic] Stop retry after max attempts", {
          code: (error as any)?.code,
          message: (error as any)?.message,
        });
      }

      if (!error) {
        break;
      }
    }

    // Final rescue path: try a strict, canonical payload to bypass legacy alias noise.
    if (error) {
      const canonicalPayload: Record<string, any> = {
        id: input.id,
        creationDate: createdAtIso,
        customerName,
        customerPhone,
        vehicleModel,
        licensePlate,
        vehicleId: input.vehicleId || null,
        currentKm: input.currentKm || null,
        status: input.status || "Tiếp nhận",
        laborCost,
        discount: input.discount || 0,
        partsUsed,
        additionalServices,
        additionalservices: additionalServices,
        additional_services: additionalServices,
        notes: notesWithAdditionalServices,
        total: input.total || 0,
        branchId,
        branchid: branchId,
        branch_id: branchId,
        created_by: creatorId || undefined,
        createdBy: creatorId || undefined,
        createdby: creatorId || undefined,
        paymentStatus,
        paymentMethod,
        totalPaid,
        remainingAmount,
        paymentDate,
      };

      const rescuePayload = Object.fromEntries(
        Object.entries(canonicalPayload).filter(([, value]) => value !== undefined)
      ) as Record<string, any>;

      for (let i = 0; i < 10; i += 1) {
        const rescueRes = await supabase
          .from(WORK_ORDERS_TABLE)
          .insert(rescuePayload)
          .select()
          .single();

        if (!rescueRes.error) {
          data = rescueRes.data;
          error = null;
          break;
        }

        error = rescueRes.error;
        const missingColumn = getMissingColumnNameFromError(error);
        if (!missingColumn) break;
        const removedCount = removeMissingColumnKeys(rescuePayload, missingColumn);
        if (removedCount === 0) break;
      }
    }

    if (error) {
      console.error("[createWorkOrderAtomic] Insert Error:", error);
      const rawMessage =
        String((error as any)?.message || (error as any)?.details || "").trim() ||
        "Lỗi Database";
      return failure({
        code: "supabase",
        message: `Không thể tạo phiếu sửa chữa (${rawMessage})`,
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
      withWarrantyFallbackContext(normalizedOrder, {
        partsUsed,
        branchId,
        status: input.status,
        paymentStatus,
        customerName,
        customerPhone,
        licensePlate,
      })
    );

    // Sync all related data in repository fallback
    const completionStatusKey = normalizeStatusKey(normalizedOrder.status);
    const isCompletionStatus = [
      "tra may",
      "da sua xong",
      "hoan tat",
      "completed",
    ].includes(completionStatusKey);
    const isPaidStatus = normalizedOrder.paymentStatus === "paid";

    const finalInventoryDeducted = false;

    const createdTxs = await recordWorkOrderPaymentTransactions({
      orderId: normalizedOrder.id,
      customerName: normalizedOrder.customerName || "",
      branchId: branchId,
      paymentMethod: normalizedOrder.paymentMethod || "cash",
      depositAmount: depositAmount,
      servicePayment: additionalPayment,
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

    await syncAdditionalServicesTransactions(normalizedOrder.id, additionalServices, branchId);

    const finalOrderToReturn = {
      ...normalizedOrder,
      depositTransactionId: depositTransactionId || normalizedOrder.depositTransactionId,
      cashTransactionId: paymentTransactionId || normalizedOrder.cashTransactionId,
      inventoryDeducted: finalInventoryDeducted,
    };

    await syncCustomerDebtForWorkOrder(finalOrderToReturn);

    const totalPaidThisSession = depositAmount + additionalPayment;
    if (totalPaidThisSession > 0) {
      await updateCustomerMetricsOnPayment(finalOrderToReturn, totalPaidThisSession, true);
    }

    return success(finalOrderToReturn);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo phiếu sửa chữa (atomic)",
      cause: e,
    });
  }
}

/** Thêm phiếu sửa chữa mới, tự động phát hiện và loại bỏ cột thiếu ở database hiện tại. */
export async function insertWorkOrderLegacy(
  payload: Record<string, any>
): Promise<RepoResult<{ data: any; payload: Record<string, any> }>> {
  let attemptPayload = { ...payload };
  let lastError: any = null;

  for (let i = 0; i < 20; i++) {
    try {
      const { data, error } = await supabase
        .from("work_orders")
        .insert(attemptPayload)
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
    message: "Ghi phiếu sửa chữa thất bại sau khi loại bỏ cột thiếu",
    cause: lastError,
  });
}
