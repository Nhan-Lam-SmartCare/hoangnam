import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// ──────────────────────────────────────────────────────────
// Phase 7: useWorkOrderMobileSubmit — the mobile save pipeline that replaced
// ServiceManager.handleMobileSave. These tests lock in the moved behavior:
// ownership guard, validation early-returns, save request shape
// (paymentStatus with requirePositiveTotal), cash ledger recording and
// vehicle → customer sync.
// ──────────────────────────────────────────────────────────

const mockSaveWorkOrderAsync = vi.hoisted(() => vi.fn());
const mockRecordTx = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());
const mockGetStats = vi.hoisted(() => vi.fn());
const mockUpdateStats = vi.hoisted(() => vi.fn());
const mockInvalidate = vi.hoisted(() => vi.fn());
const mockSetCashTransactions = vi.hoisted(() => vi.fn());
const mockSetPaymentSources = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn(),
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: mockInvalidate }),
}));
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({ profile: { id: "u1", name: "Chủ Tiệm", role: "owner" } }),
}));
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({
    setCashTransactions: mockSetCashTransactions,
    setPaymentSources: mockSetPaymentSources,
  }),
}));
vi.mock("../../src/hooks/useWorkOrderSave", () => ({
  useWorkOrderSave: () => ({ mutateAsync: mockSaveWorkOrderAsync }),
}));
vi.mock("../../src/lib/repository/workOrdersRepository", () => ({
  recordWorkOrderPaymentTransactions: mockRecordTx,
}));
vi.mock("../../src/lib/repository/notificationsRepository", () => ({
  createNotification: mockCreateNotification,
}));
vi.mock("../../src/lib/repository/customersRepository", () => ({
  getCustomerStatsByPhone: mockGetStats,
  updateCustomerStats: mockUpdateStats,
}));
vi.mock("../../src/utils/toast", () => ({ showToast: mockToast }));

import { useWorkOrderMobileSubmit } from "../../src/components/service/hooks/useWorkOrderMobileSubmit";
import type { UseWorkOrderMobileSubmitParams } from "../../src/components/service/hooks/useWorkOrderMobileSubmit";

function makeParams(
  overrides: Partial<UseWorkOrderMobileSubmitParams> = {}
): UseWorkOrderMobileSubmitParams {
  return {
    currentBranchId: "CN1",
    customers: [],
    employees: [{ id: "E1", name: "Thợ A" }] as never[],
    editingOrder: null,
    storeSettings: { work_order_prefix: "SC" },
    upsertCustomer: vi.fn(),
    ...overrides,
  } as UseWorkOrderMobileSubmitParams;
}

function makeData(overrides: Record<string, unknown> = {}) {
  return {
    status: "Tiếp nhận",
    customer: { id: "C1", name: "Nguyễn Văn A", phone: "0912345678" },
    vehicle: { id: "V1", model: "iPhone 13", licensePlate: "SN-123" },
    technicianId: "E1",
    parts: [],
    additionalServices: [],
    repairServices: [],
    laborCost: 0,
    discount: 0,
    total: 100000,
    depositAmount: 0,
    paymentMethod: "cash",
    totalPaid: 0,
    remainingAmount: 100000,
    ...overrides,
  } as never;
}

function renderSubmit(params = makeParams()) {
  const { result } = renderHook(() => useWorkOrderMobileSubmit(params));
  return result.current;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockSaveWorkOrderAsync.mockResolvedValue({
    order: { id: "WO-1", total: 100000 },
    created: true,
  });
  mockRecordTx.mockResolvedValue([]);
  mockGetStats.mockResolvedValue({ ok: true, data: null });
  mockUpdateStats.mockResolvedValue({ ok: true, data: null });
  mockCreateNotification.mockResolvedValue({ ok: true, data: null });
});

