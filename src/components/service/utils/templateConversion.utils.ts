import type { WorkOrder } from "../../../types";
import { generateWorkOrderId } from "../../../utils/format";

export interface TemplatePartLike {
  name: string;
  quantity: number;
  price: number;
  sku?: string;
  partId?: string;
}

export interface TemplateLike {
  id: string;
  name: string;
  description: string | null;
  duration: number;
  labor_cost?: number;
  laborCost?: number;
  parts: TemplatePartLike[];
}

interface TemplateToWorkOrderDraftOptions {
  branchId: string;
  generateId?: boolean;
  prefix?: string;
}

export function templateToWorkOrderDraft(
  template: TemplateLike,
  options: TemplateToWorkOrderDraftOptions
): WorkOrder {
  const { branchId, generateId = false, prefix } = options;

  const laborCost =
    typeof template.labor_cost === "number"
      ? template.labor_cost
      : typeof (template as any).laborCost === "number"
      ? (template as any).laborCost
      : 0;

  const duration =
    typeof template.duration === "number"
      ? template.duration
      : 30;

  const partsUsed = (template.parts || []).map((p: any) => ({
    partId: p.partId || "",
    partName: p.name,
    quantity: p.quantity,
    price: p.price,
    sku: p.sku || "",
  }));

  return {
    id: generateId ? generateWorkOrderId(prefix) : "",
    customerName: "",
    customerPhone: "",
    vehicleModel: "",
    issueDescription: template.description || template.name || "",
    status: "Tiếp nhận",
    creationDate: new Date().toISOString(),
    estimatedCompletion: new Date(
      Date.now() + (duration || 30) * 60000
    ).toISOString(),
    technicianName: "",
    laborCost,
    partsUsed,
    notes: "",
    total: 0,
    branchId,
  } as WorkOrder;
}
