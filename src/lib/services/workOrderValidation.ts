/**
 * Pure validation for the work order form (desktop + mobile).
 *
 * Phase 5 refactor: extracted from
 *   - useWorkOrderFormState.ts handleSave/handleSaveOnly
 *   - useWorkOrderMobileFormState.ts handleSave
 *   - workOrderSaveService.ts validate()
 *
 * Returns a list of errors; the hooks decide how to surface them (toast/alert)
 * — messages are kept verbatim to preserve current UX.
 */

/** Structural type: chấp nhận cả RepairServiceDraft (camelCase) lẫn payload (snake_case). */
export interface RepairServiceWorkerLike {
  share_percent?: number | string;
  sharePercent?: number | string;
}

export interface RepairServiceLike {
  serviceName: string;
  workers?: RepairServiceWorkerLike[];
}

export interface WorkOrderValidationError {
  field:
    | "customerName"
    | "customerPhone"
    | "repairServiceWorkers"
    | "total"
    | "customerVehicle";
  message: string;
}

const PHONE_REGEX = /^[0-9]{10,11}$/;

export interface WorkOrderDraftValidationInput {
  customerName?: string;
  customerPhone?: string;
  repairServices?: RepairServiceLike[];
  status?: string;
  total?: number;
  /**
   * Desktop validates name/phone/regex; mobile validates selected
   * customer+vehicle objects instead (DIVERGENCE kept — pass the flags the
   * calling platform actually enforces today).
   */
  checks: {
    requireCustomerNamePhone?: boolean;
    validatePhoneFormat?: boolean;
    /** Desktop handleSave only: "Tổng tiền phải lớn hơn 0 khi trả máy". */
    requirePositiveTotalOnDelivery?: boolean;
    /** Mobile only: khách hàng + thiết bị phải được chọn. */
    requireSelectedCustomerVehicle?: boolean;
    hasSelectedCustomer?: boolean;
    hasSelectedVehicle?: boolean;
  };
}

export function validateWorkOrderDraft(
  input: WorkOrderDraftValidationInput
): WorkOrderValidationError[] {
  const errors: WorkOrderValidationError[] = [];
  const { checks } = input;

  if (checks.requireSelectedCustomerVehicle) {
    if (!checks.hasSelectedCustomer || !checks.hasSelectedVehicle) {
      errors.push({
        field: "customerVehicle",
        message: "Vui lòng chọn khách hàng và thiết bị",
      });
    }
  }

  if (checks.requireCustomerNamePhone) {
    if (!input.customerName?.trim()) {
      errors.push({ field: "customerName", message: "Vui lòng nhập tên khách hàng" });
    } else if (!input.customerPhone?.trim()) {
      errors.push({ field: "customerPhone", message: "Vui lòng nhập số điện thoại" });
    } else if (
      checks.validatePhoneFormat &&
      !PHONE_REGEX.test(input.customerPhone.trim())
    ) {
      errors.push({
        field: "customerPhone",
        message: "Số điện thoại không hợp lệ! (cần 10-11 chữ số)",
      });
    }
  }

  if (
    checks.requirePositiveTotalOnDelivery &&
    (input.total ?? 0) <= 0 &&
    input.status === "Trả máy"
  ) {
    errors.push({ field: "total", message: "Tổng tiền phải lớn hơn 0 khi trả máy" });
  }

  const workerShareError = validateRepairServiceWorkerShares(input.repairServices || []);
  if (workerShareError) errors.push(workerShareError);

  return errors;
}

/**
 * Tổng phần trăm chia thợ của mỗi dịch vụ không được vượt quá 100%.
 * Identical logic existed in 3 places (desktop ×2, mobile ×1).
 */
export function validateRepairServiceWorkerShares(
  repairServices: RepairServiceLike[]
): WorkOrderValidationError | null {
  for (const service of repairServices) {
    const workers = service.workers || [];
    const totalShare = workers.reduce(
      (sum, w) => sum + Number(w.share_percent ?? w.sharePercent ?? 0),
      0
    );
    if (totalShare > 100) {
      return {
        field: "repairServiceWorkers",
        message: `Tổng phần trăm chia thợ cho dịch vụ "${service.serviceName}" vượt quá 100% (${totalShare}%)`,
      };
    }
  }
  return null;
}