describe("useWorkOrderMobileSubmit — Phase 7", () => {
  it("blocks save when user cannot modify the editing order (ownership guard)", async () => {
    const { submit } = renderSubmit(
      makeParams({
        editingOrder: { id: "WO-9" } as never,
        canModifyWorkOrder: () => false,
      })
    );

    await expect(submit(makeData())).rejects.toThrow("UNAUTHORIZED_WORK_ORDER_OWNER");
    expect(mockToast.error).toHaveBeenCalledWith("Bạn chỉ có thể sửa phiếu do chính bạn tạo");
    expect(mockSaveWorkOrderAsync).not.toHaveBeenCalled();
  });

  it("returns saved:false with toast when customer name missing (modal stays open)", async () => {
    const { submit } = renderSubmit();
    const res = await submit(makeData({ customer: { id: "C1", name: "", phone: "09" } }));
    expect(res.saved).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith("Vui lòng nhập tên khách hàng");
    expect(mockSaveWorkOrderAsync).not.toHaveBeenCalled();
  });

  it("returns saved:false with toast when phone missing", async () => {
    const { submit } = renderSubmit();
    const res = await submit(
      makeData({ customer: { id: "C1", name: "Khách", phone: "" } })
    );
    expect(res.saved).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith("Vui lòng nhập số điện thoại");
    expect(mockSaveWorkOrderAsync).not.toHaveBeenCalled();
  });

  it("saves through the unified pipeline with the same request shape as handleMobileSave", async () => {
    const { submit } = renderSubmit();
    const res = await submit(makeData({ totalPaid: 30000, depositAmount: 10000 }));

    expect(res.saved).toBe(true);
    expect(res.order?.id).toBe("WO-1");
    expect(mockSaveWorkOrderAsync).toHaveBeenCalledTimes(1);
    const req = mockSaveWorkOrderAsync.mock.calls[0][0];
    expect(req).toMatchObject({
      existingOrder: null,
      formData: {
        customerName: "Nguyễn Văn A",
        customerPhone: "0912345678",
        vehicleModel: "iPhone 13",
        licensePlate: "SN-123",
        vehicleId: "V1",
        technicianName: "Thợ A", // resolved from employees list
        status: "Tiếp nhận",
        paymentMethod: "cash",
      },
      total: 100000,
      depositAmount: 10000,
      additionalPayment: 20000, // totalPaid - depositAmount
      totalDeposit: 10000,
      totalPaid: 30000,
      paymentStatus: "partial",
      storePrefix: "SC",
      options: { atomic: true },
    });
    expect(mockToast.success).toHaveBeenCalledWith("Tạo phiếu sửa chữa thành công!");
  });

  it("[quirk giữ nguyên] total=0 + có cọc → partial (requirePositiveTotal)", async () => {
    const { submit } = renderSubmit();
    await submit(makeData({ total: 0, totalPaid: 50000, depositAmount: 50000, remainingAmount: 0 }));
    expect(mockSaveWorkOrderAsync.mock.calls[0][0].paymentStatus).toBe("partial");
  });

  it("[bug fix] devicePhotos được truyền vào save request (trước đây bị bỏ rơi)", async () => {
    const { submit } = renderSubmit();
    const photos = ["https://storage/photo-1.jpg", "https://storage/photo-2.jpg"];
    await submit(makeData({ devicePhotos: photos }));
    expect(mockSaveWorkOrderAsync.mock.calls[0][0].devicePhotos).toEqual(photos);
  });

  it("records cash ledger and mutates context when payment collected", async () => {
    mockRecordTx.mockResolvedValue([{ id: "TX-1", amount: 80000 }]);
    const { submit } = renderSubmit();
    await submit(makeData({ totalPaid: 100000, depositAmount: 20000, remainingAmount: 0 }));

    expect(mockRecordTx).toHaveBeenCalledWith({
      orderId: "WO-1",
      customerName: "Nguyễn Văn A",
      branchId: "CN1",
      paymentMethod: "cash",
      depositAmount: 20000,
      servicePayment: 80000,
      workOrderPrefix: "SC",
    });
    expect(mockSetCashTransactions).toHaveBeenCalled();
    expect(mockSetPaymentSources).toHaveBeenCalled();
    expect(mockInvalidate).toHaveBeenCalledWith({ queryKey: ["cashTransactions"] });
  });

  it("does NOT record ledger when nothing was paid", async () => {
    const { submit } = renderSubmit();
    await submit(makeData({ totalPaid: 0, depositAmount: 0 }));
    expect(mockRecordTx).not.toHaveBeenCalled();
    expect(mockSetCashTransactions).not.toHaveBeenCalled();
  });

  it("ledger failure is non-fatal: warns but still returns saved:true", async () => {
    mockRecordTx.mockRejectedValue(new Error("network"));
    const { submit } = renderSubmit();
    const res = await submit(makeData({ totalPaid: 50000, depositAmount: 0 }));
    expect(res.saved).toBe(true);
    expect(mockToast.warning).toHaveBeenCalledWith(
      "Đã lưu phiếu nhưng ghi sổ quỹ chưa thành công. Vui lòng kiểm tra lại sổ quỹ."
    );
  });

  it("syncs a new vehicle into the existing customer record before saving", async () => {
    const upsertCustomer = vi.fn();
    const existingCustomer = {
      id: "C1",
      name: "Nguyễn Văn A",
      phone: "0912345678",
      vehicles: [{ id: "V0", licensePlate: "SN-OLD", model: "iPhone 11" }],
    };
    const { submit } = renderSubmit(
      makeParams({ customers: [existingCustomer] as never[], upsertCustomer })
    );
    await submit(makeData());

    expect(upsertCustomer).toHaveBeenCalledTimes(1);
    const upserted = upsertCustomer.mock.calls[0][0];
    expect(upserted.vehicles).toHaveLength(2);
    expect(upserted.vehicles[1].licensePlate).toBe("SN-123");
    expect(upserted.licensePlate).toBe("SN-123"); // legacy top-level sync
  });

  it("shows fallback warning when stock was not deducted (usedFallback)", async () => {
    mockSaveWorkOrderAsync.mockResolvedValue({
      order: { id: "WO-2" },
      created: false,
      usedFallback: true,
    });
    const { submit } = renderSubmit();
    await submit(makeData());
    expect(mockToast.warning).toHaveBeenCalledWith(
      expect.stringContaining("KHO CHƯA ĐƯỢC TRỪ")
    );
    expect(mockToast.success).toHaveBeenCalledWith("Cập nhật phiếu sửa chữa thành công!");
  });
});
