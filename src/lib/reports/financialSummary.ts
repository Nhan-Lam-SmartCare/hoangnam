export const REPORTS_EXCLUDED_INCOME_CATEGORIES = [
  "service",
  "dịch vụ",
  "sale_income",
  "bán hàng",
  "service_income",
  "service_deposit",
  // Hoàn ứng/thu hồi tạm ứng là luân chuyển nội bộ, không phải doanh thu
  "employee_advance_repayment",
] as const;

export const REPORTS_EXCLUDED_EXPENSE_CATEGORIES = [
  "supplier_payment",
  "nhập kho",
  "nhập hàng",
  "mua hàng",
  "mua hang",
  "inventory_purchase",
  "goods_receipt",
  "import",
  "refund",
  "sale_refund",
  "loan_payment",
  "debt_payment",
] as const;

function normalizeCategory(category: string | null | undefined): string {
  return (category || "")
    .toLowerCase()
    .normalize("NFC")
    .replace(/\u200b/g, "")
    .trim();
}

function canonicalizeCategory(category: string | null | undefined): string {
  const normalized = normalizeCategory(category);
  if (!normalized) return "";

  // Map common Vietnamese labels / legacy codes to canonical category keys.
  // This keeps accounting consistent even when the UI/DB stores human labels.
  const aliases: Record<string, string> = {
    // Inventory / supplier payments (NOT operating expenses)
    "chi trả ncc": "supplier_payment",
    "chi tra ncc": "supplier_payment",
    "chi trả nhà cung cấp": "supplier_payment",
    "chi tra nha cung cap": "supplier_payment",
    "trả nhà cung cấp": "supplier_payment",
    "tra nha cung cap": "supplier_payment",
    "trả ncc": "supplier_payment",
    "tra ncc": "supplier_payment",

    "nhập kho": "inventory_purchase",
    "nhap kho": "inventory_purchase",
    "nhập hàng": "inventory_purchase",
    "nhap hang": "inventory_purchase",
    "mua hàng": "inventory_purchase",
    "mua hang": "inventory_purchase",
    "mua hàng hóa": "inventory_purchase",
    "mua hang hoa": "inventory_purchase",
    "phiếu nhập": "goods_receipt",
    "phieu nhap": "goods_receipt",
    "nhập": "import",
    "nhap": "import",

    // Outsourcing / service costs (operating expenses)
    "chi gia công": "outsourcing",
    "chi gia cong": "outsourcing",
    "gia công": "outsourcing",
    "gia cong": "outsourcing",
    "outsourcing_expense": "outsourcing",

    "chi phí dịch vụ": "service_cost",
    "chi phi dich vu": "service_cost",
    "dịch vụ gia công": "service_cost",
    "dich vu gia cong": "service_cost",

    // Refunds (treated as negative revenue in P&L)
    "hoàn tiền": "refund",
    "hoan tien": "refund",
    "hoàn trả": "refund",
    "hoan tra": "refund",
    "sale_refund": "refund",

    // Deposits (exclude from revenue to avoid double counting)
    "deposit": "service_deposit",
    "đặt cọc": "service_deposit",
    "dat coc": "service_deposit",
    "đặt cọc dịch vụ": "service_deposit",
    "dat coc dich vu": "service_deposit",

    // Employee advance repayment (internal transfer)
    "hoàn ứng": "employee_advance_repayment",
    "hoan ung": "employee_advance_repayment",
    "thu hồi tạm ứng": "employee_advance_repayment",
    "thu hoi tam ung": "employee_advance_repayment",
    "employee_advance_repayment": "employee_advance_repayment",
  };

  return aliases[normalized] || normalized;
}

function isRefundCategory(category: string | null | undefined): boolean {
  return canonicalizeCategory(category) === "refund";
}

export function isExcludedIncomeCategory(category: string | null | undefined): boolean {
  const canonical = canonicalizeCategory(category);
  if (!canonical) return false;
  return REPORTS_EXCLUDED_INCOME_CATEGORIES.some((c) => c === canonical);
}

