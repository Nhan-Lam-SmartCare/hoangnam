/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
  formatAnyId,
} from "../../src/utils/format";

describe("formatCurrency", () => {
  it("should format positive numbers as VND currency", () => {
    const result = formatCurrency(1500000);

    // Should contain the number and VND symbol (₫)
    expect(result).toMatch(/1[.,]500[.,]000/);
    expect(result).toContain("₫");
  });

  it("should format zero", () => {
    const result = formatCurrency(0);

    expect(result).toContain("0");
    expect(result).toContain("₫");
  });

  it("should format negative numbers", () => {
    const result = formatCurrency(-500000);

    expect(result).toMatch(/-?500[.,]000/);
  });

  it("should handle decimal values", () => {
    // VND typically doesn't have decimals, but formatCurrency should handle them
    const result = formatCurrency(1234.56);

    // Result should round or truncate
    expect(result).toBeDefined();
  });

  it("should handle large numbers", () => {
    const result = formatCurrency(1_000_000_000); // 1 billion

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(5);
  });
});

describe("formatDate", () => {
  it("should format ISO date string in short format (DD/MM/YYYY)", () => {
    const result = formatDate("2024-01-15T10:30:00.000Z");

    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4}/);
  });

  it("should format ISO date string in long format (DD/MM/YYYY HH:mm)", () => {
    const result = formatDate("2024-01-15T10:30:00.000Z", false);

    expect(result).toMatch(/\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}/);
  });

  it("should format Date object", () => {
    const date = new Date(2024, 0, 15, 10, 30);
    const result = formatDate(date);

    expect(result).toBe("15/01/2024");
  });

  it('should return "--" for null', () => {
    const result = formatDate(null);

    expect(result).toBe("--");
  });

  it('should return "--" for undefined', () => {
    const result = formatDate(undefined);

    expect(result).toBe("--");
  });

  it('should return "--" for invalid date string', () => {
    const result = formatDate("invalid-date");

    expect(result).toBe("--");
  });

  it("should format date correctly for Vietnamese timezone context", () => {
    // Test with a specific date
    const result = formatDate("2024-12-25T00:00:00.000Z");

    // Should be formatted as DD/MM/YYYY
    expect(result).toMatch(/\d{2}\/12\/2024/);
  });
});

describe("formatWorkOrderId", () => {
  it("should format timestamp-based work order ID", () => {
    // Create a timestamp for testing
    const timestamp = new Date(2024, 0, 15, 10, 30, 45).getTime();
    const workOrderId = `WO-${timestamp}`;

    const result = formatWorkOrderId(workOrderId, "SC");

    // Should contain store prefix and date
    expect(result).toContain("SC-");
    expect(result).toContain("2024");
  });

  it("should use default prefix when not provided", () => {
    const timestamp = Date.now();
    const workOrderId = `WO-${timestamp}`;

    const result = formatWorkOrderId(workOrderId);

    expect(result).toContain("SC-");
  });

  it("should return empty string for null/undefined", () => {
    expect(formatWorkOrderId(null)).toBe("");
    expect(formatWorkOrderId(undefined)).toBe("");
  });

  it("should return original ID if no timestamp pattern found", () => {
    const result = formatWorkOrderId("CUSTOM-ID-123");

    expect(result).toBe("CUSTOM-ID-123");
  });

  it("should handle ID already with prefix and timestamp", () => {
    const timestamp = new Date(2024, 5, 20).getTime();
    const workOrderId = `SC-${timestamp}`;

    const result = formatWorkOrderId(workOrderId, "SC");

    expect(result).toContain("SC-");
    expect(result).toContain("2024");
  });
});

describe("formatAnyId", () => {
  it("should preserve original prefix and format timestamp", () => {
    const timestamp = new Date(2024, 0, 15).getTime();
    const saleId = `SALE-${timestamp}`;

    const result = formatAnyId(saleId);

    expect(result).toContain("SALE-");
    expect(result).toContain("2024");
  });

  it("should handle INV prefix", () => {
    const timestamp = new Date(2024, 2, 10).getTime();
    const invId = `INV-${timestamp}`;

    const result = formatAnyId(invId);

    expect(result).toContain("INV-");
  });

  it("should return empty string for null/undefined", () => {
    expect(formatAnyId(null)).toBe("");
    expect(formatAnyId(undefined)).toBe("");
  });

  it("should return original ID if no timestamp pattern", () => {
    const result = formatAnyId("SIMPLE-ID");

    expect(result).toBe("SIMPLE-ID");
  });

  it("should apply store prefix for bare timestamp", () => {
    const timestamp = new Date(2024, 6, 25).getTime();

    const result = formatAnyId(String(timestamp), "MTR");

    expect(result).toContain("MTR-");
    expect(result).toContain("2024");
  });

  it("should handle various prefix formats", () => {
    const timestamp = Date.now();

    const testCases = [
      `ORDER-${timestamp}`,
      `WO-${timestamp}`,
      `TX_${timestamp}`,
    ];

    testCases.forEach((id) => {
      const result = formatAnyId(id);
      expect(result).toBeDefined();
      expect(result.length).toBeGreaterThan(0);
    });
  });
});
