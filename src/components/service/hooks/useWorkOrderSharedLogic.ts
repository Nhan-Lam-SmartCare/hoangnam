import type { Part, RepairOrderService, ServiceConfig } from "../../../types";

export interface RepairServiceDraftWorker {
  worker_id: string;
  worker_name?: string;
  share_percent: number;
}

export interface RepairServiceDraft {
  id: string;
  serviceId?: string;
  serviceName: string;
  laborCalcType: ServiceConfig["laborCalcType"];
  laborFixedAmount: number;
  laborPercentOfCost: number;
  minimumLaborAmount: number;
  defaultWorkerSharePercent: number;
  manualLabor: number;
  relatedItemIds: string[];
  workers: RepairServiceDraftWorker[];
  isBillable: boolean;
  isPayableToWorker: boolean;
  note: string;
}

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

export const mapRepairServiceToDraft = (service: RepairOrderService): RepairServiceDraft => ({
  id: service.id,
  serviceId: service.serviceId,
  serviceName: service.serviceName,
  laborCalcType: service.laborCalcType,
  laborFixedAmount: service.laborFixedAmount,
  laborPercentOfCost: service.laborPercentOfCost,
  minimumLaborAmount: service.minimumLaborAmount,
  defaultWorkerSharePercent: service.workerSharePercent || 30,
  manualLabor: service.laborCalcType === "manual" ? service.laborAmount : service.laborFixedAmount,
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

export const getWarrantyText = (part: Part | null | undefined): string => {
  if (!part) return "";
  return String(
    (part as any).warrantyPeriod ??
      (part as any).warrantyperiod ??
      (part as any).warranty_period ??
      (part as any).warranty ??
      ""
  ).trim();
};

export const getPartLaborBase = (partId: string, parts: Part[], branchId: string): number => {
  const partRef = parts.find((p: any) => p.id === partId);
  return (
    Number((partRef as any)?.laborCost?.[branchId]) ||
    Number(partRef?.wholesalePrice?.[branchId]) ||
    0
  );
};

export const getPartWarranty = (partId: string, parts: Part[]): string => {
  const partRef = parts.find((p: any) => p.id === partId);
  return getWarrantyText(partRef);
};

export const getIntegratedLaborByQuantity = (laborBase: number, quantity: number): number => {
  if (laborBase <= 0 || quantity <= 0) return 0;
  return laborBase * (1 + 0.5 * (quantity - 1));
};
