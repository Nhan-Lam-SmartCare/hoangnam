import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { usePartsRepoPaged } from "../../hooks/usePartsRepository";
import { getCategoryColor } from "../../utils/categoryColors";

const LookupManager: React.FC = () => {
  const { sales, workOrders, currentBranchId } = useAppContext();

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);

  // Fetch parts data with pagination
  const { data: pagedResult, isLoading } = usePartsRepoPaged({
    page,
    pageSize,
  });
  const parts = pagedResult?.data || [];
  const totalParts = pagedResult?.meta?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalParts / pageSize));

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
    <div className="h-full flex bg-slate-50 dark:bg-[#0f172a]">
      {/* Left Panel - Search & Filters */}
      <div className="w-96 bg-white dark:bg-[#1e293b] border-r border-slate-200 dark:border-slate-700 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-1">
            Tra cứu sản phẩm
          </h1>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Tìm kiếm và xem chi tiết sản phẩm
          </p>
        </div>

        {/* Search */}
        <div className="p-4 border-b border-slate-200 dark:border-slate-700">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên, SKU, mô tả..."
            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 placeholder-slate-400"
          />
        </div>

        {/* Filters */}
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

          {/* Results Count */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Tìm thấy{" "}
              <span className="font-semibold text-slate-900 dark:text-slate-100">
                {filteredParts.length}
              </span>{" "}
              sản phẩm
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="flex-1 flex flex-col">
        {/* Results List */}
        <div className="flex-1 overflow-auto p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredParts.map((part) => {
              const stock = part.stock[currentBranchId] || 0;
              const price = part.retailPrice[currentBranchId] || 0;

              return (
                <div
                  key={part.id}
                  onClick={() => setSelectedPart(part.id)}
                  className={`bg-white dark:bg-[#1e293b] rounded-lg shadow-sm border-2 transition-all cursor-pointer ${
                    selectedPart === part.id
                      ? "border-blue-500 shadow-md"
                      : "border-slate-200 dark:border-slate-700 hover:shadow-md"
                  }`}
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        {part.name}
                      </h3>
                      {stock <= 0 ? (
                        <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 text-xs rounded">
                          Hết hàng
                        </span>
                      ) : stock <= 10 ? (
                        <span className="px-2 py-0.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 text-xs rounded">
                          Sắp hết
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs rounded">
                          Còn hàng
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-blue-600 dark:text-blue-400 font-mono mb-3">
                      SKU: {part.sku}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Tồn kho
                        </div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">
                          {stock}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Giá bán
                        </div>
                        <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(price)}
                        </div>
                      </div>
                    </div>

                    {part.category && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            getCategoryColor(part.category).bg
                          } ${getCategoryColor(part.category).text}`}
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-3 h-3"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 7.5l9-4.5 9 4.5v9l-9 4.5-9-4.5v-9z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M3 7.5l9 4.5 9-4.5"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 12v9"
                            />
                          </svg>
                          {part.category}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty State */}
          {filteredParts.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="mb-4 text-slate-400 dark:text-slate-500">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-16 h-16"
                >
                  <circle cx="11" cy="11" r="7" />
                  <path d="m21 21-4.35-4.35" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Không tìm thấy sản phẩm
              </h3>
              <p className="text-slate-600 dark:text-slate-400">
                Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm
              </p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e293b]">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Trang {page}/{totalPages} • Tổng {totalParts} sản phẩm
          </div>
          <div className="flex items-center gap-2">
            <button
              disabled={page === 1 || isLoading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              ← Trước
            </button>
            <button
              disabled={page >= totalPages || isLoading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-50 dark:hover:bg-slate-700"
            >
              Sau →
            </button>
          </div>
        </div>
      </div>

      {/* Detail Panel */}
      {partDetails && (
        <div className="w-96 bg-white dark:bg-[#1e293b] border-l border-slate-200 dark:border-slate-700 flex flex-col">
          <div className="p-6 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Chi tiết sản phẩm
              </h2>
              <button
                onClick={() => setSelectedPart(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
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

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {partDetails.part.name}
                </h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                  SKU: {partDetails.part.sku}
                </p>
                {partDetails.part.category && (
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium mt-1 ${
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

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Tồn kho
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {partDetails.part.stock[currentBranchId] || 0}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Giá bán lẻ
                  </div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(
                      partDetails.part.retailPrice[currentBranchId] || 0
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-6">
            <h3 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Thống kê bán hàng
            </h3>

            <div className="space-y-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-4 rounded-lg">
                <div className="text-sm text-blue-600 dark:text-blue-400 mb-1">
                  Tổng đã bán
                </div>
                <div className="text-3xl font-bold text-blue-900 dark:text-blue-100">
                  {partDetails.totalSold}
                </div>
              </div>

              <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-4 rounded-lg">
                <div className="text-sm text-emerald-600 dark:text-emerald-400 mb-1">
                  Doanh thu
                </div>
                <div className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {formatCurrency(partDetails.revenue)}
                </div>
              </div>

              <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-4 rounded-lg">
                <div className="text-sm text-amber-600 dark:text-amber-400 mb-1">
                  Số đơn hàng
                </div>
                <div className="text-3xl font-bold text-amber-900 dark:text-amber-100">
                  {partDetails.salesCount}
                </div>
              </div>

              {partDetails.lastSold && (
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Bán gần nhất
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300">
                    {formatDate(partDetails.lastSold)}
                  </div>
                </div>
              )}

              {partDetails.workOrdersCount > 0 && (
                <div>
                  <div className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">
                    Lệnh sửa chữa
                  </div>
                  <div className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                    {partDetails.workOrdersCount}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LookupManager;
