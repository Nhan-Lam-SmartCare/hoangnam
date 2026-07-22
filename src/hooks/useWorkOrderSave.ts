import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createWorkOrderAtomic,
  updateWorkOrderAtomic,
  insertWorkOrderLegacy,
  updateWorkOrderLegacy,
  completeWorkOrderPayment,
} from "../lib/repository/workOrdersRepository";
import { findDuplicateCustomerByPhone, updateCustomerVehicles } from "../lib/repository/customersRepository";
import { syncRepairOrderServices } from "../lib/repository/repairLaborRepository";
import { syncCustomerDebtForWorkOrder } from "../lib/repository/workOrders/debt";
import { generateWorkOrderId } from "../utils/format";
import {
  saveWorkOrder,
  type WorkOrderSaveRequest,
  type WorkOrderSaveResult,
  WorkOrderSaveValidationError,
} from "../lib/services/workOrderSaveService";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

function buildDeps(upsertCustomerFn: (customer: any) => Promise<void>) {
  return {
    createWorkOrderAtomic,
    updateWorkOrderAtomic,
    insertWorkOrderLegacy,
    updateWorkOrderLegacy,
    findDuplicateCustomerByPhone,
    upsertCustomer: upsertCustomerFn,
    updateCustomerVehicles,
    syncRepairOrderServices,
    syncCustomerDebtForWorkOrder,
    generateWorkOrderId,
    completeWorkOrderPayment,
  };
}

export function useWorkOrderSave(upsertCustomer: (customer: any) => Promise<void>) {
  const qc = useQueryClient();
  const deps = buildDeps(upsertCustomer);

  return useMutation<WorkOrderSaveResult, Error, WorkOrderSaveRequest>({
    mutationFn: async (req) => {
      return saveWorkOrder(req, deps);
    },
    onSuccess: (_data, req) => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] });
      qc.invalidateQueries({ queryKey: ["customerDebts"] });
      qc.invalidateQueries({ queryKey: ["customersRepo"] });
      if (req.options?.atomic !== false) {
        qc.invalidateQueries({ queryKey: ["partsRepo"] });
        qc.invalidateQueries({ queryKey: ["partsRepoPaged"] });
        qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] });
        qc.invalidateQueries({ queryKey: ["cashTransactions"] });
        qc.invalidateQueries({ queryKey: ["paymentSources"] });
      }
    },
    onError: (err) => {
      if (err instanceof WorkOrderSaveValidationError) {
        showToast.error(err.message);
      } else {
        const detail = { code: "unknown" as const, message: err.message || "Lỗi không xác định", cause: err };
        showToast.error(mapRepoErrorForUser(detail));
      }
    },
  });
}
