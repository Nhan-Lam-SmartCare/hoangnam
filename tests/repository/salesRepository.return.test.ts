import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFinanceActions } from "../../src/contexts/app/useFinanceActions";

const mockRpc = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    auth: { getUser: mockGetUser },
    from: vi.fn(),
    rpc: mockRpc,
  },
}));

vi.mock("../../src/utils/toast", () => ({
  showToast: { success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn() },
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
    parts: [{ id: "P-1", stock: { CN1: 7 } }],
    sales: [
      {
        id: "SALE-1",
        branchId: "CN1",
        items: [
          { partId: "P-1", partName: "Bugi", quantity: 2, sellingPrice: 100000 },
        ],
        paymentMethod: "cash",
        total: 200000,
      },
    ],
    cashTransactions: [],
    paymentSources: [{ id: "cash", balance: { CN1: 300000 } }],
    cartItems: [],
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
    setSales: vi.fn((u: any) => {
      state.sales = typeof u === "function" ? u(state.sales) : u;
      deps.sales = state.sales;
    }),
    setParts: vi.fn((u: any) => {
      state.parts = typeof u === "function" ? u(state.parts) : u;
      deps.parts = state.parts;
    }),
    setCashTransactions: vi.fn((u: any) => {
      state.cashTransactions =
        typeof u === "function" ? u(state.cashTransactions) : u;
    }),
    setPaymentSources: vi.fn((u: any) => {
      state.paymentSources =
        typeof u === "function" ? u(state.paymentSources) : u;
    }),
    setCustomerDebts: vi.fn(),
    setSupplierDebts: vi.fn(),
    setCartItems: vi.fn(),
    setInventoryTransactions: vi.fn(),
  };

  return { state, deps };
}

describe("returnSaleItems (đổi/trả một phần)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === "sale_return_partial_atomic") {
        return Promise.resolve({
          data: {
            success: true,
            returnId: "RET-1",
            branchId: "CN1",
            refunds: { cash: 100000 },
            fullyReturned: false,
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });
  });

  it("hoàn kho, hoàn tiền và cập nhật returnedQty", async () => {
    const { state, deps } = createDeps();
    const { result } = renderHook(() => useFinanceActions(deps as any));

    act(() => {
      result.current.returnSaleItems({
        saleId: "SALE-1",
        items: [{ partId: "P-1", quantity: 1 }],
        refundAmount: 100000,
        refundSource: "cash",
      });
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith(
        "sale_return_partial_atomic",
        expect.objectContaining({ p_sale_id: "SALE-1", p_refund_amount: 100000 })
      );
    });

    // Hoàn kho +1.
    expect(state.parts[0].stock.CN1).toBe(8);
    // Hoàn tiền -> trừ số dư nguồn.
    expect(state.paymentSources[0].balance.CN1).toBe(200000);
    // Ghi 1 giao dịch chi.
    expect(state.cashTransactions).toHaveLength(1);
    expect(state.cashTransactions[0].type).toBe("expense");
    // returnedQty cập nhật.
    expect(state.sales[0].items[0].returnedQty).toBe(1);
  });

  it("chặn trả khi RPC báo vượt số lượng", async () => {
    const { state, deps } = createDeps();
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === "sale_return_partial_atomic") {
        return Promise.resolve({
          data: {
            success: false,
            message: "Số lượng trả vượt quá số còn lại",
            invalid: [{ partId: "P-1", requested: 5, returnable: 2 }],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(deps as any));
    act(() => {
      result.current.returnSaleItems({
        saleId: "SALE-1",
        items: [{ partId: "P-1", quantity: 5 }],
        refundAmount: 0,
        refundSource: "cash",
      });
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalled();
    });

    // Không đổi state khi thất bại.
    expect(state.parts[0].stock.CN1).toBe(7);
    expect(state.paymentSources[0].balance.CN1).toBe(300000);
    expect(state.cashTransactions).toHaveLength(0);
  });
});
