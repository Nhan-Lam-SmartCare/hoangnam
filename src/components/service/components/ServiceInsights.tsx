import React from "react";
import { Wrench, Settings, Check, HandCoins, TrendingUp } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import { getDateFilterLabel, ServiceTabKey } from "../types/service.types";

const iconMap: Record<string, React.ComponentType<any>> = {
  Wrench: Wrench,
  Settings: Settings,
  Check: Check,
  HandCoins: HandCoins,
};

interface ServiceInsightsProps {
  urgentTickets: number;
  urgentRatio: number;
  totalOpenTickets: number;
  completionRate: number;
  stats: {
    done: number;
    filteredRevenue: number;
    filteredProfit: number;
  };
  statusSnapshotCards: Array<{
    key: ServiceTabKey;
    label: string;
    value: number;
    icon: string;
    accent: string;
    glow: string;
    dot: string;
    subtitle: string;
  }>;
  activeTab: ServiceTabKey;
  setActiveTab: (tab: ServiceTabKey) => void;
  isOwner: boolean;
  dateFilter: string;
  profitMargin: number;
  showProfit: boolean;
}

export const ServiceInsights: React.FC<ServiceInsightsProps> = ({
  urgentTickets,
  urgentRatio,
  totalOpenTickets,
  completionRate,
  stats,
  statusSnapshotCards,
  activeTab,
  setActiveTab,
  isOwner,
  dateFilter,
  profitMargin,
  showProfit,
}) => {
  return (
    <div className={`grid gap-4 ${isOwner ? "lg:grid-cols-[2fr,1fr]" : "lg:grid-cols-1"}`}>
      {/* Live Operations Center */}
      <div className="glass-card-premium rounded-2xl border border-slate-200/40 dark:border-slate-800/40 p-5 relative overflow-hidden flex flex-col justify-between">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Trung tâm vận hành
              </span>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-500 dark:text-red-400 border border-red-500/20 text-[8px] font-black uppercase tracking-widest animate-pulse">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 pulse-glow-red inline-block" /> Live
              </span>
            </div>
            <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-baseline gap-2">
              {urgentTickets}
              <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">phiếu cần xử lý khẩn cấp</span>
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Chiếm <span className="font-bold text-amber-500">{urgentRatio}%</span> trong số <span className="font-bold text-blue-500">{totalOpenTickets || 0}</span> phiếu đang mở
            </p>
          </div>

          <div className="text-right space-y-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
              Hiệu suất hoàn thành
            </span>
            <h3 className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
              {totalOpenTickets > 0 ? `${completionRate}%` : "—"}
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {totalOpenTickets > 0 ? (
                <>Đã sửa xong <span className="font-semibold text-emerald-500">{stats.done}</span> phiếu chờ giao</>
              ) : (
                "Không có dữ liệu tiến trình"
              )}
            </p>
          </div>
        </div>

        {/* Work Pipeline Stages */}
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {statusSnapshotCards.map((card) => {
            const IconComponent = iconMap[card.icon] || Wrench;
            const isActive = activeTab === card.key;

            return (
              <button
                key={card.key}
                onClick={() =>
                  setActiveTab(activeTab === card.key ? "all" : card.key)
                }
                className={`text-left rounded-xl border p-3.5 transition-all duration-300 relative overflow-hidden glass-card-premium bg-gradient-to-br ${card.accent} ${card.glow} ${
                  isActive
                    ? "border-blue-500/80 shadow-[0_0_20px_rgba(59,130,246,0.15)] ring-1 ring-blue-500/20"
                    : "border-slate-200/40 dark:border-slate-800/40"
                }`}
              >
                <span className={`absolute top-3.5 right-3.5 h-2 w-2 rounded-full ${card.dot}`}></span>

                <div className="flex items-center gap-2.5">
                  <div className={`p-2 rounded-lg transition-all duration-300 ${
                    isActive
                      ? "bg-blue-500/20 text-blue-400"
                      : "bg-slate-200/50 dark:bg-slate-800/70 text-slate-500 dark:text-slate-400"
                  }`}>
                    <IconComponent className="w-4 h-4" />
                  </div>
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {card.label}
                    </p>
                    <p className="text-xl font-extrabold text-slate-900 dark:text-white leading-none mt-0.5">
                      {card.value}
                    </p>
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 font-semibold">
                  <span>{card.subtitle}</span>
                  {isActive && (
                    <span className="text-blue-500 dark:text-blue-400 font-bold uppercase tracking-wider">
                      Đang lọc
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Financial Overview */}
      {isOwner && (
        <div className="grid gap-3">
          {/* Revenue card */}
          <div className="rounded-2xl glass-card-premium bg-gradient-to-br from-blue-600/15 via-indigo-600/5 to-transparent border border-blue-500/20 p-5 relative overflow-hidden shadow-lg group">
            <div className="absolute -right-10 -top-10 w-24 h-24 bg-blue-500/15 rounded-full blur-2xl group-hover:scale-150 transition-all duration-500" />
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-400 dark:text-blue-300">
                  Doanh thu {getDateFilterLabel(dateFilter)}
                </p>
                <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {formatCurrency(stats.filteredRevenue)}
                </p>
              </div>
              <div className="p-3 bg-blue-500/15 text-blue-500 dark:text-blue-400 rounded-xl border border-blue-500/20">
                <HandCoins className="w-5 h-5" />
              </div>
            </div>
            <p className="mt-4 text-[9px] text-slate-400 dark:text-slate-500 font-semibold border-t border-slate-100/50 dark:border-slate-800/50 pt-3 relative z-10">
              Bao gồm các phiếu đã thanh toán trong kì bộ lọc.
            </p>
          </div>

          {/* Profit card */}
          <div className="rounded-2xl glass-card-premium bg-gradient-to-br from-emerald-600/15 via-teal-600/5 to-transparent border border-emerald-500/20 p-5 relative overflow-hidden shadow-lg group">
            <div className="absolute -right-10 -top-10 w-24 h-24 bg-emerald-500/15 rounded-full blur-2xl group-hover:scale-150 transition-all duration-500" />
            <div className="flex items-start justify-between relative z-10">
              <div className="space-y-1">
                <p className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 dark:text-emerald-300">
                  Lợi nhuận {getDateFilterLabel(dateFilter)}
                </p>
                <p className="text-2xl font-black tracking-tight text-slate-900 dark:text-white">
                  {formatCurrency(stats.filteredProfit)}
                </p>
              </div>
              <div className="p-3 bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 rounded-xl border border-emerald-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100/50 dark:border-slate-800/50 pt-3 text-[9px] font-semibold text-slate-500 dark:text-slate-400 relative z-10">
              <span>Biên lợi nhuận ròng</span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] font-bold">
                {profitMargin}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
