/**
 * Bán hàng có IMEI — hợp đồng giữa finalizeSale và bảng `part_units`.
 *
 * Điểm mấu chốt cần khóa lại bằng test: máy phải được ĐÁNH DẤU BÁN TRƯỚC khi
 * tạo đơn. Nếu đảo thứ tự thì hai người bán cùng một chiếc sẽ cùng thu tiền rồi
 * mới phát hiện chỉ có một máy. Và khi tạo đơn hỏng thì máy phải được nhả lại,
 * không thì nó biến mất khỏi kho dù chưa bán được cho ai.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFinanceActions } from "../../src/contexts/app/useFinanceActions";
import { createQueryWrapper } from "../helpers/queryWrapper";

const mockFrom = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: mockFrom,
    rpc: mockRpc,
  },
}));

vi.mock("../../src/utils/toast", () => ({
  showToast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

/** Thứ tự các RPC đã gọi — trái tim của bài test này. */
let rpcCalls: string[] = [];

function createDeps() {
  const deps: any = {
    currentBranchId: "CN1",
    parts: [{ id: "P-PHONE", stock: { CN1: 2 }, warrantyPeriod: "12 tháng" }],
    sales: [],
    cashTransactions: [],
    customerDebts: [],
    setSales: vi.fn(),
    setParts: vi.fn(),
    setCashTransactions: vi.fn(),
    setPaymentSources: vi.fn(),
    setCustomerDebts: vi.fn(),
    setSupplierDebts: vi.fn(),
    setCartItems: vi.fn(),
    setInventoryTransactions: vi.fn(),
  };
  return deps;
}

const serializedCartItem = {
  partId: "P-PHONE",
  partName: "Reame Note 70",
  sku: "RN70",
  quantity: 2,
  sellingPrice: 3_000_000,
  stockSnapshot: 2,
  unitIds: ["unit-a", "unit-b"],
  unitImeis: ["111111111111111", "222222222222222"],
};

const saleInput = {
  items: [serializedCartItem] as any,
  discount: 0,
  paymentMethod: "cash" as const,
  customer: { name: "Khách A", phone: "0900000000" },
};

