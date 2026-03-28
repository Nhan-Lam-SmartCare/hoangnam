/**
 * Maintenance Reminder Utilities
 * Quản lý nhắc nhở bảo dưỡng xe theo số km
 */

import type {
  Vehicle,
  VehicleMaintenances,
  MaintenanceRecord,
  Customer,
} from "../types";

// Chu kỳ bảo dưỡng (km)
export const MAINTENANCE_CYCLES = {
  oilChange: {
    name: "Thay nhớt máy",
    interval: 1500, // 1,000-1,500 km
    warningThreshold: 1000, // Cảnh báo khi còn 500km
    icon: "🛢️",
    color: "orange",
    // Đối với khách mới, cảnh báo sau 1 tháng hoặc 1500km từ lần đầu ghi nhận
    newCustomerGracePeriodDays: 30,
    newCustomerGraceKm: 1500,
  },
  gearboxOil: {
    name: "Thay nhớt hộp số",
    interval: 5000,
    warningThreshold: 4500,
    icon: "⚙️",
    color: "blue",
  },
  throttleClean: {
    name: "Vệ sinh kim phun, họng ga, nồi",
    interval: 20000,
    warningThreshold: 18000,
    icon: "🔧",
    color: "purple",
  },
} as const;

export type MaintenanceType = keyof typeof MAINTENANCE_CYCLES;

export interface MaintenanceWarning {
  type: MaintenanceType;
  name: string;
  icon: string;
  color: string;
  kmSinceLastService: number;
  kmUntilDue: number;
  isOverdue: boolean;
  isDueSoon: boolean;
  lastServiceKm?: number;
  lastServiceDate?: string;
}

export interface VehicleMaintenanceStatus {
  vehicle: Vehicle;
  customer?: Customer;
  warnings: MaintenanceWarning[];
  hasOverdue: boolean;
  hasDueSoon: boolean;
}

/**
 * Kiểm tra xem khách hàng mới có đủ điều kiện nhắc nhở bảo dưỡng chưa
 * Đối với thay nhớt: phải qua 1 tháng HOẶC 1500km từ lần đầu ghi nhận
 */
