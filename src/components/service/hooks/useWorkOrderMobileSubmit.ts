/**
 * Phase 7: unified mobile submit pipeline.
 *
 * Everything that used to live in ServiceManager.handleMobileSave now lives
 * here, so the mobile form hook saves through the same layer as desktop
 * (useWorkOrderSave → saveWorkOrder) instead of delegating upward via onSave.
 *
 * Responsibilities (behavior-preserving move from ServiceManager):
 *  - ownership guard (staff can only edit own orders)
 *  - required-field validation (name/phone) with early return, modal stays open
 *  - vehicle → customer record sync (new vehicle added during work order)
 *  - paymentStatus derivation (requirePositiveTotal — ServiceManager quirk)
 *  - saveWorkOrderAsync (atomic path; repair sync/debt/stock handled inside)
 *  - cash ledger recording + context cash/payment-source mutation
 *  - fire-and-forget background tasks: vehicle km/maintenance, notification,
 *    customer stats
 *  - query invalidation
 */
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../../contexts/AuthContext";
import { useAppContext } from "../../../contexts/AppContext";
import { useWorkOrderSave } from "../../../hooks/useWorkOrderSave";
import { derivePaymentStatus } from "../../../lib/services/workOrderCalculations";
import { recordWorkOrderPaymentTransactions } from "../../../lib/repository/workOrdersRepository";
import { createNotification } from "../../../lib/repository/notificationsRepository";
import {
  getCustomerStatsByPhone,
  updateCustomerStats,
} from "../../../lib/repository/customersRepository";
import {
  detectMaintenancesFromWorkOrder,
  updateVehicleMaintenances,
} from "../../../utils/maintenanceReminder";
import { formatCurrency } from "../../../utils/format";
import { showToast } from "../../../utils/toast";
import type { Customer, Employee, WorkOrder } from "../../../types";
import type { StoreSettings } from "../types/service.types";

export interface MobileWorkOrderSaveData {
  status: string;
  customer: Customer;
  vehicle?: { id?: string; model?: string; licensePlate?: string } | null;
  currentKm?: number;
  issueDescription?: string;
  devicePhotos?: string[];
  technicianId?: string;
  parts?: Array<{ partName: string; [key: string]: unknown }>;
  additionalServices?: Array<{ description: string; [key: string]: unknown }>;
  repairServices?: unknown[];
  laborCost?: number;
  discount?: number;
  total?: number;
  depositAmount?: number;
  paymentMethod?: string;
  totalPaid?: number;
  remainingAmount?: number;
}

export interface UseWorkOrderMobileSubmitParams {
  currentBranchId: string;
  customers: Customer[];
  employees: Employee[];
  editingOrder?: WorkOrder | null;
  storeSettings?: StoreSettings | null;
  upsertCustomer?: (customer: any) => void;
  /** Ownership guard — ServiceManager's canModifyOrder. Omit = allow. */
  canModifyWorkOrder?: (order: WorkOrder) => boolean;
}

export interface MobileSubmitResult {
  /** false = validation stopped the save (modal must stay open). */
  saved: boolean;
  order?: WorkOrder;
}

