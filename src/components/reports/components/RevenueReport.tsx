import React from "react";
import {
  DollarSign,
  Wallet,
  TrendingUp,
  BadgePercent,
  Calendar,
  Users,
  ShoppingBag,
  Wrench,
  ArrowRightLeft,
} from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import { formatCashTxCategory } from "../../../lib/finance/cashTxCategories";

interface RevenueReportProps {
  salesLoading: boolean;
  combinedRevenue: number;
  revenueReport: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    dailyReport: any[];
    sales: any[];
    workOrders: any[];
  };
  cashTotals: {
    totalIncome: number;
    totalExpense: number;
    totalRefund: number;
  };
  netProfit: number;
  dailyFinancials: any[];
  selectedDate: string | null;
  setSelectedDate: (date: string | null) => void;
  sortColumn: string | null;
  sortDirection: "asc" | "desc";
  handleSort: (column: string) => void;
  partsCostMap: Map<string, number>;
}

export const RevenueReport: React.FC<RevenueReportProps> = ({
  salesLoading,
  combinedRevenue,
  revenueReport,
  cashTotals,
  netProfit,
  dailyFinancials,
  selectedDate,
  setSelectedDate,
  sortColumn,
  sortDirection,
  handleSort,
  partsCostMap,
}) => {
  return (
    <div className="space-y-4">
      {salesLoading && (
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Đang tải doanh thu...
        </div>
      )}
      {/* Thống kê cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Tổng doanh thu */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Tổng doanh thu
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white leading-none font-mono tracking-tight group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
            {formatCurrency(combinedRevenue).replace("₫", "")}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Bán hàng: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(revenueReport.totalRevenue)}</span> <br/>
            Phiếu thu: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(cashTotals.totalIncome)}</span>
          </div>
        </div>

        {/* Card 2: Tổng chi phí */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-300">
              Tổng chi phí
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:scale-110 transition-transform duration-300">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white leading-none font-mono tracking-tight group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors">
            {formatCurrency(revenueReport.totalCost + cashTotals.totalExpense).replace("₫", "")}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Giá vốn: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(revenueReport.totalCost)}</span> <br/>
            Phiếu chi: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(cashTotals.totalExpense)}</span>
          </div>
        </div>

        {/* Card 3: Lợi nhuận thuần */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-505 dark:text-slate-300">
              Lợi nhuận thuần
            </span>
            <div className={`p-2.5 rounded-xl border group-hover:scale-110 transition-transform duration-300 ${
              netProfit >= 0
                ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)]"
            }`}>
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className={`text-2xl font-black leading-none font-mono tracking-tight ${
            netProfit >= 0
              ? "text-emerald-600 dark:text-emerald-400 drop-shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              : "text-rose-600 dark:text-rose-400 drop-shadow-[0_0_10px_rgba(244,63,94,0.15)]"
          }`}>
            {formatCurrency(netProfit).replace("₫", "")}
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Lãi gộp: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(revenueReport.totalProfit)}</span> <br/>
            {cashTotals.totalIncome > 0 && (<>Thu khác: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(cashTotals.totalIncome)}</span> <br/></>)}
            {cashTotals.totalRefund > 0 && (<>Hoàn tiền: <span className="font-mono text-rose-600 dark:text-rose-400 font-bold">-{formatCurrency(cashTotals.totalRefund)}</span> <br/></>)}
            Chi phí khác: <span className="font-mono text-slate-800 dark:text-white font-bold">{formatCurrency(cashTotals.totalExpense)}</span>
          </div>
        </div>

        {/* Card 4: Tỷ suất lợi nhuận */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-505 dark:text-slate-300">
              Tỷ suất lợi nhuận
            </span>
            <div className="p-2.5 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:scale-110 transition-transform duration-300">
              <BadgePercent className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 dark:text-white leading-none font-mono tracking-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
            {combinedRevenue > 0
              ? ((netProfit / combinedRevenue) * 100).toFixed(1)
              : "0.0"}%
          </div>
          <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Lợi nhuận ròng / Tổng doanh thu
          </div>
        </div>
      </div>

      {/* Bảng chi tiết theo ngày */}
      <div className="bg-white dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-2xl">
        {/* Table Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.2)]">
              <Calendar className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Chi tiết theo ngày
            </h3>
            <span className="px-2.5 py-0.5 bg-amber-505/20 text-amber-600 dark:text-amber-400 text-[10px] font-black uppercase rounded-full border border-amber-500/30">
              {revenueReport.dailyReport.length} ngày
            </span>
          </div>
          <span className="text-[11px] text-slate-505 italic hidden sm:block">
            Nhấn vào ngày để xem chi tiết
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            {/* Grouped Column Headers */}
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/70">
                <th rowSpan={2} className="px-2 py-2 text-center text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-8 bg-slate-50 dark:bg-slate-800/50">
                  #
                </th>
                <th
                  rowSpan={2}
                  className="px-3 py-2 text-left text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider cursor-pointer hover:text-slate-900 dark:hover:text-white transition-colors select-none bg-slate-50 dark:bg-slate-800/50"
                  onClick={() => handleSort("date")}
                >
                  <div className="flex items-center gap-1">
                    <span>Ngày</span>
                    {sortColumn === "date" && (
                      <span className="text-amber-500 dark:text-amber-400 text-xs">
                        {sortDirection === "asc" ? "↑" : "↓"}
                      </span>
                    )}
                  </div>
                </th>
                {/* DOANH THU group */}
                <th colSpan={2} className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800/30 border-l border-slate-200 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-300">DOANH THU</span>
                </th>
                {/* GIÁ VỐN HÀNG BÁN group */}
                <th colSpan={2} className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800/30 border-l border-slate-200 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-300">GIÁ VỐN HÀNG BÁN</span>
                </th>
                {/* LỢN NHUẬN group */}
                <th colSpan={3} className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-widest bg-slate-50 dark:bg-slate-800/30 border-l border-slate-200 dark:border-slate-700/50">
                  <span className="text-slate-600 dark:text-slate-300">LỢI NHUẬN</span>
                </th>
              </tr>
              <tr className="border-b border-slate-200 dark:border-slate-700/70 bg-slate-100/40 dark:bg-slate-800/40">
                {/* DOANH THU sub-columns */}
                <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700/50">Bán hàng</th>
                <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300">Sửa chữa</th>
                {/* GIÁ VỐN sub-columns */}
                <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700/50">Vốn BH</th>
                <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300">Vật tư SC</th>
                {/* LỢI NHUẬN sub-columns */}
                <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300 border-l border-slate-200 dark:border-slate-700/50">Lãi gộp</th>
                <th className="px-2 py-1.5 text-right text-[11px] font-bold text-slate-600 dark:text-slate-300">Thu/Chi khác</th>
                <th className="px-2 py-1.5 text-right text-[11px] font-black text-slate-800 dark:text-white">Lãi ròng</th>
              </tr>
            </thead>
            <tbody>
              {dailyFinancials.map((day, index) => {
                const isExpanded = selectedDate === day.date;
                const {
                  salesRevenue,
                  woRevenue,
                  salesCOGS,
                  woParts,
                  laiGop,
                  thuChiKhac,
                  laiRong,
                  dayCashTx,
                } = day;

                return (
                  <React.Fragment key={day.date}>
                    <tr
                      className={`border-b border-slate-150 dark:border-slate-850 cursor-pointer transition-colors group ${
                        isExpanded ? "bg-slate-50 dark:bg-slate-800/80" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"
                      }`}
                      onClick={() => setSelectedDate(isExpanded ? null : day.date)}
                      title="Nhấn để xem chi tiết"
                    >
                      <td className="px-2 py-2.5 text-center text-xs font-medium text-slate-500">
                        {isExpanded ? (
                          <span className="text-amber-500 dark:text-amber-400 text-[10px]">▼</span>
                        ) : (
                          <span>{index + 1}</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-xs font-semibold text-blue-600 dark:text-blue-400 group-hover:text-blue-700 dark:group-hover:text-blue-300">
                        {new Date(day.date).toLocaleDateString("vi-VN")}
                      </td>
                      {/* Bán hàng */}
                      <td className={`px-2 py-2.5 text-right text-xs font-semibold border-l border-slate-200 dark:border-slate-700/50 ${salesRevenue === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                        {salesRevenue === 0 ? "-" : formatCurrency(salesRevenue)}
                      </td>
                      {/* Sửa chữa */}
                      <td className={`px-2 py-2.5 text-right text-xs font-semibold ${woRevenue === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                        {woRevenue === 0 ? "-" : formatCurrency(woRevenue)}
                      </td>
                      {/* COGS */}
                      <td className={`px-2 py-2.5 text-right text-xs border-l border-slate-200 dark:border-slate-700/50 ${salesCOGS === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"}`}>
                        {salesCOGS === 0 ? "-" : formatCurrency(salesCOGS)}
                      </td>
                      {/* Vật tư SC */}
                      <td className={`px-2 py-2.5 text-right text-xs ${woParts === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"}`}>
                        {woParts === 0 ? "-" : formatCurrency(woParts)}
                      </td>
                      {/* Lãi gộp */}
                      <td className={`px-2 py-2.5 text-right text-xs font-semibold border-l border-slate-200 dark:border-slate-700/50 ${laiGop === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-800 dark:text-slate-200"}`}>
                        {laiGop === 0 ? "-" : formatCurrency(laiGop)}
                      </td>
                      {/* Thu/Chi khác */}
                      <td className={`px-2 py-2.5 text-right text-xs ${thuChiKhac === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                        {thuChiKhac === 0 ? "-" : (thuChiKhac > 0 ? "+" : "") + formatCurrency(thuChiKhac)}
                      </td>
                      {/* Lãi ròng */}
                      <td className={`px-2 py-2.5 text-right text-xs font-black border-l border-slate-200 dark:border-slate-700/50 ${laiRong === 0 ? "text-slate-400 dark:text-slate-600" : laiRong > 0 ? "text-green-600 dark:text-green-400 font-extrabold" : "text-rose-600 dark:text-rose-400 font-extrabold"}`}>
                        {laiRong > 0 ? "+" : ""}{formatCurrency(laiRong)}
                      </td>
                    </tr>

                    {/* Expanded Detail Row */}
                    {isExpanded && (
                      <tr>
                        <td colSpan={9} className="p-0">
                          <div className="bg-slate-50/90 dark:bg-[#0B0F19]/90 border-t border-b border-slate-200 dark:border-slate-800/80 backdrop-blur-md px-6 py-6">
                            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                              {/* CÁCH TÍNH LỢI NHUẬN */}
                              <div className="bg-white dark:bg-[#0D121F]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-2xl rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.01]">
                                {/* Ambient Glow */}
                                <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-emerald-500/5 blur-2xl rounded-full pointer-events-none" />
                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-lg bg-emerald-505/10 text-emerald-500 dark:text-emerald-400 border border-emerald-500/20 shadow-[0_0_12px_rgba(16,185,129,0.15)] group-hover:scale-110 transition-transform duration-300">
                                    <TrendingUp className="w-4 h-4" />
                                  </div>
                                  <span>Cách tính lợi nhuận</span>
                                </h4>
                                <div className="space-y-3 text-xs">
                                  <div className="flex justify-between items-center p-2.5 bg-slate-100/50 dark:bg-[#131926]/30 border border-slate-200 dark:border-slate-800/40 rounded-xl">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">Doanh thu bán hàng</span>
                                    <span className="font-bold text-slate-800 dark:text-slate-200 font-mono">{formatCurrency(salesRevenue + woRevenue)}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-2.5 bg-slate-100/50 dark:bg-[#131926]/30 border border-slate-200 dark:border-slate-800/40 rounded-xl">
                                    <span className="text-slate-500 dark:text-slate-400 font-medium">(-) Giá vốn hàng bán</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400 font-mono">- {formatCurrency(salesCOGS + woParts)}</span>
                                  </div>
                                  <div className="flex justify-between items-center p-2.5 bg-emerald-50/60 dark:bg-[#131926]/50 border border-emerald-100 dark:border-emerald-500/10 rounded-xl text-emerald-600 dark:text-emerald-400/90">
                                    <span className="font-bold">= Lãi gộp bán hàng</span>
                                    <span className="font-extrabold font-mono">{formatCurrency(laiGop)}</span>
                                  </div>
                                  {thuChiKhac !== 0 && (
                                    <div className="flex justify-between items-center p-2.5 bg-slate-100/50 dark:bg-[#131926]/30 border border-slate-200 dark:border-slate-800/40 rounded-xl">
                                      <span className="text-slate-500 dark:text-slate-400 font-medium">{thuChiKhac > 0 ? "(+) Thu khác" : "(-) Chi khác"}</span>
                                      <span className={`font-bold font-mono ${thuChiKhac > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                        {thuChiKhac > 0 ? "+" : ""}{formatCurrency(thuChiKhac)}
                                      </span>
                                    </div>
                                  )}
                                  <div className="p-3 bg-gradient-to-r from-slate-100 to-slate-200 dark:from-slate-900 dark:to-slate-955 border border-slate-250 dark:border-slate-700/55 rounded-xl flex justify-between items-center shadow-inner mt-4">
                                    <span className="text-slate-900 dark:text-white font-black text-xs tracking-wider">LÃI RÒNG</span>
                                    <span className={`font-black text-sm font-mono tracking-tight ${laiRong >= 0 ? "text-emerald-600 dark:text-green-400 drop-shadow-[0_0_8px_rgba(74,222,128,0.25)]" : "text-rose-600 dark:text-red-400 drop-shadow-[0_0_8px_rgba(248,113,113,0.25)]"}`}>
                                      {laiRong > 0 ? "+" : ""}{formatCurrency(laiRong)}
                                    </span>
                                  </div>
                                </div>
                              </div>

                              {/* ĐƠN BÁN HÀNG */}
                              <div className="bg-white dark:bg-[#0D121F]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-2xl rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.01]">
                                {/* Ambient Glow */}
                                <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-blue-500/5 blur-2xl rounded-full pointer-events-none" />
                                <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2.5">
                                  <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 shadow-[0_0_12px_rgba(59,130,246,0.15)] group-hover:scale-110 transition-transform duration-300">
                                    <ShoppingBag className="w-4 h-4" />
                                  </div>
                                  <span>Đơn bán hàng ({day.sales.length})</span>
                                </h4>
                                {day.sales.length === 0 ? (
                                  <div className="text-xs text-slate-500 py-8 text-center bg-slate-100/50 dark:bg-[#131926]/20 border border-slate-200 dark:border-slate-800/40 rounded-xl">Không có đơn bán hàng</div>
                                ) : (
                                  <>
                                    {/* Tổng bán hàng */}
                                    <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200 dark:border-slate-800/60">
                                      <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Tổng doanh thu</div>
                                      <div className="text-right">
                                        <span className="font-black text-slate-800 dark:text-slate-200 text-xs font-mono">{formatCurrency(salesRevenue)}</span>
                                        <span className="px-2 py-0.5 ml-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-505/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 text-[9px] font-black uppercase rounded-full">
                                          Lãi: {formatCurrency(salesRevenue - salesCOGS)}
                                        </span>
                                      </div>
                                    </div>
                                    <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
                                      {day.sales.map((sale: any) => {
                                        const saleCost = sale.items.reduce((c: number, it: any) => {
                                          const cost = it.costPrice || partsCostMap.get(it.partId) || partsCostMap.get(it.sku) || 0;
                                          return c + cost * it.quantity;
                                        }, 0);
                                        const saleProfit = sale.total - saleCost;
                                        return (
                                          <div key={sale.id} className="bg-slate-50 hover:bg-slate-100/80 dark:bg-[#131926]/40 dark:hover:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-3.5 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                                            <div className="flex justify-between items-start mb-2">
                                              <div className="flex items-center gap-2">
                                                <div className="p-1 rounded-md bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20">
                                                  <Users className="w-3 h-3" />
                                                </div>
                                                <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{sale.customer?.name || "Khách vãng lai"}</span>
                                              </div>
                                              <div className="text-right">
                                                <div className="font-black text-slate-800 dark:text-slate-200 text-xs font-mono">{formatCurrency(sale.total)}</div>
                                                <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                  Lãi: +{formatCurrency(saleProfit)}
                                                </div>
                                              </div>
                                            </div>
                                            <div className="text-[10px] text-slate-550 font-medium mb-2.5 pb-2 border-b border-slate-200 dark:border-slate-800/40 flex justify-between">
                                              <span>{sale.sale_code || "---"}</span>
                                              <span className="px-1.5 py-0.2 bg-slate-100 dark:bg-[#0D121F] rounded text-[9px] font-black uppercase text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-800">
                                                {sale.paymentMethod === "bank" ? "CK" : "TM"}
                                              </span>
                                            </div>
                                            <div className="space-y-1">
                                              {sale.items.map((item: any, idx: number) => (
                                                <div key={idx} className="flex justify-between text-[10px] bg-white dark:bg-[#0D121F]/40 p-1.5 rounded-lg border border-slate-150 dark:border-slate-800/20">
                                                  <span className="text-slate-500 dark:text-slate-400 truncate mr-2 font-medium">{item.partName}</span>
                                                  <span className="text-slate-700 dark:text-slate-350 font-mono font-bold whitespace-nowrap flex-shrink-0">
                                                    x{item.quantity} = {formatCurrency(item.sellingPrice * item.quantity)}
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </>
                                )}
                              </div>

                              {/* SỬA CHỮA + GIAO DỊCH KHÁC */}
                              <div className="space-y-4">
                                {/* SỬA CHỮA */}
                                <div className="bg-white dark:bg-[#0D121F]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-2xl rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.01]">
                                  {/* Ambient Glow */}
                                  <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-violet-500/5 blur-2xl rounded-full pointer-events-none" />
                                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-violet-505/10 text-violet-550 dark:text-violet-400 border border-violet-500/20 mt-0.5">
                                      <Wrench className="w-4 h-4" />
                                    </div>
                                    <span>Sửa chữa ({day.workOrders.length})</span>
                                  </h4>
                                  {day.workOrders.length === 0 ? (
                                    <div className="text-xs text-slate-500 py-8 text-center bg-slate-100/50 dark:bg-[#131926]/20 border border-slate-200 dark:border-slate-800/40 rounded-xl">Không có phiếu sửa chữa</div>
                                  ) : (
                                    <>
                                      {/* Tổng sửa chữa */}
                                      <div className="flex justify-between items-center mb-3 pb-3 border-b border-slate-200 dark:border-slate-800/60">
                                        <div className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Tổng doanh thu</div>
                                        <div className="text-right">
                                          <span className="font-black text-slate-800 dark:text-slate-200 text-xs font-mono">{formatCurrency(woRevenue)}</span>
                                          <span className="px-2 py-0.5 ml-2 bg-emerald-50 text-emerald-600 dark:bg-emerald-505/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 text-[9px] font-black uppercase rounded-full">
                                            Lãi: {formatCurrency(woRevenue - woParts)}
                                          </span>
                                        </div>
                                      </div>
                                      <div className="space-y-3 max-h-48 overflow-y-auto pr-1">
                                        {day.workOrders.map((wo: any) => {
                                          const woTotal = wo.totalPaid || wo.totalpaid || wo.total || 0;
                                          const woPartsCost = (wo.partsUsed || wo.partsused || []).reduce((c: number, p: any) => {
                                            const partId = p.partId || p.partid;
                                            const cost = p.costPrice || p.costprice || partsCostMap.get(partId) || partsCostMap.get(p.sku) || 0;
                                            return c + cost * (p.quantity || 0);
                                          }, 0);
                                          const woProfit = woTotal - woPartsCost;
                                          return (
                                            <div key={wo.id} className="bg-slate-50 hover:bg-slate-100/80 dark:bg-[#131926]/40 dark:hover:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800/60 rounded-xl p-3 transition-all duration-300 hover:scale-[1.01] hover:shadow-[0_4px_15px_rgba(0,0,0,0.3)]">
                                              <div className="flex justify-between items-start">
                                                <div className="flex items-start gap-2">
                                                  <div className="p-1 rounded-md bg-violet-500/10 text-violet-550 dark:text-violet-400 border border-violet-500/20 mt-0.5">
                                                    <Wrench className="w-3 h-3" />
                                                  </div>
                                                  <div>
                                                    <div className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">{wo.customerName || wo.customername}</div>
                                                    <div className="text-[9px] font-medium text-slate-505 mt-0.5">{wo.vehicleModel || wo.vehiclemodel || ""} • {wo.licensePlate || wo.licenseplate || ""}</div>
                                                  </div>
                                                </div>
                                                <div className="text-right">
                                                  <div className="font-black text-slate-800 dark:text-slate-200 text-xs font-mono">{formatCurrency(woTotal)}</div>
                                                  <div className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                                                    Lãi: +{formatCurrency(woProfit)}
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </>
                                  )}
                                </div>

                                {/* GIAO DỊCH KHÁC */}
                                <div className="bg-white dark:bg-[#0D121F]/80 backdrop-blur-xl border border-slate-200 dark:border-slate-800/80 shadow-sm dark:shadow-2xl rounded-2xl p-5 relative overflow-hidden group transition-all duration-300 hover:scale-[1.01]">
                                  {/* Ambient Glow */}
                                  <div className="absolute -right-10 -bottom-10 w-24 h-24 bg-amber-500/5 blur-2xl rounded-full pointer-events-none" />
                                  <h4 className="text-xs font-black text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-4 flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-amber-505/10 text-amber-500 dark:text-amber-400 border border-amber-500/20 shadow-[0_0_12px_rgba(245,158,11,0.15)] group-hover:scale-110 transition-transform duration-300">
                                      <ArrowRightLeft className="w-4 h-4" />
                                    </div>
                                    <span>Giao dịch khác ({dayCashTx.length})</span>
                                  </h4>
                                  {dayCashTx.length === 0 ? (
                                    <div className="text-xs text-slate-500 py-8 text-center bg-slate-100/50 dark:bg-[#131926]/20 border border-slate-200 dark:border-slate-800/40 rounded-xl">Không có giao dịch khác</div>
                                  ) : (
                                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                                      {dayCashTx.map((tx: any) => (
                                        <div key={tx.id} className="flex justify-between items-center text-xs py-2 px-3 bg-slate-50 hover:bg-slate-100/80 dark:bg-[#131926]/40 dark:hover:bg-[#1E293B]/60 border border-slate-200 dark:border-slate-800/40 rounded-xl transition-all duration-200">
                                          <div className="flex items-center gap-2">
                                            <div className={`w-1.5 h-1.5 rounded-full ${tx.type === "income" ? "bg-emerald-500 animate-pulse" : "bg-rose-500 animate-pulse"}`} />
                                            <span className="text-slate-700 dark:text-slate-300 font-bold">
                                              {tx.description || tx.notes || formatCashTxCategory(tx.category || "")}
                                            </span>
                                          </div>
                                          <span className={`font-mono text-xs font-extrabold ${tx.type === "income" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                                            {tx.type === "income" ? "+" : "-"}{formatCurrency(Math.abs(tx.amount))}
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
              {/* Tổng hàng */}
              {revenueReport.dailyReport.length > 0 && (() => {
                const totalSalesRev = revenueReport.dailyReport.reduce((sum: number, d: any) => sum + d.sales.reduce((s: number, sale: any) => s + sale.total, 0), 0);
                const totalWoRev = revenueReport.dailyReport.reduce((sum: number, d: any) => sum + d.workOrders.reduce((s: number, wo: any) => s + (wo.totalPaid || wo.totalpaid || wo.total || 0), 0), 0);
                const totalSalesCOGS = revenueReport.dailyReport.reduce((sum: number, d: any) => sum + d.sales.reduce((s: number, sale: any) => s + sale.items.reduce((c: number, item: any) => c + ((item.costPrice || partsCostMap.get(item.partId) || partsCostMap.get(item.sku) || 0) * item.quantity), 0), 0), 0);
                const totalWoParts = revenueReport.dailyReport.reduce((sum: number, d: any) => sum + d.workOrders.reduce((s: number, wo: any) => {
                  const parts = wo.partsUsed || wo.partsused || [];
                  return s + parts.reduce((c: number, p: any) => c + ((p.costPrice || p.costprice || partsCostMap.get(p.partId || p.partid) || partsCostMap.get(p.sku) || 0) * (p.quantity || 0)), 0);
                }, 0), 0);
                const totalLaiGop = (totalSalesRev + totalWoRev) - (totalSalesCOGS + totalWoParts);
                const totalThuChiKhac = cashTotals.totalIncome - cashTotals.totalExpense - cashTotals.totalRefund;
                return (
                  <tr className="border-t-2 border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-800/60">
                    <td colSpan={2} className="px-3 py-2.5 text-left text-xs font-black text-slate-800 dark:text-white uppercase tracking-wider">
                      Tổng:
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-bold border-l border-slate-200 dark:border-slate-700/50 ${totalSalesRev === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                      {formatCurrency(totalSalesRev)}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-bold ${totalWoRev === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                      {formatCurrency(totalWoRev)}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-bold border-l border-slate-200 dark:border-slate-700/50 ${totalSalesCOGS === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"}`}>
                      {formatCurrency(totalSalesCOGS)}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-bold ${totalWoParts === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-600 dark:text-slate-300"}`}>
                      {formatCurrency(totalWoParts)}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-bold border-l border-slate-200 dark:border-slate-700/50 ${totalLaiGop === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-800 dark:text-slate-200"}`}>
                      {formatCurrency(totalLaiGop)}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-bold ${totalThuChiKhac === 0 ? "text-slate-400 dark:text-slate-600" : "text-slate-700 dark:text-slate-300"}`}>
                      {totalThuChiKhac === 0 ? "-" : (totalThuChiKhac > 0 ? "+" : "") + formatCurrency(totalThuChiKhac)}
                    </td>
                    <td className={`px-2 py-2.5 text-right text-xs font-black border-l border-slate-200 dark:border-slate-700/50 ${netProfit === 0 ? "text-slate-400 dark:text-slate-600" : netProfit > 0 ? "text-emerald-600 dark:text-green-400" : "text-rose-600 dark:text-red-400"}`}>
                      {netProfit > 0 ? "+" : ""}{formatCurrency(netProfit)}
                    </td>
                  </tr>
                );
              })()}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
