import React, { useState, useEffect } from 'react';
import { useCreatePartRepo } from '../../../hooks/usePartsRepository';
import { showToast } from '../../../utils/toast';
import { formatCurrency } from '../../../utils/format';
import { validatePriceAndQty } from '../../../utils/validation';
import { getCategoryColor } from '../../../utils/categoryColors';
import FormattedNumberInput from '../../common/FormattedNumberInput';
import SupplierModal from '../../inventory/components/SupplierModal';
import { X, Plus, Save, Scan, Printer, ShoppingCart, Trash2, Search, Package, AlertCircle, CheckCircle } from 'lucide-react';
import { useCategories, useCreateCategory } from '../../../hooks/useCategories';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { canDo } from '../../../utils/permissions';
import { useAuth } from '../../../contexts/AuthContext';
// Add New Product Modal Component
const AddProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    description: string;
    barcode: string;
    category: string;
    quantity: number;
    importPrice: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
  }) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [importPrice, setImportPrice] = useState<number>(0);
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [warranty, setWarranty] = useState<number>(0);
  const [warrantyUnit, setWarrantyUnit] = useState("tháng");
  const [retailOverridden, setRetailOverridden] = useState<boolean>(false);
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      barcode: barcode.trim(),
      category: category || "Chưa phân loại",
      quantity: Number(quantity) || 1,
      importPrice: Number(importPrice) || 0,
      retailPrice: Number(retailPrice) || 0,
      warranty: Number(warranty) || 0,
      warrantyUnit,
    });

    // Reset form
    setName("");
    setDescription("");
    setBarcode("");
    setCategory("");
    setQuantity(1);
    setImportPrice(0);
    setRetailPrice(0);
    setWarranty(0);
    setRetailOverridden(false);
    setWarrantyUnit("tháng");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
      <div className="bg-white dark:bg-slate-800 w-full sm:rounded-xl sm:max-w-lg max-h-[95vh] sm:max-h-[85vh] overflow-hidden flex flex-col rounded-t-2xl">
        {/* Header - Mobile optimized */}
        <div className="flex justify-between items-center px-4 py-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 sm:bg-none sm:from-transparent sm:to-transparent">
          <h2 className="text-lg font-bold text-white sm:text-slate-900 sm:dark:text-slate-100">
            ➕ Thêm sản phẩm mới
          </h2>
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-white/20 sm:bg-slate-100 sm:dark:bg-slate-700 text-white sm:text-slate-600 sm:dark:text-slate-300 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <div className="flex-1 overflow-y-auto px-4 py-4 bg-slate-50 dark:bg-slate-900/50">
          <div className="space-y-4">
            {/* Card: Thông tin sản phẩm */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                📦 Thông tin sản phẩm
              </h3>

              {/* Tên sản phẩm */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Tên sản phẩm <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Nhập tên sản phẩm"
                />
              </div>

              {/* Danh mục */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Danh mục sản phẩm
                </label>
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">-- Chọn danh mục --</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowInlineCat(true)}
                    className="w-12 h-12 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700 rounded-xl hover:bg-blue-200 dark:hover:bg-blue-800/40 transition-colors"
                    aria-label="Thêm danh mục mới"
                  >
                    <span className="text-2xl text-blue-600 dark:text-blue-400">
                      +
                    </span>
                  </button>
                </div>
              </div>

              {/* Barcode */}
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                  Mã vạch / SKU
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                  placeholder="Nhập mã vạch (nếu có)"
                />
              </div>
            </div>

            {/* Inline category form */}
            {showInlineCat && (
              <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = inlineCatName.trim();
                    if (!trimmed) {
                      showToast.warning("Vui lòng nhập tên danh mục");
                      return;
                    }
                    if (trimmed.length < 2) {
                      showToast.warning("Tên quá ngắn");
                      return;
                    }
                    try {
                      const res = await createCategory.mutateAsync({
                        name: trimmed,
                      });
                      setCategory(res.name);
                      setInlineCatName("");
                      setShowInlineCat(false);
                    } catch (err: any) {
                      showToast.error(err?.message || "Lỗi tạo danh mục");
                    }
                  }}
                  className="space-y-3"
                >
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                    Tạo danh mục mới
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    placeholder="Nhập tên danh mục mới"
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <div className="flex gap-2">
                    <button
                      type="submit"
                      className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium"
                    >
                      Lưu danh mục
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowInlineCat(false);
                        setInlineCatName("");
                      }}
                      className="flex-1 px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                    >
                      Hủy
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* Card: Mô tả */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                📝 Mô tả sản phẩm
              </h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500"
                placeholder="Mô tả chi tiết sản phẩm (tùy chọn)"
              />
            </div>

            {/* Card: Thông tin nhập kho */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
                💰 Thông tin nhập kho
              </h3>

              <div className="grid grid-cols-2 gap-3">
                {/* Số lượng */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Số lượng
                  </label>
                  <FormattedNumberInput
                    value={quantity}
                    onValue={(v) => {
                      const result = validatePriceAndQty(importPrice, v);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setQuantity(Math.max(1, result.clean.quantity));
                    }}
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center font-bold"
                  />
                </div>

                {/* Giá nhập */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Giá nhập (đ)
                  </label>
                  <FormattedNumberInput
                    value={importPrice}
                    onValue={(v) => {
                      const result = validatePriceAndQty(v, quantity);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setImportPrice(result.clean.importPrice);
                      if (!retailOverridden) {
                        setRetailPrice(
                          Math.round(result.clean.importPrice * 1.5)
                        );
                      }
                    }}
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>

                {/* Giá bán lẻ */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Giá bán lẻ (đ)
                  </label>
                  <FormattedNumberInput
                    value={retailPrice}
                    onValue={(v) => {
                      setRetailPrice(Math.max(0, Math.round(v)));
                      setRetailOverridden(true);
                    }}
                    className="w-full px-4 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>

                {/* Bảo hành */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1.5">
                    Bảo hành
                  </label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      value={warranty}
                      onValue={(v) => setWarranty(Math.max(0, Math.floor(v)))}
                      className="w-16 px-2 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center"
                    />
                    <select
                      value={warrantyUnit}
                      onChange={(e) => setWarrantyUnit(e.target.value)}
                      className="flex-1 px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="tháng">tháng</option>
                      <option value="năm">năm</option>
                      <option value="ngày">ngày</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Fixed at bottom */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-4 rounded-xl font-bold text-lg shadow-lg active:scale-98 transition-all"
          >
            ✓ Lưu và Thêm vào giỏ hàng
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
