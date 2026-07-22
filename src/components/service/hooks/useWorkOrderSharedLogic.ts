import type { Part, RepairOrderService } from "../../../types";
import type { RepairServiceDraft, RepairServiceDraftWorker } from "../types/service.types";
import { createEmptyRepairServiceDraft, mapRepairServiceToDraft } from "../utils/repairServiceDraft.utils";

export { createEmptyRepairServiceDraft, mapRepairServiceToDraft };
export type { RepairServiceDraft, RepairServiceDraftWorker };

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
