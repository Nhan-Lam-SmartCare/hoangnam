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
import type {
  WorkOrder,
  WorkOrderPart,
  Customer,
} from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
  generateWorkOrderId,
} from "../../utils/format";
import {
  completeWorkOrderPayment,
  recordWorkOrderPaymentTransactions,
} from "../../lib/repository/workOrdersRepository";
import { syncRepairOrderServices } from "../../lib/repository/repairLaborRepository";
import { createNotification } from "../../lib/repository/notificationsRepository";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
  useRefundWorkOrderRepo,
  useDeleteWorkOrderRepo,
  useWorkOrdersFilteredRepo,
} from "../../hooks/useWorkOrdersRepository";
import type { RepairTemplate } from "../../hooks/useRepairTemplatesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useEmployeesDirectoryRepo } from "../../hooks/useEmployeesRepository";
import {
  useCreateCustomerDebtRepo,
  useUpdateCustomerDebtRepo,
} from "../../hooks/useDebtsRepository";
import { showToast } from "../../utils/toast";
import { printElementById } from "../../utils/print";
import { shareBlobNative } from "../../utils/nativeShare";
import { usePrinter } from "../../hooks/usePrinter";
import { supabase } from "../../supabaseClient";
import { WorkOrderMobileModal } from "../service/WorkOrderMobileModal";
import WorkOrderModal from "../service/components/WorkOrderModal";
import { ServiceManagerMobile } from "../service/ServiceManagerMobile";
import PrintOrderPreviewModal from "../service/modals/PrintOrderPreviewModal";
import StatusBadge from "../service/components/StatusBadge";
import { getQuickStatusFilters } from "../service/components/quickStatusFiltersData";
import { getStatusSnapshotCards } from "../service/components/statusSnapshotCardsData";
import {
  detectMaintenancesFromWorkOrder,
  updateVehicleMaintenances,
} from "../../utils/maintenanceReminder";
import { RepairTemplatesModal } from "../service/components/RepairTemplatesModal";
import { ServiceInsights } from "../service/components/ServiceInsights";
import { ServiceActionBar } from "../service/components/ServiceActionBar";
import { ServiceTable } from "../service/components/ServiceTable";
import { WorkOrderReceiptTemplate } from "./components/WorkOrderReceiptTemplate";
import { USER_ROLES } from "../../constants";

// Import custom hooks and types
import { useServiceStats } from "../service/hooks/useServiceStats";
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

// Local types removed - now imported from ./types/service.types

const iconMap: Record<string, React.ComponentType<any>> = {
  Wrench: Wrench,
  Settings: Settings,
  Check: Check,
  HandCoins: HandCoins,
};

