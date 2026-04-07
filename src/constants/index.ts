/**
 * Application Constants
 *
 * Centralized constants to avoid magic strings throughout the codebase.
 * Import from '@/constants' for clean access.
 */

// =============================================================================
// USER ROLES
// =============================================================================

/** Available user roles in the system */
export const USER_ROLES = {
  OWNER: "owner",
  MANAGER: "manager",
  STAFF: "staff",
} as const;

export type UserRole = (typeof USER_ROLES)[keyof typeof USER_ROLES];

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  [USER_ROLES.OWNER]: "Chủ cửa hàng",
  [USER_ROLES.MANAGER]: "Quản lý",
  [USER_ROLES.STAFF]: "Nhân viên",
};

// =============================================================================
// WORK ORDER STATUS
// =============================================================================

/** Work order statuses */
export const WORK_ORDER_STATUS = {
  RECEIVED: "Tiếp nhận",
  IN_PROGRESS: "Đang sửa",
  COMPLETED: "Đã sửa xong",
  DELIVERED: "Trả máy",
} as const;

export type WorkOrderStatus =
  (typeof WORK_ORDER_STATUS)[keyof typeof WORK_ORDER_STATUS];

export const WORK_ORDER_STATUS_COLORS: Record<WorkOrderStatus, string> = {
  [WORK_ORDER_STATUS.RECEIVED]: "bg-yellow-100 text-yellow-800",
  [WORK_ORDER_STATUS.IN_PROGRESS]: "bg-blue-100 text-blue-800",
  [WORK_ORDER_STATUS.COMPLETED]: "bg-green-100 text-green-800",
  [WORK_ORDER_STATUS.DELIVERED]: "bg-gray-100 text-gray-800",
};

// =============================================================================
// PAYMENT METHODS
// =============================================================================

/** Payment methods */
export const PAYMENT_METHOD = {
  CASH: "cash",
  BANK: "bank",
} as const;

export type PaymentMethod =
  (typeof PAYMENT_METHOD)[keyof typeof PAYMENT_METHOD];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  [PAYMENT_METHOD.CASH]: "Tiền mặt",
  [PAYMENT_METHOD.BANK]: "Chuyển khoản",
};

// =============================================================================
// PAYMENT STATUS
// =============================================================================

/** Payment statuses for work orders */
export const PAYMENT_STATUS = {
  UNPAID: "unpaid",
  PAID: "paid",
  PARTIAL: "partial",
} as const;

export type PaymentStatus =
  (typeof PAYMENT_STATUS)[keyof typeof PAYMENT_STATUS];

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.UNPAID]: "Chưa thanh toán",
  [PAYMENT_STATUS.PAID]: "Đã thanh toán",
  [PAYMENT_STATUS.PARTIAL]: "Thanh toán một phần",
};

export const PAYMENT_STATUS_COLORS: Record<PaymentStatus, string> = {
  [PAYMENT_STATUS.UNPAID]: "bg-red-100 text-red-800",
  [PAYMENT_STATUS.PAID]: "bg-green-100 text-green-800",
  [PAYMENT_STATUS.PARTIAL]: "bg-yellow-100 text-yellow-800",
};

// =============================================================================
// INVENTORY TRANSACTION TYPES
// =============================================================================

/** Inventory transaction types */
export const INVENTORY_TX_TYPE = {
  IMPORT: "Nhập kho",
  EXPORT: "Xuất kho",
} as const;

export type InventoryTxType =
  (typeof INVENTORY_TX_TYPE)[keyof typeof INVENTORY_TX_TYPE];

// =============================================================================
// CASH TRANSACTION CATEGORIES
// =============================================================================

/** Cash transaction categories */
export const CASH_TX_CATEGORY = {
  SALE_INCOME: "sale_income",
  SERVICE_INCOME: "service_income",
  OTHER_INCOME: "other_income",
  INVENTORY_PURCHASE: "inventory_purchase",
  SALARY: "salary",
  LOAN_PAYMENT: "loan_payment",
  DEBT_COLLECTION: "debt_collection",
  DEBT_PAYMENT: "debt_payment",
  SALE_REFUND: "sale_refund",
  OTHER_EXPENSE: "other_expense",
} as const;

