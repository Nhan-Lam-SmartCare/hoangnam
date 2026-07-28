import React, { useState, useEffect } from 'react';
import { Check, Package, Coins, Camera } from 'lucide-react';
import { showToast } from '../../../utils/toast';
import { validatePriceAndQty } from '../../../utils/validation';
import { generateSKU } from '../../../utils/sku';
import FormattedNumberInput from '../../common/FormattedNumberInput';
import { useCategories, useCreateCategory } from '../../../hooks/useCategories';
import { calcSellingFromRule, getCategoryPricingRule } from '../../../utils/categoryPricingRules';
import BarcodeScannerModal from '../../common/BarcodeScannerModal';
import UiModal from '../../ui/Modal';

import { useAppContext } from '../../../contexts/AppContext';
import { useBranchesRepo } from '../../../hooks/useBranchesRepository';
import { isPhoneBranch } from '../../../utils/branchUtils';

// Add New Product Modal Component
const AddProductModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  onSave: (productData: {
    name: string;
    description: string;
    barcode: string;
    imei?: string;
    color?: string;
    category: string;
    quantity: number;
    importPrice: number;
    laborCost: number;
    retailPrice: number;
    warranty: number;
    warrantyUnit: string;
  }) => void;
}> = ({ isOpen, onClose, onSave }) => {
  const { currentBranchId } = useAppContext();
  const { data: branchesRepo = [] } = useBranchesRepo();
  const hideLaborCost = isPhoneBranch(currentBranchId, branchesRepo);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [imei, setImei] = useState("");
  const [color, setColor] = useState("");
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
  const sortedCategories = React.useMemo(() => {
    const map = new Map<string, any>();
    for (const c of categories) {
      if (!c.name) continue;
      const key = c.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { ...c, name: c.name.trim() });
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  }, [categories]);
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

    const finalBarcode = barcode.trim() || generateSKU();

    onSave({
      name: name.trim(),
      description: description.trim(),
      barcode: finalBarcode,
      imei: imei.trim(),
      color: color.trim(),
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
    setImei("");
    setColor("");
    setCategory("");
    setQuantity(1);
    setImportPrice(0);
    setLaborCost(0);
    setRetailPrice(0);
    setWarranty(0);
    setRetailOverridden(false);
    setWarrantyUnit("tháng");
  };

  return (
    <>
      <UiModal
        open={isOpen}
        title="Thêm sản phẩm mới"
        onClose={onClose}
        className="max-w-3xl"
      >
        <div className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
          <div className="space-y-4">
            {/* Card: Thông tin sản phẩm */}
            <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 pl-0.5">
                <Package className="w-3.5 h-3.5 text-blue-500" />
                <span>Thông tin sản phẩm</span>
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Tên sản phẩm */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Tên sản phẩm <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="Nhập tên sản phẩm"
                  />
                </div>

                {/* Danh mục */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Danh mục sản phẩm
                  </label>
                  <div className="flex gap-2">
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    >
                      <option value="">-- Chọn danh mục --</option>
                      {sortedCategories.map((c: any) => (
                        <option key={c.id} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setShowInlineCat(true)}
                      className="w-10 h-10 flex items-center justify-center bg-blue-50/60 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/40 text-blue-600 dark:text-blue-400 transition-colors font-bold flex-shrink-0"
                      aria-label="Thêm danh mục mới"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Mã vạch / SKU */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Mã vạch / SKU sản phẩm
                  </label>
                  <input
                    type="text"
                    value={barcode}
                    onChange={(e) => setBarcode(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 font-mono"
                    placeholder="VD: A01, IP17PRO..."
                  />
                </div>

                {/* Số IMEI / Seri (Cấu hình riêng) */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1 flex items-center justify-between">
                    <span>Số IMEI / Seri máy (Riêng biệt)</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={imei}
                      onChange={(e) => setImei(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 font-mono"
                      placeholder="Nhập IMEI / Seri riêng..."
                    />
                    <button
                      type="button"
                      onClick={() => setShowScanner(true)}
                      className="w-10 h-10 flex items-center justify-center bg-indigo-50/60 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800 rounded-xl hover:bg-indigo-100 dark:hover:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 transition-colors flex-shrink-0"
                      aria-label="Quét IMEI hoặc Mã vạch"
                      title="Quét IMEI / Mã vạch"
                    >
                      <Camera className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Màu sắc */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Màu sắc
                  </label>
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    placeholder="VD: Đen, Trắng, Titanium, Xám..."
                  />
                </div>
              </div>
            </div>

            {/* Inline category form */}
            {showInlineCat && (
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
                <div className="space-y-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-550 dark:text-slate-400">
                    Tạo danh mục mới
                  </label>
                  <input
                    autoFocus
                    type="text"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    placeholder="Nhập tên danh mục mới"
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={async () => {
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
                      className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300 font-bold text-xs active:scale-98 transition-all"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Card: Thông tin nhập kho */}
            <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-800">
              <h3 className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5 pl-0.5">
                <Coins className="w-3.5 h-3.5 text-emerald-500" />
                <span>Thông tin nhập kho & Giá</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                {/* Số lượng */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Số lượng
                  </label>
                  <FormattedNumberInput
                    value={quantity}
                    onValue={(v) => {
                      const result = validatePriceAndQty(importPrice, v);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setQuantity(Math.max(0, result.clean.quantity));
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-center font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                {/* Giá nhập */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
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
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                {/* Giá bán lẻ */}
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Giá bán lẻ (đ)
                  </label>
                  <FormattedNumberInput
                    value={retailPrice}
                    onValue={(v) => {
                      setRetailPrice(Math.max(0, Math.round(v)));
                      setRetailOverridden(true);
                    }}
                    className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>

                {/* Tiền công */}
                {!hideLaborCost && (
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                      Tiền công (đ)
                    </label>
                    <FormattedNumberInput
                      value={laborCost}
                      onValue={(v) => setLaborCost(Math.max(0, Math.round(v)))}
                      className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                )}

                {/* Bảo hành */}
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
                    Bảo hành
                  </label>
                  <div className="flex gap-2">
                    <FormattedNumberInput
                      value={warranty}
                      onValue={(v) => setWarranty(Math.max(0, Math.floor(v)))}
                      className="w-24 px-2 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-center font-bold outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                    <select
                      value={warrantyUnit}
                      onChange={(e) => setWarrantyUnit(e.target.value)}
                      className="flex-1 px-3 py-2 text-sm border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
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

          {/* Footer button */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              onClick={handleSubmit}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-2.5 rounded-xl font-bold text-sm shadow-md shadow-orange-500/10 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <Check className="w-4 h-4" />
              <span>Lưu và Thêm vào giỏ hàng</span>
            </button>
          </div>
        </div>
      </UiModal>
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
