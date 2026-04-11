import React, { useState } from "react";
import { useCategories, useCreateCategory } from "../../../hooks/useCategories";
import { showToast } from "../../../utils/toast";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import { validatePriceAndQty } from "../../../utils/validation";

export interface AddProductModalProps {
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
}

const AddProductModal: React.FC<AddProductModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [barcode, setBarcode] = useState("");
  const [category, setCategory] = useState("");
  const [quantity, setQuantity] = useState<number>(1);
  const [importPrice, setImportPrice] = useState<number>(0);
  const [laborCost, setLaborCost] = useState<number>(0);
  const [retailPrice, setRetailPrice] = useState<number>(0);
  const [warranty, setWarranty] = useState<number>(0);
  const [warrantyUnit, setWarrantyUnit] = useState("th├íng");
  const [retailOverridden, setRetailOverridden] = useState<boolean>(false);
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = () => {
    if (!name.trim()) {
      showToast.warning("Vui l├▓ng nhß║¡p t├¬n sß║ún phß║⌐m");
      return;
    }

    onSave({
      name: name.trim(),
      description: description.trim(),
      barcode: barcode.trim(),
      category: category || "Ch╞░a ph├ón loß║íi",
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
    setWarrantyUnit("th├íng");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center z-[9999] p-0 sm:p-4">
      {/* Mobile: Full screen bottom sheet, Desktop: Centered modal */}
      <div className="bg-white dark:bg-slate-800 w-full sm:max-w-xl sm:rounded-lg rounded-t-2xl max-h-[95vh] sm:max-h-[85vh] overflow-hidden flex flex-col animate-slide-up sm:animate-none">
        {/* Header - Sticky */}
        <div className="flex justify-between items-center px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 sm:from-white sm:to-white sm:dark:from-slate-800 sm:dark:to-slate-800 flex-shrink-0">
          <h2 className="text-base font-bold text-white sm:text-slate-900 sm:dark:text-slate-100">
            Th├¬m sß║ún phß║⌐m mß╗¢i
          </h2>
          <button
            onClick={onClose}
            className="text-white sm:text-slate-500 hover:text-slate-300 sm:hover:text-slate-700 sm:dark:hover:text-slate-300 text-2xl w-8 h-8 flex items-center justify-center"
          >
            ├ù
          </button>
        </div>

        {/* Form Content - Scrollable */}
        <div className="flex-1 overflow-y-auto px-4 py-4 overscroll-contain bg-slate-50 dark:bg-slate-900 sm:bg-white sm:dark:bg-slate-800">
          <div className="space-y-4 pb-4">
            {/* Card 1: Th├┤ng tin c╞í bß║ún */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wide mb-3">
                ≡ƒôª Th├┤ng tin sß║ún phß║⌐m
              </h3>
              
              {/* T├¬n sß║ún phß║⌐m */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  T├¬n sß║ún phß║⌐m <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Nhß║¡p t├¬n sß║ún phß║⌐m"
                  autoFocus
                />
              </div>

              {/* Danh mß╗Ñc */}
              <div className="mb-3">
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Danh mß╗Ñc sß║ún phß║⌐m
                </label>
                <div className="flex gap-2">
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="flex-1 px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="">-- Chß╗ìn hoß║╖c tß║ío mß╗¢i --</option>
                    {categories.map((c: any) => (
                      <option key={c.id} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setShowInlineCat(true)}
                    className="w-12 h-12 flex items-center justify-center bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-600 rounded-xl hover:bg-blue-100 dark:hover:bg-blue-900/50"
                    aria-label="Th├¬m danh mß╗Ñc mß╗¢i"
                  >
                    <span className="text-xl text-blue-600 dark:text-blue-400 font-bold">
                      +
                    </span>
                  </button>
                </div>
              </div>

            {/* Inline category form */}
            {showInlineCat && (
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 border border-blue-200 dark:border-blue-700">
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = inlineCatName.trim();
                    if (!trimmed) {
                      showToast.warning("Vui l├▓ng nhß║¡p t├¬n danh mß╗Ñc");
                      return;
                    }
                    if (trimmed.length < 2) {
                      showToast.warning("T├¬n qu├í ngß║»n");
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
                      showToast.error(err?.message || "Lß╗ùi tß║ío danh mß╗Ñc");
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    placeholder="Nhß║¡p t├¬n danh mß╗Ñc mß╗¢i"
                    className="flex-1 px-3 py-2.5 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    L╞░u
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineCat(false);
                      setInlineCatName("");
                    }}
                    className="px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                  >
                    Hß╗ºy
                  </button>
                </form>
              </div>
            )}

              {/* M├ú sß║ún phß║⌐m */}
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  M├ú sß║ún phß║⌐m (SKU)
                </label>
                <input
                  type="text"
                  value={barcode}
                  onChange={(e) => setBarcode(e.target.value)}
                  placeholder="VD: 06455-KYJ-841"
                  className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-mono"
                />
                <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                  ─Éß╗â trß╗æng ─æß╗â tß╗▒ sinh m├ú PT-xxxxx
                </p>
              </div>
            </div>

            {/* Card 2: M├┤ tß║ú */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wide mb-3">
                ≡ƒô¥ M├┤ tß║ú
              </h3>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                placeholder="M├┤ tß║ú sß║ún phß║⌐m (t├╣y chß╗ìn)"
              />
            </div>

            {/* Card 3: Th├┤ng tin nhß║¡p kho */}
            <div className="bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-3">
                ≡ƒÆ░ Th├┤ng tin nhß║¡p kho
              </h3>
              
              {/* Grid 2x2 on mobile, 3 columns on desktop */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Sß╗æ l╞░ß╗úng
                  </label>
                  <FormattedNumberInput
                    value={quantity}
                    onValue={(v) => {
                      const result = validatePriceAndQty(importPrice, v);
                      if (result.warnings.length)
                        result.warnings.forEach((w) => showToast.warning(w));
                      setQuantity(Math.max(1, result.clean.quantity));
                    }}
                    className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Gi├í nhß║¡p
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
                    className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Tiß╗ün c├┤ng
                  </label>
                  <FormattedNumberInput
                    value={laborCost}
                    onValue={(v) => setLaborCost(Math.max(0, Math.round(v)))}
                    className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Gi├í b├ín lß║╗
                  </label>
                  <FormattedNumberInput
                    value={retailPrice}
                    onValue={(v) => {
                      setRetailPrice(Math.max(0, Math.round(v)));
                      setRetailOverridden(true);
                    }}
                    className="w-full px-3 py-3 text-base border border-green-300 dark:border-green-600 rounded-xl bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-right font-bold"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-600 dark:text-slate-400 mb-1 font-medium">
                    Bß║úo h├ánh
                  </label>
                  <div className="flex gap-1">
                    <FormattedNumberInput
                      value={warranty}
                      onValue={(v) => setWarranty(Math.max(0, Math.floor(v)))}
                      className="w-full px-3 py-3 text-base border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-center"
                    />
                    <select
                      value={warrantyUnit}
                      onChange={(e) => setWarrantyUnit(e.target.value)}
                      className="w-20 px-1 py-3 text-sm border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                    >
                      <option value="th├íng">th├íng</option>
                      <option value="n─âm">n─âm</option>
                      <option value="ng├áy">ng├áy</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer - Sticky at bottom */}
        <div className="px-4 py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex-shrink-0">
          <button
            onClick={handleSubmit}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-4 py-4 rounded-xl font-bold text-base shadow-lg shadow-orange-500/30 active:scale-98 transition-all"
          >
            Γ£ô L╞░u v├á Th├¬m v├áo giß╗Å h├áng
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddProductModal;
