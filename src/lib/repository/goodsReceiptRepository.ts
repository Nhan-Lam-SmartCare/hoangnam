import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";

const PARTS_TABLE = "parts";
const INVENTORY_TX_TABLE = "inventory_transactions";
const SUPPLIER_DEBTS_TABLE = "supplier_debts";
const CASH_TX_TABLE = "cash_transactions";

/**
 * Lấy các giao dịch kho thuộc 1 phiếu nhập (match theo notes ILIKE %receiptCode%).
 * Faithful với logic hiện tại trong InventoryManager (xóa/sửa phiếu).
 */
export async function fetchReceiptTransactions(
  receiptCode: string
): Promise<RepoResult<any[]>> {
  try {
    const { data, error } = await supabase
      .from(INVENTORY_TX_TABLE)
      .select("*")
      .ilike("notes", `%${receiptCode}%`);
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải giao dịch của phiếu nhập",
        cause: error,
      });
    return success(data || []);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải giao dịch phiếu nhập",
      cause: e,
    });
  }
}

/**
 * Hoàn (trừ) tồn kho cho từng giao dịch của phiếu nhập, trên ĐÚNG chi nhánh
 * của giao dịch. Read-modify-write từng part (giữ nguyên logic + fallback tên
 * cột partId/partid/part_id, branchId/branchid/branch_id). Tolerant: lỗi từng
 * part chỉ ghi log, không dừng cả vòng. Trả danh sách partId lỗi.
 */
export async function rollbackReceiptStock(
  transactions: any[],
  fallbackBranchId: string
): Promise<RepoResult<{ failedParts: string[] }>> {
  const failedParts: string[] = [];
  try {
    for (const tx of transactions) {
      const partId = tx.partId || tx.partid || tx.part_id;
      const quantityChange = Number(tx.quantity || tx.quantity_change || 0);
      const txBranchId =
        tx.branchId || tx.branchid || tx.branch_id || fallbackBranchId;
      if (!partId || quantityChange <= 0) continue;

      const { data: partData, error: partError } = await supabase
        .from(PARTS_TABLE)
        .select("stock")
        .eq("id", partId)
        .single();

      if (partError || !partData) {
        console.warn(`Could not find part ${partId}:`, partError);
        failedParts.push(String(partId));
        continue;
      }

      const currentStock = partData.stock || {};
      const branchStock = currentStock[txBranchId] || 0;
      const newBranchStock = Math.max(0, branchStock - quantityChange);

      const { error: updateError } = await supabase
        .from(PARTS_TABLE)
        .update({
          stock: {
            ...currentStock,
            [txBranchId]: newBranchStock,
          },
        })
        .eq("id", partId);

      if (updateError) {
        console.warn(`Could not update stock for ${partId}:`, updateError);
        failedParts.push(String(partId));
      }
    }
    return success({ failedParts });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi hoàn tồn kho phiếu nhập",
      cause: e,
    });
  }
}

/**
 * Xóa các bản ghi CSDL của 1 phiếu nhập: inventory_transactions (notes),
 * supplier_debts (description), cash_transactions (notes HOẶC description).
 * Faithful: chỉ inventory_transactions coi là critical (trả failure nếu lỗi);
 * supplier_debts + cash_transactions best-effort (ghi log, không chặn).
 */
export async function deleteReceiptRecords(
  receiptCode: string
): Promise<RepoResult<void>> {
  try {
    const { error: txErr } = await supabase
      .from(INVENTORY_TX_TABLE)
      .delete()
      .ilike("notes", `%${receiptCode}%`);
    if (txErr)
      return failure({
        code: "supabase",
        message: "Không thể xóa giao dịch phiếu nhập",
        cause: txErr,
      });

    const { error: debtErr } = await supabase
      .from(SUPPLIER_DEBTS_TABLE)
      .delete()
      .ilike("description", `%${receiptCode}%`);
    if (debtErr) console.warn("Could not delete debt:", debtErr);

    // Sổ quỹ: schema khác nhau dùng cột notes HOẶC description -> xóa theo cả hai.
    const { error: cashErr } = await supabase
      .from(CASH_TX_TABLE)
      .delete()
      .or(`notes.ilike.%${receiptCode}%,description.ilike.%${receiptCode}%`);
    if (cashErr) console.warn("Could not delete cash tx:", cashErr);

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa bản ghi phiếu nhập",
      cause: e,
    });
  }
}
