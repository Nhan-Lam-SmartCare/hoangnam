import React, { useState } from "react";
import { X, Search, Plus, Phone, MapPin, User } from "lucide-react";
import { useSuppliers, useCreateSupplier } from "../../hooks/useSuppliers";
import { showToast } from "../../utils/toast";

interface SupplierSelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedSupplierId: string;
  onSelectSupplier: (supplierId: string) => void;
}

type NewSupplier = {
  name: string;
  phone: string;
  address: string;
  note: string;
};

const SupplierListView: React.FC<{
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  filteredSuppliers: any[];
  selectedSupplierId: string;
  onSelectSupplier: (supplierId: string) => void;
  onClose: () => void;
  onShowAddForm: () => void;
}> = ({
  searchTerm,
  setSearchTerm,
  filteredSuppliers,
  selectedSupplierId,
  onSelectSupplier,
  onClose,
  onShowAddForm,
}) => (
  <>
    <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
      <div className="relative">
        <input
          type="text"
          placeholder="Tìm theo tên, SĐT..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 pl-9 text-sm border border-slate-250 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 outline-none"
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
      </div>
    </div>

    <div className="flex-1 overflow-y-auto p-3 space-y-2">
      {filteredSuppliers.length === 0 ? (
        <div className="text-center text-slate-500 py-12 flex flex-col items-center justify-center">
          <User className="w-12 h-12 text-slate-300 dark:text-slate-650 mb-2" />
          <div className="text-sm font-medium text-slate-400 dark:text-slate-500">Không tìm thấy nhà cung cấp</div>
        </div>
      ) : (
        filteredSuppliers.map((supplier: any) => (
          <div
            key={supplier.id}
            onClick={() => {
              onSelectSupplier(supplier.id);
              onClose();
            }}
            className={`p-3 rounded-xl border cursor-pointer transition-all ${
              selectedSupplierId === supplier.id
                ? "border-blue-500/50 bg-blue-50/50 dark:bg-blue-950/20 shadow-sm shadow-blue-500/5"
                : "border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/50 hover:bg-slate-50 dark:hover:bg-slate-800/80 active:scale-98"
            }`}
          >
            <div className="font-bold text-sm text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
              {supplier.name}
            </div>
            {supplier.phone && (
              <div className="text-xs text-slate-600 dark:text-slate-400 mt-1.5 flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span>{supplier.phone}</span>
              </div>
            )}
            {supplier.address && (
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                <span className="truncate">{supplier.address}</span>
              </div>
            )}
          </div>
        ))
      )}
    </div>

    <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
      <button
        onClick={onShowAddForm}
        className="w-full py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 active:scale-98 text-white rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md shadow-emerald-500/10 text-sm"
      >
        <Plus className="w-4 h-4" />
        <span>Thêm nhà cung cấp mới</span>
      </button>
    </div>
  </>
);

const AddSupplierForm: React.FC<{
  newSupplier: NewSupplier;
  setNewSupplier: React.Dispatch<React.SetStateAction<NewSupplier>>;
  onCancel: () => void;
  onSubmit: () => void;
  isPending: boolean;
}> = ({ newSupplier, setNewSupplier, onCancel, onSubmit, isPending }) => (
  <>
    <div className="flex-1 overflow-y-auto p-4 space-y-4">
      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
          Tên nhà cung cấp <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={newSupplier.name}
          onChange={(e) =>
            setNewSupplier({ ...newSupplier, name: e.target.value })
          }
          placeholder="Nhập tên nhà cung cấp"
          className="w-full px-3 py-2.5 text-sm border border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
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
          className="w-full px-3 py-2.5 text-sm border border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
          Địa chỉ
        </label>
        <textarea
          value={newSupplier.address}
          onChange={(e) =>
            setNewSupplier({ ...newSupplier, address: e.target.value })
          }
          placeholder="Nhập địa chỉ"
          rows={3}
          className="w-full px-3 py-2.5 text-sm border border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5 pl-1">
          Ghi chú
        </label>
        <textarea
          value={newSupplier.note}
          onChange={(e) =>
            setNewSupplier({ ...newSupplier, note: e.target.value })
          }
          placeholder="Ghi chú thêm"
          rows={2}
          className="w-full px-3 py-2.5 text-sm border border-slate-250 dark:border-slate-750 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500 resize-none"
        />
      </div>
    </div>

    <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex gap-2 flex-shrink-0">
      <button
        onClick={onCancel}
        className="flex-1 py-2.5 border border-slate-250 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-sm active:scale-98 transition-all hover:bg-slate-50 dark:hover:bg-slate-800"
      >
        Hủy
      </button>
      <button
        onClick={onSubmit}
        disabled={!newSupplier.name.trim() || isPending}
        className="flex-1 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-350 dark:disabled:from-slate-700 dark:disabled:to-slate-800 text-white rounded-xl font-bold text-sm active:scale-98 transition-all disabled:cursor-not-allowed shadow-md shadow-blue-500/10"
      >
        {isPending ? "Đang thêm..." : "Thêm NCC"}
      </button>
    </div>
  </>
);

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

  const [newSupplier, setNewSupplier] = useState<NewSupplier>({
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
      className="fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[110] flex items-end sm:items-center justify-center p-0 sm:p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-[#1e1e2d] w-full sm:max-w-md h-[80vh] sm:h-[70vh] sm:max-h-[600px] rounded-t-3xl sm:rounded-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800 shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-1.5 px-3 flex items-center justify-between flex-shrink-0 shadow-sm">
          <div className="flex items-center gap-1.5">
            <button
              onClick={onClose}
              className="text-white hover:text-slate-200 transition-colors p-0.5"
            >
              <X className="w-4 h-4" />
            </button>
            <h3 className="text-xs font-bold text-white">
              {showAddForm ? "Thêm nhà cung cấp mới" : "Chọn nhà cung cấp"}
            </h3>
          </div>
        </div>

        {!showAddForm ? (
          <SupplierListView
            searchTerm={searchTerm}
            setSearchTerm={setSearchTerm}
            filteredSuppliers={filteredSuppliers}
            selectedSupplierId={selectedSupplierId}
            onSelectSupplier={onSelectSupplier}
            onClose={onClose}
            onShowAddForm={() => setShowAddForm(true)}
          />
        ) : (
          <AddSupplierForm
            newSupplier={newSupplier}
            setNewSupplier={setNewSupplier}
            isPending={createSupplier.isPending}
            onSubmit={handleAddSupplier}
            onCancel={() => {
              setShowAddForm(false);
              setNewSupplier({
                name: "",
                phone: "",
                address: "",
                note: "",
              });
            }}
          />
        )}
      </div>
    </div>
  );
};
