/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { usePagination } from "../../src/hooks/usePagination";

describe("usePagination", () => {
  it("should initialize with correct default values", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, itemsPerPage: 10 })
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(10);
    expect(result.current.startIndex).toBe(0);
    expect(result.current.endIndex).toBe(10);
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.hasPrevPage).toBe(false);
  });

  it("should handle custom initial page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, initialPage: 3, itemsPerPage: 10 })
    );

    expect(result.current.currentPage).toBe(3);
    expect(result.current.startIndex).toBe(20);
    expect(result.current.endIndex).toBe(30);
  });

  it("should calculate totalPages correctly", () => {
    // Exact division
    const { result: result1 } = renderHook(() =>
      usePagination({ totalItems: 50, itemsPerPage: 10 })
    );
    expect(result1.current.totalPages).toBe(5);

    // With remainder
    const { result: result2 } = renderHook(() =>
      usePagination({ totalItems: 55, itemsPerPage: 10 })
    );
    expect(result2.current.totalPages).toBe(6);

    // Zero items
    const { result: result3 } = renderHook(() =>
      usePagination({ totalItems: 0, itemsPerPage: 10 })
    );
    expect(result3.current.totalPages).toBe(1); // Minimum 1 page
  });

  it("should navigate to next page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, itemsPerPage: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.startIndex).toBe(10);
    expect(result.current.hasPrevPage).toBe(true);
  });

  it("should navigate to previous page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, initialPage: 3, itemsPerPage: 10 })
    );

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it("should not go below page 1", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, itemsPerPage: 10 })
    );

    act(() => {
      result.current.prevPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it("should not go above total pages", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, initialPage: 5, itemsPerPage: 10 })
    );

    act(() => {
      result.current.nextPage();
    });

    expect(result.current.currentPage).toBe(5);
  });

  it("should go to specific page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, itemsPerPage: 10 })
    );

    act(() => {
      result.current.goToPage(5);
    });

    expect(result.current.currentPage).toBe(5);
  });

  it("should clamp page within bounds when using goToPage", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 50, itemsPerPage: 10 })
    );

    // Try to go to page beyond total
    act(() => {
      result.current.goToPage(100);
    });
    expect(result.current.currentPage).toBe(5);

    // Try to go to page below 1
    act(() => {
      result.current.goToPage(-5);
    });
    expect(result.current.currentPage).toBe(1);
  });

  it("should reset to first page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 100, initialPage: 7, itemsPerPage: 10 })
    );

    act(() => {
      result.current.resetPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it("should slice items correctly with pageItems", () => {
    const items = Array.from({ length: 25 }, (_, i) => ({ id: i + 1 }));

    const { result } = renderHook(() =>
      usePagination({ totalItems: items.length, itemsPerPage: 10 })
    );

    // Page 1
    let pagedItems = result.current.pageItems(items);
    expect(pagedItems).toHaveLength(10);
    expect(pagedItems[0].id).toBe(1);
    expect(pagedItems[9].id).toBe(10);

    // Go to page 2
    act(() => {
      result.current.nextPage();
    });

    pagedItems = result.current.pageItems(items);
    expect(pagedItems).toHaveLength(10);
    expect(pagedItems[0].id).toBe(11);
    expect(pagedItems[9].id).toBe(20);

    // Go to page 3 (last page with 5 items)
    act(() => {
      result.current.nextPage();
    });

    pagedItems = result.current.pageItems(items);
    expect(pagedItems).toHaveLength(5);
    expect(pagedItems[0].id).toBe(21);
    expect(pagedItems[4].id).toBe(25);
  });

  it("should handle endIndex correctly for last page", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 25, itemsPerPage: 10 })
    );

    // Go to last page
    act(() => {
      result.current.goToPage(3);
    });

    expect(result.current.startIndex).toBe(20);
    expect(result.current.endIndex).toBe(25); // Not 30
  });

  it("should update hasNextPage and hasPrevPage correctly", () => {
    const { result } = renderHook(() =>
      usePagination({ totalItems: 30, itemsPerPage: 10 })
    );

    // Page 1
    expect(result.current.hasPrevPage).toBe(false);
    expect(result.current.hasNextPage).toBe(true);

    // Page 2
    act(() => {
      result.current.goToPage(2);
    });
    expect(result.current.hasPrevPage).toBe(true);
    expect(result.current.hasNextPage).toBe(true);

    // Page 3 (last)
    act(() => {
      result.current.goToPage(3);
    });
    expect(result.current.hasPrevPage).toBe(true);
    expect(result.current.hasNextPage).toBe(false);
  });
});
