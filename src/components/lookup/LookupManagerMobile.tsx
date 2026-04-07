import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { usePartsRepoPaged } from "../../hooks/usePartsRepository";
import { getCategoryColor } from "../../utils/categoryColors";

const LookupManagerMobile: React.FC = () => {
  const { sales, workOrders, currentBranchId } = useAppContext();

  // Fetch parts data directly from Supabase
  const { data: pagedResult, isLoading } = usePartsRepoPaged({
    page: 1,
    pageSize: 20, // Load 20 products at a time for better performance
  });
  const parts = pagedResult?.data || [];

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [priceRange, setPriceRange] = useState<{
    min: number;
    max: number;
  } | null>(null);
  const [stockFilter, setStockFilter] = useState<
    "all" | "in-stock" | "low-stock" | "out-of-stock"
  >("all");
  const [selectedPart, setSelectedPart] = useState<string | null>(null);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [showMobileDetails, setShowMobileDetails] = useState(false);

  // Extract categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    parts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [parts]);

  // Filter parts
  const filteredParts = useMemo(() => {
    return parts.filter((part) => {
      // Text search
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchName = part.name.toLowerCase().includes(query);
        const matchSku = part.sku?.toLowerCase().includes(query);
        const matchDesc = part.description?.toLowerCase().includes(query);
        if (!matchName && !matchSku && !matchDesc) return false;
      }

      // Category filter
      if (selectedCategory !== "all" && part.category !== selectedCategory) {
        return false;
      }

      // Price filter
      if (priceRange) {
        const price = part.retailPrice[currentBranchId] || 0;
        if (price < priceRange.min || price > priceRange.max) return false;
      }

      // Stock filter
      const stock = part.stock[currentBranchId] || 0;
      if (stockFilter === "in-stock" && stock <= 0) return false;
      if (stockFilter === "low-stock" && stock > 10) return false;
      if (stockFilter === "out-of-stock" && stock > 0) return false;

      return true;
    });
  }, [
    parts,
    searchQuery,
    selectedCategory,
    priceRange,
    stockFilter,
    currentBranchId,
  ]);

  // Get part details with sales history
  const getPartDetails = (partId: string) => {
    const part = parts.find((p) => p.id === partId);
    if (!part) return null;

    // Find sales containing this part
    const partSales = sales.filter((sale) =>
      sale.items.some((item) => item.partId === partId)
    );

    // Find work orders containing this part
    const partWorkOrders = workOrders.filter((wo) =>
      wo.partsUsed?.some((item) => item.partId === partId)
    );

    // Calculate total sold
    const totalSold = partSales.reduce((sum, sale) => {
      const item = sale.items.find((i) => i.partId === partId);
      return sum + (item?.quantity || 0);
    }, 0);

    // Calculate revenue
    const revenue = partSales.reduce((sum, sale) => {
      const item = sale.items.find((i) => i.partId === partId);
      return sum + (item?.sellingPrice || 0) * (item?.quantity || 0);
    }, 0);

    return {
      part,
      salesCount: partSales.length,
      totalSold,
      revenue,
      lastSold:
        partSales.length > 0
          ? partSales.sort(
              (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
            )[0].date
          : null,
      workOrdersCount: partWorkOrders.length,
    };
  };

  const partDetails = selectedPart ? getPartDetails(selectedPart) : null;

  return (
    <>
      {/* Mobile Layout - Single Column */}
      <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0f172a]">
        {/* Mobile Header - Search & Filter Button */}
        <div className="sticky top-0 z-10 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm sản phẩm..."
            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 placeholder-slate-400 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMobileFilters(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Bộ lọc
            </button>
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300">
              {filteredParts.length} sp
            </div>
          </div>
        </div>

        {/* Mobile Product List */}
        <div className="flex-1 overflow-auto">
          {filteredParts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <svg
                className="w-16 h-16 text-slate-300 dark:text-slate-600 mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <circle cx="11" cy="11" r="7" />
                <path d="m21 21-4.35-4.35" />
              </svg>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Không tìm thấy sản phẩm
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredParts.map((part) => {
                const stock = part.stock[currentBranchId] || 0;
                const price = part.retailPrice[currentBranchId] || 0;

                return (
                  <button
                    key={part.id}
                    onClick={() => {
                      setSelectedPart(part.id);
                      setShowMobileDetails(true);
                    }}
                    className="w-full p-4 flex items-center gap-3 bg-white dark:bg-[#1e293b] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center flex-shrink-0">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {part.name}
                      </h3>
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                        SKU: {part.sku}
                      </p>
                      {part.category && (
                        <span
                          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[9px] font-medium mt-0.5 ${
                            getCategoryColor(part.category).bg
                          } ${getCategoryColor(part.category).text}`}
                        >
                          {part.category}
                        </span>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-base font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(price)}
                      </div>
                      <div className="flex items-center gap-1 justify-end mt-1">
                        {stock <= 0 ? (
                          <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded">
                            Hết
                          </span>
                        ) : stock <= 10 ? (
                          <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded">
                            {stock}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded">
                            {stock}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Mobile Filter Modal */}
      {showMobileFilters && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="relative bg-white dark:bg-[#1e293b] rounded-t-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Bộ lọc tìm kiếm
              </h3>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Danh mục
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                >
                  <option value="all">Tất cả danh mục</option>
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Stock Filter */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tồn kho
                </label>
                <div className="space-y-2">
                  {[
                    { value: "all", label: "Tất cả" },
                    { value: "in-stock", label: "Còn hàng" },
                    { value: "low-stock", label: "Sắp hết (≤10)" },
                    { value: "out-of-stock", label: "Hết hàng" },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="stock"
                        value={option.value}
                        checked={stockFilter === option.value}
                        onChange={(e) =>
                          setStockFilter(
                            e.target.value as
                              | "all"
                              | "in-stock"
                              | "low-stock"
                              | "out-of-stock"
                          )
                        }
                        className="w-4 h-4 text-blue-600"
                      />
                      <span className="text-sm text-slate-700 dark:text-slate-300">
                        {option.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Khoảng giá
                </label>
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="number"
                      placeholder="Từ"
                      onChange={(e) =>
                        setPriceRange((prev) => ({
                          min: Number(e.target.value) || 0,
                          max: prev?.max || 999999999,
                        }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 text-sm"
                    />
                    <input
                      type="number"
                      placeholder="Đến"
                      onChange={(e) =>
                        setPriceRange((prev) => ({
                          min: prev?.min || 0,
                          max: Number(e.target.value) || 999999999,
                        }))
                      }
                      className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 text-sm"
                    />
                  </div>
                  {priceRange && (
                    <button
                      onClick={() => setPriceRange(null)}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Xóa bộ lọc giá
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2">
              <button
                onClick={() => {
                  setSelectedCategory("all");
                  setStockFilter("all");
                  setPriceRange(null);
                }}
                className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300"
              >
                Đặt lại
              </button>
              <button
                onClick={() => setShowMobileFilters(false)}
                className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Detail Modal */}
      {showMobileDetails && partDetails && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowMobileDetails(false)}
          />
          <div className="relative bg-white dark:bg-[#1e293b] rounded-t-2xl w-full max-h-[85vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Chi tiết sản phẩm
              </h3>
              <button
                onClick={() => setShowMobileDetails(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
                  {partDetails.part.name}
                </h2>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                  SKU: {partDetails.part.sku}
                </p>
                {partDetails.part.category && (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium mt-1.5 ${
                      getCategoryColor(partDetails.part.category).bg
                    } ${getCategoryColor(partDetails.part.category).text}`}
                  >
                    {partDetails.part.category}
                  </span>
                )}
              </div>

              {partDetails.part.description && (
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Mô tả
                  </div>
                  <p className="text-sm text-slate-700 dark:text-slate-300">
                    {partDetails.part.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Tồn kho
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {partDetails.part.stock[currentBranchId] || 0}
                  </div>
                </div>
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Giá bán lẻ
                  </div>
                  <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(
                      partDetails.part.retailPrice[currentBranchId] || 0
                    )}
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-3">
                  Thống kê bán hàng
                </h4>
                <div className="space-y-3">
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg">
                    <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                      Tổng đã bán
                    </div>
                    <div className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                      {partDetails.totalSold}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-3 rounded-lg">
                    <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">
                      Doanh thu
                    </div>
                    <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100">
                      {formatCurrency(partDetails.revenue)}
                    </div>
                  </div>

                  <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-3 rounded-lg">
                    <div className="text-sm text-amber-600 dark:text-amber-400 mb-1">
                      Số đơn hàng
                    </div>
                    <div className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                      {partDetails.salesCount}
                    </div>
                  </div>

                  {partDetails.lastSold && (
                    <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                      <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Bán gần nhất
                      </div>
                      <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {formatDate(partDetails.lastSold)}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default LookupManagerMobile;
