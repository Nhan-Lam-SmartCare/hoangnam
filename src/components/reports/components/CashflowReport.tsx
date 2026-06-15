import React from "react";
import { Wallet, DollarSign, TrendingUp, Boxes, BriefcaseBusiness, Building, AlertTriangle, Users } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import { getCashTxCategoryKey } from "../../../lib/finance/cashTxCategories";

interface CashflowReportProps {
  cashTxLoading: boolean;
  cashflowReport: {
    totalIncome: number;
    totalExpense: number;
    netCashFlow: number;
    byCategory: Record<string, { income: number; expense: number }>;
  };
}

const getCategoryIconAndColor = (categoryKey: string) => {
  switch (categoryKey) {
    case "sale_income":
    case "service_income":
      return {
        icon: <TrendingUp className="w-4 h-4" />,
        colorClass: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)]",
        glow: "bg-emerald-500/5",
      };
    case "inventory_purchase":
    case "supplier_payment":
    case "debt_payment":
      return {
        icon: <Boxes className="w-4 h-4" />,
        colorClass: "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)]",
        glow: "bg-amber-500/5",
      };
    case "salary":
    case "employee_advance":
      return {
        icon: <BriefcaseBusiness className="w-4 h-4" />,
        colorClass: "bg-violet-500/10 text-violet-400 border-violet-500/20 shadow-[0_0_12px_rgba(139,92,246,0.15)]",
        glow: "bg-violet-500/5",
      };
    case "rent":
    case "utilities":
      return {
        icon: <Building className="w-4 h-4" />,
        colorClass: "bg-indigo-500/10 text-indigo-400 border-indigo-500/20 shadow-[0_0_12px_rgba(99,102,241,0.15)]",
        glow: "bg-indigo-500/5",
      };
    case "sale_refund":
      return {
        icon: <AlertTriangle className="w-4 h-4" />,
        colorClass: "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_12px_rgba(244,63,94,0.15)]",
        glow: "bg-rose-500/5",
      };
    case "debt_collection":
      return {
        icon: <Users className="w-4 h-4" />,
        colorClass: "bg-sky-500/10 text-sky-400 border-sky-500/20 shadow-[0_0_12px_rgba(14,165,233,0.15)]",
        glow: "bg-sky-500/5",
      };
    default:
      return {
        icon: <Wallet className="w-4 h-4" />,
        colorClass: "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)]",
        glow: "bg-blue-500/5",
      };
  }
};

const translateCategory = (category: string): string => {
  if (category === "refund" || category === "sale_refund") {
    return "Hoàn tiền trả hàng";
  }
  if (category === "salary" || category === "payroll") {
    return "Chi trả lương nhân viên";
  }
  if (category === "inventory_purchase" || category === "purchase") {
    return "Nhập hàng / Mua sắm";
  }
  if (category === "utilities") {
    return "Chi phí điện nước, internet";
  }
  if (category === "rent") {
    return "Chi phí mặt bằng";
  }
  if (category === "other_expense" || category === "other") {
    return "Chi phí khác";
  }
  if (category === "other_income") {
    return "Thu nhập khác";
  }
  return category;
};

