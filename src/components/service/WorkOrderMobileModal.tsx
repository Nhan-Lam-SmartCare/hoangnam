import React, { useEffect } from "react";
import {
  X,
  Plus,
  Minus,
  Check,
  Search,
  AlertTriangle,
  Printer,
  Share2,
  User,
  Bike,
  Wrench,
  FileText,
  CheckCircle,
  Clock,
  Edit2,
  Trash2,
  Smartphone,
  PhoneCall,
  ChevronRight,
  TrendingUp,
  Package,
  ScanBarcode,
  Lock,
  Grid3x3,
  DollarSign,
} from "lucide-react";
import { ScannerModal } from "../common/ScannerModal";
import { AndroidPatternLock } from "../common/AndroidPatternLock";
import { formatCurrency, formatWorkOrderId } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import type {
  Employee,
  WorkOrder,
  Part,
  Customer,
  Vehicle,
} from "../../types";
import { WORK_ORDER_STATUS, type WorkOrderStatus } from "../../constants";
import { NumberInput } from "../common/NumberInput";
import { showToast } from "../../utils/toast";
import CustomerModal from "../customer/CustomerModal";
import { POPULAR_DEVICES } from "../../constants/devices";

import { useWorkOrderMobileFormState } from "./hooks/useWorkOrderMobileFormState";
import { WorkOrderMobileInfoSection } from "./components/WorkOrderMobileInfoSection";
import { WorkOrderMobileIssueSection } from "./components/WorkOrderMobileIssueSection";
import { WorkOrderMobilePartsSection } from "./components/WorkOrderMobilePartsSection";
import { WorkOrderMobilePaymentSection } from "./components/WorkOrderMobilePaymentSection";

interface WorkOrderMobileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workOrderData: any) => Promise<void> | void;
  workOrder?: WorkOrder | null;
  customers: Customer[];
  parts: Part[];
  employees: Employee[];
  currentBranchId: string;
  upsertCustomer?: (customer: any) => void;
  viewMode?: boolean; // true = xem chi tiết, false = chỉnh sửa
  onSwitchToEdit?: () => void; // callback khi bấm nút chỉnh sửa từ view mode
  canUpdateWorkOrderStatus?: boolean;
  canUpdateWorkOrderPayment?: boolean;
  canUpdateWorkOrderParts?: boolean;
  canUpdateWorkOrderLabor?: boolean;
  canUpdateWorkOrderDiscount?: boolean;
  canUpdateWorkOrderCustomer?: boolean;
  canUpdateWorkOrderVehicle?: boolean;
  canUpdateWorkOrderOutsourceService?: boolean;
}

const getWarrantyText = (part: Part | null | undefined): string => {
  if (!part) return "";
  return String(
    (part as any).warrantyPeriod ??
      (part as any).warrantyperiod ??
      (part as any).warranty_period ??
      (part as any).warranty ??
      ""
  ).trim();
};

