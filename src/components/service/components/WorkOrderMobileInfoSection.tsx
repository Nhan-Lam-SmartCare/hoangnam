import React from "react";
import {
  FileText,
  Wrench,
  CheckCircle,
  Smartphone,
  Check,
  Search,
  ChevronRight,
  Plus,
  PhoneCall,
  Edit2,
  X,
  Bike,
} from "lucide-react";
import type { Employee, Customer, Vehicle } from "../../../types";
import { WORK_ORDER_STATUS, type WorkOrderStatus } from "../../../constants";

interface WorkOrderMobileInfoSectionProps {
  status: WorkOrderStatus;
  setStatus: (status: WorkOrderStatus) => void;
  isTechnicianLockedForStaff: boolean;
  employees: Employee[];
  effectiveSelectedTechnicianId: string;
  setSelectedTechnicianId: (id: string) => void;
  showCustomerSearch: boolean;
  setShowCustomerSearch: (show: boolean) => void;
  customerSearchTerm: string;
  setCustomerSearchTerm: (term: string) => void;
  filteredCustomers: Customer[];
  handleSelectCustomer: (customer: Customer) => void;
  hasMoreCustomers: boolean;
  handleLoadMoreCustomers: (e: React.MouseEvent) => void;
  isSearchingCustomer: boolean;
  setShowAddCustomer: (show: boolean) => void;
  setNewCustomerPhone: (phone: string) => void;
  setNewCustomerName: (name: string) => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (customer: Customer | null) => void;
  isEditingCustomer: boolean;
  setIsEditingCustomer: (editing: boolean) => void;
  editCustomerName: string;
  setEditCustomerName: (name: string) => void;
  editCustomerPhone: string;
  setEditCustomerPhone: (phone: string) => void;
  handleSaveEditedCustomer: () => void;
  selectedVehicle: Vehicle | null;
  setSelectedVehicle: (vehicle: Vehicle | null) => void;
  customerVehicles: Vehicle[];
  handleSelectVehicle: (vehicle: Vehicle) => void;
  setShowAddVehicle: (show: boolean) => void;
  activeWarranty: any;
}