export function useWorkOrderMobileSubmit(params: UseWorkOrderMobileSubmitParams) {
  const {
    currentBranchId,
    customers,
    employees,
    editingOrder,
    storeSettings,
    upsertCustomer,
    canModifyWorkOrder,
  } = params;

  const queryClient = useQueryClient();
  const { profile } = useAuth();
  const { setCashTransactions, setPaymentSources } = useAppContext();
  const { mutateAsync: saveWorkOrderAsync } = useWorkOrderSave(
    (upsertCustomer || (() => {})) as (customer: any) => Promise<any>
  );

  // Helper: Create notification when work order is created (moved from ServiceManager)
  const createWorkOrderNotification = async (
    orderId: string,
    customerName: string,
    vehicleModel: string,
    licensePlate: string,
    total: number,
    createdByName: string
  ) => {
    try {
      const res = await createNotification({
        type: "work_order",
        title: "Phiếu sửa chữa mới",
        message: `${createdByName} tạo phiếu ${orderId} - ${customerName} (${licensePlate || vehicleModel}) - ${formatCurrency(total)}`,
        data: {
          workOrderId: orderId,
          customerName,
          vehicleModel,
          licensePlate,
          total,
          createdBy: createdByName,
        },
        createdBy: profile?.id || null,
        recipientRole: "owner", // Gửi đến owner
        branchId: currentBranchId,
      });

      if (!res.ok) {
        console.error("❌ Error creating notification:", res.error.cause);
      }
    } catch (err) {
      console.error("❌ Error in createWorkOrderNotification:", err);
    }
  };

  // Helper: Update vehicle currentKm and maintenance records (moved from ServiceManager)
  const updateVehicleKmAndMaintenance = async (
    customer: Customer,
    vehicleId: string,
    currentKm: number,
    partsUsed: Array<{ partName: string }>,
    additionalServices: Array<{ description: string }>,
    issueDescription?: string
  ) => {
    try {
      const vehicle = customer.vehicles?.find((v) => v.id === vehicleId);
      if (!vehicle) {
        console.warn("[updateVehicleKmAndMaintenance] Vehicle not found:", vehicleId);
        return;
      }

      const maintenanceTypes = detectMaintenancesFromWorkOrder(
        partsUsed,
        additionalServices,
        issueDescription
      );

      const updatedVehicle = updateVehicleMaintenances(
        { ...vehicle, currentKm },
        maintenanceTypes,
        currentKm
      );

      const updatedVehicles = customer.vehicles?.map((v) =>
        v.id === vehicleId ? updatedVehicle : v
      ) || [updatedVehicle];

      await upsertCustomer?.({
        ...customer,
        vehicles: updatedVehicles,
      });
    } catch (err) {
      console.error("[updateVehicleKmAndMaintenance] Error:", err);
      // Don't throw - this is a non-critical update
    }
  };

  // Vehicle → customer record sync (moved verbatim from handleMobileSave)
  const syncVehicleToCustomer = (
    customer: Customer,
    vehicle: NonNullable<MobileWorkOrderSaveData["vehicle"]>,
    currentKm: number
  ) => {
    const existingCustomer = customers.find(
      (c) => c.id === customer.id || c.phone === customer.phone
    );

    if (existingCustomer) {
      const existingVehicles = existingCustomer.vehicles || [];
      const vehicleExists = existingVehicles.some(
        (v) => v.licensePlate === vehicle.licensePlate
      );

      if (!vehicleExists) {
        const updatedCustomer = {
          ...existingCustomer,
          vehicles: [
            ...existingVehicles,
            {
              id: vehicle.id || `veh-${Date.now()}`,
              licensePlate: vehicle.licensePlate,
              model: vehicle.model || "",
              currentKm: currentKm > 0 ? currentKm : undefined,
            },
          ],
          // Also update top-level fields for legacy compatibility
          licensePlate: vehicle.licensePlate,
          vehicleModel: vehicle.model || existingCustomer.vehicleModel,
        };
        upsertCustomer?.(updatedCustomer);
      } else if (currentKm > 0) {
        const updatedVehicles = existingVehicles.map((v) =>
          v.licensePlate === vehicle.licensePlate ? { ...v, currentKm } : v
        );
        upsertCustomer?.({ ...existingCustomer, vehicles: updatedVehicles });
      }
    } else {
      // Customer is new (created in modal), ensure it has vehicle info
      const newCustomer = {
        ...customer,
        vehicles: customer.vehicles || [
          {
            id: vehicle.id || `veh-${Date.now()}`,
            licensePlate: vehicle.licensePlate,
            model: vehicle.model || "",
            currentKm: currentKm > 0 ? currentKm : undefined,
          },
        ],
        licensePlate: vehicle.licensePlate,
        vehicleModel: vehicle.model,
      };
      upsertCustomer?.(newCustomer);
    }
  };

  const submit = async (workOrderData: MobileWorkOrderSaveData): Promise<MobileSubmitResult> => {
    if (editingOrder?.id && canModifyWorkOrder && !canModifyWorkOrder(editingOrder)) {
      showToast.error("Bạn chỉ có thể sửa phiếu do chính bạn tạo");
      throw new Error("UNAUTHORIZED_WORK_ORDER_OWNER");
    }

    // Validate required fields — early return keeps the modal open (legacy behavior)
    if (!workOrderData.customer?.name) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return { saved: false };
    }
    if (!workOrderData.customer?.phone) {
      showToast.error("Vui lòng nhập số điện thoại");
      return { saved: false };
    }

    const {
      status,
      customer,
      vehicle,
      currentKm = 0,
      issueDescription,
      technicianId,
      parts = [],
      additionalServices = [],
      repairServices = [],
      laborCost = 0,
      discount = 0,
      total = 0,
      depositAmount = 0,
      paymentMethod,
      totalPaid = 0,
      remainingAmount = 0,
    } = workOrderData;

    // 🔹 Ensure vehicle info is saved to customer record
    if (customer && vehicle && vehicle.licensePlate) {
      syncVehicleToCustomer(customer, vehicle, currentKm);
    }

    // Determine payment status
    // requirePositiveTotal: chỉ coi là "paid" khi total > 0 VÀ totalPaid >= total
    // Nếu total = 0 nhưng có deposit → vẫn là "partial" (đặt cọc trước)
    const paymentStatus = derivePaymentStatus({
      total,
      totalPaid,
      requirePositiveTotal: true,
    });

    // Find technician name
    const technician = employees.find((e) => e.id === technicianId);
    const technicianName = technician?.name || "";

    // 1. SAVE via unified service
    const additionalPayment = Math.max(0, totalPaid - depositAmount);
    const result = await saveWorkOrderAsync({
      existingOrder: editingOrder || null,
      formData: {
        customerName: customer.name,
        customerPhone: customer.phone,
        vehicleModel: vehicle?.model,
        licensePlate: vehicle?.licensePlate,
        vehicleId: vehicle?.id,
        currentKm: currentKm > 0 ? currentKm : undefined,
        issueDescription: issueDescription || "",
        technicianName,
        status,
        paymentMethod,
      },
      laborCost,
      discount,
      total,
      depositAmount,
      additionalPayment,
      totalDeposit: depositAmount,
      totalPaid,
      remainingAmount,
      paymentStatus,
      selectedParts: parts as any,
      additionalServices: additionalServices as any,
      repairServicePayloads: repairServices,
      currentBranchId,
      storePrefix: storeSettings?.work_order_prefix,
      options: { atomic: true },
    });

    const finalOrderData = result.order;
    const finalOrderId = finalOrderData.id;
    const isNew = result.created;

    if (result.usedFallback) {
      showToast.warning(
        "Đã lưu phiếu nhưng KHO CHƯA ĐƯỢC TRỪ tự động (thiếu RPC trên database). Vui lòng liên hệ quản trị để chạy migration."
      );
    }

    showToast.success(
      isNew ? "Tạo phiếu sửa chữa thành công!" : "Cập nhật phiếu sửa chữa thành công!"
    );

    // 🔹 Ghi sổ quỹ: thu đặt cọc + thu tiền sửa chữa.
    // Helper idempotent (chỉ ghi phần chênh lệch) nên an toàn khi lưu/sửa phiếu nhiều lần.
    if (finalOrderId && (depositAmount > 0 || totalPaid > 0)) {
      try {
        const servicePayment = Math.max(0, totalPaid - depositAmount);
        const createdTx = await recordWorkOrderPaymentTransactions({
          orderId: finalOrderId,
          customerName: customer.name,
          branchId: currentBranchId,
          paymentMethod: paymentMethod || "cash",
          depositAmount,
          servicePayment,
          workOrderPrefix: storeSettings?.work_order_prefix,
        });

        if (createdTx.length > 0) {
          setCashTransactions((prev: any[]) => [...prev, ...createdTx]);
          const addedAmount = createdTx.reduce((sum, tx) => sum + tx.amount, 0);
          const sourceId = paymentMethod || "cash";
          setPaymentSources((prev: any[]) =>
            prev.map((ps: any) =>
              ps.id === sourceId
                ? {
                    ...ps,
                    balance: {
                      ...ps.balance,
                      [currentBranchId]:
                        (ps.balance?.[currentBranchId] || 0) + addedAmount,
                    },
                  }
                : ps
            )
          );
          queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
        }
      } catch (err) {
        console.error("[useWorkOrderMobileSubmit] Ghi sổ quỹ thất bại:", err);
        showToast.warning(
          "Đã lưu phiếu nhưng ghi sổ quỹ chưa thành công. Vui lòng kiểm tra lại sổ quỹ."
        );
      }
    }

    // 2. PARALLEL BACKGROUND TASKS (saveWorkOrder handles repair sync, debt, stock)
    // Fire and forget — don't block the close action.
    Promise.all([
      // Task A: Update Vehicle KM & Maintenance
      (async () => {
        if (currentKm > 0 && customer?.id && vehicle?.id) {
          await updateVehicleKmAndMaintenance(
            customer,
            vehicle.id,
            currentKm,
            parts as Array<{ partName: string }>,
            additionalServices as Array<{ description: string }>,
            issueDescription
          );
        }
      })(),

      // Task B: Create Notification (only for new orders)
      (async () => {
        if (isNew) {
          const createdByName =
            profile?.name || profile?.full_name || profile?.email || "Nhân viên";
          await createWorkOrderNotification(
            finalOrderId,
            customer.name,
            vehicle?.model || "",
            vehicle?.licensePlate || "",
            total,
            createdByName
          );
        }
      })(),

      // Task C: Update Customer Stats (Total Spent)
      (async () => {
        if (customer.phone) {
          try {
            await new Promise((resolve) => setTimeout(resolve, 500));

            const statsRes = await getCustomerStatsByPhone(customer.phone);
            if (!statsRes.ok) throw statsRes.error;
            const currentCustomer = statsRes.data;

            if (currentCustomer) {
              const currentTotal = currentCustomer.totalSpent;
              const currentVisits = currentCustomer.visitCount;

              let newTotalSpent = currentTotal;
              let newVisits = currentVisits;

              if (isNew) {
                newTotalSpent = total > 0 ? currentTotal + total : currentTotal;
                newVisits = currentVisits + 1;
              } else if (editingOrder && editingOrder.total !== total) {
                const oldTotal = editingOrder.total || 0;
                newTotalSpent = Math.max(0, currentTotal - oldTotal + total);
              }

              if (newTotalSpent !== currentTotal || newVisits !== currentVisits) {
                const updateRes = await updateCustomerStats(
                  currentCustomer.id,
                  newTotalSpent,
                  newVisits
                );
                if (!updateRes.ok) throw updateRes.error;
              }
            }
          } catch (err) {
            console.error("[WorkOrder] Error updating customer stats:", err);
          }
        }
      })(),
    ]).catch((err) => {
      console.error("Error in background parallel tasks:", err);
    });

    // 🔄 Force refresh data immediately after save
    queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] });
    queryClient.invalidateQueries({ queryKey: ["workOrdersFiltered"] });

    return { saved: true, order: finalOrderData };
  };

  return { submit };
}