export function isExcludedExpenseCategory(category: string | null | undefined): boolean {
  const canonical = canonicalizeCategory(category);
  if (!canonical) return false;
  return REPORTS_EXCLUDED_EXPENSE_CATEGORIES.some((c) => c === canonical);
}

export function isPaidWorkOrder(wo: any): boolean {
  const statusRaw = wo?.paymentStatus ?? wo?.paymentstatus;
  const status = String(statusRaw || "").toLowerCase();
  if (status === "paid" || status === "partial") return true;

  const totalPaid = Number(wo?.totalPaid ?? wo?.totalpaid ?? 0);
  return totalPaid > 0;
}

export function getWorkOrderAccountingDate(wo: any): Date | null {
  const paymentDateRaw = wo?.paymentDate ?? wo?.paymentdate;
  const creationDateRaw = wo?.creationDate ?? wo?.creationdate;
  const raw = paymentDateRaw || creationDateRaw;
  if (!raw) return null;

  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

export function getWorkOrderAdditionalServices(wo: any): any[] {
  const servicesFromCamelCase = wo?.additionalServices;
  const servicesFromLowercase = wo?.additionalservices;
  const servicesFromSnakeCase = wo?.additional_services;

  if (Array.isArray(servicesFromCamelCase) && servicesFromCamelCase.length > 0) return servicesFromCamelCase;
  if (Array.isArray(servicesFromLowercase) && servicesFromLowercase.length > 0) return servicesFromLowercase;
  if (Array.isArray(servicesFromSnakeCase) && servicesFromSnakeCase.length > 0) return servicesFromSnakeCase;
  return [];
}

export function buildPartsCostMap(parts: any[], branchId: string | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  (parts || []).forEach((part: any) => {
    const costPrice = part?.costPrice?.[branchId as any] ?? part?.costPrice ?? 0;
    const cost = Number(costPrice) || 0;
    if (part?.id) map.set(part.id, cost);
    if (part?.sku) map.set(part.sku, cost);
  });
  return map;
}

export function getPartCost(
  partsCostMap: Map<string, number>,
  partId: string | undefined,
  sku: string | undefined,
  fallbackCost: number
): number {
  if (fallbackCost && fallbackCost > 0) return fallbackCost;
  if (partId && partsCostMap.has(partId)) return partsCostMap.get(partId) || 0;
  if (sku && partsCostMap.has(sku)) return partsCostMap.get(sku) || 0;
  return 0;
}

function isDateInRange(d: Date | null, start: Date, end: Date): boolean {
  if (!d) return false;
  return d >= start && d <= end;
}

export type FinancialSummary = {
  filteredSales: any[];
  filteredWorkOrders: any[];

  salesRevenue: number;
  salesCost: number;
  salesGrossProfit: number;

  woRevenue: number;
  woCost: number;
  woGrossProfit: number;

  totalRevenue: number; // sales + workOrders
  totalCost: number;
  totalProfit: number; // gross profit

  cashIncome: number; // other income (excluded categories removed)
  cashExpense: number; // other expense (excluded categories removed)

  combinedRevenue: number; // totalRevenue + cashIncome
  netProfit: number; // totalProfit + cashIncome - cashExpense

  salesCount: number;
  workOrdersCount: number;
  orderCount: number;
};

export function calculateFinancialSummary(params: {
  sales: any[];
  workOrders: any[];
  parts: any[];
  cashTransactions: any[];
  branchId: string | null | undefined;
  start: Date;
  end: Date;
}): FinancialSummary {
  const {
    sales,
    workOrders,
    parts,
    cashTransactions,
    branchId,
    start,
    end,
  } = params;

  const partsCostMap = buildPartsCostMap(parts, branchId);

  const filteredSales = (sales || []).filter((sale: any) => {
    const saleDate = new Date(sale?.date);
    return !Number.isNaN(saleDate.getTime()) && saleDate >= start && saleDate <= end;
  });

  const filteredWorkOrders = (workOrders || []).filter((wo: any) => {
    const woDate = getWorkOrderAccountingDate(wo);
    return isDateInRange(woDate, start, end) && isPaidWorkOrder(wo);
  });

  const salesRevenue = filteredSales.reduce((sum: number, sale: any) => sum + (Number(sale?.total) || 0), 0);
  const salesCost = filteredSales.reduce((sum: number, sale: any) => {
    const items = sale?.items || [];
    const cost = (Array.isArray(items) ? items : []).reduce((itemSum: number, item: any) => {
      if (item?.isService) return itemSum;

      const rawCost = item?.costPrice ?? item?.costprice ?? item?.cost_price ?? item?.giaNhap ?? item?.gia_nhap;
      const fallbackCost = Number(rawCost) || 0;
      const unitCost = getPartCost(partsCostMap, item?.partId, item?.sku, fallbackCost);
      return itemSum + (unitCost * (Number(item?.quantity) || 0));
    }, 0);

    return sum + cost;
  }, 0);
  const salesGrossProfit = salesRevenue - salesCost;

  const woRevenue = filteredWorkOrders.reduce((sum: number, wo: any) => {
    return sum + (Number(wo?.totalPaid ?? wo?.totalpaid ?? wo?.total) || 0);
  }, 0);

  const woCost = filteredWorkOrders.reduce((sum: number, wo: any) => {
    const partsUsed = wo?.partsUsed || wo?.partsused || [];
    const partsCost = (Array.isArray(partsUsed) ? partsUsed : []).reduce((c: number, p: any) => {
      const rawCost = p?.costPrice ?? p?.costprice ?? p?.cost_price ?? p?.giaNhap ?? p?.gia_nhap;
      const fallbackCost = Number(rawCost) || 0;
      const unitCost = getPartCost(partsCostMap, p?.partId ?? p?.partid, p?.sku, fallbackCost);
      return c + (unitCost * (Number(p?.quantity) || 0));
    }, 0);

    // IMPORTANT: Outsourcing/service costs should be recorded via cash expense vouchers
    // (e.g. category 'outsourcing'/'service_cost') to avoid double counting.
    return sum + partsCost;
  }, 0);

  const woGrossProfit = woRevenue - woCost;

  const totalRevenue = salesRevenue + woRevenue;
  const totalCost = salesCost + woCost;
  const totalProfit = totalRevenue - totalCost;

  const periodCashTx = (cashTransactions || []).filter((tx: any) => {
    const txDate = new Date(tx?.date);
    return !Number.isNaN(txDate.getTime()) && txDate >= start && txDate <= end;
  });

  // Accounting option A: refunds reduce revenue (contra-revenue), not operating expense.
  // We treat expense transactions in refund categories as negative revenue.
  const refundAmount = periodCashTx
    .filter((tx: any) => tx?.type === "expense" && (Number(tx?.amount) || 0) > 0 && isRefundCategory(tx?.category))
    .reduce((sum: number, tx: any) => sum + (Number(tx?.amount) || 0), 0);

  const cashIncome = periodCashTx
    .filter((tx: any) => tx?.type === "income" && !isExcludedIncomeCategory(tx?.category))
    .reduce((sum: number, tx: any) => sum + (Number(tx?.amount) || 0), 0);

  const cashExpense = periodCashTx
    .filter((tx: any) => tx?.type === "expense" && (Number(tx?.amount) || 0) > 0 && !isExcludedExpenseCategory(tx?.category))
    .reduce((sum: number, tx: any) => sum + (Number(tx?.amount) || 0), 0);

  const combinedRevenue = totalRevenue + cashIncome - refundAmount;
  const netProfit = totalProfit + cashIncome - refundAmount - cashExpense;

  return {
    filteredSales,
    filteredWorkOrders,

    salesRevenue,
    salesCost,
    salesGrossProfit,

    woRevenue,
    woCost,
    woGrossProfit,

    totalRevenue,
    totalCost,
    totalProfit,

    cashIncome,
    cashExpense,

    combinedRevenue,
    netProfit,

    salesCount: filteredSales.length,
    workOrdersCount: filteredWorkOrders.length,
    orderCount: filteredSales.length + filteredWorkOrders.length,
  };
}
