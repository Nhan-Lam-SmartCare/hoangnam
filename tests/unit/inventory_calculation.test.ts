import { describe, it, expect } from "vitest";
import { calculateNewStockAfterSale } from "../../src/utils/businessLogic";

describe("Inventory Calculation Tools", () => {
  it("should deduct properly and not warn if stock > 3", () => {
    const res = calculateNewStockAfterSale(10, 2);
    expect(res.nextStock).toBe(8);
    expect(res.hasWarning).toBe(false);
  });

  it("should warn if new stock drops to 3 or below", () => {
    const res = calculateNewStockAfterSale(5, 2);
    expect(res.nextStock).toBe(3);
    expect(res.hasWarning).toBe(true);
  });

  it("should handle overselling (negative stock)", () => {
    const res = calculateNewStockAfterSale(0, 5);
    expect(res.nextStock).toBe(-5);
    expect(res.hasWarning).toBe(true);
  });
});
