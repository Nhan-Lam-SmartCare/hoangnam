export type UserRole = "owner" | "manager" | "staff";

export type AppAction =
  | "sale.create"
  | "sale.delete"
  | "work_order.create"
  | "work_order.update"
  | "work_order.status.update"
  | "work_order.payment.update"
  | "work_order.parts.update"
  | "work_order.labor.update"
  | "work_order.discount.update"
  | "work_order.customer.update"
  | "work_order.vehicle.update"
  | "work_order.outsource_service.update"
  | "work_order.delete"
  | "work_order.print"
  | "work_order.refund"
  | "work_order.history.view"
  | "inventory.import"
  | "inventory.transfer"
  | "inventory.export_excel"
  | "inventory.import.file"
  | "inventory.history.view"
  | "inventory.barcode.print"
  | "inventory.view_import_price"
  | "inventory.receipt.edit"
  | "inventory.receipt.delete"
  | "part.create"
  | "part.update"
  | "part.update_price"
  | "part.delete"
  | "settings.update"
  | "cashbook.view"
  | "finance.view"
  | "payroll.view"
  | "analytics.view"
  | "reports.view"
  | "employees.view"
  | "debt.view";

export type PermissionMap = Partial<Record<AppAction, boolean>>;

export const APP_ACTION_OPTIONS: Array<{
  key: AppAction;
  label: string;
  group: "sales" | "service" | "inventory" | "finance" | "admin";
}> = [
  { key: "sale.create", label: "Tạo phiếu bán hàng", group: "sales" },
  { key: "sale.delete", label: "Xóa phiếu bán hàng", group: "sales" },
  { key: "work_order.create", label: "Tạo phiếu sửa chữa", group: "service" },
  { key: "work_order.update", label: "Sửa phiếu sửa chữa", group: "service" },
  { key: "work_order.status.update", label: "Đổi trạng thái phiếu sửa chữa", group: "service" },
  { key: "work_order.payment.update", label: "Thu tiền/ghi nhận thanh toán sửa chữa", group: "service" },
  { key: "work_order.parts.update", label: "Sửa phụ tùng/dịch vụ trong phiếu sửa chữa", group: "service" },
  { key: "work_order.labor.update", label: "Sửa tiền công (labor) phiếu sửa chữa", group: "service" },
  { key: "work_order.discount.update", label: "Sửa giảm giá phiếu sửa chữa", group: "service" },
  { key: "work_order.customer.update", label: "Sửa thông tin khách hàng trên phiếu sửa chữa", group: "service" },
  { key: "work_order.vehicle.update", label: "Sửa thông tin thiết bị/xe trên phiếu sửa chữa", group: "service" },
  { key: "work_order.outsource_service.update", label: "Tạo/sửa dịch vụ gia công ngoài", group: "service" },
  { key: "work_order.delete", label: "Xóa phiếu sửa chữa", group: "service" },
  { key: "work_order.print", label: "In phiếu sửa chữa", group: "service" },
  { key: "work_order.refund", label: "Hủy/hoàn tiền phiếu sửa chữa", group: "service" },
  { key: "work_order.history.view", label: "Xem lịch sử sửa chữa", group: "service" },
  { key: "inventory.import", label: "Nhập kho", group: "inventory" },
  { key: "inventory.transfer", label: "Chuyển kho", group: "inventory" },
  { key: "inventory.export_excel", label: "Xuất Excel kho", group: "inventory" },
  { key: "inventory.import.file", label: "Import file kho", group: "inventory" },
  { key: "inventory.history.view", label: "Xem lịch sử nhập kho", group: "inventory" },
  { key: "inventory.barcode.print", label: "In mã vạch", group: "inventory" },
  { key: "inventory.view_import_price", label: "Xem giá nhập", group: "inventory" },
  { key: "inventory.receipt.edit", label: "Sửa phiếu nhập kho", group: "inventory" },
  { key: "inventory.receipt.delete", label: "Xóa phiếu nhập kho", group: "inventory" },
  { key: "part.create", label: "Tạo sản phẩm/phụ tùng", group: "inventory" },
  { key: "part.update", label: "Sửa sản phẩm/phụ tùng", group: "inventory" },
  { key: "part.update_price", label: "Cập nhật giá sản phẩm", group: "inventory" },
  { key: "part.delete", label: "Xóa sản phẩm/phụ tùng", group: "inventory" },
  { key: "debt.view", label: "Xem công nợ", group: "finance" },
  { key: "cashbook.view", label: "Xem sổ quỹ", group: "finance" },
  { key: "finance.view", label: "Xem tài chính", group: "finance" },
  { key: "payroll.view", label: "Xem bảng lương", group: "finance" },
  { key: "analytics.view", label: "Xem phân tích", group: "finance" },
  { key: "reports.view", label: "Xem báo cáo", group: "admin" },
  { key: "employees.view", label: "Xem/quản lý nhân viên", group: "admin" },
  { key: "settings.update", label: "Chỉnh sửa cài đặt hệ thống", group: "admin" },
];

