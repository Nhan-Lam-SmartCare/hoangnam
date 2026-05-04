import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  Bike,
  LayoutGrid,
  List,
  AlertTriangle,
  Wrench,
  Droplets,
  Cog,
  Wind,
  X,
  Calendar,
  User,
  Phone,
  Clock,
  Star,
  History,
  MapPin,
  Edit2,
  Trash2,
} from "lucide-react";
import {
  useCustomers,
  useCreateCustomer,
  useUpdateCustomer,
  useDeleteCustomer,
  useCreateCustomersBulk,
} from "../../hooks/useSupabase";
import { formatDate, formatCurrency, formatAnyId } from "../../utils/format";
import { validatePhoneNumber } from "../../utils/validation";
import { PlusIcon, TrashIcon, XMarkIcon, UsersIcon } from "../Icons";
import {
  useSuppliers,
  useCreateSupplier,
  useDeleteSupplier,
} from "../../hooks/useSuppliers";
import type { Customer, WorkOrder, Vehicle } from "../../types";
// Sales repo removed
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { showToast } from "../../utils/toast";
import { getVehiclesNeedingMaintenance } from "../../utils/maintenanceReminder";
import { supabaseHelpers } from "../../lib/supabase";
import CustomerModal from "./CustomerModal";

// --- COMPONENTS ---

// Customer History Modal Component
interface CustomerHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: Customer | null;
  workOrders: WorkOrder[];
}

