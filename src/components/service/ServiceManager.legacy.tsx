import React, { useState, useMemo, useEffect, useRef } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  FileText,
  Bike,
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
  Share2,
  Edit2,
  Clock,
  AlertTriangle,
  RefreshCw,
  Eye,
  EyeOff,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";
import type {
  WorkOrder,
  Part,
  WorkOrderPart,
  Vehicle,
  Customer,
} from "../../types";
import {
  formatCurrency,
  formatDate,
  formatWorkOrderId,
} from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import {
  useCreateWorkOrderAtomicRepo,
  useUpdateWorkOrderAtomicRepo,
  useRefundWorkOrderRepo,
  useDeleteWorkOrderRepo,
  useWorkOrdersRepo,
  useWorkOrdersFilteredRepo,
} from "../../hooks/useWorkOrdersRepository";
import { completeWorkOrderPayment } from "../../lib/repository/workOrdersRepository";
import type { RepairTemplate } from "../../hooks/useRepairTemplatesRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useEmployeesRepo } from "../../hooks/useEmployeesRepository";
import {
  useCreateCustomerDebtRepo,
  useUpdateCustomerDebtRepo,
} from "../../hooks/useDebtsRepository";
import { showToast } from "../../utils/toast";
import { printElementById } from "../../utils/print";
import { supabase } from "../../supabaseClient";
import { useDebouncedValue } from "../../hooks/useDebouncedValue";
import { WorkOrderMobileModal } from "./WorkOrderMobileModal";
import WorkOrderModal from "./components/WorkOrderModal";
import { ServiceManagerMobile } from "./ServiceManagerMobile";
import {
  validatePhoneNumber,
  validateDepositAmount,
} from "../../utils/validation";
import { NumberInput } from "../common/NumberInput";
import {
  detectMaintenancesFromWorkOrder,
  updateVehicleMaintenances,
} from "../../utils/maintenanceReminder";
import { RepairTemplatesModal } from "./components/RepairTemplatesModal";
import { USER_ROLES } from "../../constants";

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  work_order_prefix?: string;
}

type WorkOrderStatus = "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";
type ServiceTabKey = "all" | "pending" | "inProgress" | "done" | "delivered";
type FilterColor = "slate" | "blue" | "orange" | "green" | "purple";

