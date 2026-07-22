import type { RepairOrderService } from "../../../types";
import type { RepairServiceDraft } from "../types/service.types";

export const createEmptyRepairServiceDraft = (): RepairServiceDraft => ({
  id: `labor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  serviceName: "",
  laborCalcType: "fixed",
  laborFixedAmount: 0,
  laborPercentOfCost: 0,
  minimumLaborAmount: 0,
  defaultWorkerSharePercent: 30,
  manualLabor: 0,
  relatedItemIds: [],
  workers: [],
  isBillable: true,
  isPayableToWorker: true,
  note: "",
});

export const mapRepairServiceToDraft = (
  service: RepairOrderService
): RepairServiceDraft => ({
  id: service.id,
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  laborCalcType: service.laborCalcType,
  laborFixedAmount: service.laborFixedAmount,
  laborPercentOfCost: service.laborPercentOfCost,
  minimumLaborAmount: service.minimumLaborAmount,
  defaultWorkerSharePercent: service.workerSharePercent || 30,
  manualLabor:
    service.laborCalcType === "manual"
      ? service.laborAmount
      : service.laborFixedAmount,
  relatedItemIds: (service.relatedItems || []).map((item: any) => item.partId),
  workers: (service.workers || []).map((worker: any) => ({
    worker_id: worker.workerId,
    worker_name: worker.workerName || "",
    share_percent: worker.sharePercent,
  })),
  isBillable: service.isBillable,
  isPayableToWorker: service.isPayableToWorker,
  note: service.note || "",
});
