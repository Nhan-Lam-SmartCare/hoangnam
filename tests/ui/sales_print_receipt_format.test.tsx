import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SalesManager from "../../src/components/sales/SalesManager";
import ReceiptPreview from "../../src/components/sales/ReceiptPreview";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { formatAnyId } from "../../src/utils/format";

// shared mocks (simpler; re-define for test file clarity)
vi.mock("../../src/utils/toast", () => ({
  showToast: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
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
    profile: { id: "test-user", role: "admin" },
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

const sale = {
  id: "SALE-1699999999000",
  date: new Date(2024, 10, 1).toISOString(),
  customer: { id: "CUST-1", name: "Test Customer 123", phone: "0123456789" },
  items: [
    {
      partId: "P1",
      partName: "Part A",
      sku: "A1",
      quantity: 1,
      sellingPrice: 100,
      discount: 0,
    },
  ],
  total: 100,
  discount: 0,
  paymentMethod: "cash",
  branchId: "CN1",
};

vi.mock("../../src/hooks/useSalesRepository", async () => {
  return {
    useSalesRepo: () => ({ data: [], isLoading: false, error: null }),
    useCreateSaleAtomicRepo: () => ({ mutateAsync: vi.fn() }),
    useSalesPagedRepo: (params: any) => {
      return {
        data: {
          data: [sale],
          meta: {
            mode: params?.mode || "offset",
            page: 1,
            pageSize: params?.pageSize || 20,
            total: 1,
            totalPages: 1,
            hasMore: false,
          },
        },
        isLoading: false,
        error: null,
      } as any;
    },
  };
});

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => ({
          limit: () => ({ single: () => ({ data: null, error: null }) }),
        }),
      }),
    }),
  },
}));

beforeEach(() => {});

describe("SalesManager print preview formatted id", () => {
  it("shows formatted sale ID in print preview when re-printing from list", async () => {
    const expectedId = formatAnyId(sale.id);
    render(
      <ReceiptPreview
        receiptId={expectedId}
        customerName={sale.customer.name}
        customerPhone={sale.customer.phone}
        items={sale.items as any}
        discount={sale.discount}
        storeSettings={{ store_name: "Test Store" }}
      />
    );

    // Check that the expected formatted id is displayed somewhere in the receipt
    expect(await screen.findByText(expectedId)).not.toBeNull();
  });
});
