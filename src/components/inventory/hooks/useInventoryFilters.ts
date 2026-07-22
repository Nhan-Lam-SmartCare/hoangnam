import { useEffect, useMemo, useState } from "react";

/**
 * Toàn bộ state lọc/tìm kiếm/sắp xếp/phân trang của tab Tồn kho.
 *
 * Hook TỰ CHỨA: chỉ gồm state + effect không phụ thuộc dữ liệu bên ngoài
 * (debounce search, reset trang khi đổi bộ lọc client). Các effect cần dữ
 * liệu ngoài (đồng bộ URL param — đụng activeTab; validate category theo
 * danh mục thật; tự tắt lọc trùng khi hết SKU trùng) vẫn nằm ở component
 * và gọi các setter do hook trả về.
 */
export function useInventoryFilters() {
  const [searchInput, setSearchInput] = useState(""); // Immediate UI input
  const [search, setSearch] = useState(""); // Debounced value for queries
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [stockFilter, setStockFilter] = useState("all");
  const [showDuplicatesOnly, setShowDuplicatesOnly] = useState(false);
  const [filterBranchOnly, setFilterBranchOnly] = useState(true);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Debounce search input by 500ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // Đổi bộ lọc client (tồn kho / trùng SKU) -> về trang 1 để không vượt biên.
  useEffect(() => {
    setPage(1);
  }, [stockFilter, showDuplicatesOnly]);

  const handleStockFilterChange = (value: string) => {
    setPage(1);
    setStockFilter(value);
  };

  const handleCategoryFilterChange = (value: string) => {
    setPage(1);
    setCategoryFilter(value);
  };

  const handleSort = (field: string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // New field, start with ascending
      setSortField(field);
      setSortDirection("asc");
    }
  };

  const resetFilters = () => {
    setStockFilter("all");
    setCategoryFilter("all");
    setShowDuplicatesOnly(false);
    setPage(1);
    setShowAdvancedFilters(false);
  };

  // Đang lọc client-side (tồn kho / trùng SKU / chi nhánh) -> phân trang cắt trên mảng đã lọc.
  const isClientFiltering = stockFilter !== "all" || showDuplicatesOnly || filterBranchOnly;

  const advancedFiltersActive = useMemo(
    () =>
      stockFilter !== "all" || categoryFilter !== "all" || showDuplicatesOnly,
    [stockFilter, categoryFilter, showDuplicatesOnly]
  );

  return {
    // search
    searchInput,
    setSearchInput,
    search,
    setSearch,
    // filters
    categoryFilter,
    setCategoryFilter,
    stockFilter,
    setStockFilter,
    showDuplicatesOnly,
    setShowDuplicatesOnly,
    filterBranchOnly,
    setFilterBranchOnly,
    showAdvancedFilters,
    setShowAdvancedFilters,
    // paging + sort
    page,
    setPage,
    pageSize,
    setPageSize,
    sortField,
    sortDirection,
    // handlers + derived
    handleStockFilterChange,
    handleCategoryFilterChange,
    handleSort,
    resetFilters,
    isClientFiltering,
    advancedFiltersActive,
  };
}
