import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { RepoResult, success, failure } from "../types";
import { normalizeWorkOrder } from "./normalize";
import { updatePaymentSourceBalance } from "../paymentSourcesRepository";
import { resolveRefundTargetWorkOrder, clearWorkerCompensationForCanceledOrder } from "./internal";

const WORK_ORDERS_TABLE = "work_orders";

const getPartIdFromOrderItem = (item: any): string =>
  String(item?.partId ?? item?.partid ?? item?.part_id ?? "").trim();

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

      const inventoryWasDeducted = currentOrder.inventoryDeducted === true;

      const branchId = currentOrder.branchId || "CN1";
      const refundAmount = Math.max(0, Number(currentOrder.totalPaid || 0));
      const nowIso = new Date().toISOString();

      // 1) Restore stock for used parts only when this order was previously deducted.
      if (inventoryWasDeducted) {
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
          await updatePaymentSourceBalance(currentOrder.paymentMethod, branchId, -refundAmount);
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

    return success({
      ...normalizeWorkOrder(workOrderRow),
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
