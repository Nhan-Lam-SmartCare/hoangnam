import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQueryClient, useQuery } from "@tanstack/react-query";

import {
  FileText,
  Wrench,
  Check,
  Settings,
  TrendingUp,
  Search,
  Plus,
  Smartphone,
  PhoneCall,
  HandCoins,
  Printer,
  History,
  ChevronDown,
  Edit2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";
import { canDo } from "../../utils/permissions";
import type { WorkOrder } from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import {
  useDeleteWorkOrderRepo,
  useWorkOrdersFilteredRepo,
  useWorkOrdersRealtime,
  useRefundWorkOrderRepo,
} from "../../hooks/useWorkOrdersRepository";
import { useProfilesForTechnicians } from "../../hooks/useProfilesRepository";
import type { RepairTemplate } from "../../hooks/useRepairTemplatesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useEmployeesDirectoryRepo } from "../../hooks/useEmployeesRepository";
// Debt repository hooks no longer needed here — saveWorkOrder handles debt sync
import { showToast } from "../../utils/toast";
import { printElementById } from "../../utils/print";
import { shareBlobNative } from "../../utils/nativeShare";
import { usePrinter } from "../../hooks/usePrinter";
import { WorkOrderMobileModal } from "../service/WorkOrderMobileModal";
import WorkOrderModal from "../service/components/WorkOrderModal";
import { ServiceManagerMobile } from "../service/ServiceManagerMobile";
import PrintOrderPreviewModal from "../service/modals/PrintOrderPreviewModal";
import StatusBadge from "../service/components/StatusBadge";
import { getQuickStatusFilters } from "../service/components/quickStatusFiltersData";
import { getStatusSnapshotCards } from "../service/components/statusSnapshotCardsData";
import { RepairTemplatesModal } from "../service/components/RepairTemplatesModal";
import { ServiceInsights } from "../service/components/ServiceInsights";
import { ServiceActionBar } from "../service/components/ServiceActionBar";
import { ServiceTable } from "../service/components/ServiceTable";
import { WorkOrderReceiptTemplate } from "./components/WorkOrderReceiptTemplate";
import { USER_ROLES } from "../../constants";

// Import custom hooks and types
import { useServiceStats } from "../service/hooks/useServiceStats";
import { useServiceFilters } from "../service/hooks/useServiceFilters";
import { useWorkOrderPrinter } from "./hooks/useWorkOrderPrinter";
import {
  StoreSettings,
  WorkOrderStatus,
  ServiceTabKey,
  FILTER_BADGE_CLASSES,
  getDateFilterLabel,
} from "../service/types/service.types";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import {
  PAGE_SIZE,
} from "../service/constants/service.constants";
import {
  downloadImage,
  fetchStoreSettingsForBranch,
  formatMaskedPhone,
  generateWorkOrderTextReceipt,
  handleCallCustomer as callCustomer,
  sanitizeIssueDescriptionForPrint,
} from "../service/utils/service.utils";
import { templateToWorkOrderDraft } from "../service/utils/templateConversion.utils";

// Local types removed - now imported from ./types/service.types

export default function ServiceManager() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth(); // Get user profile early for createCustomerDebtIfNeeded
  const isOwner = profile?.role === USER_ROLES.OWNER; // Check if user is owner
  const canCreateWorkOrder = canDo(profile, "work_order.create");
  const canUpdateWorkOrder = canDo(profile, "work_order.update");
  const canDeleteWorkOrder = canDo(profile, "work_order.delete");
  const canPrintWorkOrder = canDo(profile, "work_order.print");
  const canRefundWorkOrder = canDo(profile, "work_order.refund");
  const canViewServiceHistory = canDo(profile, "work_order.history.view");
  const canUpdateWorkOrderStatus = canDo(profile, "work_order.status.update");
  const canUpdateWorkOrderPayment = canDo(profile, "work_order.payment.update");
  const canUpdateWorkOrderParts = canDo(profile, "work_order.parts.update");
  const canUpdateWorkOrderLabor = canDo(profile, "work_order.labor.update");
  const canUpdateWorkOrderDiscount = canDo(profile, "work_order.discount.update");
  const canUpdateWorkOrderCustomer = canDo(profile, "work_order.customer.update");
  const canUpdateWorkOrderVehicle = canDo(profile, "work_order.vehicle.update");
  const canUpdateWorkOrderOutsourceService = canDo(
    profile,
    "work_order.outsource_service.update"
  );
  const canManageAllWorkOrders = profile?.role === USER_ROLES.OWNER;

  const {
    parts: contextParts,
    customers,
    employees,
    upsertCustomer,
    setCashTransactions,
    setPaymentSources,
    paymentSources,
    currentBranchId,
    workOrders,
    setWorkOrders,
  } = useAppContext();

  // POPULAR_MOTORCYCLES moved to constants/service.constants.ts

  // Fetch parts from Supabase
  const { data: fetchedParts, isLoading: partsLoading } = usePartsRepo();

  // Worker dropdown only needs the salary-free directory (staff-safe).
  const { data: fetchedEmployees, isLoading: _employeesLoading } =
    useEmployeesDirectoryRepo();

  // State for date range filter
  const [dateRangeDays, setDateRangeDays] = useState<number>(7); // Default 7 days

  const [fetchLimit, setFetchLimit] = useState<number>(100);

  // Fetch work orders from Supabase with filtering (optimized)
  const {
    data: fetchedWorkOrders,
    isLoading: workOrdersLoading,
    isFetching: workOrdersFetching,
    isError: workOrdersIsError,
    error: workOrdersError,
    refetch: refetchWorkOrders,
  } = useWorkOrdersFilteredRepo({
    limit: fetchLimit,
    daysBack: dateRangeDays,
    branchId: currentBranchId,
    ownerUserId: undefined,
    ownerDisplayName: undefined,
  });

  // Use context data directly for better performance
  // Prioritize contextParts to match Dashboard logic (cached costs)
  // Fallback to fetchedParts if context is empty
  const parts = contextParts.length > 0 ? contextParts : (fetchedParts || []);
  const displayCustomers = customers;
  const { data: profiles = [] } = useProfilesForTechnicians();

  const displayEmployees = useMemo(() => {
    const map = new Map<string, any>();

    // 1. Add from fetchedEmployees (from employees_directory / employees table)
    if (fetchedEmployees && fetchedEmployees.length > 0) {
      fetchedEmployees.forEach((emp: any) => {
        if (emp.name) {
          map.set(emp.name.toLowerCase().trim(), emp);
        }
      });
    }

    // 2. Add from context employees
    if (employees && employees.length > 0) {
      employees.forEach((emp: any) => {
        if (emp.name) {
          map.set(emp.name.toLowerCase().trim(), emp);
        }
      });
    }

    // 3. Fallback/merge from profiles (who are staff or manager, or have names)
    if (profiles && profiles.length > 0) {
      profiles.forEach((prof: any) => {
        const name = prof.name || prof.full_name;
        if (!name) return;
        
        const key = name.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, {
            id: prof.id,
            name: name,
            email: prof.email,
            role: prof.role,
            status: "active",
            branchId: prof.branch_id || prof.branchId || "CN1",
          });
        }
      });
    }

    return Array.from(map.values());
  }, [fetchedEmployees, employees, profiles]);
  const displayWorkOrders = fetchedWorkOrders || workOrders;
  const defaultStaffTechnicianName = useMemo(() => {
    if (profile?.role !== USER_ROLES.STAFF) return "";

    const normalizedProfileEmail = String(profile?.email || "")
      .trim()
      .toLowerCase();
    const normalizedProfileName = String(profile?.name || profile?.full_name || "")
      .trim()
      .toLowerCase();

    if (!normalizedProfileEmail && !normalizedProfileName) return "";

    const activeEmployees = (displayEmployees || []).filter(
      (emp) => String(emp?.status || "").trim().toLowerCase() !== "inactive"
    );

    const matchedByEmail = activeEmployees.find(
      (emp) =>
        String(emp?.email || "")
          .trim()
          .toLowerCase() === normalizedProfileEmail
    );
    if (matchedByEmail?.name) return matchedByEmail.name;

    const matchedByName = activeEmployees.find(
      (emp) =>
        String(emp?.name || "")
          .trim()
          .toLowerCase() === normalizedProfileName
    );

    return matchedByName?.name || "";
  }, [
    displayEmployees,
    profile?.email,
    profile?.full_name,
    profile?.name,
    profile?.role,
  ]);

  // Sync fetched work orders to context
  useEffect(() => {
    if (fetchedWorkOrders) {
      setWorkOrders(fetchedWorkOrders);
    }
  }, [fetchedWorkOrders, setWorkOrders]);

  // 🔹 REALTIME SUBSCRIPTION - Auto refresh when work orders change
  useWorkOrdersRealtime(refetchWorkOrders);

  const [showModal, setShowModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileModalViewMode, setMobileModalViewMode] = useState(false); // true = xem chi tiết, false = chỉnh sửa
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | undefined>(
    undefined
  );

  const {
    filters: { searchQuery, activeTab, dateFilter, technicianFilter, paymentFilter },
    debouncedSearchQuery,
    visibleCount,
    filteredOrders,
    paginatedOrders,
    hasMoreOrders,
    setSearchQuery,
    setActiveTab,
    setDateFilter,
    setTechnicianFilter,
    setPaymentFilter,
    loadMore,
  } = useServiceFilters({
    workOrders: displayWorkOrders,
    stats: { pending: 0, inProgress: 0, done: 0, delivered: 0, filteredRevenue: 0, filteredProfit: 0 },
    dateFilteredOrders: [],
  });

  const [showProfit, setShowProfit] = useState(false); // Toggle profit visibility
  const [rowActionMenuId, setRowActionMenuId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{
    top?: number;
    bottom?: number;
    right: number;
  }>({
    top: 0,
    right: 0,
  });

  // Sync dateFilter with dateRangeDays for API query
  useEffect(() => {
    // If searching, ignore date filter (search all history)
    if (debouncedSearchQuery) {
      setDateRangeDays(0);
      return;
    }

    if (dateFilter === "all") {
      setDateRangeDays(0); // 0 = load all data (no date filter)
    } else if (dateFilter === "today") {
      setDateRangeDays(1);
    } else if (dateFilter === "week") {
      setDateRangeDays(7);
    } else if (dateFilter === "month") {
      setDateRangeDays(30);
    }
  }, [dateFilter, debouncedSearchQuery]);

  useEffect(() => {
    if (profile?.role !== USER_ROLES.STAFF) return;
    if (!defaultStaffTechnicianName) return;

    if (technicianFilter === "all") {
      setTechnicianFilter(defaultStaffTechnicianName);
    }
  }, [defaultStaffTechnicianName, profile?.role, technicianFilter, setTechnicianFilter]);

  useEffect(() => {
    // Increase limit when searching to find older records
    if (debouncedSearchQuery) {
      setFetchLimit(1000);
    } else {
      setFetchLimit(100);
    }
  }, [dateRangeDays, currentBranchId, debouncedSearchQuery]);

  // Track mobile state for responsive layout
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const location = useLocation();

  // Read status filter from URL query params (e.g., ?status=pending)
  useEffect(() => {
    const statusParam = searchParams.get("status");
    if (statusParam === "pending") {
      // Set to pending tab (Tiếp nhận + Đang sửa)
      setActiveTab("pending");
      // Clear the query param after applying
      searchParams.delete("status");
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  // Handle navigation from ServiceHistory with editOrder state
  useEffect(() => {
    const state = location.state as { editOrder?: WorkOrder } | null;
    if (state?.editOrder) {
      const currentUserId = String(profile?.id || "").trim();
      const creatorId = String(
        state.editOrder.created_by ||
          state.editOrder.createdBy ||
          state.editOrder.createdby ||
          ""
      ).trim();
      const profileName = String(profile?.name || profile?.full_name || "")
        .trim()
        .toLowerCase();
      const technicianName = String(state.editOrder.technicianName || "")
        .trim()
        .toLowerCase();
      const isOwnerOrder = creatorId
        ? !!currentUserId && creatorId === currentUserId
        : !!profileName && !!technicianName && profileName === technicianName;

      if (!(canUpdateWorkOrder && (canManageAllWorkOrders || isOwnerOrder))) {
        showToast.error("Bạn chỉ có thể sửa phiếu do chính bạn tạo");
        window.history.replaceState({}, document.title);
        return;
      }
      // Set the editing order and open modal
      setEditingOrder(state.editOrder);
      setShowModal(true);
      // Clear the navigation state to prevent re-opening on re-render
      window.history.replaceState({}, document.title);
    }
  }, [
    location.state,
    canUpdateWorkOrder,
    canManageAllWorkOrders,
    profile?.id,
    profile?.name,
    profile?.full_name,
  ]);

  // State and printer callbacks from useWorkOrderPrinter hook
  const {
    printOrder,
    showPrintPreview,
    storeSettings: printerStoreSettings,
    handlePrintOrder,
    handleDoPrint,
    closePrintPreview,
  } = useWorkOrderPrinter(currentBranchId);

  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );

  // Fetch store settings for branch
  useEffect(() => {
    let active = true;
    async function loadSettings() {
      try {
        const settings = await fetchStoreSettingsForBranch(currentBranchId);
        if (active) {
          setStoreSettings(settings);
        }
      } catch (err) {
        console.error("Error fetching store settings:", err);
      }
    }
    loadSettings();
    return () => {
      active = false;
    };
  }, [currentBranchId]);

  // State for refund modal
  const [refundingOrder, setRefundingOrder] = useState<WorkOrder | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  const isOwnWorkOrder = useCallback(
    (order?: Partial<WorkOrder>) => {
      if (!order?.id) return true;

      const currentUserId = String(profile?.id || "").trim();
      if (!currentUserId) return false;

      const creatorId = String(
        order.created_by || order.createdBy || order.createdby || ""
      ).trim();
      if (creatorId) return creatorId === currentUserId;

      const profileName = String(profile?.name || profile?.full_name || "")
        .trim()
        .toLowerCase();
      const technicianName = String(order.technicianName || "")
        .trim()
        .toLowerCase();
      return !!profileName && !!technicianName && profileName === technicianName;
    },
    [profile?.id, profile?.name, profile?.full_name]
  );

  const canModifyOrder = useCallback(
    (order?: Partial<WorkOrder>) =>
      canUpdateWorkOrder && (canManageAllWorkOrders || isOwnWorkOrder(order)),
    [canUpdateWorkOrder, canManageAllWorkOrders, isOwnWorkOrder]
  );

  const canDeleteOrder = useCallback(
    (order?: Partial<WorkOrder>) =>
      canDeleteWorkOrder && (canManageAllWorkOrders || isOwnWorkOrder(order)),
    [canDeleteWorkOrder, canManageAllWorkOrders, isOwnWorkOrder]
  );

  // downloadImage moved to ./utils/service.utils.ts

  // Open modal automatically if navigated from elsewhere with editOrder state

  useEffect(() => {
    if (!rowActionMenuId) return;
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".service-row-menu")) {
        setRowActionMenuId(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [rowActionMenuId]);

  const showTableSkeleton =
    (workOrdersLoading || workOrdersFetching) &&
    (displayWorkOrders?.length ?? 0) === 0;
  const showTableError =
    workOrdersIsError && (displayWorkOrders?.length ?? 0) === 0;

  const handleLoadMore = useCallback(() => {
    loadMore();
    const loadedCount =
      fetchedWorkOrders?.length ?? displayWorkOrders?.length ?? 0;
    if (!workOrdersFetching && loadedCount >= fetchLimit) {
      setFetchLimit((l) => l + 100);
    }
  }, [loadMore, displayWorkOrders?.length, fetchLimit, fetchedWorkOrders?.length, workOrdersFetching]);

  // Scroll-to-load: auto load more when sentinel becomes visible
  useEffect(() => {
    const sentinel = document.getElementById("service-table-scroll-sentinel");
    if (!sentinel || !hasMoreOrders || workOrdersFetching) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          handleLoadMore();
        }
      },
      { threshold: 0.1, rootMargin: "200px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [handleLoadMore, hasMoreOrders, workOrdersFetching]);

  // ========================================
  // USE CUSTOM HOOK FOR STATS (Refactored!)
  // ========================================
  // Replaced 80+ lines of inline stats calculation with single hook call
  const {
    stats,
    dateFilteredOrders,
    totalOpenTickets,
    urgentTickets,
    urgentRatio,
    completionRate,
    profitMargin,
  } = useServiceStats({
    workOrders: displayWorkOrders,
    dateFilter: dateFilter as "all" | "today" | "week" | "month",
    parts: parts, // Pass parts for cost lookup
    currentBranchId: currentBranchId,
  });

  // quickStatusFilters and statusSnapshotCards moved to components
  const quickStatusFilters = getQuickStatusFilters(
    stats,
    dateFilteredOrders.filter(
      (o) => o.status !== "Trả máy" && o.status !== "Đã hủy" && !o.refunded
    ).length
  );
  const statusSnapshotCards = getStatusSnapshotCards(stats);

  const handleOpenModal = (order?: WorkOrder) => {
    if (order && !canModifyOrder(order)) {
      showToast.error("Bạn chỉ có thể sửa phiếu do chính bạn tạo");
      return;
    }

    if (!order && !canCreateWorkOrder) {
      showToast.error("Bạn không có quyền tạo phiếu sửa chữa");
      return;
    }

    if (order) {
      setEditingOrder(order);
    } else {
      // Create empty order template
      setEditingOrder({
        id: "",
        customerName: "",
        customerPhone: "",
        vehicleModel: "",
        licensePlate: "",
        issueDescription: "",
        technicianName: "",
        status: "Tiếp nhận",
        laborCost: 0,
        discount: 0,
        partsUsed: [],
        total: 0,
        branchId: currentBranchId,
        paymentStatus: "unpaid",
        creationDate: new Date().toISOString(),
      } as WorkOrder);
    }
    setShowModal(true);
  };



  // Handle print work order - show preview modal with permission check
  const handlePrintOrderWithPermission = useCallback((order: WorkOrder) => {
    if (!canPrintWorkOrder) {
      showToast.error("Bạn không có quyền in phiếu sửa chữa");
      return;
    }
    handlePrintOrder(order);
  }, [canPrintWorkOrder, handlePrintOrder]);

  // 🔹 Handle refund work order
  const { mutateAsync: refundWorkOrderAsync } = useRefundWorkOrderRepo();

  // 🔹 Handle delete work order
  const { mutateAsync: deleteWorkOrderAsync } = useDeleteWorkOrderRepo();

  // Phase 7: handleMobileSave (517 dòng) đã bị xoá — mobile lưu trực tiếp qua
  // useWorkOrderMobileFormState → useWorkOrderMobileSubmit → useWorkOrderSave.
  // Các helper (notification, vehicle km/maintenance, customer stats, ghi sổ quỹ)
  // chuyển sang hooks/useWorkOrderMobileSubmit.ts.

  const handleRefundOrder = (order: WorkOrder) => {
    if (!canRefundWorkOrder) {
      showToast.error("Bạn không có quyền hủy/hoàn tiền phiếu sửa chữa");
      return;
    }

    setRefundingOrder(order);
    setRefundReason("");
    setShowRefundModal(true);
  };

  const handleConfirmRefund = async () => {
    if (!refundingOrder) return;

    if (!refundReason.trim()) {
      showToast.error("Vui lòng nhập lý do hủy");
      return;
    }

    try {

      const result = await refundWorkOrderAsync({
        orderId: refundingOrder.id,
        refundReason: refundReason,
      });


      // Check if mutation succeeded
      if (!result || (result as any).error) {
        console.error("[handleConfirmRefund] Refund failed:", result);
        showToast.error("Không thể hủy đơn sửa chữa");
        return;
      }

      // Update context cash transactions and payment sources
      if (
        result &&
        "refund_transaction_id" in result &&
        "refundAmount" in result &&
        result.refund_transaction_id &&
        result.refundAmount
      ) {
        const refundAmount = result.refundAmount as number;
        setCashTransactions((prev: any[]) => [
          ...prev,
          {
            id: result.refund_transaction_id,
            type: "refund",
            category: "refund",
            amount: -refundAmount,
            date: new Date().toISOString(),
            description: `Hoàn tiền hủy phiếu ${
              formatWorkOrderId(
                refundingOrder.id,
                storeSettings?.work_order_prefix
              ) || ""
            } - ${refundReason}`,
            branchId: currentBranchId,
            paymentSource: refundingOrder.paymentMethod,
            reference: refundingOrder.id,
          },
        ]);

        if (refundingOrder.paymentMethod) {
          setPaymentSources((prev: any[]) =>
            prev.map((ps) => {
              if (ps.id === refundingOrder.paymentMethod) {
                return {
                  ...ps,
                  balance: {
                    ...ps.balance,
                    [currentBranchId]:
                      (ps.balance[currentBranchId] || 0) - refundAmount,
                  },
                };
              }
              return ps;
            })
          );
        }
      }

      // Update work orders state
      const refundedOrderId = (result as any)?.id || refundingOrder.id;
      setWorkOrders((prev) =>
        prev.map((wo) =>
          wo.id === refundingOrder.id || wo.id === refundedOrderId
            ? { ...wo, refunded: true, status: "Đã hủy" as any }
            : wo
        )
      );

      showToast.success("Đã hủy đơn sửa chữa thành công");
      setShowRefundModal(false);
      setRefundingOrder(null);
      setRefundReason("");
    } catch (error) {
      console.error("Error refunding work order:", error);
      showToast.error("Lỗi khi hủy đơn sửa chữa");
    }
  };

  const clearFilters = useCallback(() => {
    setSearchQuery("");
    setActiveTab("all");
    setTechnicianFilter(
      profile?.role === USER_ROLES.STAFF && defaultStaffTechnicianName
        ? defaultStaffTechnicianName
        : "all"
    );
    setPaymentFilter("all");
    setDateFilter("week");
  }, [profile?.role, defaultStaffTechnicianName, setSearchQuery, setActiveTab, setTechnicianFilter, setPaymentFilter, setDateFilter]);

  // Handle delete work order - using hook for proper query invalidation
  const handleDelete = async (workOrder: WorkOrder) => {
    if (!canDeleteOrder(workOrder)) {
      showToast.error("Bạn chỉ có thể xóa phiếu do chính bạn tạo");
      return;
    }

    if (!confirm(`Xác nhận xóa phiếu ${formatWorkOrderId(workOrder.id)}?`)) {
      return;
    }
    try {
      await deleteWorkOrderAsync({ id: workOrder.id });
      // Note: Toast and query invalidation are handled by the hook's onSuccess
    } catch (error) {
      console.error("Error deleting work order:", error);
      // Note: Error toast is handled by the hook's onError
    }
  };

  // Handle apply template
  const handleApplyRepairTemplate = (template: RepairTemplate) => {
    const newOrder = templateToWorkOrderDraft(template, {
      branchId: currentBranchId,
      generateId: false,
    });
    setEditingOrder(newOrder);

    if (isMobile) {
      setMobileModalViewMode(false);
      setShowMobileModal(true);
    } else {
      setShowModal(true);
    }
  };

  // Mobile view - Check screen width
  if (isMobile) {
    return (
      <>
        <ServiceManagerMobile
          workOrders={displayWorkOrders || []}
          canCreateWorkOrder={canCreateWorkOrder}
          canUpdateWorkOrder={canUpdateWorkOrder}
          canDeleteWorkOrder={canDeleteWorkOrder}
          canPrintWorkOrder={canPrintWorkOrder}
          canViewServiceHistory={canViewServiceHistory}
          isLoading={workOrdersLoading || workOrdersFetching}
          onRefresh={async () => { await refetchWorkOrders(); }}
          onCreateWorkOrder={() => {
            if (!canCreateWorkOrder) {
              showToast.error("Bạn không có quyền tạo phiếu sửa chữa");
              return;
            }

            setEditingOrder({
              id: "",
              customerName: "",
              customerPhone: "",
              vehicleModel: "",
              licensePlate: "",
              issueDescription: "",
              technicianName: "",
              status: "Tiếp nhận",
              laborCost: 0,
              discount: 0,
              partsUsed: [],
              total: 0,
              branchId: currentBranchId,
              paymentStatus: "unpaid",
              creationDate: new Date().toISOString(),
            } as WorkOrder);
            setMobileModalViewMode(false); // Tạo mới = edit mode
            setShowMobileModal(true);
          }}
          onEditWorkOrder={(workOrder) => {
            setEditingOrder(workOrder);
            setMobileModalViewMode(true); // Click vào phiếu = view mode trước
            setShowMobileModal(true);
          }}
          onDeleteWorkOrder={handleDelete}
          onCallCustomer={callCustomer}
          onPrintWorkOrder={handlePrintOrderWithPermission}
          onOpenTemplates={() => setShowTemplateModal(true)}
          onApplyTemplate={handleApplyRepairTemplate}
          currentBranchId={currentBranchId}
          dateFilter={dateFilter}
          setDateFilter={(v) => setDateFilter(v as any)}
          setDateRangeDays={setDateRangeDays}
        />

        {/* Mobile Modal */}
        <WorkOrderMobileModal
          isOpen={showMobileModal}
          onClose={() => {
            setShowMobileModal(false);
            setEditingOrder(undefined);
            setMobileModalViewMode(false);
          }}
          workOrder={editingOrder}
          customers={displayCustomers}
          parts={parts}
          employees={displayEmployees || []}
          currentBranchId={currentBranchId}
          upsertCustomer={upsertCustomer}
          storeSettings={storeSettings}
          canModifyWorkOrder={canModifyOrder}
          viewMode={mobileModalViewMode}
          onSwitchToEdit={
            editingOrder && canModifyOrder(editingOrder)
              ? () => setMobileModalViewMode(false)
              : undefined
          }
          canUpdateWorkOrderStatus={canUpdateWorkOrderStatus}
          canUpdateWorkOrderPayment={canUpdateWorkOrderPayment}
          canUpdateWorkOrderParts={canUpdateWorkOrderParts}
          canUpdateWorkOrderLabor={canUpdateWorkOrderLabor}
          canUpdateWorkOrderDiscount={canUpdateWorkOrderDiscount}
          canUpdateWorkOrderCustomer={canUpdateWorkOrderCustomer}
          canUpdateWorkOrderVehicle={canUpdateWorkOrderVehicle}
          canUpdateWorkOrderOutsourceService={canUpdateWorkOrderOutsourceService}
        />

        {/* Mobile Print Preview Modal */}
        <PrintOrderPreviewModal
          isOpen={showPrintPreview}
          onClose={closePrintPreview}
          printOrder={printOrder}
          storeSettings={printerStoreSettings || storeSettings || undefined}
          onPrint={handleDoPrint}
        />
        {/* Hidden Print Template for Mobile */}
        {printOrder && (
          <WorkOrderReceiptTemplate
            id="work-order-receipt"
            workOrder={printOrder}
            storeSettings={printerStoreSettings || storeSettings || undefined}
          />
        )}


        {/* Repair Templates Modal for Mobile */}
        <RepairTemplatesModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onApplyTemplate={(template) => {
            // Convert and apply template to current work order for mobile
            const newOrder = templateToWorkOrderDraft(template, {
              branchId: currentBranchId,
              generateId: true,
              prefix: storeSettings?.work_order_prefix,
            });
            setEditingOrder(newOrder);
            setShowTemplateModal(false);
            setShowModal(true); // Use Desktop modal
          }}
          parts={fetchedParts || []}
          currentBranchId={currentBranchId}
        />
      </>
    );
  }

  return (
    <div className="service-screen space-y-3 mx-auto w-full max-w-[1800px] px-3 sm:px-4 xl:px-6 2xl:px-8">
      {/* Desktop insight cards */}
      <ServiceInsights
        urgentTickets={urgentTickets}
        urgentRatio={urgentRatio}
        totalOpenTickets={totalOpenTickets}
        completionRate={completionRate}
        stats={stats}
        statusSnapshotCards={statusSnapshotCards}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isOwner={isOwner}
        dateFilter={dateFilter}
        profitMargin={profitMargin}
        showProfit={showProfit}
      />

      {/* Quick status filters - Hidden on desktop (lg+) since we have the stat cards above */}
      <div className="lg:hidden bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-3 flex flex-wrap items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Trạng thái nhanh
        </span>
        <div className="flex flex-wrap gap-2">
          {quickStatusFilters.map((filter) => (
            <button
              key={filter.key}
              onClick={() =>
                setActiveTab(activeTab === filter.key ? "all" : filter.key)
              }
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition ${activeTab === filter.key
                ? "border-blue-500 bg-blue-50 text-blue-600 dark:bg-blue-900/20"
                : "border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-300"
                }`}
            >
              <span>{filter.label}</span>
              <span
                className={`text-xs font-semibold px-2 py-0.5 rounded-full ${FILTER_BADGE_CLASSES[filter.color]
                  }`}
              >
                {filter.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Action Bar - Single row on desktop */}
      <ServiceActionBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        dateFilter={dateFilter}
        onDateFilterChange={(v) => setDateFilter(v as any)}
        technicianFilter={technicianFilter}
        onTechnicianFilterChange={setTechnicianFilter}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={(v) => setPaymentFilter(v as any)}
        employees={employees}
        workOrdersFetching={workOrdersFetching}
        onRefresh={() => refetchWorkOrders()}
        onClearFilters={clearFilters}
        isOwner={isOwner}
        showProfit={showProfit}
        onToggleProfit={() => setShowProfit(!showProfit)}
        onOpenTemplates={() => setShowTemplateModal(true)}
        canViewServiceHistory={canViewServiceHistory}
        canCreateWorkOrder={canCreateWorkOrder}
        onCreateWorkOrder={() => handleOpenModal()}
      />

      <ServiceTable
        paginatedOrders={paginatedOrders}
        filteredOrders={filteredOrders}
        visibleCount={visibleCount}
        hasMoreOrders={hasMoreOrders}
        showTableSkeleton={showTableSkeleton}
        showTableError={showTableError}
        workOrdersError={workOrdersError}
        workOrdersIsError={workOrdersIsError}
        workOrdersFetching={workOrdersFetching}
        displayWorkOrdersCount={displayWorkOrders?.length ?? 0}
        storeSettings={storeSettings}
        currentBranchId={currentBranchId}
        isOwner={isOwner}
        showProfit={showProfit}
        canCreateWorkOrder={canCreateWorkOrder}
        canPrintWorkOrder={canPrintWorkOrder}
        canRefundWorkOrder={canRefundWorkOrder}
        canManageAllWorkOrders={canManageAllWorkOrders}
        canModifyOrder={canModifyOrder}
        rowActionMenuId={rowActionMenuId}
        setRowActionMenuId={setRowActionMenuId}
        dropdownPosition={dropdownPosition}
        setDropdownPosition={setDropdownPosition}
        onOpenModal={handleOpenModal}
        onPrintOrder={handlePrintOrderWithPermission}
        onCallCustomer={callCustomer}
        onRefundOrder={handleRefundOrder}
        onClearFilters={clearFilters}
        onRefresh={() => refetchWorkOrders()}
        onLoadMore={handleLoadMore}
      />

      {/* Repair Templates Modal - Component tách riêng */}
      <RepairTemplatesModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApplyTemplate={(template) => {
          // Convert and apply template to current work order
          const newOrder = templateToWorkOrderDraft(template, {
            branchId: currentBranchId,
            generateId: true,
            prefix: storeSettings?.work_order_prefix,
          });
          setEditingOrder(newOrder);
          setShowTemplateModal(false);
          setShowModal(true);
        }}
        parts={fetchedParts || []}
        currentBranchId={currentBranchId}
      />

      {/* Work Order Modal */}
      {
        showModal && editingOrder && (
          <WorkOrderModal
            order={editingOrder}
            onClose={() => {
              setShowModal(false);
              setEditingOrder(undefined);
            }}
            onSave={() => {
              // React Query hooks already invalidate queries on success
              // Just close modal - data will auto-refresh via invalidateQueries
              setShowModal(false);
              setEditingOrder(undefined);
            }}
            parts={parts}
            partsLoading={partsLoading}
            customers={displayCustomers}
            employees={displayEmployees}
            upsertCustomer={upsertCustomer}
            setCashTransactions={setCashTransactions}
            setPaymentSources={setPaymentSources}
            paymentSources={paymentSources}
            currentBranchId={currentBranchId}
            storeSettings={storeSettings}
            canUpdateWorkOrderStatus={canUpdateWorkOrderStatus}
            canUpdateWorkOrderPayment={canUpdateWorkOrderPayment}
            canUpdateWorkOrderParts={canUpdateWorkOrderParts}
            canUpdateWorkOrderLabor={canUpdateWorkOrderLabor}
            canUpdateWorkOrderDiscount={canUpdateWorkOrderDiscount}
            canUpdateWorkOrderCustomer={canUpdateWorkOrderCustomer}
            canUpdateWorkOrderVehicle={canUpdateWorkOrderVehicle}
            canUpdateWorkOrderOutsourceService={canUpdateWorkOrderOutsourceService}
            invalidateWorkOrders={() =>
              queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] })
            }
          />
        )
      }

      <PrintOrderPreviewModal
        isOpen={showPrintPreview}
        onClose={closePrintPreview}
        printOrder={printOrder}
        storeSettings={printerStoreSettings || storeSettings || undefined}
        onPrint={handleDoPrint}
      />
      {/* Print Template (Hidden - only for actual printing) */}
      {printOrder && (
        <WorkOrderReceiptTemplate
          id="work-order-receipt"
          workOrder={printOrder}
          storeSettings={printerStoreSettings || storeSettings || undefined}
        />
      )}

      {/* Refund Modal */}
      {
        showRefundModal && refundingOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-md">
              <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl">
                <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                  Xác nhận hủy phiếu
                </h2>
                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setRefundingOrder(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>

              <div className="p-6 space-y-4">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <AlertTriangle className="w-4 h-4 inline-block mr-1 align-[-2px]" />
                    <strong>Cảnh báo:</strong> Hành động này sẽ:
                  </p>
                  <ul className="mt-2 text-sm text-yellow-700 dark:text-yellow-300 list-disc list-inside space-y-1">
                    <li>Hoàn trả tồn kho các phụ tùng đã sử dụng</li>
                    <li>
                      Hoàn tiền {formatCurrency(refundingOrder.totalPaid || 0)}{" "}
                      cho khách
                    </li>
                    <li>Đánh dấu phiếu là "Đã hủy"</li>
                  </ul>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Lý do hủy phiếu <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={refundReason}
                    onChange={(e) => setRefundReason(e.target.value)}
                    placeholder="Vd: Khách hàng không đồng ý chi phí, sửa nhầm máy..."
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 resize-none"
                    rows={3}
                  />
                </div>

                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-3 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Phiếu:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {formatWorkOrderId(
                        refundingOrder.id,
                        storeSettings?.work_order_prefix
                      )}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Khách hàng:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {refundingOrder.customerName}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">
                      Phụ tùng:
                    </span>
                    <span className="font-medium text-slate-900 dark:text-slate-100">
                      {refundingOrder.partsUsed?.length || 0} món
                    </span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 dark:border-slate-600 pt-2">
                    <span className="text-slate-600 dark:text-slate-400">
                      Số tiền hoàn:
                    </span>
                    <span className="font-bold text-red-600 dark:text-red-400">
                      {formatCurrency(refundingOrder.totalPaid || 0)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 dark:bg-slate-700/50 px-6 py-4 flex justify-end gap-3 rounded-b-xl">
                <button
                  onClick={() => {
                    setShowRefundModal(false);
                    setRefundingOrder(null);
                  }}
                  className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg font-medium"
                >
                  Hủy bỏ
                </button>
                <button
                  onClick={handleConfirmRefund}
                  disabled={!refundReason.trim()}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-300 dark:disabled:bg-red-900 text-white rounded-lg font-medium disabled:cursor-not-allowed"
                >
                  Xác nhận hủy phiếu
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}

// StatusBadge component moved to ./components/StatusBadge.tsx
