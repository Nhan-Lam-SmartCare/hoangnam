import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { RepoResult, success, failure } from "../types";
import { normalizeStatusKey, normalizeWorkOrder, parseWarrantyMonths } from "./normalize";
import { getMissingColumnNameFromError, removeMissingColumnKeys } from "./internal";

const WORK_ORDERS_TABLE = "work_orders";

const shouldGenerateWarrantyForWorkOrder = (order: WorkOrder): boolean => {
  const statusKey = normalizeStatusKey(order.status);
  const paymentStatusKey = normalizeStatusKey(order.paymentStatus);

  const isPaid =
    paymentStatusKey === "paid" ||
    paymentStatusKey === "da thanh toan" ||
    paymentStatusKey === "thanh toan" ||
    paymentStatusKey === "completed";

  const isCompletedStatus =
    statusKey === "da sua xong" ||
    statusKey === "tra may" ||
    statusKey === "hoan tat" ||
    statusKey === "completed";

  const isCanceledStatus =
    statusKey === "da huy" ||
    statusKey === "huy" ||
    statusKey === "cancelled" ||
    statusKey === "canceled";

  const isRefunded = order.refunded === true;

  return !isCanceledStatus && !isRefunded && (isPaid || isCompletedStatus);
};

const getPartIdFromOrderItem = (item: any): string =>
  String(item?.partId ?? item?.partid ?? item?.part_id ?? "").trim();

const withWarrantyFallbackContext = (
  order: WorkOrder,
  fallback: Partial<WorkOrder>
): WorkOrder => ({
  ...order,
  partsUsed:
    Array.isArray(order.partsUsed) && order.partsUsed.length > 0
      ? order.partsUsed
      : Array.isArray(fallback.partsUsed)
        ? (fallback.partsUsed as any)
        : order.partsUsed,
  branchId: order.branchId || fallback.branchId || "CN1",
  paymentStatus: order.paymentStatus || fallback.paymentStatus,
  status: order.status || fallback.status,
  customerName: order.customerName || fallback.customerName || "",
  customerPhone: order.customerPhone || fallback.customerPhone || "",
  licensePlate: order.licensePlate || fallback.licensePlate || "",
});

