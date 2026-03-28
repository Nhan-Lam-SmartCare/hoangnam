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
import {
  Boxes,
  Wrench,
  Settings,
  Hammer,
  Cog,
  Bolt,
  Bike,
  Car,
  Disc,
  Battery,
  Lightbulb,
  Palette,
  AlertCircle,
  Edit2,
  Trash2,
} from "lucide-react";

const CategoriesManager: React.FC = () => {
  const navigate = useNavigate();
  const { currentBranchId } = useAppContext();
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

  // Confirm dialog hook
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  // Extract unique categories from parts with enhanced stats
  const categories = useMemo(() => {
    const branchKey = currentBranchId || "";

    return categoriesData.map((c) => {
      const categoryParts = parts.filter((p) => p.category === c.name);
      const totalStock = categoryParts.reduce(
        (sum, p) => sum + (p.stock?.[branchKey] || 0),
        0
      );
      const totalValue = categoryParts.reduce((sum, p) => {
        const stock = p.stock?.[branchKey] || 0;
        const costPrice = p.costPrice?.[branchKey] || 0;
        return sum + stock * costPrice;
      }, 0);
      const lowStockParts = categoryParts.filter((p) => {
        const stock = p.stock?.[branchKey] || 0;
        return stock > 0 && stock <= 2;
      });

      return {
        id: c.id,
        name: c.name,
        icon: c.icon || "package",
        color: c.color || "#3b82f6",
        count: categoryParts.length,
        totalStock,
        totalValue,
        lowStockParts: lowStockParts.map((p) => ({
          name: p.name,
          sku: p.sku,
          stock: p.stock?.[branchKey] || 0,
        })),
        lowStockCount: lowStockParts.length,
      };
    });
  }, [categoriesData, parts, currentBranchId]);

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
    bike: <Bike className="w-5 h-5" />,
    car: <Car className="w-5 h-5" />,
    disc: <Disc className="w-5 h-5" />,
    battery: <Battery className="w-5 h-5" />,
    lightbulb: <Lightbulb className="w-5 h-5" />,
    palette: <Palette className="w-5 h-5" />,
  };
  const icons = Object.keys(iconMap);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-[#0f172a]">
      {/* Header */}
      <div className="bg-white dark:bg-[#1e293b] shadow-sm border-b border-slate-200 dark:border-slate-700 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">
              Danh mục sản phẩm
            </h1>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              Quản lý các danh mục phân loại sản phẩm
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors font-medium"
          >
            <PlusIcon className="w-5 h-5" />
            Thêm danh mục
          </button>
        </div>
      </div>

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
      <div className="px-4 py-3 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700">
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 p-3 rounded-lg border border-blue-200 dark:border-blue-700">
            <div className="text-sm font-medium text-blue-600 dark:text-blue-400">
              Tổng danh mục
            </div>
            <div className="text-xl font-bold text-blue-900 dark:text-blue-100 mt-1">
              {categories.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 p-3 rounded-lg border border-emerald-200 dark:border-emerald-700">
            <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Tổng sản phẩm
            </div>
            <div className="text-xl font-bold text-emerald-900 dark:text-emerald-100 mt-1">
              {parts.length}
            </div>
          </div>
          <div className="bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/20 dark:to-amber-800/20 p-3 rounded-lg border border-amber-200 dark:border-amber-700">
            <div className="text-sm font-medium text-amber-600 dark:text-amber-400">
              Chưa phân loại
            </div>
            <div className="text-xl font-bold text-amber-900 dark:text-amber-100 mt-1">
              {parts.filter((p) => !p.category).length}
            </div>
          </div>
        </div>
      </div>

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
                            IconComponent as React.ReactElement,
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
                  placeholder="VD: Phụ tùng xe máy"
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
