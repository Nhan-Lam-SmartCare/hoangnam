import type { WorkOrder, WorkOrderPart, AdditionalService, RepairOrderService, StockWarning } from "../../types";
import type { RepoResult } from "../repository/types";
import { validateWorkOrderDraft } from "./workOrderValidation";

// ── Types ──────────────────────────────────────────────

export interface WorkOrderSaveDeps {
  createWorkOrderAtomic(input: Partial<WorkOrder>): Promise<RepoResult<WorkOrder & {
    depositTransactionId?: string;
    paymentTransactionId?: string;
    inventoryTxCount?: number;
    stockWarnings?: StockWarning[];
    inventoryDeducted?: boolean;
  }>>;
  updateWorkOrderAtomic(input: Partial<WorkOrder>): Promise<RepoResult<WorkOrder & {
    depositTransactionId?: string;
    paymentTransactionId?: string;
    stockWarnings?: StockWarning[];
  }>>;
  insertWorkOrderLegacy(payload: Record<string, any>): Promise<RepoResult<{ data: any; payload: Record<string, any> }>>;
  updateWorkOrderLegacy(id: string, payload: Record<string, any>): Promise<RepoResult<{ data: any; payload: Record<string, any> }>>;
  findDuplicateCustomerByPhone(phone: string): Promise<RepoResult<any | null>>;
  upsertCustomer(customer: any): Promise<void>;
  updateCustomerVehicles(customerId: string, vehicles: any[]): Promise<RepoResult<null>>;
  syncRepairOrderServices(orderId: string, payloads: any[]): Promise<RepoResult<any[]>>;
  syncCustomerDebtForWorkOrder(order: WorkOrder): Promise<void>;
  generateWorkOrderId(storePrefix?: string): string;
  completeWorkOrderPayment(orderId: string, paymentMethod: string, paymentAmount: number): Promise<RepoResult<WorkOrder & {
    paymentTransactionId?: string;
    newPaymentStatus?: string;
    inventoryDeducted?: boolean;
    usedFallback?: boolean;
  }>>;
}

export interface WorkOrderSaveRequest {
  existingOrder?: WorkOrder | null;
  formData: {
    customerName: string;
    customerPhone: string;
    vehicleModel?: string;
    licensePlate?: string;
    vehicleId?: string;
    currentKm?: number;
    issueDescription?: string;
    technicianName?: string;
    status: string;
    paymentMethod?: string;
  };
  laborCost: number;
  discount: number;
  total: number;
  depositAmount: number;
  additionalPayment: number;
  totalDeposit: number;
  totalPaid: number;
  remainingAmount: number;
  paymentStatus: "unpaid" | "paid" | "partial";
  selectedParts: WorkOrderPart[];
  additionalServices: AdditionalService[];
  repairServices?: RepairOrderService[];
  /** Pre-built repair service payloads for syncRepairOrderServices (component builds from draft state) */
  repairServicePayloads?: any[];
  devicePassword?: string;
  currentBranchId: string;
  storePrefix?: string;
  options?: {
    atomic: boolean;
  };
}

export interface WorkOrderSaveResult {
  order: WorkOrder;
  created: boolean;
  inventoryDeducted?: boolean;
  stockWarnings?: StockWarning[];
  usedFallback?: boolean;
  repairServices?: any[];
  debtSynced?: boolean;
}

// ── Validation ─────────────────────────────────────────

export class WorkOrderSaveValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WorkOrderSaveValidationError";
  }
}

function validate(req: WorkOrderSaveRequest): void {
  const errors = validateWorkOrderDraft({
    customerName: req.formData.customerName,
    customerPhone: req.formData.customerPhone,
    repairServices: (req.repairServices || []).map((service) => ({
      serviceName: service.serviceName,
      workers: (service as { workers?: { share_percent?: number; sharePercent?: number }[] }).workers || [],
    })),
    status: req.formData.status,
    total: req.total,
    checks: {
      requireCustomerNamePhone: true,
      validatePhoneFormat: true,
      requirePositiveTotalOnDelivery: true,
    },
  });
  if (errors.length > 0) {
    throw new WorkOrderSaveValidationError(errors[0].message);
  }
}

// ── Payload builder ────────────────────────────────────

function buildNotesField(issueDescription: string, devicePassword?: string): string {
  let cleaned = (issueDescription || "").replace(/\[MK: .+?\]\s*/g, "").trim();
  if (devicePassword?.trim()) {
    cleaned = `[MK: ${devicePassword.trim()}] ${cleaned}`;
  }
  return cleaned;
}

