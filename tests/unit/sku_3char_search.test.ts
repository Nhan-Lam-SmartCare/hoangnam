import { describe, it, expect } from "vitest";
import { generateSKU, isValidSKU } from "../../src/utils/sku";

describe("3-Character SKU Generation & Search Matching", () => {
  it("generates 3-character SKU in 1 letter + 2 digits format (e.g. A01)", () => {
    for (let i = 0; i < 20; i++) {
      const sku = generateSKU();
      expect(sku).toMatch(/^[A-Z][0-9]{2}$/);
      expect(sku.length).toBe(3);
    }
  });

  it("validates 3-character SKUs and legacy formats correctly", () => {
    expect(isValidSKU("A01")).toBe(true);
    expect(isValidSKU("B25")).toBe(true);
    expect(isValidSKU("Z99")).toBe(true);
    expect(isValidSKU("PT-A3K9M2")).toBe(true);
    expect(isValidSKU("100123")).toBe(true);
    expect(isValidSKU("")).toBe(false);
  });

  it("matches lowercase or case-insensitive search terms to 3-character SKUs", () => {
    const parts = [
      { id: "1", name: "Bugi C7", sku: "A01", barcode: "A01" },
      { id: "2", name: "Lốp xe", sku: "B25", barcode: "B25" },
    ];

    const keyword = "a01";
    const cleanKeyword = keyword.replace(/[^a-z0-9]/g, "");

    const match = parts.find((p) => {
      const sku = (p.sku || "").toLowerCase();
      const barcode = (p.barcode || "").toLowerCase();
      const cleanSku = sku.replace(/[^a-z0-9]/g, "");
      const cleanBarcode = barcode.replace(/[^a-z0-9]/g, "");

      return (
        sku === keyword ||
        barcode === keyword ||
        (cleanKeyword.length >= 2 && (cleanSku === cleanKeyword || cleanBarcode === cleanKeyword)) ||
        (cleanKeyword.length >= 2 && cleanSku.endsWith(cleanKeyword))
      );
    });

    expect(match).toBeDefined();
    expect(match?.name).toBe("Bugi C7");
  });
});
