import React from "react";
import { Bike, TrendingUp, CheckCircle } from "lucide-react";
import type { Vehicle, WorkOrder } from "../../../types";
import { type WorkOrderStatus } from "../../../constants";

interface WorkOrderMobilePaymentSectionProps {
  selectedVehicle: Vehicle | null;
  setActiveSection: (section: "info" | "issue" | "parts" | "payment") => void;
  status: WorkOrderStatus;
  workOrder: WorkOrder | null | undefined;
  isDeposit: boolean;
  setIsDeposit: (isDeposit: boolean) => void;
  depositAmount: number;
  setDepositAmount: (depositAmount: number) => void;
  paymentMethod: "cash" | "bank";
  setPaymentMethod: (paymentMethod: "cash" | "bank") => void;
  showPaymentInput: boolean;
  setShowPaymentInput: (show: boolean) => void;
  partialAmount: number;
  setPartialAmount: (amount: number) => void;
  includeIntegratedLabor: boolean;
  setIncludeIntegratedLabor: (include: boolean) => void;
  discount: number;
  setDiscount: (discount: number) => void;
  discountType: "amount" | "percent";
  setDiscountType: (type: "amount" | "percent") => void;
  partsTotal: number;
  servicesTotal: number;
  effectiveLaborCost: number;
  total: number;
  remainingPreview: number;
  additionalPaymentPreview: number;
  discountAmount: number;
  formatNumberWithDots: (value: number | string) => string;
  parseFormattedNumber: (value: string) => number;
  formatCurrency: (value: number) => string;
}