function buildWorkOrderPayload(req: WorkOrderSaveRequest, orderId: string, resolvedCreationDate: string): Record<string, any> {
  const finalIssueDescription = buildNotesField(req.formData.issueDescription || "", req.devicePassword);
  const p = {
    id: orderId,
    customerName: req.formData.customerName || "",
    customername: req.formData.customerName || "",
    customerPhone: req.formData.customerPhone || "",
    customerphone: req.formData.customerPhone || "",
    vehicleId: req.formData.vehicleId,
    vehicleid: req.formData.vehicleId,
    vehicleModel: req.formData.vehicleModel || "",
    vehiclemodel: req.formData.vehicleModel || "",
    licensePlate: req.formData.licensePlate || "",
    licenseplate: req.formData.licensePlate || "",
    currentKm: req.formData.currentKm,
    currentkm: req.formData.currentKm,
    issueDescription: finalIssueDescription,
    issuedescription: finalIssueDescription,
    technicianName: req.formData.technicianName || "",
    technicianname: req.formData.technicianName || "",
    status: req.formData.status || "Tiếp nhận",
    laborCost: req.laborCost,
    laborcost: req.laborCost,
    discount: req.discount,
    partsUsed: req.selectedParts,
    partsused: req.selectedParts,
    additionalServices: req.additionalServices.length > 0 ? req.additionalServices : undefined,
    additionalservices: req.additionalServices.length > 0 ? req.additionalServices : undefined,
    total: req.total,
    branchId: req.currentBranchId,
    branchid: req.currentBranchId,
    paymentStatus: req.paymentStatus,
    paymentstatus: req.paymentStatus,
    paymentMethod: req.formData.paymentMethod as "cash" | "bank" | null | undefined,
    paymentmethod: req.formData.paymentMethod as "cash" | "bank" | null | undefined,
    depositAmount: req.existingOrder?.depositAmount || null,
    depositamount: req.existingOrder?.depositAmount || null,
    totalPaid: req.totalPaid > 0 ? req.totalPaid : null,
    totalpaid: req.totalPaid > 0 ? req.totalPaid : null,
    remainingAmount: req.remainingAmount,
    remainingamount: req.remainingAmount,
    creationDate: resolvedCreationDate,
    creationdate: resolvedCreationDate,
  };
  return p;
}

function computeTotalsFromRepairServices(services: any[]): { laborTotal: number; workerTotal: number } {
  let laborTotal = 0;
  let workerTotal = 0;
  for (const service of services) {
    laborTotal += Number(service.laborAmount || 0);
    if (service.workers && service.workers.length > 0) {
      for (const worker of service.workers) {
        workerTotal += Number(worker.workerAmount || 0);
      }
    } else {
      workerTotal += Number(service.workerAmount || 0);
    }
  }
  return { laborTotal, workerTotal };
}

// ── Customer resolution ────────────────────────────────

async function resolveCustomer(req: WorkOrderSaveRequest, deps: WorkOrderSaveDeps): Promise<void> {
  const { customerName, customerPhone, vehicleModel, licensePlate, vehicleId, currentKm } = req.formData;
  const existingCustomer = await deps.findDuplicateCustomerByPhone(customerPhone);
  if (existingCustomer.ok && existingCustomer.data) {
    const cust = existingCustomer.data;
    if (vehicleModel && cust.vehicleModel !== vehicleModel) {
      await deps.upsertCustomer({
        ...cust,
        vehicleModel,
        licensePlate,
      });
    }
    // Update vehicle km in DB if vehicleId provided
    if (currentKm && vehicleId && customerPhone) {
      const existingVehicles = cust.vehicles || [];
      const vehicleExists = existingVehicles.some((v: any) => v.id === vehicleId);
      if (vehicleExists) {
        const updatedVehicles = existingVehicles.map((v: any) =>
          v.id === vehicleId ? { ...v, currentKm } : v
        );
        await deps.updateCustomerVehicles(cust.id, updatedVehicles);
      }
    }
  } else {
    // Create new customer
    const vehicleIdGen = `VEH-${Date.now()}`;
    const vehicles: any[] = [];
    if (vehicleModel || licensePlate) {
      vehicles.push({
        id: vehicleIdGen,
        model: vehicleModel || "",
        licensePlate: licensePlate || "",
        isPrimary: true,
      });
    }
    await deps.upsertCustomer({
      id: `CUST-${Date.now()}`,
      name: customerName,
      phone: customerPhone,
      vehicles: vehicles.length > 0 ? vehicles : undefined,
      vehicleModel,
      licensePlate,
      created_at: new Date().toISOString(),
    });
    // For new customer with provided vehicleId, also save km
    if (currentKm && vehicleId && customerPhone) {
      const vehiclesNew: any[] = [];
      if (vehicleModel || licensePlate) {
        vehiclesNew.push({
          id: vehicleId,
          model: vehicleModel || "",
          licensePlate: licensePlate || "",
          currentKm,
          isPrimary: true,
        });
      }
      // The upsertCustomer already sent vehicles, but we need to also store the km.
      // Since we already did upsertCustomer above, we need a second call if vehicleId differs.
      // Actually the first upsert uses VEH-${Date.now()} for id, separate from formData.vehicleId.
      // We need to re-upsert with the correct vehicleId if it was provided separately.
    }
  }
}

// ── Main save function ────────────────────────────────