export type CashTxCategory =
  (typeof CASH_TX_CATEGORY)[keyof typeof CASH_TX_CATEGORY];

export const CASH_TX_CATEGORY_LABELS: Record<CashTxCategory, string> = {
  [CASH_TX_CATEGORY.SALE_INCOME]: "Thu bán hàng",
  [CASH_TX_CATEGORY.SERVICE_INCOME]: "Thu dịch vụ",
  [CASH_TX_CATEGORY.OTHER_INCOME]: "Thu khác",
  [CASH_TX_CATEGORY.INVENTORY_PURCHASE]: "Mua hàng nhập kho",
  [CASH_TX_CATEGORY.SALARY]: "Chi lương",
  [CASH_TX_CATEGORY.LOAN_PAYMENT]: "Trả nợ vay",
  [CASH_TX_CATEGORY.DEBT_COLLECTION]: "Thu nợ",
  [CASH_TX_CATEGORY.DEBT_PAYMENT]: "Chi trả nợ",
  [CASH_TX_CATEGORY.SALE_REFUND]: "Hoàn tiền bán hàng",
  [CASH_TX_CATEGORY.OTHER_EXPENSE]: "Chi phí khác",
};

// =============================================================================
// EMPLOYEE STATUS
// =============================================================================

/** Employee statuses */
export const EMPLOYEE_STATUS = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  TERMINATED: "terminated",
} as const;

export type EmployeeStatus =
  (typeof EMPLOYEE_STATUS)[keyof typeof EMPLOYEE_STATUS];

export const EMPLOYEE_STATUS_LABELS: Record<EmployeeStatus, string> = {
  [EMPLOYEE_STATUS.ACTIVE]: "Đang làm việc",
  [EMPLOYEE_STATUS.INACTIVE]: "Tạm nghỉ",
  [EMPLOYEE_STATUS.TERMINATED]: "Đã nghỉ việc",
};

// =============================================================================
// CUSTOMER SEGMENT
// =============================================================================

/** Customer segments for CRM */
export const CUSTOMER_SEGMENT = {
  VIP: "VIP",
  LOYAL: "Loyal",
  POTENTIAL: "Potential",
  AT_RISK: "At Risk",
  LOST: "Lost",
  NEW: "New",
} as const;

export type CustomerSegment =
  (typeof CUSTOMER_SEGMENT)[keyof typeof CUSTOMER_SEGMENT];

export const CUSTOMER_SEGMENT_LABELS: Record<CustomerSegment, string> = {
  [CUSTOMER_SEGMENT.VIP]: "VIP",
  [CUSTOMER_SEGMENT.LOYAL]: "Khách quen",
  [CUSTOMER_SEGMENT.POTENTIAL]: "Tiềm năng",
  [CUSTOMER_SEGMENT.AT_RISK]: "Có nguy cơ mất",
  [CUSTOMER_SEGMENT.LOST]: "Đã mất",
  [CUSTOMER_SEGMENT.NEW]: "Khách mới",
};

// =============================================================================
// LOAN TYPES
// =============================================================================

/** Loan types */
export const LOAN_TYPE = {
  BANK: "bank",
  PERSONAL: "personal",
  OTHER: "other",
} as const;

export type LoanType = (typeof LOAN_TYPE)[keyof typeof LOAN_TYPE];

export const LOAN_TYPE_LABELS: Record<LoanType, string> = {
  [LOAN_TYPE.BANK]: "Ngân hàng",
  [LOAN_TYPE.PERSONAL]: "Cá nhân",
  [LOAN_TYPE.OTHER]: "Khác",
};

// =============================================================================
// LOAN STATUS
// =============================================================================

/** Loan statuses */
export const LOAN_STATUS = {
  ACTIVE: "active",
  PAID: "paid",
  OVERDUE: "overdue",
} as const;

export type LoanStatus = (typeof LOAN_STATUS)[keyof typeof LOAN_STATUS];

