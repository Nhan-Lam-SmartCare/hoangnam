/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSearchFilter } from "../../src/hooks/useSearchFilter";

interface TestItem extends Record<string, unknown> {
  id: number;
  name: string;
  category: string;
  price: number;
}

const mockItems: TestItem[] = [
  { id: 1, name: "Nhớt Castrol", category: "Dầu nhớt", price: 150000 },
  { id: 2, name: "Nhớt Motul", category: "Dầu nhớt", price: 200000 },
  { id: 3, name: "Lọc gió", category: "Phụ tùng", price: 80000 },
  { id: 4, name: "Bugi NGK", category: "Phụ tùng", price: 50000 },
  { id: 5, name: "Phanh đĩa", category: "Phanh", price: 300000 },
];

describe("useSearchFilter", () => {
  it("should return all items when search query is empty", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name", "category"],
      })
    );

    expect(result.current.filteredItems).toHaveLength(5);
    expect(result.current.searchQuery).toBe("");
    expect(result.current.hasResults).toBe(true);
    expect(result.current.resultCount).toBe(5);
  });

  it("should filter items by name", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    act(() => {
      result.current.setSearchQuery("nhớt");
    });

    expect(result.current.filteredItems).toHaveLength(2);
    expect(result.current.filteredItems[0].name).toBe("Nhớt Castrol");
    expect(result.current.filteredItems[1].name).toBe("Nhớt Motul");
  });

  it("should filter items by category", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["category"],
      })
    );

    act(() => {
      result.current.setSearchQuery("phụ tùng");
    });

    expect(result.current.filteredItems).toHaveLength(2);
    expect(result.current.filteredItems[0].name).toBe("Lọc gió");
    expect(result.current.filteredItems[1].name).toBe("Bugi NGK");
  });

  it("should be case-insensitive", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    act(() => {
      result.current.setSearchQuery("CASTROL");
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe("Nhớt Castrol");
  });

  it("should search across multiple fields", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name", "category"],
      })
    );

    // Search for 'phanh' should match both name and category
    act(() => {
      result.current.setSearchQuery("phanh");
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe("Phanh đĩa");
  });

  it("should return empty array when no matches", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    act(() => {
      result.current.setSearchQuery("không tồn tại");
    });

    expect(result.current.filteredItems).toHaveLength(0);
    expect(result.current.hasResults).toBe(false);
    expect(result.current.resultCount).toBe(0);
  });

  it("should clear search", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    act(() => {
      result.current.setSearchQuery("nhớt");
    });

    expect(result.current.filteredItems).toHaveLength(2);

    act(() => {
      result.current.clearSearch();
    });

    expect(result.current.searchQuery).toBe("");
    expect(result.current.filteredItems).toHaveLength(5);
  });

  it("should handle whitespace-only search query", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    act(() => {
      result.current.setSearchQuery("   ");
    });

    // Should return all items when query is only whitespace
    expect(result.current.filteredItems).toHaveLength(5);
  });

  it("should handle partial matches", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    act(() => {
      result.current.setSearchQuery("gió");
    });

    // Should match 'Lọc gió'
    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe("Lọc gió");
  });

  it("should handle items with null/undefined values", () => {
    const itemsWithNull = [
      { id: 1, name: "Test", category: null },
      { id: 2, name: null, category: "Cat" },
      { id: 3, name: "Valid", category: "Valid" },
    ] as unknown as TestItem[];

    const { result } = renderHook(() =>
      useSearchFilter({
        items: itemsWithNull,
        searchFields: ["name", "category"],
      })
    );

    act(() => {
      result.current.setSearchQuery("Valid");
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].id).toBe(3);
  });

  it("should search numeric fields as strings", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["price"] as any,
      })
    );

    act(() => {
      result.current.setSearchQuery("150000");
    });

    expect(result.current.filteredItems).toHaveLength(1);
    expect(result.current.filteredItems[0].name).toBe("Nhớt Castrol");
  });

  it("should update resultCount when filters change", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: mockItems,
        searchFields: ["name"],
      })
    );

    expect(result.current.resultCount).toBe(5);

    act(() => {
      result.current.setSearchQuery("nhớt");
    });

    expect(result.current.resultCount).toBe(2);

    act(() => {
      result.current.setSearchQuery("castrol");
    });

    expect(result.current.resultCount).toBe(1);
  });
});
