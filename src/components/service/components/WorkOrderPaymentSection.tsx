import React from "react";
import type { WorkOrder } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";

interface WorkOrderPaymentSectionProps {
  formData: Partial<WorkOrder>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<WorkOrder>>>;
  showDepositInput: boolean;
  setShowDepositInput: (show: boolean) => void;
  depositAmount: number;
  setDepositAmount: (val: number) => void;
  order: WorkOrder;
  showPartialPayment: boolean;
  setShowPartialPayment: (show: boolean) => void;
  partialPayment: number;
  setPartialPayment: (val: number) => void;
  remainingAmount: number;
  partsTotal: number;
  servicesTotal: number;
  effectiveLaborCost: number;
  includeIntegratedLabor: boolean;
  setIncludeIntegratedLabor: (val: boolean) => void;
  discountType: "amount" | "percent";
  setDiscountType: (type: "amount" | "percent") => void;
  discountPercent: number;
  setDiscountPercent: (val: number) => void;
  subtotal: number;
  total: number;
  totalDeposit: number;
  totalAdditionalPayment: number;
  handleSaveOnly: () => Promise<void>;
  handleSave: () => Promise<void>;
  handlePayFull: () => Promise<void>;
  onClose: () => void;
}

export const WorkOrderPaymentSection: React.FC<WorkOrderPaymentSectionProps> = ({
  formData,
  setFormData,
  showDepositInput,
  setShowDepositInput,
  depositAmount,
  setDepositAmount,
  order,
  showPartialPayment,
  setShowPartialPayment,
  partialPayment,
  setPartialPayment,
  remainingAmount,
  partsTotal,
  servicesTotal,
  effectiveLaborCost,
  includeIntegratedLabor,
  setIncludeIntegratedLabor,
  discountType,
  setDiscountType,
  discountPercent,
  setDiscountPercent,
  subtotal,
  total,
  totalDeposit,
  totalAdditionalPayment,
  handleSaveOnly,
  handleSave,
  handlePayFull,
  onClose,
}) => {
  return (
    <div className="border-t border-slate-200 dark:border-slate-700 pt-0 mt-0 border-t-0 col-start-2 row-start-1 row-span-3 sticky top-0 space-y-4">
      <div className="grid gap-4 grid-cols-1">
        {/* Left: Payment Options */}
        <div className="space-y-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-4 order-2">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
            Thanh toán
          </h3>

          <div className="space-y-3">
            {/* Deposit checkbox */}
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={showDepositInput}
                onChange={(e) => {
                  setShowDepositInput(e.target.checked);
                  if (!e.target.checked) setDepositAmount(0);
                }}
                disabled={!!order?.depositAmount} // Disable if already deposited
                className="w-4 h-4"
              />
              <span className="text-sm text-slate-700 dark:text-slate-300">
                Đặt cọc{" "}
                {order?.depositAmount
                  ? `(Đã cọc: ${formatCurrency(order.depositAmount)})`
                  : ""}
              </span>
            </label>

            {/* Deposit input - only show when checkbox is checked and not already deposited */}
            {showDepositInput && !order?.depositAmount && (
              <div className="pl-6">
                <NumberInput
                  placeholder="Số tiền đặt cọc"
                  value={depositAmount || ""}
                  onChange={(val) => setDepositAmount(val)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            )}

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

            {/* Payment method selection */}
            <div>
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2 block">
                Phương thức thanh toán:
              </label>
              <div className="flex items-center gap-4 pl-2">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="cash"
                    checked={formData.paymentMethod === "cash"}
                    onChange={(_e) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: "cash" }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                    >
                      <rect
                        x="2"
                        y="6"
                        width="20"
                        height="12"
                        rx="2"
                        ry="2"
                      />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    Tiền mặt
                  </span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="paymentMethod"
                    value="bank"
                    checked={formData.paymentMethod === "bank"}
                    onChange={(_e) =>
                      setFormData((prev) => ({ ...prev, paymentMethod: "bank" }))
                    }
                    className="w-4 h-4"
                  />
                  <span className="inline-flex items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-4 h-4"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3 21h18M3 10h18M7 6h10l2 4H5l2-4Zm2 4v11m6-11v11"
                      />
                    </svg>
                    Chuyển khoản
                  </span>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-200 dark:border-slate-700 pt-3"></div>

            {/* Partial payment checkbox - only show if status is "Trả máy" */}
            {formData.status === "Trả máy" && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={showPartialPayment}
                    onChange={(e) => {
                      setShowPartialPayment(e.target.checked);
                      if (e.target.checked) {
                        setPartialPayment(Math.max(0, remainingAmount));
                      } else {
                        setPartialPayment(0);
                      }
                    }}
                    className="w-4 h-4"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">
                    Thanh toán khi trả xe
                  </span>
                </label>

                {/* Partial Payment Input - only show when checkbox is checked */}
                {showPartialPayment && (
                  <div className="pl-6 space-y-2">
                    <label className="text-xs text-slate-600 dark:text-slate-400">
                      Số tiền thanh toán thêm:
                    </label>
                    <div className="space-y-2">
                      <NumberInput
                        placeholder="0"
                        value={partialPayment || ""}
                        onChange={(val) => setPartialPayment(val)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right font-semibold"
                      />
                      {showPartialPayment && partialPayment > Math.max(0, total - totalDeposit) && (
                        <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                          Tiền thừa trả khách: {formatCurrency(partialPayment - Math.max(0, total - totalDeposit))}
                        </div>
                      )}
                      <div className="grid grid-cols-3 gap-1.5 w-full">
                        <button
                          onClick={() => setPartialPayment(0)}
                          className="px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                        >
                          0%
                        </button>
                        <button
                          onClick={() =>
                            setPartialPayment(
                              Math.round(remainingAmount * 0.5)
                            )
                          }
                          className="px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                        >
                          50%
                        </button>
                        <button
                          onClick={() => setPartialPayment(remainingAmount)}
                          className="px-2 py-1.5 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-200 rounded text-xs font-medium"
                        >
                          100%
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {formData.status !== "Trả máy" && (
            <p className="text-xs text-slate-500 dark:text-slate-400 italic">
              * Thanh toán khi trả xe chỉ khả dụng khi trạng thái là "Trả máy"
            </p>
          )}
        </div>

        {/* Right: Summary */}
        <div className="space-y-3 bg-slate-50 dark:bg-slate-700/30 border border-slate-200 dark:border-slate-700 rounded-lg p-4 order-1">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
            Tổng kết
          </h3>

          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Tiền phụ tùng:
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(partsTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-600 dark:text-slate-400">
              Gia công/Đặt hàng:
            </span>
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {formatCurrency(servicesTotal)}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-cyan-600 dark:text-cyan-400">
              Tiền công tích hợp:
            </span>
            <span
              className={`font-medium ${
                includeIntegratedLabor
                  ? "text-cyan-600 dark:text-cyan-400"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {formatCurrency(effectiveLaborCost)}
            </span>
          </div>
          <label className="flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-400">
            <span>Không tính tiền công (khách mang về)</span>
            <input
              type="checkbox"
              checked={!includeIntegratedLabor}
              onChange={(e) => setIncludeIntegratedLabor(!e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
          </label>

          <div className="pt-2 border-t border-slate-300 dark:border-slate-600">
            <div className="flex justify-between items-center text-sm">
              <span className="text-red-600 font-medium">Giảm giá:</span>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="0"
                  value={
                    discountType === "amount"
                      ? formData.discount || ""
                      : discountPercent
                  }
                  onChange={(e) => {
                    const value = Number(e.target.value) || 0;
                    if (discountType === "amount") {
                      const maxDiscount = subtotal;
                      setFormData((prev) => ({
                        ...prev,
                        discount: Math.min(value, maxDiscount),
                      }));
                    } else {
                      const percent = Math.min(value, 100);
                      setDiscountPercent(percent);
                      setFormData((prev) => ({
                        ...prev,
                        discount: Math.round((subtotal * percent) / 100),
                      }));
                    }
                  }}
                  className="w-20 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                  min="0"
                  max={discountType === "amount" ? subtotal : 100}
                />
                <select
                  value={discountType}
                  onChange={(e) => {
                    const newType = e.target.value as "amount" | "percent";
                    setDiscountType(newType);
                    setFormData((prev) => ({
                      ...prev,
                      discount: 0,
                    }));
                    setDiscountPercent(0);
                  }}
                  className="px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                >
                  <option value="amount">đ</option>
                  <option value="percent">%</option>
                </select>
              </div>
            </div>

            {/* Quick percent buttons */}
            {discountType === "percent" && (
              <div className="flex gap-1 justify-end mt-2">
                {[5, 10, 15, 20].map((percent) => (
                  <button
                    key={percent}
                    onClick={() => {
                      setDiscountPercent(percent);
                      setFormData((prev) => ({
                        ...prev,
                        discount: Math.round((subtotal * percent) / 100),
                      }));
                    }}
                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-slate-700 hover:bg-blue-100 dark:hover:bg-blue-900/30 text-slate-700 dark:text-slate-300 rounded transition-colors"
                  >
                    {percent}%
                  </button>
                ))}
              </div>
            )}

            {/* Show amount if percent mode */}
            {discountType === "percent" && discountPercent > 0 && (
              <div className="text-xs text-slate-500 dark:text-slate-400 text-right mt-1">
                = {formatCurrency(formData.discount || 0)}
              </div>
            )}
          </div>

          <div className="pt-2 border-t-2 border-slate-400 dark:border-slate-500">
            <div className="flex justify-between items-center mb-2">
              <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                Tổng cộng:
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                {formatCurrency(total)}
              </span>
            </div>

            {/* Show payment breakdown if there's deposit or partial payment */}
            {(totalDeposit > 0 || totalAdditionalPayment > 0) && (
              <div className="space-y-1 pt-2 border-t border-slate-300 dark:border-slate-600">
                {totalDeposit > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      Đã đặt cọc:
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(totalDeposit)}
                    </span>
                  </div>
                )}
                {totalAdditionalPayment > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-green-600 dark:text-green-400">
                      Thanh toán thêm:
                    </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      -{formatCurrency(totalAdditionalPayment)}
                    </span>
                  </div>
                )}
                <div className="flex justify-between items-center pt-2 border-t border-slate-300 dark:border-slate-600">
                  <span className="text-base font-bold text-slate-900 dark:text-slate-100">
                    {remainingAmount > 0 ? "Còn phải thu:" : "Đã thanh toán đủ"}
                  </span>
                  <span
                    className={`text-lg font-bold ${
                      remainingAmount > 0
                        ? "text-red-600 dark:text-red-400"
                        : "text-green-600 dark:text-green-400"
                    }`}
                  >
                    {formatCurrency(remainingAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3">
          <button
            onClick={handleSaveOnly}
            className="w-full px-4 py-2 bg-slate-500 hover:bg-slate-600 text-white rounded-lg font-medium"
          >
            Lưu Phiếu
          </button>

          {formData.status !== "Trả máy" && showDepositInput && (
            <button
              onClick={() => handleSave()}
              className="w-full px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg font-medium"
            >
              Đặt cọc
            </button>
          )}

          {formData.status === "Trả máy" && (
            <button
              onClick={handlePayFull}
              className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium"
            >
              Thanh toán
            </button>
          )}

          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-lg"
          >
            Hủy
          </button>
        </div>
      </div>
    </div>
  );
};
