import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";
import { createReceiptAtomic } from "./inventoryTransactionsRepository";

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

/**
 * Xóa phiếu nhập kho bằng RPC atomic, tự động fallback nếu RPC chưa deploy.
 */
export async function deleteReceiptAtomic(
  receiptCode: string,
  branchId: string
): Promise<RepoResult<any>> {
  try {
    const isMissingReceiptRpc = (err: any) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      return (
        code === "PGRST202" &&
        (message.includes("receipt_delete_atomic") ||
          details.includes("receipt_delete_atomic"))
      );
    };

    const runFallbackDelete = async () => {
      // 1. Lấy danh sách giao dịch
      const origTxRes = await fetchReceiptTransactions(receiptCode);
      if (!origTxRes.ok) return failure(origTxRes.error);
      const originalTxs = origTxRes.data || [];

      if (originalTxs.length > 0) {
        // 2. Hoàn trả tồn kho
        const rollbackRes = await rollbackReceiptStock(originalTxs, branchId);
        if (!rollbackRes.ok) return failure(rollbackRes.error);
      }

      // 3. Xóa các bản ghi liên quan
      const delRes = await deleteReceiptRecords(receiptCode);
      if (!delRes.ok) return failure(delRes.error);

      return success({
        success: true,
        message: "Đã xóa phiếu bằng fallback (không dùng RPC)",
        mode: "fallback",
      });
    };

    const { data, error } = await supabase.rpc("receipt_delete_atomic", {
      p_receipt_code: receiptCode,
      p_branch_id: branchId,
    });

    if (error) {
      if (isMissingReceiptRpc(error)) {
        return await runFallbackDelete();
      }
      return failure({
        code: "supabase",
        message: error.message,
        cause: error,
      });
    }

    if (data && !data.success) {
      return failure({
        code: "validation",
        message: data.message,
      });
    }

    return success(data);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa phiếu nhập",
      cause: e,
    });
  }
}

/**
 * Cập nhật phiếu nhập kho bằng RPC atomic (hủy phiếu cũ + tạo phiếu mới trong 1 transaction),
 * tự động fallback nếu RPC chưa deploy.
 */
export async function editReceiptAtomic(
  oldReceiptCode: string,
  newItems: any[],
  supplierId: string,
  branchId: string,
  userId: string,
  newNotes: string
): Promise<RepoResult<any>> {
  try {
    const isMissingReceiptRpc = (err: any) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      return (
        code === "PGRST202" &&
        (message.includes("receipt_edit_atomic") ||
          details.includes("receipt_edit_atomic"))
      );
    };

    const runFallbackEdit = async () => {
      // 1. Hủy và hoàn kho phiếu cũ
      const delRes = await deleteReceiptAtomic(oldReceiptCode, branchId);
      if (!delRes.ok) return failure(delRes.error);

      // 2. Tạo mới các giao dịch và cộng kho phiếu mới
      const createRes = await createReceiptAtomic(
        newItems,
        supplierId,
        branchId,
        userId,
        newNotes
      );
      if (!createRes.ok) return failure(createRes.error);

      return success({
        success: true,
        message: "Đã sửa phiếu bằng fallback (không dùng RPC edit)",
        mode: "fallback",
      });
    };

    const { data, error } = await supabase.rpc("receipt_edit_atomic", {
      p_old_receipt_code: oldReceiptCode,
      p_new_items: newItems,
      p_supplier_id: supplierId,
      p_branch_id: branchId,
      p_user_id: userId,
      p_new_notes: newNotes,
    });

    if (error) {
      if (isMissingReceiptRpc(error)) {
        return await runFallbackEdit();
      }
      return failure({
        code: "supabase",
        message: error.message,
        cause: error,
      });
    }

    if (data && !data.success) {
      return failure({
        code: "validation",
        message: data.message,
      });
    }

    return success(data);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phiếu nhập",
      cause: e,
    });
  }
}
