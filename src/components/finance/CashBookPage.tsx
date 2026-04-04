import React, { useMemo, useState } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatCashTxCategory } from "../../lib/finance/cashTxCategories";

const CashBookPage: React.FC = () => {
  const { currentBranchId } = useAppContext();
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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
    <div className="p-3 sm:p-6 bg-slate-50 dark:bg-slate-900 min-h-[calc(100vh-64px)]">
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
        <div className="p-4 sm:p-6 border-b border-slate-200 dark:border-slate-700">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
            Sổ quỹ
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Theo dõi toàn bộ dòng tiền thu chi theo chi nhánh hiện tại.
          </p>

          <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
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

          <div className="mt-4 flex flex-wrap gap-2">
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
              className="px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
            >
              Xóa lọc
            </button>
          </div>
        </div>

        <div className="overflow-auto">
          {isLoading ? (
            <div className="p-6 text-sm text-slate-500">Đang tải sổ quỹ...</div>
          ) : sortedTx.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">Chưa có dữ liệu thu chi.</div>
          ) : (
            <table className="w-full min-w-[900px]">
              <thead className="bg-slate-100 dark:bg-slate-700">
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
                      className="border-t border-slate-200 dark:border-slate-700"
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
    </div>
  );
};

export default CashBookPage;
