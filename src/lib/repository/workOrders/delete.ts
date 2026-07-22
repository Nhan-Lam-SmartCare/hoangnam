import { supabase } from "../../../supabaseClient";
import { RepoResult, success, failure } from "../types";
import { normalizeWorkOrder } from "./normalize";
import { updatePaymentSourceBalance } from "../paymentSourcesRepository";

const WORK_ORDERS_TABLE = "work_orders";

const getPartIdFromOrderItem = (item: any): string =>
  String(item?.partId ?? item?.partid ?? item?.part_id ?? "").trim();

export async function deleteWorkOrder(id: string): Promise<RepoResult<void>> {
  try {
    const { data: orderRow, error: fetchError } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (fetchError || !orderRow) {
      return failure({
        code: "supabase",
        message: "Không tìm thấy phiếu sửa chữa để xóa",
        cause: fetchError,
      });
    }

    const order = normalizeWorkOrder(orderRow);

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

    // 1) Rollback stock if inventory was deducted
    const inventoryWasDeducted =
      Boolean(orderRow.inventory_deducted) ||
      Boolean(orderRow.inventoryDeducted);

    const branchId = order.branchId || "CN1";
    const nowIso = new Date().toISOString();

    if (inventoryWasDeducted) {
      const partsUsed = (order.partsUsed || []) as any[];
      for (const part of partsUsed) {
        const partId = getPartIdFromOrderItem(part);
        const qty = Math.max(0, Number(part?.quantity || 0));
        if (!partId || qty <= 0) continue;

        try {
          const { data: partRow, error: partFetchError } = await supabase
            .from("parts")
            .select("id,name,stock")
            .eq("id", partId)
            .single();

          if (!partFetchError && partRow) {
            const currentStock = (partRow as any).stock || {};
            const nextStock = {
              ...currentStock,
              [branchId]: Number(currentStock?.[branchId] || 0) + qty,
            };

            await supabase
              .from("parts")
              .update({ stock: nextStock })
              .eq("id", partId);

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
                notes: `Hoàn kho do xóa phiếu sửa chữa #${id}`,
                workOrderId: id,
              },
            ]);
          }
        } catch (err) {
          console.warn("[deleteWorkOrder:stock_rollback] Error restoring part stock:", partId, err);
        }
      }
    }

    // 2) Delete linked cash transactions & adjust balance
    try {
      const { data: dbLinkedTx } = await supabase
        .from("cash_transactions")
        .select("*")
        .or(`workorderid.eq.${id},workOrderId.eq.${id},reference.eq.${id}`);
      
      const actualLinkedTx = dbLinkedTx || [];
      for (const tx of actualLinkedTx) {
        const srcId = tx.paymentsource || tx.paymentSource || tx.paymentSourceId || order.paymentMethod || "cash";
        const txBranchId = tx.branchid || tx.branchId || branchId;
        const amt = Number(tx.amount || 0);
        const txType = tx.type || "";

        await supabase.from("cash_transactions").delete().eq("id", tx.id);

        if (amt > 0 && srcId) {
          const delta = txType === "income" ? -amt : amt;
          await updatePaymentSourceBalance(srcId, txBranchId, delta);
        }
      }
    } catch (err) {
      console.warn("[deleteWorkOrder:cash_cleanup] Error cleaning up linked cash transactions:", err);
    }

    // 3) Delete linked customer debts
    try {
      await supabase
        .from("customer_debts")
        .delete()
        .or(`workorderid.eq.${id},workOrderId.eq.${id}`);
    } catch (err) {
      console.warn("[deleteWorkOrder:debts_cleanup] Error cleaning up linked customer debts:", err);
    }

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa phiếu sửa chữa",
      cause: e,
    });
  }
}
