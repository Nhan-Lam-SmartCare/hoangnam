import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFinanceActions } from "../../src/contexts/app/useFinanceActions";
import { showToast } from "../../src/utils/toast";

const mockFrom = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockSalesInsert = vi.hoisted(() => vi.fn());
const mockWarrantyInsert = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: mockGetUser,
    },
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

type State = {
  currentBranchId: string;
  parts: any[];
  sales: any[];
  cashTransactions: any[];
  paymentSources: any[];
  cartItems: any[];
  customerDebts: any[];
  supplierDebts: any[];
  inventoryTransactions: any[];
};

function createDeps(initial?: Partial<State>) {
  const state: State = {
    currentBranchId: "CN1",
    parts: [
      {
        id: "P-1",
        stock: { CN1: 10 },
        warrantyPeriod: "12 tháng",
      },
    ],
    sales: [],
    cashTransactions: [],
    paymentSources: [{ id: "cash", balance: { CN1: 0 } }],
    cartItems: [{ partId: "P-1", quantity: 1 }],
    customerDebts: [],
    supplierDebts: [],
    inventoryTransactions: [],
    ...initial,
  };

  const deps = {
    currentBranchId: state.currentBranchId,
    parts: state.parts,
    sales: state.sales,
    cashTransactions: state.cashTransactions,
    customerDebts: state.customerDebts,
    setSales: vi.fn((updater: any) => {
      state.sales = typeof updater === "function" ? updater(state.sales) : updater;
      deps.sales = state.sales;
    }),
    setParts: vi.fn((updater: any) => {
      state.parts = typeof updater === "function" ? updater(state.parts) : updater;
      deps.parts = state.parts;
    }),
    setCashTransactions: vi.fn((updater: any) => {
      state.cashTransactions =
        typeof updater === "function"
          ? updater(state.cashTransactions)
          : updater;
    }),
    setPaymentSources: vi.fn((updater: any) => {
      state.paymentSources =
        typeof updater === "function" ? updater(state.paymentSources) : updater;
    }),
    setCustomerDebts: vi.fn((updater: any) => {
      state.customerDebts =
        typeof updater === "function" ? updater(state.customerDebts) : updater;
    }),
    setSupplierDebts: vi.fn((updater: any) => {
      state.supplierDebts =
        typeof updater === "function" ? updater(state.supplierDebts) : updater;
    }),
    setCartItems: vi.fn((updater: any) => {
      state.cartItems = typeof updater === "function" ? updater(state.cartItems) : updater;
    }),
    setInventoryTransactions: vi.fn((updater: any) => {
      state.inventoryTransactions =
        typeof updater === "function"
          ? updater(state.inventoryTransactions)
          : updater;
    }),
  };

  return { state, deps };
}