export async function autoCreateWarrantyCardsForWorkOrder(order: WorkOrder): Promise<number> {
  if (!shouldGenerateWarrantyForWorkOrder(order)) return 0;

  const orderParts = Array.isArray(order.partsUsed) ? order.partsUsed : [];
  if (orderParts.length === 0) return 0;

  const partIds = Array.from(
    new Set(
      orderParts
        .map((p: any) => getPartIdFromOrderItem(p))
        .filter(Boolean)
    )
  );
  if (partIds.length === 0) return 0;

  const selectColumns = [
    "id",
    "name",
    "sku",
    "warrantyPeriod",
    "warrantyperiod",
    "warranty_period",
    "warranty",
  ];

  let partRows: any[] | null = null;
  let partsError: any = null;
  const workingColumns = [...selectColumns];

  for (let i = 0; i < 5; i += 1) {
    const res = await supabase
      .from("parts")
      .select(workingColumns.join(", "))
      .in("id", partIds);

    partRows = res.data as any[] | null;
    partsError = res.error;

    if (!partsError) break;

    const missingColumn = getMissingColumnNameFromError(partsError);
    if (!missingColumn) break;

    const idx = workingColumns.findIndex(
      (col) => col.toLowerCase() === String(missingColumn).toLowerCase()
    );
    if (idx === -1) break;

    workingColumns.splice(idx, 1);
  }

  if (partsError || !partRows || partRows.length === 0) return 0;

  const partsById = new Map<string, any>();
  for (const row of partRows) {
    partsById.set(String(row.id), row);
  }

  let existingCards: any[] = [];
  const existingRes = await supabase
    .from("warranty_cards")
    .select("id, device_model, imei_serial, notes, work_order_id")
    .eq("work_order_id", order.id);
  if (!existingRes.error && Array.isArray(existingRes.data)) {
    existingCards = existingRes.data;
  }

  const existingCountByPartId = new Map<string, number>();
  for (const card of existingCards) {
    const note = String(card?.notes || "");
    const match = note.match(/PART:([^;]+)/);
    if (!match?.[1]) continue;
    const partId = String(match[1]);
    existingCountByPartId.set(
      partId,
      (existingCountByPartId.get(partId) || 0) + 1
    );
  }

  const { data: userData } = await supabase.auth.getUser();
  const actorName =
    userData?.user?.user_metadata?.name ||
    userData?.user?.email ||
    "Hệ thống";

  const rowsToInsert: Array<Record<string, any>> = [];
  const today = new Date();

  for (const item of orderParts as any[]) {
    const partId = getPartIdFromOrderItem(item);
    if (!partId) continue;

    const partRow = partsById.get(partId);
    if (!partRow) continue;

    const months = parseWarrantyMonths(
      item?.warrantyPeriod ||
        item?.warrantyperiod ||
        item?.warranty_period ||
        item?.warranty ||
        partRow.warrantyPeriod ||
        partRow.warrantyperiod ||
        partRow.warranty_period ||
        partRow.warranty
    );
    if (months <= 0) continue;

    const qty = Math.max(1, Number(item?.quantity ?? item?.qty ?? 1));
    const existingCount = existingCountByPartId.get(partId) || 0;
    const missingCount = Math.max(0, qty - existingCount);
    if (missingCount <= 0) continue;

    const endDate = new Date(today);
    endDate.setMonth(endDate.getMonth() + months);

    for (let i = 0; i < missingCount; i += 1) {
      rowsToInsert.push({
        customer_name: order.customerName || "Khách lẻ",
        customer_phone: order.customerPhone || null,
        device_model: item.partName || item.part_name || partRow.name || "Sản phẩm",
        imei_serial:
          item.sku || item.partSku || item.part_sku || partRow.sku || order.licensePlate || null,
        warranty_start_date: today.toISOString().slice(0, 10),
        warranty_end_date: endDate.toISOString().slice(0, 10),
        warranty_period_months: months,
        warranty_type: "standard",
        covered_parts: ["Lỗi kỹ thuật do nhà sản xuất"],
        coverage_terms:
          "Không áp dụng cho rơi vỡ, ngấm nước, can thiệp bên ngoài",
        work_order_id: order.id,
        issued_by: actorName,
        branch_id: order.branchId || "CN1",
        status: "active",
        notes: `AUTO-WO:${order.id};PART:${partId}; Tự động tạo từ phiếu sửa chữa`,
      });
    }
  }

  if (rowsToInsert.length === 0) return 0;

  const workingRows = rowsToInsert.map((row) => ({ ...row }));
  let insertError: any = null;
  for (let i = 0; i < 6; i += 1) {
    const res = await supabase.from("warranty_cards").insert(workingRows);
    insertError = res.error;
    if (!insertError) break;

    const missingColumn = getMissingColumnNameFromError(insertError);
    if (!missingColumn) break;

    let removed = 0;
    for (const row of workingRows) {
      removed += removeMissingColumnKeys(row, missingColumn);
    }
    if (removed === 0) break;
  }

  if (insertError) {
    console.warn("[autoCreateWarrantyCardsForWorkOrder] insert failed", insertError);
    return 0;
  }

  return rowsToInsert.length;
}

export async function backfillWarrantyCardsForExistingWorkOrders(
  branchId?: string
): Promise<RepoResult<{ processed: number; created: number }>> {
  try {
    let query = supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("creationDate", { ascending: false })
      .limit(500);

    if (branchId) {
      query = query.eq("branchId", branchId);
    }

    const { data, error } = await query;
    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể quét phiếu sửa chữa để tạo bù bảo hành",
        cause: error,
      });
    }

    const rows = (data || []) as any[];
    let created = 0;
    for (const row of rows) {
      const normalized = normalizeWorkOrder(row);
      created += await autoCreateWarrantyCardsForWorkOrder(normalized);
    }

    return success({ processed: rows.length, created });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo bù phiếu bảo hành",
      cause: e,
    });
  }
}

export { withWarrantyFallbackContext };
