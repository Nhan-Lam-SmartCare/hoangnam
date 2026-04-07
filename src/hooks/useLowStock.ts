import { useMemo } from "react";
import type { Part } from "../types";

export interface LowStockSummary {
  lowStock: Part[];
  outOfStock: Part[];
  lowStockCount: number;
  outOfStockCount: number;
}

export function useLowStock(
  parts: Part[] | undefined,
  branchId: string | undefined,
  threshold = 5
): LowStockSummary {
  return useMemo(() => {
    const list = Array.isArray(parts) ? parts : [];
    const bid = branchId || "";
    const outOfStock = list.filter((p) => (p.stock?.[bid] ?? 0) <= 0);
    const lowStock = list.filter((p) => {
      const qty = p.stock?.[bid] ?? 0;
      return qty > 0 && qty <= threshold;
    });
    return {
      lowStock,
      outOfStock,
      lowStockCount: lowStock.length,
      outOfStockCount: outOfStock.length,
    };
  }, [parts, branchId, threshold]);
}
