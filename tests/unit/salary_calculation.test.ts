import { describe, it, expect } from "vitest";
import { calculateWorkerShare } from "../../src/utils/businessLogic";

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
