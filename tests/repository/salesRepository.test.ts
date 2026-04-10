import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import { supabaseHelpers } from "../../src/lib/supabase";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

mockFrom.mockImplementation((table: string) => ({
  select: () => mockSelect(table),
  insert: (rows: any[]) => mockInsert(table, rows),
}));

describe("salesRepository compatibility", () => {
  it("getSales returns descending date data", async () => {
    mockSelect.mockImplementationOnce((_table: string) => ({
      order: (col: string, opts: any) => {
        mockOrder(col, opts);
        return Promise.resolve({
          data: [
            { id: "S-2", date: "2026-04-02", total: 200000 },
            { id: "S-1", date: "2026-04-01", total: 100000 },
          ],
          error: null,
        });
      },
    }));

    const sales = await supabaseHelpers.getSales();

    expect(mockFrom).toHaveBeenCalledWith("sales");
    expect(mockOrder).toHaveBeenCalledWith("date", { ascending: false });
    expect(sales).toHaveLength(2);
  });

  it("createSale returns inserted sale row", async () => {
    const created = { id: "S-NEW", total: 150000 };
    mockInsert.mockImplementationOnce((_table: string, _rows: any[]) => ({
      select: () => ({
        single: () => Promise.resolve({ data: created, error: null }),
      }),
    }));

    const res = await supabaseHelpers.createSale({
      id: "S-NEW",
      total: 150000,
      date: "2026-04-10",
    });

    expect(mockFrom).toHaveBeenCalledWith("sales");
    expect(res).toEqual(created);
  });
});
