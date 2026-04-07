import { useState, useCallback, useMemo } from "react";

/**
 * Props for the usePagination hook
 */
interface UsePaginationProps {
  /** Total number of items across all pages */
  totalItems: number;
  /** Starting page number (default: 1) */
  initialPage?: number;
  /** Number of items per page (default: 10) */
  itemsPerPage?: number;
}

/**
 * Return type for the usePagination hook
 */
interface UsePaginationReturn {
  /** Current active page (1-indexed) */
  currentPage: number;
  /** Total number of pages */
  totalPages: number;
  /** Starting index for current page (0-indexed) */
  startIndex: number;
  /** Ending index for current page (exclusive) */
  endIndex: number;
  /** Whether there's a next page available */
  hasNextPage: boolean;
  /** Whether there's a previous page available */
  hasPrevPage: boolean;
  /** Navigate to a specific page */
  goToPage: (page: number) => void;
  /** Navigate to next page */
  nextPage: () => void;
  /** Navigate to previous page */
  prevPage: () => void;
  /** Reset to first page */
  resetPage: () => void;
  /** Slice items array to current page */
  pageItems: <T>(items: T[]) => T[];
}

/**
 * usePagination Hook
 *
 * Manages client-side pagination state and provides utilities for
 * navigating and slicing data arrays.
 *
 * @param props - Configuration options
 * @returns Pagination state and navigation functions
 *
 * @example
 * ```tsx
 * const { currentPage, totalPages, pageItems, nextPage, prevPage } = usePagination({
 *   totalItems: products.length,
 *   itemsPerPage: 20,
 * });
 *
 * const displayedProducts = pageItems(products);
 * ```
 */
export function usePagination({
  totalItems,
  initialPage = 1,
  itemsPerPage = 10,
}: UsePaginationProps): UsePaginationReturn {
  const [currentPage, setCurrentPage] = useState(initialPage);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalItems / itemsPerPage)),
    [totalItems, itemsPerPage]
  );

  const startIndex = useMemo(
    () => (currentPage - 1) * itemsPerPage,
    [currentPage, itemsPerPage]
  );

  const endIndex = useMemo(
    () => Math.min(startIndex + itemsPerPage, totalItems),
    [startIndex, itemsPerPage, totalItems]
  );

  const hasNextPage = currentPage < totalPages;
  const hasPrevPage = currentPage > 1;

  const goToPage = useCallback(
    (page: number) => {
      const safePage = Math.max(1, Math.min(page, totalPages));
      setCurrentPage(safePage);
    },
    [totalPages]
  );

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (hasPrevPage) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [hasPrevPage]);

  const resetPage = useCallback(() => {
    setCurrentPage(1);
  }, []);

  const pageItems = useCallback(
    <T>(items: T[]): T[] => {
      return items.slice(startIndex, endIndex);
    },
    [startIndex, endIndex]
  );

  return {
    currentPage,
    totalPages,
    startIndex,
    endIndex,
    hasNextPage,
    hasPrevPage,
    goToPage,
    nextPage,
    prevPage,
    resetPage,
    pageItems,
  };
}

export default usePagination;