const CustomerHistoryModal: React.FC<CustomerHistoryModalProps> = ({
  isOpen,
  onClose,
  customer,
  workOrders,
}) => {
  if (!isOpen || !customer) return null;

  const customerWorkOrders = workOrders.filter(
    (wo) => wo.customerPhone === customer.phone
  );

  const actualTotalSpent = customerWorkOrders.reduce(
    (sum, wo) => sum + (wo.total || 0),
    0
  );

  const uniqueVisitDates = new Set(
    customerWorkOrders.map((wo) =>
      new Date(wo.creationDate || wo.id).toDateString()
    )
  );
  const actualVisitCount = uniqueVisitDates.size;

  const actualLoyaltyPoints = Math.floor(actualTotalSpent / 10000);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-[70] p-0 md:p-4 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-800 md:rounded-2xl w-full h-full md:h-auto md:max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border-0 md:border border-slate-200 dark:border-slate-700">
        {/* Header - Desktop */}
        <div className="hidden md:flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <History className="w-5 h-5 text-blue-500" />
              Lịch sử: {customer.name}
            </h2>
            <a
              href={`tel:${customer.phone}`}
              className="text-sm text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              <Phone className="w-3.5 h-3.5" />
              {customer.phone}
            </a>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors text-slate-500"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Header - Mobile */}
        <div className="flex md:hidden flex-col bg-[#1e1e2d] border-b border-slate-700/50">
          <div className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center border border-blue-500/30">
                <User className="w-5 h-5 text-blue-400" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white leading-tight">
                  {customer.name}
                </h2>
                <a
                  href={`tel:${customer.phone}`}
                  className="text-xs text-slate-400 flex items-center gap-1 mt-0.5 active:text-blue-400 transition-colors"
                >
                  <Phone className="w-3 h-3" />
                  {customer.phone}
                </a>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-800 text-slate-400 active:scale-90 transition-transform"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Stats Summary - Desktop */}
        <div className="hidden md:grid grid-cols-4 gap-4 p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
          <div className="bg-emerald-50 dark:bg-emerald-900/20 p-3 rounded-xl border border-emerald-100 dark:border-emerald-800/50 text-center">
            <div className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
              {customerWorkOrders.length}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-emerald-500/70 dark:text-emerald-400/50">
              Phiếu SC
            </div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-3 rounded-xl border border-purple-100 dark:border-purple-800/50 text-center">
            <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {formatCurrency(actualTotalSpent)}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-purple-500/70 dark:text-purple-400/50">
              Tổng chi
            </div>
          </div>
          <div className="bg-orange-50 dark:bg-orange-900/20 p-3 rounded-xl border border-orange-100 dark:border-orange-800/50 text-center">
            <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
              {actualVisitCount}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-orange-500/70 dark:text-orange-400/50">
              Lần đến
            </div>
          </div>
          <div className="bg-amber-50 dark:bg-amber-900/20 p-3 rounded-xl border border-amber-100 dark:border-amber-800/50 text-center">
            <div className="text-lg font-bold text-amber-600 dark:text-amber-400">
              ⭐ {actualLoyaltyPoints.toLocaleString()}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-bold text-amber-500/70 dark:text-amber-400/50">
              Điểm TL
            </div>
          </div>
        </div>

        {/* Stats Summary - Mobile */}
        <div className="flex md:hidden overflow-x-auto p-4 bg-[#1e1e2d] gap-3 no-scrollbar border-b border-slate-700/30">
          <div className="flex-shrink-0 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 min-w-[100px]">
            <div className="text-xs text-slate-400 mb-1">Tổng chi</div>
            <div className="text-sm font-bold text-white">{formatCurrency(actualTotalSpent)}</div>
          </div>
          <div className="flex-shrink-0 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 min-w-[80px]">
            <div className="text-xs text-slate-400 mb-1">Lần đến</div>
            <div className="text-sm font-bold text-white">{actualVisitCount}</div>
          </div>
          <div className="flex-shrink-0 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 min-w-[80px]">
            <div className="text-xs text-slate-400 mb-1">Điểm TL</div>
            <div className="text-sm font-bold text-amber-400">⭐ {actualLoyaltyPoints.toLocaleString()}</div>
          </div>
          <div className="flex-shrink-0 bg-slate-800/50 p-3 rounded-2xl border border-slate-700/50 min-w-[80px]">
            <div className="text-xs text-slate-400 mb-1">Phiếu SC</div>
            <div className="text-sm font-bold text-emerald-400">{customerWorkOrders.length}</div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 bg-slate-50/30 dark:bg-slate-900/10 custom-scrollbar">
          <div className="space-y-4">
            {customerWorkOrders.map((wo) => {
              const isCompleted = wo.status === "Trả máy" || wo.status === "Đã sửa xong";
              const isInProgress = wo.status === "Đang sửa";
              const statusClass = isCompleted
                ? "bg-accent-green-bg text-accent-green-text border-accent-green-border"
                : isInProgress
                  ? "bg-accent-blue-bg text-accent-blue-text border-accent-blue-border"
                  : "bg-secondary-bg text-secondary-text border-secondary-border";

              return (
                <div key={wo.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 md:p-5 shadow-sm">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center border border-emerald-100 dark:border-emerald-800/50">
                        <Wrench className="w-5 h-5 text-emerald-500" />
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-slate-100">
                          {formatAnyId(wo.id)}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <Bike className="w-3 h-3" />
                          {wo.vehicleModel} • {wo.licensePlate}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-black text-slate-900 dark:text-slate-100">
                        {formatCurrency(wo.total)}
                      </div>
                      <div className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border mt-1 ${statusClass}`}>
                        {wo.status}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <div className="mt-0.5 p-1 rounded bg-slate-100 dark:bg-slate-700">
                      <Clock className="w-3 h-3 text-slate-500" />
                    </div>
                    <div className="flex-1">
                      <span className="text-slate-500 dark:text-slate-400">Vấn đề:</span>
                      <p className="font-medium text-slate-800 dark:text-slate-200 mt-0.5">{wo.issueDescription}</p>
                    </div>
                  </div>
                </div>
              );
            })}
            {customerWorkOrders.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Wrench className="w-8 h-8 text-slate-300" />
                </div>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Chưa có phiếu sửa chữa nào</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Desktop */}
        <div className="hidden md:flex p-4 border-t border-slate-200 dark:border-slate-700 justify-end bg-slate-50/50 dark:bg-slate-800/50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-800 dark:bg-slate-700 hover:bg-slate-900 dark:hover:bg-slate-600 text-white font-bold rounded-xl transition-all active:scale-95 shadow-lg shadow-slate-200 dark:shadow-none"
          >
            Đóng
          </button>
        </div>

        {/* Footer - Mobile (Sticky) */}
        <div className="flex md:hidden p-4 border-t border-slate-700/30 bg-[#1e1e2d] pb-safe">
          <button
            onClick={onClose}
            className="w-full py-4 bg-slate-800 text-white font-bold rounded-2xl active:scale-[0.98] transition-all border border-slate-700/50"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};


// Auto-classify customer segment based on business rules
const classifyCustomer = (customer: Customer): Customer["segment"] => {
  const points = customer.loyaltyPoints || 0;
  const spent = customer.totalSpent || 0;
  const visits = customer.visitCount || 0;
  const lastVisit = customer.lastVisit
    ? new Date(customer.lastVisit)
    : new Date();
  const daysSinceLastVisit = Math.floor(
    (Date.now() - lastVisit.getTime()) / (1000 * 60 * 60 * 24)
  );

  // VIP: >= 5000 points OR >= 20M spent OR >= 20 visits
  if (points >= 5000 || spent >= 20000000 || visits >= 20) {
    return "VIP";
  }

  // Loyal: >= 2000 points OR >= 10M spent OR >= 10 visits
  if (points >= 2000 || spent >= 10000000 || visits >= 10) {
    return "Loyal";
  }

  // Lost: No visit in 180+ days (6 months)
  if (daysSinceLastVisit > 180 && visits > 0) {
    return "Lost";
  }

  // At Risk: No visit in 90+ days (3 months) but not lost yet
  if (daysSinceLastVisit > 90 && visits > 0) {
    return "At Risk";
  }

  // Potential: Has visited 2-9 times
  if (visits >= 2 && visits < 10) {
    return "Potential";
  }

  // New: First time or very few visits
  return "New";
};

// --- MAIN COMPONENT ---

const CustomerManager: React.FC = () => {
  // Lấy danh sách khách hàng từ Supabase
  const { data: customers = [], refetch } = useCustomers();
  const createCustomer = useCreateCustomer();
  const updateCustomer = useUpdateCustomer();
  const deleteCustomer = useDeleteCustomer();

  // Lấy danh sách nhà cung cấp từ Supabase
  const { data: suppliers = [], isLoading: suppliersLoading } = useSuppliers();
  const deleteSupplierMutation = useDeleteSupplier();

  // State cho Load More
  const [displayCount, setDisplayCount] = useState(20);

  // Hàm lưu khách hàng (tạo mới hoặc cập nhật)
  const handleSaveCustomer = async (c: Partial<Customer> & { id?: string }) => {
    const normalizePhone = (value?: string) =>
      String(value || "")
        .replace(/\D/g, "")
        .trim();

    const incomingPhone = normalizePhone(c.phone);
    if (incomingPhone) {
      const duplicated = customers.find((item) => {
        if (c.id && item.id === c.id) return false;
        return normalizePhone(item.phone) === incomingPhone;
      });

      if (duplicated) {
        showToast.error("Số điện thoại đã tồn tại, vui lòng nhập số khác");
        return;
      }
    }

    if (c.id) {
      // Cập nhật
      await updateCustomer.mutateAsync({ id: c.id, updates: c });
    } else {
      // Tạo mới, sinh id nếu chưa có
      const newCustomer = {
        ...c,
        id: `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      };
      await createCustomer.mutateAsync(newCustomer);
    }
    refetch();
    setEditCustomer(null);
  };
  const [search, setSearch] = useState("");
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);

  // STATE MỚI: Cho việc thêm Nhà cung cấp
  const [showSupplierModal, setShowSupplierModal] = useState(false);

  const [showImport, setShowImport] = useState(false);
  const [activeTab, setActiveTab] = useState<"customers" | "suppliers">(
    "customers"
  );
  const [activeFilter, setActiveFilter] = useState("all");
  const [viewHistoryCustomer, setViewHistoryCustomer] =
    useState<Customer | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [showActionSheet, setShowActionSheet] = useState(false);
  const didAutoClassifyRef = useRef(false);

  // Sales repo removed
  const { data: allWorkOrders = [] } = useWorkOrdersRepo();

  // Reset display count khi search hoặc filter thay đổi
  useEffect(() => {
    setDisplayCount(20);
  }, [search, activeFilter]);

  // Auto-open edit form if editCustomerId is in localStorage (from SalesManager)
  useEffect(() => {
    const editCustomerId = localStorage.getItem("editCustomerId");

    if (editCustomerId && customers.length > 0) {
      const customerToEdit = customers.find((c) => c.id === editCustomerId);

      if (customerToEdit) {
        setEditCustomer(customerToEdit);
        localStorage.removeItem("editCustomerId"); // Clear after using
      }
    }
  }, [customers]);

  // Check immediately when component mounts or becomes visible
  useEffect(() => {
    const checkAndOpenEdit = () => {
      const editCustomerId = localStorage.getItem("editCustomerId");

      if (editCustomerId && customers.length > 0) {
        const customerToEdit = customers.find((c) => c.id === editCustomerId);

        if (customerToEdit) {
          setTimeout(() => {
            setEditCustomer(customerToEdit);
            localStorage.removeItem("editCustomerId");
          }, 100);
        }
      }
    };

    // Check immediately
    checkAndOpenEdit();

    // Also check after a delay to handle race conditions
    const timer1 = setTimeout(checkAndOpenEdit, 300);
    const timer2 = setTimeout(checkAndOpenEdit, 800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [customers]);

  // Helper function to calculate actual stats for a customer (consistent with CustomerHistoryModal)
  const calculateCustomerStats = (customer: Customer) => {
    const customerWorkOrders = allWorkOrders.filter(
      (wo) => wo.customerPhone === customer.phone && wo.status !== "Đã hủy"
    );

    const totalFromWorkOrders = customerWorkOrders.reduce(
      (sum, wo) => sum + (wo.total || 0),
      0
    );
    const totalSpent = totalFromWorkOrders;

    // Calculate visit count from unique dates
    // Using creationDate or id (timestamp)
    const allVisitDates = [
      ...customerWorkOrders.map((wo) =>
        new Date(wo.creationDate || wo.id).toDateString()
      ),
    ];
    const visitCount = new Set(allVisitDates).size;

    // Calculate last visit date (most recent transaction)
    const allTransactionDates = [
      ...customerWorkOrders.map((wo) => new Date(wo.creationDate || wo.id)),
    ];
    const lastVisit =
      allTransactionDates.length > 0
        ? new Date(
          Math.max(...allTransactionDates.map((d) => d.getTime()))
        ).toISOString()
        : null;

    // Get latest km from most recent work order
    const sortedWorkOrders = [...customerWorkOrders].sort((a, b) => {
      const dateA = new Date(a.creationDate || a.id).getTime();
      const dateB = new Date(b.creationDate || b.id).getTime();
      return dateB - dateA;
    });
    const latestKm = sortedWorkOrders[0]?.currentKm || null;

    // 1 điểm = 10,000đ
    const loyaltyPoints = Math.floor(totalSpent / 10000);

    return { totalSpent, visitCount, loyaltyPoints, lastVisit, latestKm };
  };

  // Auto-classify customers on mount only
  // Auto-classify once to avoid mutation invalidation loops
  useEffect(() => {
    if (didAutoClassifyRef.current || customers.length === 0) return;

    const missingSegmentCustomers = customers.filter((customer) => !customer.segment);
    if (missingSegmentCustomers.length === 0) {
      didAutoClassifyRef.current = true;
      return;
    }

    didAutoClassifyRef.current = true;
    Promise.allSettled(
      missingSegmentCustomers.map((customer) =>
        supabaseHelpers.updateCustomer(customer.id, {
          segment: classifyCustomer(customer),
        })
      )
    ).finally(() => {
      refetch();
    });
  }, [customers, refetch]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let result = customers.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.phone && c.phone.includes(q)) ||
        (c.vehicles &&
          c.vehicles.some((v: any) =>
            v.licensePlate?.toLowerCase().includes(q)
          ))
    );

    // Apply segment filter
    if (activeFilter !== "all") {
      const segmentMap: Record<string, string> = {
        vip: "VIP",
        loyal: "Loyal",
        potential: "Potential",
        "at-risk": "At Risk",
        lost: "Lost",
        new: "New",
      };
      const targetSegment = segmentMap[activeFilter];
      result = result.filter((c) => c.segment === targetSegment);
    }

    return result;
  }, [customers, search, activeFilter]);

  const displayedCustomers = useMemo(
    () => filtered.slice(0, displayCount),
    [filtered, displayCount]
  );

  // Cache customer stats calculation for performance
  const customerStatsMap = useMemo(() => {
    const map = new Map();
    displayedCustomers.forEach((customer) => {
      map.set(customer.id, calculateCustomerStats(customer));
    });
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedCustomers, allWorkOrders]);

  const handleDelete = async (id: string) => {
    if (
      !confirm("Xác nhận xoá khách hàng này? Hành động này không thể hoàn tác.")
    )
      return;
    try {
      // Xóa khách hàng thực sự từ Supabase
      await deleteCustomer.mutateAsync(id);
      showToast.success("Đã xóa khách hàng thành công");
    } catch (error: any) {
      if (error?.code === "23503") {
        await updateCustomer.mutateAsync({
          id,
          updates: { status: "inactive" },
        });
        showToast.warning(
          "Khách hàng đã có dữ liệu liên quan, đã chuyển sang ngừng hoạt động"
        );
        return;
      }
      console.error("Error deleting customer:", error);
      showToast.error(
        "Không thể xóa khách hàng: " + (error.message || "Lỗi không xác định")
      );
    }
  };

  // Statistics calculations
  const stats = useMemo(() => {
    const total = customers.length;
    const active = customers.filter((c) => c.status === "active").length;
    return {
      total,
      active,
      newThisMonth: customers.filter((c) => {
        if (!c.created_at) return false;
        const date = new Date(c.created_at);
        const now = new Date();
        return (
          date.getMonth() === now.getMonth() &&
          date.getFullYear() === now.getFullYear()
        );
      }).length,
      revenue: 0, // Placeholder
      vip: customers.filter((c) => c.segment === "VIP").length,
      loyal: customers.filter((c) => c.segment === "Loyal").length,
      potential: customers.filter((c) => c.segment === "Potential").length,
      atRisk: customers.filter((c) => c.segment === "At Risk").length,
      lost: customers.filter((c) => c.segment === "Lost").length,
      new: customers.filter((c) => c.segment === "New").length,
    };
  }, [customers]);

  // Vehicles needing maintenance for customer care team
  const vehiclesNeedingMaintenance = useMemo(() => {
    return getVehiclesNeedingMaintenance(customers);
  }, [customers]);

  const filterOptions = useMemo(
    () => [
      {
        id: "all",
        label: "Tất cả",
        hint: "Toàn bộ danh sách",
        count: stats.total,
        icon: "🌐",
        activeClasses:
          "border-secondary-border bg-secondary-bg text-primary-text shadow-sm",
      },
      {
        id: "vip",
        label: "VIP",
        hint: "≥ 5.000 điểm",
        count: stats.vip,
        icon: "👑",
        activeClasses:
          "border-accent-purple-border bg-accent-purple-bg text-accent-purple-text shadow-sm",
      },
      {
        id: "loyal",
        label: "Trung thành",
        hint: "10+ lượt",
        count: stats.loyal,
        icon: "💎",
        activeClasses:
          "border-accent-blue-border bg-accent-blue-bg text-accent-blue-text shadow-sm",
      },
      {
        id: "potential",
        label: "Tiềm năng",
        hint: "2-9 lượt",
        count: stats.potential,
        icon: "⭐",
        activeClasses:
          "border-accent-green-border bg-accent-green-bg text-accent-green-text shadow-sm",
      },
      {
        id: "at-risk",
        label: "Cần chăm sóc",
        hint: ">90 ngày chưa đến",
        count: stats.atRisk,
        icon: "⚠️",
        activeClasses:
          "border-accent-orange-border bg-accent-orange-bg text-accent-orange-text shadow-sm",
      },
      {
        id: "lost",
        label: "Đã mất",
        hint: "Không quay lại",
        count: stats.lost,
        icon: "❌",
        activeClasses:
          "border-accent-red-border bg-accent-red-bg text-accent-red-text shadow-sm",
      },
      {
        id: "new",
        label: "Khách mới",
        hint: "Tháng này",
        count: stats.new,
        icon: "🆕",
        activeClasses:
          "border-accent-blue-border bg-accent-blue-bg text-accent-blue-text shadow-sm",
      },
    ],
    [stats]
  );

  const overviewCards = useMemo(
    () => [
      {
        id: "total",
        title: "Tổng KH",
        value: stats.total.toLocaleString(),
        subLabel: `${stats.active} hoạt động`,
        gradient:
          "from-accent-blue-bg to-secondary-bg",
        border: "border-accent-blue-border",
        labelClass: "text-accent-blue-text",
        valueClass: "text-primary-text",
      },
      {
        id: "new",
        title: "Khách mới",
        value: stats.newThisMonth.toLocaleString(),
        subLabel: "↑ 0% tháng này",
        gradient:
          "from-accent-green-bg to-secondary-bg",
        border: "border-accent-green-border",
        labelClass: "text-accent-green-text",
        valueClass: "text-primary-text",
      },
      {
        id: "avg",
        title: "DT TB",
        value: "0 đ",
        subLabel: "/ khách hàng",
        gradient:
          "from-accent-purple-bg to-secondary-bg",
        border: "border-accent-purple-border",
        labelClass: "text-accent-purple-text",
        valueClass: "text-primary-text",
      },
      {
        id: "atRisk",
        title: "Cần CS",
        value: stats.atRisk.toLocaleString(),
        subLabel: "0đ tiềm năng",
        gradient:
          "from-accent-orange-bg to-secondary-bg",
        border: "border-accent-orange-border",
        labelClass: "text-accent-orange-text",
        valueClass: "text-primary-text",
      },
    ],
    [stats]
  );

  const segmentStyles: Record<
    string,
    {
      label: string;
      badgeClass: string;
      avatarClass: string;
      icon: string;
    }
  > = {
    VIP: {
      label: "VIP",
      badgeClass:
        "bg-accent-purple-bg text-accent-purple-text border border-accent-purple-border",
      avatarClass: "bg-accent-purple-bg text-accent-purple-text",
      icon: "👑",
    },
    Loyal: {
      label: "Trung thành",
      badgeClass:
        "bg-accent-blue-bg text-accent-blue-text border border-accent-blue-border",
      avatarClass: "bg-accent-blue-bg text-accent-blue-text",
      icon: "💎",
    },
    Potential: {
      label: "Tiềm năng",
      badgeClass:
        "bg-accent-green-bg text-accent-green-text border border-accent-green-border",
      avatarClass: "bg-accent-green-bg text-accent-green-text",
      icon: "⭐",
    },
    "At Risk": {
      label: "Cần chăm sóc",
      badgeClass:
        "bg-accent-orange-bg text-accent-orange-text border border-accent-orange-border",
      avatarClass: "bg-accent-orange-bg text-accent-orange-text",
      icon: "⚠️",
    },
    Lost: {
      label: "Đã mất",
      badgeClass:
        "bg-accent-red-bg text-accent-red-text border border-accent-red-border",
      avatarClass: "bg-accent-red-bg text-accent-red-text",
      icon: "❌",
    },
    New: {
      label: "Khách mới",
      badgeClass:
        "bg-accent-blue-bg text-accent-blue-text border border-accent-blue-border",
      avatarClass: "bg-accent-blue-bg text-accent-blue-text",
      icon: "🆕",
    },
    default: {
      label: "Khách hàng",
      badgeClass:
        "bg-secondary-bg text-secondary-text border border-secondary-border",
      avatarClass: "bg-secondary-bg text-secondary-text",
      icon: "👤",
    },
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden">
      {/* Tabs Header - Fixed */}
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex-none z-20 shadow-sm">
        <div className="flex items-center px-4 overflow-x-auto no-scrollbar">
          <button
            onClick={() => setActiveTab("customers")}
            className={`flex items-center gap-1.5 px-3 py-2 md:py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === "customers"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <UsersIcon className="w-4 h-4" />
            <span>Khách hàng ({stats.total})</span>
          </button>
          <button
            onClick={() => setActiveTab("suppliers")}
            className={`flex items-center gap-1.5 px-3 py-2 md:py-3 border-b-2 font-medium text-sm transition-colors whitespace-nowrap ${activeTab === "suppliers"
              ? "border-blue-500 text-blue-600 dark:text-blue-400"
              : "border-transparent text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
              }`}
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <span>Nhà cung cấp ({suppliers?.length || 0})</span>
          </button>
        </div>
      </div>

      {/* Main Scrollable Area */}
      {activeTab === "customers" ? (
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
          {/* Sticky Action Bar */}
          <div className="sticky top-0 z-10 pb-3 -mt-2 pt-2 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-sm transition-all">
            <div className="flex flex-col md:flex-row gap-2 mb-3">
              <div className="flex-1 relative w-full">
                <svg
                  className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  placeholder="Tìm theo tên, SĐT, Serial/IMEI..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-14 md:pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-sm text-sm"
                />
                <button
                  onClick={() => setShowActionSheet(true)}
                  className="md:hidden absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm transition-colors hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300"
                >
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.75a.75.75 0 100-1.5.75.75 0 000 1.5zm0 6a.75.75 0 100-1.5.75.75 0 000 1.5zm0 6a.75.75 0 100-1.5.75.75 0 000 1.5z"
                    />
                  </svg>
                  <span>Tác vụ</span>
                </button>
              </div>
              <div className="hidden md:flex gap-2 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
                <button
                  onClick={() => setShowImport(true)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm text-sm"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                    />
                  </svg>
                  <span>Tải lên DS</span>
                </button>
                <button
                  className="flex items-center gap-1.5 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm text-sm"
                  onClick={() => alert("Tính năng đang phát triển")}
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <span>Nhắc BD</span>
                </button>
                <button
                  onClick={() => setEditCustomer({} as Customer)}
                  className="flex items-center gap-1.5 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors whitespace-nowrap shadow-sm text-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  <span>Thêm KH</span>
                </button>
              </div>
            </div>

            {/* Filters */}
            <div className="rounded-xl border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800/60 md:border-none md:bg-transparent md:p-0 md:shadow-none">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                    Phân khúc khách hàng
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Chạm để lọc nhanh
                  </p>
                </div>
                <div className="hidden sm:inline-flex rounded-xl border border-slate-200 bg-white p-0.5 text-xs font-semibold dark:border-slate-600 dark:bg-slate-900/40">
                  <button
                    onClick={() => setViewMode("grid")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-colors sm:flex-none ${viewMode === "grid"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                  >
                    <LayoutGrid className="h-3.5 w-3.5" />
                    <span>Thẻ</span>
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2 py-1.5 transition-colors sm:flex-none ${viewMode === "list"
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                      }`}
                  >
                    <List className="h-3.5 w-3.5" />
                    <span>Danh sách</span>
                  </button>
                </div>
              </div>
              <div className="mt-2 flex gap-2 overflow-x-auto pb-1 no-scrollbar snap-x snap-mandatory md:mt-3 md:snap-none">
                {filterOptions.map((filter) => (
                  <button
                    key={filter.id}
                    onClick={() => setActiveFilter(filter.id)}
                    className={`min-w-[160px] snap-start rounded-xl border px-3 py-2 text-left transition-all md:min-w-0 ${activeFilter === filter.id
                      ? `${filter.activeClasses}`
                      : "bg-primary-bg text-secondary-text border-secondary-border hover:border-primary-border"
                      }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-base">{filter.icon}</span>
                        <div>
                          <p className="text-xs font-semibold">
                            {filter.label}
                          </p>
                          <p className="text-[10px] text-slate-500">
                            {filter.hint}
                          </p>
                        </div>
                      </div>
                      <div className="text-base font-black text-slate-900 dark:text-slate-100">
                        {filter.count}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Statistics Section - Scrolled with content */}
          <div className="mb-6 mt-2">
            <div className="flex items-center gap-2 mb-4">
              <svg
                className="w-5 h-5 text-slate-600 dark:text-slate-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                />
              </svg>
              <h2 className="text-lg font-semibold text-primary-text">
                Thống kê tổng quan
              </h2>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-4 md:gap-4 md:overflow-visible md:snap-none">
              {overviewCards.map((card) => (
                <div
                  key={card.id}
                  className={`snap-start min-w-[170px] rounded-lg border bg-gradient-to-br p-3 md:p-4 ${card.gradient} ${card.border}`}
                >
                  <div
                    className={`text-[10px] md:text-sm font-semibold mb-1 uppercase ${card.labelClass}`}
                  >
                    {card.title}
                  </div>
                  <div
                    className={`text-2xl md:text-3xl font-black ${card.valueClass}`}
                  >
                    {card.value}
                  </div>
                  <div className="text-[10px] md:text-xs mt-0.5 text-secondary-text">
                    {card.subLabel}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Maintenance Reminder Section for Customer Care Team */}
          {vehiclesNeedingMaintenance.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="w-5 h-5 text-orange-500" />
                <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  Xe cần bảo dưỡng ({vehiclesNeedingMaintenance.length})
                </h2>
              </div>
              <div className="bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 rounded-xl border border-orange-200 dark:border-orange-800 p-4">
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory md:grid md:grid-cols-2 lg:grid-cols-3 md:overflow-visible md:snap-none">
                  {vehiclesNeedingMaintenance.slice(0, 9).map((item, index) => {
                    if (!item.customer) return null;
                    return (
                      <div
                        key={`${item.customer.id}-${item.vehicle.licensePlate}-${index}`}
                        className="snap-start min-w-[280px] md:min-w-0 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-4 shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                              {item.customer.name || "Khách hàng"}
                            </p>
                            <a
                              href={`tel:${item.customer.phone}`}
                              className="text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                            >
                              {item.customer.phone}
                            </a>
                          </div>
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded-lg">
                              <Bike className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
                              <span className="text-xs font-medium text-slate-700 dark:text-slate-200">
                                {item.vehicle.licensePlate}
                              </span>
                            </div>
                            {/* Vehicle Type Badge */}
                            {(() => {
                              const model = (
                                item.vehicle.model || ""
                              ).toLowerCase();
                              const isAutomatic =
                                model.includes("sh") ||
                                model.includes("vision") ||
                                model.includes("air blade") ||
                                model.includes("lead") ||
                                model.includes("vario") ||
                                model.includes("pcx") ||
                                model.includes("freego") ||
                                model.includes("janus") ||
                                model.includes("grande") ||
                                model.includes("medley") ||
                                model.includes("liberty");
                              return (
                                <span
                                  className={`text-[10px] font-medium px-2 py-0.5 rounded ${isAutomatic
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                                    }`}
                                >
                                  {isAutomatic ? "🛵 Tay ga" : "🏍️ Xe số"}
                                </span>
                              );
                            })()}
                          </div>
                        </div>

                        <div className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                          Lần sửa gần nhất:{" "}
                          <span className="font-semibold text-slate-700 dark:text-slate-200">
                            {(item.vehicle.currentKm || 0).toLocaleString()} km
                          </span>
                        </div>

                        <div className="space-y-2">
                          {item.warnings.map((warning, wIdx) => {
                            const IconComponent =
                              warning.type === "oilChange"
                                ? Droplets
                                : warning.type === "gearboxOil"
                                  ? Cog
                                  : Wind;
                            return (
                              <div
                                key={wIdx}
                                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs ${warning.isOverdue
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
                                  }`}
                              >
                                <IconComponent className="w-4 h-4 flex-shrink-0" />
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">
                                    {warning.name}
                                  </span>
                                  <span className="ml-1">
                                    {warning.isOverdue
                                      ? `(quá ${Math.abs(
                                        warning.kmUntilDue
                                      ).toLocaleString()} km)`
                                      : `(còn ${warning.kmUntilDue.toLocaleString()} km)`}
                                  </span>
                                </div>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${warning.isOverdue
                                    ? "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-100"
                                    : "bg-amber-200 text-amber-800 dark:bg-amber-800 dark:text-amber-100"
                                    }`}
                                >
                                  {warning.isOverdue ? "QUÁ HẠN" : "SẮP ĐẾN"}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {vehiclesNeedingMaintenance.length > 9 && (
                  <p className="text-center text-sm text-orange-600 dark:text-orange-400 mt-3 font-medium">
                    Và {vehiclesNeedingMaintenance.length - 9} thiết bị khác cần bảo
                    dưỡng...
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Customer Cards Grid */}
          {filtered.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
              <div className="flex justify-center mb-4">
                <svg
                  className="w-16 h-16 text-slate-300 dark:text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                  />
                </svg>
              </div>
              <p className="text-slate-500 dark:text-slate-400 text-lg">
                Không tìm thấy khách hàng nào.
              </p>
            </div>
          ) : (
            <>
              {viewMode === "grid" ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {displayedCustomers.map((customer) => {
                    const config =
                      (customer.segment && segmentStyles[customer.segment]) ||
                      segmentStyles.default;
                    // Use cached stats for performance (consistent with CustomerHistoryModal)
                    const {
                      totalSpent,
                      visitCount,
                      loyaltyPoints: points,
                      lastVisit,
                      latestKm,
                    } = customerStatsMap.get(customer.id) || {
                      totalSpent: 0,
                      visitCount: 0,
                      loyaltyPoints: 0,
                      lastVisit: null,
                      latestKm: null,
                    };
                    const pointsPercent = Math.min((points / 10000) * 100, 100);
                    const vehicles =
                      (customer.vehicles as Vehicle[] | undefined) || [];
                    const hasExtraVehicles = vehicles.length > 2;

                    return (
                      <div
                        key={customer.id}
                        className="group relative bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:border-blue-500/30 transition-all duration-300 overflow-hidden flex flex-col"
                      >
                        {/* Card Header */}
                        <div className="p-5 flex items-start justify-between gap-3">
                          <div className="flex items-center gap-4 min-w-0">
                            <div
                              className={`flex h-14 w-14 items-center justify-center rounded-2xl text-2xl shadow-inner ${config.avatarClass}`}
                            >
                              {config.icon}
                            </div>
                            <div className="min-w-0">
                              <h3 className="text-lg font-black text-slate-900 dark:text-slate-100 truncate group-hover:text-blue-600 transition-colors">
                                {customer.name || "Chưa đặt tên"}
                              </h3>
                              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700/50 px-2 py-0.5 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-600 dark:hover:text-blue-400 transition-all"
                                >
                                  <Phone className="w-3 h-3" />
                                  <span className="font-bold">{customer.phone || "N/A"}</span>
                                </a>
                                {lastVisit && (
                                  <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(lastVisit)}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                          <span
                            className={`text-[10px] font-black uppercase px-3 py-1 rounded-full border ${config.badgeClass}`}
                          >
                            {config.label}
                          </span>
                        </div>

                        {/* Vehicles Section */}
                        <div className="px-5 pb-4">
                          <div className="flex flex-wrap gap-2">
                            {vehicles.length > 0 ? (
                              <>
                                {vehicles.slice(0, 2).map((vehicle) => (
                                  <div
                                    key={vehicle.id}
                                    className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200"
                                  >
                                    <Bike className={`w-3.5 h-3.5 ${vehicle.isPrimary ? "text-amber-500" : "text-blue-500"}`} />
                                    <span>{vehicle.model || "Không rõ"}</span>
                                    {vehicle.licensePlate && (
                                      <span className="text-[10px] text-slate-400 font-medium">
                                        • {vehicle.licensePlate}
                                      </span>
                                    )}
                                  </div>
                                ))}
                                {hasExtraVehicles && (
                                  <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 text-[10px] font-black text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800/50">
                                    +{vehicles.length - 2} THIẾT BỊ KHÁC
                                  </div>
                                )}
                              </>
                            ) : customer.vehicleModel ? (
                              <div className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50/50 px-3 py-1.5 text-xs font-bold text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                                <Bike className="h-3.5 w-3.5 text-blue-500" />
                                <span>
                                  {customer.vehicleModel}
                                  {customer.licensePlate
                                    ? ` • ${customer.licensePlate}`
                                    : ""}
                                </span>
                              </div>
                            ) : (
                              <div className="text-[10px] font-bold text-slate-400 italic">Chưa cập nhật thông tin thiết bị</div>
                            )}
                          </div>
                        </div>

                        {/* Stats Grid */}
                        <div className="px-5 pb-5 grid grid-cols-2 gap-3">
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Tổng chi tiêu</div>
                            <div className="text-base font-black text-slate-900 dark:text-slate-100">{formatCurrency(totalSpent)}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Số lần đến</div>
                            <div className="text-base font-black text-slate-900 dark:text-slate-100">{visitCount} lần</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Lần sửa gần nhất</div>
                            <div className="text-base font-black text-blue-600 dark:text-blue-400">
                              {latestKm ? `${latestKm.toLocaleString()} km` : "—"}
                            </div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3 border border-slate-100 dark:border-slate-700/50">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Điểm tích lũy</div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-base font-black text-amber-500">⭐ {points.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>

                        {/* Loyalty Progress */}
                        <div className="px-5 pb-5">
                          <div className="h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-amber-500 via-yellow-400 to-orange-500 shadow-[0_0_8px_rgba(245,158,11,0.5)]"
                              style={{ width: `${pointsPercent}%` }}
                            ></div>
                          </div>
                        </div>

                        {/* Actions */}
                        <div className="mt-auto bg-slate-50/50 dark:bg-slate-900/20 p-4 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700/50">
                          <button
                            onClick={() => setViewHistoryCustomer(customer)}
                            className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 text-xs font-black text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white dark:hover:bg-blue-600 dark:hover:text-white transition-all active:scale-95"
                          >
                            <History className="w-3.5 h-3.5" />
                            LỊCH SỬ
                          </button>
                          <button
                            onClick={() => setEditCustomer(customer)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-all active:scale-95"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(customer.id)}
                            className="w-10 h-10 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-95"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="overflow-x-auto rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 custom-scrollbar">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50/50 text-left text-[11px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-900/40 border-b border-slate-100 dark:border-slate-700/50">
                      <tr>
                        <th className="px-6 py-4">Khách hàng</th>
                        <th className="px-6 py-4">Liên hệ</th>
                        <th className="px-6 py-4">Thiết bị</th>
                        <th className="px-6 py-4">Tổng chi tiêu</th>
                        <th className="px-6 py-4">Lần đến</th>
                        <th className="px-6 py-4">Lần cuối</th>
                        <th className="px-6 py-4 text-right">Thao tác</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {displayedCustomers.map((customer) => {
                        const config =
                          (customer.segment &&
                            segmentStyles[customer.segment]) ||
                          segmentStyles.default;
                        const vehicles =
                          (customer.vehicles as Vehicle[] | undefined) || [];
                        const primaryVehicle =
                          vehicles.find((v) => v.isPrimary) || vehicles[0];
                        const vehicleLabel = primaryVehicle
                          ? `${primaryVehicle.model || "Không rõ"}${primaryVehicle.licensePlate
                            ? ` • ${primaryVehicle.licensePlate}`
                            : ""
                          }`
                          : customer.vehicleModel
                            ? `${customer.vehicleModel}${customer.licensePlate
                              ? ` • ${customer.licensePlate}`
                              : ""
                            }`
                            : "—";

                        const stats = customerStatsMap.get(customer.id);

                        return (
                          <tr
                            key={customer.id}
                            className="group hover:bg-blue-50/30 dark:hover:bg-blue-900/10 transition-colors"
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg shadow-sm ${config.avatarClass}`}>
                                  {config.icon}
                                </div>
                                <div>
                                  <div className="font-bold text-slate-900 dark:text-slate-100 group-hover:text-blue-600 transition-colors">
                                    {customer.name || "Chưa đặt tên"}
                                  </div>
                                  <span
                                    className={`mt-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-black uppercase border ${config.badgeClass}`}
                                  >
                                    {config.label}
                                  </span>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex flex-col gap-1">
                                <a
                                  href={`tel:${customer.phone}`}
                                  className="flex items-center gap-1.5 font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                                >
                                  <Phone className="w-3 h-3 text-slate-400" />
                                  {customer.phone || "—"}
                                </a>
                                <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                  {(stats?.loyaltyPoints || 0).toLocaleString()} điểm
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-2 text-slate-700 dark:text-slate-300 font-medium">
                                <Bike className="w-4 h-4 text-blue-500" />
                                {vehicleLabel}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="font-black text-slate-900 dark:text-slate-100">
                                {formatCurrency(stats?.totalSpent || 0)}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="inline-flex items-center justify-center px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-xs font-bold text-slate-700 dark:text-slate-300">
                                {stats?.visitCount || 0} lần
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                                <Calendar className="w-3.5 h-3.5" />
                                {stats?.lastVisit ? formatDate(stats.lastVisit) : "—"}
                              </div>
                            </td>
                            <td className="px-6 py-4 text-right">
                              <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                  onClick={() => setViewHistoryCustomer(customer)}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-600 hover:text-white transition-all active:scale-90"
                                  title="Xem lịch sử"
                                >
                                  <History className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditCustomer(customer)}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-all active:scale-90"
                                  title="Chỉnh sửa"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(customer.id)}
                                  className="w-9 h-9 flex items-center justify-center rounded-xl bg-red-50 dark:bg-red-900/20 text-red-500 hover:bg-red-500 hover:text-white transition-all active:scale-90"
                                  title="Xóa"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {displayCount < filtered.length && (
                <div className="flex justify-center pb-4 pt-8">
                  <button
                    onClick={() => setDisplayCount((prev) => prev + 20)}
                    className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-blue-500 hover:text-blue-600 hover:shadow-md dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span>
                      Hiển thị thêm{" "}
                      {Math.min(20, filtered.length - displayCount)} khách hàng
                    </span>
                    <svg
                      className="h-4 w-4 transition-transform group-hover:translate-y-1"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              )}
            </>
          )}

          {/* Floating Add Button for mobile */}
          <button
            onClick={() => setEditCustomer({} as Customer)}
            className="md:hidden fixed bottom-28 right-5 z-40 inline-flex items-center justify-center rounded-full bg-blue-600 p-4 text-white shadow-lg transition hover:bg-blue-700"
          >
            <PlusIcon className="h-6 w-6" />
            <span className="sr-only">Thêm khách hàng</span>
          </button>

          {/* Mobile action sheet */}
          {showActionSheet && (
            <div className="md:hidden fixed inset-0 z-30">
              <button
                onClick={() => setShowActionSheet(false)}
                className="absolute inset-0 bg-black/40"
                aria-label="Đóng"
              ></button>
              <div className="absolute inset-x-0 bottom-0 rounded-t-3xl bg-white p-5 shadow-2xl dark:bg-slate-800">
                <div className="mx-auto mb-4 h-1.5 w-12 rounded-full bg-slate-200 dark:bg-slate-600" />
                <h3 className="mb-4 text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Tác vụ nhanh
                </h3>
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setShowImport(true);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-200"
                  >
                    <svg
                      className="h-5 w-5 text-green-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                      />
                    </svg>
                    Upload danh sách
                  </button>
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      alert("Tính năng đang phát triển");
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-sm font-semibold text-slate-700 transition hover:border-blue-500 dark:border-slate-700 dark:bg-slate-700/40 dark:text-slate-200"
                  >
                    <svg
                      className="h-5 w-5 text-orange-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                      />
                    </svg>
                    Nhắc bảo dưỡng
                  </button>
                  <button
                    onClick={() => {
                      setShowActionSheet(false);
                      setEditCustomer({} as Customer);
                    }}
                    className="flex w-full items-center gap-3 rounded-2xl bg-blue-600 px-4 py-3 text-left text-sm font-semibold text-white shadow-lg transition hover:bg-blue-700"
                  >
                    <PlusIcon className="h-5 w-5" /> Thêm khách hàng
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 overflow-auto p-6 custom-scrollbar">
          {/* Suppliers Tab Content */}
          <SuppliersList
            suppliers={suppliers}
            isLoading={suppliersLoading}
            onAdd={() => setShowSupplierModal(true)}
            onImport={() => setShowImport(true)}
            onDelete={(id) => deleteSupplierMutation.mutate({ id })}
          />
        </div>
      )}

      {/* Modals */}
      <CustomerHistoryModal
        isOpen={!!viewHistoryCustomer}
        onClose={() => setViewHistoryCustomer(null)}
        customer={viewHistoryCustomer}
        workOrders={allWorkOrders}
      />

      {editCustomer && (
        <CustomerModal
          customer={editCustomer}
          existingCustomers={customers}
          onSave={handleSaveCustomer}
          onClose={() => setEditCustomer(null)}
        />
      )}

      {showSupplierModal && (
        <SupplierModal onClose={() => setShowSupplierModal(false)} />
      )}

      {showImport && (
        <ImportCSVModal onClose={() => setShowImport(false)} type={activeTab} />
      )}
    </div>
  );
};

