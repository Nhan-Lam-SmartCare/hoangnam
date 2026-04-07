import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategoryRecord,
} from "../../src/lib/repository/categoriesRepository";

// Mocks
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

mockFrom.mockImplementation((table: string) => {
  return {
    select: () => mockSelect(table),
    insert: (rows: any[]) => mockInsert(table, rows),
    update: (updates: any) => mockUpdate(table, updates),
    delete: () => mockDelete(table),
  } as any;
});

// Success paths
mockSelect.mockImplementation((_table: string) => ({
  data: [],
  error: null,
  order: () => ({ data: [], error: null }),
}));
mockInsert.mockImplementation((_table: string, rows: any[]) => ({
  select: () => ({ single: () => ({ data: rows[0], error: null }) }),
}));
mockUpdate.mockImplementation((_table: string, updates: any) => ({
  eq: () => ({
    select: () => ({
      single: () => ({ data: { id: "1", ...updates }, error: null }),
    }),
  }),
}));
mockDelete.mockImplementation((_table: string) => ({
  eq: () => ({ error: null }),
}));

// Error injection helper
function injectErrorOnce(method: any, errorMsg: string) {
  method.mockImplementationOnce(() => ({
    order: () => ({
      data: null,
      error: { message: errorMsg },
    }),
  }));
}

describe("categoriesRepository", () => {
  it("fetchCategories success", async () => {
    const res = await fetchCategories();
    expect(res.ok).toBe(true);
    if (res.ok) expect(Array.isArray(res.data)).toBe(true);
  });

  it("createCategory success", async () => {
    const res = await createCategory({ name: "Phu tung" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.name).toBe("Phu tung");
  });

  it("updateCategory success", async () => {
    const res = await updateCategory("1", { name: "Updated" });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.name).toBe("Updated");
  });

  it("deleteCategory success", async () => {
    const res = await deleteCategoryRecord("1");
    expect(res.ok).toBe(true);
  });

  it("fetchCategories supabase error", async () => {
    injectErrorOnce(mockSelect, "DB error");
    const res = await fetchCategories();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("createCategory validation error", async () => {
    const res = await createCategory({});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
  });
});
