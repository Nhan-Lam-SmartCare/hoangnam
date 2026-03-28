import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import { fetchSalesPaged } from "../../src/lib/repository/salesRepository";

// Minimal Postgrest-like builder mock
function makeBuilder(rows: any[], count: number, error: any = null) {
  const ctx: any = {
    _rows: rows,
    _count: count,
    _error: error,
    select() {
      return this;
    },
    order() {
      return this;
    },
    eq() {
      return this;
    },
    gte() {
      return this;
    },
    lte() {
      return this;
    },
    or() {
      return this;
    },
    range() {
      return Promise.resolve({
        data: this._rows,
        error: this._error,
        count: this._count,
      });
    },
  };
  return ctx;
}

const mockFrom = vi.fn();
vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

describe("fetchSalesPaged", () => {
  it("returns first page meta correctly", async () => {
    const rows = Array.from({ length: 5 }).map((_, i) => ({
      id: `S${i + 1}`,
      date: new Date().toISOString(),
      items: [],
      total: 100,
      discount: 0,
      customer: { name: "KH" },
      paymentMethod: "cash",
      userId: "u",
      branchId: "B1",
    }));
    mockFrom.mockImplementationOnce((_table: string) => makeBuilder(rows, 25));
    const res = await fetchSalesPaged({ page: 1, pageSize: 5 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.meta?.total).toBe(25);
      expect(res.meta?.totalPages).toBe(5);
      expect(res.data.length).toBe(5);
    }
  });

  it("maps supabase error", async () => {
    mockFrom.mockImplementationOnce((_table: string) =>
      makeBuilder([], 0, { message: "db fail" })
    );
    const res = await fetchSalesPaged({ page: 1, pageSize: 10 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });
});