export default function ServiceManager() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useAuth(); // Get user profile early for createCustomerDebtIfNeeded
  const isOwner = profile?.role === USER_ROLES.OWNER; // Check if user is owner

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

  // Popular motorcycle models in Vietnam
  const POPULAR_MOTORCYCLES = [
    // Honda
    "Honda Wave RSX",
    "Honda Wave Alpha",
    "Honda Blade",
    "Honda Future",
    "Honda Winner X",
    "Honda Vision",
    "Honda Air Blade",
    "Honda SH Mode",
    "Honda SH 125i",
    "Honda SH 150i",
    "Honda SH 160i",
    "Honda SH 350i",
    "Honda Vario",
    "Honda Lead",
    "Honda PCX",
    "Honda ADV",
    // Yamaha
    "Yamaha Exciter",
    "Yamaha Sirius",
    "Yamaha Jupiter",
    "Yamaha Grande",
    "Yamaha Janus",
    "Yamaha FreeGo",
    "Yamaha Latte",
    "Yamaha NVX",
    "Yamaha XSR",
    // Suzuki
    "Suzuki Raider",
    "Suzuki Axelo",
    "Suzuki Satria",
    "Suzuki GD110",
    "Suzuki Impulse",
    "Suzuki Address",
    "Suzuki Revo",
    // SYM
    "SYM Elite",
    "SYM Galaxy",
    "SYM Star",
    "SYM Attila",
    "SYM Angela",
    "SYM Passing",
    // Piaggio & Vespa
    "Piaggio Liberty",
    "Piaggio Medley",
    "Vespa Sprint",
    "Vespa Primavera",
    "Vespa GTS",
    // VinFast
    "VinFast Klara",
    "VinFast Evo200",
    "VinFast Ludo",
    "VinFast Impes",
    "VinFast Theon",
    // Khác
    "Khác",
  ];

  // Fetch parts from Supabase
  const { data: fetchedParts, isLoading: partsLoading } = usePartsRepo();

  // Fetch employees from Supabase
  const { data: fetchedEmployees, isLoading: employeesLoading } =
    useEmployeesRepo();

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
  });

  // Fetch customers from Supabase directly
  const [fetchedCustomers, setFetchedCustomers] = useState<any[]>([]);
  useEffect(() => {
    const fetchCustomers = async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100); // Limit to 100 most recent customers for better mobile performance

      if (!error && data) {
        setFetchedCustomers(data);
      }
    };
    fetchCustomers();
  }, []);

  // Use fetched data if available, otherwise use context
  const parts = fetchedParts || contextParts;
  const displayCustomers =
    fetchedCustomers.length > 0 ? fetchedCustomers : customers;
  const displayEmployees = fetchedEmployees || employees;
  const displayWorkOrders = fetchedWorkOrders || workOrders;

  // Sync fetched work orders to context
  useEffect(() => {
    console.log(
      "[ServiceManager] fetchedWorkOrders:",
      fetchedWorkOrders?.length,
      fetchedWorkOrders
    );
    console.log(
      "[ServiceManager] workOrders from context:",
      workOrders?.length,
      workOrders
    );
    if (fetchedWorkOrders) {
      setWorkOrders(fetchedWorkOrders);
    }
  }, [fetchedWorkOrders, setWorkOrders]);

  const [showModal, setShowModal] = useState(false);
  const [showMobileModal, setShowMobileModal] = useState(false);
  const [mobileModalViewMode, setMobileModalViewMode] = useState(false); // true = xem chi tiết, false = chỉnh sửa
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingOrder, setEditingOrder] = useState<WorkOrder | undefined>(
    undefined
  );
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300); // Debounce search for better performance
  const [statusFilter, setStatusFilter] = useState<"all" | WorkOrderStatus>(
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

  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE);

  // Sync dateFilter with dateRangeDays for API query
  useEffect(() => {
    if (dateFilter === "all") {
      setDateRangeDays(0); // 0 = load all data (no date filter)
    } else if (dateFilter === "today") {
      setDateRangeDays(1);
    } else if (dateFilter === "week") {
      setDateRangeDays(7);
    } else if (dateFilter === "month") {
      setDateRangeDays(30);
    }
  }, [dateFilter]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [searchQuery, activeTab, dateFilter, technicianFilter, paymentFilter]);

  useEffect(() => {
    setFetchLimit(100);
  }, [dateRangeDays, currentBranchId]);

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
      // Set the editing order and open modal
      setEditingOrder(state.editOrder);
      setShowModal(true);
      // Clear the navigation state to prevent re-opening on re-render
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // State for print preview modal
  const [printOrder, setPrintOrder] = useState<WorkOrder | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(
    null
  );
  const invoicePreviewRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  // State for refund modal
  const [refundingOrder, setRefundingOrder] = useState<WorkOrder | null>(null);
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundReason, setRefundReason] = useState("");

  // Share invoice as image function
  const handleShareInvoice = async () => {
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

      if (navigator.share && navigator.canShare) {
        const file = new File([blob], fileName, { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `Phiếu sửa chữa ${formatWorkOrderId(printOrder.id)}`,
          });
          showToast.success("Đã chia sẻ phiếu thành công!");
        } else {
          downloadImage(blob, fileName);
        }
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

  const downloadImage = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast.success("Đã tải phiếu xuống!");
  };

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
    let filtered = displayWorkOrders.filter((o) => !o.refunded);

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

    // Search filter (using debounced value)
    if (debouncedSearchQuery) {
      filtered = filtered.filter(
        (o) =>
          o.customerName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          o.vehicleModel?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
          o.licensePlate?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
      );
    }

    // Date filter
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((o) => {
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
  }, [hasMoreOrders, workOrdersFetching]);

  // Tạo danh sách chỉ lọc theo ngày để tính stats (không bị ảnh hưởng bởi filter thanh toán/KTV)
  const dateFilteredOrders = useMemo(() => {
    let filtered = [...displayWorkOrders];

    // Date filter only
    if (dateFilter !== "all") {
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      filtered = filtered.filter((o) => {
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

    return filtered;
  }, [displayWorkOrders, dateFilter]);

  const stats = useMemo(() => {
    // Sử dụng dateFilteredOrders để tính stats theo bộ lọc ngày (không bị ảnh hưởng bởi filter khác)
    const pending = dateFilteredOrders.filter(
      (o) => o.status === "Tiếp nhận"
    ).length;
    const inProgress = dateFilteredOrders.filter(
      (o) => o.status === "Đang sửa"
    ).length;
    const done = dateFilteredOrders.filter(
      (o) => o.status === "Đã sửa xong"
    ).length;
    const delivered = dateFilteredOrders.filter(
      (o) => o.status === "Trả máy"
    ).length;

    // Tính doanh thu theo bộ lọc ngày đã chọn
    const filteredRevenue = dateFilteredOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => sum + o.total, 0);

    // Profit = Revenue - Cost (parts costPrice + services costPrice)
    const filteredProfit = dateFilteredOrders
      .filter((o) => o.paymentStatus === "paid")
      .reduce((sum, o) => {
        // Calculate parts cost (costPrice * quantity)
        const partsCost =
          o.partsUsed?.reduce(
            (s: number, p: WorkOrderPart) =>
              s + (p.costPrice || 0) * (p.quantity || 1),
            0
          ) || 0;
        // Calculate additional services cost
        const servicesCost =
          o.additionalServices?.reduce(
            (s: number, svc: { costPrice?: number; quantity?: number }) =>
              s + (svc.costPrice || 0) * (svc.quantity || 1),
            0
          ) || 0;
        // Profit = total - costs
        return sum + (o.total - partsCost - servicesCost);
      }, 0);

    return {
      pending,
      inProgress,
      done,
      delivered,
      filteredRevenue,
      filteredProfit,
    };
  }, [dateFilteredOrders]);

  const totalOpenTickets = stats.pending + stats.inProgress + stats.done;
  const urgentTickets = stats.pending + stats.inProgress;
  const urgentRatio = totalOpenTickets
    ? Math.round((urgentTickets / totalOpenTickets) * 100)
    : 0;
  const completionRate = totalOpenTickets
    ? Math.round((stats.done / totalOpenTickets) * 100)
    : 0;
  const profitMargin = stats.filteredRevenue
    ? Math.round((stats.filteredProfit / stats.filteredRevenue) * 100)
    : 0;

  // Label cho doanh thu/lợi nhuận theo bộ lọc ngày
  const getDateFilterLabel = () => {
    switch (dateFilter) {
      case "today":
        return "hôm nay";
      case "week":
        return "7 ngày qua";
      case "month":
        return "tháng này";
      default:
        return "tất cả";
    }
  };

  const FILTER_BADGE_CLASSES: Record<FilterColor, string> = {
    slate:
      "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-200",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
    orange:
      "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
    green:
      "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    purple:
      "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
  };
  const filterInputClass =
    "px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200";

  const quickStatusFilters = useMemo(
    (): Array<{
      key: ServiceTabKey;
      label: string;
      color: FilterColor;
      count: number;
    }> => [
        {
          key: "all",
          label: "Tất cả",
          color: "slate",
          count: dateFilteredOrders.filter(
            (o) => o.status !== "Trả máy" && !o.refunded
          ).length,
        },
        {
          key: "pending",
          label: "Tiếp nhận",
          color: "blue",
          count: stats.pending,
        },
        {
          key: "inProgress",
          label: "Đang sửa",
          color: "orange",
          count: stats.inProgress,
        },
        {
          key: "done",
          label: "Đã sửa xong",
          color: "green",
          count: stats.done,
        },
        {
          key: "delivered",
          label: "Đã trả máy",
          color: "purple",
          count: stats.delivered,
        },
      ],
    [
      dateFilteredOrders,
      stats.delivered,
      stats.done,
      stats.inProgress,
      stats.pending,
    ]
  );

  const statusSnapshotCards: Array<{
    key: ServiceTabKey;
    label: string;
    value: number;
    subtitle: string;
    accent: string;
    dot: string;
  }> = [
      {
        key: "pending",
        label: "Tiếp nhận",
        value: stats.pending,
        subtitle: "Chờ phân công",
        accent:
          "from-sky-50 via-sky-50 to-white dark:from-sky-900/30 dark:via-sky-900/10",
        dot: "bg-sky-500",
      },
      {
        key: "inProgress",
        label: "Đang sửa",
        value: stats.inProgress,
        subtitle: "Đang thi công",
        accent:
          "from-amber-50 via-amber-50 to-white dark:from-amber-900/30 dark:via-amber-900/10",
        dot: "bg-amber-500",
      },
      {
        key: "done",
        label: "Đã sửa xong",
        value: stats.done,
        subtitle: "Chờ giao khách",
        accent:
          "from-emerald-50 via-emerald-50 to-white dark:from-emerald-900/30 dark:via-emerald-900/10",
        dot: "bg-emerald-500",
      },
      {
        key: "delivered",
        label: "Trả máy",
        value: stats.delivered,
        subtitle: "Hoàn tất",
        accent:
          "from-purple-50 via-purple-50 to-white dark:from-purple-900/30 dark:via-purple-900/10",
        dot: "bg-purple-500",
      },
    ];

  const handleOpenModal = (order?: WorkOrder) => {
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

  const handleApplyTemplate = (template: (typeof serviceTemplates)[0]) => {
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

  // Handle print work order - show preview modal
  const handlePrintOrder = async (order: WorkOrder) => {
    setPrintOrder(order);

    // Load store settings for print preview (single row, no branch_id)
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .limit(1)
        .single();

      if (!error && data) {
        setStoreSettings(data);
      }
    } catch (err) {
      console.error("Error loading store settings:", err);
    }

    setShowPrintPreview(true);
  };

  // Handle actual print
  const handleDoPrint = () => {
    setTimeout(() => {
      printElementById("work-order-receipt");
    }, 500);
  };

  // 🔹 Handle refund work order
  const { mutateAsync: refundWorkOrderAsync } = useRefundWorkOrderRepo();

  // 🔹 Handle delete work order
  const { mutateAsync: deleteWorkOrderAsync } = useDeleteWorkOrderRepo();

  // 🔹 Handle create/update customer debts
  const createCustomerDebt = useCreateCustomerDebtRepo();
  const updateCustomerDebt = useUpdateCustomerDebtRepo();

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
      const { error } = await supabase.from("notifications").insert({
        id: crypto.randomUUID(),
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
        created_by: profile?.id || null,
        recipient_role: "owner", // Gửi đến owner
        branch_id: currentBranchId,
        is_read: false,
        created_at: new Date().toISOString(),
      });

      if (error) {
        console.error("❌ Error creating notification:", error);
      } else {
        console.log("✅ Notification created for work order:", orderId);
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

      console.log("[updateVehicleKmAndMaintenance] Updated vehicle:", {
        vehicleId,
        currentKm,
        maintenanceTypes,
        updatedVehicle,
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

    console.log("[createCustomerDebtIfNeeded] CALLED with:", {
      workOrderId: workOrder.id,
      totalAmount,
      paidAmount,
      remainingAmount,
      customerName: workOrder.customerName,
      timestamp: new Date().toISOString(),
    });

    try {
      const safeCustomerId =
        workOrder.customerPhone || workOrder.id || `CUST-ANON-${Date.now()}`;
      const safeCustomerName =
        workOrder.customerName?.trim() ||
        workOrder.customerPhone ||
        "Khách vãng lai";

      // Tạo nội dung chi tiết từ phiếu sửa chữa
      const workOrderNumber =
        formatWorkOrderId(workOrder.id, storeSettings?.work_order_prefix)
          .split("-")
          .pop() || "";

      let description = `${workOrder.vehicleModel || "Xe"
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

      console.log("[ServiceManager] createCustomerDebt payload:", payload);
      const result = await createCustomerDebt.mutateAsync(payload as any);
      console.log("[ServiceManager] createCustomerDebt result:", result);
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
      console.log("[handleMobileSave] Mobile Work Order Data:", workOrderData);

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
        laborCost = 0,
        discount = 0,
        total = 0,
        depositAmount = 0,
        paymentMethod,
        paymentType,
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

            console.log(
              "[handleMobileSave] Adding new vehicle to customer:",
              updatedCustomer
            );
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
            console.log(
              "[handleMobileSave] Updating vehicle km:",
              updatedCustomer
            );
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
          console.log(
            "[handleMobileSave] Creating new customer with vehicle:",
            newCustomer
          );
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

        await createWorkOrderAtomicAsync({
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
        } as any);

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
          discount: discount,
          partsUsed: parts,
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

        // 🔹 FIX Mobile: Nếu cập nhật phiếu thành paymentStatus = 'paid', gọi complete_payment để trừ kho
        const wasUnpaidOrPartial = editingOrder.paymentStatus !== "paid";
        if (
          paymentStatus === "paid" &&
          wasUnpaidOrPartial &&
          parts.length > 0
        ) {
          try {
            console.log(
              "[handleMobileSave] Order became fully paid, calling completeWorkOrderPayment to deduct inventory"
            );
            await completeWorkOrderPayment(
              editingOrder.id,
              paymentMethod || "cash",
              0 // Số tiền = 0 vì đã thanh toán hết rồi, chỉ cần trừ kho
            );
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
          discount: discount,
          partsUsed: parts,
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

      // 2. PARALLEL BACKGROUND TASKS (Fire and forget from user perspective)
      // We don't await this block to block the close modal action, 
      // but we wrap in try-catch to ensure no unhandled promise rejections if we wanted to
      // or just trust the individual error handling.
      if (finalOrderData) {
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

                const { data: currentCustomer } = await supabase
                  .from("customers")
                  .select("id, totalSpent, visitCount")
                  .eq("phone", customer.phone)
                  .single();

                if (currentCustomer) {
                  const currentTotal = currentCustomer?.totalSpent || 0;
                  const currentVisits = currentCustomer?.visitCount || 0;

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
                    await supabase
                      .from("customers")
                      .update({
                        totalSpent: newTotalSpent,
                        visitCount: newVisits,
                        lastVisit: new Date().toISOString(),
                      })
                      .eq("id", currentCustomer.id);

                    console.log(`[WorkOrder] Updated stats for ${customer.name}`);
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
    }
  };

  const handleRefundOrder = (order: WorkOrder) => {
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
      console.log(
        "[handleConfirmRefund] Starting refund for order:",
        refundingOrder.id
      );
      console.log("[handleConfirmRefund] Refund reason:", refundReason);

      const result = await refundWorkOrderAsync({
        orderId: refundingOrder.id,
        refundReason: refundReason,
      });

      console.log("[handleConfirmRefund] Refund result:", result);

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
            description: `Hoàn tiền hủy phiếu #${(
              formatWorkOrderId(
                refundingOrder.id,
                storeSettings?.work_order_prefix
              ) || ""
            )
              .split("-")
              .pop()} - ${refundReason}`,
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
      setWorkOrders((prev) =>
        prev.map((wo) =>
          wo.id === refundingOrder.id
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

  // Handle call customer
  const handleCallCustomer = (phone: string) => {
    if (phone) {
      window.location.href = `tel:${phone}`;
    }
  };

  const formatMaskedPhone = (phone?: string) => {
    if (!phone) return "N/A";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return phone;
    return `*** *** ${digits.slice(-4)}`;
  };

  const clearFilters = () => {
    setSearchQuery("");
    setActiveTab("all");
    setTechnicianFilter("all");
    setPaymentFilter("all");
    setDateFilter("week");
  };

  const handleLoadMore = () => {
    setVisibleCount((c) => c + PAGE_SIZE);
    const loadedCount =
      fetchedWorkOrders?.length ?? displayWorkOrders?.length ?? 0;
    if (!workOrdersFetching && loadedCount >= fetchLimit) {
      setFetchLimit((l) => l + 100);
    }
  };

  // Handle delete work order - using hook for proper query invalidation
  const handleDelete = async (workOrder: WorkOrder) => {
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
      assignedTechnician: "",
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
          isLoading={workOrdersLoading || workOrdersFetching}
          onRefresh={async () => { await refetchWorkOrders(); }}
          onCreateWorkOrder={() => {
            setEditingOrder(undefined);
            setMobileModalViewMode(false); // Tạo mới = edit mode
            setShowMobileModal(true);
          }}
          onEditWorkOrder={(workOrder) => {
            setEditingOrder(workOrder);
            setMobileModalViewMode(true); // Click vào phiếu = view mode trước
            setShowMobileModal(true);
          }}
          onDeleteWorkOrder={handleDelete}
          onCallCustomer={handleCallCustomer}
          onPrintWorkOrder={handlePrintOrder}
          onOpenTemplates={() => setShowTemplateModal(true)}
          onApplyTemplate={handleApplyRepairTemplate}
          currentBranchId={currentBranchId}
          dateFilter={dateFilter}
          setDateFilter={setDateFilter}
          setDateRangeDays={setDateRangeDays}
        />

        {/* Mobile Modal */}
        {showMobileModal && (
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
            parts={fetchedParts || []}
            employees={displayEmployees}
            currentBranchId={currentBranchId}
            upsertCustomer={upsertCustomer}
            viewMode={mobileModalViewMode}
            onSwitchToEdit={() => setMobileModalViewMode(false)}
          />
        )}

        {/* Mobile Print Preview Modal */}
        {showPrintPreview && printOrder && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-2">
            <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-full max-h-[95vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between rounded-t-xl flex-shrink-0">
                <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                  Xem trước phiếu
                </h2>
                <div className="flex items-center gap-2">
                  {/* Share Button - Share as Image */}
                  <button
                    onClick={async () => {
                      try {
                        showToast.info("Đang tạo hình ảnh...");

                        // Import html2canvas dynamically
                        const html2canvas = (await import("html2canvas"))
                          .default;

                        const element = document.getElementById(
                          "mobile-print-preview-content"
                        );
                        if (!element) {
                          showToast.error("Không tìm thấy nội dung phiếu!");
                          return;
                        }

                        // Capture the element as canvas
                        const canvas = await html2canvas(element, {
                          scale: 2, // Higher quality
                          backgroundColor: "#ffffff",
                          useCORS: true,
                          logging: false,
                        });

                        // Convert canvas to blob
                        const blob = await new Promise<Blob>((resolve) => {
                          canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
                        });

                        const fileName = `Phieu_${formatWorkOrderId(
                          printOrder.id,
                          storeSettings?.work_order_prefix
                        )}.png`;

                        // Try to share as image file
                        if (navigator.share && navigator.canShare) {
                          const file = new File([blob], fileName, {
                            type: "image/png",
                          });
                          const shareData = {
                            files: [file],
                            title: `Phiếu sửa chữa - ${formatWorkOrderId(
                              printOrder.id,
                              storeSettings?.work_order_prefix
                            )}`,
                          };

                          if (navigator.canShare(shareData)) {
                            await navigator.share(shareData);
                            showToast.success("Chia sẻ thành công!");
                          } else {
                            // Fallback: download the image
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = fileName;
                            a.click();
                            URL.revokeObjectURL(url);
                            showToast.success("Đã tải hình ảnh!");
                          }
                        } else {
                          // Fallback: download the image
                          const url = URL.createObjectURL(blob);
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = fileName;
                          a.click();
                          URL.revokeObjectURL(url);
                          showToast.success("Đã tải hình ảnh!");
                        }
                      } catch (err) {
                        console.error("Share failed:", err);
                        showToast.error("Không thể chia sẻ. Vui lòng thử lại!");
                      }
                    }}
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg flex items-center gap-1.5 transition text-sm"
                  >
                    <Share2 className="w-4 h-4" />
                    Chia sẻ
                  </button>
                  <button
                    onClick={handleDoPrint}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 transition text-sm"
                  >
                    <Printer className="w-4 h-4" />
                    In
                  </button>
                  <button
                    onClick={() => {
                      setShowPrintPreview(false);
                      setPrintOrder(null);
                    }}
                    className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 bg-slate-100 dark:bg-slate-700 rounded-lg"
                    aria-label="Đóng"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      className="w-5 h-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Print Preview Content - Mobile optimized */}
              <div className="flex-1 overflow-y-auto p-3 bg-slate-100 dark:bg-slate-900">
                <div
                  id="mobile-print-preview-content"
                  className="bg-white shadow-lg mx-auto"
                  style={{ maxWidth: "100%", color: "#000", padding: "4mm" }}
                >
                  {/* Store Info Header with Logo */}
                  <div
                    style={{
                      display: "flex",
                      gap: "3mm",
                      marginBottom: "3mm",
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "2mm",
                      alignItems: "flex-start",
                    }}
                  >
                    {/* Logo */}
                    {storeSettings?.logo_url && (
                      <div style={{ flexShrink: 0 }}>
                        <img
                          src={storeSettings.logo_url}
                          alt="Logo"
                          style={{
                            height: "15mm",
                            width: "auto",
                            objectFit: "contain",
                          }}
                        />
                      </div>
                    )}
                    {/* Store Info */}
                    <div style={{ flex: 1, fontSize: "9pt" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "12pt",
                          color: "#1e40af",
                          marginBottom: "1mm",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#ef4444"
                        >
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span>
                          {storeSettings?.address ||
                            "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                        </span>
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#16a34a"
                        >
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                        <span>{storeSettings?.phone || "0947.747.907"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Title */}
                  <div style={{ textAlign: "center", marginBottom: "3mm" }}>
                    <h1
                      style={{
                        fontSize: "14pt",
                        fontWeight: "bold",
                        margin: "0",
                        color: "#1e40af",
                      }}
                    >
                      PHIẾU DỊCH VỤ SỬA CHỮA
                    </h1>
                    <div
                      style={{
                        fontSize: "9pt",
                        color: "#666",
                        marginTop: "1mm",
                      }}
                    >
                      Mã:{" "}
                      {formatWorkOrderId(
                        printOrder.id,
                        storeSettings?.work_order_prefix
                      )}
                    </div>
                    <div style={{ fontSize: "8pt", color: "#666" }}>
                      {new Date(printOrder.creationDate).toLocaleString(
                        "vi-VN"
                      )}
                    </div>
                  </div>

                  {/* Customer Info */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      marginBottom: "2mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f8fafc",
                      fontSize: "9pt",
                    }}
                  >
                    <div>
                      <strong>Khách hàng:</strong> {printOrder.customerName} -{" "}
                      {printOrder.customerPhone}
                    </div>
                    <div>
                      <strong>Xe:</strong> {printOrder.vehicleModel} -{" "}
                      <span style={{ color: "#3b82f6" }}>
                        {printOrder.licensePlate}
                      </span>
                    </div>
                  </div>

                  {/* Issue Description */}
                  {printOrder.issueDescription && (
                    <div
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        marginBottom: "2mm",
                        borderRadius: "2mm",
                        fontSize: "9pt",
                      }}
                    >
                      <strong>Mô tả sự cố:</strong>{" "}
                      {printOrder.issueDescription}
                    </div>
                  )}

                  {/* Parts Table */}
                  {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
                    <div style={{ marginBottom: "2mm" }}>
                      <p
                        style={{
                          fontWeight: "bold",
                          margin: "0 0 1mm 0",
                          fontSize: "10pt",
                        }}
                      >
                        Phụ tùng:
                      </p>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #ddd",
                          fontSize: "9pt",
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "1.5mm",
                                textAlign: "left",
                              }}
                            >
                              Tên
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "1.5mm",
                                textAlign: "center",
                                width: "12%",
                              }}
                            >
                              SL
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "1.5mm",
                                textAlign: "right",
                                width: "28%",
                              }}
                            >
                              Thành tiền
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {printOrder.partsUsed.map(
                            (part: WorkOrderPart, idx: number) => (
                              <tr key={idx}>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "1.5mm",
                                  }}
                                >
                                  {part.partName}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "1.5mm",
                                    textAlign: "center",
                                  }}
                                >
                                  {part.quantity}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "1.5mm",
                                    textAlign: "right",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {formatCurrency(part.price * part.quantity)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Additional Services */}
                  {printOrder.additionalServices &&
                    printOrder.additionalServices.length > 0 && (
                      <div style={{ marginBottom: "2mm", fontSize: "9pt" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 1mm 0",
                            fontSize: "10pt",
                          }}
                        >
                          Dịch vụ bổ sung:
                        </p>
                        {printOrder.additionalServices.map(
                          (service: any, idx: number) => (
                            <div
                              key={idx}
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                              }}
                            >
                              <span>{service.description}</span>
                              <span style={{ fontWeight: "bold" }}>
                                {formatCurrency(
                                  service.price * (service.quantity || 1)
                                )}
                              </span>
                            </div>
                          )
                        )}
                      </div>
                    )}

                  {/* Cost Summary */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "2mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f9f9f9",
                      fontSize: "9pt",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "1mm",
                      }}
                    >
                      <span>Tiền phụ tùng:</span>
                      <span>
                        {formatCurrency(
                          printOrder.partsUsed?.reduce(
                            (sum: number, p: WorkOrderPart) =>
                              sum + p.price * p.quantity,
                            0
                          ) || 0
                        )}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        marginBottom: "1mm",
                      }}
                    >
                      <span>Phí dịch vụ:</span>
                      <span>{formatCurrency(printOrder.laborCost || 0)}</span>
                    </div>
                    {printOrder.additionalServices &&
                      printOrder.additionalServices.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "1mm",
                          }}
                        >
                          <span>Giá công/Đặt hàng:</span>
                          <span>
                            {formatCurrency(
                              printOrder.additionalServices.reduce(
                                (sum: number, s: any) =>
                                  sum + (s.price || 0) * (s.quantity || 1),
                                0
                              )
                            )}
                          </span>
                        </div>
                      )}
                    {printOrder.discount != null && printOrder.discount > 0 && (
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          marginBottom: "1mm",
                          color: "#e74c3c",
                        }}
                      >
                        <span>Giảm giá:</span>
                        <span>-{formatCurrency(printOrder.discount)}</span>
                      </div>
                    )}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        paddingTop: "2mm",
                        borderTop: "2px solid #3b82f6",
                        fontSize: "12pt",
                        fontWeight: "bold",
                        color: "#1e40af",
                      }}
                    >
                      <span>TỔNG CỘNG:</span>
                      <span>{formatCurrency(printOrder.total || 0)}</span>
                    </div>
                    {printOrder.depositAmount != null &&
                      printOrder.depositAmount > 0 && (
                        <>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginTop: "1mm",
                              color: "#16a34a",
                            }}
                          >
                            <span>Đã đặt cọc:</span>
                            <span>
                              {formatCurrency(printOrder.depositAmount)}
                            </span>
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontWeight: "bold",
                              color: "#dc2626",
                            }}
                          >
                            <span>Còn lại:</span>
                            <span>
                              {formatCurrency(
                                printOrder.remainingAmount ||
                                printOrder.total - printOrder.depositAmount
                              )}
                            </span>
                          </div>
                        </>
                      )}
                  </div>

                  {/* Bank Info Section */}
                  {storeSettings?.bank_name && (
                    <div
                      style={{
                        marginTop: "3mm",
                        border: "1px solid #ddd",
                        padding: "2mm",
                        borderRadius: "2mm",
                        backgroundColor: "#f0f9ff",
                        fontSize: "9pt",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "3mm",
                        }}
                      >
                        <div style={{ flex: 1 }}>
                          <div
                            style={{
                              fontWeight: "bold",
                              marginBottom: "1mm",
                              color: "#1e40af",
                            }}
                          >
                            🏦 Thông tin thanh toán
                          </div>
                          <div style={{ color: "#000" }}>
                            Ngân hàng: {storeSettings.bank_name}
                          </div>
                          {storeSettings.bank_account_number && (
                            <div style={{ color: "#000" }}>
                              STK:{" "}
                              <strong>
                                {storeSettings.bank_account_number}
                              </strong>
                            </div>
                          )}
                          {storeSettings.bank_account_holder && (
                            <div style={{ color: "#000" }}>
                              Chủ TK: {storeSettings.bank_account_holder}
                            </div>
                          )}
                          {storeSettings.bank_branch && (
                            <div style={{ color: "#666", fontSize: "8pt" }}>
                              Chi nhánh: {storeSettings.bank_branch}
                            </div>
                          )}
                        </div>
                        {/* QR Code */}
                        {storeSettings.bank_qr_url && (
                          <div style={{ flexShrink: 0 }}>
                            <img
                              src={storeSettings.bank_qr_url}
                              alt="QR Banking"
                              style={{
                                height: "25mm",
                                width: "25mm",
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Footer Note */}
                  <div
                    style={{
                      marginTop: "3mm",
                      padding: "2mm",
                      backgroundColor: "#fff9e6",
                      border: "1px solid #ffd700",
                      borderRadius: "2mm",
                      fontSize: "8pt",
                      textAlign: "center",
                    }}
                  >
                    <p style={{ margin: "0", fontStyle: "italic" }}>
                      Cảm ơn quý khách đã sử dụng dịch vụ!
                    </p>
                    <p style={{ margin: "1mm 0 0 0", fontStyle: "italic" }}>
                      Vui lòng giữ phiếu này để đối chiếu khi nhận xe
                    </p>
                  </div>

                  {/* KTV Info */}
                  <div
                    style={{
                      marginTop: "2mm",
                      fontSize: "9pt",
                      textAlign: "right",
                      color: "#666",
                    }}
                  >
                    KTV: {printOrder.technicianName || "Chưa phân công"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Repair Templates Modal for Mobile */}
        <RepairTemplatesModal
          isOpen={showTemplateModal}
          onClose={() => setShowTemplateModal(false)}
          onApplyTemplate={(template) => {
            // Convert and apply template to current work order for mobile
            const newOrder: WorkOrder = {
              id: `WO-${Date.now()}`,
              customerName: "",
              customerPhone: "",
              vehicleModel: "",
              issueDescription: template.description,
              status: "Tiếp nhận",
              creationDate: new Date().toISOString(),
              estimatedCompletion: new Date(
                Date.now() + template.duration * 60000
              ).toISOString(),
              assignedTechnician: "",
              laborCost: template.laborCost,
              partsUsed: template.parts.map((p) => ({
                partId: "",
                partName: p.name,
                quantity: p.quantity,
                price: p.price,
              })),
              notes: "",
              total: 0,
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
    <div className="space-y-3">
      {/* Desktop insight cards */}
      <div className="grid gap-3 lg:grid-cols-[2fr,1fr]">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Phiếu cần xử lý
              </p>
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {urgentTickets}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Chiếm {urgentRatio}% của {totalOpenTickets || 0} phiếu đang mở
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Hoàn thành
              </p>
              <p className="text-xl font-semibold text-emerald-600 dark:text-emerald-400">
                {totalOpenTickets > 0 ? `${completionRate}%` : "—"}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {totalOpenTickets > 0
                  ? `${stats.done} phiếu chờ giao`
                  : "Không có dữ liệu"}
              </p>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {statusSnapshotCards.map((card) => (
              <button
                key={card.key}
                onClick={() =>
                  setActiveTab(activeTab === card.key ? "all" : card.key)
                }
                className={`text-left rounded-lg border p-3 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/50 ${activeTab === card.key
                  ? "border-blue-500 bg-blue-50/60 dark:bg-blue-900/20"
                  : "border-slate-200 dark:border-slate-700"
                  }`}
              >
                <div
                  className={`rounded-lg bg-gradient-to-br ${card.accent} p-2`}
                >
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {card.label}
                      </p>
                      <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
                        {card.value}
                      </p>
                    </div>
                    <span className={`h-2 w-2 rounded-full ${card.dot}`}></span>
                  </div>
                  <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400">
                    {card.subtitle}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-2">
          <div className="rounded-lg bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 p-3 text-white shadow-lg">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-white/80">
                  Doanh thu {getDateFilterLabel()}
                </p>
                <p className="mt-1 text-xl font-semibold">
                  {formatCurrency(stats.filteredRevenue)}
                </p>
              </div>
              <HandCoins className="w-6 h-6 text-white/80" />
            </div>
            <p className="mt-1.5 text-[10px] text-white/80">
              Bao gồm các phiếu đã thanh toán {getDateFilterLabel()}
            </p>
          </div>

          <div className="rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-400">
                  Lợi nhuận {getDateFilterLabel()}
                </p>
                <p className="mt-1 text-xl font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(stats.filteredProfit)}
                </p>
              </div>
              <TrendingUp className="w-6 h-6 text-blue-500" />
            </div>
            <div className="mt-1.5 flex items-center justify-between text-[10px]">
              <span className="text-slate-500 dark:text-slate-400">
                Biên lợi nhuận
              </span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {profitMargin}%
              </span>
            </div>
          </div>
        </div>
      </div>

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
      <div className="bg-white dark:bg-slate-800 rounded-lg p-2 border border-slate-200 dark:border-slate-700">
        <div className="flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-1 min-w-[180px] max-w-[280px]">
            <input
              type="text"
              placeholder="Mã phiếu, tên khách..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            <Search
              className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400"
              aria-hidden="true"
            />
          </div>

          {/* Filters - inline */}
          <select
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
          >
            <option value="today">Hôm nay</option>
            <option value="week">7 ngày qua</option>
            <option value="month">30 ngày qua</option>
            <option value="all">Tất cả (chậm hơn)</option>
          </select>
          <select
            value={technicianFilter}
            onChange={(e) => setTechnicianFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
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
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="px-2 py-1.5 text-xs bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg"
          >
            <option value="all">Thanh toán</option>
            <option value="paid">Đã TT</option>
            <option value="unpaid">Chưa TT</option>
            <option value="partial">Trả trước</option>
          </select>

          {/* Spacer */}
          <div className="flex-1"></div>

          {/* Action Buttons */}
          <button
            onClick={() => refetchWorkOrders()}
            disabled={workOrdersFetching}
            className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
            aria-label="Làm mới dữ liệu"
            title="Làm mới"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${workOrdersFetching ? "animate-spin" : ""
                }`}
            />
          </button>
          <button
            onClick={clearFilters}
            className="px-2.5 py-1.5 border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-xs font-medium flex items-center gap-1"
            aria-label="Xóa bộ lọc"
            title="Xóa bộ lọc"
          >
            <Search className="w-3.5 h-3.5" /> Reset
          </button>
          {isOwner && (
            <button
              onClick={() => setShowProfit(!showProfit)}
              className={`px-2.5 py-1.5 border rounded-lg text-xs font-medium flex items-center gap-1 transition-colors ${showProfit
                ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
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
            onClick={() => setShowTemplateModal(true)}
            className="px-2.5 py-1.5 bg-purple-500 hover:bg-purple-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
            aria-label="Mở danh sách mẫu sửa chữa"
          >
            <FileText className="w-3.5 h-3.5" /> Mẫu SC
          </button>
          <Link
            to="/service-history"
            className="px-2.5 py-1.5 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-xs font-medium flex items-center gap-1 transition-colors"
          >
            <History className="w-3.5 h-3.5" /> Lịch sử SC
          </Link>
          <button
            onClick={() => {
              // Always use Desktop modal
              handleOpenModal();
            }}
            className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs font-medium flex items-center gap-1"
            aria-label="Tạo phiếu sửa chữa mới"
          >
            <Plus className="w-3.5 h-3.5" /> Thêm Phiếu
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        {workOrdersIsError && (displayWorkOrders?.length ?? 0) > 0 && (
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-amber-50/60 dark:bg-amber-900/10 text-amber-800 dark:text-amber-200 flex items-center justify-between gap-3">
            <div className="text-sm">
              Không thể tải dữ liệu mới. Bạn vẫn đang xem dữ liệu cũ.
            </div>
            <button
              onClick={() => refetchWorkOrders()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/80 dark:bg-slate-800 border border-amber-200 dark:border-amber-800 text-amber-800 dark:text-amber-200 hover:bg-white dark:hover:bg-slate-700"
            >
              <RefreshCw className="w-4 h-4" /> Thử lại
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
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
                <th className="hidden lg:table-cell px-4 py-3 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
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
                          (workOrdersError as any)?.message ||
                          "Vui lòng thử lại"
                        )}
                      </div>
                      <div className="mt-4 flex items-center justify-center gap-2">
                        <button
                          onClick={() => refetchWorkOrders()}
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
                        <button
                          onClick={() => handleOpenModal()}
                          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium"
                        >
                          <Plus className="w-4 h-4" /> Tạo phiếu
                        </button>
                        <button
                          onClick={clearFilters}
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
                  // Calculate costs based on actual form data structure
                  // Tiền phụ tùng = Tổng giá phụ tùng
                  const partsCost =
                    order.partsUsed?.reduce(
                      (sum, p) => sum + p.quantity * p.price,
                      0
                    ) || 0;

                  // Gia công/Đặt hàng = additionalServices total (price * qty)
                  const servicesTotal =
                    order.additionalServices?.reduce(
                      (sum: number, s: any) =>
                        sum + (s.price || 0) * (s.quantity || 1),
                      0
                    ) || 0;

                  // Phí dịch vụ = laborCost
                  const laborCost = order.laborCost || 0;
                  const totalAmount = order.total || 0;
                  const paidAmount = totalAmount - (order.remainingAmount || 0);
                  const paymentProgress = totalAmount
                    ? Math.min(
                      100,
                      Math.round((paidAmount / totalAmount) * 100)
                    )
                    : 0;

                  // Tính lợi nhuận cho owner
                  // Lợi nhuận = Tổng tiền - Giá vốn phụ tùng - Giá vốn dịch vụ gia công
                  const partsCostPrice =
                    order.partsUsed?.reduce(
                      (sum, p) => sum + (p.costPrice || 0) * (p.quantity || 1),
                      0
                    ) || 0;
                  const servicesCostPrice =
                    order.additionalServices?.reduce(
                      (sum: number, s: any) =>
                        sum + (s.costPrice || 0) * (s.quantity || 1),
                      0
                    ) || 0;
                  const orderProfit =
                    totalAmount - partsCostPrice - servicesCostPrice;

                  const paymentPillClass =
                    order.paymentStatus === "paid"
                      ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300"
                      : "bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-300";
                  const parts = order.partsUsed || [];
                  const services = order.additionalServices || [];

                  const partsSummary = parts
                    .slice(0, 2)
                    .map((p) =>
                      `${p.partName || ""}${p.quantity > 1 ? ` x${p.quantity}` : ""
                        }`.trim()
                    )
                    .filter(Boolean)
                    .join(", ")
                    .trim();
                  const partsSuffix =
                    parts.length > 2 ? ` +${parts.length - 2}` : "";
                  const partsTitle = parts
                    .map((p) =>
                      `${p.partName || ""}${p.quantity > 1 ? ` x${p.quantity}` : ""
                        }`.trim()
                    )
                    .filter(Boolean)
                    .join(", ");

                  const servicesSummary = services
                    .slice(0, 2)
                    .map((s: any) =>
                      `${s.description || ""}${(s.quantity || 1) > 1 ? ` x${s.quantity || 1}` : ""
                        }`.trim()
                    )
                    .filter(Boolean)
                    .join(", ")
                    .trim();
                  const servicesSuffix =
                    services.length > 2 ? ` +${services.length - 2}` : "";
                  const servicesTitle = services
                    .map((s: any) =>
                      `${s.description || ""}${(s.quantity || 1) > 1 ? ` x${s.quantity || 1}` : ""
                        }`.trim()
                    )
                    .filter(Boolean)
                    .join(", ");

                  return (
                    <tr
                      key={order.id}
                      onClick={() => handleOpenModal(order)}
                      className="group bg-white dark:bg-slate-800 hover:bg-blue-50/50 dark:hover:bg-slate-700/50 cursor-pointer transition-all duration-150 hover:shadow-sm border-l-4 border-transparent hover:border-blue-500"
                    >
                      {/* Column 1: Mã phiếu */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-0.5">
                          <div className="font-mono font-bold text-blue-600 dark:text-blue-400 text-sm">
                            {formatWorkOrderId(
                              order.id,
                              storeSettings?.work_order_prefix
                            )}
                          </div>
                          <div className="text-xs text-slate-500">
                            <span>Ngày: </span>
                            <span className="text-slate-600 dark:text-slate-400">
                              {formatDate(order.creationDate, true)}
                            </span>
                          </div>
                          <div className="text-xs text-cyan-600 dark:text-cyan-400">
                            NV: {order.technicianName || "Chưa phân công"}
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Khách hàng */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1">
                          <div className="font-bold text-lg text-slate-900 dark:text-slate-100">
                            {order.customerName}
                          </div>
                          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                            <Smartphone className="w-3.5 h-3.5" />
                            <span className="font-mono">
                              {formatMaskedPhone(order.customerPhone)}
                            </span>
                            {order.customerPhone && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCallCustomer(order.customerPhone || "");
                                }}
                                className="ml-1 inline-flex items-center justify-center w-7 h-7 rounded-md text-blue-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                                aria-label={`Gọi khách: ${order.customerPhone}`}
                                title={`Gọi: ${order.customerPhone}`}
                              >
                                <PhoneCall className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">
                            <Bike className="w-3.5 h-3.5 inline-block mr-1 text-slate-400" />
                            <span className="font-medium">
                              {order.vehicleModel || "N/A"}
                            </span>
                            {order.licensePlate && (
                              <span className="ml-1.5 px-1.5 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-mono text-[10px]">
                                {order.licensePlate}
                              </span>
                            )}
                          </div>
                          {order.issueDescription &&
                            order.issueDescription !== "Không có mô tả" && (
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 italic line-clamp-2 mt-1.5">
                                {order.issueDescription}
                              </div>
                            )}
                        </div>
                      </td>

                      {/* Column 3: Chi tiết - Compact format */}
                      <td className="px-4 py-4 align-top">
                        <div className="space-y-1.5 max-w-[220px]">
                          {servicesSummary && (
                            <div
                              className="text-xs flex items-start gap-1.5"
                              title={
                                servicesTitle
                                  ? `Dịch vụ: ${servicesTitle}`
                                  : "Dịch vụ"
                              }
                            >
                              <Settings className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
                                {servicesSummary}
                                {servicesSuffix && (
                                  <span className="text-slate-400">
                                    {servicesSuffix}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {partsSummary && (
                            <div
                              className="text-xs flex items-start gap-1.5"
                              title={
                                partsTitle
                                  ? `Phụ tùng: ${partsTitle}`
                                  : "Phụ tùng"
                              }
                            >
                              <Wrench className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                              <span className="text-slate-700 dark:text-slate-300 line-clamp-1">
                                {partsSummary}
                                {partsSuffix && (
                                  <span className="text-slate-400">
                                    {partsSuffix}
                                  </span>
                                )}
                              </span>
                            </div>
                          )}

                          {!partsSummary && !servicesSummary && (
                            <div className="text-xs text-slate-400 italic">
                              —
                            </div>
                          )}

                          {/* Status badges for tablet/mobile - show when payment column hidden */}
                          <div className="lg:hidden flex flex-wrap items-center gap-1.5 pt-1">
                            <StatusBadge
                              status={order.status as WorkOrderStatus}
                            />
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${paymentPillClass}`}
                            >
                              {order.paymentStatus === "paid"
                                ? "Đã TT"
                                : order.paymentStatus === "partial"
                                  ? "TT một phần"
                                  : "Chưa TT"}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Column 4: Thanh toán & trạng thái - Clean layout - Hidden on tablet */}
                      <td className="hidden lg:table-cell px-4 py-4 align-top">
                        <div className="space-y-2 min-w-[200px]">
                          {/* Tổng tiền */}
                          <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {formatCurrency(totalAmount)}
                          </div>

                          {/* Lợi nhuận - Chỉ hiển thị cho owner khi bật toggle */}
                          {isOwner &&
                            showProfit &&
                            order.paymentStatus === "paid" && (
                              <div
                                className="flex items-center gap-1 text-xs"
                                title="Lợi nhuận và biên lợi nhuận trên tổng tiền"
                              >
                                <span className="text-slate-500">LN</span>
                                <span
                                  className={`font-semibold ${orderProfit > 0
                                    ? "text-emerald-600 dark:text-emerald-400"
                                    : "text-red-500"
                                    }`}
                                >
                                  {orderProfit > 0 ? "+" : ""}
                                  {formatCurrency(orderProfit)}
                                </span>
                                {totalAmount > 0 && (
                                  <span className="text-slate-400">
                                    (Biên LN{" "}
                                    {Math.round(
                                      (orderProfit / totalAmount) * 100
                                    )}
                                    %)
                                  </span>
                                )}
                              </div>
                            )}

                          {/* Progress bar + Đã thu */}
                          {totalAmount > 0 && (
                            <div className="space-y-1">
                              <div
                                className="h-2 w-full rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden"
                                title={`Đã thanh toán ${paymentProgress}%`}
                              >
                                <div
                                  className={`h-full rounded-full transition-all duration-300 ${paymentProgress >= 100
                                    ? "bg-gradient-to-r from-emerald-500 to-emerald-600"
                                    : paymentProgress > 0
                                      ? "bg-gradient-to-r from-blue-500 to-blue-600"
                                      : "bg-slate-300"
                                    }`}
                                  style={{
                                    width: `${Math.min(paymentProgress, 100)}%`,
                                  }}
                                />
                              </div>
                              <div className="flex justify-between items-center text-xs text-slate-500 dark:text-slate-400">
                                <span className="flex items-center gap-1">
                                  <span className="font-medium text-slate-600 dark:text-slate-300">
                                    Đã thu:
                                  </span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400">
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
                                {order.depositAmount &&
                                  order.depositAmount > 0 && (
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
                                        {formatCurrency(
                                          order.remainingAmount ?? 0
                                        )}
                                      </span>
                                    </div>
                                  )}
                                {order.paymentStatus === "paid" &&
                                  totalAmount > 0 &&
                                  (order.remainingAmount ?? 0) === 0 && (
                                    <div className="flex items-center justify-between text-xs">
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-green-500/20 text-green-600 dark:text-green-400 rounded font-medium">
                                        <Check className="w-3 h-3" /> Đã thanh
                                        toán đủ
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
                              {order.paymentStatus === "paid"
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
                                const rect =
                                  e.currentTarget.getBoundingClientRect();
                                setDropdownPosition({
                                  top: rect.bottom + 4,
                                  right: window.innerWidth - rect.right,
                                });
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
                                  top: dropdownPosition.top,
                                  right: dropdownPosition.right,
                                }}
                              >
                                <div className="py-1">
                                  <button
                                    onClick={() => {
                                      handleOpenModal(order);
                                      setRowActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                      <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                                    </div>
                                    <span>Xem chi tiết</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handlePrintOrder(order);
                                      setRowActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                      <Printer className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                                    </div>
                                    <span>In phiếu</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleCallCustomer(
                                        order.customerPhone || ""
                                      );
                                      setRowActionMenuId(null);
                                    }}
                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                                  >
                                    <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                                      <Smartphone className="w-4 h-4 text-green-600 dark:text-green-400" />
                                    </div>
                                    <span>Gọi khách hàng</span>
                                  </button>
                                  {!order.refunded && (
                                    <>
                                      <div className="my-1 border-t border-slate-200 dark:border-slate-700"></div>
                                      <button
                                        onClick={() => {
                                          handleRefundOrder(order);
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
                onClick={handleLoadMore}
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

      {/* Repair Templates Modal - Component tách riêng */}
      <RepairTemplatesModal
        isOpen={showTemplateModal}
        onClose={() => setShowTemplateModal(false)}
        onApplyTemplate={(template) => {
          // Convert and apply template to current work order
          const newOrder: WorkOrder = {
            id: `WO-${Date.now()}`,
            customerName: "",
            customerPhone: "",
            vehicleModel: "",
            issueDescription: template.description,
            status: "Tiếp nhận",
            creationDate: new Date().toISOString(),
            estimatedCompletion: new Date(
              Date.now() + template.duration * 60000
            ).toISOString(),
            assignedTechnician: "",
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
          };
          setEditingOrder(newOrder);
          setShowTemplateModal(false);
          setShowModal(true);
        }}
        parts={fetchedParts || []}
        currentBranchId={currentBranchId}
      />

      {/* Work Order Modal */}
      {showModal && editingOrder && (
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
          invalidateWorkOrders={() =>
            queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] })
          }
        />
      )}

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

      {/* Print Preview Modal */}
      {showPrintPreview && printOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-6 py-4 flex items-center justify-between rounded-t-xl flex-shrink-0">
              <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
                Xem trước phiếu in
              </h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleShareInvoice}
                  disabled={isSharing}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <Share2 className="w-4 h-4" />
                  {isSharing ? "Đang xử lý..." : "Chia sẻ"}
                </button>
                <button
                  onClick={handleDoPrint}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition"
                >
                  <Printer className="w-4 h-4" />
                  In phiếu
                </button>
                <button
                  onClick={() => {
                    setShowPrintPreview(false);
                    setPrintOrder(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                  aria-label="Đóng"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    className="w-5 h-5"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </div>

            {/* Print Preview Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-slate-100 dark:bg-slate-900">
              <div
                ref={invoicePreviewRef}
                className="bg-white shadow-lg mx-auto"
                style={{ width: "148mm", minHeight: "210mm", color: "#000" }}
              >
                <div style={{ padding: "10mm" }}>
                  {/* Store Info Header - Compact Layout */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "4mm",
                      marginBottom: "4mm",
                      borderBottom: "2px solid #3b82f6",
                      paddingBottom: "3mm",
                    }}
                  >
                    {/* Left: Logo */}
                    {storeSettings?.logo_url && (
                      <img
                        src={storeSettings.logo_url}
                        alt="Logo"
                        style={{
                          height: "18mm",
                          width: "18mm",
                          objectFit: "contain",
                          flexShrink: 0,
                        }}
                      />
                    )}

                    {/* Center: Store Info */}
                    <div
                      style={{ fontSize: "8.5pt", lineHeight: "1.4", flex: 1 }}
                    >
                      <div
                        style={{
                          fontWeight: "bold",
                          fontSize: "11pt",
                          marginBottom: "1mm",
                          color: "#1e40af",
                        }}
                      >
                        {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#ef4444"
                        >
                          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                        </svg>
                        <span>
                          {storeSettings?.address ||
                            "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                        </span>
                      </div>
                      <div
                        style={{
                          color: "#000",
                          display: "flex",
                          alignItems: "center",
                          gap: "1mm",
                        }}
                      >
                        <svg
                          style={{
                            width: "10px",
                            height: "10px",
                            flexShrink: 0,
                          }}
                          viewBox="0 0 24 24"
                          fill="#16a34a"
                        >
                          <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                        </svg>
                        <span>{storeSettings?.phone || "0947.747.907"}</span>
                      </div>
                      {storeSettings?.email && (
                        <div
                          style={{
                            color: "#000",
                            display: "flex",
                            alignItems: "center",
                            gap: "1mm",
                          }}
                        >
                          <svg
                            style={{
                              width: "10px",
                              height: "10px",
                              flexShrink: 0,
                            }}
                            viewBox="0 0 24 24"
                            fill="#3b82f6"
                          >
                            <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                          </svg>
                          <span>{storeSettings.email}</span>
                        </div>
                      )}
                    </div>

                    {/* Right: Bank Info & QR */}
                    <div
                      style={{
                        fontSize: "8pt",
                        lineHeight: "1.4",
                        textAlign: "right",
                        flexShrink: 0,
                      }}
                    >
                      {storeSettings?.bank_name && (
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "flex-end",
                            gap: "3mm",
                            border: "1px solid #3b82f6",
                            borderRadius: "2mm",
                            padding: "2mm",
                            backgroundColor: "#eff6ff",
                          }}
                        >
                          {/* Bank Info */}
                          <div style={{ textAlign: "right", flex: 1 }}>
                            <div
                              style={{
                                fontWeight: "bold",
                                marginBottom: "1mm",
                                color: "#000",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "flex-end",
                                gap: "1mm",
                              }}
                            >
                              <svg
                                style={{
                                  width: "10px",
                                  height: "10px",
                                  flexShrink: 0,
                                }}
                                viewBox="0 0 24 24"
                                fill="#0891b2"
                              >
                                <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                              </svg>
                              <span>{storeSettings.bank_name}</span>
                            </div>
                            {storeSettings.bank_account_number && (
                              <div style={{ color: "#000" }}>
                                STK: {storeSettings.bank_account_number}
                              </div>
                            )}
                            {storeSettings.bank_account_holder && (
                              <div style={{ color: "#000", fontSize: "7.5pt" }}>
                                {storeSettings.bank_account_holder}
                              </div>
                            )}
                          </div>
                          {/* QR Code - Larger */}
                          {storeSettings.bank_qr_url && (
                            <div style={{ flexShrink: 0 }}>
                              <img
                                src={storeSettings.bank_qr_url}
                                alt="QR Banking"
                                style={{
                                  height: "25mm",
                                  width: "25mm",
                                  objectFit: "contain",
                                }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Title & Meta */}
                  <div style={{ marginBottom: "4mm" }}>
                    <div style={{ textAlign: "center", marginBottom: "2mm" }}>
                      <h1
                        style={{
                          fontSize: "16pt",
                          fontWeight: "bold",
                          margin: "0",
                          textTransform: "uppercase",
                          color: "#1e40af",
                        }}
                      >
                        PHIẾU DỊCH VỤ SỬA CHỮA
                      </h1>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "9pt",
                        color: "#666",
                      }}
                    >
                      <div>
                        {new Date(printOrder.creationDate).toLocaleString(
                          "vi-VN",
                          {
                            year: "numeric",
                            month: "2-digit",
                            day: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          }
                        )}
                      </div>
                      <div style={{ fontWeight: "bold" }}>
                        Mã:{" "}
                        {formatWorkOrderId(
                          printOrder.id,
                          storeSettings?.work_order_prefix
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Customer Info - Compact */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "3mm",
                      marginBottom: "3mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f8fafc",
                      color: "#000",
                      fontSize: "9pt",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "4mm",
                        marginBottom: "1.5mm",
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: "bold" }}>Khách hàng:</span>{" "}
                        {printOrder.customerName}
                      </div>
                      <div style={{ flex: "0 0 auto" }}>
                        <span style={{ fontWeight: "bold" }}>SĐT:</span>{" "}
                        {printOrder.customerPhone}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "4mm" }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontWeight: "bold" }}>Loại xe:</span>{" "}
                        {printOrder.vehicleModel}
                      </div>
                      <div style={{ flex: "0 0 auto" }}>
                        <span style={{ fontWeight: "bold" }}>Biển số:</span>{" "}
                        {printOrder.licensePlate}
                      </div>
                    </div>
                  </div>

                  {/* Issue Description */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "4mm",
                      marginBottom: "4mm",
                      borderRadius: "2mm",
                      color: "#000",
                    }}
                  >
                    <div style={{ display: "flex", gap: "3mm" }}>
                      <div
                        style={{
                          fontWeight: "bold",
                          minWidth: "20%",
                          flexShrink: 0,
                        }}
                      >
                        Mô tả sự cố:
                      </div>
                      <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                        {printOrder.issueDescription || "Không có mô tả"}
                      </div>
                    </div>
                  </div>

                  {/* Parts Table */}
                  {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
                    <div style={{ marginBottom: "4mm", color: "#000" }}>
                      <p
                        style={{
                          fontWeight: "bold",
                          margin: "0 0 2mm 0",
                          fontSize: "11pt",
                        }}
                      >
                        Phụ tùng sử dụng:
                      </p>
                      <table
                        style={{
                          width: "100%",
                          borderCollapse: "collapse",
                          border: "1px solid #ddd",
                        }}
                      >
                        <thead>
                          <tr style={{ backgroundColor: "#f5f5f5" }}>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "left",
                                fontSize: "10pt",
                              }}
                            >
                              Tên phụ tùng
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "center",
                                fontSize: "10pt",
                                width: "15%",
                              }}
                            >
                              SL
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "right",
                                fontSize: "10pt",
                                width: "25%",
                              }}
                            >
                              Đơn giá
                            </th>
                            <th
                              style={{
                                border: "1px solid #ddd",
                                padding: "2mm",
                                textAlign: "right",
                                fontSize: "10pt",
                                width: "25%",
                              }}
                            >
                              Thành tiền
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {printOrder.partsUsed.map(
                            (part: WorkOrderPart, idx: number) => (
                              <tr key={idx}>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    fontSize: "10pt",
                                  }}
                                >
                                  {part.partName}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    textAlign: "center",
                                    fontSize: "10pt",
                                  }}
                                >
                                  {part.quantity}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    textAlign: "right",
                                    fontSize: "10pt",
                                  }}
                                >
                                  {formatCurrency(part.price)}
                                </td>
                                <td
                                  style={{
                                    border: "1px solid #ddd",
                                    padding: "2mm",
                                    textAlign: "right",
                                    fontSize: "10pt",
                                    fontWeight: "bold",
                                  }}
                                >
                                  {formatCurrency(part.price * part.quantity)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Additional Services */}
                  {printOrder.additionalServices &&
                    printOrder.additionalServices.length > 0 && (
                      <div style={{ marginBottom: "4mm", color: "#000" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 2mm 0",
                            fontSize: "11pt",
                            color: "#000",
                          }}
                        >
                          Dịch vụ bổ sung:
                        </p>
                        <ul
                          style={{
                            margin: "0",
                            paddingLeft: "5mm",
                            color: "#000",
                          }}
                        >
                          {printOrder.additionalServices.map((service, idx) => (
                            <li key={idx} style={{ marginBottom: "1mm" }}>
                              {service.description} -{" "}
                              {formatCurrency(service.price)} x{" "}
                              {service.quantity}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                  {/* Cost Summary */}
                  <div
                    style={{
                      border: "1px solid #ddd",
                      padding: "4mm",
                      marginBottom: "4mm",
                      borderRadius: "2mm",
                      backgroundColor: "#f9f9f9",
                      color: "#000",
                    }}
                  >
                    <table
                      style={{
                        width: "100%",
                        borderSpacing: "0",
                        color: "#000",
                      }}
                    >
                      <tbody>
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Tiền phụ tùng:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(
                              printOrder.partsUsed?.reduce(
                                (sum: number, p: WorkOrderPart) =>
                                  sum + p.price * p.quantity,
                                0
                              ) || 0
                            )}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Phí dịch vụ:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(printOrder.laborCost || 0)}
                          </td>
                        </tr>
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Giá công/Đặt hàng:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(
                              printOrder.additionalServices?.reduce(
                                (sum: number, s: any) =>
                                  sum + (s.price || 0) * (s.quantity || 1),
                                0
                              ) || 0
                            )}
                          </td>
                        </tr>
                        {printOrder.discount != null &&
                          printOrder.discount > 0 && (
                            <tr>
                              <td
                                style={{
                                  fontWeight: "bold",
                                  paddingBottom: "2mm",
                                  fontSize: "10pt",
                                  color: "#e74c3c",
                                }}
                              >
                                Giảm giá:
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  paddingBottom: "2mm",
                                  fontSize: "10pt",
                                  color: "#e74c3c",
                                }}
                              >
                                -{formatCurrency(printOrder.discount)}
                              </td>
                            </tr>
                          )}
                        <tr style={{ borderTop: "2px solid #333" }}>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingTop: "2mm",
                              fontSize: "12pt",
                            }}
                          >
                            TỔNG CỘNG:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingTop: "2mm",
                              fontSize: "12pt",
                              fontWeight: "bold",
                              color: "#2563eb",
                            }}
                          >
                            {formatCurrency(printOrder.total)} ₫
                          </td>
                        </tr>
                        {printOrder.totalPaid != null &&
                          printOrder.totalPaid > 0 && (
                            <tr>
                              <td
                                style={{
                                  fontWeight: "bold",
                                  paddingTop: "2mm",
                                  fontSize: "10pt",
                                  color: "#16a34a",
                                }}
                              >
                                Đã thanh toán:
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  paddingTop: "2mm",
                                  fontSize: "10pt",
                                  color: "#16a34a",
                                }}
                              >
                                {formatCurrency(printOrder.totalPaid)}
                              </td>
                            </tr>
                          )}
                        {printOrder.remainingAmount != null &&
                          printOrder.remainingAmount > 0 && (
                            <tr>
                              <td
                                style={{
                                  fontWeight: "bold",
                                  fontSize: "11pt",
                                  color: "#dc2626",
                                }}
                              >
                                Còn lại:
                              </td>
                              <td
                                style={{
                                  textAlign: "right",
                                  fontSize: "11pt",
                                  fontWeight: "bold",
                                  color: "#dc2626",
                                }}
                              >
                                {formatCurrency(printOrder.remainingAmount)}
                              </td>
                            </tr>
                          )}
                        {printOrder.paymentMethod && (
                          <tr>
                            <td
                              style={{
                                paddingTop: "2mm",
                                fontSize: "9pt",
                                color: "#666",
                              }}
                            >
                              Hình thức thanh toán:
                            </td>
                            <td
                              style={{
                                textAlign: "right",
                                paddingTop: "2mm",
                                fontSize: "9pt",
                                color: "#666",
                              }}
                            >
                              {printOrder.paymentMethod === "cash"
                                ? "Tiền mặt"
                                : printOrder.paymentMethod === "bank"
                                  ? "Chuyển khoản"
                                  : printOrder.paymentMethod}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {/* Footer - Signatures & Bank Info */}
                  <div
                    style={{
                      marginTop: "8mm",
                      paddingTop: "4mm",
                      borderTop: "1px dashed #999",
                      color: "#000",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "10pt",
                      }}
                    >
                      <div style={{ textAlign: "center", width: "45%" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 10mm 0",
                            color: "#000",
                          }}
                        >
                          Khách hàng
                        </p>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "9pt",
                            color: "#666",
                          }}
                        >
                          (Ký và ghi rõ họ tên)
                        </p>
                      </div>
                      <div style={{ textAlign: "center", width: "45%" }}>
                        <p
                          style={{
                            fontWeight: "bold",
                            margin: "0 0 10mm 0",
                            color: "#000",
                          }}
                        >
                          Nhân viên
                        </p>
                        <p
                          style={{
                            margin: "0",
                            fontSize: "9pt",
                            color: "#666",
                          }}
                        >
                          {printOrder.technicianName || "(Ký và ghi rõ họ tên)"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Note */}
                  <div
                    style={{
                      marginTop: "4mm",
                      padding: "3mm",
                      backgroundColor: "#fff9e6",
                      border: "1px solid #ffd700",
                      borderRadius: "2mm",
                      fontSize: "9pt",
                      textAlign: "center",
                      color: "#000",
                    }}
                  >
                    <p
                      style={{
                        margin: "0",
                        fontStyle: "italic",
                        color: "#000",
                      }}
                    >
                      Cảm ơn quý khách đã sử dụng dịch vụ!
                    </p>
                    <p
                      style={{
                        margin: "1mm 0 0 0",
                        fontStyle: "italic",
                        color: "#000",
                      }}
                    >
                      Vui lòng giữ phiếu này để đối chiếu khi nhận xe
                    </p>
                  </div>

                  {/* Warranty Policy Disclaimer */}
                  <div
                    style={{
                      marginTop: "3mm",
                      padding: "2mm",
                      fontSize: "8pt",
                      color: "#666",
                      borderTop: "1px solid #e5e7eb",
                      lineHeight: "1.4",
                    }}
                  >
                    <p style={{ margin: "0 0 1mm 0", fontWeight: "bold" }}>
                      Chính sách bảo hành:
                    </p>
                    <ul
                      style={{
                        margin: "0",
                        paddingLeft: "5mm",
                        listStyleType: "disc",
                      }}
                    >
                      <li>
                        Bảo hành áp dụng cho phụ tùng chính hãng và lỗi kỹ thuật
                        do thợ
                      </li>
                      <li>
                        Không bảo hành đối với va chạm, ngã xe, ngập nước sau
                        khi nhận xe
                      </li>
                      <li>
                        Mang theo phiếu này khi đến bảo hành. Liên hệ hotline
                        nếu có thắc mắc
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print Template (Hidden - only for actual printing) */}
      {printOrder && (
        <div
          id="work-order-receipt"
          className="hidden print:block"
          style={{
            width: "148mm",
            margin: "0 auto",
            padding: "10mm",
            fontFamily: "Arial, sans-serif",
            fontSize: "11pt",
            color: "#000",
            backgroundColor: "#fff",
          }}
        >
          {/* Header with Logo, Store Info and Bank Info */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "4mm",
              borderBottom: "2px solid #3b82f6",
              paddingBottom: "3mm",
              marginBottom: "4mm",
            }}
          >
            {/* Left: Logo (if available) */}
            {storeSettings?.logo_url && (
              <img
                src={storeSettings.logo_url}
                alt="Logo"
                style={{
                  height: "18mm",
                  width: "18mm",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            )}

            {/* Center: Store Info */}
            <div style={{ fontSize: "8.5pt", lineHeight: "1.4", flex: 1 }}>
              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "11pt",
                  marginBottom: "1mm",
                  color: "#1e40af",
                }}
              >
                {storeSettings?.store_name || "Nhạn Lâm SmartCare"}
              </div>
              <div
                style={{
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  gap: "1mm",
                }}
              >
                <svg
                  style={{ width: "10px", height: "10px", flexShrink: 0 }}
                  viewBox="0 0 24 24"
                  fill="#ef4444"
                >
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <span>
                  {storeSettings?.address ||
                    "Ấp Phú Lợi B, Xã Long Phú Thuận, Đông Tháp"}
                </span>
              </div>
              <div
                style={{
                  color: "#000",
                  display: "flex",
                  alignItems: "center",
                  gap: "1mm",
                }}
              >
                <svg
                  style={{ width: "10px", height: "10px", flexShrink: 0 }}
                  viewBox="0 0 24 24"
                  fill="#16a34a"
                >
                  <path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z" />
                </svg>
                <span>{storeSettings?.phone || "0947.747.907"}</span>
              </div>
              {storeSettings?.email && (
                <div
                  style={{
                    color: "#000",
                    display: "flex",
                    alignItems: "center",
                    gap: "1mm",
                  }}
                >
                  <svg
                    style={{ width: "10px", height: "10px", flexShrink: 0 }}
                    viewBox="0 0 24 24"
                    fill="#3b82f6"
                  >
                    <path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z" />
                  </svg>
                  <span>{storeSettings.email}</span>
                </div>
              )}
            </div>

            {/* Right: Bank Info & QR */}
            <div
              style={{
                fontSize: "8pt",
                lineHeight: "1.4",
                textAlign: "right",
                flexShrink: 0,
              }}
            >
              {storeSettings?.bank_name && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-end",
                    gap: "3mm",
                    border: "1px solid #3b82f6",
                    borderRadius: "2mm",
                    padding: "2mm",
                    backgroundColor: "#eff6ff",
                  }}
                >
                  {/* Bank Info */}
                  <div style={{ textAlign: "right", flex: 1 }}>
                    <div
                      style={{
                        fontWeight: "bold",
                        marginBottom: "1mm",
                        color: "#000",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "1mm",
                      }}
                    >
                      <svg
                        style={{ width: "10px", height: "10px", flexShrink: 0 }}
                        viewBox="0 0 24 24"
                        fill="#0891b2"
                      >
                        <path d="M4 10h3v7H4zm6.5 0h3v7h-3zM2 19h20v3H2zm15-9h3v7h-3zm-5-9L2 6v2h20V6z" />
                      </svg>
                      <span>{storeSettings.bank_name}</span>
                    </div>
                    {storeSettings.bank_account_number && (
                      <div style={{ color: "#000" }}>
                        STK: {storeSettings.bank_account_number}
                      </div>
                    )}
                    {storeSettings.bank_account_holder && (
                      <div style={{ color: "#000", fontSize: "7.5pt" }}>
                        {storeSettings.bank_account_holder}
                      </div>
                    )}
                  </div>
                  {/* QR Code - Larger */}
                  {storeSettings.bank_qr_url && (
                    <div style={{ flexShrink: 0 }}>
                      <img
                        src={storeSettings.bank_qr_url}
                        alt="QR Banking"
                        style={{
                          height: "25mm",
                          width: "25mm",
                          objectFit: "contain",
                        }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Title & Meta */}
          <div style={{ marginBottom: "4mm" }}>
            <div style={{ textAlign: "center", marginBottom: "2mm" }}>
              <h1
                style={{
                  fontSize: "16pt",
                  fontWeight: "bold",
                  margin: "0",
                  textTransform: "uppercase",
                  color: "#1e40af",
                }}
              >
                PHIẾU DỊCH VỤ SỬA CHỮA
              </h1>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "9pt",
                color: "#666",
              }}
            >
              <div>
                {new Date(printOrder.creationDate).toLocaleString("vi-VN", {
                  year: "numeric",
                  month: "2-digit",
                  day: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div style={{ fontWeight: "bold" }}>
                Mã:{" "}
                {formatWorkOrderId(
                  printOrder.id,
                  storeSettings?.work_order_prefix
                )}
              </div>
            </div>
          </div>

          {/* Customer Info */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
            }}
          >
            <table style={{ width: "100%", borderSpacing: "0" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      width: "20%",
                      paddingBottom: "2mm",
                    }}
                  >
                    Khách hàng:
                  </td>
                  <td style={{ paddingBottom: "2mm", width: "30%" }}>
                    {printOrder.customerName}
                  </td>
                  <td
                    style={{
                      fontWeight: "bold",
                      width: "15%",
                      paddingBottom: "2mm",
                      paddingLeft: "3mm",
                    }}
                  >
                    SĐT:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>
                    {printOrder.customerPhone}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                    }}
                  >
                    Loại xe:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>
                    {printOrder.vehicleModel}
                  </td>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                      paddingLeft: "3mm",
                    }}
                  >
                    Biển số:
                  </td>
                  <td style={{ paddingBottom: "2mm" }}>
                    {printOrder.licensePlate}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Issue Description */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
            }}
          >
            <div style={{ display: "flex", gap: "3mm" }}>
              <div
                style={{ fontWeight: "bold", minWidth: "20%", flexShrink: 0 }}
              >
                Mô tả sự cố:
              </div>
              <div style={{ flex: 1, whiteSpace: "pre-wrap" }}>
                {printOrder.issueDescription || "Không có mô tả"}
              </div>
            </div>
          </div>

          {/* Parts Table */}
          {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
            <div style={{ marginBottom: "4mm" }}>
              <p
                style={{
                  fontWeight: "bold",
                  margin: "0 0 2mm 0",
                  fontSize: "11pt",
                }}
              >
                Phụ tùng sử dụng:
              </p>
              <table
                style={{
                  width: "100%",
                  borderCollapse: "collapse",
                  border: "1px solid #ddd",
                }}
              >
                <thead>
                  <tr style={{ backgroundColor: "#f5f5f5" }}>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "left",
                        fontSize: "10pt",
                      }}
                    >
                      Tên phụ tùng
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "center",
                        fontSize: "10pt",
                        width: "15%",
                      }}
                    >
                      SL
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "right",
                        fontSize: "10pt",
                        width: "25%",
                      }}
                    >
                      Đơn giá
                    </th>
                    <th
                      style={{
                        border: "1px solid #ddd",
                        padding: "2mm",
                        textAlign: "right",
                        fontSize: "10pt",
                        width: "25%",
                      }}
                    >
                      Thành tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {printOrder.partsUsed.map(
                    (part: WorkOrderPart, idx: number) => (
                      <tr key={idx}>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            fontSize: "10pt",
                          }}
                        >
                          {part.partName}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            textAlign: "center",
                            fontSize: "10pt",
                          }}
                        >
                          {part.quantity}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            textAlign: "right",
                            fontSize: "10pt",
                          }}
                        >
                          {formatCurrency(part.price)}
                        </td>
                        <td
                          style={{
                            border: "1px solid #ddd",
                            padding: "2mm",
                            textAlign: "right",
                            fontSize: "10pt",
                            fontWeight: "bold",
                          }}
                        >
                          {formatCurrency(part.price * part.quantity)}
                        </td>
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          )}

          {/* Additional Services */}
          {printOrder.additionalServices &&
            printOrder.additionalServices.length > 0 && (
              <div style={{ marginBottom: "4mm" }}>
                <p
                  style={{
                    fontWeight: "bold",
                    margin: "0 0 2mm 0",
                    fontSize: "11pt",
                  }}
                >
                  Dịch vụ bổ sung:
                </p>
                <ul style={{ margin: "0", paddingLeft: "5mm" }}>
                  {printOrder.additionalServices.map((service, idx) => (
                    <li key={idx} style={{ marginBottom: "1mm" }}>
                      {service.description} - {formatCurrency(service.price)} x{" "}
                      {service.quantity}
                    </li>
                  ))}
                </ul>
              </div>
            )}

          {/* Cost Summary */}
          <div
            style={{
              border: "1px solid #ddd",
              padding: "4mm",
              marginBottom: "4mm",
              borderRadius: "2mm",
              backgroundColor: "#f9f9f9",
            }}
          >
            <table style={{ width: "100%", borderSpacing: "0" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    Tiền phụ tùng:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    {formatCurrency(
                      printOrder.partsUsed?.reduce(
                        (sum: number, p: WorkOrderPart) =>
                          sum + p.price * p.quantity,
                        0
                      ) || 0
                    )}
                  </td>
                </tr>
                <tr>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    Giá công/Đặt hàng:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingBottom: "2mm",
                      fontSize: "10pt",
                    }}
                  >
                    {formatCurrency(
                      printOrder.additionalServices?.reduce(
                        (sum: number, s: any) =>
                          sum + (s.price || 0) * (s.quantity || 1),
                        0
                      ) || 0
                    )}
                  </td>
                </tr>
                {/* Dịch vụ bổ sung aggregated above as Giá công/Đặt hàng */}
                {printOrder.discount != null && printOrder.discount > 0 && (
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingBottom: "2mm",
                        fontSize: "10pt",
                        color: "#e74c3c",
                      }}
                    >
                      Giảm giá:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingBottom: "2mm",
                        fontSize: "10pt",
                        color: "#e74c3c",
                      }}
                    >
                      -{formatCurrency(printOrder.discount)}
                    </td>
                  </tr>
                )}
                <tr style={{ borderTop: "2px solid #333" }}>
                  <td
                    style={{
                      fontWeight: "bold",
                      paddingTop: "2mm",
                      fontSize: "12pt",
                    }}
                  >
                    TỔNG CỘNG:
                  </td>
                  <td
                    style={{
                      textAlign: "right",
                      paddingTop: "2mm",
                      fontSize: "12pt",
                      fontWeight: "bold",
                      color: "#2563eb",
                    }}
                  >
                    {formatCurrency(printOrder.total)} ₫
                  </td>
                </tr>
                {printOrder.totalPaid != null && printOrder.totalPaid > 0 && (
                  <tr>
                    <td
                      style={{
                        fontWeight: "bold",
                        paddingTop: "2mm",
                        fontSize: "10pt",
                        color: "#16a34a",
                      }}
                    >
                      Đã thanh toán:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingTop: "2mm",
                        fontSize: "10pt",
                        color: "#16a34a",
                      }}
                    >
                      {formatCurrency(printOrder.totalPaid)}
                    </td>
                  </tr>
                )}
                {printOrder.remainingAmount != null &&
                  printOrder.remainingAmount > 0 && (
                    <tr>
                      <td
                        style={{
                          fontWeight: "bold",
                          fontSize: "11pt",
                          color: "#dc2626",
                        }}
                      >
                        Còn lại:
                      </td>
                      <td
                        style={{
                          textAlign: "right",
                          fontSize: "11pt",
                          fontWeight: "bold",
                          color: "#dc2626",
                        }}
                      >
                        {formatCurrency(printOrder.remainingAmount)}
                      </td>
                    </tr>
                  )}
                {printOrder.paymentMethod && (
                  <tr>
                    <td
                      style={{
                        paddingTop: "2mm",
                        fontSize: "9pt",
                        color: "#666",
                      }}
                    >
                      Hình thức thanh toán:
                    </td>
                    <td
                      style={{
                        textAlign: "right",
                        paddingTop: "2mm",
                        fontSize: "9pt",
                        color: "#666",
                      }}
                    >
                      {printOrder.paymentMethod === "cash"
                        ? "Tiền mặt"
                        : printOrder.paymentMethod === "bank"
                          ? "Chuyển khoản"
                          : printOrder.paymentMethod}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div
            style={{
              marginTop: "8mm",
              paddingTop: "4mm",
              borderTop: "1px dashed #999",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "10pt",
              }}
            >
              <div style={{ textAlign: "center", width: "45%" }}>
                <p style={{ fontWeight: "bold", margin: "0 0 10mm 0" }}>
                  Khách hàng
                </p>
                <p style={{ margin: "0", fontSize: "9pt", color: "#666" }}>
                  (Ký và ghi rõ họ tên)
                </p>
              </div>
              <div style={{ textAlign: "center", width: "45%" }}>
                <p style={{ fontWeight: "bold", margin: "0 0 10mm 0" }}>
                  Nhân viên
                </p>
                <p style={{ margin: "0", fontSize: "9pt", color: "#666" }}>
                  {printOrder.technicianName || "(Ký và ghi rõ họ tên)"}
                </p>
              </div>
            </div>
          </div>

          {/* Note */}
          <div
            style={{
              marginTop: "4mm",
              padding: "3mm",
              backgroundColor: "#fff9e6",
              border: "1px solid #ffd700",
              borderRadius: "2mm",
              fontSize: "9pt",
              textAlign: "center",
            }}
          >
            <p style={{ margin: "0", fontStyle: "italic" }}>
              Cảm ơn quý khách đã sử dụng dịch vụ!
            </p>
            <p style={{ margin: "1mm 0 0 0", fontStyle: "italic" }}>
              Vui lòng giữ phiếu này để đối chiếu khi nhận xe
            </p>
          </div>

          {/* Warranty Policy Disclaimer */}
          <div
            style={{
              marginTop: "3mm",
              padding: "2mm",
              fontSize: "8pt",
              color: "#666",
              borderTop: "1px solid #e5e7eb",
              lineHeight: "1.4",
            }}
          >
            <p style={{ margin: "0 0 1mm 0", fontWeight: "bold" }}>
              Chính sách bảo hành:
            </p>
            <ul
              style={{
                margin: "0",
                paddingLeft: "5mm",
                listStyleType: "disc",
              }}
            >
              <li>
                Bảo hành áp dụng cho phụ tùng chính hãng và lỗi kỹ thuật do thợ
              </li>
              <li>
                Không bảo hành đối với va chạm, ngã xe, ngập nước sau khi nhận
                xe
              </li>
              <li>
                Mang theo phiếu này khi đến bảo hành. Liên hệ hotline nếu có
                thắc mắc
              </li>
            </ul>
          </div>
        </div>
      )}

      {/* Refund Modal */}
      {showRefundModal && refundingOrder && (
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
                  placeholder="Vd: Khách hàng không đồng ý chi phí, sửa nhầm xe..."
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
                    #
                    {formatWorkOrderId(
                      refundingOrder.id,
                      storeSettings?.work_order_prefix
                    )
                      .split("-")
                      .pop()}
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
      )}
    </div>
  );
}

const StatusBadge: React.FC<{ status: WorkOrderStatus }> = ({ status }) => {
  const styles = {
    "Tiếp nhận":
      "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
    "Đang sửa":
      "bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400",
    "Đã sửa xong":
      "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400",
    "Trả máy":
      "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
  };

  return (
    <span
      className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${styles[status]}`}
    >
      {status}
    </span>
  );
};
