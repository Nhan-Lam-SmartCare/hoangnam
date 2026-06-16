import React from "react";
import { Bike, Trash2, Minus, Plus, ChevronRight } from "lucide-react";
import type { Vehicle, Customer } from "../../../types";

interface WorkOrderMobilePartsSectionProps {
  selectedVehicle: Vehicle | null;
  setActiveSection: (section: "info" | "issue" | "parts" | "payment") => void;
  selectedCustomer: Customer | null;
  selectedParts: Array<{
    partId: string;
    partName: string;
    quantity: number;
    sellingPrice: number;
    costPrice?: number;
    sku?: string;
    category?: string;
    warrantyPeriod?: string;
  }>;
  setSelectedParts: React.Dispatch<
    React.SetStateAction<
      Array<{
        partId: string;
        partName: string;
        quantity: number;
        sellingPrice: number;
        costPrice?: number;
        sku?: string;
        category?: string;
        warrantyPeriod?: string;
      }>
    >
  >;
  getPartLaborBase: (partId: string) => number;
  getPartWarranty: (partId: string) => string;
  getIntegratedLaborByQuantity: (laborBase: number, quantity: number) => number;
  formatNumberWithDots: (value: number | string) => string;
  parseFormattedNumber: (value: string) => number;
  formatCurrency: (value: number) => string;
  handleRemovePart: (partId: string) => void;
  handleUpdatePartQuantity: (partId: string, delta: number) => void;
  setShowPartSearch: (show: boolean) => void;
  setShowAddManualPart: (show: boolean) => void;
  additionalServices: Array<{
    id: string;
    name: string;
    quantity: number;
    costPrice: number;
    sellingPrice: number;
  }>;
  setAdditionalServices: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        name: string;
        quantity: number;
        costPrice: number;
        sellingPrice: number;
      }>
    >
  >;
  handleRemoveService: (id: string) => void;
  setShowAddService: (show: boolean) => void;
}

