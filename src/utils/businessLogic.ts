import { WorkOrder } from "../types";

/**
 * Phân tích doanh thu từ phiếu sửa chữa để tính thuế HKD
 * Thuế HKD:
 * - Hàng hóa (phụ tùng): 1.5% (1% VAT + 0.5% TNCN)
 * - Dịch vụ (công thợ): 4.5% (3% VAT + 1.5% TNCN)
 */
export function calculateTaxHKD(
  partsTotal: number,
  serviceTotal: number
): {
  partsTaxRate: number;
  serviceTaxRate: number;
  partsTaxValue: number;
  serviceTaxValue: number;
  totalTax: number;
} {
  const partsTaxRate = 0.015; // 1.5%
  const serviceTaxRate = 0.045; // 4.5%

  const partsTaxValue = partsTotal * partsTaxRate;
  const serviceTaxValue = serviceTotal * serviceTaxRate;

  return {
    partsTaxRate,
    serviceTaxRate,
    partsTaxValue,
    serviceTaxValue,
    totalTax: partsTaxValue + serviceTaxValue,
  };
}

/**
 * Bóc tách doanh thu hàng hóa và dịch vụ từ phiếu sửa chữa.
 * Ưu tiên bóc tách dựa trên tổng tiền partsUsed và tổng tiền workOrder.
 */
export function splitWorkOrderRevenue(order: Partial<WorkOrder>): {
  partsRevenue: number;
  serviceRevenue: number;
} {
  const total = order.total || 0;

  // Tính tổng phụ tùng
  let partsRawTotal = 0;
  if (Array.isArray(order.partsUsed)) {
    for (const part of order.partsUsed) {
      const qty = Math.max(0, Number(part.quantity || 0));
      const anyPart = part as any;
      const unitPriceRaw =
        anyPart.price ??
        anyPart.retailPrice ??
        anyPart.retailprice ??
        anyPart.retail_price ??
        anyPart.unitPrice ??
        anyPart.unit_price ??
        0;
      const price = Math.max(0, Number(unitPriceRaw));
      partsRawTotal += qty * price;
    }
  }

  // Tính tổng dịch vụ/công thợ (laborCost/laborTotal + additionalServices)
  const laborRaw = Number(order.laborCost ?? order.laborTotal ?? 0);
  let additionalServicesRaw = 0;
  if (Array.isArray(order.additionalServices)) {
    for (const s of order.additionalServices) {
      additionalServicesRaw += (Number(s.price) || 0) * (Number(s.quantity || 1) || 0);
    }
  }
  const serviceRawTotal = laborRaw + additionalServicesRaw;

  const rawSum = partsRawTotal + serviceRawTotal;

  let partsRevenue = partsRawTotal;
  let serviceRevenue = serviceRawTotal;

  if (total < rawSum) {
    // Trường hợp có discount: phân bổ tỷ lệ phần trăm
    if (rawSum > 0) {
      partsRevenue = total * (partsRawTotal / rawSum);
      serviceRevenue = total * (serviceRawTotal / rawSum);
    } else {
      partsRevenue = 0;
      serviceRevenue = total;
    }
  } else {
    // Trường hợp không có discount hoặc có thặng dư: giữ nguyên giá trị phụ tùng, phần thặng dư đưa vào dịch vụ
    partsRevenue = partsRawTotal;
    serviceRevenue = total - partsRawTotal;
  }

  // Làm tròn 2 chữ số thập phân để tránh sai lệch số thực
  partsRevenue = Math.round(partsRevenue * 100) / 100;
  serviceRevenue = Math.round(serviceRevenue * 100) / 100;

  return { partsRevenue, serviceRevenue };
}

/**
 * Tính phần trăm chia sẻ cho thợ từ doanh thu dịch vụ.
 */
export function calculateWorkerShare(
  laborAmount: number,
  workerSharePercent: number
): number {
  if (laborAmount <= 0) return 0;
  const percent = Math.min(100, Math.max(0, workerSharePercent));
  return (laborAmount * percent) / 100;
}

/**
 * Đánh giá tình trạng khách hàng theo số tháng chưa quay lại
 */
export function classifyCustomer(
  lastVisitDate: Date | null | undefined,
  currentDate: Date = new Date()
): "Mới" | "Thường Xuyên" | "Sắp Mất" | "Đã Mất" {
  if (!lastVisitDate) return "Mới";

  const diffMs = currentDate.getTime() - lastVisitDate.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  const diffMonths = diffDays / 30;

  if (diffMonths <= 3) return "Thường Xuyên";
  if (diffMonths <= 6) return "Sắp Mất";
  return "Đã Mất";
}

/**
 * Tính tồn kho khả dụng mới sau khi xuất bán
 */
export function calculateNewStockAfterSale(
  currentStock: number,
  quantitySold: number,
  lowStockThreshold: number = 3
): { nextStock: number; hasWarning: boolean; isNegative: boolean } {
  const next = currentStock - quantitySold;
  return {
    nextStock: next,
    hasWarning: next <= lowStockThreshold,
    isNegative: next < 0,
  };
}
