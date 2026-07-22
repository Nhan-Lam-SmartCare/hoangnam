import React, { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { showToast } from "../../utils/toast";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmModal from "../common/ConfirmModal";
import { PlusIcon } from "../Icons";
import { useParts } from "../../hooks/useSupabase";
import {
  useCategories,
  useCreateCategory,
  useUpdateCategory,
  useDeleteCategoryRecord,
} from "../../hooks/useCategories";
import { mapRepoErrorForUser } from "../../utils/errorMapping";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";
import { useBranchesRepo } from "../../hooks/useBranchesRepository";
import { isPartInBranch } from "../../utils/inventoryCalc";
import {
  Boxes,
  Wrench,
  Settings,
  Hammer,
  Cog,
  Bolt,
  Smartphone,
  Laptop,
  Tablet,
  Disc,
  Battery,
  Lightbulb,
  Palette,
  AlertCircle,
  Edit2,
  Trash2,
  Building2,
  Filter,
} from "lucide-react";
import {
  getAllCategoryPricingRules,
  setCategoryPricingRule,
  type RoundingRule,
} from "../../utils/categoryPricingRules";
import { UiCard } from "../ui";

const CategoriesManager: React.FC = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useAppContext();
  const { data: branches = [] } = useBranchesRepo();
  // Selected branch filter: "all" or specific branch ID
  const [selectedBranchId, setSelectedBranchId] = useState<string>(
    currentBranchId || "all"
  );
  // Toggle: Only show categories that have products in the selected branch
  const [onlyBranchWithProducts, setOnlyBranchWithProducts] = useState<boolean>(false);

  // Live parts from Supabase
  const { data: parts = [] } = useParts();
  const {
    data: categoriesData = [],
    isLoading,
    isError,
    refetch,
  } = useCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategoryRecord = useDeleteCategoryRecord();
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCategory, setEditingCategory] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [selectedColor, setSelectedColor] = useState("#3b82f6");
  const [selectedIcon, setSelectedIcon] = useState("package");
  const [pricingRules, setPricingRules] = useState(() =>
    getAllCategoryPricingRules()
  );

  // Confirm dialog hook
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  // Branch-scoped parts list
  const branchScopedParts = useMemo(() => {
    return parts.filter((p) => isPartInBranch(p, selectedBranchId));
  }, [parts, selectedBranchId]);

  // Extract categories with enhanced branch-scoped stats
  const categories = useMemo(() => {
    const activeBranch = selectedBranchId;

    const mapped = categoriesData.map((c) => {
      const categoryParts = branchScopedParts.filter((p) => p.category === c.name);

      const totalStock = categoryParts.reduce((sum, p) => {
        if (activeBranch === "all") {
          const allStockSum = Object.values(p.stock || {}).reduce(
            (s: number, v: any) => s + Math.max(0, Number(v || 0)),
            0
          );
          return sum + allStockSum;
        }
        return sum + Math.max(0, Number(p.stock?.[activeBranch] || 0));
      }, 0);

      const totalValue = categoryParts.reduce((sum, p) => {
        if (activeBranch === "all") {
          const allValueSum = Object.keys(p.stock || {}).reduce((s, bKey) => {
            const st = Math.max(0, Number(p.stock?.[bKey] || 0));
            const cost = Math.max(0, Number(p.costPrice?.[bKey] || 0));
            return s + st * cost;
          }, 0);
          return sum + allValueSum;
        }
        const stock = Math.max(0, Number(p.stock?.[activeBranch] || 0));
        const costPrice = Math.max(0, Number(p.costPrice?.[activeBranch] || 0));
        return sum + stock * costPrice;
      }, 0);

      const lowStockParts = categoryParts.filter((p) => {
        if (activeBranch === "all") {
          const totalSt = Object.values(p.stock || {}).reduce(
            (s: number, v: any) => s + Math.max(0, Number(v || 0)),
            0
          );
          return totalSt > 0 && totalSt <= 2;
        }
        const stock = Math.max(0, Number(p.stock?.[activeBranch] || 0));
        return stock > 0 && stock <= 2;
      });

      return {
        id: c.id,
        name: c.name,
        icon: c.icon || "package",
        color: c.color || "#3b82f6",
        pricingRule:
          pricingRules[c.name.trim().toLowerCase()] || {
            markupPercent: 50,
            roundingRule: "integer" as RoundingRule,
          },
        count: categoryParts.length,
        totalStock,
        totalValue,
        lowStockParts: lowStockParts.map((p) => ({
          name: p.name,
          sku: p.sku,
          stock:
            activeBranch === "all"
              ? Object.values(p.stock || {}).reduce((s: number, v: any) => s + Math.max(0, Number(v || 0)), 0)
              : Math.max(0, Number(p.stock?.[activeBranch] || 0)),
        })),
        lowStockCount: lowStockParts.length,
      };
    });

    if (onlyBranchWithProducts) {
      return mapped.filter((cat) => cat.count > 0 || cat.totalStock > 0);
    }

    return mapped;
  }, [categoriesData, branchScopedParts, selectedBranchId, pricingRules, onlyBranchWithProducts]);

  const handleUpdateCategoryRule = async (
    categoryName: string,
    patch: Partial<{ markupPercent: number; roundingRule: RoundingRule }>
  ) => {
    const key = categoryName.trim().toLowerCase();
    const currentRule =
      pricingRules[key] ||
      ({ markupPercent: 50, roundingRule: "integer" } as {
        markupPercent: number;
        roundingRule: RoundingRule;
      });

    const nextRule = {
      markupPercent:
        patch.markupPercent != null
          ? Math.max(0, Math.round(Number(patch.markupPercent || 0)))
          : currentRule.markupPercent,
      roundingRule: patch.roundingRule || currentRule.roundingRule,
    };

    setCategoryPricingRule(categoryName, nextRule);
    setPricingRules((prev) => ({ ...prev, [key]: nextRule }));

    // Cập nhật lên Supabase để đồng bộ giữa các thiết bị
    const cat = categoriesData.find((c) => c.name === categoryName);
    if (cat) {
      try {
        await updateCategory.mutateAsync({
          id: cat.id,
          updates: {
            markup_percent: nextRule.markupPercent,
            rounding_rule: nextRule.roundingRule,
          },
        });
      } catch (err) {
        console.error("Failed to sync category rule to Supabase:", err);
      }
    }
  };

  const handleAddCategory = async () => {
    if (!newCategoryName.trim()) {
      showToast.warning("Vui lòng nhập tên danh mục");
      return;
    }

    const exists = categories.some(
      (cat) => cat.name.toLowerCase() === newCategoryName.toLowerCase()
    );
    if (exists) {
      showToast.warning("Danh mục này đã tồn tại");
      return;
    }

    // Since categories are derived from parts only, create a placeholder part row (or instruct user)
    // Safer approach: create minimal hidden part to persist category existence (optional)
    try {
      await createCategory.mutateAsync({
        name: newCategoryName,
        icon: selectedIcon,
        color: selectedColor,
      });
      setNewCategoryName("");
      setShowAddModal(false);
    } catch (e: any) {
      showToast.error(mapRepoErrorForUser(e));
    }
  };

  const handleRenameCategory = async (oldName: string, newName: string) => {
    if (!newName.trim()) {
      showToast.warning("Vui lòng nhập tên danh mục mới");
      return;
    }
    const cat = categoriesData.find((c) => c.name === oldName);
    if (!cat) {
      showToast.error("Không tìm thấy danh mục để đổi tên");
      return;
    }
    try {
      await updateCategory.mutateAsync({
        id: cat.id,
        updates: { name: newName },
      });
      setEditingCategory(null);
    } catch (e: any) {
      showToast.error(mapRepoErrorForUser(e));
    }
  };

  const handleDeleteCategory = async (categoryName: string) => {
    const partsCount = parts.filter(
      (p: any) => p.category === categoryName
    ).length;

    const confirmed = await confirm({
      title: "Xác nhận xóa danh mục",
      message: `Bạn có chắc chắn muốn xóa danh mục "${categoryName}"? ${partsCount} sản phẩm trong danh mục này sẽ không còn danh mục.`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;
    const cat = categoriesData.find((c) => c.name === categoryName);
    if (!cat) {
      showToast.error("Không tìm thấy danh mục");
      return;
    }
    try {
      await deleteCategoryRecord.mutateAsync({ id: cat.id });
    } catch (e: any) {
      showToast.error(mapRepoErrorForUser(e));
    }
  };

  const colors = [
    { value: "#3b82f6", label: "Xanh dương" },
    { value: "#10b981", label: "Xanh lá" },
    { value: "#f59e0b", label: "Vàng" },
    { value: "#ef4444", label: "Đỏ" },
    { value: "#8b5cf6", label: "Tím" },
    { value: "#ec4899", label: "Hồng" },
    { value: "#06b6d4", label: "Cyan" },
    { value: "#f97316", label: "Cam" },
  ];

  const iconMap: Record<string, React.ReactNode> = {
    package: <Boxes className="w-5 h-5" />,
    wrench: <Wrench className="w-5 h-5" />,
    settings: <Settings className="w-5 h-5" />,
    hammer: <Hammer className="w-5 h-5" />,
    cog: <Cog className="w-5 h-5" />,
    bolt: <Bolt className="w-5 h-5" />,
    smartphone: <Smartphone className="w-5 h-5" />,
    laptop: <Laptop className="w-5 h-5" />,
    tablet: <Tablet className="w-5 h-5" />,
    disc: <Disc className="w-5 h-5" />,
    battery: <Battery className="w-5 h-5" />,
    lightbulb: <Lightbulb className="w-5 h-5" />,
    palette: <Palette className="w-5 h-5" />,
  };
  const icons = Object.keys(iconMap);

  return (
    <div className="categories-screen h-full flex flex-col bg-slate-50 dark:bg-[#0f172a]">
      {/* Header */}
      <UiCard className="rounded-none border-x-0 border-t-0 px-4 py-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Boxes className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              Danh mục sản phẩm
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Quản lý các danh mục phân loại sản phẩm theo chi nhánh
            </p>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Branch Selector */}
            <div className="flex items-center gap-1.5 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg px-2 py-1.5 shadow-sm">
              <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400 hidden sm:inline">
                Chi nhánh:
              </span>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="bg-transparent text-xs font-bold text-slate-900 dark:text-slate-100 focus:outline-none cursor-pointer"
              >
                <option value="all">Tất cả chi nhánh</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.id}) {b.id === currentBranchId ? "★ Hiện tại" : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Toggle Only Active Categories in Branch */}
            <button
              type="button"
              onClick={() => setOnlyBranchWithProducts((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                onlyBranchWithProducts
                  ? "bg-blue-600 text-white border-blue-600 shadow-sm"
                  : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
              }`}
              title="Lọc chỉ những danh mục đang có sản phẩm/tồn kho ở chi nhánh được chọn"
            >
              <Filter className="w-3.5 h-3.5" />
              <span>Chỉ mục có sản phẩm</span>
            </button>

            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium text-sm shadow-sm"
            >
              <PlusIcon className="w-4 h-4" />
              Thêm danh mục
            </button>
          </div>
        </div>
      </UiCard>

      {/* Loading & Error States */}
      {isLoading && (
        <div className="p-6 text-sm text-slate-500 dark:text-slate-400">
          Đang tải danh mục...
        </div>
      )}
      {isError && (
        <div className="p-6 text-sm text-red-500">
          Lỗi tải dữ liệu.{" "}
          <button onClick={() => refetch()} className="underline">
            Thử lại
          </button>
        </div>
      )}

      {/* Stats */}
      <UiCard className="rounded-none border-x-0 px-4 py-3">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-xs sm:text-sm font-medium text-blue-600 dark:text-blue-400 flex items-center justify-between">
              <span>Tổng danh mục</span>
              <span className="text-[10px] bg-blue-200/60 dark:bg-blue-800/50 px-1.5 py-0.5 rounded font-mono">
                {selectedBranchId === "all"
                  ? "Tất cả CN"
                  : branches.find((b) => b.id === selectedBranchId)?.name || selectedBranchId}
              </span>
            </div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
              {categories.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-700">
            <div className="text-xs sm:text-sm font-medium text-emerald-600 dark:text-emerald-400 flex items-center justify-between">
              <span>Sản phẩm ở CN</span>
              <span className="text-[10px] bg-emerald-200/60 dark:bg-emerald-800/50 px-1.5 py-0.5 rounded font-mono">
                {selectedBranchId === "all"
                  ? "Tất cả CN"
                  : selectedBranchId}
              </span>
            </div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
              {branchScopedParts.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="text-xs sm:text-sm font-medium text-amber-600 dark:text-amber-400 flex items-center justify-between">
              <span>Chưa phân loại</span>
              <span className="text-[10px] bg-amber-200/60 dark:bg-amber-800/50 px-1.5 py-0.5 rounded font-mono">
                {selectedBranchId === "all"
                  ? "Tất cả CN"
                  : selectedBranchId}
              </span>
            </div>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">
              {branchScopedParts.filter((p) => !p.category).length}
            </div>
          </div>
        </div>
      </UiCard>

      {/* Categories Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-full inline-block align-middle">
          <table className="min-w-full divide-y divide-slate-200 dark:divide-slate-700">
            <thead className="bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[280px]">
                  Danh mục
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[120px]">
                  Số SP
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[120px]">
                  Tồn kho
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[150px]">
                  Giá trị tồn
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[140px]">
                  % mặc định
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[140px]">
                  Làm tròn
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">
                  Sản phẩm sắp hết (≤2)
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider w-[140px]">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-[#1e293b] divide-y divide-slate-200 dark:divide-slate-700">
              {categories.map((category) => {
                const IconComponent =
                  iconMap[category.icon] || iconMap["package"];
                const categoryColor = category.color || "#3b82f6";

                return (
                  <tr
                    key={category.name}
                    onClick={() => {
                      // Navigate to inventory tab with category and low-stock filters
                      navigate(
                        `/inventory?category=${encodeURIComponent(
                          category.name
                        )}&stock=low-stock`
                      );
                    }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer group"
                  >
                    {/* Category Name with Icon */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
                          style={{
                            backgroundColor: `${categoryColor}15`,
                            color: categoryColor,
                          }}
                        >
                          {React.cloneElement(
                            IconComponent as React.ReactElement<{ className?: string }>,
                            { className: "w-5 h-5" }
                          )}
                        </div>
                        {editingCategory === category.name ? (
                          <input
                            type="text"
                            defaultValue={category.name}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                handleRenameCategory(
                                  category.name,
                                  e.currentTarget.value
                                );
                              } else if (e.key === "Escape") {
                                setEditingCategory(null);
                              }
                            }}
                            onBlur={(e) =>
                              handleRenameCategory(
                                category.name,
                                e.target.value
                              )
                            }
                            autoFocus
                            className="flex-1 px-2 py-1 border-2 border-blue-500 rounded-lg text-sm font-semibold text-slate-900 dark:text-slate-100 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                          />
                        ) : (
                          <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                            {category.name}
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Product Count */}
                    <td className="px-4 py-3 text-center">
                      <span
                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{
                          backgroundColor: `${categoryColor}20`,
                          color: categoryColor,
                        }}
                      >
                        {category.count}
                      </span>
                    </td>

                    {/* Total Stock */}
                    <td className="px-4 py-3 text-center">
                      <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {category.totalStock.toLocaleString()}
                      </span>
                    </td>

                    {/* Total Value */}
                    <td className="px-4 py-3 text-right">
                      <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(category.totalValue)}
                      </span>
                    </td>

                    {/* Default markup percent */}
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={category.pricingRule.markupPercent}
                        onChange={(e) =>
                          handleUpdateCategoryRule(category.name, {
                            markupPercent: Number(e.target.value || 0),
                          })
                        }
                        className="w-24 px-2 py-1 text-center border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                      />
                    </td>

                    {/* Rounding rule */}
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <select
                        value={category.pricingRule.roundingRule}
                        onChange={(e) =>
                          handleUpdateCategoryRule(category.name, {
                            roundingRule: e.target.value as RoundingRule,
                          })
                        }
                        className="w-28 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-800"
                      >
                        <option value="integer">Số nguyên</option>
                        <option value="hundred">Hàng trăm</option>
                        <option value="thousand">Hàng nghìn</option>
                      </select>
                    </td>

                    {/* Low Stock Products */}
                    <td className="px-4 py-3">
                      {category.lowStockCount > 0 ? (
                        <div className="space-y-1">
                          {category.lowStockParts.slice(0, 3).map((p, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 text-xs"
                            >
                              <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                              <span className="text-slate-700 dark:text-slate-300 truncate flex-1">
                                {p.name}
                              </span>
                              <span className="text-amber-600 dark:text-amber-400 font-semibold">
                                SL: {p.stock}
                              </span>
                            </div>
                          ))}
                          {category.lowStockCount > 3 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 italic">
                              +{category.lowStockCount - 3} sản phẩm khác
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400 dark:text-slate-500 italic">
                          Không có
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td
                      className="px-4 py-3"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditingCategory(category.name)}
                          className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                          title="Đổi tên"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteCategory(category.name)}
                          className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                          title="Xóa"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Empty State */}
          {categories.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center bg-white dark:bg-[#1e293b]">
              <div className="mb-4 text-slate-400 dark:text-slate-500">
                <Boxes className="w-16 h-16" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Chưa có danh mục nào
              </h3>
              <p className="text-slate-600 dark:text-slate-400 mb-4">
                Thêm danh mục đầu tiên để phân loại sản phẩm
              </p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
              >
                Thêm danh mục
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Add Category Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-md w-full">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                Thêm danh mục mới
              </h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <svg
                  className="w-6 h-6"
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

            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tên danh mục
                </label>
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder="VD: Linh kiện iPhone"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Biểu tượng
                </label>
                <div className="grid grid-cols-6 gap-2">
                  {icons.map((icon) => (
                    <button
                      key={icon}
                      onClick={() => setSelectedIcon(icon)}
                      className={`p-3 border rounded-lg transition-colors flex items-center justify-center ${
                        selectedIcon === icon
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          : "border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                      }`}
                    >
                      {iconMap[icon]}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Màu sắc
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setSelectedColor(color.value)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        selectedColor === color.value
                          ? "border-slate-900 dark:border-slate-100 scale-110"
                          : "border-transparent"
                      }`}
                      style={{ backgroundColor: color.value }}
                      title={color.label}
                    >
                      <div className="w-full h-6"></div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                onClick={handleAddCategory}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
              >
                Thêm danh mục
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmColor={confirmState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};

export default CategoriesManager;
