import { describe, it, expect } from "vitest";
import { calculateWorkerShare } from "../../src/utils/businessLogic";
import { computeMonthlySalarySummary } from "../../src/lib/services/repairLaborService";

describe("Salary / Worker Share Calculation", () => {
  it("calculates exact share for standard percent", () => {
    const share = calculateWorkerShare(100_000, 30); // 30% of 100k
    expect(share).toBe(30_000);
  });

  it("handles boundary values (0% and 100%)", () => {
    expect(calculateWorkerShare(50000, 0)).toBe(0);
    expect(calculateWorkerShare(50000, 100)).toBe(50000);
  });

  it("clamps invalid percentages", () => {
    // Should clamp -10 to 0% and 150 to 100%
    expect(calculateWorkerShare(10_000, -10)).toBe(0);
    expect(calculateWorkerShare(10_000, 150)).toBe(10_000);
  });

  it("returns 0 if laborAmount is negative", () => {
    expect(calculateWorkerShare(-5000, 50)).toBe(0);
  });
});

describe("computeMonthlySalarySummary with Advances", () => {
  it("calculates monthly salary details and subtracts advances correctly", () => {
    const summary = computeMonthlySalarySummary({
      workerId: "worker-1",
      workerName: "Nguyen Van A",
      serviceWorkers: [
        { workerAmount: 200000 } as any,
        { workerAmount: 300000 } as any,
      ],
      employee: {
        baseSalary: 5000000,
      } as any,
      bonus: 500000,
      penalty: 100000,
      advance: 1500000,
    });

    expect(summary.totalServiceCount).toBe(2);
    expect(summary.totalWorkerAmount).toBe(500000);
    expect(summary.baseSalary).toBe(5000000);
    expect(summary.bonus).toBe(500000);
    expect(summary.penalty).toBe(100000);
    expect(summary.advance).toBe(1500000);
    // 5M (base) + 500k (worker shares) + 500k (bonus) - 100k (penalty) - 1.5M (advance) = 4,400,000
    expect(summary.finalSalary).toBe(4400000);
  });

  it("handles missing/undefined values gracefully", () => {
    const summary = computeMonthlySalarySummary({
      workerId: "worker-2",
      workerName: "Tran Van B",
      serviceWorkers: [],
    });

    expect(summary.totalServiceCount).toBe(0);
    expect(summary.totalWorkerAmount).toBe(0);
    expect(summary.baseSalary).toBe(0);
    expect(summary.bonus).toBe(0);
    expect(summary.penalty).toBe(0);
    expect(summary.advance).toBe(0);
    expect(summary.finalSalary).toBe(0);
  });
});
