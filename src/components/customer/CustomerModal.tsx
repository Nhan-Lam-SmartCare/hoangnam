import React, { useState, useMemo } from "react";
import {
  Smartphone,
  X,
  User,
  Phone,
  Star,
  Hash,
} from "lucide-react";
import { validatePhoneNumber } from "../../utils/validation";
import { PlusIcon, TrashIcon, UsersIcon } from "../Icons";
import type { Customer, Vehicle } from "../../types";
import { showToast } from "../../utils/toast";
import { POPULAR_DEVICES, validateSerialOrIMEI } from "../../constants/devices";
import UiModal from "../ui/Modal";

interface CustomerModalProps {
  customer: Customer;
  existingCustomers: Customer[];
  onSave: (c: Partial<Customer> & { id?: string }) => void;
  onClose: () => void;
}

const CustomerModal: React.FC<CustomerModalProps> = ({ customer, existingCustomers, onSave, onClose }) => {
  const [name, setName] = useState(customer.name || "");
  const [phone, setPhone] = useState(customer.phone || "");

  const normalizePhone = (value?: string) =>
    String(value || "")
      .replace(/\D/g, "")
      .trim();

  const phoneError = useMemo(() => {
    const currentPhone = phone.trim();
    if (!currentPhone) return "";

    const phoneValidation = validatePhoneNumber(currentPhone);
    if (!phoneValidation.ok) {
      return phoneValidation.error || "Số điện thoại không hợp lệ";
    }

    const normalizedCurrentPhone = normalizePhone(currentPhone);
    const duplicated = existingCustomers.some((item) => {
      if (customer.id && item.id === customer.id) return false;
      return normalizePhone(item.phone) === normalizedCurrentPhone;
    });

    return duplicated ? "Số điện thoại đã tồn tại" : "";
  }, [phone, existingCustomers, customer.id]);

  const initVehicles = () => {
    if (customer.vehicles && customer.vehicles.length > 0) {
      return customer.vehicles;
    }
    if (customer.vehicleModel || customer.licensePlate) {
      return [
        {
          id: `VEH-${Date.now()}`,
          model: customer.vehicleModel || "",
          licensePlate: customer.licensePlate || "",
          isPrimary: true,
        },
      ];
    }
    return [];
  };

  const [vehicles, setVehicles] = useState<Vehicle[]>(initVehicles());
  const [newVehicle, setNewVehicle] = useState({ model: "", licensePlate: "" });
  const [showModelSuggestions, setShowModelSuggestions] = useState(false);

  // Lọc gợi ý thiết bị theo input
  const filteredModels = useMemo(() => {
    if (!newVehicle.model.trim()) return POPULAR_DEVICES.slice(0, 20);
    const search = newVehicle.model.toLowerCase();
    return POPULAR_DEVICES.filter((m) =>
      m.toLowerCase().includes(search)
    ).slice(0, 15);
  }, [newVehicle.model]);

  const serialError = useMemo(() => {
    const val = newVehicle.licensePlate.trim();
    if (!val) return "";
    const result = validateSerialOrIMEI(val);
    return result.ok ? "" : (result.error || "");
  }, [newVehicle.licensePlate]);

  const addVehicle = () => {
    if (!newVehicle.model.trim() && !newVehicle.licensePlate.trim()) return;
    if (serialError) {
      showToast.error(serialError);
      return;
    }
    const vehicle: Vehicle = {
      id: `VEH-${Date.now()}`,
      model: newVehicle.model.trim(),
      licensePlate: newVehicle.licensePlate.trim(),
      isPrimary: vehicles.length === 0,
    };
    setVehicles([...vehicles, vehicle]);
    setNewVehicle({ model: "", licensePlate: "" });
  };

  const removeVehicle = (id: string) => {
    setVehicles(vehicles.filter((v) => v.id !== id));
  };

  const setPrimaryVehicle = (id: string) => {
    setVehicles(
      vehicles.map((v) => ({
        ...v,
        isPrimary: v.id === id,
      }))
    );
  };

  const handleSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!name.trim()) {
      showToast.error("Vui lòng nhập tên khách hàng");
      return;
    }

    if (phoneError) {
      showToast.error(phoneError);
      return;
    }

    const primaryVehicle = vehicles.find((v) => v.isPrimary) || vehicles[0];
    onSave({
      id: customer.id,
      name: name.trim(),
      phone: phone.trim(),
      vehicles: vehicles,
      vehicleModel: primaryVehicle?.model || "",
      licensePlate: primaryVehicle?.licensePlate || "",
    });
    onClose();
  };

  return (
    <UiModal
      open={true}
      title={customer.id ? "Chỉnh sửa khách hàng" : "Thêm khách hàng mới"}
      onClose={onClose}
      className="max-w-xl"
    >
      <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        {/* Basic Info Section */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
            <UsersIcon className="w-3.5 h-3.5" />
            Thông tin cơ bản
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                Tên khách hàng <span className="text-red-500">*</span>
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <User className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="text"
                  placeholder="Nhập tên khách hàng..."
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all text-sm shadow-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700 dark:text-slate-300 ml-1">
                Số điện thoại
              </label>
              <div className="relative group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Phone className="h-4 w-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                </div>
                <input
                  type="tel"
                  placeholder="VD: 0912345678"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className={`w-full pl-10 pr-4 py-2.5 bg-white dark:bg-slate-900 border rounded-xl text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 transition-all text-sm shadow-sm ${
                    phoneError
                      ? "border-red-400 dark:border-red-500 focus:ring-red-500/20 focus:border-red-500"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500/20 focus:border-blue-500"
                  }`}
                />
              </div>
              {phoneError && (
                <p className="text-xs text-red-500 ml-1 mt-1">{phoneError}</p>
              )}
            </div>
          </div>
        </div>

        {/* Vehicles Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-wider">
              <Smartphone className="w-3.5 h-3.5" />
              Danh sách thiết bị ({vehicles.length})
            </div>
          </div>

          {/* Vehicle List */}
          <div className="space-y-3">
            {vehicles.map((vehicle) => (
              <div
                key={vehicle.id}
                className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 flex items-center justify-between group hover:border-blue-500/30 transition-all shadow-sm"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPrimaryVehicle(vehicle.id)}
                    className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                      vehicle.isPrimary
                        ? "bg-amber-100 dark:bg-amber-900/30 text-amber-500 border border-amber-200 dark:border-amber-800/50"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-400 hover:text-amber-500 border border-slate-200 dark:border-slate-600"
                    }`}
                    title={vehicle.isPrimary ? "Thiết bị chính" : "Đặt làm thiết bị chính"}
                  >
                    <Star className={`w-5 h-5 ${vehicle.isPrimary ? "fill-current" : ""}`} />
                  </button>
                  <div>
                    <div className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                      {vehicle.model || "Chưa rõ thiết bị"}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                      <Hash className="w-3 h-3" />
                      {vehicle.licensePlate || "Chưa có Serial/IMEI"}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => removeVehicle(vehicle.id)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all opacity-0 group-hover:opacity-100 md:opacity-100"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            ))}

            {vehicles.length === 0 && (
              <div className="text-center py-6 bg-slate-100/50 dark:bg-slate-900/30 rounded-2xl border-2 border-dashed border-slate-200 dark:border-slate-700">
                <Smartphone className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">Chưa có thiết bị nào được thêm</p>
              </div>
            )}
          </div>

          {/* Add Vehicle Form */}
          <div className="bg-blue-50/50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30 rounded-2xl p-4 space-y-4">
            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
              Thêm thiết bị mới
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Tên thiết bị (VD: iPhone 15 Pro...)"
                  value={newVehicle.model}
                  onChange={(e) => {
                    setNewVehicle({ ...newVehicle, model: e.target.value });
                    setShowModelSuggestions(true);
                  }}
                  onFocus={() => setShowModelSuggestions(true)}
                  className="w-full px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                {showModelSuggestions && filteredModels.length > 0 && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-10 max-h-48 overflow-y-auto custom-scrollbar">
                    {filteredModels.map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => {
                          setNewVehicle({ ...newVehicle, model: m });
                          setShowModelSuggestions(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0"
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <input
                  type="text"
                  placeholder="Serial / IMEI (VD: 356938...)"
                  value={newVehicle.licensePlate}
                  onChange={(e) => setNewVehicle({ ...newVehicle, licensePlate: e.target.value.toUpperCase() })}
                  className={`w-full px-4 py-2.5 bg-white dark:bg-slate-900 border rounded-xl text-sm focus:outline-none focus:ring-2 ${
                    serialError
                      ? "border-red-400 dark:border-red-500 focus:ring-red-500/20"
                      : "border-slate-200 dark:border-slate-700 focus:ring-blue-500/20"
                  }`}
                />
                {serialError && (
                  <p className="text-xs text-red-500 ml-1 mt-1">{serialError}</p>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={addVehicle}
              disabled={!newVehicle.model.trim() && !newVehicle.licensePlate.trim()}
              className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-700 text-white font-bold rounded-xl text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              <PlusIcon className="w-4 h-4" />
              Thêm vào danh sách
            </button>
          </div>
        </div>

        {/* Footer actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-bold rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-all text-sm"
          >
            Hủy
          </button>
          <button
            onClick={() => handleSubmit()}
            className="px-8 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-blue-200 dark:shadow-none text-sm"
          >
            Lưu khách hàng
          </button>
        </div>
      </div>
    </UiModal>
  );
};

export default CustomerModal;
