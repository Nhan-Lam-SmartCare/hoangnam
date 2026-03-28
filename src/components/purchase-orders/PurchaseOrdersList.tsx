import React, { useState } from "react";
import {
  Plus,
  Package,
  CheckCircle,
  XCircle,
  Clock,
  FileText,
  Trash2,
  Eye,
} from "lucide-react";
import {
  usePurchaseOrders,
  useDeletePurchaseOrder,
} from "../../hooks/usePurchaseOrders";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmModal from "../common/ConfirmModal";
import { showToast } from "../../utils/toast";
import type { PurchaseOrder } from "../../types";

interface PurchaseOrdersListProps {
  onCreateNew: () => void;
  onViewDetail: (po: PurchaseOrder) => void;
  onEdit: (po: PurchaseOrder) => void;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; icon: React.ReactNode; color: string; bgColor: string }
> = {
  draft: {
    label: "Nháp",
    icon: <FileText className="w-4 h-4" />,
    color: "text-slate-600 dark:text-slate-400",
    bgColor: "bg-slate-100 dark:bg-slate-800",
  },
  ordered: {
    label: "Đã đặt",
    icon: <Clock className="w-4 h-4" />,
    color: "text-blue-600 dark:text-blue-400",
    bgColor: "bg-blue-50 dark:bg-blue-950/50",
  },
  received: {
    label: "Đã nhận",
    icon: <CheckCircle className="w-4 h-4" />,
    color: "text-green-600 dark:text-green-400",
    bgColor: "bg-green-50 dark:bg-green-950/50",
  },
  cancelled: {
    label: "Đã hủy",
    icon: <XCircle className="w-4 h-4" />,
    color: "text-red-600 dark:text-red-400",
    bgColor: "bg-red-50 dark:bg-red-950/50",
  },
};

