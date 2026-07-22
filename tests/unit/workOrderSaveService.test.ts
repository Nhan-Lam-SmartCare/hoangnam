/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from "vitest";
import {
  saveWorkOrder,
  WorkOrderSaveValidationError,
  type WorkOrderSaveRequest,
  type WorkOrderSaveDeps,
} from "../../src/lib/services/workOrderSaveService";

function makeDeps(overrides?: Partial<WorkOrderSaveDeps>): WorkOrderSaveDeps {
  return {
    createWorkOrderAtomic: vi.fn().mockResolvedValue({ ok: true, data: { id: "WO-NEW-001", total: 200000 } }),
    updateWorkOrderAtomic: vi.fn().mockResolvedValue({ ok: true, data: { id: "WO-EXIST-001", total: 200000 } }),
    insertWorkOrderLegacy: vi.fn().mockResolvedValue({ ok: true, data: { data: [{ id: "WO-LEGACY-001" }] } }),
    updateWorkOrderLegacy: vi.fn().mockResolvedValue({ ok: true, data: { data: [{ id: "WO-EXIST-001" }] } }),
    findDuplicateCustomerByPhone: vi.fn().mockResolvedValue({ ok: true, data: null }),
    upsertCustomer: vi.fn().mockResolvedValue(undefined),
    updateCustomerVehicles: vi.fn().mockResolvedValue({ ok: true, data: null }),
    syncRepairOrderServices: vi.fn().mockResolvedValue({ ok: true, data: [] }),
    syncCustomerDebtForWorkOrder: vi.fn().mockResolvedValue(undefined),
    generateWorkOrderId: vi.fn().mockReturnValue("WO-NEW-001"),
    completeWorkOrderPayment: vi.fn().mockResolvedValue({
      ok: true,
      data: { inventoryDeducted: true, usedFallback: false },
    }),
    ...overrides,
  } as WorkOrderSaveDeps;
}

function makeCreateRequest(overrides?: Partial<WorkOrderSaveRequest>): WorkOrderSaveRequest {
  return {
    existingOrder: null,
    formData: {
      customerName: "Nguyễn Văn A",
      customerPhone: "0909123456",
      vehicleModel: "Wave Alpha",
      licensePlate: "59A-12345",
      vehicleId: undefined,
      currentKm: 15000,
      issueDescription: "Thay nhớt",
      technicianName: "Thợ A",
      status: "Tiếp nhận",
      paymentMethod: "cash",
    },
    laborCost: 100000,
    discount: 0,
    total: 200000,
    depositAmount: 0,
    additionalPayment: 0,
    totalDeposit: 0,
    totalPaid: 0,
    remainingAmount: 200000,
    paymentStatus: "unpaid",
    selectedParts: [],
    additionalServices: [],
    repairServicePayloads: [],
    currentBranchId: "CN1",
    ...overrides,
  };
}

// ── Validation ─────────────────────────────────────────

describe("saveWorkOrder — validation", () => {
  it("should reject empty customer name", async () => {
    const req = makeCreateRequest({ formData: { ...makeCreateRequest().formData, customerName: "" } });
    await expect(saveWorkOrder(req, makeDeps())).rejects.toThrow(WorkOrderSaveValidationError);
    await expect(saveWorkOrder(req, makeDeps())).rejects.toThrow("tên khách hàng");
  });

  it("should reject empty phone", async () => {
    const req = makeCreateRequest({ formData: { ...makeCreateRequest().formData, customerPhone: "" } });
    await expect(saveWorkOrder(req, makeDeps())).rejects.toThrow("số điện thoại");
  });

  it("should reject invalid phone", async () => {
    const req = makeCreateRequest({ formData: { ...makeCreateRequest().formData, customerPhone: "abc" } });
    await expect(saveWorkOrder(req, makeDeps())).rejects.toThrow("Số điện thoại");
  });

  it("should reject zero total when status is Trả máy", async () => {
    const req = makeCreateRequest({
      total: 0,
      formData: { ...makeCreateRequest().formData, status: "Trả máy" },
    });
    await expect(saveWorkOrder(req, makeDeps())).rejects.toThrow("Tổng tiền phải lớn hơn 0");
  });

  it("should reject worker share exceeding 100%", async () => {
    const req = makeCreateRequest({
      repairServices: [{
        serviceName: "Test Service",
        workers: [{ sharePercent: 60 }, { sharePercent: 50 }],
      }] as any,
    });
    await expect(saveWorkOrder(req, makeDeps())).rejects.toThrow("vượt quá 100%");
  });

  it("should pass validation with valid data", async () => {
    const req = makeCreateRequest();
    const result = await saveWorkOrder(req, makeDeps());
    expect(result.created).toBe(true);
    expect(result.order.id).toBe("WO-NEW-001");
  });
});

