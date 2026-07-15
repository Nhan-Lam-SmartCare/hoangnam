import React from "react";
import { Boxes, Package, Search, Filter } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import type { Category } from "../../../types";
import type { useInventoryFilters } from "../hooks/useInventoryFilters";

export interface StockQuickFilter {
  id: string;
  label: string;
  description: string;
  count: number;
  variant: "neutral" | "success" | "warning" | "danger";
}

export interface InventoryToolbarProps {
  /** Toàn bộ state + handler lọc từ useInventoryFilters — truyền nguyên object. */
  filters: ReturnType<typeof useInventoryFilters>;
  totalStockQuantity: number;
  totalStockValue: number;
  /** Số kết quả sau lọc / tổng số phụ tùng (hiển thị "X/Y" trong ô tìm). */
  filteredCount: number;
  totalParts: number;
  stockQuickFilters: StockQuickFilter[];
  lowStockCount: number;
  shouldShowLowStockBanner: boolean;
  allCategories: Category[];
}

/**
 * Thanh công cụ tab Tồn kho (desktop): thống kê nhanh, ô tìm kiếm, bộ lọc
 * nâng cao, quick filter pills và cảnh báo sắp hết hàng. JSX giữ nguyên từ
 * InventoryManager; nhận state qua object `filters` để tránh prop-drilling.
 */
const InventoryToolbar: React.FC<InventoryToolbarProps> = ({
  filters,
  totalStockQuantity,
  totalStockValue,
  filteredCount,
  totalParts,
  stockQuickFilters,
  lowStockCount,
  shouldShowLowStockBanner,
  allCategories,
}) => {
  const {
    searchInput,
    setSearchInput,
    setPage,
    showAdvancedFilters,
    setShowAdvancedFilters,
    advancedFiltersActive,
    resetFilters,
    stockFilter,
    categoryFilter,
    showDuplicatesOnly,
    setShowDuplicatesOnly,
    filterBranchOnly,
    setFilterBranchOnly,
    handleStockFilterChange,
    handleCategoryFilterChange,
  } = filters;

  return (
    <div className="hidden sm:block bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-2">
      <div className="space-y-2">
        {/* Row 1: Stats inline + Search */}
        <div className="flex items-center gap-3">
          {/* Compact Stats */}
          <div className="flex items-center gap-4 flex-shrink-0">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-blue-500/20 bg-blue-500/5">
              <Boxes className="w-4 h-4 text-blue-600" />
              <div>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {totalStockQuantity.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-600 dark:text-slate-300 ml-1">
                  sp
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-emerald-500/20 bg-emerald-500/5">
              <Package className="w-4 h-4 text-emerald-600" />
              <div>
                <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                  {formatCurrency(totalStockValue)}
                </span>
              </div>
            </div>
          </div>
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, SKU hoặc danh mục..."
              value={searchInput}
              onChange={(e) => {
                setPage(1);
                setSearchInput(e.target.value);
              }}
              className="w-full pl-9 pr-16 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-600 dark:text-slate-300">
              {filteredCount}/{totalParts}
            </span>
          </div>
          {/* Filter button */}
          <button
            onClick={() => setShowAdvancedFilters((prev) => !prev)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition flex-shrink-0 ${showAdvancedFilters
              ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
              : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
              }`}
          >
            <Filter className="w-3.5 h-3.5" />
            Bộ lọc nâng cao
            {advancedFiltersActive && (
              <span className="inline-flex h-2 w-2 rounded-full bg-orange-500" />
            )}
          </button>
          {advancedFiltersActive && (
            <button
              onClick={resetFilters}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-orange-300 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100"
            >
              Xóa lọc
            </button>
          )}
        </div>

        {advancedFiltersActive && (
          <div className="flex items-center gap-2 flex-wrap">
            {stockFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 px-2 py-0.5 text-[11px] font-medium">
                Tồn kho: {stockFilter}
              </span>
            )}
            {categoryFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-2 py-0.5 text-[11px] font-medium">
                Danh mục: {categoryFilter}
              </span>
            )}
            {showDuplicatesOnly && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 px-2 py-0.5 text-[11px] font-medium">
                Đang lọc trùng mã
              </span>
            )}
          </div>
        )}

        {/* Row 2: Quick filters as horizontal pills + Low stock warning inline */}
        <div className="flex items-center gap-2 flex-wrap">
          {stockQuickFilters.map((filter) => {
            const isActive = stockFilter === filter.id;
            const colorMap: Record<string, string> = {
              neutral: isActive
                ? "bg-slate-600 text-white"
                : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700",
              success: isActive
                ? "bg-emerald-600 text-white"
                : "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100",
              warning: isActive
                ? "bg-amber-600 text-white"
                : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100",
              danger: isActive
                ? "bg-red-600 text-white"
                : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100",
            };
            return (
              <button
                key={filter.id}
                onClick={() => handleStockFilterChange(filter.id)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${colorMap[filter.variant || "neutral"]
                  }`}
              >
                <span>{filter.label}</span>
                <span
                  className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${isActive
                    ? "bg-white/20"
                    : "bg-black/10 dark:bg-white/10"
                    }`}
                >
                  {filter.count}
                </span>
              </button>
            );
          })}

          {/* Low stock warning inline */}
          {shouldShowLowStockBanner && (
            <div className="ml-auto flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <span className="text-xs">
                ⚠️ {lowStockCount} sắp hết
              </span>
              <button
                onClick={() => handleStockFilterChange("low-stock")}
                className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-600 text-white hover:bg-amber-700"
              >
                Lọc
              </button>
            </div>
          )}
        </div>

        {showAdvancedFilters && (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-900/40 p-3 grid gap-3 grid-cols-2 md:grid-cols-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Trạng thái tồn kho
              </label>
              <select
                value={stockFilter}
                onChange={(e) => handleStockFilterChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">Tất cả tồn kho</option>
                <option value="in-stock">Còn hàng</option>
                <option value="low-stock">Sắp hết</option>
                <option value="out-of-stock">Hết hàng</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Danh mục
              </label>
              <select
                value={categoryFilter}
                onChange={(e) => handleCategoryFilterChange(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-1.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/40"
              >
                <option value="all">Tất cả danh mục</option>
                {allCategories.map((cat) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Phát hiện trùng mã
              </label>
              <button
                onClick={() => setShowDuplicatesOnly((prev) => !prev)}
                className={`mt-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${showDuplicatesOnly
                  ? "border-orange-500 text-orange-600 bg-orange-50 dark:bg-orange-900/20"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
                  }`}
              >
                {showDuplicatesOnly ? "Đang lọc trùng" : "Lọc trùng mã"}
              </button>
            </div>
            <div className="flex flex-col justify-end">
              <label className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                Kho chi nhánh
              </label>
              <button
                type="button"
                onClick={() => setFilterBranchOnly((prev) => !prev)}
                className={`mt-1 rounded-lg border px-3 py-1.5 text-sm font-medium transition ${filterBranchOnly
                  ? "border-blue-500 text-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:text-slate-100"
                  }`}
              >
                {filterBranchOnly ? "Chỉ chi nhánh này" : "Hiện tất cả kho"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryToolbar;
