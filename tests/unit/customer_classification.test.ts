import { describe, it, expect } from "vitest";
import { classifyCustomer } from "../../src/utils/businessLogic";

describe("Customer Classification", () => {
  it("classifies as 'Mới' if no last visit date", () => {
    expect(classifyCustomer(null)).toBe("Mới");
    expect(classifyCustomer(undefined)).toBe("Mới");
  });

  it("classifies as 'Thường Xuyên' if visit within 3 months", () => {
    const current = new Date("2026-04-09");
    const lastVisit = new Date("2026-03-09"); // 1 month ago
    expect(classifyCustomer(lastVisit, current)).toBe("Thường Xuyên");
  });

  it("classifies as 'Sắp Mất' if visit between 3 and 6 months", () => {
    const current = new Date("2026-04-09");
    const lastVisit = new Date("2025-11-09"); // 5 months ago
    expect(classifyCustomer(lastVisit, current)).toBe("Sắp Mất");
  });

  it("classifies as 'Đã Mất' if visit older than 6 months", () => {
    const current = new Date("2026-04-09");
    const lastVisit = new Date("2025-08-09"); // 8 months ago
    expect(classifyCustomer(lastVisit, current)).toBe("Đã Mất");
  });
});
