import React from "react";
import { Link } from "react-router-dom";
import {
  Search,
  RefreshCw,
  Eye,
  EyeOff,
  FileText,
  History,
  Plus,
} from "lucide-react";

interface ServiceActionBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  dateFilter: string;
  onDateFilterChange: (value: string) => void;
  technicianFilter: string;
  onTechnicianFilterChange: (value: string) => void;
  paymentFilter: string;
  onPaymentFilterChange: (value: string) => void;
  employees: Array<{ id: string; name: string }>;
  workOrdersFetching: boolean;
  onRefresh: () => void;
  onClearFilters: () => void;
  isOwner: boolean;
  showProfit: boolean;
  onToggleProfit: () => void;
  onOpenTemplates: () => void;
  canViewServiceHistory: boolean;
  canCreateWorkOrder: boolean;
  onCreateWorkOrder: () => void;
}

export const ServiceActionBar: React.FC<ServiceActionBarProps> = ({
  searchQuery,
  onSearchChange,
  dateFilter,
  onDateFilterChange,
  technicianFilter,
  onTechnicianFilterChange,
  paymentFilter,
  onPaymentFilterChange,
  employees,
  workOrdersFetching,
  onRefresh,
  onClearFilters,
  isOwner,
  showProfit,
  onToggleProfit,
  onOpenTemplates,
  canViewServiceHistory,
  canCreateWorkOrder,
  onCreateWorkOrder,
}) => {
  return (
    <div className="glass-card-premium rounded-2xl p-3 border border-slate-200/40 dark:border-slate-800/40 shadow-lg relative z-20">
      <div className="flex flex-wrap items-center gap-2 xl:gap-3">
        {/* Search */}
        <div className="relative flex-[2_1_340px] min-w-[220px] xl:min-w-[280px]">
          <input
            type="text"
            placeholder="Mã phiếu, tên khách, SĐT..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 rounded-xl text-xs text-slate-900 dark:text-white placeholder-slate-400/70 transition-all duration-300"
          />
          <Search
            className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-400"
            aria-hidden="true"
          />
        </div>

        {/* Filters - inline */}
        <select
          value={dateFilter}
          onChange={(e) => onDateFilterChange(e.target.value)}
          className="flex-1 min-w-[118px] xl:flex-none px-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-all duration-300"
        >
          <option value="today">Hôm nay</option>
          <option value="week">7 ngày qua</option>
          <option value="month">30 ngày qua</option>
          <option value="all">Tất cả (chậm hơn)</option>
        </select>
        <select
          value={technicianFilter}
          onChange={(e) => onTechnicianFilterChange(e.target.value)}
          className="flex-1 min-w-[138px] xl:flex-none px-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-all duration-300"
        >
          <option value="all">Tất cả KTV</option>
          {employees.map((emp) => (
            <option key={emp.id} value={emp.name}>
              {emp.name}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => onPaymentFilterChange(e.target.value)}
          className="flex-1 min-w-[118px] xl:flex-none px-3 py-2 text-xs bg-slate-100/50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800/80 focus:border-blue-500/80 focus:ring-2 focus:ring-blue-500/20 text-slate-700 dark:text-slate-200 rounded-xl cursor-pointer transition-all duration-300"
        >
          <option value="all">Thanh toán</option>
          <option value="paid">Đã TT</option>
          <option value="unpaid">Chưa TT</option>
          <option value="partial">Trả trước</option>
        </select>

        {/* Spacer */}
        <div className="hidden xl:block flex-1"></div>

        {/* Action Buttons */}
        <button
          onClick={onRefresh}
          disabled={workOrdersFetching}
          className="px-3 py-2 border border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/60 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Làm mới dữ liệu"
          title="Làm mới"
        >
          <RefreshCw
            className={`w-3.5 h-3.5 ${workOrdersFetching ? "animate-spin" : ""}`}
          />
        </button>
        <button
          onClick={onClearFilters}
          className="px-3 py-2 border border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/60 hover:bg-slate-200/50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-200"
          aria-label="Xóa bộ lọc"
          title="Xóa bộ lọc"
        >
          <Search className="w-3.5 h-3.5" /> Reset
        </button>

        {isOwner && (
          <button
            onClick={onToggleProfit}
            className={`px-3 py-2 border rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:scale-105 active:scale-95 transition-all duration-200 ${
              showProfit
                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.1)]"
                : "border-slate-200 dark:border-slate-800/80 bg-slate-100/50 dark:bg-slate-900/60 text-slate-700 dark:text-slate-200 hover:bg-slate-200/50 dark:hover:bg-slate-800/60"
            }`}
            aria-label={showProfit ? "Ẩn lợi nhuận" : "Hiện lợi nhuận"}
            title={showProfit ? "Ẩn lợi nhuận" : "Hiện lợi nhuận"}
          >
            {showProfit ? (
              <Eye className="w-3.5 h-3.5" />
            ) : (
              <EyeOff className="w-3.5 h-3.5" />
            )}
            {showProfit ? "Ẩn LN" : "Hiện LN"}
          </button>
        )}

        <button
          onClick={onOpenTemplates}
          className="px-3 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:scale-105 hover:shadow-[0_0_15px_rgba(168,85,247,0.25)] active:scale-95 transition-all duration-200"
          aria-label="Mở danh sách mẫu sửa chữa"
        >
          <FileText className="w-3.5 h-3.5" /> Mẫu SC
        </button>

        {canViewServiceHistory && (
          <Link
            to="/service-history"
            className="px-3 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:scale-105 hover:shadow-[0_0_15px_rgba(6,182,212,0.25)] active:scale-95 transition-all duration-200"
          >
            <History className="w-3.5 h-3.5" /> Lịch sử SC
          </Link>
        )}

        {canCreateWorkOrder && (
          <button
            onClick={onCreateWorkOrder}
            className="px-3 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 hover:scale-105 hover:shadow-[0_0_20px_rgba(59,130,246,0.3)] active:scale-95 transition-all duration-200"
            aria-label="Tạo phiếu sửa chữa mới"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Phiếu
          </button>
        )}
      </div>
    </div>
  );
};