const _serviceTemplates = [
  {
    name: "Cài đặt Windows",
    description: "Cài đặt Windows 11, cập nhật driver, phần mềm cơ bản",
    laborCost: 150000,
    duration: 60,
    parts: [],
  },
  {
    name: "Thay màn hình điện thoại",
    description: "Thay màn hình zin/linh kiện, kiểm tra cảm ứng",
    laborCost: 100000,
    duration: 45,
    parts: [
      { name: "Màn hình iPhone 13 Pro Max", quantity: 1, price: 8500000 },
    ],
  },
  {
    name: "Vệ sinh & Bảo dưỡng Laptop",
    description: "Vệ sinh máy, thay keo tản nhiệt, kiểm tra quạt",
    laborCost: 200000,
    duration: 90,
    parts: [
      { name: "Keo tản nhiệt Arctic MX-4", quantity: 1, price: 50000 },
    ],
  },
];

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
  const { data: profiles = [] } = useQuery({
    queryKey: ["profilesForTechnicians", currentBranchId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, name, full_name, email, role, branch_id")
        .order("name");
      if (error) return [];
      return data || [];
    },
  });

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
  useEffect(() => {

    const channel = supabase
      .channel("work_orders_realtime")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to INSERT, UPDATE, DELETE
          schema: "public",
          table: "work_orders",
        },
        (_payload) => {
          // Refetch work orders to get latest data
          refetchWorkOrders();
        }
      )
      .subscribe((_status) => {
      });

    // Cleanup on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetchWorkOrders]);

  const [showModal, setShowModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileModalViewMode, setMobileModalViewMode] = useState(false); // true = xem chi tiết, false = chỉnh sửa
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300); // Debounce search for better performance
  const [_statusFilter, _setStatusFilter] = useState<"all" | WorkOrderStatus>(
    "all"
  );
  const [activeTab, setActiveTab] = useState<ServiceTabKey>("all");
  const [dateFilter, setDateFilter] = useState("week"); // Default to 7 days
  const [technicianFilter, setTechnicianFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [showProfit, setShowProfit] = useState(false); // Toggle profit visibility
  const [rowActionMenuId, setRowActionMenuId] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    right: 0,
  });

  // PAGE_SIZE imported from constants
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

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
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, activeTab, dateFilter, technicianFilter, paymentFilter]);

  useEffect(() => {
    if (profile?.role !== USER_ROLES.STAFF) return;
    if (!defaultStaffTechnicianName) return;

    setTechnicianFilter((prev) =>
      prev === "all" ? defaultStaffTechnicianName : prev
    );
  }, [defaultStaffTechnicianName, profile?.role]);

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
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [_isSharing, setIsSharing] = useState(false);
  const printableIssueDescription = sanitizeIssueDescriptionForPrint(
    printOrder?.issueDescription
  );

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

  // Share invoice as image function
  const _handleShareInvoice = async () => {
    if (!invoicePreviewRef.current || !printOrder) return;

    setIsSharing(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(invoicePreviewRef.current, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
      });

      const fileName = `phieu-sua-chua-${formatWorkOrderId(printOrder.id)}.png`;
      const title = `Phiếu sửa chữa ${formatWorkOrderId(printOrder.id)}`;

      if (await shareBlobNative(blob, fileName, title)) {
        showToast.success("Đã mở chia sẻ phiếu thành công!");
      } else {
        downloadImage(blob, fileName);
      }
    } catch (error) {
      if ((error as Error).name !== "AbortError") {
        console.error("Error sharing invoice:", error);
        showToast.error("Không thể chia sẻ phiếu");
      }
    } finally {
      setIsSharing(false);
    }
  };

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

  const filteredOrders = useMemo(() => {
    let filtered = displayWorkOrders.filter(
      (o) => !o.refunded && o.status !== "Đã hủy"
    );
    const normalizedQuery = debouncedSearchQuery.toLowerCase().trim();
    const normalizedPhoneQuery = normalizedQuery.replace(/\D/g, "");

    // Apply status filter based on active tab ONLY if not searching
    // If searching, we want to look through ALL history (Global Search)
    if (!debouncedSearchQuery) {
      if (activeTab === "delivered") {
        filtered = filtered.filter((o) => o.status === "Trả máy");
      } else {
        filtered = filtered.filter((o) => o.status !== "Trả máy");

        if (activeTab === "pending")
          filtered = filtered.filter((o) => o.status === "Tiếp nhận");
        else if (activeTab === "inProgress")
          filtered = filtered.filter((o) => o.status === "Đang sửa");
        else if (activeTab === "done")
          filtered = filtered.filter((o) => o.status === "Đã sửa xong");
      }
    }

    // Search filter (using debounced value)
    if (debouncedSearchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.customerName.toLowerCase().includes(normalizedQuery) ||
          o.vehicleModel?.toLowerCase().includes(normalizedQuery) ||
          o.licensePlate?.toLowerCase().includes(normalizedQuery) ||
          o.id?.toLowerCase().includes(normalizedQuery) ||
          (!!normalizedPhoneQuery &&
            (o.customerPhone || "").replace(/\D/g, "").includes(normalizedPhoneQuery))
      );
    }

    // Date filter
    // 🔹 QUAN TRỌNG: Chỉ áp dụng date filter cho phiếu "Trả máy" (đã hoàn thành)
    // Phiếu đang sửa chữa (Tiếp nhận, Đang sửa, Đã sửa xong) LUÔN hiển thị bất kể ngày tạo
    if (dateFilter !== "all" && !debouncedSearchQuery) {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((o) => {
        // Phiếu chưa hoàn thành → luôn hiển thị
        if (o.status !== "Trả máy") {
          return true;
        }

        // Phiếu đã trả máy → áp dụng date filter
        const orderDate = new Date(o.creationDate || (o as any).creationdate);

        if (dateFilter === "today") {
          return orderDate >= today;
        } else if (dateFilter === "week") {
          const weekAgo = new Date(today);
          weekAgo.setDate(weekAgo.getDate() - 7);
          return orderDate >= weekAgo;
        } else if (dateFilter === "month") {
          const monthAgo = new Date(today);
          monthAgo.setMonth(monthAgo.getMonth() - 1);
          return orderDate >= monthAgo;
        }
        return true;
      });
    }

    // Technician filter
    if (technicianFilter !== "all") {
      filtered = filtered.filter((o) => o.technicianName === technicianFilter);
    }

    // Payment filter
    if (paymentFilter !== "all") {
      filtered = filtered.filter((o) => {
        const status = o.paymentStatus || (o as any).paymentstatus;
        if (paymentFilter === "paid") return status === "paid";
        if (paymentFilter === "unpaid") return status === "unpaid";
        if (paymentFilter === "partial") return status === "partial";
        return true;
      });
    }

    return filtered.sort((a, b) => {
      const dateA = a.creationDate || (a as any).creationdate;
      const dateB = b.creationDate || (b as any).creationdate;
      if (!dateA || !dateB) return 0;
      return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  }, [
    displayWorkOrders,
    activeTab,
    debouncedSearchQuery, // Use debounced value to reduce re-renders
    dateFilter,
    technicianFilter,
    paymentFilter,
  ]);

  const paginatedOrders = useMemo(
    () => filteredOrders.slice(0, visibleCount),
    [filteredOrders, visibleCount]
  );
  const hasMoreOrders = filteredOrders.length > visibleCount;
  const showTableSkeleton =
    (workOrdersLoading || workOrdersFetching) &&
    (displayWorkOrders?.length ?? 0) === 0;
  const showTableError =
    workOrdersIsError && (displayWorkOrders?.length ?? 0) === 0;

  const handleLoadMore = useCallback(() => {
    setVisibleCount((c) => c + PAGE_SIZE);
    const loadedCount =
      fetchedWorkOrders?.length ?? displayWorkOrders?.length ?? 0;
    if (!workOrdersFetching && loadedCount >= fetchLimit) {
      setFetchLimit((l) => l + 100);
    }
  }, [displayWorkOrders?.length, fetchLimit, fetchedWorkOrders?.length, workOrdersFetching]);

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

  const _handleApplyTemplate = (template: (typeof _serviceTemplates)[0]) => {
    const newOrder: Partial<WorkOrder> = {
      id: "",
      customerName: "",
      customerPhone: "",
      vehicleModel: "",
      licensePlate: "",
      issueDescription: template.description,
      laborCost: template.laborCost,
      partsUsed: template.parts.map((p, idx) => ({
        partId: `TEMPLATE-${idx}`,
        partName: p.name,
        sku: "",
        quantity: p.quantity,
        price: p.price,
      })),
      status: "Tiếp nhận",
      paymentStatus: "unpaid",
      discount: 0,
      total: 0,
      creationDate: new Date().toISOString(),
      branchId: currentBranchId,
      technicianName: "",
    };
    setEditingOrder(newOrder as WorkOrder);
    setShowTemplateModal(false);
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

  // 🔹 Handle create/update customer debts
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const _updateCustomerDebt = useUpdateCustomerDebtRepo();

  // 🔔 Helper: Create notification when work order is created
  const createWorkOrderNotification = async (
    orderId: string,
    customerName: string,
    vehicleModel: string,
    licensePlate: string,
    total: number,
    createdByName: string
  ) => {
    try {
      const res = await createNotification({
        type: "work_order",
        title: "Phiếu sửa chữa mới",
        message: `${createdByName} tạo phiếu ${orderId} - ${customerName} (${licensePlate || vehicleModel
          }) - ${formatCurrency(total)}`,
        data: {
          workOrderId: orderId,
          customerName,
          vehicleModel,
          licensePlate,
          total,
          createdBy: createdByName,
        },
        createdBy: profile?.id || null,
        recipientRole: "owner", // Gửi đến owner
        branchId: currentBranchId,
      });

      if (!res.ok) {
        console.error("❌ Error creating notification:", res.error.cause);
      }
    } catch (err) {
      console.error("❌ Error in createWorkOrderNotification:", err);
    }
  };

  // Helper: Update vehicle currentKm and maintenance records
  const updateVehicleKmAndMaintenance = async (
    customer: Customer,
    vehicleId: string,
    currentKm: number,
    partsUsed: Array<{ partName: string }>,
    additionalServices: Array<{ description: string }>,
    issueDescription?: string
  ) => {
    try {
      // Find the vehicle in customer's vehicles array
      const vehicle = customer.vehicles?.find((v) => v.id === vehicleId);
      if (!vehicle) {
        console.warn(
          "[updateVehicleKmAndMaintenance] Vehicle not found:",
          vehicleId
        );
        return;
      }

      // Detect maintenance types from the work order
      const maintenanceTypes = detectMaintenancesFromWorkOrder(
        partsUsed,
        additionalServices,
        issueDescription
      );

      // Update vehicle with new km and maintenance records
      const updatedVehicle = updateVehicleMaintenances(
        { ...vehicle, currentKm },
        maintenanceTypes,
        currentKm
      );

      // Update the vehicles array
      const updatedVehicles = customer.vehicles?.map((v) =>
        v.id === vehicleId ? updatedVehicle : v
      ) || [updatedVehicle];

      // Save to database via upsertCustomer
      await upsertCustomer({
        ...customer,
        vehicles: updatedVehicles,
      });

    } catch (err) {
      console.error("[updateVehicleKmAndMaintenance] Error:", err);
      // Don't throw - this is a non-critical update
    }
  };

  // Helper: Auto-create customer debt if there's remaining amount (defined early for handleMobileSave)
  const createCustomerDebtIfNeeded = async (
    workOrder: WorkOrder,
    remainingAmount: number,
    totalAmount: number,
    paidAmount: number
  ) => {
    if (remainingAmount <= 0) return;



    try {
      const safeCustomerId =
        workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        workOrder.customerName?.trim() ||
        workOrder.customerPhone ||
        "Khách vãng lai";

      // Tạo nội dung chi tiết từ phiếu sửa chữa
      const workOrderNumber = formatWorkOrderId(
        workOrder.id,
        storeSettings?.work_order_prefix
      );

      let description = `${workOrder.vehicleModel || "Thiết bị"
        } (Phiếu sửa chữa #${workOrderNumber})`;

      // Mô tả vấn đề
      if (workOrder.issueDescription) {
        description += `\nVấn đề: ${workOrder.issueDescription}`;
      }

      // Danh sách phụ tùng đã sử dụng
      if (workOrder.partsUsed && workOrder.partsUsed.length > 0) {
        description += "\n\nPhụ tùng đã thay:";
        workOrder.partsUsed.forEach((part) => {
          description += `\n  • ${part.quantity} x ${part.partName
            } - ${formatCurrency(part.price * part.quantity)}`;
        });
      }

      // Danh sách dịch vụ bổ sung (gia công, đặt hàng)
      if (
        workOrder.additionalServices &&
        workOrder.additionalServices.length > 0
      ) {
        description += "\n\nDịch vụ:";
        workOrder.additionalServices.forEach((service) => {
          description += `\n  • ${service.quantity} x ${service.description
            } - ${formatCurrency(service.price * service.quantity)}`;
        });
      }

      // Công lao động
      if (workOrder.laborCost && workOrder.laborCost > 0) {
        description += `\n\nCông lao động: ${formatCurrency(
          workOrder.laborCost
        )}`;
      }

      // Giảm giá (nếu có)
      if (workOrder.discount && workOrder.discount > 0) {
        description += `\nGiảm giá: -${formatCurrency(workOrder.discount)}`;
      }

      // Thông tin nhân viên tạo phiếu
      const createdByDisplay = profile?.name || profile?.full_name || "N/A";
      description += `\n\nNV: ${createdByDisplay}`;

      // Thông tin nhân viên kỹ thuật
      if (workOrder.technicianName) {
        description += `\nNVKỹ thuật: ${workOrder.technicianName}`;
      }

      const payload = {
        customerId: safeCustomerId,
        customerName: safeCustomerName,
        phone: workOrder.customerPhone || null,
        licensePlate: workOrder.licensePlate || null,
        description: description,
        totalAmount: totalAmount,
        paidAmount: paidAmount,
        remainingAmount: remainingAmount,
        createdDate: new Date().toISOString().split("T")[0],
        branchId: currentBranchId,
        workOrderId: workOrder.id, // 🔹 Link debt với work order
      };

      const result = await createCustomerDebt.mutateAsync(payload as any);
      showToast.success(
        `Đã tạo/cập nhật công nợ ${remainingAmount.toLocaleString()}đ (Mã: ${result?.id || "N/A"
        })`
      );
    } catch (error) {
      console.error("Error creating/updating customer debt:", error);
      showToast.error("Không thể tạo/cập nhật công nợ tự động");
    }
  };

  // 🔹 Handle create/update work orders (for mobile)
  const { mutateAsync: createWorkOrderAtomicAsync } =
    useCreateWorkOrderAtomicRepo();
  const { mutateAsync: updateWorkOrderAtomicAsync } =
    useUpdateWorkOrderAtomicRepo();

  // 🔹 Handle Mobile Save - Similar to desktop handleSave
  const handleMobileSave = async (workOrderData: any) => {
    try {
      if (editingOrder?.id && !canModifyOrder(editingOrder)) {
        showToast.error("Bạn chỉ có thể sửa phiếu do chính bạn tạo");
        throw new Error("UNAUTHORIZED_WORK_ORDER_OWNER");
      }

      // Validate required fields
      if (!workOrderData.customer?.name) {
        showToast.error("Vui lòng nhập tên khách hàng");
        return;
      }
      if (!workOrderData.customer?.phone) {
        showToast.error("Vui lòng nhập số điện thoại");
        return;
      }

      // Extract data from workOrderData
      const {
        status,
        customer,
        vehicle,
        currentKm = 0,
        issueDescription,
        technicianId,
        parts = [],
        additionalServices = [],
        repairServices = [],
        laborCost = 0,
        discount = 0,
        total = 0,
        depositAmount = 0,
        paymentMethod,
        paymentType: _paymentType,
        totalPaid = 0,
        remainingAmount = 0,
      } = workOrderData;

      // 🔹 Ensure vehicle info is saved to customer record
      // This handles the case when a new vehicle is added during work order creation
      if (customer && vehicle && vehicle.licensePlate) {
        const existingCustomer = displayCustomers.find(
          (c: any) => c.id === customer.id || c.phone === customer.phone
        );

        if (existingCustomer) {
          // Check if this vehicle already exists in customer's vehicles
          const existingVehicles = existingCustomer.vehicles || [];
          const vehicleExists = existingVehicles.some(
            (v: any) => v.licensePlate === vehicle.licensePlate
          );

          if (!vehicleExists) {
            // Add new vehicle to customer
            const updatedCustomer = {
              ...existingCustomer,
              vehicles: [
                ...existingVehicles,
                {
                  id: vehicle.id || `veh-${Date.now()}`,
                  licensePlate: vehicle.licensePlate,
                  model: vehicle.model || "",
                  currentKm: currentKm > 0 ? currentKm : undefined,
                },
              ],
              // Also update top-level fields for legacy compatibility
              licensePlate: vehicle.licensePlate,
              vehicleModel: vehicle.model || existingCustomer.vehicleModel,
            };

            upsertCustomer(updatedCustomer);
          } else if (currentKm > 0) {
            // Vehicle exists, just update currentKm if provided
            const updatedVehicles = existingVehicles.map((v: any) =>
              v.licensePlate === vehicle.licensePlate
                ? { ...v, currentKm: currentKm }
                : v
            );
            const updatedCustomer = {
              ...existingCustomer,
              vehicles: updatedVehicles,
            };
            upsertCustomer(updatedCustomer);
          }
        } else {
          // Customer is new (created in modal), ensure it has vehicle info
          const newCustomer = {
            ...customer,
            vehicles: customer.vehicles || [
              {
                id: vehicle.id || `veh-${Date.now()}`,
                licensePlate: vehicle.licensePlate,
                model: vehicle.model || "",
                currentKm: currentKm > 0 ? currentKm : undefined,
              },
            ],
            licensePlate: vehicle.licensePlate,
            vehicleModel: vehicle.model,
          };
          upsertCustomer(newCustomer);
        }
      }

      // Determine payment status
      let paymentStatus: "unpaid" | "paid" | "partial" = "unpaid";
      // Fix: Chỉ coi là "paid" khi total > 0 VÀ totalPaid >= total
      // Nếu total = 0 nhưng có deposit → vẫn là "partial" (đặt cọc trước)
      if (total > 0 && totalPaid >= total) {
        paymentStatus = "paid";
      } else if (totalPaid > 0) {
        paymentStatus = "partial";
      }

      // Find technician name
      const technician = displayEmployees.find(
        (e: any) => e.id === technicianId
      );
      const technicianName = technician?.name || "";

      let finalOrderId = "";
      let isNew = false;
      let finalOrderData: WorkOrder | null = null;

      // 1. SAVE WORK ORDER (Blocking operation - must succeed first)
      if (!editingOrder?.id) {
        // --- NEW ORDER ---
        isNew = true;
        const orderId = `${storeSettings?.work_order_prefix || "SC"
          }-${Date.now()}`;
        finalOrderId = orderId;

        const responseData = await createWorkOrderAtomicAsync({
          id: orderId,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          discount: discount,
          partsUsed: parts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          additionalPayment:
            totalPaid > depositAmount ? totalPaid - depositAmount : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          creationDate: new Date().toISOString(),
          created_by: profile?.id || undefined,
        } as any);

        // 🔹 FIX Mobile: Fallback inventory deduction if atomic didn't do it
        if (
          (paymentStatus === "paid" || status === "Trả máy") &&
          parts.length > 0 &&
          !responseData?.inventoryDeducted
        ) {
          try {
            const deductResult = await completeWorkOrderPayment(
              orderId,
              paymentMethod || "cash",
              0 // Zero amount as it's already considered paid
            );
            if (deductResult.ok && deductResult.data.usedFallback) {
              showToast.warning(
                "Đã lưu phiếu nhưng KHO CHƯA ĐƯỢC TRỪ tự động (thiếu RPC trên database). Vui lòng liên hệ quản trị để chạy migration."
              );
            }
          } catch (err) {
            console.error("[handleMobileSave] Error in fallback deduction:", err);
          }
        }

        finalOrderData = {
          id: orderId,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          laborTotal: laborCost,
          discount: discount,
          partsUsed: parts,
          repairServices:
            repairServices.length > 0 ? repairServices : undefined,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
          creationDate: new Date().toISOString(),
        };

        showToast.success("Tạo phiếu sửa chữa thành công!");
      } else {
        // --- UPDATE ORDER ---
        finalOrderId = editingOrder.id;

        await updateWorkOrderAtomicAsync({
          id: editingOrder.id,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          discount: discount,
          partsUsed: parts,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          branchId: currentBranchId,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          depositAmount: depositAmount > 0 ? depositAmount : undefined,
          additionalPayment:
            totalPaid > depositAmount ? totalPaid - depositAmount : undefined,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
        } as any);

        // 🔹 FIX Mobile: Nếu cập nhật phiếu thành paymentStatus = 'paid' hoặc status = 'Trả máy', gọi complete_payment để trừ kho
        const wasUnpaidOrPartial = editingOrder.paymentStatus !== "paid";
        const wasNotInventoryDeducted = !editingOrder.inventoryDeducted;
        if (
          (paymentStatus === "paid" || status === "Trả máy") &&
          (wasUnpaidOrPartial || wasNotInventoryDeducted) &&
          parts.length > 0
        ) {
          try {
            const deductResult = await completeWorkOrderPayment(
              editingOrder.id,
              paymentMethod || "cash",
              0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
            );
            if (deductResult.ok && deductResult.data.usedFallback) {
              showToast.warning(
                "Đã cập nhật phiếu nhưng KHO CHƯA ĐƯỢC TRỪ tự động (thiếu RPC trên database). Vui lòng liên hệ quản trị để chạy migration."
              );
            }
          } catch (err: any) {
            console.error("[handleMobileSave] Error deducting inventory:", err);
            showToast.warning(
              "Đã cập nhật phiếu nhưng có lỗi khi trừ kho: " +
              (err.message || "Lỗi không xác định")
            );
          }
        }

        finalOrderData = {
          ...editingOrder,
          customerName: customer.name,
          customerPhone: customer.phone,
          vehicleModel: vehicle?.model || "",
          licensePlate: vehicle?.licensePlate || "",
          vehicleId: vehicle?.id || "",
          currentKm: currentKm > 0 ? currentKm : undefined,
          issueDescription: issueDescription || "",
          technicianName: technicianName,
          status: status,
          laborCost: laborCost,
          laborTotal: laborCost,
          discount: discount,
          partsUsed: parts,
          repairServices:
            repairServices.length > 0 ? repairServices : undefined,
          additionalServices:
            additionalServices.length > 0 ? additionalServices : undefined,
          total: total,
          paymentStatus: paymentStatus,
          paymentMethod: paymentMethod,
          totalPaid: totalPaid > 0 ? totalPaid : undefined,
          remainingAmount: remainingAmount,
        };

        showToast.success("Cập nhật phiếu sửa chữa thành công!");
      }

      // 🔹 Ghi sổ quỹ: thu đặt cọc + thu tiền sửa chữa.
      // Luồng mobile trước đây bỏ sót bước này → doanh thu sửa chữa không vào sổ quỹ/báo cáo.
      // Helper idempotent (chỉ ghi phần chênh lệch) nên an toàn khi lưu/sửa phiếu nhiều lần.
      if (finalOrderId && (depositAmount > 0 || totalPaid > 0)) {
        try {
          const servicePayment = Math.max(0, totalPaid - depositAmount);
          const createdTx = await recordWorkOrderPaymentTransactions({
            orderId: finalOrderId,
            customerName: customer.name,
            branchId: currentBranchId,
            paymentMethod: paymentMethod || "cash",
            depositAmount,
            servicePayment,
            workOrderPrefix: storeSettings?.work_order_prefix,
          });

          if (createdTx.length > 0) {
            setCashTransactions((prev: any[]) => [...prev, ...createdTx]);
            const addedAmount = createdTx.reduce((sum, tx) => sum + tx.amount, 0);
            const sourceId = paymentMethod || "cash";
            setPaymentSources((prev: any[]) =>
              prev.map((ps: any) =>
                ps.id === sourceId
                  ? {
                      ...ps,
                      balance: {
                        ...ps.balance,
                        [currentBranchId]:
                          (ps.balance?.[currentBranchId] || 0) + addedAmount,
                      },
                    }
                  : ps
              )
            );
            queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
          }
        } catch (err) {
          console.error("[handleMobileSave] Ghi sổ quỹ thất bại:", err);
          showToast.warning(
            "Đã lưu phiếu nhưng ghi sổ quỹ chưa thành công. Vui lòng kiểm tra lại sổ quỹ."
          );
        }
      }

      // 2. PARALLEL BACKGROUND TASKS (Fire and forget from user perspective)
      // We don't await this block to block the close modal action, 
      // but we wrap in try-catch to ensure no unhandled promise rejections if we wanted to
      // or just trust the individual error handling.
      if (finalOrderData) {
        if (repairServices.length > 0) {
          const laborSyncResult = await syncRepairOrderServices(
            finalOrderId,
            repairServices
          );

          if (laborSyncResult.ok) {
            finalOrderData.repairServices = laborSyncResult.data;
            finalOrderData.laborTotal = laborSyncResult.data.reduce(
              (sum, service) => sum + Number(service.laborAmount || 0),
              0
            );
            finalOrderData.workerTotal = laborSyncResult.data.reduce(
              (sum, service) =>
                sum +
                (service.workers && service.workers.length > 0
                  ? service.workers.reduce(
                    (workerSum, worker) => workerSum + Number(worker.workerAmount || 0),
                    0
                  )
                  : Number(service.workerAmount || 0)),
              0
            );
            finalOrderData.laborCost =
              finalOrderData.laborTotal || finalOrderData.laborCost;
          } else {
            showToast.warning(
              "Da luu phieu nhung chua dong bo duoc cong sua: " +
              (laborSyncResult as { error: any }).error.message
            );
          }
        }

        const orderForAsync = finalOrderData; // Capture for closure

        // Execute auxiliary tasks in parallel
        Promise.all([
          // Task A: Update Vehicle KM & Maintenance
          (async () => {
            if (currentKm > 0 && customer?.id && vehicle?.id) {
              await updateVehicleKmAndMaintenance(
                customer,
                vehicle.id,
                currentKm,
                parts,
                additionalServices,
                issueDescription
              );
            }
          })(),

          // Task B: Create Debt if needed
          (async () => {
            if (status === "Trả máy" && remainingAmount > 0) {
              await createCustomerDebtIfNeeded(
                orderForAsync,
                remainingAmount,
                total,
                totalPaid
              );
            }
          })(),

          // Task C: Create Notification (only for new orders)
          (async () => {
            if (isNew) {
              const createdByName =
                profile?.name || profile?.full_name || profile?.email || "Nhân viên";
              await createWorkOrderNotification(
                finalOrderId,
                customer.name,
                vehicle?.model || "",
                vehicle?.licensePlate || "",
                total,
                createdByName
              );
            }
          })(),

          // Task D: Update Customer Stats (Total Spent)
          (async () => {
            if (customer.phone) {
              try {
                // Short delay to ensure RPC triggered DB updates/triggers have settled if any
                await new Promise((resolve) => setTimeout(resolve, 500));

                const { data: camelCustomer, error: camelError } = await supabase
                  .from("customers")
                  .select("id, totalSpent, visitCount")
                  .eq("phone", customer.phone)
                  .maybeSingle();

                const { data: lowerCustomer } = camelError
                  ? await supabase
                      .from("customers")
                      .select("id, totalspent, visitcount")
                      .eq("phone", customer.phone)
                      .maybeSingle()
                  : { data: null as any };

                const currentCustomer = camelCustomer || lowerCustomer;

                if (currentCustomer) {
                  const currentTotal =
                    currentCustomer?.totalSpent ?? currentCustomer?.totalspent ?? 0;
                  const currentVisits =
                    currentCustomer?.visitCount ?? currentCustomer?.visitcount ?? 0;

                  let newTotalSpent = currentTotal;
                  let newVisits = currentVisits;

                  if (isNew) {
                    // New order: add total and increment visit
                    newTotalSpent = total > 0 ? currentTotal + total : currentTotal;
                    newVisits = currentVisits + 1;
                  } else if (editingOrder && editingOrder.total !== total) {
                    // Update order: adjust total
                    const oldTotal = editingOrder.total || 0;
                    newTotalSpent = Math.max(0, currentTotal - oldTotal + total);
                    // visit count doesn't change on update usually, or we assume correct
                  }

                  if (newTotalSpent !== currentTotal || newVisits !== currentVisits) {
                    const { error: updateCamelError } = await supabase
                      .from("customers")
                      .update({
                        totalSpent: newTotalSpent,
                        visitCount: newVisits,
                        lastVisit: new Date().toISOString(),
                      })
                      .eq("id", currentCustomer.id);

                    if (updateCamelError) {
                      await supabase
                        .from("customers")
                        .update({
                          totalspent: newTotalSpent,
                          visitcount: newVisits,
                          lastvisit: new Date().toISOString(),
                        })
                        .eq("id", currentCustomer.id);
                    }

                  }
                }
              } catch (err) {
                console.error("[WorkOrder] Error updating customer stats:", err);
              }
            }
          })()
        ]).catch(err => {
          console.error("❌ Error in background parallel tasks:", err);
        });
      }

      // 🔄 Force refresh data immediately after save
      queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      queryClient.invalidateQueries({ queryKey: ["workOrdersFiltered"] });

      setShowMobileModal(false);
      setEditingOrder(undefined);
    } catch (error: any) {
      console.error("[handleMobileSave] Error:", error);
      showToast.error(
        `Lỗi: ${error.message || "Không thể lưu phiếu sửa chữa"}`
      );
      throw error; // Re-throw so WorkOrderMobileModal can handle state
    }
  };

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

  // handleCallCustomer moved to ./utils/service.utils.ts
  const _handleCallCustomerWrapper = (phone: string) => callCustomer(phone);

  // formatMaskedPhone moved to ./utils/service.utils.ts

  const clearFilters = () => {
    setSearchQuery("");
    setActiveTab("all");
    setTechnicianFilter(
      profile?.role === USER_ROLES.STAFF && defaultStaffTechnicianName
        ? defaultStaffTechnicianName
        : "all"
    );
    setPaymentFilter("all");
    setDateFilter("week");
  };

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
    const newOrder: WorkOrder = {
      id: "", // Empty ID to trigger creation mode
      customerName: "",
      customerPhone: "",
      vehicleModel: "",
      issueDescription: template.description || template.name,
      status: "Tiếp nhận",
      creationDate: new Date().toISOString(),
      estimatedCompletion: new Date(
        Date.now() + (template.duration || 30) * 60000
      ).toISOString(),
      technicianName: "",
      laborCost: template.labor_cost || 0,
      partsUsed: (template.parts || []).map((p: any) => ({
        partId: p.partId || "",
        partName: p.name,
        quantity: p.quantity,
        price: p.price,
        sku: p.sku || "",
      })),
      notes: "",
      total: 0,
      branchId: currentBranchId,
    };
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
          setDateFilter={setDateFilter}
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
          onSave={handleMobileSave}
          workOrder={editingOrder}
          customers={displayCustomers}
          parts={parts}
          employees={displayEmployees || []}
          currentBranchId={currentBranchId}
          upsertCustomer={upsertCustomer}
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
            const newOrder: WorkOrder = {
                id: generateWorkOrderId(storeSettings?.work_order_prefix),
              customerName: "",
              customerPhone: "",
              vehicleModel: "",
              issueDescription: template.description,
              status: "Tiếp nhận",
              creationDate: new Date().toISOString(),
              estimatedCompletion: new Date(
                Date.now() + template.duration * 60000
              ).toISOString(),
              technicianName: "",
              laborCost: template.laborCost,
              partsUsed: template.parts.map((p) => ({
                partId: "",
                partName: p.name,
                quantity: p.quantity,
                price: p.price,
                sku: p.sku || "",
              })),
              notes: "",
              total: 0,
              branchId: currentBranchId,
            };
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
        onDateFilterChange={setDateFilter}
        technicianFilter={technicianFilter}
        onTechnicianFilterChange={setTechnicianFilter}
        paymentFilter={paymentFilter}
        onPaymentFilterChange={setPaymentFilter}
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
          const newOrder: WorkOrder = {
            id: generateWorkOrderId(storeSettings?.work_order_prefix),
            customerName: "",
            customerPhone: "",
            vehicleModel: "",
            issueDescription: template.description,
            status: "Tiếp nhận",
            creationDate: new Date().toISOString(),
            estimatedCompletion: new Date(
              Date.now() + template.duration * 60000
            ).toISOString(),
            technicianName: "",
            laborCost: template.laborCost,
            partsUsed: template.parts.map((p) => ({
              partId: p.partId || "",
              partName: p.name,
              quantity: p.quantity,
              price: p.price,
              sku: p.sku || "",
            })),
            notes: "",
            total: 0,
            branchId: currentBranchId,
          };
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

      {/* Mobile Work Order Modal - DISABLED */}
      {/*
      <WorkOrderMobileModal
        isOpen={showMobileModal}
        onClose={() => {
          setShowMobileModal(false);
          setEditingOrder(undefined);
        }}
        onSave={handleMobileSave}
        workOrder={editingOrder}
        customers={displayCustomers}
        parts={fetchedParts || []}
        employees={displayEmployees || []}
        currentBranchId={currentBranchId}
      />
      */}

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
