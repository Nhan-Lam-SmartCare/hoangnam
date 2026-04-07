import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchParts,
  renameCategory,
  deleteCategory,
} from "../../src/lib/repository/partsRepository";

// Simple mock for supabase.from().select().order()
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockOrder = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({
  from: mockFrom,
} as any);

mockFrom.mockImplementation((table: string) => {
  return {
    select: (cols?: string) => mockSelect(table, cols),
    update: (updates: any) => mockUpdate(table, updates),
  } as any;
});

mockSelect.mockImplementation((_table: string, _cols?: string) => {
  return {
    order: (_col: string) => mockOrder(),
    single: () => ({ data: { id: "1" }, error: null }),
  } as any;
});

mockOrder.mockImplementation(() => ({ data: [], error: null }));

mockUpdate.mockImplementation((_table: string, _updates: any) => ({
  eq: (_field: string, _val: any) => ({
    select: (_cols?: string) => ({ data: [{ id: "1" }], error: null }),
  }),
}));

describe("partsRepository", () => {
  it("fetchParts returns data ok", async () => {
    const res = await fetchParts();
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("renameCategory returns updated count", async () => {
    const res = await renameCategory("Old", "New");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.updated).toBeGreaterThanOrEqual(0);
  });

  it("deleteCategory returns updated count", async () => {
    const res = await deleteCategory("Any");
    expect(res.ok).toBe(true);
  });
});
