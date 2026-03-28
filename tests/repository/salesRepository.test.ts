import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchSales,
  createSale,
  deleteSaleById,
} from "../../src/lib/repository/salesRepository";

// Mocks
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockDelete = vi.fn();
const mockRpc = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({
  from: mockFrom,
  rpc: mockRpc,
} as any);

mockFrom.mockImplementation((table: string) => {
  return {
    select: () => mockSelect(table),
    insert: (rows: any[]) => mockInsert(table, rows),
    delete: () => mockDelete(table),
  } as any;
});

// Success defaults
mockSelect.mockImplementation((_table: string) => ({
  data: [],
  error: null,
  order: () => ({ data: [], error: null }),
}));
mockInsert.mockImplementation((_table: string, rows: any[]) => ({
  select: () => ({ single: () => ({ data: rows[0], error: null }) }),
}));
mockDelete.mockImplementation((_table: string) => ({
  eq: () => ({ error: null }),
}));

// RPC mock for deleteSaleById (uses sale_delete_atomic)
mockRpc.mockImplementation((fnName: string, params?: any) => {
  if (fnName === "sale_delete_atomic") {
    return Promise.resolve({ data: { id: params?.p_sale_id }, error: null });
  }
  return Promise.resolve({ data: null, error: null });
});

function injectSelectErrorOnce(errorMsg: string) {
  mockSelect.mockImplementationOnce((_table: string) => ({
    order: () => ({ data: null, error: { message: errorMsg } }),
  }));
}

describe("salesRepository", () => {
  it("fetchSales success", async () => {
    const res = await fetchSales();
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("createSale success", async () => {
    const res = await createSale({
      items: [
        {
          partId: "p1",
          partName: "A",
          sku: "SKU1",
          quantity: 1,
          sellingPrice: 100000,
          stockSnapshot: 10,
        },
      ],
      subtotal: 100000,
      discount: 0,
      total: 100000,
      customer: { name: "KH Lẻ" },
      paymentMethod: "cash",
      userId: "u1",
      userName: "User 1",
      branchId: "CN1",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.total).toBe(100000);
  });

  it("deleteSaleById success", async () => {
    const res = await deleteSaleById("SALE-1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("SALE-1");
  });

  it("fetchSales supabase error", async () => {
    injectSelectErrorOnce("DB error");
    const res = await fetchSales();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("createSale validation error when missing items", async () => {
    const res = await createSale({ total: 0, paymentMethod: "cash" } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
  });
});