export const CashflowReport: React.FC<CashflowReportProps> = ({
  cashTxLoading,
  cashflowReport,
}) => {
  return (
    <div className="space-y-4">
      {cashTxLoading && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Đang tải sổ quỹ...
        </div>
      )}
      {/* Thống kê cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Tổng thu */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-505 dark:text-slate-300">
              Tổng thu
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)] group-hover:scale-110 transition-transform duration-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono tracking-tight drop-shadow-[0_0_10px_rgba(16,185,129,0.15)]">
            {formatCurrency(cashflowReport.totalIncome).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Tổng hợp tất cả khoản thu thực tế <br/>
            (Đã bao gồm doanh thu bán hàng & dịch vụ)
          </div>
        </div>

        {/* Card 2: Tổng chi */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-505 dark:text-slate-300">
              Tổng chi
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:scale-110 transition-transform duration-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono tracking-tight drop-shadow-[0_0_10px_rgba(244,63,94,0.15)]">
            {formatCurrency(cashflowReport.totalExpense).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Tổng hợp tất cả khoản chi thực tế <br/>
            (Chi phí nhập kho, vận hành, lương, mặt bằng...)
          </div>
        </div>

        {/* Card 3: Dòng tiền ròng */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Dòng tiền ròng
            </span>
            <div className={`p-2.5 rounded-xl border group-hover:scale-110 transition-transform duration-300 ${
              cashflowReport.netCashFlow >= 0
                ? "bg-blue-500/10 text-blue-400 border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)]"
                : "bg-amber-500/10 text-amber-400 border-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
            }`}>
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black leading-none font-mono tracking-tight ${
            cashflowReport.netCashFlow >= 0
              ? "text-blue-600 dark:text-blue-400"
              : "text-amber-600 dark:text-amber-400"
          }`}>
            {formatCurrency(cashflowReport.netCashFlow).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Chênh lệch Thu - Chi thực tế của cửa hàng <br/>
            (Phản ánh tính thanh khoản dòng tiền mặt/chuyển khoản)
          </div>
        </div>
      </div>

      {/* Thu chi theo danh mục */}
      <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-6 shadow-sm dark:shadow-2xl relative overflow-hidden group">
        {/* Ambient Glow */}
        <div className="absolute -right-12 -bottom-12 w-32 h-32 bg-emerald-500/5 blur-3xl rounded-full pointer-events-none" />

        <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase mb-5 flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]">
            <Wallet className="w-4 h-4" />
          </div>
          <span>Thu chi theo danh mục</span>
        </h3>

        <div className="space-y-3">
          {Object.entries(cashflowReport.byCategory).map(([category, amounts]) => {
            const catKey = getCashTxCategoryKey(category);
            const design = getCategoryIconAndColor(catKey);

            const isIncome = amounts.income > amounts.expense || (amounts.income > 0 && amounts.expense === 0);
            const amount = isIncome ? amounts.income : amounts.expense;

            const total = isIncome ? cashflowReport.totalIncome : cashflowReport.totalExpense;
            const percentage = total > 0 ? (amount / total) * 100 : 0;

            const typeLabel = isIncome ? "Thu" : "Chi";
            const typeColorClass = isIncome
              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.1)]"
              : "bg-rose-500/10 text-rose-400 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.1)]";
            const barColorClass = isIncome ? "bg-emerald-400 animate-pulse" : "bg-rose-400 animate-pulse";
            const amountColorClass = isIncome ? "text-emerald-400" : "text-rose-400";
            const amountSign = isIncome ? "+" : "-";

            return (
              <div
                key={category}
                className="flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100/80 dark:bg-[#131926]/40 dark:hover:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800/50 dark:hover:border-slate-700/50 rounded-xl hover:shadow-md dark:hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)] transition-all duration-300 group/item relative overflow-hidden"
              >
                {/* Internal hover ambient glow */}
                <div className={`absolute -right-10 -bottom-10 w-20 h-20 ${design.glow} blur-2xl rounded-full opacity-0 group-hover/item:opacity-100 transition-opacity duration-500 pointer-events-none`} />

                {/* Left: Icon, Category Name, and Type Badge */}
                <div className="flex items-center gap-3 min-w-[150px] sm:min-w-[200px]">
                  <div className={`p-2 rounded-lg border transition-transform duration-300 group-hover/item:scale-110 ${design.colorClass}`}>
                    {design.icon}
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs sm:text-sm">
                      {translateCategory(category)}
                    </span>
                    <span className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-black uppercase border tracking-wider w-fit ${typeColorClass}`}>
                      {typeLabel}
                    </span>
                  </div>
                </div>

                {/* Center: Share Track */}
                <div className="hidden md:flex flex-col flex-1 max-w-xs lg:max-w-md mx-8 gap-1.5">
                  <div className="flex justify-between text-[9px] font-black uppercase text-slate-505 dark:text-slate-400 tracking-wider">
                    <span>Tỉ lệ trong tổng {isIncome ? "thu" : "chi"}</span>
                    <span className="font-mono text-slate-700 dark:text-slate-300">{percentage.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200 dark:border-slate-800/40 p-[2px]">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ease-out ${barColorClass}`}
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>

                {/* Right: Clean Cash Amount */}
                <div className="text-right">
                  <div className="text-[10px] text-slate-550 font-bold uppercase tracking-wider mb-1">
                    Số tiền thực tế
                  </div>
                  <div className={`font-black font-mono text-sm sm:text-base ${amountColorClass}`}>
                    {amountSign}{formatCurrency(amount)}
                  </div>
                </div>
              </div>
            );
          })}

          {/* Net Summary Footer */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800/60 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${
                cashflowReport.netCashFlow >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20"
              }`}>
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <div className="text-[10px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-400">Dòng tiền ròng (Thu − Chi)</div>
                <div className="text-[9px] text-slate-500 dark:text-slate-600 mt-0.5">Tổng thu thực tế trừ tổng chi thực tế</div>
              </div>
            </div>
            <div className={`font-black font-mono text-base ${
              cashflowReport.netCashFlow >= 0
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-rose-600 dark:text-rose-400"
            }`}>
              {cashflowReport.netCashFlow >= 0 ? "+" : ""}{formatCurrency(cashflowReport.netCashFlow)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
