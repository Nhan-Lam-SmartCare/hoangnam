export const CASH_TX_CATEGORY_LABELS_VI: Record<string, string> = {
  // Thu
  sale_income: "Bán hàng",
  service_income: "Dịch vụ",
  other_income: "Thu khác",
  debt_collection: "Thu nợ khách hàng",
  service_deposit: "Đặt cọc dịch vụ",
  employee_advance_repayment: "Hoàn ứng/Thu hồi tạm ứng",
  general_income: "Thu chung",

  // Chi
  inventory_purchase: "Mua hàng",
  supplier_payment: "Chi trả nhà cung cấp",
  debt_payment: "Trả nợ nhà cung cấp",
  salary: "Lương nhân viên",
  employee_advance: "Ứng lương",
  loan_payment: "Trả nợ vay",
  rent: "Tiền thuê mặt bằng",
  utilities: "Điện nước",
  outsourcing: "Gia công ngoài",
  service_cost: "Giá vốn dịch vụ",
  sale_refund: "Hoàn tiền/Hoàn trả",
  other_expense: "Chi khác",
  general_expense: "Chi chung",
};

function normalizeForLookup(input: string): string {
  return input
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

const CATEGORY_ALIASES_TO_CANONICAL: Record<string, string> = {
  // Canonical keys (self)
  sale_income: "sale_income",
  service_income: "service_income",
  other_income: "other_income",
  debt_collection: "debt_collection",
  service_deposit: "service_deposit",
  employee_advance_repayment: "employee_advance_repayment",
  general_income: "general_income",

  inventory_purchase: "inventory_purchase",
  supplier_payment: "supplier_payment",
  debt_payment: "debt_payment",
  salary: "salary",
  employee_advance: "employee_advance",
  loan_payment: "loan_payment",
  rent: "rent",
  utilities: "utilities",
  outsourcing: "outsourcing",
  service_cost: "service_cost",
  sale_refund: "sale_refund",
  other_expense: "other_expense",
  general_expense: "general_expense",

  // Vietnamese common (no diacritics)
  banhang: "sale_income",
  "tien ban hang": "sale_income",
  dichvu: "service_income",
  "tien dich vu": "service_income",
  thukhac: "other_income",
  "thu khac": "other_income",
  "thu no": "debt_collection",
  "thu no khach hang": "debt_collection",
  "dat coc": "service_deposit",
  "dat coc dich vu": "service_deposit",

  // English legacy
  deposit: "service_deposit",

  // Employee advance repayment
  "hoan ung": "employee_advance_repayment",
  "thu hoi tam ung": "employee_advance_repayment",
  "thu chung": "general_income",

  "mua hang": "inventory_purchase",
  "nhap hang": "inventory_purchase",
  "nhap kho": "inventory_purchase",
  "chi tra ncc": "supplier_payment",
  "chi tra nha cung cap": "supplier_payment",
  "tra no nha cung cap": "debt_payment",
  luong: "salary",
  "luong nhan vien": "salary",
  "ung luong": "employee_advance",
  "tra no vay": "loan_payment",
  "tien thue mat bang": "rent",
  "dien nuoc": "utilities",
  "gia cong": "outsourcing",
  "gia cong ngoai": "outsourcing",
  "gia von dich vu": "service_cost",
  "hoan tien": "sale_refund",
  "hoan tra": "sale_refund",
  "chi khac": "other_expense",
  "chi chung": "general_expense",
};

/**
 * Canonicalize category string for persistence in Motocare.
 * - If it matches a known alias/key -> return canonical key
 * - If unknown -> return original trimmed string (do NOT lowercase/mutate)
 */
export function canonicalizeMotocareCashTxCategory(
  input?: string | null
): string | undefined {
  if (input == null) return undefined;
  const trimmed = String(input).trim();
  if (!trimmed) return undefined;

  const normalized = normalizeForLookup(trimmed);
  const canonical = CATEGORY_ALIASES_TO_CANONICAL[normalized];
  return canonical || trimmed;
}

export function getCashTxCategoryKey(input?: string | null): string {
  return canonicalizeMotocareCashTxCategory(input) || "";
}

/**
 * Display label in Vietnamese when possible.
 * If unknown category -> display the original text (legacy-safe).
 */
export function formatCashTxCategory(input?: string | null): string {
  if (input == null) return "";
  const raw = String(input).trim();
  if (!raw) return "";

  const key = canonicalizeMotocareCashTxCategory(raw) || raw;
  return CASH_TX_CATEGORY_LABELS_VI[key] || raw;
}
