import { describe, it, expect } from "vitest";
import {
  getAvailable,
  computeStockHealth,
  computeTotals,
  detectDuplicateSkus,
  type StockLike,
} from "../../src/utils/inventoryCalc";

const B = "CN1";

describe("getAvailable", () => {
  it("trừ phần đã giữ chỗ khỏi tồn kho", () => {
    const part: StockLike = { stock: { CN1: 10 }, reservedStock: { CN1: 3 } };
    expect(getAvailable(part, B)).toBe(7);
  });

  it("kẹp không âm khi giữ chỗ vượt tồn", () => {
    const part: StockLike = { stock: { CN1: 2 }, reservedStock: { CN1: 5 } };
    expect(getAvailable(part, B)).toBe(0);
  });

  it("trả 0 khi thiếu dữ liệu chi nhánh", () => {
    expect(getAvailable({}, B)).toBe(0);
    expect(getAvailable({ stock: { CN2: 9 } }, B)).toBe(0);
  });
});

describe("computeStockHealth", () => {
  const parts: StockLike[] = [
    { stock: { CN1: 100 } }, // in-stock, không low
    { stock: { CN1: 4 } }, // in-stock + low (<=5)
    { stock: { CN1: 5 }, reservedStock: { CN1: 5 } }, // available 0 -> out-of-stock
    { stock: { CN1: 0 } }, // out-of-stock
  ];

  it("đếm đúng inStock/lowStock/outOfStock/total", () => {
    const h = computeStockHealth(parts, B, 5);
    expect(h.totalProducts).toBe(4);
    expect(h.inStock).toBe(2);
    expect(h.lowStock).toBe(1);
    expect(h.outOfStock).toBe(2);
  });

  it("an toàn với null", () => {
    expect(computeStockHealth(null, B, 5)).toEqual({
      totalProducts: 0,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0,
    });
  });
});

describe("computeTotals", () => {
  it("cộng tồn khả dụng và giá trị theo giá vốn", () => {
    const parts: StockLike[] = [
      { stock: { CN1: 10 }, costPrice: { CN1: 1000 } },
      { stock: { CN1: 5 }, reservedStock: { CN1: 2 }, costPrice: { CN1: 2000 } },
    ];
    const t = computeTotals(parts, B);
    expect(t.totalQuantity).toBe(13); // 10 + 3
    expect(t.totalValue).toBe(10 * 1000 + 3 * 2000);
  });

  it("fallback sang giá bán lẻ khi chưa có giá vốn", () => {
    const parts: StockLike[] = [
      { stock: { CN1: 4 }, retailPrice: { CN1: 1500 } },
    ];
    const t = computeTotals(parts, B);
    expect(t.totalValue).toBe(4 * 1500);
  });
});

describe("detectDuplicateSkus", () => {
  it("chỉ trả về SKU xuất hiện > 1 lần", () => {
    const parts: StockLike[] = [
      { sku: "A" },
      { sku: "A" },
      { sku: "B" },
      { sku: "" },
      { sku: null },
    ];
    const dup = detectDuplicateSkus(parts);
    expect(dup.has("A")).toBe(true);
    expect(dup.has("B")).toBe(false);
    expect(dup.size).toBe(1);
  });
});