export const WorkOrderMobileInfoSection: React.FC<WorkOrderMobileInfoSectionProps> = ({
  status,
  setStatus,
  isTechnicianLockedForStaff,
  employees,
  effectiveSelectedTechnicianId,
  setSelectedTechnicianId,
  showCustomerSearch,
  setShowCustomerSearch,
  customerSearchTerm,
  setCustomerSearchTerm,
  filteredCustomers,
  handleSelectCustomer,
  hasMoreCustomers,
  handleLoadMoreCustomers,
  isSearchingCustomer,
  setShowAddCustomer,
  setNewCustomerPhone,
  setNewCustomerName,
  selectedCustomer,
  setSelectedCustomer,
  isEditingCustomer,
  setIsEditingCustomer,
  editCustomerName,
  setEditCustomerName,
  editCustomerPhone,
  setEditCustomerPhone,
  handleSaveEditedCustomer,
  selectedVehicle,
  setSelectedVehicle,
  customerVehicles,
  handleSelectVehicle,
  setShowAddVehicle,
  activeWarranty,
}) => {
  return (
    <div className="space-y-3 animate-in fade-in slide-in-from-right-4 duration-300">
      {/* KHỐI 1: TRẠNG THÁI & KỸ THUẬT VIÊN */}
      <div className="p-2.5 space-y-3">
        {/* Status Segmented Control */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            Trạng thái sửa chữa
          </label>
          <div className="grid grid-cols-4 gap-1.5 p-1 bg-white dark:bg-[#1e1e2d] rounded-xl border border-slate-200 dark:border-slate-700/50">
            {[
              { id: WORK_ORDER_STATUS.RECEIVED, label: "Nhận", icon: FileText },
              { id: WORK_ORDER_STATUS.IN_PROGRESS, label: "Sửa", icon: Wrench },
              { id: WORK_ORDER_STATUS.COMPLETED, label: "Xong", icon: CheckCircle },
              { id: WORK_ORDER_STATUS.DELIVERED, label: "Trả", icon: Smartphone },
            ].map((item) => {
              const isActive = status === item.id;
              const Icon = item.icon;
              return (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setStatus(item.id as WorkOrderStatus)}
                  className={`flex flex-col items-center justify-center py-2 rounded-lg transition-all ${
                    isActive
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20 scale-[1.02]"
                      : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 mb-0.5 ${isActive ? "text-white" : "text-slate-500"}`} />
                  <span className="text-[10px] font-bold">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Technician Selection - Premium Chips */}
        <div className="space-y-2.5">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            Kỹ thuật viên phụ trách
          </label>
          {isTechnicianLockedForStaff && (
            <p className="text-[10px] font-semibold text-blue-500 ml-1">
              Tài khoản nhân viên: kỹ thuật viên được cố định theo đăng nhập.
            </p>
          )}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide -mx-1 px-1">
            {employees
              .filter((emp) => !["Nguyễn Xuân Nhạn", "Võ Thanh Lâm"].includes(emp.name))
              .map((emp) => {
                const isActive = effectiveSelectedTechnicianId === emp.id;
                return (
                  <button
                    key={emp.id}
                    type="button"
                    disabled={isTechnicianLockedForStaff}
                    onClick={() => {
                      if (isTechnicianLockedForStaff) return;
                      setSelectedTechnicianId(emp.id);
                    }}
                    className={`flex-shrink-0 flex items-center gap-2 px-2.5 py-1.5 rounded-xl border transition-all ${
                      isActive
                        ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-500/20 scale-[1.02]"
                        : "bg-white dark:bg-[#1e1e2d] border-slate-200 dark:border-slate-700/50 text-slate-500 dark:text-slate-400 hover:border-slate-400 dark:hover:border-slate-600"
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                        isActive ? "bg-white/20 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500"
                      }`}
                    >
                      {emp.name.split(" ").pop()?.charAt(0) || "T"}
                    </div>
                    <span className="text-xs font-bold whitespace-nowrap">{emp.name}</span>
                    {isActive && <Check className="w-3 h-3" />}
                  </button>
                );
              })}
          </div>
        </div>
      </div>

      {/* KHỐI 2: KHÁCH HÀNG & THIẾT BỊ */}
      <div className="px-2.5 pb-3 space-y-2.5">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
          Thông tin khách hàng
        </label>

        {/* Customer Selection */}
        {showCustomerSearch ? (
          <div className="space-y-2.5">
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-focus-within:text-blue-500 transition-colors" />
              <input
                type="text"
                value={customerSearchTerm}
                onChange={(e) => setCustomerSearchTerm(e.target.value)}
                placeholder="Tìm tên hoặc số điện thoại..."
                className="w-full pl-10 pr-3 py-2.5 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-[13px] placeholder-slate-400 dark:placeholder-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
                autoFocus
              />
            </div>

            {/* Customer List */}
            <div className="max-h-52 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
              {filteredCustomers.map((customer) => {
                const primaryVehicle =
                  customer.vehicles?.find((v: any) => v.isPrimary) || customer.vehicles?.[0];

                return (
                  <div
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    className="p-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-xl cursor-pointer hover:border-blue-500/50 hover:bg-blue-50 dark:hover:bg-blue-500/5 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold">
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-slate-900 dark:text-white font-bold text-sm">
                            {customer.name}
                          </div>
                          <div className="text-xs text-slate-500 flex items-center gap-1">
                            <Smartphone className="w-3 h-3" />
                            {customer.phone}
                          </div>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-600" />
                    </div>

                    {(primaryVehicle?.model || customer.vehicleModel) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-xl">
                        <Bike className="w-3.5 h-3.5 text-blue-400" />
                        <span className="text-xs text-slate-300 font-medium truncate">
                          {primaryVehicle?.model || customer.vehicleModel}
                        </span>
                        {(primaryVehicle?.licensePlate || customer.licensePlate) && (
                          <span className="text-[10px] font-mono font-bold text-yellow-500 bg-yellow-500/10 px-1.5 py-0.5 rounded border border-yellow-500/20">
                            {primaryVehicle?.licensePlate || customer.licensePlate}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Load More Button */}
              {hasMoreCustomers && customerSearchTerm && (
                <button
                  type="button"
                  onClick={handleLoadMoreCustomers}
                  className="w-full py-3 text-blue-500 font-medium text-xs bg-blue-500/10 rounded-xl active:scale-[0.98] transition-transform"
                >
                  {isSearchingCustomer ? "Đang tải..." : "⬇️ Tải thêm khách hàng..."}
                </button>
              )}

              {/* Show add new customer when no results or always at bottom */}
              {customerSearchTerm && filteredCustomers.length === 0 && (
                <div className="text-center py-3 text-slate-400 text-xs">
                  Không tìm thấy khách hàng
                </div>
              )}

              {/* Add new customer button */}
              <button
                type="button"
                onClick={() => {
                  setShowAddCustomer(true);
                  if (/^[0-9]+$/.test(customerSearchTerm)) {
                    setNewCustomerPhone(customerSearchTerm);
                    setNewCustomerName("");
                  } else {
                    setNewCustomerName(customerSearchTerm);
                    setNewCustomerPhone("");
                  }
                }}
                className="w-full p-3 bg-green-500/20 border-2 border-dashed border-green-500/50 rounded-lg text-green-400 font-medium flex items-center justify-center gap-2 hover:bg-green-500/30 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Thêm khách hàng mới
              </button>
            </div>
          </div>
        ) : selectedCustomer ? (
          <div className="p-4 bg-white dark:bg-[#1e1e2d] border border-blue-200 dark:border-blue-500/30 rounded-2xl shadow-lg shadow-blue-500/5">
            {isEditingCustomer ? (
              // Edit mode - show input fields
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Tên khách hàng
                  </label>
                  <input
                    type="text"
                    value={editCustomerName}
                    onChange={(e) => setEditCustomerName(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                    placeholder="Nhập tên khách hàng"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={editCustomerPhone}
                    onChange={(e) => setEditCustomerPhone(e.target.value)}
                    className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                    placeholder="Nhập số điện thoại"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditingCustomer(false);
                      setEditCustomerName(selectedCustomer.name);
                      setEditCustomerPhone(selectedCustomer.phone || "");
                    }}
                    className="flex-1 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl text-xs font-bold active:scale-95 transition-all"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveEditedCustomer}
                    className="flex-1 py-2.5 bg-emerald-600 text-white rounded-xl text-xs font-bold active:scale-95 transition-all shadow-lg shadow-emerald-500/20"
                  >
                    Lưu thay đổi
                  </button>
                </div>
              </div>
            ) : (
              // View mode - show customer info with edit button
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-500/10 flex items-center justify-center text-blue-400 font-bold text-lg shadow-inner">
                    {selectedCustomer.name.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-slate-900 dark:text-white font-bold text-base">
                      {selectedCustomer.name}
                    </div>
                    <div className="text-xs text-slate-400 flex items-center gap-1.5">
                      <PhoneCall className="w-3 h-3 text-blue-400" />
                      {selectedCustomer.phone}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditCustomerName(selectedCustomer.name);
                      setEditCustomerPhone(selectedCustomer.phone || "");
                      setIsEditingCustomer(true);
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl active:scale-95 transition-all"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCustomer(null);
                      setSelectedVehicle(null);
                      setShowCustomerSearch(true);
                      setIsEditingCustomer(false);
                    }}
                    className="w-9 h-9 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl active:scale-95 transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Vehicle Selection */}
        {selectedCustomer && (
          <div className="space-y-3 pt-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
              Chọn thiết bị sửa chữa
            </label>

            <div className="grid grid-cols-1 gap-2.5">
              {customerVehicles.map((vehicle) => {
                const isActive = selectedVehicle?.id === vehicle.id;
                return (
                  <div
                    key={vehicle.id}
                    onClick={() => handleSelectVehicle(vehicle)}
                    className={`p-4 rounded-2xl cursor-pointer transition-all border ${
                      isActive
                        ? "bg-blue-600 border-blue-500 shadow-lg shadow-blue-500/20"
                        : "bg-white dark:bg-[#1e1e2d] border-slate-200 dark:border-slate-700/30 hover:border-slate-400 dark:hover:border-slate-600"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400"
                          }`}
                        >
                          <Bike className="w-5 h-5" />
                        </div>
                        <div>
                          <div
                            className={`font-bold text-sm ${
                              isActive ? "text-white" : "text-slate-900 dark:text-slate-200"
                            }`}
                          >
                            {vehicle.model}
                          </div>
                          <div className={`text-xs font-mono ${isActive ? "text-blue-100" : "text-slate-500"}`}>
                            {vehicle.licensePlate}
                          </div>
                        </div>
                      </div>
                      {isActive && <CheckCircle className="w-5 h-5 text-white" />}
                    </div>
                  </div>
                );
              })}

              {/* Add New Vehicle Button */}
              <button
                type="button"
                onClick={() => setShowAddVehicle(true)}
                className="w-full py-3.5 border-2 border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl text-slate-500 hover:text-blue-400 transition-all flex items-center justify-center gap-2 text-xs font-bold"
              >
                <Plus className="w-4 h-4" />
                Thêm thiết bị mới
              </button>
            </div>
          </div>
        )}

        {/* Warranty Status Badge */}
        {selectedVehicle && activeWarranty && (
          <div className="px-4 pb-4">
            <div className="p-4 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border-2 border-emerald-500 rounded-2xl">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-emerald-500/30 flex items-center justify-center">
                  <span className="text-lg">🛡️</span>
                </div>
                <div>
                  <div className="text-emerald-400 font-bold text-sm">CÒN BẢO HÀNH</div>
                  <div className="text-emerald-300 text-xs">
                    Còn {activeWarranty.days_remaining} ngày • Hết hạn:{" "}
                    {new Date(activeWarranty.warranty_end_date).toLocaleDateString("vi-VN")}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
