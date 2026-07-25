import React, { useState } from "react";
import { X, HandCoins, Calendar, CreditCard, Banknote } from "lucide-react";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import { formatCurrency } from "../../../utils/format";
import { showToast } from "../../../utils/toast";
import { useAppContext } from "../../../contexts/AppContext";
import { useAuth } from "../../../contexts/AuthContext";
import { useCreateCashTxRepo } from "../../../hooks/useCashTransactionsRepository";
import {
  useUpdateCustomerDebtRepo,
  useUpdateSupplierDebtRepo,
} from "../../../hooks/useDebtsRepository";
import type { CustomerDebt, SupplierDebt } from "../../../types";

interface Props {
  debt: CustomerDebt | SupplierDebt;
  type: "customer" | "supplier";
  onClose: () => void;
  onSuccess?: () => void;
}

export const CollectDebtModal: React.FC<Props> = ({
  debt,
  type,
  onClose,
  onSuccess,
}) => {
  const { currentBranchId } = useAppContext();
  const { user } = useAuth();
  const { mutateAsync: createCashTx, isPending: isCreatingCash } =
    useCreateCashTxRepo();
  const { mutateAsync: updateCustomerDebt, isPending: isUpdatingCustomer } =
    useUpdateCustomerDebtRepo();
  const { mutateAsync: updateSupplierDebt, isPending: isUpdatingSupplier } =
    useUpdateSupplierDebtRepo();

  const isPending = isCreatingCash || isUpdatingCustomer || isUpdatingSupplier;

  const initialPayAmount = debt.remainingAmount || 0;
  const [payAmount, setPayAmount] = useState<number>(initialPayAmount);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [dueDate, setDueDate] = useState<string>(
    debt.dueDate ? debt.dueDate.slice(0, 10) : ""
  );
  const [notes, setNotes] = useState<string>("");

  const targetName =
    type === "customer"
      ? (debt as CustomerDebt).customerName
      : (debt as SupplierDebt).supplierName;

  const remainingAfterPay = Math.max(0, debt.remainingAmount - payAmount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (payAmount <= 0) {
      showToast.error("Vui lòng nhập số tiền thu/trả lớn hơn 0 đ!");
      return;
    }
    if (payAmount > debt.remainingAmount) {
      showToast.error(
        `Số tiền không thể lớn hơn số tiền còn nợ (${formatCurrency(
          debt.remainingAmount
        )})`
      );
      return;
    }

    try {
      const now = new Date().toISOString();
      const staffName =
        (user as any)?.user_metadata?.name ||
        (user as any)?.name ||
        user?.email ||
        "Nhân viên";

      const newPaid = debt.paidAmount + payAmount;
      const newRemaining = debt.totalAmount - newPaid;

      const historyEntry = {
        date: now,
        amount: payAmount,
        method: paymentMethod,
        note: notes.trim() || undefined,
        staffName,
      };

      const updatedHistory = [
        ...(debt.paymentHistory || []),
        historyEntry,
      ];

      if (type === "customer") {
        await updateCustomerDebt({
          id: debt.id,
          updates: {
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            dueDate: newRemaining > 0 ? dueDate || debt.dueDate : undefined,
            paymentHistory: updatedHistory,
          },
        });
      } else {
        await updateSupplierDebt({
          id: debt.id,
          updates: {
            paidAmount: newPaid,
            remainingAmount: newRemaining,
            dueDate: newRemaining > 0 ? dueDate || debt.dueDate : undefined,
            paymentHistory: updatedHistory,
          },
        });
      }

      // Record in Cash Book (Sổ quỹ)
      await createCashTx({
        type: type === "customer" ? "income" : "expense",
        amount: payAmount,
        notes: `${type === "customer" ? "Thu nợ từ" : "Trả nợ cho"} ${targetName}: ${
          debt.description
        }`,
        recipient: targetName,
        paymentSourceId: paymentMethod,
        branchId: currentBranchId,
        category: type === "customer" ? "debt_collection" : "debt_payment",
        date: now,
      });

      showToast.success(
        `Đã ghi nhận ${
          type === "customer" ? "thu" : "trả"
        } ${formatCurrency(payAmount)} thành công!`
      );
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Lỗi khi thu/trả nợ:", err);
      showToast.error("Không thể ghi nhận thanh toán: " + (err.message || "Lỗi server"));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl text-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <HandCoins className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white">
                {type === "customer" ? "Thu nợ khách hàng" : "Trả nợ nhà cung cấp"}
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

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Card thông tin khoản nợ */}
          <div className="p-3.5 rounded-xl bg-slate-800/80 border border-slate-700/60 space-y-2 text-xs">
            <div className="flex justify-between text-slate-400">
              <span>Nội dung:</span>
              <span className="font-semibold text-white text-right max-w-[200px] truncate">
                {debt.description}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Tổng số tiền nợ:</span>
              <span className="font-bold text-slate-200">
                {formatCurrency(debt.totalAmount)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span>Đã thanh toán:</span>
              <span className="font-bold text-emerald-400">
                {formatCurrency(debt.paidAmount)}
              </span>
            </div>
            <div className="flex justify-between text-slate-400 border-t border-slate-700/60 pt-2 font-bold text-sm">
              <span className="text-slate-300">Còn nợ hiện tại:</span>
              <span className="text-red-400">
                {formatCurrency(debt.remainingAmount)}
              </span>
            </div>
          </div>

          {/* Ô nhập số tiền thu/trả đợt này */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Số tiền {type === "customer" ? "thu đợt này" : "trả đợt này"} (đ)
            </label>
            <FormattedNumberInput
              value={payAmount}
              onValue={(val) => setPayAmount(Math.max(0, Math.round(val)))}
              className="w-full h-11 px-3 bg-slate-800 border border-slate-700 rounded-xl text-right font-bold text-emerald-400 text-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
            />
            {/* Phím gõ nhanh số tiền */}
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              <button
                type="button"
                onClick={() => setPayAmount(debt.remainingAmount)}
                className="px-2 py-1 text-[11px] rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 font-bold transition-colors"
              >
                Trả hết ({formatCurrency(debt.remainingAmount)})
              </button>
              {[
                { label: "100k", val: 100000 },
                { label: "200k", val: 200000 },
                { label: "500k", val: 500000 },
                { label: "1 triệu", val: 1000000 },
                { label: "2 triệu", val: 2000000 },
              ].map((btn) => (
                <button
                  key={btn.val}
                  type="button"
                  onClick={() => setPayAmount(Math.min(debt.remainingAmount, btn.val))}
                  className="px-2 py-1 text-[11px] rounded-lg bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 font-semibold transition-colors"
                >
                  {btn.label}
                </button>
              ))}
            </div>
          </div>

          {/* Hình thức thanh toán */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Hình thức thanh toán
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod("cash")}
                className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  paymentMethod === "cash"
                    ? "bg-emerald-600 border-emerald-500 text-white shadow-lg shadow-emerald-900/30"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <Banknote className="w-4 h-4" /> Tiền mặt
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("bank")}
                className={`h-10 px-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                  paymentMethod === "bank"
                    ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/30"
                    : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                }`}
              >
                <CreditCard className="w-4 h-4" /> Chuyển khoản
              </button>
            </div>
          </div>

          {/* Hiển thị số tiền còn nợ lại & Ngày hẹn trả cụ thể để nhắc nhở */}
          {remainingAfterPay > 0 && (
            <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-2.5">
              <div className="flex justify-between text-xs font-bold text-amber-300">
                <span>Còn nợ lại sau đợt này:</span>
                <span className="text-sm font-black text-amber-400">
                  {formatCurrency(remainingAfterPay)}
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-amber-200 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-amber-400" /> Ngày hẹn trả phần còn lại (Để nhắc nhở)
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="w-full h-10 px-3 bg-slate-900 border border-amber-500/40 rounded-xl text-xs font-bold text-amber-200 focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
                />

                {/* Phím chọn nhanh ngày hẹn */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-amber-300/70">Hẹn nhanh:</span>
                  {[
                    { label: "+3 ngày", days: 3 },
                    { label: "+7 ngày", days: 7 },
                    { label: "+15 ngày", days: 15 },
                    { label: "+30 ngày", days: 30 },
                  ].map((preset) => (
                    <button
                      key={preset.days}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        d.setDate(d.getDate() + preset.days);
                        setDueDate(d.toISOString().slice(0, 10));
                      }}
                      className="px-2 py-1 text-[11px] rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 font-semibold transition-colors"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Ghi chú */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Ghi chú
            </label>
            <input
              type="text"
              placeholder="VD: Trả trước một phần, hẹn tuần sau trả hết..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full h-9 px-3 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white focus:border-emerald-500"
            />
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
              className="px-5 h-10 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition-all shadow-lg shadow-emerald-900/40 disabled:opacity-50"
            >
              {isPending ? "Đang xử lý..." : "Xác nhận thu nợ"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CollectDebtModal;
