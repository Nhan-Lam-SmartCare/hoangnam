import React, { useState } from "react";
import { useSuppliers, useCreateSupplier } from "../../hooks/useSuppliers";
import { showToast } from "../../utils/toast";

interface SupplierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSupplierId: string;
  onSelectSupplier: (supplierId: string) => void;
}

export const SupplierSelectionModal: React.FC<SupplierSelectionModalProps> = ({
  isOpen,
  onClose,
  selectedSupplierId,
  onSelectSupplier,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const { data: suppliers = [] } = useSuppliers();
  const createSupplier = useCreateSupplier();

  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });

  const filteredSuppliers = suppliers.filter((s: any) => {
    const term = searchTerm.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.phone?.toLowerCase().includes(term)
    );
  });

  const handleAddSupplier = async () => {
    if (!newSupplier.name.trim()) {
      showToast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    try {
      const created = await createSupplier.mutateAsync(newSupplier);
      showToast.success("Đã thêm nhà cung cấp");
      onSelectSupplier(created.id);
      setNewSupplier({ name: "", phone: "", address: "", note: "" });
      setShowAddForm(false);
      onClose();
    } catch (error: any) {
      showToast.error(error?.message || "Lỗi thêm nhà cung cấp");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[110] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-slate-800 w-full sm:max-w-md h-[85vh] sm:h-auto sm:max-h-[80vh] rounded-t-3xl sm:rounded-xl overflow-hidden flex flex-col"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 flex items-center justify-between flex-shrink-0">
          <h3 className="text-lg font-bold text-white">
            {showAddForm ? "Thêm NCC mới" : "Chọn nhà cung cấp"}
          </h3>
          <button
            onClick={onClose}
            className="text-white text-2xl leading-none"
          >
            ×
          </button>
        </div>

        {!showAddForm ? (
          <>
            {/* Search */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tìm theo tên, SĐT..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full px-4 py-3 pl-10 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                />
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>

            {/* Supplier List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {filteredSuppliers.length === 0 ? (
                <div className="text-center text-slate-500 py-12">
                  <div className="text-5xl mb-3">👤</div>
                  <div>Không tìm thấy nhà cung cấp</div>
                </div>
              ) : (
                filteredSuppliers.map((supplier: any) => (
                  <div
                    key={supplier.id}
                    onClick={() => {
                      onSelectSupplier(supplier.id);
                      onClose();
                    }}
                    className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedSupplierId === supplier.id
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                        : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 active:scale-98"
                    }`}
                  >
                    <div className="font-bold text-slate-900 dark:text-slate-100">
                      {supplier.name}
                    </div>
                    {supplier.phone && (
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        📞 {supplier.phone}
                      </div>
                    )}
                    {supplier.address && (
                      <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                        📍 {supplier.address}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

            {/* Add New Button */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex-shrink-0">
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-4 bg-green-600 hover:bg-green-700 active:scale-98 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-transform"
              >
                <span className="text-xl">+</span>
                <span>Thêm nhà cung cấp mới</span>
              </button>
            </div>
          </>
        ) : (
          <>
            {/* Add Form */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Tên nhà cung cấp <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={newSupplier.name}
                  onChange={(e) =>
                    setNewSupplier({ ...newSupplier, name: e.target.value })
                  }
                  placeholder="Nhập tên NCC"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={newSupplier.phone}
                  onChange={(e) =>
                    setNewSupplier({ ...newSupplier, phone: e.target.value })
                  }
                  placeholder="Nhập SĐT"
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Địa chỉ
                </label>
                <textarea
                  value={newSupplier.address}
                  onChange={(e) =>
                    setNewSupplier({ ...newSupplier, address: e.target.value })
                  }
                  placeholder="Nhập địa chỉ"
                  rows={3}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Ghi chú
                </label>
                <textarea
                  value={newSupplier.note}
                  onChange={(e) =>
                    setNewSupplier({ ...newSupplier, note: e.target.value })
                  }
                  placeholder="Ghi chú thêm"
                  rows={2}
                  className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                />
              </div>
            </div>

            {/* Form Actions */}
            <div className="p-3 border-t border-slate-200 dark:border-slate-700 flex gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewSupplier({
                    name: "",
                    phone: "",
                    address: "",
                    note: "",
                  });
                }}
                className="flex-1 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium active:scale-98 transition-transform"
              >
                Hủy
              </button>
              <button
                onClick={handleAddSupplier}
                disabled={!newSupplier.name.trim() || createSupplier.isPending}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-xl font-bold active:scale-98 transition-transform disabled:cursor-not-allowed"
              >
                {createSupplier.isPending ? "Đang thêm..." : "Thêm NCC"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
