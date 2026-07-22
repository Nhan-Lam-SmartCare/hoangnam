import { supabase } from "../../../supabaseClient";

const WORK_ORDERS_TABLE = "work_orders";

const getPartIdFromOrderItem = (item: any): string =>
  String(item?.partId ?? item?.partid ?? item?.part_id ?? "").trim();

export async function deductStockForWorkOrder(
  orderId: string,
  partsUsed: any[],
  branchId: string
): Promise<boolean> {
  try {
    const { data: orderRow } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("inventory_deducted, inventoryDeducted")
      .eq("id", orderId)
      .maybeSingle();

    const alreadyDeducted =
      Boolean(orderRow?.inventory_deducted) ||
      Boolean(orderRow?.inventoryDeducted);

    if (alreadyDeducted) {
      return true;
    }

    const nowIso = new Date().toISOString();
    let deductSuccess = true;

    for (const part of partsUsed) {
      const partId = getPartIdFromOrderItem(part);
      const qty = Math.max(0, Number(part?.quantity || 0));
      if (!partId || qty <= 0) continue;

      const { data: partRow, error: partFetchError } = await supabase
        .from("parts")
        .select("id, name, stock")
        .eq("id", partId)
        .single();

      if (partFetchError || !partRow) {
        console.warn("[deductStockForWorkOrder] Skip deduct: part not found", partId);
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
        console.warn("[deductStockForWorkOrder] Failed to update part stock", partId, partUpdateError);
        deductSuccess = false;
        continue;
      }

      await supabase.from("inventory_transactions").insert([
        {
          id: typeof crypto !== "undefined" && (crypto as any).randomUUID
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

    if (deductSuccess) {
      await supabase
        .from(WORK_ORDERS_TABLE)
        .update({ inventory_deducted: true, inventoryDeducted: true })
        .eq("id", orderId);
      return true;
    }
    return false;
  } catch (err) {
    console.error("[deductStockForWorkOrder] Error:", err);
    return false;
  }
}

export async function adjustStockForUpdatedParts(
  orderId: string,
  oldParts: any[],
  newParts: any[],
  branchId: string
): Promise<void> {
  const nowIso = new Date().toISOString();
  
  const oldMap = new Map<string, { qty: number; name: string }>();
  for (const part of oldParts) {
    const partId = getPartIdFromOrderItem(part);
    if (!partId) continue;
    const qty = Number(part?.quantity || 0);
    const name = String(part?.partName || part?.part_name || "");
    oldMap.set(partId, { qty, name });
  }

  const newMap = new Map<string, { qty: number; name: string }>();
  for (const part of newParts) {
    const partId = getPartIdFromOrderItem(part);
    if (!partId) continue;
    const qty = Number(part?.quantity || 0);
    const name = String(part?.partName || part?.part_name || "");
    newMap.set(partId, { qty, name });
  }

  const allPartIds = new Set([...oldMap.keys(), ...newMap.keys()]);

  for (const partId of allPartIds) {
    const oldVal = oldMap.get(partId) || { qty: 0, name: "" };
    const newVal = newMap.get(partId) || { qty: 0, name: "" };
    const delta = newVal.qty - oldVal.qty;

    if (delta === 0) continue;

    try {
      const { data: partRow, error: partFetchError } = await supabase
        .from("parts")
        .select("id, name, stock")
        .eq("id", partId)
        .single();

      if (partFetchError || !partRow) {
        console.warn("[adjustStockForUpdatedParts] Skip adjust: part not found", partId);
        continue;
      }

      const currentStock = (partRow as any).stock || {};
      const nextStock = {
        ...currentStock,
        [branchId]: Math.max(0, Number(currentStock?.[branchId] || 0) - delta),
      };

      await supabase
        .from("parts")
        .update({ stock: nextStock })
        .eq("id", partId);

      await supabase.from("inventory_transactions").insert([
        {
          id: typeof crypto !== "undefined" && (crypto as any).randomUUID
            ? (crypto as any).randomUUID()
            : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
          type: delta > 0 ? "Xuất kho" : "Nhập kho",
          partId,
          partName: newVal.name || oldVal.name || (partRow as any).name || "Phụ tùng",
          quantity: Math.abs(delta),
          date: nowIso,
          branchId,
          notes: delta > 0 
            ? `Xuất kho bổ sung do sửa đổi phiếu #${orderId}`
            : `Nhập hoàn kho do giảm phụ tùng ở phiếu #${orderId}`,
          workOrderId: orderId,
        },
      ]);
    } catch (err) {
      console.error("[adjustStockForUpdatedParts] Error adjusting part:", partId, err);
    }
  }
}
