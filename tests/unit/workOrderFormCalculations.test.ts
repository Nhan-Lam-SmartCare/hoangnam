import { describe, it, expect } from "vitest";
import {
  calculateWorkOrderTotals,
  getAdditionalPaymentToApply,
  derivePaymentStatus,
  calculateRemainingAmount,
  buildPaymentSummary,
} from "../../src/lib/services/workOrderCalculations";

// ──────────────────────────────────────────────────────────
// Phase 5: these tests now run against the REAL pure services
// (src/lib/services/workOrderCalculations.ts) instead of copied
// implementations. Expected values are unchanged from the Phase 0
// characterization snapshot — proving the extraction is
// behavior-preserving.
//
// Desktop/mobile divergences are preserved behind explicit inputs:
//  - services laborPrice: desktop passes unitLaborPrice, mobile does not
//  - percent discount: mobile passes discountType "percent", desktop "amount"
//  - paid guard: ServiceManager passes requirePositiveTotal: true
// ──────────────────────────────────────────────────────────

/** Desktop-shaped call: services carry unitLaborPrice, discount always amount. */
function desktopTotals(input: {
  parts: Array<{ quantity: number; price: number }>;
  services: Array<{ price: number; laborPrice?: number; quantity: number }>;
  repairLaborTotal: number;
  includeIntegratedLabor: boolean;
  partsLaborInfoTotal: number;
  discount: number;
}) {
  return calculateWorkOrderTotals({
    parts: input.parts.map((p) => ({ quantity: p.quantity, unitPrice: p.price })),
    services: input.services.map((s) => ({
      quantity: s.quantity,
      unitPrice: s.price,
      unitLaborPrice: s.laborPrice || 0,
    })),
    repairLaborTotal: input.repairLaborTotal,
    integratedLaborTotal: input.partsLaborInfoTotal,
    includeIntegratedLabor: input.includeIntegratedLabor,
    discount: input.discount,
    discountType: "amount",
  });
}

/** Mobile-shaped call: sellingPrice only, discountType configurable. */
function mobileTotals(input: {
  parts: Array<{ quantity: number; sellingPrice: number }>;
  services: Array<{ sellingPrice: number; quantity: number }>;
  repairLaborTotal: number;
  includeIntegratedLabor: boolean;
  partsLaborInfoTotal: number;
  discount: number;
  discountType: "amount" | "percent";
}) {
  return calculateWorkOrderTotals({
    parts: input.parts.map((p) => ({ quantity: p.quantity, unitPrice: p.sellingPrice })),
    services: input.services.map((s) => ({
      quantity: s.quantity,
      unitPrice: s.sellingPrice,
    })),
    repairLaborTotal: input.repairLaborTotal,
    integratedLaborTotal: input.partsLaborInfoTotal,
    includeIntegratedLabor: input.includeIntegratedLabor,
    discount: input.discount,
    discountType: input.discountType,
  });
}

