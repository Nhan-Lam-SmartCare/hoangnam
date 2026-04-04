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
import { ServiceHistory } from "./ServiceHistory";
import { useRepairTemplates, type RepairTemplate } from "../../hooks/useRepairTemplatesRepository";

import { RepairTemplatesModal } from "./components/RepairTemplatesModal";
import { PullToRefresh } from "../common/PullToRefresh";
import Skeleton, { CardSkeleton } from "../common/Skeleton";

interface ServiceManagerMobileProps {
  workOrders: WorkOrder[];
  canCreateWorkOrder?: boolean;
  canUpdateWorkOrder?: boolean;
  canDeleteWorkOrder?: boolean;
  canPrintWorkOrder?: boolean;
  canViewServiceHistory?: boolean;
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
  onPrint,
  onDelete,
  canEdit,
  canPrint,
  canDelete,
}: {
  workOrder: WorkOrder;
  onEdit: (wo: WorkOrder) => void;
  onCall: (phone: string) => void;
  onPrint: (wo: WorkOrder) => void;
  onDelete: (wo: WorkOrder) => void;
  canEdit: boolean;
  canPrint: boolean;
  canDelete: boolean;
}) => {
  const getStatusMeta = (status: string) => {
    switch (status) {
      case "Tiếp nhận":
        return {
          className: "border-blue-500/35 bg-blue-500/10 text-blue-300",
          icon: <FileText className="w-3.5 h-3.5" />,
        };
      case "Đang sửa":
        return {
          className: "border-pink-500/35 bg-pink-500/10 text-pink-300",
          icon: <Wrench className="w-3.5 h-3.5" />,
        };
      case "Đã sửa xong":
        return {
          className: "border-emerald-500/35 bg-emerald-500/10 text-emerald-300",
          icon: <Check className="w-3.5 h-3.5" />,
        };
      case "Trả máy":
        return {
          className: "border-violet-500/35 bg-violet-500/10 text-violet-300",
          icon: <Key className="w-3.5 h-3.5" />,
        };
      default:
        return {
          className: "border-slate-500/35 bg-slate-500/10 text-slate-300",
          icon: <FileText className="w-3.5 h-3.5" />,
        };
    }
  };

  const statusMeta = getStatusMeta(workOrder.status);
  const isPaid = workOrder.paymentStatus === "paid";
  const remainingAmount = Number(
    workOrder.remainingAmount ??
      Math.max((workOrder.total || 0) - Number(workOrder.totalPaid || 0), 0)
  );
  const hasDebt = !isPaid && remainingAmount > 0;
  const repairSummary =
    workOrder.issueDescription?.trim() ||
    workOrder.repairServices?.[0]?.serviceName?.trim() ||
    workOrder.additionalServices?.[0]?.description?.trim() ||
    "Chưa ghi mô tả lỗi";

  return (
    <div className="overflow-hidden rounded-xl border border-[#254a8e]/45 bg-[#161922] shadow-[0_6px_16px_rgba(0,0,0,0.22)]">
      <div className="p-2.5 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[12px] tracking-wide text-slate-200">
                {formatWorkOrderId(workOrder.id)}
              </span>
              <span className="text-[11px] text-slate-500">
                {formatDate(workOrder.creationDate)}
              </span>
            </div>
          </div>

          <div className={`inline-flex items-center gap-1 rounded-lg border px-2 py-0.5 text-[11px] font-semibold ${statusMeta.className}`}>
            {statusMeta.icon}
            <span>{workOrder.status}</span>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
          <div className="min-w-0 space-y-1">
            <div className="text-[12px] font-semibold text-slate-100 truncate">
              {workOrder.customerName || "Khách lẻ"}
            </div>
            <div className="text-[11px] text-slate-400 truncate">{workOrder.vehicleModel || "--"}</div>
            <div className="text-[11px] text-slate-300/90 truncate">
              Sửa: {repairSummary}
            </div>
          </div>
          <div className="text-right min-w-0">
            <div className="text-[11px] font-medium text-slate-300">{workOrder.customerPhone || "--"}</div>
            <div className="text-[11px] font-mono text-slate-500 mt-0.5">{workOrder.licensePlate || "--"}</div>
          </div>
        </div>

        <div className="h-px bg-[#273348]" />

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] text-slate-400">KTV:</span>
            <span className="text-[11px] font-semibold text-slate-200 truncate max-w-[110px]">
              {workOrder.technicianName || "Chưa phân"}
            </span>
            {isPaid && (
              <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/15 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-300">
                <Check className="w-3 h-3" />Đủ
              </span>
            )}
          </div>

          <div className="text-right">
            {hasDebt ? (
              <>
                <div className="text-[16px] leading-none font-bold text-red-400">
                  Nợ {formatCurrency(remainingAmount)}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">
                  Tổng: {formatCurrency(workOrder.total || 0)}
                </div>
              </>
            ) : (
              <div className="text-[16px] leading-none font-bold text-emerald-300">
                {formatCurrency(workOrder.total || 0)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-4 border-t border-[#273348]">
        <button
          onClick={() => onCall(workOrder.customerPhone || "")}
          className="h-10 flex items-center justify-center gap-1 text-slate-300 border-r border-[#273348] active:bg-slate-800/50"
          title="Gọi"
        >
          <Phone className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Gọi</span>
        </button>
        <button
          onClick={() => onPrint(workOrder)}
          disabled={!canPrint}
          className="h-10 flex items-center justify-center gap-1 text-slate-300 border-r border-[#273348] active:bg-slate-800/50 disabled:text-slate-600"
          title={canPrint ? "In" : "Không có quyền in"}
        >
          <Printer className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">In</span>
        </button>
        <button
          onClick={() => onEdit(workOrder)}
          disabled={!canEdit}
          className="h-10 flex items-center justify-center gap-1 text-slate-300 border-r border-[#273348] active:bg-slate-800/50 disabled:text-slate-600"
          title={canEdit ? "Sửa" : "Không có quyền sửa"}
        >
          <Edit2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Sửa</span>
        </button>
        <button
          onClick={() => onDelete(workOrder)}
          disabled={!canDelete}
          className="h-10 flex items-center justify-center gap-1 text-pink-400 disabled:text-slate-600 active:bg-slate-800/50"
          title={canDelete ? "Xóa" : "Không có quyền xóa"}
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="text-[11px] font-medium">Xóa</span>
        </button>
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
  canCreateWorkOrder = true,
  canUpdateWorkOrder = true,
  canDeleteWorkOrder = true,
  canPrintWorkOrder = true,
  canViewServiceHistory = true,
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
    if (!canCreateWorkOrder) return;
    if (isCreating) return;

    setIsCreating(true);
    onCreateWorkOrder();

    // Reset after 2 seconds to allow new creation
    setTimeout(() => {
      setIsCreating(false);
    }, 2000);
  }, [canCreateWorkOrder, isCreating, onCreateWorkOrder]);

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

      // Realized revenue/profit: include paid and partial orders with collected amount.
      if (w.paymentStatus === "paid" || (w.paymentStatus === "partial" && (w.totalPaid || 0) > 0)) {
        const recognizedRevenue = Number(
          w.paymentStatus === "paid" ? (w.total || 0) : (w.totalPaid || 0)
        );
        doanhThu += recognizedRevenue;

        // Estimate recognized cost proportionally for partial collection.
        const total = Number(w.total || 0);
        const recognitionRatio = total > 0 ? Math.min(1, recognizedRevenue / total) : 0;

        const partsCost = w.partsUsed?.reduce(
          (s, p) => s + (p.costPrice || 0) * (p.quantity || 1),
          0
        ) || 0;

        const servicesCost = w.additionalServices?.reduce(
          (s, svc) => s + (svc.costPrice || 0) * (svc.quantity || 1),
          0
        ) || 0;

        const recognizedCost = (partsCost + servicesCost) * recognitionRatio;
        loiNhuan += recognizedRevenue - recognizedCost;
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

  return (
    <div className="md:hidden flex flex-col h-[100dvh] bg-[#0f131b]">
      {/* SEARCH BAR & TAB NAVIGATION - Always visible */}
      <div className="border-b border-[#22304a] bg-[#111624] px-2 py-2">
        <div className="grid grid-cols-3 gap-2">
          <button onClick={() => setActiveTab('orders')} className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all border ${activeTab === 'orders' ? 'bg-[#193a63] text-[#5cb3ff] border-[#2f6ea8]' : 'bg-transparent text-slate-400 border-[#27364e]'}`}>
            Phiếu SC
          </button>
          {canViewServiceHistory ? (
            <button onClick={() => setActiveTab('history')} className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all border ${activeTab === 'history' ? 'bg-[#193a63] text-[#5cb3ff] border-[#2f6ea8]' : 'bg-transparent text-slate-400 border-[#27364e]'}`}>
              Lịch sử
            </button>
          ) : (
            <button disabled className="py-1.5 text-[11px] font-semibold rounded-lg transition-all border bg-transparent text-slate-600 border-[#27364e] opacity-60">
              Lịch sử
            </button>
          )}
          <button onClick={() => setActiveTab('templates')} className={`py-1.5 text-[11px] font-semibold rounded-lg transition-all border ${activeTab === 'templates' ? 'bg-[#193a63] text-[#5cb3ff] border-[#2f6ea8]' : 'bg-transparent text-slate-400 border-[#27364e]'}`}>
            Mẫu SC
          </button>
        </div>
      </div>

      {/* CONTENT BASED ON TAB */}
      <div className="flex-1 overflow-hidden relative">
        {activeTab === "orders" && (
          <>
            <PullToRefresh onRefresh={onRefresh || (async () => { })}>
              <div className="pb-20">
                {/* KPI CARDS */}
                <div className="border-b border-[#22304a] bg-[#111624] px-2 py-2">
                  <div className="grid grid-cols-4 gap-2">
                    {/* Tiếp nhận */}
                    <button
                      onClick={() =>
                        setStatusFilter(
                          statusFilter === "Tiếp nhận" ? "all" : "Tiếp nhận"
                        )
                      }
                        className={`rounded-xl border px-1 py-2 text-center transition-all ${statusFilter === "Tiếp nhận"
                        ? "bg-[#16365d] border-[#2f6ea8]"
                        : "bg-[#171e2d] border-[#27364e]"
                        }`}
                    >
                      <FileText className="w-3.5 h-3.5 text-[#54b3ff] mx-auto mb-0.5" />
                      <div className="text-xl leading-none font-bold text-slate-100">{kpis.tiepNhan}</div>
                      <span className="text-[11px] text-slate-400">Tiếp nhận</span>
                    </button>

                    {/* Đang sửa */}
                    <button
                      onClick={() =>
                        setStatusFilter(statusFilter === "Đang sửa" ? "all" : "Đang sửa")
                      }
                        className={`rounded-xl border px-1 py-2 text-center transition-all ${statusFilter === "Đang sửa"
                        ? "bg-[#442131] border-[#8d3a5c]"
                        : "bg-[#171e2d] border-[#27364e]"
                        }`}
                    >
                      <Wrench className="w-3.5 h-3.5 text-[#ff6e9f] mx-auto mb-0.5" />
                      <div className="text-xl leading-none font-bold text-slate-100">{kpis.dangSua}</div>
                      <span className="text-[11px] text-slate-400">Đang sửa</span>
                    </button>

                    {/* Đã sửa xong */}
                    <button
                      onClick={() =>
                        setStatusFilter(
                          statusFilter === "Đã sửa xong" ? "all" : "Đã sửa xong"
                        )
                      }
                        className={`rounded-xl border px-1 py-2 text-center transition-all ${statusFilter === "Đã sửa xong"
                        ? "bg-[#153b32] border-[#2f7f6b]"
                        : "bg-[#171e2d] border-[#27364e]"
                        }`}
                    >
                      <Check className="w-3.5 h-3.5 text-[#7ce0bf] mx-auto mb-0.5" />
                      <div className="text-xl leading-none font-bold text-slate-100">
                        {kpis.daHoanThanh}
                      </div>
                      <span className="text-[11px] text-slate-400">Đã sửa</span>
                    </button>

                    {/* Trả máy */}
                    <button
                      onClick={() =>
                        setStatusFilter(statusFilter === "Trả máy" ? "all" : "Trả máy")
                      }
                        className={`rounded-xl border px-1 py-2 text-center transition-all ${statusFilter === "Trả máy"
                        ? "bg-[#2f1f4a] border-[#6650a4]"
                        : "bg-[#171e2d] border-[#27364e]"
                        }`}
                    >
                      <Key className="w-3.5 h-3.5 text-[#9d72ff] mx-auto mb-0.5" />
                      <div className="text-xl leading-none font-bold text-slate-100">{kpis.traMay}</div>
                      <span className="text-[11px] text-slate-400">Trả máy</span>
                    </button>
                  </div>

                  {/* Doanh thu & Lợi nhuận */}
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="relative overflow-hidden rounded-xl border border-[#27364e] bg-[#171b2a] p-2.5 text-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300">
                          Doanh thu {getDateLabel()}
                        </span>
                        <div className="flex items-center gap-1 text-[#79dfbe]">
                          {isOwner && (
                            <button
                              onClick={() => setShowFinancials(!showFinancials)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              aria-label="Toggle revenue visibility"
                            >
                              {showFinancials ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <DollarSign className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-sm font-black text-emerald-300">
                        {showFinancials ? formatCurrency(kpis.doanhThu) : "•••••••"}
                      </div>
                    </div>
                    <div className="relative overflow-hidden rounded-xl border border-[#27364e] bg-[#171b2a] p-2.5 text-white">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-300">
                          Lợi nhuận {getDateLabel()}
                        </span>
                        <div className="flex items-center gap-1 text-[#66bbff]">
                          {isOwner && (
                            <button
                              onClick={() => setShowFinancials(!showFinancials)}
                              className="p-1 hover:bg-white/10 rounded transition-colors"
                              aria-label="Toggle profit visibility"
                            >
                              {showFinancials ? (
                                <Eye className="w-3.5 h-3.5" />
                              ) : (
                                <EyeOff className="w-3.5 h-3.5" />
                              )}
                            </button>
                          )}
                          <TrendingUp className="w-4 h-4" />
                        </div>
                      </div>
                      <div className="text-sm font-black text-blue-300">
                        {showFinancials ? formatCurrency(kpis.loiNhuan) : "•••••••"}
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      placeholder="Tìm tên, SĐT, biển số, dòng xe..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full h-10 pl-9 pr-3 rounded-xl border border-[#334968] bg-[#141a28] text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-[#4a8bd1]"
                    />
                  </div>
                </div>

                {/* DATE FILTER - Only for Orders tab */}
                <div className="border-b border-[#22304a] bg-[#111624] px-2 py-2">
                  <div className="grid grid-cols-4 gap-2">
                    {[
                      { label: "Hôm nay", value: "today" },
                      { label: "7 ngày", value: "week" },
                      { label: "Tháng này", value: "month" },
                      { label: "Tất cả", value: "all" },
                    ].map((option) => (
                      <button
                        key={option.value}
                        onClick={() => setDateFilter(option.value)}
                        className={`h-10 rounded-xl text-xs font-semibold transition-colors ${dateFilter === option.value
                          ? "bg-[#173b65] text-[#54b3ff] border border-[#2f6ea8]"
                          : "bg-[#171e2d] text-slate-300 border border-[#27364e]"
                          }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* DANH SÁCH PHIẾU SỬA CHỮA */}
                <div className="space-y-2 px-2 pb-3 pt-2 min-h-[45vh]">
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
                      {canCreateWorkOrder && (
                        <button
                          onClick={handleCreateWorkOrder}
                          disabled={isCreating}
                          className="px-6 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-xl font-medium hover:from-blue-600 hover:to-blue-700 transition-all shadow-lg shadow-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          + Tạo phiếu mới
                        </button>
                      )}
                    </div>
                  ) : (
                    filteredWorkOrders.map((workOrder) => (
                      <WorkOrderCard
                        key={workOrder.id}
                        workOrder={workOrder}
                        onEdit={onEditWorkOrder}
                        onCall={onCallCustomer}
                        onPrint={onPrintWorkOrder}
                        onDelete={onDeleteWorkOrder}
                        canEdit={canUpdateWorkOrder}
                        canPrint={canPrintWorkOrder}
                        canDelete={canDeleteWorkOrder}
                      />
                    ))
                  )}
                </div>
              </div>
            </PullToRefresh>

            {/* FAB (Floating Action Button) */}
            {canCreateWorkOrder && (
              <button
                onClick={handleCreateWorkOrder}
                disabled={isCreating}
                className="fixed bottom-[4.25rem] right-3 w-11 h-11 bg-gradient-to-br from-[#009ef7] to-[#0077b6] rounded-full shadow-xl shadow-[#009ef7]/50 flex items-center justify-center hover:from-[#0077b6] hover:to-[#005a8a] transition-all z-[60] active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                aria-label="Tạo phiếu mới"
              >
                <Plus className="w-4 h-4 text-white" />
              </button>
            )}
          </>
        )}

        {/* HISTORY TAB */}
        {activeTab === "history" && (
          canViewServiceHistory ? (
            <div className="h-full overflow-y-auto pb-24 scrollbar-hide">
              <ServiceHistory currentBranchId={currentBranchId} />
            </div>
          ) : (
            <div className="h-full overflow-y-auto pb-24 scrollbar-hide flex items-center justify-center text-slate-500 text-sm">
              Bạn không có quyền xem lịch sử sửa chữa
            </div>
          )
        )}

        {/* TEMPLATES TAB */}
        {activeTab === "templates" && (
          <div className="h-full overflow-y-auto pb-20 scrollbar-hide p-2">
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