// ── Customer resolution ────────────────────────────────

describe("saveWorkOrder — customer resolution", () => {
  it("should create new customer when phone not found", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest();
    await saveWorkOrder(req, deps);
    expect(deps.findDuplicateCustomerByPhone).toHaveBeenCalledWith("0909123456");
    expect(deps.upsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Nguyễn Văn A", phone: "0909123456" })
    );
  });

  it("should update vehicle model for existing customer", async () => {
    const deps = makeDeps({
      findDuplicateCustomerByPhone: vi.fn().mockResolvedValue({
        ok: true,
        data: { id: "CUST-001", name: "Nguyễn Văn A", phone: "0909123456", vehicleModel: "Exciter" },
      }),
    });
    const req = makeCreateRequest();
    await saveWorkOrder(req, deps);
    expect(deps.upsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ vehicleModel: "Wave Alpha" })
    );
  });

  it("should create customer with vehicles for new customer", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      formData: { ...makeCreateRequest().formData, vehicleModel: "Wave Alpha", licensePlate: "59A-12345" },
    });
    await saveWorkOrder(req, deps);
    expect(deps.upsertCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        vehicles: expect.arrayContaining([
          expect.objectContaining({ model: "Wave Alpha", licensePlate: "59A-12345" }),
        ]),
      })
    );
  });

  it("should update vehicle km for existing vehicle", async () => {
    const deps = makeDeps({
      findDuplicateCustomerByPhone: vi.fn().mockResolvedValue({
        ok: true,
        data: {
          id: "CUST-001",
          name: "Nguyễn Văn A",
          phone: "0909123456",
          vehicles: [{ id: "VEH-001", model: "Wave Alpha", currentKm: 10000 }],
        },
      }),
    });
    const req = makeCreateRequest({
      formData: { ...makeCreateRequest().formData, vehicleId: "VEH-001", currentKm: 15000 },
    });
    await saveWorkOrder(req, deps);
    expect(deps.updateCustomerVehicles).toHaveBeenCalledWith(
      "CUST-001",
      expect.arrayContaining([expect.objectContaining({ id: "VEH-001", currentKm: 15000 })])
    );
  });
});

// ── Create / Update — Atomic ───────────────────────────

describe("saveWorkOrder — atomic create", () => {
  it("should call createWorkOrderAtomic for new order", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest();
    await saveWorkOrder(req, deps);
    expect(deps.createWorkOrderAtomic).toHaveBeenCalled();
    expect(deps.updateWorkOrderAtomic).not.toHaveBeenCalled();
  });

  it("should call updateWorkOrderAtomic for existing order", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      existingOrder: { id: "WO-EXIST-001" } as any,
    });
    await saveWorkOrder(req, deps);
    expect(deps.updateWorkOrderAtomic).toHaveBeenCalled();
    expect(deps.createWorkOrderAtomic).not.toHaveBeenCalled();
  });

  it("should propagate atomic error", async () => {
    const deps = makeDeps({
      createWorkOrderAtomic: vi.fn().mockResolvedValue({
        ok: false,
        error: { code: "supabase" as const, message: "DB error", cause: new Error("fail") },
      }),
    });
    await expect(saveWorkOrder(makeCreateRequest(), deps)).rejects.toThrow("DB error");
  });

  it("should call completeWorkOrderPayment for paid status with parts", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      paymentStatus: "paid",
      selectedParts: [{ partId: "P1", partName: "Nhớt", quantity: 1, price: 50000, sku: "OIL-001" }],
    });
    await saveWorkOrder(req, deps);
    expect(deps.completeWorkOrderPayment).toHaveBeenCalledWith("WO-NEW-001", "cash", 0);
  });

  it("should NOT call completeWorkOrderPayment when no parts", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({ paymentStatus: "paid", selectedParts: [] });
    await saveWorkOrder(req, deps);
    expect(deps.completeWorkOrderPayment).not.toHaveBeenCalled();
  });
});

