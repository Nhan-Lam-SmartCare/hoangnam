import React from "react";
// (Optional jest-dom matchers removed to simplify environment)
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SalesManager from "../../src/components/sales/SalesManager";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// Capture last query params passed to useSalesPagedRepo
let lastParams: any = null;

vi.mock("../../src/utils/toast", () => ({
  showToast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({
    customers: [],
    upsertCustomer: vi.fn(),
    cartItems: [],
    setCartItems: vi.fn(),
    clearCart: vi.fn(),
    deleteSale: vi.fn(),
    currentBranchId: "CN1",
    finalizeSale: vi.fn(),
    setCashTransactions: vi.fn(),
    setPaymentSources: vi.fn(),
  }),
}));

vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    user: { id: "test-user", email: "test@example.com" },
    session: null,
    isAuthenticated: true,
  }),
}));

vi.mock("../../src/hooks/usePartsRepository", () => ({
  usePartsRepo: () => ({ data: [], isLoading: false, error: null }),
  useUpdatePartRepo: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../src/hooks/useInventoryTransactionsRepository", () => ({
  useCreateInventoryTxRepo: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../src/hooks/useCashTransactionsRepository", () => ({
  useCreateCashTxRepo: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../src/hooks/usePaymentSourcesRepository", () => ({
  useUpdatePaymentSourceBalanceRepo: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../src/hooks/useSalesRepository", async () => {
  return {
    useSalesRepo: () => ({ data: [], isLoading: false, error: null }),
    useCreateSaleAtomicRepo: () => ({ mutateAsync: vi.fn() }),
    useSalesPagedRepo: (params: any) => {
      lastParams = params;
      const page = params?.page ?? 1;
      const totalPages = 3;
      const sampleSale = {
        id: `SALE-12345-${page}`,
        date: new Date().toISOString(),
        customer: { id: "CUST-1", name: "Customer 1" },
        items: [],
        total: 100,
        branchId: "CN1",
      };
      return {
        data: {
          data: [sampleSale],
          meta: {
            mode: params?.mode || "offset",
            page,
            pageSize: params?.pageSize || 20,
            total: 100,
            totalPages,
            hasMore: page < totalPages,
          },
        },
        isLoading: false,
        error: null,
      } as any;
    },
  };
});

beforeEach(() => {
  lastParams = null;
});

describe("Sales history modal pagination (offset)", () => {
  it("opens modal and shows initial page indicator", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SalesManager />
      </QueryClientProvider>
    );
    const user = userEvent.setup();

    // open modal - button text is "Lịch sử" with title="Lịch sử bán hàng"
    // There can be multiple buttons with this name (desktop + mobile), use getAllByRole
    const historyButtons = screen.getAllByRole("button", {
      name: /^lịch sử$/i,
    });
    await user.click(historyButtons[0]);

    // page indicator should show 'Hiển thị 1 đơn hàng' from mocked hook data
    // There's no heading in the modal; wait until 'Hiển thị 1 đơn hàng' or similar is visible
    await screen.findByText(/Hiển thị\s+1\s*đơn hàng/i);
    expect(screen.getByText(/Hiển thị\s+1\s*đơn hàng/i)).not.toBeNull();
  });
});

describe("Sales history date presets", () => {
  it("applies 'Hôm nay' preset and updates query dates", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    render(
      <QueryClientProvider client={queryClient}>
        <SalesManager />
      </QueryClientProvider>
    );
    const user = userEvent.setup();

    // open modal - button text is "Lịch sử" with title="Lịch sử bán hàng"
    // There can be multiple buttons with this name (desktop + mobile), use getAllByRole
    const historyButtons = screen.getAllByRole("button", {
      name: /^lịch sử$/i,
    });
    await user.click(historyButtons[0]);

    // click preset '7 ngày qua'
    // Modal contains buttons like '7 ngày qua', 'Tuần', 'Tháng' — wait for a known button and click it
    await screen.findByRole("button", { name: /7 ngày qua/i });
    await user.click(screen.getByRole("button", { name: /7 ngày qua/i }));

    // The effect should have triggered onDateRangeChange; hook receives new params with from/to
    // Note: fromDate and toDate are ISO strings
    expect(lastParams).toBeTruthy();
    expect(typeof lastParams.fromDate === "string").toBe(true);
    expect(typeof lastParams.toDate === "string").toBe(true);

    // Sanity: fromDate <= toDate
    const from = new Date(lastParams.fromDate).getTime();
    const to = new Date(lastParams.toDate).getTime();
    expect(from).toBeLessThanOrEqual(to);
  });
});
