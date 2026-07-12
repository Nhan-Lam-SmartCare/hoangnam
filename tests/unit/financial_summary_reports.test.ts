import { describe, it, expect } from "vitest";
import { calculateFinancialSummary } from "../../src/lib/reports/financialSummary";

describe("calculateFinancialSummary P&L Calculations", () => {
  const parts = [
    { id: "P1", costPrice: { CN1: 100000, CN2: 80000 } },
    { id: "P2", costPrice: { CN1: 200000 } },
  ];

  it("scales parts and labor costs proportionally to payment status ratio", () => {
    const workOrders = [
      {
        id: "WO1",
        paymentStatus: "partial",
        creationDate: "2026-06-01T10:00:00Z",
        paymentDate: "2026-06-02T10:00:00Z",
        total: 1000000,
        totalPaid: 400000, // 40% paid ratio
        partsUsed: [
          { partId: "P1", quantity: 2, costPrice: 100000 }, // Raw Cost = 200,000
        ],
        workerTotal: 300000, // Worker share raw = 300,000
      },
    ];

    const summary = calculateFinancialSummary({
      sales: [],
      workOrders,
      parts,
      cashTransactions: [],
      branchId: "CN1",
      start: new Date("2026-06-01T00:00:00Z"),
      end: new Date("2026-06-30T23:59:59Z"),
    });

    // Ratio = 400k / 1M = 0.4
    // Parts raw cost = 200,000. Worker raw cost = 300,000. Total Raw Cost = 500,000.
    // Expected proportional cost = 500,000 * 0.4 = 200,000.
    expect(summary.woRevenue).toBe(400000);
    expect(summary.woCost).toBe(200000);
    expect(summary.woGrossProfit).toBe(200000);
    expect(summary.netProfit).toBe(200000);
  });

  it("excludes salary and employee_advance transactions from operating expenses to prevent double-counting", () => {
    const cashTransactions = [
      {
        id: "TX1",
        type: "expense",
        amount: 5000000,
        category: "salary", // excluded
        date: "2026-06-15T12:00:00Z",
      },
      {
        id: "TX2",
        type: "expense",
        amount: 2000000,
        category: "ứng lương", // translates to employee_advance -> excluded
        date: "2026-06-16T12:00:00Z",
      },
      {
        id: "TX3",
        type: "expense",
        amount: 1200000,
        category: "rent", // included
        date: "2026-06-17T12:00:00Z",
      },
    ];

    const summary = calculateFinancialSummary({
      sales: [],
      workOrders: [],
      parts: [],
      cashTransactions,
      branchId: "CN1",
      start: new Date("2026-06-01T00:00:00Z"),
      end: new Date("2026-06-30T23:59:59Z"),
    });

    expect(summary.cashExpense).toBe(1200000); // only rent is included
  });
});
