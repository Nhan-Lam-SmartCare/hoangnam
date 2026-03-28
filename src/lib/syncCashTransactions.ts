// Đồng bộ giao dịch giữa Motocare và Pin Factory
// Sử dụng để đẩy giao dịch từ một hệ thống sang hệ thống kia

import { supabase } from "../supabaseClient";
import { pinSupabase, PinCashTransaction } from "./pinSupabase";
import type { CashTransaction } from "../types";
import { canonicalizeMotocareCashTxCategory } from "./finance/cashTxCategories";

// ========================================
// ĐỒNG BỘ TỪ MOTOCARE → PIN FACTORY
// ========================================

export async function syncMotocareToPin(
  transaction: CashTransaction
): Promise<{ success: boolean; error?: any }> {
  try {
    // Chuyển đổi format từ Motocare sang Pin Factory
    // ⚠️ Chỉ dùng các cột cơ bản: id, type, amount, date
    const pinTx: any = {
      id: `MOTO-${transaction.id}`, // Prefix để tránh trùng ID
      type: transaction.type === "income" ? "income" : "expense",
      amount: Math.abs(transaction.amount),
      date: transaction.date,
    };

    // Insert vào Pin Factory database
    const { data, error } = await pinSupabase
      .from("cashtransactions")
      .upsert(pinTx, { onConflict: "id" }); // Upsert để tránh duplicate

    if (error) {
      console.error("[Sync Motocare→Pin] Error:", error);
      return { success: false, error };
    }

    console.log("[Sync Motocare→Pin] ✅ Synced:", pinTx.id);
    return { success: true };
  } catch (err) {
    console.error("[Sync Motocare→Pin] Exception:", err);
    return { success: false, error: err };
  }
}

// ========================================
// ĐỒNG BỘ TỪ PIN FACTORY → MOTOCARE
// ========================================

export async function syncPinToMotocare(
  transaction: PinCashTransaction,
  branchId: string = "CN1"
): Promise<{ success: boolean; error?: any }> {
  try {
    const rawCategory = transaction.category || "other_income";
    const canonicalCategory =
      canonicalizeMotocareCashTxCategory(rawCategory) || rawCategory;

    // Chuyển đổi format từ Pin Factory sang Motocare
    const motocareTx = {
      id: `PIN-${transaction.id}`, // Prefix để tránh trùng ID
      type: transaction.type,
      category: canonicalCategory,
      amount: Math.abs(transaction.amount),
      date: transaction.date,
      description: transaction.description || "Đồng bộ từ Pin Factory",
      branchid: branchId,
      paymentsource: "cash", // Default cash vì Pin không có payment_method
      notes: `[Đồng bộ từ Pin Factory]`,
    };

    // Insert vào Motocare database
    const { data, error } = await supabase
      .from("cash_transactions")
      .upsert(motocareTx, { onConflict: "id" }); // Upsert để tránh duplicate

    if (error) {
      console.error("[Sync Pin→Motocare] Error:", error);
      return { success: false, error };
    }

    console.log("[Sync Pin→Motocare] ✅ Synced:", motocareTx.id);
    return { success: true };
  } catch (err) {
    console.error("[Sync Pin→Motocare] Exception:", err);
    return { success: false, error: err };
  }
}

// ========================================
// ĐỒNG BỘ HÀNG LOẠT
// ========================================

export async function syncAllMotocareToPin(
  transactions: CashTransaction[]
): Promise<{ success: number; failed: number; errors: any[] }> {
  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const tx of transactions) {
    const result = await syncMotocareToPin(tx);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push({ id: tx.id, error: result.error });
    }
  }

  return { success, failed, errors };
}

export async function syncAllPinToMotocare(
  transactions: PinCashTransaction[],
  branchId: string = "CN1"
): Promise<{ success: number; failed: number; errors: any[] }> {
  let success = 0;
  let failed = 0;
  const errors: any[] = [];

  for (const tx of transactions) {
    const result = await syncPinToMotocare(tx, branchId);
    if (result.success) {
      success++;
    } else {
      failed++;
      errors.push({ id: tx.id, error: result.error });
    }
  }

  return { success, failed, errors };
}

// ========================================
// ĐỒNG BỘ 2 CHIỀU (THÔNG MINH)
// ========================================

export async function syncBidirectional(
  branchId: string = "CN1"
): Promise<{
  motoToPin: { success: number; failed: number };
  pinToMoto: { success: number; failed: number };
}> {
  console.log("[Sync Bidirectional] Bắt đầu đồng bộ 2 chiều...");

  // 1. Lấy tất cả giao dịch từ cả 2 hệ thống
  const [motocareRes, pinRes] = await Promise.all([
    supabase.from("cash_transactions").select("*").eq("branchid", branchId),
    pinSupabase.from("cashtransactions").select("*"),
  ]);

  const motocareTxs = motocareRes.data || [];
  const pinTxs = pinRes.data || [];

  // 2. Tìm các giao dịch chưa được đồng bộ
  const existingPinIds = new Set(pinTxs.map((tx) => tx.id));
  const existingMotoIds = new Set(motocareTxs.map((tx: any) => tx.id));

  // Giao dịch Motocare chưa có ở Pin (không bắt đầu bằng "PIN-")
  const motoToSync = motocareTxs.filter(
    (tx: any) => 
      !tx.id.startsWith("PIN-") && 
      !existingPinIds.has(`MOTO-${tx.id}`)
  );

  // Giao dịch Pin chưa có ở Motocare (không bắt đầu bằng "MOTO-")
  const pinToSync = pinTxs.filter(
    (tx) => 
      !tx.id.startsWith("MOTO-") && 
      !existingMotoIds.has(`PIN-${tx.id}`)
  );

  console.log(`[Sync] Cần đồng bộ: ${motoToSync.length} Motocare→Pin, ${pinToSync.length} Pin→Motocare`);

  // 3. Thực hiện đồng bộ
  const [motoResult, pinResult] = await Promise.all([
    syncAllMotocareToPin(motoToSync as CashTransaction[]),
    syncAllPinToMotocare(pinToSync, branchId),
  ]);

  console.log(`[Sync] Kết quả:`, {
    motoToPin: `${motoResult.success}/${motoToSync.length}`,
    pinToMoto: `${pinResult.success}/${pinToSync.length}`,
  });

  return {
    motoToPin: { success: motoResult.success, failed: motoResult.failed },
    pinToMoto: { success: pinResult.success, failed: pinResult.failed },
  };
}