describe("workOrderCalculations — Phase 5 pure services", () => {
  // ═══════════════ Desktop-shaped calculation ═══════════════

  describe("desktop shape (useWorkOrderFormState)", () => {
    it("calculates partsTotal correctly", () => {
      const result = desktopTotals({
        parts: [
          { quantity: 2, price: 100000 },
          { quantity: 1, price: 50000 },
        ],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
      });
      expect(result.partsTotal).toBe(250000);
    });

    it("servicesTotal includes laborPrice per service", () => {
      const result = desktopTotals({
        parts: [],
        services: [
          { price: 100000, laborPrice: 20000, quantity: 1 },
          { price: 50000, laborPrice: 10000, quantity: 2 },
        ],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
      });
      // (100000+20000)*1 + (50000+10000)*2 = 240000
      expect(result.servicesTotal).toBe(240000);
    });

    it("applies integrated labor when enabled", () => {
      const result = desktopTotals({
        parts: [{ quantity: 1, price: 200000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: true,
        partsLaborInfoTotal: 30000,
        discount: 0,
      });
      expect(result.effectiveLaborCost).toBe(30000);
      expect(result.subtotal).toBe(230000);
    });

    it("calculates total with discount", () => {
      const result = desktopTotals({
        parts: [{ quantity: 1, price: 500000 }],
        services: [],
        repairLaborTotal: 100000,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 50000,
      });
      expect(result.total).toBe(550000);
    });

    it("total is never negative", () => {
      const result = desktopTotals({
        parts: [{ quantity: 1, price: 10000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 999999,
      });
      expect(result.total).toBe(0);
    });

    it('additionalPayment only counts when status="Trả máy" and showPartialPayment', () => {
      const total = 200000;
      const base = {
        forceFullPayment: false,
        partialPayment: 100000,
        total,
        totalDeposit: 50000,
        clampToRemaining: false,
      };

      // Not "Trả máy" → additionalPayment ignored
      const p1 = getAdditionalPaymentToApply({
        ...base,
        status: "Đang sửa",
        showPartialPayment: true,
      });
      expect(50000 + p1).toBe(50000); // only deposit
      expect(calculateRemainingAmount(total, 50000 + p1)).toBe(150000);

      // "Trả máy" but showPartialPayment=false → also ignored
      const p2 = getAdditionalPaymentToApply({
        ...base,
        status: "Trả máy",
        showPartialPayment: false,
      });
      expect(50000 + p2).toBe(50000);

      // "Trả máy" and showPartialPayment=true → counts
      const p3 = getAdditionalPaymentToApply({
        ...base,
        status: "Trả máy",
        showPartialPayment: true,
      });
      expect(50000 + p3).toBe(150000);
      expect(calculateRemainingAmount(total, 50000 + p3)).toBe(50000);
    });

    it("forceFullPayment pays exactly the remaining amount", () => {
      const paid = getAdditionalPaymentToApply({
        status: "Trả máy",
        forceFullPayment: true,
        showPartialPayment: false,
        partialPayment: 0,
        total: 300000,
        totalDeposit: 120000,
        clampToRemaining: true,
      });
      expect(paid).toBe(180000);
    });

    it("clampToRemaining caps partial payment at remaining (save path)", () => {
      const paid = getAdditionalPaymentToApply({
        status: "Trả máy",
        forceFullPayment: false,
        showPartialPayment: true,
        partialPayment: 999999,
        total: 300000,
        totalDeposit: 100000,
        clampToRemaining: true,
      });
      expect(paid).toBe(200000);
    });

    it("preview path (clampToRemaining=false) does NOT cap — legacy behavior", () => {
      const paid = getAdditionalPaymentToApply({
        status: "Trả máy",
        forceFullPayment: false,
        showPartialPayment: true,
        partialPayment: 999999,
        total: 300000,
        totalDeposit: 100000,
        clampToRemaining: false,
      });
      expect(paid).toBe(999999);
    });
  });

  // ═══════════════ Mobile-shaped calculation ═══════════════

  describe("mobile shape (useWorkOrderMobileFormState)", () => {
    it("calculates partsTotal using sellingPrice", () => {
      const result = mobileTotals({
        parts: [
          { quantity: 2, sellingPrice: 100000 },
          { quantity: 1, sellingPrice: 50000 },
        ],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
        discountType: "amount",
      });
      expect(result.partsTotal).toBe(250000);
    });

    it("servicesTotal does NOT include laborPrice (uses sellingPrice only)", () => {
      const result = mobileTotals({
        parts: [],
        services: [
          { sellingPrice: 100000, quantity: 1 },
          { sellingPrice: 50000, quantity: 2 },
        ],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
        discountType: "amount",
      });
      expect(result.servicesTotal).toBe(200000);
    });

    it("supports percent discount", () => {
      const result = mobileTotals({
        parts: [{ quantity: 1, sellingPrice: 1000000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 10, // 10 percent
        discountType: "percent",
      });
      expect(result.discountAmount).toBe(100000);
      expect(result.total).toBe(900000);
    });

    it("deposit only counts when isDeposit=true (caller passes 0)", () => {
      // isDeposit=false → caller passes totalDeposit 0 (hook behavior)
      const total = mobileTotals({
        parts: [{ quantity: 1, sellingPrice: 200000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
        discountType: "amount",
      }).total;
      expect(calculateRemainingAmount(total, 0)).toBe(200000);
    });
  });

  // ═══════════════ derivePaymentStatus ═══════════════

  describe("derivePaymentStatus", () => {
    it("desktop behavior (no requirePositiveTotal): totalPaid >= total → paid", () => {
      expect(derivePaymentStatus({ total: 100, totalPaid: 100 })).toBe("paid");
      expect(derivePaymentStatus({ total: 100, totalPaid: 50 })).toBe("partial");
      expect(derivePaymentStatus({ total: 100, totalPaid: 0 })).toBe("unpaid");
      // Legacy desktop quirk kept: total=0, paid=0 → "paid" (0 >= 0)
      expect(derivePaymentStatus({ total: 0, totalPaid: 0 })).toBe("paid");
    });

    it("ServiceManager behavior (requirePositiveTotal): total=0 + deposit → partial", () => {
      expect(
        derivePaymentStatus({ total: 0, totalPaid: 50000, requirePositiveTotal: true })
      ).toBe("partial");
      expect(
        derivePaymentStatus({ total: 0, totalPaid: 0, requirePositiveTotal: true })
      ).toBe("unpaid");
      expect(
        derivePaymentStatus({ total: 100, totalPaid: 100, requirePositiveTotal: true })
      ).toBe("paid");
    });
  });

  describe("buildPaymentSummary", () => {
    it("combines deposit + additional payment into status/paid/remaining", () => {
      const summary = buildPaymentSummary({
        total: 300000,
        totalDeposit: 100000,
        additionalPayment: 50000,
      });
      expect(summary).toEqual({
        paymentStatus: "partial",
        totalPaid: 150000,
        remainingAmount: 150000,
      });
    });

    it("negative deposit is floored at 0 totalPaid", () => {
      const summary = buildPaymentSummary({
        total: 100000,
        totalDeposit: -50000,
        additionalPayment: 0,
      });
      expect(summary.totalPaid).toBe(0);
      expect(summary.paymentStatus).toBe("unpaid");
    });
  });

  // ═══════════════ Documented divergences (still preserved) ═══════════════

  describe("DOCUMENTED DIVERGENCES between desktop and mobile", () => {
    it("[DIVERGENCE] servicesTotal: desktop adds laborPrice, mobile does NOT", () => {
      const desktopResult = desktopTotals({
        parts: [],
        services: [{ price: 100000, laborPrice: 30000, quantity: 1 }],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
      });

      const mobileResult = mobileTotals({
        parts: [],
        services: [{ sellingPrice: 100000, quantity: 1 }],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
        discountType: "amount",
      });

      expect(desktopResult.servicesTotal).toBe(130000);
      expect(mobileResult.servicesTotal).toBe(100000);
    });

    it("[DIVERGENCE] discount: desktop only supports amount, mobile supports percent", () => {
      const desktopResult = desktopTotals({
        parts: [{ quantity: 1, price: 500000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 10, // desktop: 10đ flat
      });

      const mobileResult = mobileTotals({
        parts: [{ quantity: 1, sellingPrice: 500000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 10,
        discountType: "percent", // mobile: 10%
      });

      expect(desktopResult.total).toBe(499990);
      expect(mobileResult.total).toBe(450000);
    });
  });

  // ═══════════════ Consistent calculations ═══════════════

  describe("consistent calculations (both platforms agree)", () => {
    it("partsTotal is equivalent when same values are used", () => {
      const desktopResult = desktopTotals({
        parts: [{ quantity: 3, price: 80000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
      });

      const mobileResult = mobileTotals({
        parts: [{ quantity: 3, sellingPrice: 80000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 0,
        discountType: "amount",
      });

      expect(desktopResult.partsTotal).toBe(mobileResult.partsTotal);
      expect(desktopResult.partsTotal).toBe(240000);
    });

    it("subtotal formula is the same (parts + services + labor + repairLabor)", () => {
      const desktopResult = desktopTotals({
        parts: [{ quantity: 1, price: 100000 }],
        services: [{ price: 50000, quantity: 1 }], // no laborPrice
        repairLaborTotal: 20000,
        includeIntegratedLabor: true,
        partsLaborInfoTotal: 15000,
        discount: 0,
      });

      const mobileResult = mobileTotals({
        parts: [{ quantity: 1, sellingPrice: 100000 }],
        services: [{ sellingPrice: 50000, quantity: 1 }],
        repairLaborTotal: 20000,
        includeIntegratedLabor: true,
        partsLaborInfoTotal: 15000,
        discount: 0,
        discountType: "amount",
      });

      expect(desktopResult.subtotal).toBe(mobileResult.subtotal);
      expect(desktopResult.subtotal).toBe(185000); // 100k + 50k + 15k + 20k
    });

    it("total is never negative (both platforms)", () => {
      const desktop = desktopTotals({
        parts: [],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 999999,
      });

      const mobile = mobileTotals({
        parts: [],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 999999,
        discountType: "amount",
      });

      expect(desktop.total).toBe(0);
      expect(mobile.total).toBe(0);
    });
  });

  // ═══════════════ Edge cases (new in Phase 5) ═══════════════

  describe("edge cases", () => {
    it("zero parts, zero services → all-zero totals", () => {
      const r = desktopTotals({
        parts: [],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: true,
        partsLaborInfoTotal: 0,
        discount: 0,
      });
      expect(r).toEqual({
        partsTotal: 0,
        servicesTotal: 0,
        effectiveLaborCost: 0,
        subtotal: 0,
        discountAmount: 0,
        total: 0,
      });
    });

    it("discount > subtotal → total clamps to 0 but discountAmount is raw", () => {
      const r = mobileTotals({
        parts: [{ quantity: 1, sellingPrice: 100000 }],
        services: [],
        repairLaborTotal: 0,
        includeIntegratedLabor: false,
        partsLaborInfoTotal: 0,
        discount: 150, // 150%
        discountType: "percent",
      });
      expect(r.discountAmount).toBe(150000);
      expect(r.total).toBe(0);
    });

    it("refund-after-deposit shape: deposit exceeds total → remaining 0, status paid", () => {
      const summary = buildPaymentSummary({
        total: 100000,
        totalDeposit: 150000,
        additionalPayment: 0,
      });
      expect(summary.remainingAmount).toBe(0);
      expect(summary.paymentStatus).toBe("paid");
    });
  });
});