function shouldShowNewCustomerReminder(
  vehicle: Vehicle,
  maintenanceType: MaintenanceType
): boolean {
  const config = MAINTENANCE_CYCLES[maintenanceType];

  // Nếu không có grace period config (ví dụ: gearboxOil, throttleClean), luôn hiển thị
  if (!("newCustomerGracePeriodDays" in config)) {
    return true;
  }

  const { firstRecordedKm, firstRecordedDate, currentKm } = vehicle;

  // Nếu không có thông tin lần đầu ghi nhận, không hiển thị (chưa đủ dữ liệu)
  if (!firstRecordedKm || !firstRecordedDate || !currentKm) {
    return false;
  }

  const gracePeriodDays = config.newCustomerGracePeriodDays;
  const graceKm = config.newCustomerGraceKm;

  // Tính số ngày từ lần đầu ghi nhận
  const firstDate = new Date(firstRecordedDate);
  const now = new Date();
  const daysSinceFirstRecord = Math.floor(
    (now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Tính số km đã đi từ lần đầu ghi nhận
  const kmSinceFirstRecord = currentKm - firstRecordedKm;

  // Hiển thị cảnh báo nếu: đã qua grace period HOẶC đã đi đủ km
  return (
    daysSinceFirstRecord >= gracePeriodDays || kmSinceFirstRecord >= graceKm
  );
}

/**
 * Kiểm tra tình trạng bảo dưỡng của một xe
 */
export function checkVehicleMaintenance(
  vehicle: Vehicle
): MaintenanceWarning[] {
  const warnings: MaintenanceWarning[] = [];
  const currentKm = vehicle.currentKm || 0;

  if (currentKm === 0) return warnings; // Chưa có dữ liệu km

  const maintenances = vehicle.lastMaintenances || {};

  for (const [type, config] of Object.entries(MAINTENANCE_CYCLES)) {
    const maintenanceType = type as MaintenanceType;
    const lastService = maintenances[maintenanceType];
    const lastServiceKm = lastService?.km || 0;

    // Nếu khách hàng mới (chưa có lịch sử bảo dưỡng cho loại này)
    // kiểm tra xem có đủ điều kiện hiển thị cảnh báo chưa
    const isNewCustomerForThisService = !lastService;
    if (isNewCustomerForThisService) {
      // Kiểm tra grace period cho khách mới
      if (!shouldShowNewCustomerReminder(vehicle, maintenanceType)) {
        continue; // Bỏ qua, chưa đủ điều kiện nhắc nhở
      }

      // Đối với khách mới, tính km từ lần đầu ghi nhận thay vì từ 0
      const baseKm = vehicle.firstRecordedKm || 0;
      const kmSinceFirstRecord = currentKm - baseKm;
      const kmUntilDue = config.interval - kmSinceFirstRecord;

      const isOverdue = kmSinceFirstRecord >= config.interval;
      const isDueSoon =
        kmSinceFirstRecord >= config.warningThreshold && !isOverdue;

      if (isOverdue || isDueSoon) {
        warnings.push({
          type: maintenanceType,
          name: config.name,
          icon: config.icon,
          color: config.color,
          kmSinceLastService: kmSinceFirstRecord,
          kmUntilDue,
          isOverdue,
          isDueSoon,
          lastServiceKm: undefined,
          lastServiceDate: vehicle.firstRecordedDate,
        });
      }
    } else {
      // Khách hàng cũ - logic ban đầu
      const kmSinceLastService = currentKm - lastServiceKm;
      const kmUntilDue = config.interval - kmSinceLastService;

      const isOverdue = kmSinceLastService >= config.interval;
      const isDueSoon =
        kmSinceLastService >= config.warningThreshold && !isOverdue;

      if (isOverdue || isDueSoon) {
        warnings.push({
          type: maintenanceType,
          name: config.name,
          icon: config.icon,
          color: config.color,
          kmSinceLastService,
          kmUntilDue,
          isOverdue,
          isDueSoon,
          lastServiceKm: lastService?.km,
          lastServiceDate: lastService?.date,
        });
      }
    }
  }

  // Sắp xếp: overdue trước, rồi theo km until due
  warnings.sort((a, b) => {
    if (a.isOverdue && !b.isOverdue) return -1;
    if (!a.isOverdue && b.isOverdue) return 1;
    return a.kmUntilDue - b.kmUntilDue;
  });

  return warnings;
}

/**
 * Lấy tất cả xe cần bảo dưỡng từ danh sách khách hàng
 */
export function getVehiclesNeedingMaintenance(
  customers: Customer[]
): VehicleMaintenanceStatus[] {
  const results: VehicleMaintenanceStatus[] = [];

  for (const customer of customers) {
    if (!customer.vehicles || customer.status === "inactive") continue;

    for (const vehicle of customer.vehicles) {
      const warnings = checkVehicleMaintenance(vehicle);

      if (warnings.length > 0) {
        results.push({
          vehicle,
          customer,
          warnings,
          hasOverdue: warnings.some((w) => w.isOverdue),
          hasDueSoon: warnings.some((w) => w.isDueSoon),
        });
      }
    }
  }

  // Sắp xếp: xe có overdue trước
  results.sort((a, b) => {
    if (a.hasOverdue && !b.hasOverdue) return -1;
    if (!a.hasOverdue && b.hasOverdue) return 1;
    return 0;
  });

  return results;
}

/**
 * Kiểm tra xem một dịch vụ có phải là bảo dưỡng không
 * Dựa vào mô tả/tên dịch vụ
 */
export function detectMaintenanceType(
  serviceDescription: string
): MaintenanceType | null {
  const desc = serviceDescription.toLowerCase();

  // Thay nhớt máy
  if (
    desc.includes("nhớt máy") ||
    desc.includes("thay nhớt") ||
    desc.includes("thay dầu") ||
    (desc.includes("nhớt") && !desc.includes("hộp số"))
  ) {
    return "oilChange";
  }

  // Nhớt hộp số
  if (
    desc.includes("nhớt hộp số") ||
    desc.includes("dầu hộp số") ||
    desc.includes("hộp số")
  ) {
    return "gearboxOil";
  }

  // Vệ sinh kim phun, họng ga, nồi
  if (
    desc.includes("kim phun") ||
    desc.includes("họng ga") ||
    desc.includes("vệ sinh nồi") ||
    desc.includes("béc phun") ||
    desc.includes("buồng đốt")
  ) {
    return "throttleClean";
  }

  return null;
}

/**
 * Phát hiện các loại bảo dưỡng từ danh sách phụ tùng và dịch vụ
 */
export function detectMaintenancesFromWorkOrder(
  partsUsed: Array<{ partName: string }>,
  additionalServices: Array<{ description: string }>,
  issueDescription?: string
): MaintenanceType[] {
  const detected = new Set<MaintenanceType>();

  // Kiểm tra từ phụ tùng
  for (const part of partsUsed) {
    const type = detectMaintenanceType(part.partName);
    if (type) detected.add(type);
  }

  // Kiểm tra từ dịch vụ bổ sung
  for (const service of additionalServices) {
    const type = detectMaintenanceType(service.description);
    if (type) detected.add(type);
  }

  // Kiểm tra từ mô tả sự cố
  if (issueDescription) {
    const type = detectMaintenanceType(issueDescription);
    if (type) detected.add(type);
  }

  return Array.from(detected);
}

/**
 * Tạo bản ghi bảo dưỡng mới
 */
export function createMaintenanceRecord(km: number): MaintenanceRecord {
  return {
    km,
    date: new Date().toISOString(),
  };
}

/**
 * Cập nhật lastMaintenances của xe
 */
export function updateVehicleMaintenances(
  vehicle: Vehicle,
  maintenanceTypes: MaintenanceType[],
  currentKm: number
): Vehicle {
  const newMaintenances: VehicleMaintenances = {
    ...vehicle.lastMaintenances,
  };

  const record = createMaintenanceRecord(currentKm);

  for (const type of maintenanceTypes) {
    newMaintenances[type] = record;
  }

  return {
    ...vehicle,
    currentKm,
    lastMaintenances: newMaintenances,
  };
}

/**
 * Format km cho hiển thị
 */
export function formatKm(km: number): string {
  return km.toLocaleString("vi-VN") + " km";
}

/**
 * Lấy màu badge theo mức độ cảnh báo
 */
export function getWarningBadgeColor(warning: MaintenanceWarning): string {
  if (warning.isOverdue) {
    return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
  }
  return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400";
}
