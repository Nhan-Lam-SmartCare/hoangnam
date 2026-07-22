import { describe, it, expect } from "vitest";
import {
  validateWorkOrderDraft,
  validateRepairServiceWorkerShares,
} from "../../src/lib/services/workOrderValidation";

// Phase 5: validation extracted from useWorkOrderFormState.handleSave /
// handleSaveOnly, useWorkOrderMobileFormState.handleSave and
// workOrderSaveService.validate(). Messages must stay verbatim.

describe("workOrderValidation — Phase 5 pure services", () => {
  const desktopChecks = {
    requireCustomerNamePhone: true,
    validatePhoneFormat: true,
    requirePositiveTotalOnDelivery: true,
  };

  describe("validateWorkOrderDraft — desktop checks", () => {
    it("requires customer name", () => {
      const errors = validateWorkOrderDraft({
        customerName: "  ",
        customerPhone: "0912345678",
        checks: desktopChecks,
      });
      expect(errors).toEqual([
        { field: "customerName", message: "Vui lòng nhập tên khách hàng" },
      ]);
    });

    it("requires phone", () => {
      const errors = validateWorkOrderDraft({
        customerName: "Nguyễn Văn A",
        customerPhone: "",
        checks: desktopChecks,
      });
      expect(errors).toEqual([
        { field: "customerPhone", message: "Vui lòng nhập số điện thoại" },
      ]);
    });

    it.each(["09123", "091234567890", "abc1234567", "0912 345 678"])(
      "rejects invalid phone format: %s",
      (phone) => {
        const errors = validateWorkOrderDraft({
          customerName: "Nguyễn Văn A",
          customerPhone: phone,
          checks: desktopChecks,
        });
        expect(errors[0]?.message).toBe(
          "Số điện thoại không hợp lệ! (cần 10-11 chữ số)"
        );
      }
    );

    it.each(["0912345678", "09123456789"])("accepts valid phone: %s", (phone) => {
      const errors = validateWorkOrderDraft({
        customerName: "Nguyễn Văn A",
        customerPhone: phone,
        total: 100000,
        status: "Tiếp nhận",
        checks: desktopChecks,
      });
      expect(errors).toEqual([]);
    });

    it("trims phone before format check (legacy behavior)", () => {
      const errors = validateWorkOrderDraft({
        customerName: "A",
        customerPhone: " 0912345678 ",
        checks: desktopChecks,
      });
      expect(errors).toEqual([]);
    });

    it('rejects total <= 0 when status "Trả máy"', () => {
      const errors = validateWorkOrderDraft({
        customerName: "A",
        customerPhone: "0912345678",
        total: 0,
        status: "Trả máy",
        checks: desktopChecks,
      });
      expect(errors).toEqual([
        { field: "total", message: "Tổng tiền phải lớn hơn 0 khi trả máy" },
      ]);
    });

    it('allows total 0 when status is not "Trả máy"', () => {
      const errors = validateWorkOrderDraft({
        customerName: "A",
        customerPhone: "0912345678",
        total: 0,
        status: "Tiếp nhận",
        checks: desktopChecks,
      });
      expect(errors).toEqual([]);
    });
  });

  describe("validateWorkOrderDraft — mobile checks", () => {
    const mobileChecks = { requireSelectedCustomerVehicle: true };

    it("requires selected customer AND vehicle", () => {
      expect(
        validateWorkOrderDraft({
          checks: { ...mobileChecks, hasSelectedCustomer: false, hasSelectedVehicle: true },
        })
      ).toEqual([
        { field: "customerVehicle", message: "Vui lòng chọn khách hàng và thiết bị" },
      ]);
      expect(
        validateWorkOrderDraft({
          checks: { ...mobileChecks, hasSelectedCustomer: true, hasSelectedVehicle: false },
        })
      ).toHaveLength(1);
      expect(
        validateWorkOrderDraft({
          checks: { ...mobileChecks, hasSelectedCustomer: true, hasSelectedVehicle: true },
        })
      ).toEqual([]);
    });
  });

  describe("validateRepairServiceWorkerShares", () => {
    it("passes when total share <= 100", () => {
      expect(
        validateRepairServiceWorkerShares([
          {
            serviceName: "Thay màn hình",
            workers: [
              { share_percent: 60 },
              { share_percent: 40 },
            ],
          },
        ])
      ).toBeNull();
    });

    it("fails when total share > 100 with verbatim message", () => {
      const error = validateRepairServiceWorkerShares([
        {
          serviceName: "Thay pin",
          workers: [{ share_percent: 70 }, { share_percent: 50 }],
        },
      ]);
      expect(error).toEqual({
        field: "repairServiceWorkers",
        message: 'Tổng phần trăm chia thợ cho dịch vụ "Thay pin" vượt quá 100% (120%)',
      });
    });

    it("supports both share_percent (snake) and sharePercent (camel)", () => {
      const error = validateRepairServiceWorkerShares([
        {
          serviceName: "Vệ sinh máy",
          workers: [{ sharePercent: 80 }, { share_percent: 30 }],
        },
      ]);
      expect(error?.message).toContain("110%");
    });

    it("empty workers list is valid", () => {
      expect(
        validateRepairServiceWorkerShares([{ serviceName: "X", workers: [] }])
      ).toBeNull();
      expect(validateRepairServiceWorkerShares([{ serviceName: "X" }])).toBeNull();
    });
  });

  describe("error ordering (must match legacy toast order)", () => {
    it("name error is reported before phone error", () => {
      const errors = validateWorkOrderDraft({
        customerName: "",
        customerPhone: "",
        checks: { requireCustomerNamePhone: true, validatePhoneFormat: true },
      });
      // Legacy code returned on FIRST error — name checked first
      expect(errors[0].field).toBe("customerName");
    });

    it("total check comes before worker-share check (matches desktop handleSave order)", () => {
      const errors = validateWorkOrderDraft({
        customerName: "A",
        customerPhone: "0912345678",
        total: 0,
        status: "Trả máy",
        repairServices: [
          { serviceName: "S", workers: [{ share_percent: 150 }] },
        ],
        checks: desktopChecks,
      });
      expect(errors.map((e) => e.field)).toEqual(["total", "repairServiceWorkers"]);
    });
  });
});