export const WorkOrderMobilePaymentSection: React.FC<WorkOrderMobilePaymentSectionProps> = ({
  selectedVehicle,
  setActiveSection,
  status,
  workOrder,
  isDeposit,
  setIsDeposit,
  depositAmount,
  setDepositAmount,
  paymentMethod,
  setPaymentMethod,
  showPaymentInput,
  setShowPaymentInput,
  partialAmount,
  setPartialAmount,
  includeIntegratedLabor,
  setIncludeIntegratedLabor,
  discount,
  setDiscount,
  discountType,
  setDiscountType,
  partsTotal,
  servicesTotal,
  effectiveLaborCost,
  total,
  remainingPreview,
  additionalPaymentPreview,
  discountAmount,
  formatNumberWithDots,
  parseFormattedNumber,
  formatCurrency,
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
      <div className="space-y-4">
        <div className="px-3 pb-3 space-y-2.5">
          <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            THANH TOÁN
          </h3>

          <div className="p-4 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-700/30 space-y-2">
            {/* Deposit Toggle */}
            <div className="pt-2">
              <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-[#2b2b40] rounded-xl">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-500/20 flex items-center justify-center">
                    <span className="text-lg">💳</span>
                  </div>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    Đặt cọc trước
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsDeposit(!isDeposit)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    isDeposit ? "bg-[#009ef7]" : "bg-slate-600"
                  }`}
                >
                  <div
                    className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                      isDeposit ? "right-0.5" : "left-0.5"
                    }`}
                  >
                    {isDeposit && (
                      <span className="absolute inset-0 flex items-center justify-center text-[#009ef7] text-[10px] font-bold">
                        ON
                      </span>
                    )}
                  </div>
                </button>
              </div>

              {isDeposit && (
                <div className="mt-3 p-3 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700/50 rounded-xl">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">💵</span>
                    <span className="text-slate-500 dark:text-slate-400 text-xs">
                      Nhập số tiền cọc...
                    </span>
                  </div>
                  <input
                    type="text"
                    value={formatNumberWithDots(depositAmount)}
                    onChange={(e) =>
                      setDepositAmount(parseFormattedNumber(e.target.value))
                    }
                    placeholder="0"
                    inputMode="numeric"
                    className="w-full px-3 py-2.5 bg-white dark:bg-[#2b2b40] border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-sm focus:border-[#009ef7] focus:outline-none transition-colors"
                  />
                </div>
              )}
            </div>

            {/* Payment Method */}
            <div className="pt-2">
              <label className="block text-xs font-medium text-slate-400 mb-2">
                Phương thức thanh toán
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPaymentMethod("cash")}
                  className={`relative p-3 rounded-xl transition-all border-2 ${
                    paymentMethod === "cash"
                      ? "bg-emerald-500/10 border-emerald-500 shadow-lg shadow-emerald-500/20"
                      : "bg-slate-100 dark:bg-[#2b2b40] border-transparent hover:border-slate-400 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`text-xl ${
                        paymentMethod === "cash" ? "scale-110" : ""
                      } transition-transform`}
                    >
                      💵
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        paymentMethod === "cash"
                          ? "text-emerald-500 dark:text-emerald-400"
                          : "text-slate-400"
                      }`}
                    >
                      Tiền mặt
                    </span>
                  </div>
                  {paymentMethod === "cash" && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("bank")}
                  className={`relative p-3 rounded-xl transition-all border-2 ${
                    paymentMethod === "bank"
                      ? "bg-blue-500/10 border-blue-500 shadow-lg shadow-blue-500/20"
                      : "bg-slate-100 dark:bg-[#2b2b40] border-transparent hover:border-slate-400 dark:hover:border-slate-600"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className={`text-xl ${
                        paymentMethod === "bank" ? "scale-110" : ""
                      } transition-transform`}
                    >
                      🏦
                    </div>
                    <span
                      className={`text-xs font-medium ${
                        paymentMethod === "bank"
                          ? "text-blue-500 dark:text-blue-400"
                          : "text-slate-400"
                      }`}
                    >
                      Chuyển khoản
                    </span>
                  </div>
                  {paymentMethod === "bank" && (
                    <div className="absolute top-1 right-1 w-4 h-4 bg-blue-500 rounded-full flex items-center justify-center">
                      <svg
                        className="w-2.5 h-2.5 text-white"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={3}
                          d="M5 13l4 4L19 7"
                        />
                      </svg>
                    </div>
                  )}
                </button>
              </div>

              {/* Payment at return - only show when EDITING existing order with status "Trả máy" */}
              {status === "Trả máy" && workOrder && (
                <div className="mt-3">
                  {/* Checkbox to enable payment */}
                  <div className="flex items-center justify-between p-3 bg-slate-100 dark:bg-[#2b2b40] rounded-xl">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <span className="text-lg">✅</span>
                      </div>
                      <span className="text-slate-900 dark:text-white font-medium text-sm">
                        Thanh toán khi trả thiết bị
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        const newValue = !showPaymentInput;
                        setShowPaymentInput(newValue);
                        if (!newValue) {
                          setPartialAmount(0);
                        } else {
                          const fullAmount = Math.max(
                            0,
                            total - (isDeposit ? depositAmount : 0)
                          );
                          setPartialAmount(fullAmount);
                        }
                      }}
                      className={`relative w-12 h-6 rounded-full transition-colors ${
                        showPaymentInput ? "bg-emerald-500" : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                          showPaymentInput ? "right-0.5" : "left-0.5"
                        }`}
                      >
                        {showPaymentInput && (
                          <span className="absolute inset-0 flex items-center justify-center text-emerald-500 text-[10px] font-bold">
                            ON
                          </span>
                        )}
                      </div>
                    </button>
                  </div>

                  {/* Payment Input - show when checkbox is enabled */}
                  {showPaymentInput && (
                    <div className="mt-3 p-3 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700/50 rounded-xl">
                      <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">
                        Số tiền thanh toán thêm:
                      </label>
                      <input
                        type="text"
                        value={formatNumberWithDots(partialAmount)}
                        onChange={(e) =>
                          setPartialAmount(parseFormattedNumber(e.target.value))
                        }
                        placeholder="0"
                        inputMode="numeric"
                        className="w-full px-3 py-2.5 bg-white dark:bg-[#2b2b40] border border-slate-300 dark:border-slate-600 rounded-xl text-slate-900 dark:text-white text-sm focus:border-emerald-500 focus:outline-none transition-colors mb-2"
                      />
                      {showPaymentInput &&
                        partialAmount >
                          Math.max(0, total - (isDeposit ? depositAmount : 0)) && (
                          <div className="text-xs font-bold text-emerald-500 mt-1 mb-2">
                            Tiền thừa trả khách:{" "}
                            {formatCurrency(
                              partialAmount -
                                Math.max(
                                  0,
                                  total - (isDeposit ? depositAmount : 0)
                                )
                            )}
                          </div>
                        )}
                      {/* Quick amount buttons */}
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setPartialAmount(0)}
                          className="flex-1 px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          0%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const remainingToPay =
                              total - (isDeposit ? depositAmount : 0);
                            setPartialAmount(Math.round(remainingToPay * 0.5));
                          }}
                          className="flex-1 px-3 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const remainingToPay =
                              total - (isDeposit ? depositAmount : 0);
                            setPartialAmount(remainingToPay);
                          }}
                          className="flex-1 px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-medium transition-colors"
                        >
                          100%
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Info Note */}
              {!workOrder && (
                <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-start gap-2">
                  <div className="flex-shrink-0 w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center mt-0.5">
                    <span className="text-blue-400 text-xs">ℹ️</span>
                  </div>
                  <p className="text-blue-300 text-xs leading-relaxed">
                    <span className="font-semibold">Lưu ý:</span> Khi tạo phiếu mới,
                    chọn trạng thái "Tiếp nhận" hoặc "Đang sửa". Thanh toán khi trả
                    thiết bị chỉ khả dụng khi chỉnh sửa phiếu đã có sẵn.
                  </p>
                </div>
              )}
            </div>

            {/* Summary Section - Premium Redesign */}
            <div className="mt-6 p-4 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-700/30 space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Tổng kết chi phí
                </h3>
              </div>

              <div className="space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Tiền linh kiện:
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatCurrency(partsTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Gia công/Đặt hàng:
                  </span>
                  <span className="text-xs font-bold text-slate-900 dark:text-white">
                    {formatCurrency(servicesTotal)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-cyan-600 dark:text-cyan-400 font-bold">
                    Tiền công tích hợp:
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      includeIntegratedLabor
                        ? "text-cyan-600 dark:text-cyan-400"
                        : "text-slate-400 dark:text-slate-500"
                    }`}
                  >
                    {formatCurrency(effectiveLaborCost)}
                  </span>
                </div>
                <label className="flex items-center justify-between gap-2 cursor-pointer">
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Không tính tiền công (khách mang về)
                  </span>
                  <input
                    type="checkbox"
                    checked={!includeIntegratedLabor}
                    onChange={(e) => setIncludeIntegratedLabor(!e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 bg-transparent"
                  />
                </label>

                {/* Discount Row */}
                <div className="pt-2.5 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-red-500 dark:text-red-400 font-bold">
                      Giảm giá:
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-[#2b2b40] p-1 rounded-xl border border-slate-200 dark:border-slate-700/50">
                    <input
                      type="text"
                      value={formatNumberWithDots(discount)}
                      onChange={(e) =>
                        setDiscount(parseFormattedNumber(e.target.value))
                      }
                      placeholder="0"
                      className="w-16 bg-transparent text-slate-900 dark:text-white text-xs font-bold text-right focus:outline-none px-1"
                    />
                    <div className="flex bg-white dark:bg-slate-800 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setDiscountType("amount")}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                          discountType === "amount"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        ₫
                      </button>
                      <button
                        type="button"
                        onClick={() => setDiscountType("percent")}
                        className={`px-2 py-1 rounded-md text-[10px] font-bold transition-all ${
                          discountType === "percent"
                            ? "bg-blue-600 text-white shadow-sm"
                            : "text-slate-400 dark:text-slate-500"
                        }`}
                      >
                        %
                      </button>
                    </div>
                  </div>
                </div>

                {/* Quick percent buttons - only show in percent mode */}
                {discountType === "percent" && (
                  <div className="flex gap-1.5 justify-end">
                    {[5, 10, 15, 20].map((percent) => (
                      <button
                        type="button"
                        key={percent}
                        onClick={() => setDiscount(percent)}
                        className="px-2.5 py-1 text-[10px] bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors font-bold"
                      >
                        {percent}%
                      </button>
                    ))}
                  </div>
                )}

                {/* Show discount amount if in percent mode */}
                {discountType === "percent" && discount > 0 && (
                  <div className="text-[10px] text-slate-500 text-right font-mono">
                    = -{formatCurrency(discountAmount)}
                  </div>
                )}
              </div>

              {/* Total Section */}
              <div className="pt-4 border-t-2 border-slate-200 dark:border-slate-700/50">
                <div className="flex justify-between items-end mb-4">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                      Tổng thanh toán
                    </span>
                    <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                      {formatCurrency(total)}
                    </span>
                  </div>
                  {remainingPreview <= 0 && (
                    <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/30 rounded-full flex items-center gap-1.5 mb-1">
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-[10px] font-bold text-emerald-400 uppercase">
                        Đã trả đủ
                      </span>
                    </div>
                  )}
                </div>

                {/* Payment breakdown */}
                {((isDeposit && depositAmount > 0) ||
                  additionalPaymentPreview > 0) && (
                  <div className="p-3 bg-slate-50 dark:bg-[#151521] rounded-xl border border-slate-200 dark:border-slate-700/50 space-y-2">
                    {isDeposit && depositAmount > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-purple-400 uppercase">
                          Đã đặt cọc
                        </span>
                        <span className="text-xs font-bold text-purple-400">
                          -{formatCurrency(depositAmount)}
                        </span>
                      </div>
                    )}
                    {additionalPaymentPreview > 0 && (
                      <div className="flex justify-between items-center">
                        <span className="text-[10px] font-bold text-blue-400 uppercase">
                          Thanh toán thêm
                        </span>
                        <span className="text-xs font-bold text-blue-400">
                          -{formatCurrency(additionalPaymentPreview)}
                        </span>
                      </div>
                    )}

                    <div className="pt-2 border-t border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">
                        Còn lại:
                      </span>
                      <span
                        className={`text-lg font-black ${
                          remainingPreview > 0
                            ? "text-amber-500 dark:text-amber-400"
                            : "text-emerald-500 dark:text-emerald-400"
                        }`}
                      >
                        {formatCurrency(remainingPreview)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
