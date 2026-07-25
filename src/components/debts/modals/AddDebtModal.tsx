import React, { useState } from "react";
import { X, PlusCircle, Calendar, User, Phone, Car } from "lucide-react";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import { showToast } from "../../../utils/toast";
import { useAppContext } from "../../../contexts/AppContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useCustomerSearchRepo } from "../../../hooks/useCustomersRepository";
import { useSuppliers } from "../../../hooks/useSuppliers";
import {
  useCreateCustomerDebtRepo,
  useCreateSupplierDebtRepo,
} from "../../../hooks/useDebtsRepository";
import type { Customer, Supplier } from "../../../types";

interface Props {
  initialType?: "customer" | "supplier";
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddDebtModal: React.FC<Props> = ({
  initialType = "customer",
  onClose,
  onSuccess,
}) => {
  const { currentBranchId } = useAppContext();
  const { user } = useAuth();

  const { data: customerSearchData } = useCustomerSearchRepo("", 0, 100);
  const customers: Customer[] = (customerSearchData?.data || []) as Customer[];
  const { data: suppliers = [] } = useSuppliers();

  const { mutateAsync: createCustomerDebt, isPending: isCreatingCustomer } =
    useCreateCustomerDebtRepo();
  const { mutateAsync: createSupplierDebt, isPending: isCreatingSupplier } =
    useCreateSupplierDebtRepo();

  const isPending = isCreatingCustomer || isCreatingSupplier;

  const [debtType, setDebtType] = useState<"customer" | "supplier">(
    initialType
  );
  const [selectedEntityId, setSelectedEntityId] = useState<string>("");
  const [name, setName] = useState<string>("");
  const [phone, setPhone] = useState<string>("");
  const [vehicleModel, setVehicleModel] = useState<string>("");
  const [description, setDescription] = useState<string>("");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [dueDate, setDueDate] = useState<string>("");

  const handleSelectEntity = (id: string) => {
    setSelectedEntityId(id);
    if (!id) return;
    if (debtType === "customer") {
      const found = customers.find((c: Customer) => c.id === id);
      if (found) {
        setName(found.name);
        setPhone(found.phone || "");
        setVehicleModel(found.vehicleModel || "");
      }
    } else {
      const found = (suppliers as Supplier[]).find((s: Supplier) => s.id === id);
      if (found) {
        setName(found.name);
        setPhone(found.phone || "");
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng / nhà cung cấp!");
      return;
    }
    if (!description.trim()) {
      showToast.error("Vui lòng nhập nội dung công nợ!");
      return;
    }
    if (totalAmount <= 0) {
      showToast.error("Vui lòng nhập số tiền công nợ lớn hơn 0 đ!");
      return;
    }

    try {
      const now = new Date().toISOString();
      const staffName =
        (user as any)?.user_metadata?.name ||
        (user as any)?.name ||
        user?.email ||
        "Nhân viên";

      if (debtType === "customer") {
        await createCustomerDebt({
          customerId: selectedEntityId || `custom-${Date.now()}`,
          customerName: name.trim(),
          phone: phone.trim() || undefined,
          vehicleModel: vehicleModel.trim() || undefined,
          description: description.trim(),
          totalAmount,
          paidAmount: 0,
          remainingAmount: totalAmount,
          createdDate: now,
          dueDate: dueDate || undefined,
          staffName,
          branchId: currentBranchId,
        });
      } else {
        await createSupplierDebt({
          supplierId: selectedEntityId || `custom-${Date.now()}`,
          supplierName: name.trim(),
          phone: phone.trim() || undefined,
          description: description.trim(),
          totalAmount,
          paidAmount: 0,
          remainingAmount: totalAmount,
          createdDate: now,
          dueDate: dueDate || undefined,
          staffName,
          branchId: currentBranchId,
        });
      }

      showToast.success("Tạo khoản công nợ mới thành công!");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Lỗi khi thêm công nợ:", err);
      showToast.error("Không thể tạo khoản công nợ: " + (err.message || "Lỗi server"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">Ghi nhận công nợ mới</h3>
              <p className="text-xs text-slate-400 font-medium">
                Tạo khoản nợ thủ công cho Khách hàng hoặc Nhà cung cấp
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Loại công nợ */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              Loại công nợ
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setDebtType("customer");
                  setSelectedEntityId("");
                }}
                className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  debtType === "customer"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                👤 Công nợ Khách hàng
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebtType("supplier");
                  setSelectedEntityId("");
                }}
                className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  debtType === "supplier"
                    ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/30"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                🏢 Công nợ Nhà cung cấp
              </button>
            </div>
          </div>

          {/* Chọn từ danh sách sẵn có (Option) */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Chọn {debtType === "customer" ? "khách hàng" : "nhà cung cấp"} sẵn có (Tùy chọn)
            </label>
            <select
              value={selectedEntityId}
              onChange={(e) => handleSelectEntity(e.target.value)}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500"
            >
              <option value="">-- Nhập thủ công bên dưới --</option>
              {debtType === "customer"
                ? customers.map((c: Customer) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.phone ? `(${c.phone})` : ""}
                    </option>
                  ))
                : (suppliers as Supplier[]).map((s: Supplier) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.phone ? `(${s.phone})` : ""}
                    </option>
                  ))}
            </select>
          </div>

          {/* Nhập Tên & SĐT */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <User className="w-3.5 h-3.5" /> Tên {debtType === "customer" ? "khách hàng" : "nhà cung cấp"} *
              </label>
              <input
                type="text"
                required
                placeholder="VD: Anh Hùng"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" /> Số điện thoại
              </label>
              <input
                type="text"
                placeholder="VD: 0987654321"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500"
              />
            </div>
          </div>

          {/* Xe / Thiết bị (Dành cho nợ KH) */}
          {debtType === "customer" && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Car className="w-3.5 h-3.5" /> Tên xe / Thiết bị / IMEI
              </label>
              <input
                type="text"
                placeholder="VD: Xe điện 48V, iPhone 15 Pro Max..."
                value={vehicleModel}
                onChange={(e) => setVehicleModel(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500"
              />
            </div>
          )}

          {/* Nội dung công nợ */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Nội dung công nợ *
            </label>
            <input
              type="text"
              required
              placeholder="VD: Nợ sửa chữa xe điện, Nợ nhập phụ tùng..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500"
            />
          </div>

          {/* Số tiền & Ngày hẹn trả */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Số tiền nợ (đ) *
              </label>
              <FormattedNumberInput
                value={totalAmount}
                onValue={(v) => setTotalAmount(Math.max(0, Math.round(v)))}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-right font-bold text-red-400 text-sm focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> Hạn hẹn trả
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full h-10 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-blue-500"
              />
            </div>
          </div>

          {/* Buttons */}
          <div className="pt-2 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 h-10 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-5 h-10 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs transition-all shadow-lg shadow-blue-900/40 disabled:opacity-50"
            >
              {isPending ? "Đang lưu..." : "Lưu công nợ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDebtModal;
