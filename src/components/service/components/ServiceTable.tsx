import React from "react";
import {
  Wrench,
  Settings,
  Smartphone,
  PhoneCall,
  Printer,
  ChevronDown,
  Edit2,
  Clock,
  Check,
  HandCoins,
  AlertTriangle,
  RefreshCw,
  Plus,
} from "lucide-react";
import type { WorkOrder } from "../../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../../utils/format";
import { formatMaskedPhone } from "../utils/service.utils";
import StatusBadge from "./StatusBadge";
import { StoreSettings, WorkOrderStatus } from "../types/service.types";

interface DropdownPosition {
  top?: number;
  bottom?: number;
  right: number;
}

interface ServiceTableProps {
  paginatedOrders: WorkOrder[];
  filteredOrders: WorkOrder[];
  visibleCount: number;
  hasMoreOrders: boolean;
  showTableSkeleton: boolean;
  showTableError: boolean;
  workOrdersError: unknown;
  workOrdersIsError: boolean;
  workOrdersFetching: boolean;
  displayWorkOrdersCount: number;
  storeSettings: StoreSettings | null;
  currentBranchId: string;
  isOwner: boolean;
  showProfit: boolean;
  canCreateWorkOrder: boolean;
  canPrintWorkOrder: boolean;
  canRefundWorkOrder: boolean;
  canManageAllWorkOrders: boolean;
  canModifyOrder: (order: WorkOrder) => boolean;
  rowActionMenuId: string | null;
  setRowActionMenuId: (id: string | null) => void;
  dropdownPosition: DropdownPosition;
  setDropdownPosition: (pos: DropdownPosition) => void;
  onOpenModal: (order?: WorkOrder) => void;
  onPrintOrder: (order: WorkOrder) => void;
  onCallCustomer: (phone: string) => void;
  onRefundOrder: (order: WorkOrder) => void;
  onClearFilters: () => void;
  onRefresh: () => void;
  onLoadMore: () => void;
}

