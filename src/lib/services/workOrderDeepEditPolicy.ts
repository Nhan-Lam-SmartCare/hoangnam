/**
 * Phase 8: deep-edit permission policy for work orders.
 *
 * Khi sửa một phiếu đã tồn tại, so sánh draft hiện tại với phiếu gốc theo
 * từng nhóm trường (trạng thái, thanh toán, phụ tùng, công, giảm giá, khách,
 * thiết bị, gia công ngoài) và trả về thông báo chặn ĐẦU TIÊN nếu người dùng
 * thiếu quyền tương ứng.
 *
 * Extracted from (previously duplicated in both):
 *   - useWorkOrderFormState.getBlockedDeepEditMessage (desktop)
 *   - useWorkOrderMobileFormState.handleSave inline checks (mobile)
 *
 * DIVERGENCE kept: desktop so sánh cả currentKm khi xét "thiết bị thay đổi",
 * mobile thì không — điều khiển qua opts.compareCurrentKm.
 */
import type { WorkOrder } from "../../types";

const normalizeNumber = (value: unknown): number => Number(value || 0);

const normalizePartsForCompare = (items: any[] = []) =>
  items
    .map((item) => ({
      partId: String(item.partId || ""),
      partName: String(item.partName || ""),
      quantity: normalizeNumber(item.quantity),
      price: normalizeNumber(item.price ?? item.sellingPrice),
      costPrice: normalizeNumber(item.costPrice),
    }))
    .sort((a, b) =>
      `${a.partId}|${a.partName}`.localeCompare(`${b.partId}|${b.partName}`)
    );

const normalizeServicesForCompare = (items: any[] = []) =>
  items
    .map((item) => ({
      description: String(item.description || item.name || ""),
      quantity: normalizeNumber(item.quantity),
      price: normalizeNumber(item.price ?? item.sellingPrice),
      costPrice: normalizeNumber(item.costPrice),
    }))
    .sort((a, b) => a.description.localeCompare(b.description));

const normalizeRepairServicesForCompare = (items: any[] = []) =>
  items
    .map((item) => ({
      serviceId: String(item.serviceId || item.service_id || ""),
      serviceName: String(item.serviceName || item.service_name || ""),
      laborAmount: normalizeNumber(item.laborAmount || item.labor_amount),
      // Giữ nguyên hành vi cũ: related dạng string sẽ map thành "" (quirk có sẵn
      // ở cả desktop lẫn mobile — không tự sửa để tránh đổi kết quả so sánh)
      relatedItemIds: (
        item.relatedItemIds ||
        item.related_items ||
        item.relatedItems ||
        []
      )
        .map((related: any) => String(related.partId || related.part_id || ""))
        .sort(),
    }))
    .sort((a, b) =>
      `${a.serviceId}|${a.serviceName}`.localeCompare(`${b.serviceId}|${b.serviceName}`)
    );

/** Snapshot của draft đang sửa — caller (desktop/mobile) tự map từ state của mình. */
export interface WorkOrderDraftSnapshot {
  status?: string;
  paymentMethod?: string;
  customerName?: string;
  customerPhone?: string;
  vehicleId?: string;
  vehicleModel?: string;
  licensePlate?: string;
  currentKm?: number;
  totalDeposit: number;
  nextAdditionalPayment: number;
  effectiveLaborCost: number;
  discount: number;
  selectedParts: unknown[];
  additionalServices: unknown[];
  repairServices: unknown[];
}

export interface WorkOrderEditPermissions {
  canUpdateWorkOrderStatus?: boolean;
  canUpdateWorkOrderPayment?: boolean;
  canUpdateWorkOrderParts?: boolean;
  canUpdateWorkOrderLabor?: boolean;
  canUpdateWorkOrderDiscount?: boolean;
  canUpdateWorkOrderCustomer?: boolean;
  canUpdateWorkOrderVehicle?: boolean;
  canUpdateWorkOrderOutsourceService?: boolean;
}

export interface DeepEditPolicyOptions {
  /** Desktop: true (so sánh km khi xét thiết bị). Mobile: false. */
  compareCurrentKm?: boolean;
}

export function getBlockedDeepEditMessage(
  order: WorkOrder | null | undefined,
  draft: WorkOrderDraftSnapshot,
  permissions: WorkOrderEditPermissions,
  opts: DeepEditPolicyOptions = {}
): string | null {
  if (!order?.id) return null;

  const statusChanged = draft.status !== order.status;

  const paymentChanged =
    normalizeNumber(order.depositAmount) !== normalizeNumber(draft.totalDeposit) ||
    normalizeNumber(order.additionalPayment) !==
      normalizeNumber(draft.nextAdditionalPayment) ||
    String(order.paymentMethod || "") !== String(draft.paymentMethod || "");

  const partsChanged =
    JSON.stringify(normalizePartsForCompare(order.partsUsed as any[])) !==
      JSON.stringify(normalizePartsForCompare(draft.selectedParts as any[])) ||
    JSON.stringify(normalizeRepairServicesForCompare(order.repairServices as any[])) !==
      JSON.stringify(normalizeRepairServicesForCompare(draft.repairServices as any[]));

  const outsourceServicesChanged =
    JSON.stringify(normalizeServicesForCompare(order.additionalServices as any[])) !==
    JSON.stringify(normalizeServicesForCompare(draft.additionalServices as any[]));

  const laborChanged =
    normalizeNumber(order.laborCost) !== normalizeNumber(draft.effectiveLaborCost);

  const discountChanged =
    normalizeNumber(order.discount) !== normalizeNumber(draft.discount);

  const customerChanged =
    String(order.customerName || "") !== String(draft.customerName || "") ||
    String(order.customerPhone || "") !== String(draft.customerPhone || "");

  const vehicleChanged =
    String(order.vehicleId || "") !== String(draft.vehicleId || "") ||
    String(order.vehicleModel || "") !== String(draft.vehicleModel || "") ||
    String(order.licensePlate || "") !== String(draft.licensePlate || "") ||
    (opts.compareCurrentKm === true &&
      normalizeNumber(order.currentKm) !== normalizeNumber(draft.currentKm));

  if (statusChanged && !permissions.canUpdateWorkOrderStatus) {
    return "Bạn không có quyền đổi trạng thái phiếu sửa chữa";
  }
  if (paymentChanged && !permissions.canUpdateWorkOrderPayment) {
    return "Bạn không có quyền cập nhật thanh toán phiếu sửa chữa";
  }
  if (partsChanged && !permissions.canUpdateWorkOrderParts) {
    return "Bạn không có quyền sửa phụ tùng trong phiếu sửa chữa";
  }
  if (laborChanged && !permissions.canUpdateWorkOrderLabor) {
    return "Bạn không có quyền sửa tiền công (labor) phiếu sửa chữa";
  }
  if (discountChanged && !permissions.canUpdateWorkOrderDiscount) {
    return "Bạn không có quyền sửa giảm giá phiếu sửa chữa";
  }
  if (customerChanged && !permissions.canUpdateWorkOrderCustomer) {
    return "Bạn không có quyền sửa thông tin khách hàng trong phiếu sửa chữa";
  }
  if (vehicleChanged && !permissions.canUpdateWorkOrderVehicle) {
    return "Bạn không có quyền sửa thông tin thiết bị trong phiếu sửa chữa";
  }
  if (outsourceServicesChanged && !permissions.canUpdateWorkOrderOutsourceService) {
    return "Bạn không có quyền tạo/sửa dịch vụ gia công ngoài";
  }

  return null;
}