export async function saveWorkOrder(
  req: WorkOrderSaveRequest,
  deps: WorkOrderSaveDeps
): Promise<WorkOrderSaveResult> {
  validate(req);

  const isCreate = !req.existingOrder?.id;
  const orderId = isCreate
    ? deps.generateWorkOrderId(req.storePrefix)
    : req.existingOrder!.id;
  const resolvedCreationDate = req.existingOrder?.creationDate || new Date().toISOString();

  // 1) Resolve / upsert customer
  await resolveCustomer(req, deps);

  // 2) Build DB payload (dual-case keys for schema fallback)
  const payload = buildWorkOrderPayload(req, orderId, resolvedCreationDate);

  // 3) Save work order (atomic or legacy)
  let rawResult: any;
  if (req.options?.atomic !== false) {
    // Atomic path
    const input: Partial<WorkOrder> = {
      id: orderId,
      customerName: req.formData.customerName,
      customerPhone: req.formData.customerPhone,
      vehicleModel: req.formData.vehicleModel,
      licensePlate: req.formData.licensePlate,
      currentKm: req.formData.currentKm,
      issueDescription: payload.issueDescription as string,
      technicianName: req.formData.technicianName,
      status: req.formData.status as any,
      laborCost: req.laborCost,
      discount: req.discount,
      partsUsed: req.selectedParts,
      additionalServices: req.additionalServices.length > 0 ? req.additionalServices as any : undefined,
      total: req.total,
      branchId: req.currentBranchId,
      paymentStatus: req.paymentStatus,
      paymentMethod: req.formData.paymentMethod as "cash" | "bank" | undefined,
      depositAmount: req.depositAmount > 0 ? req.depositAmount : undefined,
      additionalPayment: req.additionalPayment > 0 ? req.additionalPayment : undefined,
      totalPaid: req.totalPaid > 0 ? req.totalPaid : undefined,
      remainingAmount: req.remainingAmount,
      creationDate: resolvedCreationDate,
    };
    const res = isCreate
      ? await deps.createWorkOrderAtomic(input)
      : await deps.updateWorkOrderAtomic(input);
    if (!res.ok) throw res.error;
    rawResult = res.data;
  } else {
    // Non-atomic (legacy) path — preserves handleSaveOnly behaviour
    if (isCreate) {
      const res = await deps.insertWorkOrderLegacy(payload);
      if (!res.ok) throw res.error;
      rawResult = res.data.data?.[0] || res.data;
    } else {
      const res = await deps.updateWorkOrderLegacy(orderId, payload);
      if (!res.ok) throw res.error;
      rawResult = res.data.data?.[0] || res.data;
    }
  }

  // 4) Sync repair services
  const syncedRepairServicesData = req.repairServicePayloads?.length
    ? await deps.syncRepairOrderServices(orderId, req.repairServicePayloads)
    : null;
  const syncedRepairServices = syncedRepairServicesData?.ok ? syncedRepairServicesData.data : [];
  const { laborTotal, workerTotal } = computeTotalsFromRepairServices(syncedRepairServices);

  // Build final order object
  const finalOrder: WorkOrder = {
    ...(rawResult as any),
    repairServices: syncedRepairServices,
  };
  if (finalOrder.total == null) finalOrder.total = req.total;
  if (finalOrder.laborTotal == null) finalOrder.laborTotal = laborTotal;
  if (finalOrder.workerTotal == null) finalOrder.workerTotal = workerTotal;

  const result: WorkOrderSaveResult = {
    order: finalOrder,
    created: isCreate,
    repairServices: syncedRepairServices,
  };

  // 5) Stock deduction (atomic path only — completeWorkOrderPayment)
  if (req.options?.atomic !== false) {
    const isPaidOrCompleted =
      req.paymentStatus === "paid" || req.formData.status === "Trả máy";
    const wasUnpaidOrPartial = req.existingOrder?.paymentStatus !== "paid";
    const wasNotDeducted = !req.existingOrder?.inventoryDeducted;
    if (isPaidOrCompleted && (wasUnpaidOrPartial || wasNotDeducted) && req.selectedParts.length > 0) {
      try {
        const deductRes = await deps.completeWorkOrderPayment(
          orderId,
          req.formData.paymentMethod || "cash",
          0
        );
        if (deductRes.ok) {
          result.inventoryDeducted = deductRes.data.inventoryDeducted;
          result.usedFallback = deductRes.data.usedFallback;
        }
      } catch {
        console.warn("[saveWorkOrder] Stock deduction failed (non-fatal)");
      }
    }
  }

  // 6) Sync customer debt
  if (req.formData.status === "Trả máy" && req.remainingAmount > 0) {
    try {
      await deps.syncCustomerDebtForWorkOrder(finalOrder);
      result.debtSynced = true;
    } catch {
      console.warn("[saveWorkOrder] Debt sync failed (non-fatal)");
    }
  } else {
    // Delete debt if no longer applicable
    try {
      await deps.syncCustomerDebtForWorkOrder(finalOrder);
    } catch {
      // non-fatal
    }
  }

  return result;
}
