import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import SalesManager from "../../src/components/sales/SalesManager";
import { showToast } from "../../src/utils/toast";

// Set up mock states that tests can manipulate
let mockCartItems: any[] = [];
const mockSetCartItems = vi.fn((updater: any) => {
  mockCartItems = typeof updater === "function" ? updater(mockCartItems) : updater;
});
let mockParts: any[] = [];
const mockFinalizeSale = vi.fn().mockResolvedValue({ ok: true, saleId: "S-1" });

// Mock showToast
vi.mock("../../src/utils/toast", () => ({
  showToast: {
    success: vi.fn(),
    warning: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}));

// Mock AppContext
vi.mock("../../src/contexts/AppContext", () => ({
  useAppContext: () => ({
    parts: mockParts,
    customers: [],
    cartItems: mockCartItems,
    setCartItems: mockSetCartItems,
    setParts: vi.fn(),
    setSales: vi.fn(),
    currentBranchId: "CN1",
    finalizeSale: mockFinalizeSale,
    deleteSale: vi.fn(),
    sales: [],
  }),
}));

// Mock AuthContext
vi.mock("../../src/contexts/AuthContext", () => ({
  useAuth: () => ({
    profile: { id: "emp-1", name: "Test Seller", role: "owner" },
  }),
}));

// Mock other hooks
vi.mock("../../src/hooks/useSupabase", () => ({
  useCustomers: () => ({ data: [] }),
  useSales: () => ({ data: [], isSuccess: true }),
  useCreateCustomer: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../src/hooks/usePartsRepository", () => ({
  usePartsRepo: () => ({ data: mockParts, isSuccess: true, isFetching: false, refetch: vi.fn() }),
  usePartsRepoPaged: () => ({ data: { ok: true, data: mockParts } }),
}));

// Không có máy IMEI nào -> mọi sản phẩm vẫn thêm vào giỏ theo số lượng như cũ.
vi.mock("../../src/hooks/usePartUnitsRepository", () => ({
  useSerializedPartIds: () => ({ serializedIds: new Set<string>() }),
}));

vi.mock("../../src/hooks/usePrinter", () => ({
  usePrinter: () => ({ isNative: false, printViaWiFi: vi.fn(), printViaBluetooth: vi.fn() }),
}));

vi.mock("../../src/hooks/useEmployeesRepository", () => ({
  useEmployeesDirectoryRepo: () => ({
    data: [{ id: "emp-1", name: "Test Seller", position: "Seller", branchId: "CN1" }],
  }),
}));

describe("SalesManager service/labor item stock validation bypass", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCartItems = [];
    mockParts = [
      {
        id: "part-1",
        name: "Lốp xe máy",
        sku: "LOP-XM",
        category: "Phụ tùng",
        stock: { CN1: 0 },
        retailPrice: { CN1: 150000 },
      },
      {
        id: "service-1",
        name: "Công vá xe",
        sku: "CONG-VA",
        category: "dịch vụ",
        stock: { CN1: 0 },
        retailPrice: { CN1: 20000 },
      },
    ];
  });

  it("filters out out-of-stock physical items but displays and allows adding service items", async () => {
    render(<SalesManager />);

    // Verify out-of-stock physical item is NOT displayed in products list
    expect(screen.queryByText("Lốp xe máy")).toBeNull();

    // Verify service item is displayed in products list
    const congBtn = await screen.findByText("Công vá xe");
    expect(congBtn).not.toBeNull();

    // Click service item to add to cart
    fireEvent.click(congBtn);

    // Verify warning toast is NOT called and item is added
    expect(showToast.warning).not.toHaveBeenCalled();
    expect(mockCartItems).toHaveLength(1);
    expect(mockCartItems[0].partId).toBe("service-1");
    expect(mockCartItems[0].isService).toBe(true);
  });
});
