import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFinanceActions } from "../../src/contexts/app/useFinanceActions";
import { showToast } from "../../src/utils/toast";

const mockFrom = vi.hoisted(() => vi.fn());
const mockSalesDeleteEq = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    auth: {
      getUser: vi.fn(),
    },
    from: mockFrom,
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
    parts: [{ id: "P-1", stock: { CN1: 7 } }],
    sales: [
      {
        id: "SALE-1",
        items: [{ partId: "P-1", quantity: 2 }],
        paymentMethod: "cash",
        total: 185000,
      },
    ],
    cashTransactions: [{ id: "CT-1", saleId: "SALE-1", amount: 185000 }],
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
    setCustomerDebts: vi.fn(),
    setSupplierDebts: vi.fn(),
    setCartItems: vi.fn(),
    setInventoryTransactions: vi.fn(),
  };

  return { state, deps };
}

describe("salesRepository.refundSale compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSalesDeleteEq.mockResolvedValue({ error: null });
    mockFrom.mockImplementation((table: string) => {
      if (table === "sales") {
        return {
          delete: () => ({
            eq: mockSalesDeleteEq,
          }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    });
  });

  it("deleteSale restores stock, reverts payment balance and clears sale-linked cash tx", async () => {
    const { state, deps } = createDeps();
    const { result } = renderHook(() => useFinanceActions(deps as any));

    act(() => {
      result.current.deleteSale("SALE-1");
    });

    await waitFor(() => {
      expect(mockSalesDeleteEq).toHaveBeenCalledWith("id", "SALE-1");
    });

    expect(state.sales).toHaveLength(0);
    expect(state.parts[0].stock.CN1).toBe(9);
    expect(state.cashTransactions).toHaveLength(0);
    expect(state.paymentSources[0].balance.CN1).toBe(115000);
    expect(showToast.success).toHaveBeenCalledWith(
      "Đã xóa phiếu bán hàng, hoàn kho và hoàn tiền thành công."
    );
  });
});