export const PurchaseOrdersList: React.FC<PurchaseOrdersListProps> = ({
  onCreateNew,
  onViewDetail,
  onEdit,
}) => {
  const { currentBranchId } = useAppContext();
  const branchId = currentBranchId || "";
  const { data: purchaseOrders = [], isLoading } = usePurchaseOrders(branchId);
  const deletePOMutation = useDeletePurchaseOrder();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  const [statusFilter, setStatusFilter] = useState<string>("all");

  const filteredOrders = purchaseOrders.filter(
    (po) => statusFilter === "all" || po.status === statusFilter
  );

  const handleDelete = async (po: PurchaseOrder) => {
    if (po.status === "received") {
      showToast.error("Không thể xóa đơn hàng đã nhập kho");
      return;
    }

    const confirmed = await confirm({
      title: "Xóa đơn đặt hàng",
      message: `Bạn có chắc muốn xóa đơn ${po.po_number}?`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (confirmed) {
      try {
        await deletePOMutation.mutateAsync(po.id);
        showToast.success("Đã xóa đơn đặt hàng");
      } catch (error) {
        console.error("Error deleting PO:", error);
        showToast.error("Lỗi khi xóa đơn đặt hàng");
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Filters */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-hide py-1">
          <button
            onClick={() => setStatusFilter("all")}
            className={`flex-shrink-0 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${statusFilter === "all"
              ? "bg-blue-600 text-white shadow-lg shadow-blue-500/40"
              : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
          >
            Tất cả <span className="ml-1 opacity-60">{purchaseOrders.length}</span>
          </button>
          {Object.entries(STATUS_CONFIG).map(([status, config]) => {
            const count = purchaseOrders.filter(
              (po) => po.status === status
            ).length;
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(status)}
                className={`flex-shrink-0 flex items-center gap-2 px-4 py-2 rounded-full text-[11px] font-bold uppercase tracking-wider transition-all duration-200 ${isActive
                  ? `${config.bgColor} ${config.color} ring-1 ring-inset ring-current shadow-sm`
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                  }`}
              >
                <span className="w-3.5 h-3.5 flex items-center justify-center">
                  {config.icon}
                </span>
                <span>{config.label}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${isActive ? "bg-white/30 dark:bg-black/20" : "bg-slate-200 dark:bg-slate-700"}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {/* Action Button */}
        <button
          onClick={onCreateNew}
          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-medium shadow-lg shadow-blue-500/20 transition-all active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-5 h-5" />
          Tạo đơn mới
        </button>
      </div>

      {/* List */}
      {filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-white dark:bg-slate-800 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700">
          <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center mb-4">
            <Package className="w-8 h-8 text-slate-300 dark:text-slate-600" />
          </div>
          <p className="text-slate-500 dark:text-slate-400 font-medium">
            {statusFilter === "all"
              ? "Chưa có đơn đặt hàng nào"
              : `Không có đơn ${STATUS_CONFIG[
                statusFilter
              ]?.label.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredOrders.map((po) => {
            const statusConfig =
              STATUS_CONFIG[po.status] || STATUS_CONFIG.draft;
            return (
              <div
                key={po.id}
                className="group bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-xl hover:border-blue-300 dark:hover:border-blue-700 transition-all duration-300 cursor-pointer relative overflow-hidden"
                onClick={() => onViewDetail(po)}
              >
                {/* Status Stripe */}
                <div
                  className={`absolute left-0 top-0 bottom-0 w-1.5 ${statusConfig.bgColor.replace(
                    "bg-",
                    "bg-"
                  )}`}
                />

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pl-2">
                  {/* Left Section: Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                        {po.po_number}
                      </h3>
                      <span
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${statusConfig.bgColor} ${statusConfig.color}`}
                      >
                        {statusConfig.icon}
                        {statusConfig.label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2 text-sm">
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="w-24 text-slate-500">Nhà cung cấp:</span>
                        <span className="font-semibold text-slate-900 dark:text-slate-200">
                          {po.supplier?.name || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="w-24 text-slate-500">Người tạo:</span>
                        <span className="font-medium">
                          {po.creator?.name || po.creator?.email || "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="w-24 text-slate-500">Ngày đặt:</span>
                        <span>
                          {po.order_date ? formatDate(po.order_date) : "—"}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-400">
                        <span className="w-24 text-slate-500">Dự kiến:</span>
                        <span>
                          {po.expected_date ? formatDate(po.expected_date) : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right Section: Amount & Actions */}
                  <div className="flex items-center justify-between md:justify-end gap-6 border-t md:border-t-0 border-slate-100 dark:border-slate-700 pt-4 md:pt-0">
                    <div className="text-right">
                      <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                        Tổng tiền ({po.items?.length || 0} món)
                      </p>
                      <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
                        {formatCurrency(po.final_amount || (po.total_amount - (po.discount_amount || 0)))}
                      </div>
                      {po.discount_amount > 0 && (
                        <div className="text-xs text-slate-400 line-through">
                          {formatCurrency(po.total_amount || 0)}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {/* Edit Button */}
                      {po.status !== "received" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(po);
                          }}
                          className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-amber-100 hover:text-amber-600 dark:hover:bg-amber-900/30 dark:hover:text-amber-400 transition-colors"
                          title="Chỉnh sửa"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="20"
                            height="20"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="w-5 h-5"
                          >
                            <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
                            <path d="m15 5 4 4" />
                          </svg>
                        </button>
                      )}

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewDetail(po);
                        }}
                        className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-blue-100 hover:text-blue-600 dark:hover:bg-blue-900/30 dark:hover:text-blue-400 transition-colors"
                        title="Xem chi tiết"
                      >
                        <Eye className="w-5 h-5" />
                      </button>
                      {po.status !== "received" && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(po);
                          }}
                          className="p-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/30 dark:hover:text-red-400 transition-colors"
                          title="Xóa đơn hàng"
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Notes Footer */}
                {po.notes && (
                  <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700/50 flex items-start gap-2">
                    <FileText className="w-4 h-4 text-slate-400 mt-0.5" />
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">
                      "{po.notes}"
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmColor={confirmState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </div>
  );
};
