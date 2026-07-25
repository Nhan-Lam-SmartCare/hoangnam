import React from "react";
import { X, History, Banknote, CreditCard } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import type { CustomerDebt, SupplierDebt } from "../../../types";

interface Props {
  debt: CustomerDebt | SupplierDebt;
  type: "customer" | "supplier";
  onClose: () => void;
}

export const DebtHistoryModal: React.FC<Props> = ({ debt, type, onClose }) => {
  const history = debt.paymentHistory || [];
  const targetName =
    type === "customer"
      ? (debt as CustomerDebt).customerName
      : (debt as SupplierDebt).supplierName;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
              <History className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                Lịch sử thanh toán
              </h3>
              <p className="text-xs text-slate-400 font-medium">{targetName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Summary stats */}
          <div className="grid grid-cols-3 gap-2 p-3 rounded-xl bg-slate-800/80 border border-slate-700/60 text-center text-xs">
            <div>
              <span className="text-slate-400 block text-[11px]">Tổng nợ:</span>
              <span className="font-bold text-white">
                {formatCurrency(debt.totalAmount)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Đã trả:</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(debt.paidAmount)}
              </span>
            </div>
            <div>
              <span className="text-slate-400 block text-[11px]">Còn nợ:</span>
              <span className="font-bold text-red-400">
                {formatCurrency(debt.remainingAmount)}
              </span>
            </div>
          </div>

          {/* Timeline list */}
          {history.length === 0 ? (
            <div className="py-8 text-center text-slate-500 text-xs">
              Chưa có đợt thanh toán nào được ghi nhận.
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item, index) => (
                <div
                  key={index}
                  className="p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 flex items-start justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-emerald-400 text-sm">
                      {item.method === "bank" ? (
                        <CreditCard className="w-4 h-4 text-blue-400" />
                      ) : (
                        <Banknote className="w-4 h-4 text-emerald-400" />
                      )}
                      +{formatCurrency(item.amount)}
                    </div>
                    <div className="text-slate-400 text-[11px]">
                      {new Date(item.date).toLocaleString("vi-VN")}
                      {item.staffName && ` · NV: ${item.staffName}`}
                    </div>
                    {item.note && (
                      <div className="text-slate-300 italic text-[11px] bg-slate-900/40 px-2 py-0.5 rounded border border-slate-700/40 inline-block">
                        "{item.note}"
                      </div>
                    )}
                  </div>
                  <span
                    className={`px-2 py-0.5 text-[10px] font-bold rounded-md uppercase border ${
                      item.method === "bank"
                        ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                        : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                    }`}
                  >
                    {item.method === "bank" ? "Chuyển khoản" : "Tiền mặt"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 flex justify-end bg-slate-800/30">
          <button
            onClick={onClose}
            className="px-4 h-9 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs transition-colors"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};

export default DebtHistoryModal;