// --- SUB COMPONENTS (SupplierModal, ImportCSVModal) ---
// CustomerModal is imported from ./CustomerModal.tsx


// --- SUPPLIERS LIST COMPONENT ---
const SuppliersList: React.FC<{
  suppliers: any[];
  isLoading: boolean;
  onAdd: () => void;
  onImport: () => void;
  onDelete: (id: string) => void;
}> = ({ suppliers, isLoading, onAdd, onImport, onDelete }) => {
  const [search, setSearch] = useState("");

  const filteredSuppliers = useMemo(() => {
    if (!search.trim()) return suppliers;
    const q = search.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name?.toLowerCase().includes(q) || s.phone?.toLowerCase().includes(q)
    );
  }, [suppliers, search]);

  return (
    <>
      <div className="flex flex-col md:flex-row items-start md:items-center gap-3 mb-6">
        <div className="flex-1 relative w-full">
          <svg
            className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Tìm theo tên hoặc số điện thoại..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div className="text-slate-600 dark:text-slate-400 text-sm font-medium whitespace-nowrap">
          Tổng: <span className="font-bold">{filteredSuppliers.length}</span>{" "}
          nhà cung cấp
        </div>
        <button
          onClick={onImport}
          className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>
          <span>Tải lên CSV</span>
        </button>
        <button
          onClick={onAdd}
          className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Thêm mới</span>
        </button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      ) : filteredSuppliers.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-12 text-center">
          <div className="flex justify-center mb-4">
            <svg
              className="w-16 h-16 text-slate-300 dark:text-slate-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
          </div>
          <p className="text-slate-500 dark:text-slate-400 text-lg">
            {search ? "Không tìm thấy nhà cung cấp." : "Chưa có nhà cung cấp."}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-700/50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Tên NCC
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Điện thoại
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Địa chỉ
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Ngày tạo
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {filteredSuppliers.map((supplier) => (
                <tr
                  key={supplier.id}
                  className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                        <svg
                          className="w-5 h-5 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                          />
                        </svg>
                      </div>
                      <span className="font-medium text-slate-900 dark:text-slate-100">
                        {supplier.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                    {supplier.phone || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-400 max-w-xs truncate">
                    {supplier.address || "-"}
                  </td>
                  <td className="px-4 py-3 text-slate-500 dark:text-slate-400 text-sm">
                    {supplier.created_at
                      ? new Date(supplier.created_at).toLocaleDateString(
                        "vi-VN"
                      )
                      : "-"}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => {
                        if (
                          confirm(
                            `Xác nhận xóa nhà cung cấp "${supplier.name}"?`
                          )
                        ) {
                          onDelete(supplier.id);
                        }
                      }}
                      className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Xóa"
                    >
                      <TrashIcon className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
};

// --- SUPPLIER MODAL (NEW) ---
const SupplierModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const createSupplier = useCreateSupplier();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast.error("Vui lòng nhập tên nhà cung cấp");
      return;
    }

    setSaving(true);
    try {
      await createSupplier.mutateAsync({
        name: name.trim(),
        phone: phone.trim(),
        address: address.trim(),
      });
      onClose();
    } catch {
      // Hook đã show toast error
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Thêm nhà cung cấp
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Tên nhà cung cấp <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="Nhập tên NCC"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Số điện thoại
            </label>
            <input
              type="text"
              placeholder="VD: 09xxxx"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Địa chỉ
            </label>
            <input
              type="text"
              placeholder="Địa chỉ liên hệ"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-4 py-3 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
            />
          </div>

          <div className="flex gap-3 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white border border-slate-300 dark:border-slate-600 rounded-lg font-medium transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg font-medium transition-colors"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// --- UPDATED IMPORT MODAL ---

const ImportCSVModal: React.FC<{
  onClose: () => void;
  type: "customers" | "suppliers";
}> = ({ onClose, type }) => {
  const createCustomersBulk = useCreateCustomersBulk();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<
    Array<{ name: string; phone?: string }>
  >([]);
  const [error, setError] = useState("");
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError("");
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      if (!text) return;
      const lines = text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (lines.length === 0) {
        setError("File CSV trống.");
        return;
      }
      const firstLine = lines[0].toLowerCase();
      const hasHeader =
        firstLine.includes("name") ||
        firstLine.includes("phone") ||
        firstLine.includes("tên") ||
        firstLine.includes("sđt");
      const dataLines = hasHeader ? lines.slice(1) : lines;

      const parsed: Array<{ name: string; phone?: string }> = [];
      for (const line of dataLines) {
        const cols = line.split(",").map((c) => c.trim());
        if (cols.length === 0 || !cols[0]) continue;
        parsed.push({ name: cols[0], phone: cols[1] || undefined });
      }
      if (parsed.length === 0) {
        setError("Không tìm thấy dữ liệu hợp lệ trong CSV.");
        return;
      }
      setPreview(parsed);
    };
    reader.readAsText(file);
  };

  const handleImport = async () => {
    if (preview.length === 0) return;

    setImporting(true);
    try {
      if (type === "customers") {
        // Import Khách hàng
        const newCustomers = preview.map((p) => ({
          id:
            typeof crypto !== "undefined" && crypto.randomUUID
              ? crypto.randomUUID()
              : `CUS-${Date.now()}-${Math.random().toString(16).slice(2)}`,
          name: p.name,
          phone: p.phone || "",
          created_at: new Date().toISOString(),
        }));
        await createCustomersBulk.mutateAsync(newCustomers);
        alert(`Đã import thành công ${newCustomers.length} khách hàng!`);
      } else {
        // Import Nhà cung cấp
        // LƯU Ý: Hiện tại chưa có hook useCreateSuppliersBulk, nên mình để tạm alert
        // Bạn cần tạo hook này tương tự như useCreateCustomersBulk trong useSupabase.ts
        alert(
          "Chức năng import Nhà cung cấp đang được phát triển. Vui lòng thêm hook useCreateSuppliersBulk để kích hoạt."
        );
        // Ví dụ logic khi có hook:
        // await createSuppliersBulk.mutateAsync(newSuppliers);
      }

      onClose();
    } catch (err) {
      console.error("Import error:", err);
      setError("Có lỗi xảy ra khi import. Vui lòng thử lại.");
    } finally {
      setImporting(false);
    }
  };

  const isCustomer = type === "customers";

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Import {isCustomer ? "khách hàng" : "nhà cung cấp"} từ CSV
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700"
          >
            <XMarkIcon className="w-6 h-6" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <p className="text-slate-600 dark:text-slate-300">
            Chọn file CSV với cột đầu tiên là{" "}
            <strong>tên {isCustomer ? "khách hàng" : "nhà cung cấp"}</strong>,
            cột thứ hai là <strong>số điện thoại</strong> (tùy chọn).
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          {error && <div className="text-red-600 text-xs">{error}</div>}
          {preview.length > 0 && (
            <div className="border rounded p-3 bg-slate-50 dark:bg-slate-900 max-h-64 overflow-y-auto custom-scrollbar">
              <div className="font-semibold mb-2 text-slate-900 dark:text-slate-100">
                Xem trước ({preview.length} mục):
              </div>
              <table className="w-full text-xs text-slate-700 dark:text-slate-300">
                <thead>
                  <tr className="text-left border-b dark:border-slate-700">
                    <th className="p-1">Tên</th>
                    <th className="p-1">SĐT</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 20).map((p, i) => (
                    <tr key={i} className="border-b dark:border-slate-700">
                      <td className="p-1">{p.name}</td>
                      <td className="p-1">{p.phone || "--"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border rounded hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-700 dark:text-slate-300"
            >
              Huỷ
            </button>
            <button
              disabled={preview.length === 0 || importing}
              onClick={handleImport}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {importing
                ? "Đang import..."
                : `Import ${preview.length > 0 ? `(${preview.length})` : ""}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerManager;
