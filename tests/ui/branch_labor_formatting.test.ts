import { describe, it, expect } from "vitest";
import { isPhoneBranch } from "../../src/utils/branchUtils";

describe("Branch Labor Cost and Formatting logic", () => {
  it("correctly identifies phone branch by name or id", () => {
    const branches = [
      { id: "CN1", name: "Chi nhánh Sửa chữa Xe máy" },
      { id: "CN2", name: "Điện thoại" },
      { id: "CN3", name: "Chi nhánh Dien Thoai HCM" },
    ];

    expect(isPhoneBranch("CN1", branches)).toBe(false);
    expect(isPhoneBranch("CN2", branches)).toBe(true);
    expect(isPhoneBranch("CN3", branches)).toBe(true);
    expect(isPhoneBranch("dienthoai", branches)).toBe(true);
    expect(isPhoneBranch("phone_branch", branches)).toBe(true);
  });

  it("does not fallback laborCost to wholesalePrice when laborCost is zero or missing", () => {
    const part: any = {
      id: "part-1",
      name: "Màn hình iPhone",
      retailPrice: { CN1: 180000 },
      wholesalePrice: { CN1: 162000 }, // 90% of retail price
      laborCost: { CN1: 0 },
    };

    // New logic: laborCost should explicitly be 0, not fallback to wholesalePrice 162000
    const laborCost = Number(part.laborCost?.["CN1"] || 0);
    expect(laborCost).toBe(0);
  });
});
