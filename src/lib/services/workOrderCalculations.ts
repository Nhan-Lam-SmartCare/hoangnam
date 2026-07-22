/**
 * Pure calculation functions for work order totals & payment math.
 *
 * Phase 5 refactor: extracted from
 *   - useWorkOrderFormState.ts (desktop, lines ~652-682, ~1255-1273)
 *   - useWorkOrderMobileFormState.ts (mobile, lines ~706-741, ~1032-1043)
 *   - ServiceManager.tsx handleMobileSave (lines ~928-935)
 *   - workOrderModal.paymentService.ts (orphaned helpers, merged here)
 *
 * IMPORTANT: behavior-preserving. Known desktop/mobile divergences are kept
 * visible via explicit input fields/options (documented per function) instead
 * of being silently unified. See tests/unit/workOrderFormCalculations.test.ts.
 */

export type WorkOrderPaymentStatus = "unpaid" | "paid" | "partial";

/**
 * A line item that contributes to the order total.
 * - Desktop parts:    { quantity, unitPrice: p.price }
 * - Mobile parts:     { quantity, unitPrice: p.sellingPrice }
 * - Desktop services: { quantity, unitPrice: s.price, unitLaborPrice: s.laborPrice }
 * - Mobile services:  { quantity, unitPrice: s.sellingPrice }  (no laborPrice — DIVERGENCE kept)
 */
export interface ChargeableItem {
  quantity: number;
  unitPrice: number;
  /** Desktop-only: per-service outsourced labor added on top of unitPrice. */
  unitLaborPrice?: number;
}

export interface WorkOrderTotalsInput {
  parts: ChargeableItem[];
  services: ChargeableItem[];
  /** Billable repair-labor total (đã tính sẵn từ repairServices). */
  repairLaborTotal: number;
  /** Tổng công tích hợp theo phụ tùng (partsLaborInfoTotal). */
  integratedLaborTotal: number;
  includeIntegratedLabor: boolean;
  discount: number;
  /**
   * "percent" is only used by the mobile form today; desktop always passes
   * "amount" (DIVERGENCE kept — do not default desktop to percent).
   */
  discountType?: "amount" | "percent";
}

export interface WorkOrderTotals {
  partsTotal: number;
  servicesTotal: number;
  effectiveLaborCost: number;
  subtotal: number;
  discountAmount: number;
  total: number;
}

export function calculateWorkOrderTotals(input: WorkOrderTotalsInput): WorkOrderTotals {
  const partsTotal = input.parts.reduce(
    (sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 0),
    0
  );

  const servicesTotal = input.services.reduce(
    (sum, item) =>
      sum + ((item.unitPrice || 0) + (item.unitLaborPrice || 0)) * (item.quantity || 0),
    0
  );

  const effectiveLaborCost = input.includeIntegratedLabor ? input.integratedLaborTotal : 0;

  const subtotal =
    partsTotal + servicesTotal + effectiveLaborCost + input.repairLaborTotal;

  const discountAmount =
    input.discountType === "percent"
      ? (subtotal * input.discount) / 100
      : input.discount;

  const total = Math.max(0, subtotal - discountAmount);

  return { partsTotal, servicesTotal, effectiveLaborCost, subtotal, discountAmount, total };
}

export interface AdditionalPaymentInput {
  status?: string;
  forceFullPayment: boolean;
  /** Desktop: showPartialPayment; Mobile: showPaymentInput. */
  showPartialPayment: boolean;
  /** Desktop: partialPayment; Mobile: partialAmount. */
  partialPayment: number;
  total: number;
  totalDeposit: number;
  /**
   * Save paths clamp the partial payment to the remaining amount
   * (Math.min). The desktop pre-save preview (getBlockedDeepEditMessage input)
   * does NOT clamp — pass false there to preserve behavior.
   */
  clampToRemaining: boolean;
}

/** Số tiền thanh toán thêm được áp dụng — chỉ khi trạng thái "Trả máy". */
export function getAdditionalPaymentToApply(input: AdditionalPaymentInput): number {
  if (input.status !== "Trả máy") return 0;
  const maxAdditionalPayment = Math.max(0, input.total - input.totalDeposit);
  if (input.forceFullPayment) return maxAdditionalPayment;
  if (!input.showPartialPayment) return 0;
  return input.clampToRemaining
    ? Math.min(input.partialPayment, maxAdditionalPayment)
    : input.partialPayment;
}

export interface DerivePaymentStatusInput {
  total: number;
  totalPaid: number;
  /**
   * ServiceManager.handleMobileSave guards "paid" with total > 0 (một phiếu
   * total=0 nhưng có cọc → "partial"). The desktop hook paths do NOT have the
   * guard (DIVERGENCE kept). Default false = desktop behavior.
   */
  requirePositiveTotal?: boolean;
}

export function derivePaymentStatus(input: DerivePaymentStatusInput): WorkOrderPaymentStatus {
  const paidCondition = input.requirePositiveTotal
    ? input.total > 0 && input.totalPaid >= input.total
    : input.totalPaid >= input.total;

  if (paidCondition) return "paid";
  if (input.totalPaid > 0) return "partial";
  return "unpaid";
}

export function calculateRemainingAmount(total: number, totalPaid: number): number {
  return Math.max(0, total - totalPaid);
}

export interface PaymentSummary {
  paymentStatus: WorkOrderPaymentStatus;
  totalPaid: number;
  remainingAmount: number;
}

export function buildPaymentSummary(input: {
  total: number;
  totalDeposit: number;
  additionalPayment: number;
  requirePositiveTotal?: boolean;
}): PaymentSummary {
  const totalPaid = Math.max(0, input.totalDeposit + input.additionalPayment);
  return {
    paymentStatus: derivePaymentStatus({
      total: input.total,
      totalPaid,
      requirePositiveTotal: input.requirePositiveTotal,
    }),
    totalPaid,
    remainingAmount: calculateRemainingAmount(input.total, totalPaid),
  };
}
