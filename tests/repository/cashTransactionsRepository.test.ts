import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchCashTransactions,
  createCashTransaction,
} from "../../src/lib/repository/cashTransactionsRepository";

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

describe("cashTransactionsRepository", () => {
  it("fetchCashTransactions success", async () => {
    const res = await fetchCashTransactions();
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("createCashTransaction success", async () => {
    const res = await createCashTransaction({
      type: "income",
      amount: 100000,
      branchId: "CN1",
      paymentSourceId: "cash",
      category: "general_income",
    });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.amount).toBe(100000);
  });

  it("fetchCashTransactions supabase error", async () => {
    injectSelectErrorOnce("DB error");
    const res = await fetchCashTransactions();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("createCashTransaction validation error when missing amount", async () => {
    const res = await createCashTransaction({
      type: "income",
      amount: 0,
      branchId: "CN1",
      paymentSourceId: "cash",
    } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
  });
});
