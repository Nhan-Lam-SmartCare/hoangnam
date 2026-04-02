import React, { useMemo, useState } from "react";
import { CalendarDays, Coins, HandCoins, TrendingUp, Wallet } from "lucide-react";
import { useDashboardData } from "../dashboard/hooks/useDashboardData";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import { useAppContext } from "../../contexts/AppContext";
import { calculateFinancialSummary } from "../../lib/reports/financialSummary";
import { formatCurrency } from "../../utils/format";

type FilterKey =
  | "today"
  | "7days"
  | "week"
  | "month"
  | "year"
  | "q1"
  | "q2"
  | "q3"
  | "q4"
  | `month${number}`;

type MetricTab = "revenue" | "cashflow" | "inventory" | "payroll" | "debt" | "tax";

function toLocalDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function toDateKeyFromRaw(raw: any): string | null {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return toLocalDateKey(d);
}

function getFilterRange(filter: FilterKey): { start: Date; end: Date } {
  const now = new Date();
  let start = new Date(now.getFullYear(), now.getMonth(), 1);
  let end = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (filter.startsWith("month") && filter.length > 5) {
    const monthNum = Number.parseInt(filter.slice(5), 10);
    if (monthNum >= 1 && monthNum <= 12) {
      start = new Date(now.getFullYear(), monthNum - 1, 1);
      end = new Date(now.getFullYear(), monthNum, 0);
    }
  } else if (filter.startsWith("q") && filter.length === 2) {
    const quarter = Number.parseInt(filter.slice(1), 10);
    const startMonth = Math.max(0, Math.min(3, quarter - 1)) * 3;
    start = new Date(now.getFullYear(), startMonth, 1);
    end = new Date(now.getFullYear(), startMonth + 3, 0);
  } else {
    switch (filter) {
      case "today": {
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        end = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      }
      case "7days": {
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      }
      case "week": {
        const dayOfWeek = now.getDay();
        const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
        break;
      }
      case "year": {
        start = new Date(now.getFullYear(), 0, 1);
        break;
      }
      default:
        break;
    }
  }

  start.setHours(0, 0, 0, 0);
  end.setHours(23, 59, 59, 999);

  const days = Math.ceil((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
  if (days > 31) {
    start = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
  }

  return { start, end };
}

export default function ReportsOverview() {
  const [reportFilter, setReportFilter] = useState<FilterKey>("month");
  const [metricTab, setMetricTab] = useState<MetricTab>("revenue");

  const { currentBranchId } = useAppContext();
  const { data: workOrders = [], isLoading: loadingWorkOrders } = useWorkOrdersRepo();
  const { data: parts = [], isLoading: loadingParts } = usePartsRepo();
  const { data: cashTransactions = [], isLoading: loadingCashTx } = useCashTxRepo();

  const { filteredStats } = useDashboardData(reportFilter);

  const metricTabs: Array<{ key: MetricTab; label: string }> = [
    { key: "revenue", label: "Doanh thu" },
    { key: "cashflow", label: "Thu chi" },
    { key: "inventory", label: "Tồn kho" },
    { key: "payroll", label: "Lương" },
    { key: "debt", label: "Công nợ" },
    { key: "tax", label: "Báo cáo thuế" },
  ];

  const quickFilters: Array<{ key: FilterKey; label: string }> = [
    { key: "today", label: "Hôm nay" },
    { key: "7days", label: "7 ngày" },
    { key: "month", label: "Tháng" },
    { key: "q1", label: "Quý" },
    { key: "year", label: "Năm" },
  ];

  const monthFilters = Array.from({ length: 12 }, (_, i) => ({
    key: `month${i + 1}` as FilterKey,
    label: `T${i + 1}`,
  }));

  const dailyRows = useMemo(() => {
    const { start, end } = getFilterRange(reportFilter);
    const rows: Array<{
      dayKey: string;
      salesRevenue: number;
      serviceRevenue: number;
      totalRevenue: number;
      grossProfit: number;
      otherExpense: number;
      netProfit: number;
      workOrderCount: number;
      otherTxCount: number;
    }> = [];

    for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
      const dayStart = new Date(cursor);
      dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(cursor);
      dayEnd.setHours(23, 59, 59, 999);

      const summary = calculateFinancialSummary({
        sales: [],
        workOrders,
        parts,
        cashTransactions,
        branchId: currentBranchId,
        start: dayStart,
        end: dayEnd,
      });

      const dayKey = toLocalDateKey(dayStart);
      const workOrderCount = summary.filteredWorkOrders.length;
      const otherTxCount = (cashTransactions || []).filter((tx: any) => {
        const txDay = toDateKeyFromRaw(tx.date);
        return txDay === dayKey;
      }).length;

      rows.push({
        dayKey,
        salesRevenue: summary.salesRevenue,
        serviceRevenue: summary.woRevenue,
        totalRevenue: summary.combinedRevenue,
        grossProfit: summary.totalProfit,
        otherExpense: summary.cashExpense,
        netProfit: summary.netProfit,
        workOrderCount,
        otherTxCount,
      });
    }

    return rows.reverse();
  }, [reportFilter, workOrders, parts, cashTransactions, currentBranchId]);

  const isLoading = loadingWorkOrders || loadingParts || loadingCashTx;

  return (
    <div className="space-y-4 md:space-y-5">
      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="flex flex-wrap items-center gap-2">
          {metricTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setMetricTab(tab.key)}
              className={`rounded-xl px-3 py-2 text-sm font-semibold transition ${
                metricTab === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {quickFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setReportFilter(item.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                reportFilter === item.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {monthFilters.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setReportFilter(item.key)}
              className={`rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                reportFilter === item.key
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Coins className="h-4 w-4" /> Tổng doanh thu
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(filteredStats.revenue)}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <Wallet className="h-4 w-4" /> Tổng chi phí
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {formatCurrency(filteredStats.expense)}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <TrendingUp className="h-4 w-4" /> Lợi nhuận thuần
          </div>
          <div
            className={`mt-2 text-2xl font-bold ${
              filteredStats.profit >= 0 ? "text-emerald-500" : "text-rose-500"
            }`}
          >
            {formatCurrency(filteredStats.profit)}
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
            <HandCoins className="h-4 w-4" /> Tỷ suất lợi nhuận
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">
            {filteredStats.revenue > 0
              ? ((filteredStats.profit / filteredStats.revenue) * 100).toFixed(1)
              : "0.0"}
            %
          </div>
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200/70 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          <CalendarDays className="h-4 w-4 text-blue-500" /> Chi tiết theo ngày
        </div>

        {isLoading ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Đang tải dữ liệu báo cáo...
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="px-3 py-2">Ngày</th>
                  <th className="px-3 py-2">Bán hàng</th>
                  <th className="px-3 py-2">Sửa chữa</th>
                  <th className="px-3 py-2">Doanh thu tổng</th>
                  <th className="px-3 py-2">Lãi gộp</th>
                  <th className="px-3 py-2">Chi phí khác</th>
                  <th className="px-3 py-2">Lãi ròng</th>
                  <th className="px-3 py-2">Số giao dịch</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((row) => (
                  <tr key={row.dayKey} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                      {row.dayKey}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {formatCurrency(row.salesRevenue)}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">
                      {formatCurrency(row.serviceRevenue)}
                    </td>
                    <td className="px-3 py-2 font-semibold text-slate-700 dark:text-slate-200">
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="px-3 py-2 text-emerald-500">
                      {formatCurrency(row.grossProfit)}
                    </td>
                    <td className="px-3 py-2 text-rose-500">
                      {formatCurrency(row.otherExpense)}
                    </td>
                    <td
                      className={`px-3 py-2 font-bold ${
                        row.netProfit >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      {formatCurrency(row.netProfit)}
                    </td>
                    <td className="px-3 py-2 text-slate-500 dark:text-slate-400">
                      {row.workOrderCount + row.otherTxCount}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