export const WorkOrderMobilePartsSection: React.FC<WorkOrderMobilePartsSectionProps> = ({
  selectedVehicle,
  setActiveSection,
  selectedCustomer,
  selectedParts,
  setSelectedParts,
  getPartLaborBase,
  getPartWarranty,
  getIntegratedLaborByQuantity,
  formatNumberWithDots,
  parseFormattedNumber,
  formatCurrency,
  handleRemovePart,
  handleUpdatePartQuantity,
  setShowPartSearch,
  setShowAddManualPart,
  additionalServices,
  setAdditionalServices,
  handleRemoveService,
  setShowAddService,
}) => {
  if (!selectedVehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
        <Bike className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm">
          Vui lòng chọn khách hàng và thiết bị ở tab <strong>Thông tin</strong> trước.
        </p>
        <button
          type="button"
          onClick={() => setActiveSection("info")}
          className="mt-4 text-blue-500 text-xs font-bold"
        >
          Quay lại chọn thiết bị
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      {selectedCustomer && selectedVehicle && (
        <div className="space-y-4">
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Linh kiện sử dụng
              </label>
              {selectedParts.length > 0 && (
                <span className="text-[10px] font-bold text-blue-400 bg-blue-400/10 px-2 py-0.5 rounded-full">
                  {selectedParts.length} món
                </span>
              )}
            </div>

            {/* Parts List */}
            {selectedParts.length > 0 && (
              <div className="space-y-2.5">
                {selectedParts.map((part, _index) => {
                  const laborBase = getPartLaborBase(part.partId);
                  const warrantyText = getPartWarranty(part.partId);
                  const lineLabor = getIntegratedLaborByQuantity(laborBase, Number(part.quantity || 0));
                  return (
                    <div
                      key={part.partId}
                      className="p-4 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {part.partName}
                          </div>
                          {part.sku && (
                            <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                              {part.sku}
                            </div>
                          )}
                          <div className="text-[10px] text-cyan-500 font-semibold mt-1">
                            Công: {formatCurrency(laborBase)} / món
                          </div>
                          <div className="text-[10px] text-cyan-400 mt-0.5">
                            Công theo SL: {formatCurrency(lineLabor)}
                          </div>
                          {warrantyText && (
                            <div className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                              Bảo hành: {warrantyText}
                            </div>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-[10px] text-slate-500">Giá:</span>
                            <input
                              type="text"
                              value={formatNumberWithDots(part.sellingPrice)}
                              onChange={(e) => {
                                const newPrice = parseFormattedNumber(e.target.value);
                                setSelectedParts(
                                  selectedParts.map((p) =>
                                    p.partId === part.partId ? { ...p, sellingPrice: newPrice } : p
                                  )
                                );
                              }}
                              inputMode="numeric"
                              className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-blue-600 dark:text-blue-400 text-xs font-bold focus:border-blue-500 focus:outline-none transition-all"
                            />
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-3">
                          <button
                            type="button"
                            onClick={() => handleRemovePart(part.partId)}
                            className="w-10 h-10 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-95 transition-all"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 border border-slate-200 dark:border-slate-700/50">
                            <button
                              type="button"
                              onClick={() => handleUpdatePartQuantity(part.partId, -1)}
                              className="w-9 h-9 flex items-center justify-center text-slate-400 active:bg-slate-200 dark:active:bg-slate-700 rounded-lg transition-all"
                            >
                              <Minus className="w-4 h-4" />
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-slate-900 dark:text-white">
                              {part.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleUpdatePartQuantity(part.partId, 1)}
                              className="w-9 h-9 flex items-center justify-center text-blue-400 active:bg-slate-700 rounded-lg transition-all"
                            >
                              <Plus className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-slate-700/30 flex justify-between items-center">
                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                          Thành tiền
                        </span>
                        <span className="text-sm font-bold text-emerald-400">
                          {formatCurrency(part.quantity * part.sellingPrice)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Add Part Buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setShowPartSearch(true)}
                className="py-3.5 bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 rounded-2xl text-blue-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Thêm linh kiện
              </button>

              <button
                type="button"
                onClick={() => setShowAddManualPart(true)}
                className="py-3.5 bg-purple-600/10 border border-purple-500/30 hover:bg-purple-600/20 rounded-2xl text-purple-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Linh kiện tự do
              </button>
            </div>
          </div>

          {/* 3B: DỊCH VỤ (GIA CÔNG) */}
          <div className="px-4 pb-4 space-y-3">
            <div className="flex items-center justify-between ml-1">
              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Dịch vụ bên ngoài
              </label>
              {additionalServices.length > 0 && (
                <span className="text-[10px] font-bold text-orange-400 bg-orange-400/10 px-2 py-0.5 rounded-full">
                  {additionalServices.length} mục
                </span>
              )}
            </div>

            {/* Services List */}
            {additionalServices.length > 0 && (
              <div className="space-y-2.5">
                {additionalServices.map((service) => (
                  <div
                    key={service.id}
                    className="p-4 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/30 rounded-2xl shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {service.name}
                        </div>
                        <div className="mt-2 flex flex-col gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 w-8">Bán:</span>
                            <input
                              type="text"
                              value={formatNumberWithDots(service.sellingPrice)}
                              onChange={(e) => {
                                const newPrice = parseFormattedNumber(e.target.value);
                                setAdditionalServices(
                                  additionalServices.map((s) =>
                                    s.id === service.id ? { ...s, sellingPrice: newPrice } : s
                                  )
                                );
                              }}
                              inputMode="numeric"
                              className="w-24 px-2 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-orange-600 dark:text-orange-400 text-xs font-bold focus:border-blue-500 focus:outline-none transition-all"
                            />
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(service.id)}
                        className="w-8 h-8 flex items-center justify-center text-slate-500 hover:text-red-400 active:scale-95 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/30 flex justify-between items-center">
                      <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider">
                        SL: {service.quantity} x {formatCurrency(service.sellingPrice)}
                      </span>
                      <span className="text-sm font-bold text-orange-400">
                        {formatCurrency(service.sellingPrice * service.quantity)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Service Button */}
            <button
              type="button"
              onClick={() => setShowAddService(true)}
              className="w-full py-3.5 bg-orange-600/10 border border-orange-500/30 hover:bg-orange-600/20 rounded-2xl text-orange-400 transition-all flex items-center justify-center gap-2 text-xs font-bold active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Thêm dịch vụ bên ngoài
            </button>
          </div>
          <button
            type="button"
            onClick={() => setActiveSection("payment")}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20"
          >
            Tiếp tục: Thanh toán <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
};