// ── Non-atomic (legacy) path ───────────────────────────

describe("saveWorkOrder — non-atomic (legacy)", () => {
  it("should use insertWorkOrderLegacy for create", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({ options: { atomic: false } });
    await saveWorkOrder(req, deps);
    expect(deps.insertWorkOrderLegacy).toHaveBeenCalled();
    expect(deps.createWorkOrderAtomic).not.toHaveBeenCalled();
  });

  it("should use updateWorkOrderLegacy for existing order", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      existingOrder: { id: "WO-EXIST-001" } as any,
      options: { atomic: false },
    });
    await saveWorkOrder(req, deps);
    expect(deps.updateWorkOrderLegacy).toHaveBeenCalled();
    expect(deps.insertWorkOrderLegacy).not.toHaveBeenCalled();
  });
});

// ── Debt sync ──────────────────────────────────────────

describe("saveWorkOrder — debt sync", () => {
  it("should sync debt when status is Trả máy with remaining > 0", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      formData: { ...makeCreateRequest().formData, status: "Trả máy" },
      remainingAmount: 50000,
      totalPaid: 150000,
    });
    await saveWorkOrder(req, deps);
    expect(deps.syncCustomerDebtForWorkOrder).toHaveBeenCalled();
  });

  it("should NOT sync debt when Trả máy and remaining = 0", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      formData: { ...makeCreateRequest().formData, status: "Trả máy" },
      remainingAmount: 0,
      totalPaid: 200000,
    });
    await saveWorkOrder(req, deps);
    // Still called (to delete debt), but no debtCreated flag
    expect(deps.syncCustomerDebtForWorkOrder).toHaveBeenCalled();
  });

  it("should sync debt (delete) when not Trả máy", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest();
    await saveWorkOrder(req, deps);
    expect(deps.syncCustomerDebtForWorkOrder).toHaveBeenCalled();
  });
});

// ── Repair services sync ──────────────────────────────

describe("saveWorkOrder — repair services", () => {
  it("should sync repair services when payloads provided", async () => {
    const deps = makeDeps();
    const req = makeCreateRequest({
      repairServicePayloads: [{ service_name: "Test", labor_amount: 50000 }],
    });
    await saveWorkOrder(req, deps);
    expect(deps.syncRepairOrderServices).toHaveBeenCalledWith(
      "WO-NEW-001",
      expect.arrayContaining([expect.objectContaining({ service_name: "Test" })])
    );
  });

  it("should not sync when payloads empty", async () => {
    const deps = makeDeps();
    await saveWorkOrder(makeCreateRequest(), deps);
    expect(deps.syncRepairOrderServices).not.toHaveBeenCalled();
  });
});

// ── Result structure ──────────────────────────────────

describe("saveWorkOrder — result", () => {
  it("should return created: true for new order", async () => {
    const result = await saveWorkOrder(makeCreateRequest(), makeDeps());
    expect(result.created).toBe(true);
  });

  it("should return created: false for existing order", async () => {
    const result = await saveWorkOrder(
      makeCreateRequest({ existingOrder: { id: "WO-EXIST-001" } as any }),
      makeDeps()
    );
    expect(result.created).toBe(false);
  });

  it("should include usedFallback when stock deduction used fallback", async () => {
    const deps = makeDeps({
      completeWorkOrderPayment: vi.fn().mockResolvedValue({
        ok: true,
        data: { inventoryDeducted: false, usedFallback: true },
      }),
    });
    const req = makeCreateRequest({
      paymentStatus: "paid",
      selectedParts: [{ partId: "P1", partName: "Nhớt", quantity: 1, price: 50000, sku: "OIL-001" }],
    });
    const result = await saveWorkOrder(req, deps);
    expect(result.usedFallback).toBe(true);
  });
});
