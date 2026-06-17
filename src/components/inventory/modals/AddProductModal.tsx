import React, { useState, useEffect } from 'react';
import { X, Plus, Check, Package, FileText, Coins, Camera } from 'lucide-react';
import { showToast } from '../../../utils/toast';
import { validatePriceAndQty } from '../../../utils/validation';
import FormattedNumberInput from '../../common/FormattedNumberInput';
import { useCategories, useCreateCategory } from '../../../hooks/useCategories';
import { calcSellingFromRule, getCategoryPricingRule } from '../../../utils/categoryPricingRules';
import BarcodeScannerModal from '../../common/BarcodeScannerModal';
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
    laborCost: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
  }) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [importPrice, setImportPrice] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [warranty, setWarranty] = useState<number>(0);
  const [warrantyUnit, setWarrantyUnit] = useState("tháng");
  const [retailOverridden, setRetailOverridden] = useState<boolean>(false);
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const getSuggestedRetailPrice = (nextImportPrice: number, nextCategory: string) => {
    const rule = getCategoryPricingRule(nextCategory || "");
    return calcSellingFromRule(nextImportPrice, rule.markupPercent, rule.roundingRule);
  };

  useEffect(() => {
    if (retailOverridden) return;
    setRetailPrice(getSuggestedRetailPrice(importPrice, category));
  }, [category, importPrice, retailOverridden]);

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
      laborCost: Number(laborCost) || 0,
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
    setLaborCost(0);
    setRetailPrice(0);
    setWarranty(0);
    setRetailOverridden(false);
    setWarrantyUnit("tháng");
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/70 backdrop-blur-[2px] flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
        <div className="bg-white dark:bg-[#1e1e2d] w-full sm:rounded-2xl sm:max-w-4xl max-h-[95vh] sm:max-h-[92vh] overflow-hidden flex flex-col rounded-t-2xl border border-slate-200/70 dark:border-slate-700 shadow-2xl">
          {/* Header - Mobile optimized */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-1.5 px-3 flex items-center justify-between flex-shrink-0 shadow-sm">
            <div className="flex items-center gap-1.5">
              <button
                onClick={onClose}
                className="text-white hover:text-slate-200 transition-colors p-0.5"
              >
                <X className="w-4 h-4" />
              </button>
              <h2 className="text-xs font-bold text-white flex items-center gap-1.5">
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm sản phẩm mới</span>
              </h2>
            </div>
          </div>

          {/* Form Content */}
          <div className="flex-1 overflow-y-auto px-4 py-3 bg-slate-50 dark:bg-slate-900/50">
            <div className="space-y-3 sm:space-y-0 sm:grid sm:grid-cols-12 sm:gap-3">
              {/* Card: Thông tin sản phẩm */}
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 sm:p-3 shadow-sm sm:col-span-12 border border-slate-150 dark:border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 pl-0.5">
                  <Package className="w-3.5 h-3.5 text-blue-500" />
                  <span>Thông tin sản phẩm</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Tên sản phẩm */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
                      Tên sản phẩm <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                      placeholder="Nhập tên sản phẩm"
                    />
                  </div>

                  {/* Danh mục */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
                      Danh mục sản phẩm
                    </label>
                    <div className="flex gap-2">
                      <select
                        value={category}
                        onChange={(e) => setCategory(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
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
                        className="w-10 h-10 flex items-center justify-center bg-blue-50/60 dark:bg-blue-950/30 border border-blue-250/30 dark:border-blue-800/50 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors"
                        aria-label="Thêm danh mục mới"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Barcode / SKU / IMEI */}
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
                      Mã vạch / SKU / IMEI
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={barcode}
                        onChange={(e) => setBarcode(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                        placeholder="Nhập mã vạch hoặc IMEI..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowScanner(true)}
                        className="w-10 h-10 flex items-center justify-center bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-250/30 dark:border-indigo-800/50 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 transition-colors flex-shrink-0"
                        aria-label="Quét mã vạch hoặc IMEI"
                      >
                        <Camera className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Inline category form */}
              {showInlineCat && (
                <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 sm:p-3 shadow-sm sm:col-span-12 border border-slate-150 dark:border-slate-800/80">
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
                    className="space-y-2"
                  >
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                      Tạo danh mục mới
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={inlineCatName}
                      onChange={(e) => setInlineCatName(e.target.value)}
                      placeholder="Nhập tên danh mục mới"
                      className="w-full px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                    <div className="flex gap-2">
                      <button
                        type="submit"
                        className="flex-1 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl font-bold text-xs shadow-md shadow-blue-500/10 active:scale-98 transition-all"
                      >
                        Lưu danh mục
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowInlineCat(false);
                          setInlineCatName("");
                        }}
                        className="flex-1 px-4 py-2 border border-slate-250 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-98 transition-all"
                      >
                        Hủy
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Card: Thông tin nhập kho */}
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 sm:p-3 shadow-sm sm:col-span-12 border border-slate-150 dark:border-slate-800/80">
                <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5 pl-0.5">
                  <Coins className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Thông tin nhập kho</span>
                </h3>

                <div className="grid grid-cols-2 sm:grid-cols-12 gap-3">
                  {/* Số lượng */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
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
                      className="w-full px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-center font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  {/* Giá nhập */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
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
                            getSuggestedRetailPrice(result.clean.importPrice, category)
                          );
                        }
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  {/* Giá bán lẻ */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
                      Giá bán lẻ (đ)
                    </label>
                    <FormattedNumberInput
                      value={retailPrice}
                      onValue={(v) => {
                        setRetailPrice(Math.max(0, Math.round(v)));
                        setRetailOverridden(true);
                      }}
                      className="w-full px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  {/* Tiền công */}
                  <div className="col-span-1 sm:col-span-2">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
                      Tiền công (đ)
                    </label>
                    <FormattedNumberInput
                      value={laborCost}
                      onValue={(v) => setLaborCost(Math.max(0, Math.round(v)))}
                      className="w-full px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>

                  {/* Bảo hành */}
                  <div className="col-span-2 sm:col-span-4">
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400 mb-1.5 pl-1">
                      Bảo hành
                    </label>
                    <div className="flex gap-2">
                      <FormattedNumberInput
                        value={warranty}
                        onValue={(v) => setWarranty(Math.max(0, Math.floor(v)))}
                        className="w-16 px-2 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-center font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                      />
                      <select
                        value={warrantyUnit}
                        onChange={(e) => setWarrantyUnit(e.target.value)}
                        className="flex-1 px-3 py-2 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
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
          <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-850 bg-white dark:bg-[#1e1e2d] flex-shrink-0">
            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-orange-500/10 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Lưu và Thêm vào giỏ hàng</span>
            </button>
        </div>
      </div>
    </div>
    <BarcodeScannerModal
      isOpen={showScanner}
      onClose={() => setShowScanner(false)}
      onScan={(code) => setBarcode(code)}
      title="Quét Mã vạch / IMEI"
    />
  </>
  );
};

export default AddProductModal;
