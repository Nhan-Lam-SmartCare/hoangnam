import React, { useState, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import {
  FileText,
  Wrench,
  Check,
  Key,
  TrendingUp,
  DollarSign,
  Search,
  Plus,
  Filter,
  Phone,
  Edit2,
  Trash2,
  Printer,
  ChevronRight,
  MoreVertical,
  Menu,
  Bell,
  Settings,
  History,
  ClipboardList,
  Package,
  Eye,
  EyeOff,
  X,
  MessageSquare,
} from "lucide-react";
import type { WorkOrder } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import { ServiceHistory } from "./ServiceHistory";
import { useRepairTemplates, type RepairTemplate } from "../../hooks/useRepairTemplatesRepository";

import { RepairTemplatesModal } from "./components/RepairTemplatesModal";
import { PullToRefresh } from "../common/PullToRefresh";
import Skeleton, { CardSkeleton } from "../common/Skeleton";

interface ServiceManagerMobileProps {
  workOrders: WorkOrder[];
  onCreateWorkOrder: () => void;
  onEditWorkOrder: (workOrder: WorkOrder) => void;
  onDeleteWorkOrder: (workOrder: WorkOrder) => void;
  onCallCustomer: (phone: string) => void;
  onPrintWorkOrder: (workOrder: WorkOrder) => void;
  onOpenTemplates: () => void;
  onApplyTemplate: (template: RepairTemplate) => void;
  currentBranchId: string;
  dateFilter: string;
  setDateFilter: (filter: string) => void;
  setDateRangeDays: (days: number) => void;
  isLoading?: boolean;
  onRefresh?: () => Promise<void>;
}

type StatusFilter =
  | "all"
  | "Tiếp nhận"
  | "Đang sửa"
  | "Đã sửa xong"
  | "Trả máy";

// Memoized WorkOrder Card Component
// Redesigned WorkOrder Card with inline quick actions
const WorkOrderCard = React.memo(({
  workOrder,
  onEdit,
  onCall,
  onPrint
}: {
  workOrder: WorkOrder;
  onEdit: (wo: WorkOrder) => void;
  onCall: (phone: string) => void;
  onPrint: (wo: WorkOrder) => void;
}) => {
  // Get status details
  const getStatusColor = (status: string) => {
    switch (status) {
      case "Tiếp nhận": return "bg-blue-50 text-blue-600 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      case "Đang sửa": return "bg-orange-50 text-orange-600 border-orange-200 dark:bg-orange-900/20 dark:text-orange-400 dark:border-orange-800";
      case "Đã sửa xong": return "bg-green-50 text-green-600 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800";
      case "Trả máy": return "bg-purple-50 text-purple-600 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800";
      default: return "bg-slate-50 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700";
    }
  };

  return (
    <div
      onClick={() => onEdit(workOrder)}
      className="bg-white dark:bg-[#1e1e2d] rounded-xl border border-slate-200 dark:border-gray-800 shadow-sm active:scale-[0.99] transition-transform relative overflow-hidden"
    >
      <div className="p-3 space-y-2">
        {/* Header: ID & Date & Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-mono font-bold text-blue-600 dark:text-blue-400 text-xs bg-blue-50 dark:bg-blue-900/20 px-1.5 py-0.5 rounded">
              {formatWorkOrderId(workOrder.id)}
            </span>
            <span className="text-[10px] text-slate-500">{formatDate(workOrder.creationDate)}</span>
          </div>
          <div className={`text-[10px] font-bold px-2 py-0.5 rounded border ${getStatusColor(workOrder.status)}`}>
            {workOrder.status}
          </div>
        </div>

        {/* Customer & Device */}
        <div className="flex justify-between items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="font-bold text-sm text-slate-900 dark:text-white truncate">
              {workOrder.customerName}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
              <Phone className="w-3 h-3" />
              {workOrder.customerPhone}
            </div>
          </div>
          <div className="text-right min-w-0 flex-1">
            <div className="font-medium text-sm text-slate-800 dark:text-slate-200 truncate">
              {workOrder.vehicleModel}
            </div>
            <div className="text-xs text-slate-500 font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded inline-block">
              {workOrder.licensePlate}
            </div>
          </div>
        </div>

        {/* Issue (if any) */}
        {workOrder.issueDescription && (
          <div className="text-xs text-slate-500 italic truncate border-t border-dashed border-slate-100 dark:border-slate-800 pt-1 mt-1">
            "{workOrder.issueDescription}"
          </div>
        )}

        {/* Footer: Tech & Money & Quick Actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 mt-1">
          <div className="flex items-center gap-1.5">
            <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-600 dark:text-slate-300">
              {workOrder.technicianName?.[0] || "?"}
            </div>
            <span className="text-xs text-slate-600 dark:text-slate-400 max-w-[60px] truncate">
              {workOrder.technicianName || "Chưa phân"}
            </span>
          </div>

          {/* Inline Quick Actions */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onCall(workOrder.customerPhone || "");
              }}
              className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600 hover:bg-green-100 dark:hover:bg-green-900/40 transition-colors active:scale-95"
              title="Gọi điện"
            >
              <Phone className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onPrint(workOrder);
              }}
              className="w-7 h-7 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors active:scale-95"
              title="In phiếu"
            >
              <Printer className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex flex-col items-end">
            <span className="font-black text-sm text-blue-600 dark:text-blue-400">
              {formatCurrency(workOrder.total || 0)}
            </span>
            {/* Payment Status Indicator */}
            {workOrder.paymentStatus === "paid" && (
              <span className="text-[9px] text-green-500 font-bold flex items-center gap-0.5">
                <Check className="w-2.5 h-2.5" /> Đã trả
              </span>
            )}
            {workOrder.paymentStatus !== "paid" && (workOrder.remainingAmount || 0) > 0 && (
              <span className="text-[9px] text-red-500 font-bold">
                Nợ {formatCurrency(workOrder.remainingAmount || 0)}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});


// Action Drawer Component
const WorkOrderActionDrawer = ({
  isOpen,
  onClose,
  workOrder,
  onEdit,
  onCall,
  onPrint,
  onDelete,
  canDelete
}: {
  isOpen: boolean;
  onClose: () => void;
  workOrder: WorkOrder | null;
  onEdit: (wo: WorkOrder) => void;
  onCall: (phone: string) => void;
  onPrint: (wo: WorkOrder) => void;
  onDelete: (wo: WorkOrder) => void;
  canDelete: boolean;
}) => {
  if (!isOpen || !workOrder) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-end justify-center sm:items-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" onClick={onClose} />

      <div className="bg-white dark:bg-[#1e1e2d] w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-4 z-10 animate-slide-up space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="w-10 h-10 rounded-full bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h3 className="font-bold text-slate-900 dark:text-white">
              {workOrder.customerName}
            </h3>
            <div className="text-xs text-slate-500 flex items-center gap-2">
              <span className="font-mono">{formatWorkOrderId(workOrder.id)}</span>
              <span>•</span>
              <span>{workOrder.vehicleModel}</span>
            </div>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 dark:bg-slate-800 rounded-full">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Primary Actions Grid */}
        <div className="grid grid-cols-4 gap-3">
          <button onClick={() => { onCall(workOrder.customerPhone || ""); onClose(); }} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center text-green-600">
              <Phone className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Gọi điện</span>
          </button>
          <button onClick={() => { onEdit(workOrder); onClose(); }} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center text-blue-600">
              <Edit2 className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Sửa phiếu</span>
          </button>
          <button onClick={() => { onPrint(workOrder); onClose(); }} className="flex flex-col items-center gap-2">
            <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center text-purple-600">
              <Printer className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">In phiếu</span>
          </button>
          {/* Placeholder for more actions like SMS */}
          <button className="flex flex-col items-center gap-2 opacity-50">
            <div className="w-12 h-12 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500">
              <MessageSquare className="w-6 h-6" />
            </div>
            <span className="text-xs font-medium">Nhắn tin</span>
          </button>
        </div>

        {/* Secondary Actions List */}
        <div className="space-y-1 pt-2">
          {canDelete && (
            <button
              onClick={() => { onDelete(workOrder); onClose(); }}
              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/10 text-red-600 transition-colors"
            >
              <Trash2 className="w-5 h-5" />
              <span className="font-medium">Xóa phiếu sửa chữa này</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export function ServiceManagerMobile({
  workOrders,
  onCreateWorkOrder,
  onEditWorkOrder,
  onDeleteWorkOrder,
  onCallCustomer,
  onPrintWorkOrder,
  onOpenTemplates,
  onApplyTemplate,
  currentBranchId,
  dateFilter,
  setDateFilter,

  setDateRangeDays,
  isLoading = false,
  onRefresh,
}: ServiceManagerMobileProps) {
  const { profile } = useAuth();
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showFilterPopup, setShowFilterPopup] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [activeTab, setActiveTab] = useState<"orders" | "history" | "templates">("orders");
  const [showWarrantyModal, setShowWarrantyModal] = useState(false);

  // Financial data visibility state (owner-only feature)
  const [showFinancials, setShowFinancials] = useState(false);
  const isOwner = profile?.role === "owner";

  // Date filter state
  const [showDateFilter, setShowDateFilter] = useState(false);
  const [customDateStart, setCustomDateStart] = useState("");
  const [customDateEnd, setCustomDateEnd] = useState("");

  // Templates data
  const { data: templates } = useRepairTemplates();
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [actionOrder, setActionOrder] = useState<WorkOrder | null>(null);

  // Debounced create work order handler to prevent duplicate creation
  const handleCreateWorkOrder = useCallback(() => {
    if (isCreating) return;

    setIsCreating(true);
    onCreateWorkOrder();

    // Reset after 2 seconds to allow new creation
    setTimeout(() => {
      setIsCreating(false);
    }, 2000);
  }, [isCreating, onCreateWorkOrder]);

  // Filter work orders by date first
  const dateFilteredWorkOrders = useMemo(() => {
    const NOW = new Date();
    const startOfToday = new Date(NOW.getFullYear(), NOW.getMonth(), NOW.getDate());

    return workOrders.filter(w => {
      if (!w.creationDate) return false;
      const date = new Date(w.creationDate);

      switch (dateFilter) {
        case "today":
          return date >= startOfToday;
        case "week": {
          const sevenDaysAgo = new Date(NOW);
          sevenDaysAgo.setDate(NOW.getDate() - 7);
          return date >= sevenDaysAgo;
        }
        case "month": {
          const thirtyDaysAgo = new Date(NOW);
          thirtyDaysAgo.setDate(NOW.getDate() - 30);
          return date >= thirtyDaysAgo;
        }
        case "all":
        default:
          return true;
      }
    });
  }, [workOrders, dateFilter]);

  // Optimized KPI Calculation - Single pass
  const kpis = useMemo(() => {
    let tiepNhan = 0;
    let dangSua = 0;
    let daHoanThanh = 0;
    let traMay = 0;
    let doanhThu = 0;
    let loiNhuan = 0;

    dateFilteredWorkOrders.forEach(w => {
      // Count status
      switch (w.status) {
        case "Tiếp nhận": tiepNhan++; break;
        case "Đang sửa": dangSua++; break;
        case "Đã sửa xong": daHoanThanh++; break;
        case "Trả máy": traMay++; break;
      }

      // Calculate Revenue & Profit for paid orders
      if (w.paymentStatus === "paid" || (w.paymentStatus === "partial" && (w.totalPaid || 0) > 0)) {
        // Fix: Use totalPaid for partial payments, total for fully paid
        // Actually for revenue typically we want realized revenue (cash in)
        // But the previous code used w.total. Let's stick to w.total for consistency with desktop 
        // if desktop uses total. But wait, previous mobile code used w.total ONLY if paid.
        // Let's stick to previous logic: only count if "paid".
        // MODIFY: Also count if partial? The user screenshot shows "paid" icon.

        // Reverting to previous logic strictly but ensuring we use the date filtered list
        if (w.paymentStatus === "paid") {
          const total = w.total || 0;
          doanhThu += total;

          // Calculate costs
          const partsCost = w.partsUsed?.reduce(
            (s, p) => s + (p.costPrice || 0) * (p.quantity || 1),
            0
          ) || 0;

          const servicesCost = w.additionalServices?.reduce(
            (s, svc) => s + (svc.costPrice || 0) * (svc.quantity || 1),
            0
          ) || 0;

          loiNhuan += (total - partsCost - servicesCost);
        }
      }
    });

    return { tiepNhan, dangSua, daHoanThanh, traMay, doanhThu, loiNhuan };
  }, [dateFilteredWorkOrders]);

  // Get date label
  const getDateLabel = () => {
    switch (dateFilter) {
      case "today":
        return "hôm nay";
      case "week":
        return "7 ngày qua";
      case "month":
        return "tháng này";
      case "all":
        return "tất cả";
      default:
        return "";
    }
  };

  // Filter work orders
  const filteredWorkOrders = useMemo(() => {
    let filtered = dateFilteredWorkOrders;

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((w) => w.status === statusFilter);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (w) =>
          w.customerName?.toLowerCase().includes(query) ||
          w.customerPhone?.toLowerCase().includes(query) ||
          w.licensePlate?.toLowerCase().includes(query) ||
          w.id?.toLowerCase().includes(query)
      );
    }

    return filtered.sort((a, b) => {
      const dateA = new Date(a.creationDate || 0).getTime();
      const dateB = new Date(b.creationDate || 0).getTime();
      return dateB - dateA;
    });
  }, [dateFilteredWorkOrders, statusFilter, searchQuery]);

  const canDeleteWorkOrder = canDo(profile?.role, "work_order.delete");

  return (
    <div className="md:hidden flex flex-col h-screen bg-slate-50 dark:bg-[#151521]">
      {/* SEARCH BAR & TAB NAVIGATION - Always visible */}
      <div className="bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-gray-800 px-2 py-2 space-y-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Tìm tên, SĐT, IMEI..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-3 py-2.5 bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700 rounded-xl text-slate-900 dark:text-white placeholder-slate-500 dark:placeholder-gray-500 text-sm focus:outline-none focus:border-[#009ef7]"
          />
        </div>

        {/* Segmented Control for Mode: Orders | History | Templates */}
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          <button onClick={() => setActiveTab('orders')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'orders' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
            Phiếu SC
          </button>
          <button onClick={() => setActiveTab('history')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'history' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
            Lịch sử
          </button>
          <button onClick={() => setActiveTab('templates')} className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${activeTab === 'templates' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-400' : 'text-slate-500'}`}>
            Mẫu SC
          </button>
        </div>
      </div>

      {/* CONTENT BASED ON TAB */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "orders" && (
          <>
            <PullToRefresh onRefresh={onRefresh || (async () => { })}>
              <div className="pb-24">
                {/* KPI CARDS */}
                <div className="bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-gray-800 p-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {/* Tiếp nhận */}
                    <button
                      onClick={() =>
                        setStatusFilter(
                          statusFilter === "Tiếp nhận" ? "all" : "Tiếp nhận"
                        )
                      }
                      className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Tiếp nhận"
                        ? "bg-gradient-to-br from-[#009ef7]/20 to-[#009ef7]/10 border-2 border-[#009ef7]"
                        : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                        }`}
                    >
                      <FileText className="w-4 h-4 text-[#009ef7] mx-auto mb-0.5" />
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{kpis.tiepNhan}</div>
                      <span className="text-[8px] text-slate-600 dark:text-gray-400">Tiếp nhận</span>
                    </button>

                    {/* Đang sửa */}
                    <button
                      onClick={() =>
                        setStatusFilter(statusFilter === "Đang sửa" ? "all" : "Đang sửa")
                      }
                      className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Đang sửa"
                        ? "bg-gradient-to-br from-[#f1416c]/20 to-[#f1416c]/10 border-2 border-[#f1416c]"
                        : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                        }`}
                    >
                      <Wrench className="w-4 h-4 text-[#f1416c] mx-auto mb-0.5" />
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{kpis.dangSua}</div>
                      <span className="text-[8px] text-slate-600 dark:text-gray-400">Đang sửa</span>
                    </button>

                    {/* Đã sửa xong */}
                    <button
                      onClick={() =>
                        setStatusFilter(
                          statusFilter === "Đã sửa xong" ? "all" : "Đã sửa xong"
                        )
                      }
                      className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Đã sửa xong"
                        ? "bg-gradient-to-br from-[#50cd89]/20 to-[#50cd89]/10 border-2 border-[#50cd89]"
                        : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                        }`}
                    >
                      <Check className="w-4 h-4 text-[#50cd89] mx-auto mb-0.5" />
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {kpis.daHoanThanh}
                      </div>
                      <span className="text-[8px] text-slate-600 dark:text-gray-400">Đã sửa</span>
                    </button>

                    {/* Trả máy */}
                    <button
                      onClick={() =>
                        setStatusFilter(statusFilter === "Trả máy" ? "all" : "Trả máy")
                      }
                      className={`p-2 rounded-lg text-center transition-all ${statusFilter === "Trả máy"
                        ? "bg-gradient-to-br from-purple-500/20 to-purple-500/10 border-2 border-purple-500"
                        : "bg-slate-100 dark:bg-[#2b2b40] border border-slate-300 dark:border-gray-700"
                        }`}
                    >
                      <Key className="w-4 h-4 text-purple-500 mx-auto mb-0.5" />
                      <div className="text-lg font-bold text-slate-900 dark:text-white">{kpis.traMay}</div>
                      <span className="text-[8px] text-slate-600 dark:text-gray-400">Trả máy</span>
                    </button>
                  </div>

                  {/* Doanh thu & Lợi nhuận */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 dark:from-emerald-600 dark:to-emerald-700 shadow-lg shadow-emerald-500/20 text-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-emerald-50 opacity-90">
                          Doanh thu {getDateLabel()}
                        </span>
                        <div className="flex items-center gap-1">
                          {isOwner && (
                            <button
                              onClick={() => setShowFinancials(!showFinancials)}
                              className="p-1 hover:bg-white/20 rounded transition-colors"
                              aria-label="Toggle revenue visibility"
                            >
                              {showFinancials ? (
                                <Eye className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-white" />
                              )}
                            </button>
                          )}
                          <DollarSign className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="text-base font-black text-white">
                        {showFinancials ? formatCurrency(kpis.doanhThu) : "•••••••"}
                      </div>
                    </div>
                    <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 shadow-lg shadow-blue-500/20 text-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-bold text-blue-50 opacity-90">
                          Lợi nhuận {getDateLabel()}
                        </span>
                        <div className="flex items-center gap-1">
                          {isOwner && (
                            <button
                              onClick={() => setShowFinancials(!showFinancials)}
                              className="p-1 hover:bg-white/20 rounded transition-colors"
                              aria-label="Toggle profit visibility"
                            >
                              {showFinancials ? (
                                <Eye className="w-3.5 h-3.5 text-white" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5 text-white" />
                              )}
                            </button>
                          )}
                          <TrendingUp className="w-4 h-4 text-white" />
                        </div>
                      </div>
                      <div className="text-base font-black text-white">
                        {showFinancials ? formatCurrency(kpis.loiNhuan) : "•••••••"}
                      </div>
                    </div>
                  </div>
                </div>

                {/* DATE FILTER - Only for Orders tab */}
                <div className="bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-gray-800 px-2 py-2">
                  <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide pb-1">
                    {[
                      { label: "Hôm nay", value: "today" },
                      { label: "7 ngày", value: "week" },
                      { label: "Tháng", value: "month" },
                      { label: "Tất cả", value: "all" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setDateFilter(option.value)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${dateFilter === option.value
                          ? "bg-[#009ef7]/20 text-[#009ef7] border border-[#009ef7]/50"
                          : "bg-slate-100 dark:bg-[#2b2b40] text-slate-700 dark:text-gray-400 border border-slate-300 dark:border-gray-700"
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DANH SÁCH PHIẾU SỬA CHỮA */}
                <div className="space-y-2 px-2 pb-4 min-h-[50vh]">
                  {isLoading ? (
                    // Loading Skeletons using shared Skeleton component
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={i} className="bg-white dark:bg-[#1e1e2d] rounded-lg border border-slate-200 dark:border-gray-800 p-4 space-y-3">
                        <div className="flex justify-between items-start mb-2">
                          <div className="flex gap-2">
                            <Skeleton width={60} height={20} className="bg-slate-700/50" />
                            <Skeleton width={80} height={20} className="bg-slate-700/50" />
                          </div>
                          <Skeleton width={70} height={24} className="rounded-full bg-slate-700/50" />
                        </div>
                        <div className="space-y-2 mb-3">
                          <div className="flex items-center gap-2">
                            <Skeleton variant="circle" width={16} height={16} className="bg-slate-700/50" />
                            <Skeleton width="60%" height={16} className="bg-slate-300 dark:bg-slate-700/50" />
                          </div>
                          <div className="flex items-center gap-2">
                            <Skeleton variant="circle" width={16} height={16} className="bg-slate-700/50" />
                            <Skeleton width="40%" height={16} className="bg-slate-700/50" />
                          </div>
                        </div>
                        <div className="flex justify-between pt-3 border-t border-slate-200 dark:border-gray-800 items-end">
                          <div className="flex gap-2">
                            <Skeleton width={24} height={24} className="rounded-md bg-slate-700/50" />
                            <Skeleton width={24} height={24} className="rounded-md bg-slate-700/50" />
                          </div>
                          <Skeleton width={90} height={20} className="bg-slate-700/50" />
                        </div>
                      </div>
                    ))
                  ) : filteredWorkOrders.length === 0 ? (
                    /* Empty State */
                    <div className="flex flex-col items-center justify-center h-full text-center px-6 py-12">
                      <div className="w-32 h-32 mb-6 flex items-center justify-center">
                        <svg
                          className="w-full h-full text-gray-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={1.5}
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      </div>
                      <h3 className="text-xl font-semibold text-slate-700 dark:text-gray-300 mb-2">
                        Chưa có phiếu sửa chữa nào!
                      </h3>
                      <p className="text-slate-600 dark:text-gray-500 mb-6">
                        Hãy tạo phiếu đầu tiên để quản lý dịch vụ sửa chữa
                      </p>
                      <button
                        onClick={handleCreateWorkOrder}
                        disabled={isCreating}
                        className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + Tạo phiếu mới
                      </button>
                    </div>
                  ) : (
                    filteredWorkOrders.map((workOrder) => (
                      <WorkOrderCard
                        key={workOrder.id}
                        workOrder={workOrder}
                        onEdit={onEditWorkOrder}
                        onCall={onCallCustomer}
                        onPrint={onPrintWorkOrder}
                      />
                    ))
                  )}
                </div>
              </div>
            </PullToRefresh>

            {/* FAB (Floating Action Button) */}
            <button
              onClick={handleCreateWorkOrder}
              disabled={isCreating}
              className="fixed bottom-20 right-4 w-12 h-12 bg-gradient-to-br from-[#009ef7] to-[#0077b6] rounded-full shadow-xl shadow-[#009ef7]/50 flex items-center justify-center hover:from-[#0077b6] hover:to-[#005a8a] transition-all z-[60] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Tạo phiếu mới"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          <div className="h-full overflow-y-auto pb-24 scrollbar-hide">
            <ServiceHistory currentBranchId={currentBranchId} />
          </div>
        )}

        {/* TEMPLATES TAB */}
        {activeTab === "templates" && (
          <div className="h-full overflow-y-auto pb-24 scrollbar-hide p-3">
            <div className="space-y-3">
              {templates?.map((template) => (
                <div
                  key={template.id}
                  className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 border border-slate-200 dark:border-gray-800 active:bg-slate-50 dark:active:bg-[#2b2b40] transition-colors cursor-pointer"
                  onClick={() => onApplyTemplate(template)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <h3 className="font-bold text-slate-900 dark:text-white">{template.name}</h3>
                      <p className="text-xs text-slate-600 dark:text-gray-500 mt-1">
                        {template.description}
                      </p>
                    </div>
                    <span className="text-[#009ef7] font-bold">
                      {formatCurrency(
                        template.labor_cost +
                        (template.parts?.reduce(
                          (s: number, p: any) => s + p.price * p.quantity,
                          0
                        ) || 0)
                      )}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-slate-600 dark:text-gray-400 mt-3 pt-3 border-t border-slate-200 dark:border-gray-800">
                    <div className="flex items-center gap-1">
                      <Wrench className="w-3.5 h-3.5" />
                      {template.duration} phút
                    </div>
                    <div className="flex items-center gap-1">
                      <Package className="w-3.5 h-3.5" />
                      {template.parts?.length || 0} phụ tùng
                    </div>
                  </div>
                </div>
              ))}

              {(!templates || templates.length === 0) && (
                <div className="text-center py-10 text-slate-600 dark:text-gray-500">
                  Chưa có mẫu sửa chữa nào
                </div>
              )}
            </div>

            {/* FAB for Templates */}
            <button
              onClick={() => {
                // Open template modal for creating
                // Since we don't have direct access to open the modal in create mode easily without prop drilling or state lift, 
                // we can use the existing onOpenTemplates which opens the modal in ServiceManager.
                // Ideally we should refactor to handle it here, but for now:
                onOpenTemplates();
              }}
              className="fixed bottom-20 right-4 w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-700 rounded-full shadow-xl shadow-purple-500/50 flex items-center justify-center hover:from-purple-600 hover:to-purple-800 transition-all z-[60] active:scale-95"
            >
              <Plus className="w-5 h-5 text-white" />
            </button>
          </div>
        )}

        {/* Filter Popup (Optional) */}
        {showFilterPopup && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-end md:items-center md:justify-center">
            <div className="bg-white dark:bg-[#1e1e2d] rounded-t-3xl md:rounded-2xl w-full md:max-w-md p-6 space-y-4 animate-slide-up">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Bộ lọc nâng cao
                </h3>
                <button
                  onClick={() => setShowFilterPopup(false)}
                  className="text-slate-600 dark:text-gray-500 hover:text-slate-900 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>
              {/* Add more filter options here */}
              <div className="text-slate-600 dark:text-gray-400 text-sm text-center py-8">
                Các tùy chọn lọc sẽ được bổ sung...
              </div>
            </div>
          </div>
        )}

        <style>{`
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
      </div>
    </div>
  );
}
