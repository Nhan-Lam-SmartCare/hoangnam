import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import { supabaseHelpers } from "../../src/lib/supabase";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({
  from: mockFrom,
} as any);

mockFrom.mockImplementation((table: string) => ({
  select: () => mockSelect(table),
}));

mockSelect.mockImplementation((_table: string) => ({
  order: (col: string, opts: any) => mockOrder(col, opts),
}));

describe("salesRepository.fetchSalesPaged compatibility", () => {
  it("getSales keeps descending date query and supports deterministic page slicing", async () => {
    const rows = [
      { id: "S-3", date: "2026-04-03T10:00:00.000Z", total: 300000 },
      { id: "S-2", date: "2026-04-02T10:00:00.000Z", total: 200000 },
      { id: "S-1", date: "2026-04-01T10:00:00.000Z", total: 100000 },
    ];

    mockOrder.mockResolvedValueOnce({ data: rows, error: null });

    const sales = await supabaseHelpers.getSales();

    expect(mockFrom).toHaveBeenCalledWith("sales");
    expect(mockOrder).toHaveBeenCalledWith("date", { ascending: false });
    expect(sales.map((s: any) => s.id)).toEqual(["S-3", "S-2", "S-1"]);

    const pageSize = 2;
    const page1 = sales.slice(0, pageSize);
    const page2 = sales.slice(pageSize, pageSize * 2);

    expect(page1.map((s: any) => s.id)).toEqual(["S-3", "S-2"]);
    expect(page2.map((s: any) => s.id)).toEqual(["S-1"]);
  });
});
