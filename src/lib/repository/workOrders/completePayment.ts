import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { RepoResult, success, failure } from "../types";
import { normalizeWorkOrder, normalizeStatusKey } from "./normalize";
import { updateCustomerMetricsOnPayment } from "./internal";
import { autoCreateWarrantyCardsForWorkOrder } from "./warranty";
import { ensureManualPartExpenseOnPayment } from "./payments";

const WORK_ORDERS_TABLE = "work_orders";

const getPartIdFromOrderItem = (item: any): string =>
  String(item?.partId ?? item?.partid ?? item?.part_id ?? "").trim();

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
      usedFallback?: boolean;
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

      const branchId = currentOrder.branchId || "CN1";
      const nowIso = new Date().toISOString();
      const inventoryWasDeducted = currentOrder.inventoryDeducted === true;

      // #3: Trừ kho khi đã trả đủ HOẶC phiếu đã hoàn tất/trả máy (phụ tùng đã dùng),
      // không đợi thu đủ tiền. Cờ inventory_deducted chống trừ 2 lần.
      const completionStatusKey = normalizeStatusKey(currentOrder.status);
      const isCompletionStatus = [
        "tra may",
        "da sua xong",
        "hoan tat",
        "completed",
      ].includes(completionStatusKey);

      let deductSuccess = true;
      if ((nextStatus === "paid" || isCompletionStatus) && !inventoryWasDeducted) {
        const partsUsed = (currentOrder.partsUsed || []) as any[];
        for (const part of partsUsed) {
          const partId = getPartIdFromOrderItem(part);
          const qty = Math.max(0, Number(part?.quantity || 0));
          if (!partId || qty <= 0) continue;

          const { data: partRow, error: partFetchError } = await supabase
            .from("parts")
            .select("id,name,stock")
            .eq("id", partId)
            .single();

          if (partFetchError || !partRow) {
            console.warn("[completeWorkOrderPayment:fallback] Skip deduct stock: part not found", {
              partId,
              partFetchError,
            });
            continue;
          }

          const currentStock = (partRow as any).stock || {};
          const nextStock = {
            ...currentStock,
            [branchId]: Math.max(0, Number(currentStock?.[branchId] || 0) - qty),
          };

          const { error: partUpdateError } = await supabase
            .from("parts")
            .update({ stock: nextStock })
            .eq("id", partId);

          if (partUpdateError) {
            console.warn("[completeWorkOrderPayment:fallback] Failed deducting part stock", {
              partId,
              partUpdateError,
            });
            deductSuccess = false;
            continue;
          }

          // Best-effort inventory history line
          await supabase.from("inventory_transactions").insert([
            {
              id:
                typeof crypto !== "undefined" && (crypto as any).randomUUID
                  ? (crypto as any).randomUUID()
                  : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
              type: "Xuất kho",
              partId,
              partName: String(part?.partName || (partRow as any).name || "Phụ tùng"),
              quantity: qty,
              date: nowIso,
              branchId,
              notes: `Xuất kho sửa chữa - Phiếu #${orderId}`,
              workOrderId: orderId,
            },
          ]);
        }

        updates.inventory_deducted = deductSuccess;
        updates.inventoryDeducted = deductSuccess;
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

      // ⚠️ NỢ KỸ THUẬT / P0: fallback update trực tiếp KHÔNG atomic (trừ kho
      // và cập nhật thanh toán tách rời, có thể lệch nếu lỗi giữa chừng).
      // Chỉ chạy khi RPC work_order_complete_payment CHƯA deploy. Sau khi xác
      // nhận RPC đã có trên production, HÃY GỠ nhánh fallback này. Cờ
      // usedFallback:true bên dưới để UI cảnh báo người dùng khi rơi vào đây.
      console.warn(
        "[completeWorkOrderPayment] RPC work_order_complete_payment chưa tồn tại, đã dùng fallback update trực tiếp có trừ kho"
      );

      const normalizedUpdatedOrder = normalizeWorkOrder(updatedRow);
      if (nextStatus === "paid") {
        await ensureManualPartExpenseOnPayment(normalizedUpdatedOrder, paymentMethod);
      }
      await updateCustomerMetricsOnPayment(normalizedUpdatedOrder, paymentAmount, currentPaid === 0);
      await autoCreateWarrantyCardsForWorkOrder(normalizedUpdatedOrder);

      return success({
        ...normalizedUpdatedOrder,
        paymentTransactionId: undefined,
        newPaymentStatus: nextStatus,
        inventoryDeducted: updates.inventoryDeducted || false,
        usedFallback: true,
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

    const normalizedOrder = normalizeWorkOrder(workOrderRow);
    const paidNow =
      String(newPaymentStatus || normalizedOrder.paymentStatus || "").toLowerCase() ===
      "paid";
    if (paidNow) {
      await ensureManualPartExpenseOnPayment(normalizedOrder, paymentMethod);
    }
    
    // Check if this was the first payment to increment visitCount
    const currentPaidBeforeThis = Number(normalizedOrder.totalPaid || 0) - paymentAmount;
    await updateCustomerMetricsOnPayment(normalizedOrder, paymentAmount, currentPaidBeforeThis <= 0);
    
    await autoCreateWarrantyCardsForWorkOrder(normalizedOrder);

    return success({
      ...normalizedOrder,
      paymentTransactionId,
      newPaymentStatus,
      inventoryDeducted,
      usedFallback: false,
    });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thanh toán",
      cause: e,
    });
  }
}
