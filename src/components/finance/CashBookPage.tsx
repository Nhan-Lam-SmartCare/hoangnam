import React, { useEffect, useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import {
  useCashTxRepo,
  useCreateCashTxRepo,
} from "../../hooks/useCashTransactionsRepository";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatCashTxCategory } from "../../lib/finance/cashTxCategories";

const CashBookPage: React.FC = () => {
  const { currentBranchId, paymentSources } = useAppContext();
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<string>("other_income");
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formRecipient, setFormRecipient] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formPaymentSourceId, setFormPaymentSourceId] = useState<string>("cash");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const createCashTxMutation = useCreateCashTxRepo();

  const incomeCategoryOptions = useMemo(
    () => [
      { value: "sale_income", label: "Bán hàng" },
      { value: "service_income", label: "Dịch vụ" },
      { value: "debt_collection", label: "Thu nợ khách hàng" },
      { value: "other_income", label: "Thu khác" },
      { value: "general_income", label: "Thu chung" },
    ],
    []
  );

  const expenseCategoryOptions = useMemo(
    () => [
      { value: "inventory_purchase", label: "Mua hàng" },
      { value: "supplier_payment", label: "Chi trả nhà cung cấp" },
      { value: "salary", label: "Lương nhân viên" },
      { value: "debt_payment", label: "Trả nợ nhà cung cấp" },
      { value: "loan_payment", label: "Trả nợ vay" },
      { value: "other_expense", label: "Chi khác" },
      { value: "general_expense", label: "Chi chung" },
    ],
    []
  );

  const formCategoryOptions = formType === "income" ? incomeCategoryOptions : expenseCategoryOptions;

  useEffect(() => {
    setFormCategory(formType === "income" ? "other_income" : "other_expense");
  }, [formType]);

  const handleCreateCashTx = async () => {
    if (!currentBranchId) return;
    if (!formAmount || formAmount <= 0) return;

    await createCashTxMutation.mutateAsync({
      type: formType,
      amount: Math.max(0, Math.round(formAmount)),
      branchId: currentBranchId,
      paymentSourceId: formPaymentSourceId || "cash",
      date: formDate ? `${formDate}T00:00:00` : undefined,
      category: formCategory,
      recipient: formRecipient.trim() || undefined,
      notes: formNotes.trim() || undefined,
    });

    setFormAmount(0);
    setFormRecipient("");
    setFormNotes("");
    setIsFormModalOpen(false);
  };

  const openTxModal = (type: "income" | "expense") => {
    setFormType(type);
    setIsFormModalOpen(true);
  };

  const queryType = typeFilter === "all" ? undefined : typeFilter;
  const { data: transactions = [], isLoading } = useCashTxRepo({
    branchId: currentBranchId,
    type: queryType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const sortedTx = useMemo(() => {
    return [...transactions].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [transactions]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of sortedTx) {
      const amount = Number(tx.amount || 0);
      if ((tx.type || "").toLowerCase() === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [sortedTx]);

  return (
    <div className="p-3 sm:p-5 lg:p-6 bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-64px)]">
      <div className="max-w-7xl mx-auto bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 sm:p-5 lg:p-6 space-y-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Sổ quỹ
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Theo dõi toàn bộ dòng tiền thu chi theo chi nhánh hiện tại.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 sm:justify-end">
              <button
                onClick={() => openTxModal("income")}
                className="px-3.5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                + Thêm phiếu Thu
              </button>
              <button
                onClick={() => openTxModal("expense")}
                className="px-3.5 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                - Thêm phiếu Chi
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-100 dark:border-emerald-900/40">
              <div className="text-xs text-emerald-700 dark:text-emerald-300">Tổng thu</div>
              <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">
                {formatCurrency(summary.income)}
              </div>
            </div>
            <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-100 dark:border-red-900/40">
              <div className="text-xs text-red-700 dark:text-red-300">Tổng chi</div>
              <div className="text-lg font-bold text-red-700 dark:text-red-300">
                {formatCurrency(summary.expense)}
              </div>
            </div>
            <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-100 dark:border-blue-900/40">
              <div className="text-xs text-blue-700 dark:text-blue-300">Số dư</div>
              <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                {formatCurrency(summary.balance)}
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900/40">
            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: "all", label: "Tất cả" },
                { key: "income", label: "Thu" },
                { key: "expense", label: "Chi" },
              ].map((item) => (
                <button
                  key={item.key}
                  onClick={() => setTypeFilter(item.key as "all" | "income" | "expense")}
                  className={`px-3 py-1.5 text-sm rounded-lg border transition ${
                    typeFilter === item.key
                      ? "bg-blue-600 text-white border-blue-600"
                      : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
                  }`}
                >
                  {item.label}
                </button>
              ))}

              <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1 hidden sm:block" />

              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Từ ngày"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Đến ngày"
              />
              <button
                onClick={() => {
                  setStartDate("");
                  setEndDate("");
                  setTypeFilter("all");
                }}
                className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
              >
                Xóa lọc
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="p-8 text-sm text-slate-500 text-center">Đang tải sổ quỹ...</div>
          ) : sortedTx.length === 0 ? (
            <div className="p-8 text-sm text-slate-500 text-center">Chưa có dữ liệu thu chi.</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Ngày</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Loại</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Danh mục</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Nội dung</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Đối tượng</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-200">Số tiền</th>
                </tr>
              </thead>
              <tbody>
                {sortedTx.map((tx) => {
                  const isIncome = (tx.type || "").toLowerCase() === "income";
                  return (
                    <tr
                      key={tx.id}
                      className="border-t border-slate-200 dark:border-slate-700 even:bg-slate-50/50 even:dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                    >
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {formatDate(new Date(tx.date), true)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                            isIncome
                              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {isIncome ? "Thu" : "Chi"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {formatCashTxCategory((tx as any).category)}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {(tx as any).notes || (tx as any).description || "-"}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                        {(tx as any).recipient || "-"}
                      </td>
                      <td
                        className={`px-4 py-3 text-sm text-right font-semibold ${
                          isIncome
                            ? "text-emerald-700 dark:text-emerald-300"
                            : "text-red-700 dark:text-red-300"
                        }`}
                      >
                        {formatCurrency(Number(tx.amount || 0))}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {isFormModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="w-full sm:max-w-xl bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {formType === "income" ? "Tạo phiếu Thu" : "Tạo phiếu Chi"}
              </div>
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                ×
              </button>
            </div>

            <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={formCategory}
                onChange={(e) => setFormCategory(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              >
                {formCategoryOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>

              <input
                type="number"
                min={0}
                value={formAmount || ""}
                onChange={(e) => setFormAmount(Number(e.target.value) || 0)}
                placeholder="Số tiền"
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              />

              <input
                type="text"
                value={formRecipient}
                onChange={(e) => setFormRecipient(e.target.value)}
                placeholder="Đối tượng"
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              />

              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              />

              <select
                value={formPaymentSourceId}
                onChange={(e) => setFormPaymentSourceId(e.target.value)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
                title="Nguồn tiền"
              >
                {(paymentSources || []).map((source) => (
                  <option key={source.id} value={source.id}>
                    {source.name}
                  </option>
                ))}
                {(paymentSources || []).length === 0 && <option value="cash">Tiền mặt</option>}
              </select>

              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Nội dung"
                className="sm:col-span-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
              />
            </div>

            <div className="px-4 pb-4 flex gap-2">
              <button
                onClick={() => setIsFormModalOpen(false)}
                className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
              >
                Hủy
              </button>
              <button
                onClick={handleCreateCashTx}
                disabled={createCashTxMutation.isPending || formAmount <= 0}
                className={`flex-1 px-3 py-2 text-sm rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ${
                  formType === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
                }`}
              >
                {createCashTxMutation.isPending ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashBookPage;