describe("salesRepository.createSaleAtomic compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetUser.mockResolvedValue({
      data: {
        user: {
          email: "tester@example.com",
          user_metadata: { name: "Tester" },
        },
      },
    });

    mockSalesInsert.mockResolvedValue({ error: null });
    mockWarrantyInsert.mockResolvedValue({ error: null });
    mockRpc.mockImplementation((rpcName: string, params: any) => {
      if (rpcName === "sale_create_atomic") {
        // RPC nguyên tử là đường duy nhất tạo đơn — trả thành công.
        return Promise.resolve({
          data: { success: true, saleId: params?.p_sale?.id },
          error: null,
        });
      }
      if (rpcName === "sale_decrement_stock_atomic") {
        return Promise.resolve({ data: { failedParts: [] }, error: null });
      }
      if (rpcName === "adjust_payment_source_balance_atomic") {
        return Promise.resolve({
          data: {
            id: params?.p_source_id || "cash",
            balance: { [params?.p_branch_id || "CN1"]: 185000 },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "sales") {
        return {
          insert: mockSalesInsert,
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === "warranty_cards") {
        return { insert: mockWarrantyInsert };
      }

      if (table === "customers") {
        const queryChain: any = {
          select: vi.fn().mockImplementation(() => queryChain),
          eq: vi.fn().mockImplementation(() => queryChain),
          limit: vi.fn().mockResolvedValue({
            data: [{ id: "CUST-1", totalspent: 0, visitcount: 0 }],
            error: null,
          }),
          single: vi.fn().mockResolvedValue({
            data: { totalspent: 0, visitcount: 0 },
            error: null,
          }),
        };
        return {
          select: vi.fn().mockImplementation(() => queryChain),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }

      if (table === "payment_sources" || table === "paymentsources") {
        const queryChain: any = {
          select: vi.fn().mockImplementation(() => queryChain),
          eq: vi.fn().mockImplementation(() => queryChain),
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          single: vi.fn().mockResolvedValue({
            data: { id: "cash", balance: { CN1: 0 } },
            error: null,
          }),
        };
        return {
          select: vi.fn().mockImplementation(() => queryChain),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              select: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { id: "cash", balance: { CN1: 185000 } },
                  error: null,
                }),
              }),
            }),
          }),
        };
      }

      if (table === "cash_transactions") {
        return {
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [], error: null }),
          }),
          insert: vi.fn().mockResolvedValue({ error: null }),
        };
      }

      throw new Error(`Unexpected table in test: ${table}`);
    });
  });

  it("finalizeSale updates local state atomically and persists sale payload", async () => {
    const { state, deps } = createDeps();
    const { result } = renderHook(() => useFinanceActions(deps as any));

    act(() => {
      result.current.finalizeSale({
        items: [
          {
            partId: "P-1",
            partName: "Bugi",
            sellingPrice: 100000,
            quantity: 2,
            discount: 10000,
            sku: "SKU-1",
          },
        ] as any,
        discount: 5000,
        paymentMethod: "cash",
        customer: { name: "Nguyen Van A", phone: "0909000000" },
        note: "Test atomic sale",
      });
    });

    expect(state.sales).toHaveLength(1);
    expect(state.sales[0].total).toBe(185000);
    expect(state.parts[0].stock.CN1).toBe(8);
    expect(state.cashTransactions).toHaveLength(1);
    expect(state.cashTransactions[0].amount).toBe(185000);
    expect(state.paymentSources[0].balance.CN1).toBe(185000);
    expect(state.cartItems).toHaveLength(0);

    // Đơn được tạo qua RPC nguyên tử, KHÔNG còn client tự insert vào bảng sales.
    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "sale_create_atomic",
        expect.objectContaining({ p_branch_id: "CN1", p_paid_amount: 185000 })
      );
    });

    const rpcCall = mockRpc.mock.calls.find(
      (c: any[]) => c[0] === "sale_create_atomic"
    );
    expect(rpcCall).toBeTruthy();
    expect(rpcCall![1].p_sale.total).toBe(185000);
    expect(mockSalesInsert).not.toHaveBeenCalled();
    expect(showToast.warning).not.toHaveBeenCalled();
  });

  it("finalizeSale thanh toán tách -> gọi sale_create_atomic_v2 và cộng nhiều nguồn", async () => {
    const { state, deps } = createDeps({
      paymentSources: [
        { id: "cash", balance: { CN1: 0 } },
        { id: "bank", balance: { CN1: 0 } },
      ],
    });

    // v2 trả thành công.
    mockRpc.mockImplementation((rpcName: string, params: any) => {
      if (rpcName === "sale_create_atomic_v2") {
        return Promise.resolve({
          data: { success: true, saleId: params?.p_sale?.id, paidTotal: 185000 },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(deps as any));

    act(() => {
      result.current.finalizeSale({
        items: [
          {
            partId: "P-1",
            partName: "Bugi",
            sellingPrice: 100000,
            quantity: 2,
            discount: 10000,
            sku: "SKU-1",
          },
        ] as any,
        discount: 5000,
        paymentMethod: "cash",
        customer: { name: "Khách lẻ" },
        payments: [
          { source: "cash", amount: 100000 },
          { source: "bank", amount: 85000 },
        ],
      });
    });

    // 2 giao dịch sổ quỹ + cộng đúng từng nguồn.
    expect(state.cashTransactions).toHaveLength(2);
    const cash = state.paymentSources.find((p: any) => p.id === "cash");
    const bank = state.paymentSources.find((p: any) => p.id === "bank");
    expect(cash.balance.CN1).toBe(100000);
    expect(bank.balance.CN1).toBe(85000);

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "sale_create_atomic_v2",
        expect.objectContaining({ p_branch_id: "CN1" })
      );
    });

    const v2Call = mockRpc.mock.calls.find(
      (c: any[]) => c[0] === "sale_create_atomic_v2"
    );
    expect(v2Call![1].p_payments).toEqual([
      { source: "cash", amount: 100000 },
      { source: "bank", amount: 85000 },
    ]);
  });
});
