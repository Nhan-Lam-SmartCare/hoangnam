/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import {
  validatePriceAndQty,
  validatePhoneNumber,
  validateStockQuantity,
  validateDepositAmount,
  validateDiscount,
  validateLicensePlate,
} from "../../src/utils/validation";

describe("validatePriceAndQty", () => {
  it("should accept valid price and quantity", () => {
    const result = validatePriceAndQty(100000, 10);

    expect(result.ok).toBe(true);
    expect(result.warnings).toHaveLength(0);
    expect(result.clean.importPrice).toBe(100000);
    expect(result.clean.quantity).toBe(10);
  });

  it("should clamp price above max limit", () => {
    const result = validatePriceAndQty(60_000_000, 10); // > 50 million

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain(
      "Giá nhập quá lớn (>50 triệu) đã được giới hạn."
    );
    expect(result.clean.importPrice).toBe(50_000_000);
  });

  it("should clamp quantity above max limit", () => {
    const result = validatePriceAndQty(100000, 15000); // > 10,000

    expect(result.ok).toBe(true);
    expect(result.warnings).toContain(
      "Số lượng quá lớn (>10,000) đã được giới hạn."
    );
    expect(result.clean.quantity).toBe(10_000);
  });

  it("should handle negative values", () => {
    const result = validatePriceAndQty(-5000, -10);

    expect(result.ok).toBe(true);
    expect(result.clean.importPrice).toBe(0);
    expect(result.clean.quantity).toBe(0);
  });

  it("should round decimal values", () => {
    const result = validatePriceAndQty(99999.7, 5.4);

    expect(result.clean.importPrice).toBe(100000);
    expect(result.clean.quantity).toBe(5);
  });

  it("should accumulate multiple warnings", () => {
    const result = validatePriceAndQty(60_000_000, 15000);

    expect(result.warnings).toHaveLength(2);
  });
});

describe("validatePhoneNumber", () => {
  it("should accept valid 10-digit phone number", () => {
    const result = validatePhoneNumber("0912345678");

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it("should accept valid 11-digit phone number", () => {
    const result = validatePhoneNumber("01234567890");

    expect(result.ok).toBe(true);
  });

  it("should accept phone number with +84 prefix", () => {
    const result = validatePhoneNumber("+84912345678");

    expect(result.ok).toBe(true);
  });

  it("should reject empty phone number", () => {
    const result = validatePhoneNumber("");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Số điện thoại không được để trống");
  });

  it("should reject whitespace-only phone number", () => {
    const result = validatePhoneNumber("   ");

    expect(result.ok).toBe(false);
  });

  it("should reject phone number with invalid format", () => {
    const result = validatePhoneNumber("123456");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Số điện thoại không hợp lệ");
  });

  it("should handle phone with spaces (trimmed)", () => {
    const result = validatePhoneNumber("  0912345678  ");

    expect(result.ok).toBe(true);
  });

  it("should reject phone with letters", () => {
    const result = validatePhoneNumber("091234567a");

    expect(result.ok).toBe(false);
  });
});

describe("validateStockQuantity", () => {
  it("should accept valid quantity within stock", () => {
    const result = validateStockQuantity(5, 10, "Nhớt Castrol");

    expect(result.ok).toBe(true);
  });

  it("should accept quantity equal to stock", () => {
    const result = validateStockQuantity(10, 10, "Nhớt Castrol");

    expect(result.ok).toBe(true);
  });

  it("should reject zero quantity", () => {
    const result = validateStockQuantity(0, 10, "Nhớt Castrol");

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Số lượng phải lớn hơn 0");
  });

  it("should reject negative quantity", () => {
    const result = validateStockQuantity(-5, 10, "Nhớt Castrol");

    expect(result.ok).toBe(false);
  });

  it("should reject quantity exceeding stock", () => {
    const result = validateStockQuantity(15, 10, "Nhớt Castrol");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Không đủ hàng");
    expect(result.error).toContain("Nhớt Castrol");
    expect(result.error).toContain("Tồn kho 10");
    expect(result.error).toContain("yêu cầu 15");
  });
});

describe("validateDepositAmount", () => {
  it("should accept valid deposit amount", () => {
    const result = validateDepositAmount(50000, 100000);

    expect(result.ok).toBe(true);
  });

  it("should accept zero deposit", () => {
    const result = validateDepositAmount(0, 100000);

    expect(result.ok).toBe(true);
  });

  it("should accept deposit equal to total", () => {
    const result = validateDepositAmount(100000, 100000);

    expect(result.ok).toBe(true);
  });

  it("should reject negative deposit", () => {
    const result = validateDepositAmount(-5000, 100000);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Tiền đặt cọc không được âm");
  });

  it("should reject deposit exceeding total", () => {
    const result = validateDepositAmount(150000, 100000);

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Tiền đặt cọc không được lớn hơn tổng tiền");
  });
});

describe("validateDiscount", () => {
  it("should accept valid discount", () => {
    const result = validateDiscount(10000, 100000);

    expect(result.ok).toBe(true);
  });

  it("should accept zero discount", () => {
    const result = validateDiscount(0, 100000);

    expect(result.ok).toBe(true);
  });

  it("should accept discount equal to subtotal", () => {
    const result = validateDiscount(100000, 100000);

    expect(result.ok).toBe(true);
  });

  it("should reject negative discount", () => {
    const result = validateDiscount(-5000, 100000);

    expect(result.ok).toBe(false);
    expect(result.error).toBe("Giảm giá không được âm");
  });

  it("should reject discount exceeding subtotal", () => {
    const result = validateDiscount(150000, 100000);

    expect(result.ok).toBe(false);
    expect(result.error).toContain(
      "Giảm giá không được lớn hơn tổng tiền hàng"
    );
  });
});

describe("validateLicensePlate", () => {
  it("should accept valid license plate format", () => {
    // Các biển số hợp lệ theo regex: XX[A-Z]{1,2}[-\s]?[0-9A-Z]{3,5}(\.[0-9]{2})?
    const validPlates = ["29A12345", "51H12345", "30AA12345", "92B12345"];

    validPlates.forEach((plate) => {
      const result = validateLicensePlate(plate);
      expect(result.ok).toBe(true);
    });
  });

  it("should accept empty license plate (optional field)", () => {
    const result = validateLicensePlate("");

    expect(result.ok).toBe(true);
  });

  it("should accept whitespace-only (treated as empty)", () => {
    const result = validateLicensePlate("   ");

    expect(result.ok).toBe(true);
  });

  it("should reject invalid license plate format", () => {
    const result = validateLicensePlate("ABC-XYZ");

    expect(result.ok).toBe(false);
    expect(result.error).toContain("Biển số không hợp lệ");
  });

  it("should be case-insensitive", () => {
    const result1 = validateLicensePlate("29a12345");
    const result2 = validateLicensePlate("29A12345");

    expect(result1.ok).toBe(true);
    expect(result2.ok).toBe(true);
  });
});
