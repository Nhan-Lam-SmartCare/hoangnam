import { useState, useCallback } from "react";

/**
 * Props for the useSearchFilter hook
 * @template T - Type of items being filtered
 */
interface UseSearchFilterProps<T> {
  /** Array of items to search/filter */
  items: T[];
  /** Keys of the item object to search within */
  searchFields: (keyof T)[];
}

/**
 * useSearchFilter Hook
 *
 * Provides client-side search/filter functionality for arrays.
 * Performs case-insensitive partial matching across specified fields.
 *
 * @template T - Type of items being filtered (must extend Record<string, unknown>)
 * @param props - Configuration options
 * @returns Search state and filtered results
 *
 * @example
 * ```tsx
 * const { searchQuery, setSearchQuery, filteredItems } = useSearchFilter({
 *   items: products,
 *   searchFields: ['name', 'sku', 'category'],
 * });
 *
 * return (
 *   <>
 *     <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
 *     {filteredItems.map(item => <ProductCard key={item.id} {...item} />)}
 *   </>
 * );
 * ```
 */
export function useSearchFilter<T extends Record<string, unknown>>({
  items,
  searchFields,
}: UseSearchFilterProps<T>) {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;

    const query = searchQuery.toLowerCase();
    return searchFields.some((field) => {
      const value = item[field];
      if (value == null) return false;
      return String(value).toLowerCase().includes(query);
    });
  });

  const clearSearch = useCallback(() => {
    setSearchQuery("");
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filteredItems,
    clearSearch,
    hasResults: filteredItems.length > 0,
    resultCount: filteredItems.length,
  };
}

export default useSearchFilter;