export const ServiceTable: React.FC<ServiceTableProps> = ({
  paginatedOrders,
  filteredOrders,
  visibleCount,
  hasMoreOrders,
  showTableSkeleton,
  showTableError,
  workOrdersError,
  workOrdersIsError,
  workOrdersFetching,
  displayWorkOrdersCount,
  storeSettings,
  currentBranchId,
  isOwner,
  showProfit,
  canCreateWorkOrder,
  canPrintWorkOrder,
  canRefundWorkOrder,
  canManageAllWorkOrders,
  canModifyOrder,
  rowActionMenuId,
  setRowActionMenuId,
  dropdownPosition,
  setDropdownPosition,
  onOpenModal,
  onPrintOrder,
  onCallCustomer,
  onRefundOrder,
  onClearFilters,
  onRefresh,
  onLoadMore,
}) => {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
      {workOrdersIsError && displayWorkOrdersCount > 0 && (
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-amber-50/60 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
          <div className="text-sm">
            Không thể tải dữ liệu mới. Bạn vẫn đang xem dữ liệu cũ.
          </div>
          <button
            onClick={onRefresh}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-white dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" /> Thử lại
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed min-w-[980px] xl:min-w-[1120px] 2xl:min-w-0">
          <colgroup>
            <col className="w-[17%]" />
            <col className="w-[30%]" />
            <col className="w-[24%]" />
            <col className="w-[19%]" />
            <col className="w-[10%]" />
          </colgroup>
          <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                Mã phiếu
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                Khách hàng
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                Chi tiết
              </th>
              <th className="hidden xl:table-cell px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                Thanh toán & trạng thái
              </th>
              <th className="px-4 py-3 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                Thao tác
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700 bg-white dark:bg-slate-800">
            {showTableSkeleton ? (
              Array.from({ length: 6 }).map((_, idx) => (
                <tr key={`skeleton-${idx}`} className="animate-pulse">
                  <td className="px-4 py-4">
                    <div className="h-4 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="mt-2 h-3 w-28 bg-slate-200 dark:bg-slate-700 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-44 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="mt-2 h-3 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-3 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="mt-2 h-3 w-40 bg-slate-200 dark:bg-slate-700 rounded" />
                  </td>
                  <td className="px-4 py-4">
                    <div className="h-4 w-24 bg-slate-200 dark:bg-slate-700 rounded" />
                    <div className="mt-2 h-2 w-56 bg-slate-200 dark:bg-slate-700 rounded" />
                  </td>
                  <td className="px-4 py-4 text-right">
                    <div className="inline-block h-9 w-9 bg-slate-200 dark:bg-slate-700 rounded-lg" />
                  </td>
                </tr>
              ))
            ) : showTableError ? (
              <tr>
                <td colSpan={5} className="px-4 py-12">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="text-slate-700 dark:text-slate-200 font-semibold">
                      Không thể tải danh sách phiếu sửa chữa
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      {String(
                        (workOrdersError as any)?.message || "Vui lòng thử lại"
                      )}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2">
                      <button
                        onClick={onRefresh}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
                      >
                        <RefreshCw className="w-4 h-4" /> Thử lại
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : filteredOrders.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-16">
                  <div className="max-w-xl mx-auto text-center">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-200">
                      <Wrench className="w-6 h-6" />
                    </div>
                    <div className="mt-4 text-slate-900 dark:text-slate-100 font-semibold">
                      Không có phiếu sửa chữa nào
                    </div>
                    <div className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                      Thử đổi bộ lọc hoặc tạo phiếu mới.
                    </div>
                    <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
                      {canCreateWorkOrder && (
                        <button
                          onClick={() => onOpenModal()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" /> Tạo phiếu
                        </button>
                      )}
                      <button
                        onClick={onClearFilters}
                        className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700"
                      >
                        <RefreshCw className="w-4 h-4" /> Xóa bộ lọc
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedOrders.map((order) => {
                const parts = order.partsUsed || [];
                const services = order.additionalServices || [];

                const totalAmount = order.total || 0;
                const paidAmount = totalAmount - (order.remainingAmount || 0);
                const paymentProgress = totalAmount
                  ? Math.min(100, Math.round((paidAmount / totalAmount) * 100))
                  : 0;

                // Tính lợi nhuận cho owner
                const partsCostPrice =
                  order.partsUsed?.reduce((sum, p) => {
                    let cost = p.costPrice || 0;
                    if (!cost && parts) {
                      const originalPart = parts.find(
                        (fp: any) => fp.id === p.partId || fp.sku === p.sku
                      );
                      if (originalPart) {
                        const op: any = originalPart;
                        if (op.costPrice && typeof op.costPrice === "object") {
                          cost = op.costPrice[currentBranchId] || 0;
                        } else if (typeof op.costPrice === "number") {
                          cost = op.costPrice;
                        } else if (op.importPrice) {
                          cost = op.importPrice;
                        }
                      }
                    }
                    return sum + cost * (p.quantity || 1);
                  }, 0) || 0;

                const servicesCostPrice =
                  order.additionalServices?.reduce(
                    (sum: number, s: any) =>
                      sum + (s.costPrice || 0) * (s.quantity || 1),
                    0
                  ) || 0;

                const orderProfit =
                  totalAmount - partsCostPrice - servicesCostPrice;

                const isEffectivelyPaid =
                  order.paymentStatus === "paid" &&
                  (totalAmount > 0 || order.status === "Trả máy");

                const paymentPillClass = isEffectivelyPaid
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                  : order.paymentStatus === "partial"
                    ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";

                const partsSummary = parts
                  .slice(0, 2)
                  .map((p) =>
                    `${p.partName || ""}${p.quantity > 1 ? ` x${p.quantity}` : ""}`.trim()
                  )
                  .filter(Boolean)
                  .join(", ")
                  .trim();

                const partsSuffix =
                  parts.length > 2 ? ` +${parts.length - 2}` : "";
                const partsTitle = parts
                  .map((p) =>
                    `${p.partName || ""}${p.quantity > 1 ? ` x${p.quantity}` : ""}`.trim()
                  )
                  .filter(Boolean)
                  .join(", ");

                const servicesSummary = services
                  .slice(0, 2)
                  .map((s: any) =>
                    `${s.description || ""}${(s.quantity || 1) > 1 ? ` x${s.quantity || 1}` : ""}`.trim()
                  )
                  .filter(Boolean)
                  .join(", ")
                  .trim();

                const servicesSuffix =
                  services.length > 2 ? ` +${services.length - 2}` : "";
                const servicesTitle = services
                  .map((s: any) =>
                    `${s.description || ""}${(s.quantity || 1) > 1 ? ` x${s.quantity || 1}` : ""}`.trim()
                  )
                  .filter(Boolean)
                  .join(", ");

                return (
                  <tr
                    key={order.id}
                    onClick={() => {
                      if (canModifyOrder(order)) {
                        onOpenModal(order);
                      }
                    }}
                    className={`group bg-white dark:bg-slate-900/30 hover:bg-slate-50 dark:hover:bg-slate-800/40 border-b border-slate-100 dark:border-slate-800/50 transition-all duration-300 hover:shadow-[0_4px_20px_rgba(59,130,246,0.04)] border-l-4 border-transparent hover:border-blue-500/80 ${canModifyOrder(order) ? "cursor-pointer" : "cursor-default"}`}
                  >
                    {/* Column 1: Mã phiếu */}
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1">
                        <div>
                          <span className="inline-flex px-2 py-0.5 rounded-lg text-xs font-mono font-bold bg-blue-500/10 text-blue-500 dark:text-blue-400 border border-blue-500/20 shadow-[0_0_10px_rgba(59,130,246,0.06)]">
                            {formatWorkOrderId(
                              order.id,
                              storeSettings?.work_order_prefix
                            )}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold space-y-0.5">
                          <div>
                            Ngày:{" "}
                            <span className="text-slate-600 dark:text-slate-300">
                              {formatDate(order.creationDate, true)}
                            </span>
                          </div>
                          <div className="text-cyan-600 dark:text-cyan-400 flex items-center gap-1 mt-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 dark:bg-cyan-500 animate-pulse inline-block" />
                            <span>
                              NV: {order.technicianName || "Chưa phân công"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Column 2: Khách hàng */}
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-1.5">
                        <div className="font-extrabold text-base text-slate-900 dark:text-white tracking-tight">
                          {order.customerName}
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-slate-500 font-semibold">
                          <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                          <span className="font-mono">
                            {formatMaskedPhone(order.customerPhone)}
                          </span>
                          {order.customerPhone && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onCallCustomer(order.customerPhone || "");
                              }}
                              className="inline-flex items-center justify-center w-6 h-6 rounded-lg text-blue-500 hover:text-white hover:bg-blue-500/80 dark:hover:bg-blue-500/20 transition-all duration-200"
                              aria-label={`Gọi khách: ${order.customerPhone}`}
                              title={`Gọi: ${order.customerPhone}`}
                            >
                              <PhoneCall className="w-3 h-3" />
                            </button>
                          )}
                        </div>

                        <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold flex flex-wrap items-center gap-1.5">
                          <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 text-[9px] uppercase font-bold">
                            Xe
                          </span>
                          <span>{order.vehicleModel || "N/A"}</span>
                          {order.licensePlate && (
                            <span className="px-1.5 py-0.5 bg-blue-500/10 text-blue-500 dark:text-blue-400 rounded-md font-mono text-[9px] font-bold border border-blue-500/20 shadow-[0_0_8px_rgba(59,130,246,0.04)]">
                              {order.licensePlate}
                            </span>
                          )}
                        </div>

                        {order.issueDescription &&
                          order.issueDescription !== "Không có mô tả" && (
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 italic line-clamp-2 mt-1.5 border-l-2 border-slate-200 dark:border-slate-800 pl-2">
                              {order.issueDescription}
                            </div>
                          )}
                      </div>
                    </td>

                    {/* Column 3: Chi tiết - Compact format */}
                    <td className="px-4 py-4 align-top">
                      <div className="space-y-2 max-w-none">
                        {servicesSummary && (
                          <div
                            className="text-xs flex items-start gap-2 bg-slate-100/50 dark:bg-slate-900/30 p-1.5 rounded-xl border border-slate-200/20 dark:border-slate-800/40"
                            title={
                              servicesTitle
                                ? `Dịch vụ: ${servicesTitle}`
                                : "Dịch vụ"
                            }
                          >
                            <Settings className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-200 line-clamp-1 font-medium">
                              {servicesSummary}
                              {servicesSuffix && (
                                <span className="text-slate-400 font-bold ml-0.5">
                                  {servicesSuffix}
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {partsSummary && (
                          <div
                            className="text-xs flex items-start gap-2 bg-slate-100/50 dark:bg-slate-900/30 p-1.5 rounded-xl border border-slate-200/20 dark:border-slate-800/40"
                            title={
                              partsTitle ? `Phụ tùng: ${partsTitle}` : "Phụ tùng"
                            }
                          >
                            <Wrench className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                            <span className="text-slate-700 dark:text-slate-200 line-clamp-1 font-medium">
                              {partsSummary}
                              {partsSuffix && (
                                <span className="text-slate-400 font-bold ml-0.5">
                                  {partsSuffix}
                                </span>
                              )}
                            </span>
                          </div>
                        )}

                        {!partsSummary && !servicesSummary && (
                          <div className="text-xs text-slate-400 italic pl-1">
                            — Không phụ tùng & dịch vụ —
                          </div>
                        )}

                        {/* Status badges for tablet/mobile - show when payment column hidden */}
                        <div className="xl:hidden flex flex-wrap items-center gap-1.5 pt-1">
                          <StatusBadge status={order.status as WorkOrderStatus} />
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${isEffectivelyPaid ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20" : order.paymentStatus === "partial" ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20" : "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20"}`}
                          >
                            {isEffectivelyPaid
                              ? "Đã TT"
                              : order.paymentStatus === "partial"
                                ? "TT một phần"
                                : "Chưa TT"}
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* Column 4: Thanh toán & trạng thái - Clean layout - Hidden on tablet */}
                    <td className="hidden xl:table-cell px-4 py-4 align-top">
                      <div className="space-y-2 min-w-0">
                        {/* Tổng tiền */}
                        <div className="text-sm font-extrabold text-slate-900 dark:text-white tracking-tight">
                          {formatCurrency(totalAmount)}
                        </div>

                        {/* Lợi nhuận - Chỉ hiển thị cho owner khi bật toggle */}
                        {isOwner &&
                          showProfit &&
                          order.paymentStatus === "paid" && (
                            <div
                              className="flex items-center gap-1 text-[10px] font-semibold"
                              title="Lợi nhuận và biên lợi nhuận trên tổng tiền"
                            >
                              <span className="text-slate-400 uppercase tracking-wider text-[9px]">
                                Lợi nhuận:
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded font-bold ${orderProfit > 0 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-red-500/10 text-red-500"}`}
                              >
                                {orderProfit > 0 ? "+" : ""}
                                {formatCurrency(orderProfit)}
                              </span>
                              {totalAmount > 0 && (
                                <span className="text-slate-400 font-medium">
                                  ({Math.round((orderProfit / totalAmount) * 100)}
                                  %)
                                </span>
                              )}
                            </div>
                          )}

                        {/* Futuristic thin progress bar + Đã thu */}
                        {totalAmount > 0 && (
                          <div className="space-y-1.5">
                            <div
                              className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-800/80 overflow-hidden relative"
                              title={`Đã thanh toán ${paymentProgress}%`}
                            >
                              <div
                                className={`h-full rounded-full transition-all duration-500 shadow-[0_0_8px_rgba(16,185,129,0.3)] ${paymentProgress >= 100 ? "bg-gradient-to-r from-emerald-400 to-emerald-600 animate-pulse-glow" : paymentProgress > 0 ? "bg-gradient-to-r from-blue-400 to-blue-600" : "bg-slate-300 dark:bg-slate-700"}`}
                                style={{
                                  width: `${Math.min(paymentProgress, 100)}%`,
                                }}
                              />
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 font-semibold">
                              <span className="flex items-center gap-1">
                                <span>Đã thu:</span>
                                <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                  {formatCurrency(Math.max(0, paidAmount))}
                                </span>
                              </span>
                              {order.remainingAmount !== undefined &&
                                order.remainingAmount > 0 && (
                                  <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                                    <span>Còn</span>
                                    <span className="font-bold">
                                      {formatCurrency(order.remainingAmount)}
                                    </span>
                                  </span>
                                )}
                            </div>
                          </div>
                        )}

                        {/* Payment details - Show deposit/partial info when applicable */}
                        {((order.depositAmount && order.depositAmount > 0) ||
                          order.paymentStatus === "partial") && (
                          <div className="space-y-1 pt-1 border-t border-slate-200 dark:border-slate-700">
                            {order.depositAmount && order.depositAmount > 0 && (
                              <div className="flex items-center justify-between text-xs">
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-500/20 text-purple-600 dark:text-purple-400 rounded font-medium">
                                  <HandCoins className="w-3 h-3" /> Đã cọc
                                </span>
                                <span className="text-purple-600 dark:text-purple-400 font-medium">
                                  {formatCurrency(order.depositAmount)}
                                </span>
                              </div>
                            )}
                            {totalAmount > 0 &&
                              (order.remainingAmount ?? 0) > 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-600 dark:text-amber-400 rounded font-medium">
                                    <Clock className="w-3 h-3" /> Còn nợ
                                  </span>
                                  <span className="text-amber-600 dark:text-amber-400 font-medium">
                                    {formatCurrency(order.remainingAmount ?? 0)}
                                  </span>
                                </div>
                              )}
                            {order.paymentStatus === "paid" &&
                              totalAmount > 0 &&
                              (order.remainingAmount ?? 0) === 0 && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded font-medium">
                                    <Check className="w-3 h-3" /> Đã thanh toán đủ
                                  </span>
                                  <span className="text-green-600 dark:text-green-400 font-medium">
                                    {formatCurrency(order.totalPaid || 0)}
                                  </span>
                                </div>
                              )}
                          </div>
                        )}

                        {/* Status badges */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge
                            status={order.status as WorkOrderStatus}
                          />
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${paymentPillClass}`}
                          >
                            {isEffectivelyPaid
                              ? "Đã TT"
                              : order.paymentStatus === "partial"
                                ? "TT một phần"
                                : "Chưa TT"}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td
                      className="px-4 py-4 align-top overflow-visible"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative service-row-menu">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              const spaceBelow = window.innerHeight - rect.bottom;
                              if (spaceBelow < 280) {
                                setDropdownPosition({
                                  bottom: window.innerHeight - rect.top + 4,
                                  right: window.innerWidth - rect.right,
                                });
                              } else {
                                setDropdownPosition({
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
                              }
                              setRowActionMenuId(
                                rowActionMenuId === order.id ? null : order.id
                              );
                            }}
                            aria-haspopup="menu"
                            aria-expanded={rowActionMenuId === order.id}
                            className="w-10 h-10 inline-flex items-center justify-center border border-slate-200 dark:border-slate-600 rounded-lg text-slate-500 hover:text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                          >
                            <ChevronDown className="w-4 h-4" />
                          </button>
                          {rowActionMenuId === order.id && (
                            <div
                              className="fixed w-52 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-2xl z-[9999] overflow-hidden"
                              style={{
                                ...(dropdownPosition.top !== undefined ? { top: dropdownPosition.top } : {}),
                                ...(dropdownPosition.bottom !== undefined ? { bottom: dropdownPosition.bottom } : {}),
                                right: dropdownPosition.right,
                              }}
                            >
                              <div className="py-1">
                                {canManageAllWorkOrders && (
                                  <div className="px-3 py-2 border-b border-slate-200 dark:border-slate-700">
                                    <span className="inline-flex items-center rounded-full border border-amber-300/70 bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300">
                                      Owner mode: Toan quyen phieu
                                    </span>
                                  </div>
                                )}
                                {canModifyOrder(order) && (
                                  <button
                                    onClick={() => {
                                      onOpenModal(order);
                                      setRowActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                      <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span>Xem chi tiết</span>
                                  </button>
                                )}
                                {canPrintWorkOrder && (
                                  <button
                                    onClick={() => {
                                      onPrintOrder(order);
                                      setRowActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                      <Printer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span>In phiếu</span>
                                  </button>
                                )}
                                <button
                                  onClick={() => {
                                    onCallCustomer(order.customerPhone || "");
                                    setRowActionMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                >
                                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                    <Smartphone className="w-4 h-4 text-green-600 dark:text-green-400" />
                                  </div>
                                  <span>Gọi khách hàng</span>
                                </button>
                                {!order.refunded && canRefundWorkOrder && (
                                  <>
                                    <div className="my-1 border-t border-slate-200 dark:border-slate-700"></div>
                                    <button
                                      onClick={() => {
                                        onRefundOrder(order);
                                        setRowActionMenuId(null);
                                      }}
                                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                    >
                                      <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                                      </div>
                                      <span>Hủy / Hoàn tiền</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {!showTableSkeleton && !showTableError && filteredOrders.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Hiển thị {Math.min(visibleCount, filteredOrders.length)} /{" "}
            {filteredOrders.length}
          </div>
          {hasMoreOrders && (
            <button
              onClick={onLoadMore}
              disabled={workOrdersFetching}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
            >
              {workOrdersFetching ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Xem thêm (còn {filteredOrders.length - visibleCount})
            </button>
          )}
        </div>
      )}

      <div
        id="service-table-scroll-sentinel"
        className="h-1"
        aria-hidden="true"
      />
    </div>
  );
};