export const LOAN_STATUS_LABELS: Record<LoanStatus, string> = {
  [LOAN_STATUS.ACTIVE]: "Đang vay",
  [LOAN_STATUS.PAID]: "Đã trả hết",
  [LOAN_STATUS.OVERDUE]: "Quá hạn",
};

// =============================================================================
// FIXED ASSET TYPES
// =============================================================================

/** Fixed asset types */
export const ASSET_TYPE = {
  EQUIPMENT: "equipment",
  VEHICLE: "vehicle",
  BUILDING: "building",
  FURNITURE: "furniture",
  OTHER: "other",
} as const;

export type AssetType = (typeof ASSET_TYPE)[keyof typeof ASSET_TYPE];

export const ASSET_TYPE_LABELS: Record<AssetType, string> = {
  [ASSET_TYPE.EQUIPMENT]: "Thiết bị",
  [ASSET_TYPE.VEHICLE]: "Phương tiện",
  [ASSET_TYPE.BUILDING]: "Nhà cửa",
  [ASSET_TYPE.FURNITURE]: "Nội thất",
  [ASSET_TYPE.OTHER]: "Khác",
};

// =============================================================================
// CAPITAL TYPES
// =============================================================================

/** Capital/investment types */
export const CAPITAL_TYPE = {
  OWNER: "owner",
  INVESTOR: "investor",
  LOAN: "loan",
} as const;

export type CapitalType = (typeof CAPITAL_TYPE)[keyof typeof CAPITAL_TYPE];

export const CAPITAL_TYPE_LABELS: Record<CapitalType, string> = {
  [CAPITAL_TYPE.OWNER]: "Vốn chủ sở hữu",
  [CAPITAL_TYPE.INVESTOR]: "Nhà đầu tư",
  [CAPITAL_TYPE.LOAN]: "Vay",
};

// =============================================================================
// TABLE NAMES (for repository layer)
// =============================================================================

/** Supabase table names */
export const TABLES = {
  PARTS: "parts",
  SALES: "sales",
  WORK_ORDERS: "work_orders",
  CUSTOMERS: "customers",
  SUPPLIERS: "suppliers",
  EMPLOYEES: "employees",
  CATEGORIES: "categories",
  INVENTORY_TRANSACTIONS: "inventory_transactions",
  CASH_TRANSACTIONS: "cash_transactions",
  PAYMENT_SOURCES: "payment_sources",
  LOANS: "loans",
  LOAN_PAYMENTS: "loan_payments",
  CAPITAL: "capital",
  FIXED_ASSETS: "fixed_assets",
  CUSTOMER_DEBTS: "customer_debts",
  SUPPLIER_DEBTS: "supplier_debts",
  AUDIT_LOGS: "audit_logs",
  PROFILES: "profiles",
  STORE_SETTINGS: "store_settings",
} as const;

// =============================================================================
// PAGINATION DEFAULTS
// =============================================================================

/** Default pagination settings */
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
} as const;

// =============================================================================
// VALIDATION LIMITS
// =============================================================================

/** Validation limits for forms */
export const LIMITS = {
  MAX_PRICE: 50_000_000, // 50 triệu VND
  MAX_QUANTITY: 10_000,
  MAX_DISCOUNT_PERCENT: 100,
  MIN_PASSWORD_LENGTH: 6,
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_NOTE_LENGTH: 1000,
  PHONE_MIN_LENGTH: 10,
  PHONE_MAX_LENGTH: 11,
} as const;

// =============================================================================
// DATE FORMATS
// =============================================================================

/** Date format patterns */
export const DATE_FORMATS = {
  DISPLAY_SHORT: "DD/MM/YYYY",
  DISPLAY_LONG: "DD/MM/YYYY HH:mm",
  ISO: "YYYY-MM-DDTHH:mm:ss.sssZ",
  MONTH_YEAR: "YYYY-MM",
} as const;

// =============================================================================
// DEFAULT BRANCH
// =============================================================================

/** Default branch ID when not specified */
export const DEFAULT_BRANCH_ID = "CN1";

// =============================================================================
// CURRENCY
// =============================================================================

/** Currency settings */
export const CURRENCY = {
  CODE: "VND",
  LOCALE: "vi-VN",
  SYMBOL: "₫",
} as const;
