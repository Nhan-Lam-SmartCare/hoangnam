import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useFinanceActions } from "../../src/contexts/app/useFinanceActions";
import { createQueryWrapper } from "../helpers/queryWrapper";
import { showToast } from "../../src/utils/toast";

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockSalesDeleteEq = vi.hoisted(() => vi.fn());

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

    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockSalesDeleteEq.mockResolvedValue({ error: null });

    // RPC: hoàn kho nguyên tử + đảo số dư nguồn tiền nguyên tử.
    mockRpc.mockImplementation((rpcName: string, params: any) => {
      if (rpcName === "sale_increment_stock_atomic") {
        return Promise.resolve({ data: { success: true }, error: null });
      }
      if (rpcName === "adjust_payment_source_balance_atomic") {
        return Promise.resolve({
          data: {
            id: params?.p_source_id || "cash",
            balance: { [params?.p_branch_id || "CN1"]: 0 },
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    mockFrom.mockImplementation((table: string) => {
      if (table === "sales") {
        return {
          delete: () => ({ eq: mockSalesDeleteEq }),
        };
      }
      if (table === "cash_transactions") {
        return {
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: { id: "CT-1", amount: 185000, type: "income", paymentsource: "cash", branchid: "CN1" },
                  error: null,
                }),
            }),
            or: () =>
              Promise.resolve({
                data: [{ id: "CT-1", amount: 185000, type: "income", paymentsource: "cash", branchid: "CN1" }],
                error: null,
              }),
          }),
          delete: () => ({
            eq: () => Promise.resolve({ error: null }),
          }),
        };
      }
      if (table === "customer_debts" || table === "customerdebts") {
        return {
          select: () => ({
            or: () => Promise.resolve({ data: [], error: null }),
          }),
        };
      }
      throw new Error(`Unexpected table in test: ${table}`);
    });
  });

  it("deleteSale restores stock, reverts payment balance and clears sale-linked cash tx", async () => {
    const { state, deps } = createDeps();
    const { result } = renderHook(() => useFinanceActions(deps as any), {
      wrapper: createQueryWrapper(),
    });

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

  it("deleteSale dùng RPC sale_delete_atomic khi đã deploy (không chạy fallback từng bước)", async () => {
    const { state, deps } = createDeps();

    // Ghi đè: RPC xóa đơn nguyên tử đã deploy -> trả kết quả hoàn tiền.
    mockRpc.mockImplementation((rpcName: string) => {
      if (rpcName === "sale_delete_atomic") {
        return Promise.resolve({
          data: {
            success: true,
            branchId: "CN1",
            refunds: { cash: 185000 },
            removedCashTxIds: ["CT-1"],
          },
          error: null,
        });
      }
      return Promise.resolve({ data: null, error: null });
    });

    const { result } = renderHook(() => useFinanceActions(deps as any), {
      wrapper: createQueryWrapper(),
    });

    act(() => {
      result.current.deleteSale("SALE-1");
    });

    await waitFor(() => {
      expect(mockRpc).toHaveBeenCalledWith("sale_delete_atomic", {
        p_sale_id: "SALE-1",
        p_branch_id: "CN1",
      });
    });

    // Trạng thái cục bộ được cập nhật từ kết quả RPC.
    expect(state.sales).toHaveLength(0);
    expect(state.parts[0].stock.CN1).toBe(9);
    expect(state.cashTransactions).toHaveLength(0);
    expect(state.paymentSources[0].balance.CN1).toBe(115000);
    // KHÔNG chạy nhánh fallback (không tự delete bảng sales phía client).
    expect(mockSalesDeleteEq).not.toHaveBeenCalled();
    expect(showToast.success).toHaveBeenCalledWith(
      "Đã xóa phiếu bán hàng, hoàn kho và hoàn tiền thành công."
    );
  });
});
