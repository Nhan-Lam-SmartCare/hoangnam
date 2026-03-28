import type { UserRole } from "../contexts/AuthContext";

export type AppAction =
  | "sale.create"
  | "sale.delete"
  | "work_order.create"
  | "work_order.delete"
  | "inventory.import"
  | "part.create"
  | "part.update_price"
  | "part.delete"
  | "settings.update"
  | "finance.view"
  | "payroll.view"
  | "analytics.view"
  | "reports.view"
  | "employees.view"
  | "debt.view";

const POLICIES: Record<AppAction, UserRole[]> = {
  // Staff có thể tạo sale và work order
  "sale.create": ["owner", "manager", "staff"],
  "sale.delete": ["owner", "manager"],
  "work_order.create": ["owner", "manager", "staff"],
  "work_order.delete": ["owner", "manager"],
  // Nhập kho, quản lý sản phẩm - chỉ owner/manager
  "inventory.import": ["owner", "manager"],
  "part.create": ["owner", "manager"],
  "part.update_price": ["owner", "manager"],
  "part.delete": ["owner", "manager"],
  // Settings & Finance
  "settings.update": ["owner", "manager"],
  "finance.view": ["owner", "manager"],
  "payroll.view": ["owner", "manager"],
  "analytics.view": ["owner", "manager"],
  "reports.view": ["owner", "manager", "staff"],
  "employees.view": ["owner", "manager"],
  "debt.view": ["owner", "manager"],
};

export function canDo(role: UserRole | undefined, action: AppAction): boolean {
  if (!role) return false;
  return POLICIES[action].includes(role);
}
