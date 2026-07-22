// Hàm thuần tính toán tồn kho — tách khỏi InventoryManager để dễ test & tái dùng.
// Giữ NGUYÊN hành vi các memo hiện có trong InventoryManager.tsx (P1 refactor).

/** Map số theo chi nhánh, ví dụ stock = { CN1: 10, CN2: 3 }. */
export type BranchNumberMap = Record<string, number> | null | undefined;

/** Hình dạng tối thiểu của một phụ tùng cần cho các phép tính tồn kho. */
export interface StockLike {
  stock?: BranchNumberMap;
  reservedStock?: BranchNumberMap;
  costPrice?: BranchNumberMap;
  retailPrice?: BranchNumberMap;
  sku?: string | null;
}

export interface StockHealth {
  totalProducts: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

export interface StockTotals {
  totalQuantity: number;
  totalValue: number;
}

/**
 * Tồn kho KHẢ DỤNG của một phụ tùng tại một chi nhánh = tồn - đã giữ chỗ,
 * kẹp không âm. Dùng chung cho mọi nơi thay cho biểu thức lặp lại.
 */
export function getAvailable(part: StockLike, branchId: string): number {
  const branchKey = branchId || "";
  const stock = Number(part.stock?.[branchKey] || 0);
  const reserved = Number(part.reservedStock?.[branchKey] || 0);
  return Math.max(0, stock - reserved);
}

/**
 * Kiểm tra xem một phụ tùng có thuộc về hoặc có tồn kho/giá tại một chi nhánh hay không.
 */
export function isPartInBranch(part: StockLike, branchId: string): boolean {
  if (!branchId || branchId === "all") return true;

  const pBranchId = (part as any).branch_id || (part as any).branchId || "";
  if (pBranchId) {
    return pBranchId === branchId;
  }

  const stock = part.stock || {};
  const costPrice = part.costPrice || {};
  const retailPrice = part.retailPrice || {};

  const stockKeys = Object.keys(stock);
  const costKeys = Object.keys(costPrice);
  const retailKeys = Object.keys(retailPrice);

  // Nếu sản phẩm hoàn toàn chưa có key ở bất kỳ chi nhánh nào, coi như chưa phân bổ (hiện ở tất cả)
  if (stockKeys.length === 0 && costKeys.length === 0 && retailKeys.length === 0) {
    return true;
  }

  return (
    Object.prototype.hasOwnProperty.call(stock, branchId) ||
    Object.prototype.hasOwnProperty.call(costPrice, branchId) ||
    Object.prototype.hasOwnProperty.call(retailPrice, branchId)
  );
}

/**
 * Thống kê tình trạng kho theo tồn khả dụng:
 *  - inStock: available > 0
 *  - outOfStock: available === 0
 *  - lowStock: 0 < available <= threshold
 */
export function computeStockHealth(
  parts: StockLike[] | null | undefined,
  branchId: string,
  lowStockThreshold: number
): StockHealth {
  const summary: StockHealth = {
    totalProducts: 0,
    inStock: 0,
    lowStock: 0,
    outOfStock: 0,
  };
  if (!parts) return summary;

  for (const part of parts) {
    if (!isPartInBranch(part, branchId)) {
      continue;
    }
    summary.totalProducts += 1;
    const available = getAvailable(part, branchId);
    if (available > 0) {
      summary.inStock += 1;
      if (available <= lowStockThreshold) {
        summary.lowStock += 1;
      }
    } else {
      summary.outOfStock += 1;
    }
  }
  return summary;
}

/**
 * Tổng số lượng tồn khả dụng và tổng GIÁ TRỊ tồn (theo giá vốn, fallback giá bán
 * lẻ khi chưa có giá vốn — khớp logic demo dataset hiện tại).
 */
export function computeTotals(
  parts: StockLike[] | null | undefined,
  branchId: string
): StockTotals {
  const totals: StockTotals = { totalQuantity: 0, totalValue: 0 };
  if (!parts) return totals;

  const branchKey = branchId || "";
  for (const part of parts) {
    if (!isPartInBranch(part, branchId)) {
      continue;
    }
    const available = getAvailable(part, branchId);
    totals.totalQuantity += available;
    const unitValue =
      Number(part.costPrice?.[branchKey] || 0) ||
      Number(part.retailPrice?.[branchKey] || 0);
    totals.totalValue += available * unitValue;
  }
  return totals;
}

/**
 * Tập hợp các SKU bị trùng (xuất hiện > 1 lần). Bỏ qua phụ tùng không có SKU.
 */
export function detectDuplicateSkus(
  parts: StockLike[] | null | undefined
): Set<string> {
  const skuCount = new Map<string, number>();
  for (const part of parts || []) {
    const sku = part.sku;
    if (!sku) continue;
    skuCount.set(sku, (skuCount.get(sku) || 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const [sku, count] of skuCount) {
    if (count > 1) duplicates.add(sku);
  }
  return duplicates;
}