const POLICIES: Record<AppAction, UserRole[]> = {
  // Staff có thể tạo sale và work order
  "sale.create": ["owner", "manager", "staff"],
  "sale.delete": ["owner", "manager"],
  "work_order.create": ["owner", "manager", "staff"],
  "work_order.update": ["owner", "manager", "staff"],
  "work_order.status.update": ["owner", "manager", "staff"],
  "work_order.payment.update": ["owner", "manager"],
  "work_order.parts.update": ["owner", "manager", "staff"],
  "work_order.labor.update": ["owner", "manager", "staff"],
  "work_order.discount.update": ["owner", "manager"],
  "work_order.customer.update": ["owner", "manager", "staff"],
  "work_order.vehicle.update": ["owner", "manager", "staff"],
  "work_order.outsource_service.update": ["owner", "manager"],
  "work_order.delete": ["owner", "manager"],
  "work_order.print": ["owner", "manager", "staff"],
  "work_order.refund": ["owner", "manager"],
  "work_order.history.view": ["owner", "manager", "staff"],
  // Nhập kho, quản lý sản phẩm - chỉ owner/manager
  "inventory.import": ["owner", "manager"],
  "inventory.transfer": ["owner", "manager"],
  "inventory.export_excel": ["owner", "manager"],
  "inventory.import.file": ["owner", "manager"],
  "inventory.history.view": ["owner", "manager"],
  "inventory.barcode.print": ["owner", "manager"],
  "inventory.view_import_price": ["owner", "manager"],
  "inventory.receipt.edit": ["owner", "manager"],
  "inventory.receipt.delete": ["owner", "manager"],
  "part.create": ["owner", "manager"],
  "part.update": ["owner", "manager"],
  "part.update_price": ["owner", "manager"],
  "part.delete": ["owner", "manager"],
  // Settings & Finance
  "settings.update": ["owner", "manager"],
  "cashbook.view": ["owner", "manager"],
  "finance.view": ["owner", "manager"],
  "payroll.view": ["owner", "manager"],
  "analytics.view": ["owner", "manager"],
  "reports.view": ["owner", "manager"],
  "employees.view": ["owner", "manager"],
  "debt.view": ["owner", "manager"],
};

type RoleOrProfileLike =
  | UserRole
  | {
      role?: UserRole;
      permissions?: PermissionMap;
      custom_permissions?: PermissionMap;
      permission_overrides?: PermissionMap;
    }
  | undefined
  | null;

const isObject = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null;

export function normalizePermissionMap(input: unknown): PermissionMap {
  if (!isObject(input)) return {};

  return APP_ACTION_OPTIONS.reduce<PermissionMap>((acc, item) => {
    const raw = (input as Record<string, any>)[item.key];
    if (typeof raw === "boolean") {
      acc[item.key] = raw;
    }
    return acc;
  }, {});
}

const getRoleAndPermissions = (
  roleOrProfile: RoleOrProfileLike
): { role?: UserRole; permissions: PermissionMap } => {
  if (!roleOrProfile) return { role: undefined, permissions: {} };

  if (typeof roleOrProfile === "string") {
    return { role: roleOrProfile, permissions: {} };
  }

  return {
    role: roleOrProfile.role,
    permissions: {
      ...normalizePermissionMap(roleOrProfile.permission_overrides),
      ...normalizePermissionMap(roleOrProfile.custom_permissions),
      ...normalizePermissionMap(roleOrProfile.permissions),
    },
  };
};

export function canDo(roleOrProfile: RoleOrProfileLike, action: AppAction): boolean {
  const { role, permissions } = getRoleAndPermissions(roleOrProfile);
  if (!role) return false;

  if (typeof permissions[action] === "boolean") {
    return permissions[action] as boolean;
  }

  return POLICIES[action].includes(role);
}
