import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchInventoryTransactions,
  createInventoryTransaction,
} from "../../src/lib/repository/inventoryTransactionsRepository";

// Mocks
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

mockFrom.mockImplementation((table: string) => {
  return {
    select: () => mockSelect(table),
    insert: (rows: any[]) => mockInsert(table, rows),
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

function injectSelectErrorOnce(errorMsg: string) {
  mockSelect.mockImplementationOnce((_table: string) => ({
    order: () => ({ data: null, error: { message: errorMsg } }),
  }));
}

describe("inventoryTransactionsRepository", () => {
  it("fetchInventoryTransactions success", async () => {
    const res = await fetchInventoryTransactions();
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("createInventoryTransaction success", async () => {
    const res = await createInventoryTransaction({
      type: "Xuất kho",
      partId: "p1",
      partName: "Phụ tùng A",
      quantity: 2,
      branchId: "CN1",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.quantity).toBe(2);
  });

  it("fetchInventoryTransactions supabase error", async () => {
    injectSelectErrorOnce("DB error");
    const res = await fetchInventoryTransactions();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("createInventoryTransaction validation error when missing partId", async () => {
    const res = await createInventoryTransaction({
      type: "Nhập kho",
      partId: "",
      partName: "",
      quantity: 0,
      branchId: "",
    } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
  });
});
