import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchCashTransactions,
  createCashTransaction,
} from "../../src/lib/repository/cashTransactionsRepository";

// Mocks
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockAuth = {
  getUser: vi.fn(),
};

vi.spyOn(client, "supabase", "get").mockReturnValue({
  from: mockFrom,
  auth: mockAuth,
} as any);

function makeOrderedQuery(data: any = [], error: any = null) {
  return {
    data,
    error,
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    lte() {
      return this;
    },
    limit() {
      return this;
    },
  } as any;
}

function makeSelectResult(data: any = [], error: any = null) {
  return {
    order: () => makeOrderedQuery(data, error),
    limit: () => ({ data, error }),
  } as any;
}

mockFrom.mockImplementation((table: string) => {
  return {
    select: () => mockSelect(table),
    insert: (rows: any[]) => mockInsert(table, rows),
  } as any;
});

beforeEach(() => {
  mockSelect.mockImplementation((_table: string) => makeSelectResult([], null));
  mockInsert.mockImplementation((_table: string, _rows: any[]) => ({ error: null }));
  mockAuth.getUser.mockResolvedValue({
    data: {
      user: {
        id: "test-user-id",
        email: "test@example.com",
        user_metadata: { name: "Test User" },
      },
    },
    error: null,
  });
});

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
    mockSelect.mockImplementation((_table: string) =>
      makeSelectResult(null, { message: "DB error" })
    );
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