export const WorkOrderMobileModal: React.FC<WorkOrderMobileModalProps> = ({
  isOpen,
  onClose,
  onSave,
  workOrder,
  customers,
  parts,
  employees,
  currentBranchId,
  upsertCustomer,
  viewMode = false,
  onSwitchToEdit,
  canUpdateWorkOrderStatus = true,
  canUpdateWorkOrderPayment = true,
  canUpdateWorkOrderParts = true,
  canUpdateWorkOrderLabor = true,
  canUpdateWorkOrderDiscount = true,
  canUpdateWorkOrderCustomer = true,
  canUpdateWorkOrderVehicle = true,
  canUpdateWorkOrderOutsourceService = true,
}) => {
  const {
    isPatternMode,
    setIsPatternMode,
    status,
    setStatus,
    isTechnicianLockedForStaff,
    effectiveSelectedTechnicianId,
    setSelectedTechnicianId,
    selectedCustomer,
    setSelectedCustomer,
    selectedVehicle,
    setSelectedVehicle,
    currentKm,
    setCurrentKm,
    issueDescription,
    setIssueDescription,
    devicePhotos,
    isUploadingPhoto,
    selectedParts,
    setSelectedParts,
    additionalServices,
    setAdditionalServices,
    discount,
    setDiscount,
    discountType,
    setDiscountType,
    isDeposit,
    setIsDeposit,
    depositAmount,
    setDepositAmount,
    paymentMethod,
    setPaymentMethod,
    showPaymentInput,
    setShowPaymentInput,
    partialAmount,
    setPartialAmount,
    showCustomerSearch,
    setShowCustomerSearch,
    customerSearchTerm,
    setCustomerSearchTerm,
    isSearchingCustomer,
    hasMoreCustomers,
    activeWarranty,
    showPartSearch,
    setShowPartSearch,
    partSearchTerm,
    setPartSearchTerm,
    activeScanField,
    setActiveScanField,
    partResultsRef,
    showAddService,
    setShowAddService,
    newServiceName,
    setNewServiceName,
    newServicePrice,
    setNewServicePrice,
    newServiceQuantity,
    setNewServiceQuantity,
    showAddVehicle,
    setShowAddVehicle,
    newVehiclePlate,
    setNewVehiclePlate,
    newVehicleName,
    setNewVehicleName,
    showAddCustomer,
    setShowAddCustomer,
    newCustomerName,
    setNewCustomerName,
    newCustomerPhone,
    setNewCustomerPhone,
    newCustomerVehicleModel,
    setNewCustomerVehicleModel,
    newCustomerLicensePlate,
    setNewCustomerLicensePlate,
    showAddManualPart,
    setShowAddManualPart,
    newManualPartName,
    setNewManualPartName,
    newManualPartCost,
    setNewManualPartCost,
    newManualPartPrice,
    setNewManualPartPrice,
    newManualPartQuantity,
    setNewManualPartQuantity,
    showVehicleDropdown,
    setShowVehicleDropdown,
    isEditingCustomer,
    setIsEditingCustomer,
    editCustomerName,
    setEditCustomerName,
    editCustomerPhone,
    setEditCustomerPhone,
    isSubmitting,
    activeSection,
    setActiveSection,
    includeIntegratedLabor,
    setIncludeIntegratedLabor,
    customerVehicles,
    partsTotal,
    servicesTotal,
    effectiveLaborCost,
    total,
    remainingPreview,
    additionalPaymentPreview,
    discountAmount,
    filteredCustomers,
    filteredParts,
    formatNumberWithDots,
    parseFormattedNumber,
    handleSelectCustomer,
    handleSaveEditedCustomer,
    handleSelectVehicle,
    handleAddPart,
    handleUpdatePartQuantity,
    handleRemovePart,
    handleAddService,
    handleRemoveService,
    handleAddManualPart,
    handleAddVehicle,
    handleAddDevicePhoto,
    handleRemoveDevicePhoto,
    handleSave,
    handlePayFull,
    getPartLaborBase,
    getPartWarranty,
    getWarrantyForWorkOrderPart,
    getIntegratedLaborByQuantity,
    handleLoadMoreCustomers,
  } = useWorkOrderMobileFormState({
    isOpen,
    onClose,
    onSave,
    workOrder,
    customers,
    parts,
    employees,
    currentBranchId,
    upsertCustomer,
    canUpdateWorkOrderStatus,
    canUpdateWorkOrderPayment,
    canUpdateWorkOrderParts,
    canUpdateWorkOrderLabor,
    canUpdateWorkOrderDiscount,
    canUpdateWorkOrderCustomer,
    canUpdateWorkOrderVehicle,
    canUpdateWorkOrderOutsourceService,
  });

  const getStatusColor = (s: WorkOrderStatus) => {
    switch (s) {
      case WORK_ORDER_STATUS.RECEIVED:
        return "bg-blue-500/10 text-blue-400 border-blue-500/30";
      case WORK_ORDER_STATUS.IN_PROGRESS:
        return "bg-orange-500/10 text-orange-400 border-orange-500/30";
      case WORK_ORDER_STATUS.COMPLETED:
        return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
      case WORK_ORDER_STATUS.DELIVERED:
        return "bg-purple-500/10 text-purple-400 border-purple-500/30";
      default:
        return "bg-slate-500/10 text-slate-400 border-slate-500/30";
    }
  };

  // Hide bottom navigation when modal is open and handle Escape key
  useEffect(() => {
    if (isOpen) {
      document.body.classList.add("hide-bottom-nav");
    } else {
      document.body.classList.remove("hide-bottom-nav");
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleKeyDown);
    }

    return () => {
      document.body.classList.remove("hide-bottom-nav");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // VIEW MODE - Hiển thị chi tiết phiếu (không cho chỉnh sửa)
  if (viewMode && workOrder) {
    return (
      <div
        className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="work-order-view-title"
      >
        {/* Mobile Full Screen */}
        <div className="md:hidden w-full h-full bg-slate-50 dark:bg-[#151521] flex flex-col transition-colors">
          {/* Header */}
          <div className="flex-shrink-0 bg-white dark:bg-[#1e1e2d] px-4 py-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
              >
                <X className="w-5 h-5" />
              </button>
              <div>
                <h2 id="work-order-view-title" className="text-sm font-bold text-slate-900 dark:text-white">
                  Chi tiết phiếu
                </h2>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-mono font-medium">
                  #{formatWorkOrderId(workOrder.id)}
                </div>
              </div>
            </div>
            {onSwitchToEdit && (
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="h-9 px-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-blue-500/20"
              >
                <Edit2 className="w-3.5 h-3.5" />
                Sửa phiếu
              </button>
            )}
          </div>

          {/* Scrollable Content - View Only */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#151521]">
            {/* Trạng thái & Thời gian */}
            <div className="p-3 bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <span
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold ${getStatusColor(
                    workOrder.status as any
                  )}`}
                >
                  {workOrder.status}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {new Date(workOrder.creationDate).toLocaleDateString("vi-VN")}{" "}
                  {new Date(workOrder.creationDate).toLocaleTimeString(
                    "vi-VN",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </span>
              </div>
              {workOrder.technicianName && (
                <div className="mt-2 text-xs text-slate-500 dark:text-slate-300 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  KTV:{" "}
                  <span className="font-medium text-slate-900 dark:text-white">
                    {workOrder.technicianName}
                  </span>
                </div>
              )}
            </div>

            {/* Thông tin khách hàng */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-xs font-semibold text-blue-600 dark:text-blue-400 mb-2 flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                KHÁCH HÀNG
              </h3>
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 space-y-2 border border-slate-200 dark:border-transparent">
                <div className="flex items-center justify-between">
                  <span className="text-slate-900 dark:text-white font-medium">
                    {workOrder.customerName || "—"}
                  </span>
                  {workOrder.customerPhone && (
                    <a
                      href={`tel:${workOrder.customerPhone}`}
                      className="text-blue-600 dark:text-blue-400 text-sm flex items-center gap-1.5"
                    >
                      <PhoneCall className="w-3.5 h-3.5" />
                      {workOrder.customerPhone}
                    </a>
                  )}
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                  <Bike className="w-3.5 h-3.5 text-slate-400" />
                  {workOrder.vehicleModel || "—"} •{" "}
                  <span className="text-yellow-600 dark:text-yellow-400 font-mono">
                    {workOrder.licensePlate || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Mô tả vấn đề & Pattern (Merged) */}
            {workOrder.notes && (
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-orange-600 dark:text-orange-400 mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" />
                  MÔ TẢ VẤN ĐỀ
                </h3>
                <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 border border-slate-200 dark:border-transparent">
                  {(() => {
                    const pwdMatch = workOrder.notes.match(/\[Mật khẩu\/Pattern\]:\s*(.*)/);
                    let displayNotes = workOrder.notes;
                    let pattern = "";

                    if (pwdMatch) {
                      const fullMatch = pwdMatch[0];
                      const pwdValue = pwdMatch[1];
                      displayNotes = workOrder.notes.replace(fullMatch, "").trim();

                      if (pwdValue.startsWith("Pattern:")) {
                        pattern = pwdValue.replace("Pattern:", "").trim();
                      }
                    }

                    return (
                      <>
                        {displayNotes && (
                          <div className="text-sm text-slate-600 dark:text-slate-300 whitespace-pre-wrap mb-3">
                            {displayNotes}
                          </div>
                        )}

                        {pattern && (
                          <div className="flex flex-col items-center p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              Mô phỏng hình vẽ mở khóa
                            </div>
                            <AndroidPatternLock
                              initialValue={pattern}
                              readOnly={true}
                              className="pointer-events-none"
                            />
                          </div>
                        )}

                        {pwdMatch && !pattern && (
                          <div className="mt-2 p-2 bg-slate-100 dark:bg-slate-800 rounded text-xs font-mono text-slate-600 dark:text-slate-400">
                            <strong>Mật khẩu:</strong> {pwdMatch[1]}
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* Phụ tùng */}
            {workOrder.partsUsed && workOrder.partsUsed.length > 0 && (
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5" />
                  LINH KIỆN ({workOrder.partsUsed.length})
                </h3>
                <div className="space-y-2">
                  {workOrder.partsUsed.map((part, idx) => {
                    const warrantyText = getWarrantyForWorkOrderPart(part);
                    return (
                      <div key={idx} className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 border border-slate-200 dark:border-transparent">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="text-sm text-slate-900 dark:text-white font-medium truncate">
                              {part.partName || "Linh kiện"}
                            </div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              SL: {part.quantity} {part.sku && `• ${part.sku}`}
                            </div>
                            {warrantyText && (
                              <div className="text-[11px] text-emerald-500 dark:text-emerald-400 font-semibold mt-0.5">
                                Bảo hành: {warrantyText}
                              </div>
                            )}
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(part.price * part.quantity)}
                            </div>
                            <div className="text-xs text-slate-500">
                              {formatCurrency(part.price)}/cái
                            </div>
                          </div>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400 dark:text-slate-500 flex justify-between">
                          <span>
                            Giá vốn: {formatCurrency(part.costPrice || 0)}/cái
                          </span>
                          <span className="text-yellow-600 dark:text-yellow-400">
                            Lãi:{" "}
                            {formatCurrency(
                              (part.price - (part.costPrice || 0)) * part.quantity
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Dịch vụ */}
            {workOrder.additionalServices &&
              workOrder.additionalServices.length > 0 && (
                <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                  <h3 className="text-xs font-semibold text-purple-600 dark:text-purple-400 mb-2 flex items-center gap-1.5">
                    <Wrench className="w-3.5 h-3.5" />
                    DỊCH VỤ ({workOrder.additionalServices.length})
                  </h3>
                  <div className="space-y-2">
                    {workOrder.additionalServices.map((svc, idx) => (
                      <div
                        key={idx}
                        className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 flex items-center justify-between border border-slate-200 dark:border-transparent"
                      >
                        <div className="flex-1 min-w-0 pr-2">
                          <div className="text-sm text-slate-900 dark:text-white font-medium truncate">
                            {svc.description || "Dịch vụ"}
                          </div>
                          {svc.quantity > 1 && (
                            <div className="text-xs text-slate-500 dark:text-slate-400">
                              SL: {svc.quantity}
                            </div>
                          )}
                        </div>
                        <div className="text-sm font-bold text-purple-600 dark:text-purple-400 flex-shrink-0">
                          {formatCurrency(svc.price * (svc.quantity || 1))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {workOrder.repairServices && workOrder.repairServices.length > 0 && (
              <div className="p-3 border-b border-slate-200 dark:border-slate-700">
                <h3 className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1.5">
                  <Wrench className="w-3.5 h-3.5" />
                  CONG SUA ({workOrder.repairServices.length})
                </h3>
                <div className="space-y-2">
                  {workOrder.repairServices.map((service) => (
                    <div
                      key={service.id}
                      className="bg-white dark:bg-[#1e1e2d] rounded-xl p-3 border border-slate-200 dark:border-transparent"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm text-slate-900 dark:text-white font-medium truncate">
                            {service.serviceName}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {service.laborCalcType}
                          </div>
                          {(service.workers || []).length > 0 && (
                            <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                              {(service.workers || [])
                                .map(
                                  (worker) =>
                                    `${worker.workerName || worker.workerId}: ${worker.sharePercent}%`
                                )
                                .join(", ")}
                            </div>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                            {formatCurrency(service.laborAmount)}
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            Tho: {formatCurrency(
                              (service.workers || []).length > 0
                                ? (service.workers || []).reduce(
                                    (sum, worker) => sum + Number(worker.workerAmount || 0),
                                    0
                                  )
                                : Number(service.workerAmount || 0)
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tổng tiền */}
            <div className="p-3">
              <div className="bg-white dark:bg-[#1e1e2d] rounded-xl p-4 border border-slate-200 dark:border-slate-700/50 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Tổng linh kiện</span>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    {formatCurrency(
                      workOrder.partsUsed?.reduce(
                        (s, p) => s + p.price * p.quantity,
                        0
                      ) || 0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Tổng dịch vụ</span>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    {formatCurrency(
                      workOrder.additionalServices?.reduce(
                        (s, svc) => s + svc.price * (svc.quantity || 1),
                        0
                      ) || 0
                    )}
                  </span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-slate-500 dark:text-slate-400 text-xs">Tiền công sửa</span>
                  <span className="text-slate-900 dark:text-white font-medium text-sm">
                    {formatCurrency(workOrder.laborTotal || workOrder.laborCost || 0)}
                  </span>
                </div>
                {(workOrder.discount || 0) > 0 && (
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-slate-500 dark:text-slate-400 text-xs">Giảm giá</span>
                    <span className="text-red-500 dark:text-red-400 font-medium text-sm">
                      -{formatCurrency(workOrder.discount || 0)}
                    </span>
                  </div>
                )}
                <div className="border-t border-slate-200 dark:border-slate-700 pt-3 mt-2 flex items-center justify-between">
                  <span className="text-base font-bold text-slate-900 dark:text-white uppercase">
                    TỔNG CỘNG
                  </span>
                  <span className="text-xl font-black text-blue-600 dark:text-blue-500">
                    {formatCurrency(workOrder.total)}
                  </span>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700/30 flex items-center justify-between text-xs">
                  <span className="text-slate-500 dark:text-slate-400">Trạng thái thanh toán</span>
                  <span
                    className={`font-bold flex items-center gap-1.5 ${
                      workOrder.paymentStatus === "paid"
                        ? "text-emerald-600 dark:text-emerald-400"
                        : "text-amber-600 dark:text-amber-400"
                    }`}
                  >
                    {workOrder.paymentStatus === "paid" ? (
                      <>
                        <CheckCircle className="w-3.5 h-3.5" />
                        Đã thanh toán
                      </>
                    ) : (
                      <>
                        <Clock className="w-3.5 h-3.5" />
                        Chưa thanh toán
                      </>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Footer - Nút chỉnh sửa */}
          {onSwitchToEdit && (
            <div className="flex-shrink-0 p-3 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={onSwitchToEdit}
                className="w-full py-3.5 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white rounded-xl font-bold text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-500/20"
              >
                ✏️ Chỉnh sửa phiếu
              </button>
            </div>
          )}
        </div>

        {/* Desktop View */}
        <div className="hidden md:block max-w-2xl w-full max-h-[90vh] bg-white dark:bg-slate-800 rounded-xl shadow-2xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-white dark:bg-slate-800 text-slate-900 dark:text-white">
            <h2 className="text-base font-bold">
              Chi tiết phiếu #{formatWorkOrderId(workOrder.id)}
            </h2>
            <div className="flex items-center gap-2">
              {onSwitchToEdit && (
                <button
                  type="button"
                  onClick={onSwitchToEdit}
                  className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  ✏️ Chỉnh sửa
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
            <div className="text-center text-slate-500 py-8">
              Vui lòng bấm "Chỉnh sửa" để xem và sửa chi tiết phiếu
            </div>
          </div>
        </div>
      </div>
    );
  }

  // EDIT MODE - Form chỉnh sửa (code mới dùng sub-components)
  return (
    <div
      className="fixed inset-0 bg-black/50 z-[100] flex items-end md:items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Chỉnh sửa phiếu sửa chữa"
    >
      {/* Mobile Full Screen */}
      <div className="md:hidden w-full h-full bg-slate-50 dark:bg-[#151521] flex flex-col transition-colors">
        {/* Header containing Tabs Navigation */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1e1e2d] px-2.5 py-1 flex items-center justify-between border-b border-slate-200 dark:border-slate-700/50">
          <div className="flex items-center">
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center gap-1.5 flex-1 justify-around overflow-x-auto scrollbar-hide ml-2">
            {[
              { id: "info", label: "Thông tin", icon: User },
              { id: "issue", label: "Sự cố", icon: AlertTriangle },
              { id: "parts", label: "Linh kiện", icon: Package },
              { id: "payment", label: "T.Toán", icon: DollarSign },
            ].map((tab) => {
              const isActive = activeSection === tab.id;
              const Icon = tab.icon;
              return (
                <button
                  type="button"
                  key={tab.id}
                  onClick={() => setActiveSection(tab.id as any)}
                  className={`flex flex-col items-center gap-0.5 px-3 py-1 border-b-2 transition-all ${
                    isActive
                      ? "border-blue-600 text-blue-600 dark:text-blue-400"
                      : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? "fill-current/10" : ""}`} />
                  <span className="text-[10px] font-bold uppercase">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto pb-24 bg-slate-50 dark:bg-[#151521]">
          <div className="p-2.5 space-y-3">
            {activeSection === "info" && (
              <WorkOrderMobileInfoSection
                status={status}
                setStatus={setStatus}
                isTechnicianLockedForStaff={isTechnicianLockedForStaff}
                employees={employees}
                effectiveSelectedTechnicianId={effectiveSelectedTechnicianId}
                setSelectedTechnicianId={setSelectedTechnicianId}
                showCustomerSearch={showCustomerSearch}
                setShowCustomerSearch={setShowCustomerSearch}
                customerSearchTerm={customerSearchTerm}
                setCustomerSearchTerm={setCustomerSearchTerm}
                filteredCustomers={filteredCustomers}
                handleSelectCustomer={handleSelectCustomer}
                hasMoreCustomers={hasMoreCustomers}
                handleLoadMoreCustomers={handleLoadMoreCustomers}
                isSearchingCustomer={isSearchingCustomer}
                setShowAddCustomer={setShowAddCustomer}
                setNewCustomerPhone={setNewCustomerPhone}
                setNewCustomerName={setNewCustomerName}
                selectedCustomer={selectedCustomer}
                setSelectedCustomer={setSelectedCustomer}
                isEditingCustomer={isEditingCustomer}
                setIsEditingCustomer={setIsEditingCustomer}
                editCustomerName={editCustomerName}
                setEditCustomerName={setEditCustomerName}
                editCustomerPhone={editCustomerPhone}
                setEditCustomerPhone={setEditCustomerPhone}
                handleSaveEditedCustomer={handleSaveEditedCustomer}
                selectedVehicle={selectedVehicle}
                setSelectedVehicle={setSelectedVehicle}
                customerVehicles={customerVehicles}
                handleSelectVehicle={handleSelectVehicle}
                setShowAddVehicle={setShowAddVehicle}
                activeWarranty={activeWarranty}
              />
            )}

            {activeSection === "issue" && (
              <WorkOrderMobileIssueSection
                selectedVehicle={selectedVehicle}
                setActiveSection={setActiveSection}
                currentKm={currentKm}
                setCurrentKm={setCurrentKm}
                isPatternMode={isPatternMode}
                setIsPatternMode={setIsPatternMode}
                issueDescription={issueDescription}
                setIssueDescription={setIssueDescription}
                devicePhotos={devicePhotos}
                handleAddDevicePhoto={handleAddDevicePhoto}
                handleRemoveDevicePhoto={handleRemoveDevicePhoto}
                isUploadingPhoto={isUploadingPhoto}
              />
            )}

            {activeSection === "parts" && (
              <WorkOrderMobilePartsSection
                selectedVehicle={selectedVehicle}
                setActiveSection={setActiveSection}
                selectedCustomer={selectedCustomer}
                selectedParts={selectedParts}
                setSelectedParts={setSelectedParts}
                getPartLaborBase={getPartLaborBase}
                getPartWarranty={getPartWarranty}
                getIntegratedLaborByQuantity={getIntegratedLaborByQuantity}
                formatNumberWithDots={formatNumberWithDots}
                parseFormattedNumber={parseFormattedNumber}
                formatCurrency={formatCurrency}
                handleRemovePart={handleRemovePart}
                handleUpdatePartQuantity={handleUpdatePartQuantity}
                setShowPartSearch={setShowPartSearch}
                setShowAddManualPart={setShowAddManualPart}
                additionalServices={additionalServices}
                setAdditionalServices={setAdditionalServices}
                handleRemoveService={handleRemoveService}
                setShowAddService={setShowAddService}
              />
            )}

            {activeSection === "payment" && (
              <WorkOrderMobilePaymentSection
                selectedVehicle={selectedVehicle}
                setActiveSection={setActiveSection}
                status={status}
                workOrder={workOrder}
                isDeposit={isDeposit}
                setIsDeposit={setIsDeposit}
                depositAmount={depositAmount}
                setDepositAmount={setDepositAmount}
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                showPaymentInput={showPaymentInput}
                setShowPaymentInput={setShowPaymentInput}
                partialAmount={partialAmount}
                setPartialAmount={setPartialAmount}
                includeIntegratedLabor={includeIntegratedLabor}
                setIncludeIntegratedLabor={setIncludeIntegratedLabor}
                discount={discount}
                setDiscount={setDiscount}
                discountType={discountType}
                setDiscountType={setDiscountType}
                partsTotal={partsTotal}
                servicesTotal={servicesTotal}
                effectiveLaborCost={effectiveLaborCost}
                total={total}
                remainingPreview={remainingPreview}
                additionalPaymentPreview={additionalPaymentPreview}
                discountAmount={discountAmount}
                formatNumberWithDots={formatNumberWithDots}
                parseFormattedNumber={parseFormattedNumber}
                formatCurrency={formatCurrency}
              />
            )}
          </div>
        </div>

        {/* STICKY FOOTER - Action Buttons */}
        <div className="flex-shrink-0 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-slate-700 p-2">
          {/* Row 1: Print/Share buttons - only show when editing existing order */}
          {workOrder?.id && (
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => {
                  window.print();
                }}
                className="flex-1 py-2 bg-slate-100 dark:bg-[#2b2b40] text-slate-500 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Printer className="w-3.5 h-3.5" />
                In phiếu
              </button>
              <button
                type="button"
                onClick={() => {
                  if (navigator.share) {
                    navigator
                      .share({
                        title: `Phiếu sửa chữa #${workOrder!.id}`,
                        text: `Phiếu sửa chữa cho ${selectedCustomer?.name || workOrder!.customerName
                          } - ${selectedVehicle?.licensePlate ||
                          workOrder!.licensePlate
                          }`,
                      })
                      .catch(() => { });
                  } else {
                    alert(
                      "Chức năng chia sẻ không khả dụng trên trình duyệt này"
                    );
                  }
                }}
                className="flex-1 py-2 bg-slate-100 dark:bg-[#2b2b40] text-slate-500 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs flex items-center justify-center gap-1.5"
              >
                <Share2 className="w-3.5 h-3.5" />
                Chia sẻ
              </button>
            </div>
          )}
          {/* Row 2: Main action buttons */}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2.5 bg-slate-100 dark:bg-[#2b2b40] text-slate-500 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-xs"
            >
              Hủy
            </button>
            {/* Nút Lưu Phiếu - luôn hiển thị */}
            <button
              type="button"
              onClick={() => {
                void handleSave();
              }}
              disabled={isSubmitting}
              className="flex-1 py-2.5 bg-slate-600 hover:bg-slate-500 rounded-lg font-medium text-white transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? "⏳ Đang lưu..." : "💾 LƯU"}
            </button>
            {/* Nút Đặt cọc - chỉ hiển thị khi có đặt cọc và không phải trạng thái Trả máy */}
            {status !== "Trả máy" && isDeposit && depositAmount > 0 && (
              <button
                type="button"
                onClick={() => {
                  void handleSave();
                }}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium text-white transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "⏳ Đang xử lý..." : "💰 ĐẶT CỌC"}
              </button>
            )}
            {/* Nút Thanh toán - chỉ hiển thị khi trạng thái Trả máy */}
            {status === "Trả máy" && (
              <button
                type="button"
                onClick={handlePayFull}
                disabled={isSubmitting}
                className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg font-medium text-white transition-colors text-xs disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "⏳ Đang xử lý..." : "✅ THANH TOÁN"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Desktop - Keep Original (Not Changed) */}
      <div className="hidden md:block">
        {/* Desktop modal would go here - keeping original unchanged */}
      </div>

      {/* Part Search Top Sheet - Fixed at top for keyboard visibility */}
      {showPartSearch && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex flex-col">
          {/* Top Sheet Container - positioned at TOP so input is always visible above keyboard */}
          <div
            className="w-full bg-slate-50 dark:bg-[#151521] rounded-b-2xl flex flex-col transition-colors"
            style={{ maxHeight: "60vh" }}
          >
            {/* Header */}
            <div className="flex-shrink-0 p-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-slate-900 dark:text-white font-semibold text-sm">
                🔍 Tìm linh kiện
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowPartSearch(false);
                  setPartSearchTerm("");
                }}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search Input - Always visible at top */}
            <div className="flex-shrink-0 p-3 bg-slate-50 dark:bg-[#151521]">
              {/* Part Search Input */}
              <div className="flex gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                  <input
                    type="text"
                    value={partSearchTerm}
                    onChange={(e) => setPartSearchTerm(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && partSearchTerm.trim()) {
                        e.preventDefault();
                        const firstMatch = filteredParts[0];
                        if (firstMatch) {
                          const stock = firstMatch.stock?.[currentBranchId] || 0;
                          if (stock <= 0) {
                            showToast.error("Sản phẩm đã hết hàng!");
                            return;
                          }
                          handleAddPart(firstMatch);
                        }
                      }
                    }}
                    placeholder="Quét hoặc nhập mã phụ tùng..."
                    className="w-full pl-10 pr-4 py-3 bg-white dark:bg-[#2b2b40] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                    autoFocus
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setActiveScanField("part")}
                  className="p-3 bg-blue-600 hover:bg-blue-700 rounded-xl text-white flex items-center justify-center transition-colors"
                  title="Quét bằng camera"
                >
                  <ScanBarcode className="w-5 h-5" />
                </button>
              </div>
              <p className="text-xs text-slate-400 dark:text-slate-500">
                Nhấn Enter để thêm nhanh phụ tùng đầu tiên • Dùng camera để quét mã vạch
              </p>
            </div>

            {/* Results Count & List - Scrollable */}
            <div
              ref={partResultsRef}
              className="flex-1 overflow-y-auto px-3 pb-3 overscroll-contain"
            >
              {partSearchTerm && (
                <div className="mb-2 px-1 text-xs text-slate-400">
                  Tìm thấy{" "}
                  <span className="text-emerald-400 font-semibold">
                    {filteredParts.length}
                  </span>{" "}
                  phụ tùng
                  {filteredParts.length > 50 && " (hiển thị 50 đầu tiên)"}
                </div>
              )}
              <div className="space-y-2">
                {filteredParts.slice(0, 50).map((part) => {
                  const stock = part.stock?.[currentBranchId] || 0;
                  const price = part.retailPrice?.[currentBranchId] || 0;
                  const warrantyText = getWarrantyText(part);
                  const partLaborCost =
                    Number((part as any)?.laborCost?.[currentBranchId]) ||
                    Number(part.wholesalePrice?.[currentBranchId]) ||
                    0;
                  return (
                    <div
                      key={part.id}
                      onClick={() => {
                        if (stock <= 0) {
                          showToast.error("Sản phẩm đã hết hàng!");
                          return;
                        }
                        handleAddPart(part);
                      }}
                      className="p-2.5 bg-white dark:bg-[#1e1e2d] rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-[#2b2b40] active:bg-blue-600/20 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="text-slate-900 dark:text-white font-medium text-xs">
                            {part.name}
                          </div>
                          <div className="text-[11px] text-blue-400 font-mono mt-0.5">
                            SKU: {part.sku} • Tồn: {stock}
                          </div>
                          <div className="text-[11px] text-cyan-400 mt-0.5">
                            Công: {formatCurrency(partLaborCost)}
                          </div>
                          {warrantyText && (
                            <div className="text-[11px] text-emerald-400 mt-0.5 font-semibold">
                              Bảo hành: {warrantyText}
                            </div>
                          )}
                          {part.category && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 mt-1 rounded-full text-[9px] font-medium ${
                                getCategoryColor(part.category).bg
                              } ${getCategoryColor(part.category).text}`}
                            >
                              {part.category}
                            </span>
                          )}
                        </div>
                        <div className="text-[#50cd89] font-bold text-xs flex-shrink-0">
                          {formatCurrency(price)}
                        </div>
                      </div>
                    </div>
                  );
                })}
                {filteredParts.length > 50 && (
                  <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 italic border-t border-slate-100 dark:border-slate-600 rounded-b-lg">
                    Đang hiển thị 50/{filteredParts.length} kết quả. Vui lòng tìm kiếm chi tiết hơn.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Tap outside to close */}
          <div
            className="flex-1"
            onClick={() => {
              setShowPartSearch(false);
              setPartSearchTerm("");
            }}
          />
        </div>
      )}

      {/* Add Service Modal - Bottom Sheet Design */}
      {showAddService && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center md:justify-center">
          <div className="w-full md:max-w-md bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-900 dark:text-white font-semibold text-base">
                THÊM DỊCH VỤ BÊN NGOÀI
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddService(false);
                  setNewServiceName("");
                  setNewServicePrice(0);
                  setNewServiceQuantity(1);
                }}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Service Name */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300 mb-2">
                  Tên dịch vụ / Mô tả:
                </label>
                <input
                  type="text"
                  value={newServiceName}
                  onChange={(e) => setNewServiceName(e.target.value)}
                  placeholder="VD: Unlock iCloud, Flash ROM, Jailbreak..."
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-[#009ef7] focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Quantity Stepper */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Số lượng:
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setNewServiceQuantity(Math.max(1, newServiceQuantity - 1))
                    }
                    className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                  >
                    −
                  </button>
                  <div className="w-20 h-12 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center">
                    <span className="text-slate-900 dark:text-white text-xl font-bold">
                      {newServiceQuantity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNewServiceQuantity(newServiceQuantity + 1)
                    }
                    className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Price Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">
                  GIÁ BÁN
                </h4>
                <div className="grid grid-cols-1 gap-3">
                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs text-[#ffc700] mb-1.5 font-medium">
                      Đơn giá (Báo khách):
                    </label>
                    <div className="relative">
                      <NumberInput
                        value={newServicePrice}
                        onChange={(val: number) => setNewServicePrice(val)}
                        allowNegative={true}
                        placeholder="0"
                        className="w-full px-3 py-3 pr-8 bg-slate-50 dark:bg-[#151521] border-2 border-[#009ef7] rounded-lg text-slate-900 dark:text-white text-sm font-semibold focus:border-[#0077c7] focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#009ef7] text-xs font-bold pointer-events-none">
                        đ
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Amount - Auto Calculate */}
              <div className="p-4 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 text-sm">
                    Thành tiền (Tự tính):
                  </span>
                  <span className="text-[#50cd89] text-xl font-bold">
                    {formatCurrency(newServicePrice * newServiceQuantity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Button */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                type="button"
                onClick={handleAddService}
                disabled={!newServiceName.trim()}
                className="w-full py-4 bg-gradient-to-r from-[#009ef7] to-purple-600 hover:from-[#0077c7] hover:to-purple-700 disabled:from-slate-700 disabled:to-slate-700 disabled:cursor-not-allowed text-white font-bold text-sm rounded-lg transition-all shadow-lg"
              >
                LƯU VÀO PHIẾU
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Manual Part Modal - Similar to Add Service */}
      {showAddManualPart && (
        <div className="fixed inset-0 bg-black/70 z-[110] flex items-end md:items-center md:justify-center">
          <div className="w-full md:max-w-md bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden transition-colors">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-slate-900 dark:text-white font-semibold text-base">
                THÊM LINH KIỆN TỰ DO
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowAddManualPart(false);
                  setNewManualPartName("");
                  setNewManualPartCost(0);
                  setNewManualPartPrice(0);
                  setNewManualPartQuantity(1);
                }}
                className="p-1.5 text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Part Name */}
              <div>
                <label className="block text-sm font-medium text-slate-500 dark:text-slate-300 mb-2">
                  Tên linh kiện:
                </label>
                <input
                  type="text"
                  value={newManualPartName}
                  onChange={(e) => setNewManualPartName(e.target.value)}
                  placeholder="Nhập tên (VD: Màn hình iPhone 14, Pin Samsung...)"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:border-purple-500 focus:outline-none transition-colors"
                  autoFocus
                />
              </div>

              {/* Quantity Stepper */}
              <div>
                <label className="block text-sm font-medium text-slate-300 mb-2">
                  Số lượng:
                </label>
                <div className="flex items-center justify-center gap-4">
                  <button
                    type="button"
                    onClick={() =>
                      setNewManualPartQuantity(Math.max(1, newManualPartQuantity - 1))
                    }
                    className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                  >
                    −
                  </button>
                  <div className="w-20 h-12 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg flex items-center justify-center">
                    <span className="text-slate-900 dark:text-white text-xl font-bold">
                      {newManualPartQuantity}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setNewManualPartQuantity(newManualPartQuantity + 1)
                    }
                    className="w-12 h-12 bg-slate-100 dark:bg-[#2b2b40] hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-900 dark:text-white text-2xl font-bold transition-colors"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Cost & Price Section */}
              <div>
                <h4 className="text-sm font-semibold text-slate-500 dark:text-slate-300 mb-3 uppercase tracking-wide">
                  CHI PHÍ & GIÁ BÁN
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  {/* Cost Price */}
                  <div>
                    <label className="block text-xs text-slate-500 mb-1.5">
                      Giá nhập (Vốn):
                    </label>
                    <div className="relative">
                      <NumberInput
                        value={newManualPartCost}
                        onChange={(val: number) => setNewManualPartCost(val)}
                        placeholder="0"
                        className="w-full px-3 py-3 pr-8 bg-slate-50 dark:bg-[#151521] border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 dark:text-slate-400 text-sm focus:border-slate-400 dark:focus:border-slate-600 focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-xs">
                        ₫
                      </span>
                    </div>
                  </div>

                  {/* Selling Price */}
                  <div>
                    <label className="block text-xs text-purple-400 mb-1.5">
                      Giá bán (Khách):
                    </label>
                    <div className="relative">
                      <NumberInput
                        value={newManualPartPrice}
                        onChange={(val: number) => setNewManualPartPrice(val)}
                        placeholder="0"
                        className="w-full px-3 py-3 pr-8 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/30 rounded-lg text-purple-600 dark:text-purple-400 font-semibold text-sm focus:border-purple-500 focus:outline-none transition-colors"
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-purple-400 text-xs">
                        ₫
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Total Preview */}
              <div className="p-4 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-500/30 rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    Tổng cộng:
                  </span>
                  <span className="text-xl font-bold text-purple-600 dark:text-purple-400">
                    {formatCurrency(newManualPartPrice * newManualPartQuantity)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddManualPart(false);
                  setNewManualPartName("");
                  setNewManualPartCost(0);
                  setNewManualPartPrice(0);
                  setNewManualPartQuantity(1);
                }}
                className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleAddManualPart}
                disabled={!newManualPartName}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-purple-500/20"
              >
                ✓ Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Vehicle Modal - Premium Redesign */}
      {showAddVehicle && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-[#1e1e2d] rounded-3xl p-5 border border-slate-200 dark:border-slate-700/50 shadow-2xl transition-colors">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base">Thêm thiết bị mới</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAddVehicle(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 active:scale-95 transition-all"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  IMEI / SERIAL NUMBER
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newVehiclePlate}
                    onChange={(e) => setNewVehiclePlate(e.target.value)}
                    placeholder="VD: 123456789012345"
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all font-mono uppercase"
                  />
                  <button
                    type="button"
                    onClick={() => setActiveScanField("vehicle")}
                    className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl active:scale-95 transition-all"
                  >
                    <ScanBarcode className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="space-y-1.5 relative">
                <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">
                  Tên thiết bị / Model
                </label>
                <input
                  type="text"
                  value={newVehicleName}
                  onChange={(e) => {
                    setNewVehicleName(e.target.value);
                    setShowVehicleDropdown(true);
                  }}
                  onFocus={() => setShowVehicleDropdown(true)}
                  placeholder="Chọn hoặc nhập tên thiết bị"
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all"
                />
                {/* Vehicle Model Dropdown */}
                {showVehicleDropdown && (
                  <div className="absolute z-20 w-full mt-1 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl max-h-[200px] overflow-y-auto scrollbar-hide">
                    {POPULAR_DEVICES.filter((model) =>
                      model.toLowerCase().includes(newVehicleName.toLowerCase())
                    )
                      .slice(0, 10)
                      .map((model) => (
                        <button
                          key={model}
                          type="button"
                          onClick={() => {
                            setNewVehicleName(model);
                            setShowVehicleDropdown(false);
                          }}
                          className="w-full text-left px-4 py-3 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-700/50 last:border-0 transition-colors"
                        >
                          {model}
                        </button>
                      ))}
                    {POPULAR_DEVICES.filter((model) =>
                      model.toLowerCase().includes(newVehicleName.toLowerCase())
                    ).length === 0 && (
                      <div className="px-4 py-3 text-xs text-slate-500 text-center italic">
                        Không tìm thấy - nhập tên thiết bị mới
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddVehicle(false)}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-bold text-xs active:scale-95 transition-all"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAddVehicle}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold text-xs shadow-lg shadow-blue-500/20 active:scale-95 transition-all"
                >
                  Thêm thiết bị
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Customer Modal - Unified */}
      {showAddCustomer && (
        <CustomerModal
          customer={{} as any}
          existingCustomers={customers}
          onSave={(savedCustomer) => {
            const customerId = savedCustomer.id || `CUST-${Date.now()}`;
            const primaryVehicle = savedCustomer.vehicles?.find((v: any) => v.isPrimary) || savedCustomer.vehicles?.[0];

            const vehicles: Vehicle[] = savedCustomer.vehicles || [];
            if (vehicles.length === 0 && (savedCustomer.vehicleModel || savedCustomer.licensePlate)) {
              vehicles.push({
                id: `VEH-${Date.now()}`,
                model: savedCustomer.vehicleModel || "",
                licensePlate: savedCustomer.licensePlate || "",
                isPrimary: true,
              } as Vehicle);
            }

            const newCustomerObj: Customer = {
              id: customerId,
              name: savedCustomer.name || "",
              phone: savedCustomer.phone || "",
              vehicles: vehicles,
              vehicleModel: primaryVehicle?.model || savedCustomer.vehicleModel || "",
              licensePlate: primaryVehicle?.licensePlate || savedCustomer.licensePlate || "",
              status: "active",
              segment: "New",
              loyaltyPoints: 0,
              totalSpent: 0,
              visitCount: 1,
              lastVisit: new Date().toISOString(),
              created_at: new Date().toISOString(),
            };

            if (upsertCustomer) {
              upsertCustomer(newCustomerObj);
            }

            setSelectedCustomer(newCustomerObj);
            if (vehicles.length > 0) {
              setSelectedVehicle(vehicles[0]);
            }

            setShowCustomerSearch(false);
            setShowAddCustomer(false);
            setCustomerSearchTerm("");
          }}
          onClose={() => setShowAddCustomer(false)}
        />
      )}

      {/* Barcode Scanner Overlay - Global for Part/Vehicle/Customer */}
      <ScannerModal
        isOpen={!!activeScanField}
        onClose={() => setActiveScanField(null)}
        onScan={(barcode: string) => {
          if (activeScanField === "part") {
            setPartSearchTerm(barcode);
            const exactMatch = filteredParts.find(
              (p) => p.sku?.toLowerCase() === barcode.toLowerCase() ||
                p.barcode?.toLowerCase() === barcode.toLowerCase()
            );
            if (exactMatch) {
              const stock = exactMatch.stock?.[currentBranchId] || 0;
              if (stock <= 0) {
                showToast.error("Sản phẩm đã hết hàng!");
                return;
              }
              handleAddPart(exactMatch);
            }
          } else if (activeScanField === "vehicle") {
            setNewVehiclePlate(barcode);
            showToast.success("Đã quét S/N thành công!");
          } else if (activeScanField === "customer") {
            setNewCustomerLicensePlate(barcode);
            showToast.success("Đã quét S/N thành công!");
          }
        }}
        title={activeScanField === "part" ? "Quét mã phụ tùng" : "Quét IMEI/Serial"}
      />
    </div>
  );
};