describe("finalizeSale — hàng bán theo IMEI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    rpcCalls = [];

    mockGetUser.mockResolvedValue({
      data: { user: { email: "t@example.com", user_metadata: { name: "T" } } },
    });

    mockFrom.mockImplementation(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: vi.fn().mockResolvedValue({ error: null }),
    }));
  });

  it("đánh dấu máy đã bán TRƯỚC khi tạo đơn, kèm đúng danh sách unitIds", async () => {
    let markSoldParams: any = null;
    mockRpc.mockImplementation((name: string, params: any) => {
      rpcCalls.push(name);
      if (name === "part_units_mark_sold") {
        markSoldParams = params;
        return Promise.resolve({ data: { success: true, updated: 2 }, error: null });
      }
      if (name === "sale_create_atomic") {
        return Promise.resolve({
          data: { success: true, saleId: params?.p_sale?.id },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(createDeps()), {
      wrapper: createQueryWrapper(),
    });

    let outcome: any;
    await act(async () => {
      outcome = await result.current.finalizeSale(saleInput);
    });

    expect(outcome.ok).toBe(true);
    expect(markSoldParams.p_unit_ids).toEqual(["unit-a", "unit-b"]);
    expect(markSoldParams.p_sale_id).toBe(outcome.saleId);

    // Giữ máy trước, thu tiền sau.
    expect(rpcCalls.indexOf("part_units_mark_sold")).toBeGreaterThanOrEqual(0);
    expect(rpcCalls.indexOf("part_units_mark_sold")).toBeLessThan(
      rpcCalls.indexOf("sale_create_atomic")
    );
  });

  it("máy đã bị người khác bán -> dừng lại, KHÔNG tạo đơn", async () => {
    mockRpc.mockImplementation((name: string) => {
      rpcCalls.push(name);
      if (name === "part_units_mark_sold") {
        return Promise.resolve({
          data: { success: false, message: "Máy 111111111111111 đã được bán" },
          error: null,
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(createDeps()), {
      wrapper: createQueryWrapper(),
    });

    let outcome: any;
    await act(async () => {
      outcome = await result.current.finalizeSale(saleInput);
    });

    expect(outcome.ok).toBe(false);
    expect(rpcCalls).not.toContain("sale_create_atomic");
  });

  it("tạo đơn thất bại -> nhả máy về kho (giao dịch bù trừ)", async () => {
    let releaseParams: any = null;
    mockRpc.mockImplementation((name: string, params: any) => {
      rpcCalls.push(name);
      if (name === "part_units_mark_sold") {
        return Promise.resolve({ data: { success: true, updated: 2 }, error: null });
      }
      if (name === "sale_create_atomic") {
        return Promise.resolve({
          data: { success: false, message: "Không đủ tồn kho" },
          error: null,
        });
      }
      if (name === "part_units_release") {
        releaseParams = params;
        return Promise.resolve({ data: { success: true, updated: 2 }, error: null });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(createDeps()), {
      wrapper: createQueryWrapper(),
    });

    let outcome: any;
    await act(async () => {
      outcome = await result.current.finalizeSale(saleInput);
    });

    expect(outcome.ok).toBe(false);
    await waitFor(() => expect(releaseParams).not.toBeNull());
    expect(releaseParams.p_unit_ids).toEqual(["unit-a", "unit-b"]);
  });

  it("hàng thường (không unitIds) không đụng tới part_units", async () => {
    mockRpc.mockImplementation((name: string, params: any) => {
      rpcCalls.push(name);
      if (name === "sale_create_atomic") {
        return Promise.resolve({
          data: { success: true, saleId: params?.p_sale?.id },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(createDeps()), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      await result.current.finalizeSale({
        ...saleInput,
        items: [
          {
            partId: "P-PHONE",
            partName: "Bugi",
            quantity: 1,
            sellingPrice: 50_000,
            stockSnapshot: 5,
          },
        ] as any,
      });
    });

    expect(rpcCalls.filter((n) => n.startsWith("part_units_"))).toEqual([]);
  });
});

/**
 * Sau `sql/2026-07-26_sale_rpc_release_units.sql`, việc nhả máy nằm TRONG chính
 * transaction xóa/trả đơn. Client nhận biết qua khóa `unitsReleased`:
 *   - có khóa  -> DB đã lo, client gọi thêm là thừa một round-trip
 *   - thiếu khóa -> DB còn RPC bản cũ, client PHẢI tự nhả, không thì máy kẹt 'sold'
 *
 * Hai nhánh này dễ hỏng âm thầm khi ai đó dọn code, nên khóa lại bằng test.
 */
describe("deleteSale — nhả máy theo bản RPC trên DB", () => {
  const saleWithUnits = {
    id: "SALE-9",
    branchId: "CN1",
    items: [
      {
        partId: "P-PHONE",
        partName: "Reame Note 70",
        quantity: 1,
        sellingPrice: 3_000_000,
        unitIds: ["unit-a"],
      },
    ],
    paymentMethod: "cash",
    total: 3_000_000,
  };

  function depsWithSale() {
    const deps: any = createDeps();
    deps.sales = [saleWithUnits];
    deps.paymentSources = [{ id: "cash", balance: { CN1: 5_000_000 } }];
    return deps;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    rpcCalls = [];
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
  });

  it("RPC bản mới báo unitsReleased -> client KHÔNG gọi lại part_units_release_by_sale", async () => {
    mockRpc.mockImplementation((name: string) => {
      rpcCalls.push(name);
      if (name === "sale_delete_atomic") {
        return Promise.resolve({
          data: {
            success: true,
            branchId: "CN1",
            refunds: {},
            removedCashTxIds: [],
            unitsReleased: 1,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(depsWithSale()), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      result.current.deleteSale("SALE-9");
    });

    await waitFor(() => expect(rpcCalls).toContain("sale_delete_atomic"));
    expect(rpcCalls).not.toContain("part_units_release_by_sale");
  });

  it("RPC bản cũ (không có unitsReleased) -> client tự nhả máy", async () => {
    let releaseSaleId: string | null = null;
    mockRpc.mockImplementation((name: string, params: any) => {
      rpcCalls.push(name);
      if (name === "sale_delete_atomic") {
        return Promise.resolve({
          data: {
            success: true,
            branchId: "CN1",
            refunds: {},
            removedCashTxIds: [],
          },
          error: null,
        });
      }
      if (name === "part_units_release_by_sale") {
        releaseSaleId = params?.p_sale_id;
        return Promise.resolve({
          data: { success: true, updated: 1 },
          error: null,
        });
      }
      return Promise.resolve({ data: { success: true }, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(depsWithSale()), {
      wrapper: createQueryWrapper(),
    });

    await act(async () => {
      result.current.deleteSale("SALE-9");
    });

    await waitFor(() => expect(releaseSaleId).toBe("SALE-9"));
  });
});
