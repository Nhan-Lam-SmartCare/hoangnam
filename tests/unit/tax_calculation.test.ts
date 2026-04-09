import { describe, it, expect } from "vitest";
import { calculateTaxHKD, splitWorkOrderRevenue } from "../../src/utils/businessLogic";

describe("Tax Calculation HKD (Hộ Kinh Doanh)", () => {
  it("computes correct tax rates and values", () => {
    // 10,000,000 phụ tùng, 5,000,000 công thợ
    const partsTotal = 10_000_000;
    const serviceTotal = 5_000_000;

    const result = calculateTaxHKD(partsTotal, serviceTotal);

    expect(result.partsTaxRate).toBe(0.015); // 1.5%
    expect(result.serviceTaxRate).toBe(0.045); // 4.5%
    
    expect(result.partsTaxValue).toBe(150_000); // 10tr * 1.5%
    expect(result.serviceTaxValue).toBe(225_000); // 5tr * 4.5%
    
    expect(result.totalTax).toBe(375_000);
  });

  it("handles zero revenue", () => {
    const result = calculateTaxHKD(0, 0);
    expect(result.totalTax).toBe(0);
  });
});

describe("Split Work Order Revenue", () => {
  it("splits revenue between parts and service correctly without discount", () => {
    const order = {
      total: 1500000,
      partsUsed: [
        { retailPrice: 500000, quantity: 2 } // 1,000,000 total wrapper
      ]
    };

    const splitted = splitWorkOrderRevenue(order);
    expect(splitted.partsRevenue).toBe(1000000);
    expect(splitted.serviceRevenue).toBe(500000); // 1.5tr - 1tr
  });

  it("handles cases where discount eats into parts margin", () => {
    const order = {
      total: 800000, // Reduced from 1,000,000 (parts) + 200,000 (labor)
      partsUsed: [
        { retailprice: 500000, quantity: 2 } // 1,000,000 parts
      ]
    };

    const splitted = splitWorkOrderRevenue(order);
    expect(splitted.partsRevenue).toBe(800000); // capped at total
    expect(splitted.serviceRevenue).toBe(0);
  });

  it("handles service-only orders", () => {
    const order = {
      total: 300000,
      partsUsed: []
    };

    const splitted = splitWorkOrderRevenue(order);
    expect(splitted.partsRevenue).toBe(0);
    expect(splitted.serviceRevenue).toBe(300000);
  });
});
