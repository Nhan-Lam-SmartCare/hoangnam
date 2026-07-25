import React, { useMemo, useState } from "react";
import {
  Search,
  Plus,
  HandCoins,
  MoreVertical,
  Calendar,
  Phone,
  Car,
  User,
  AlertTriangle,
  Clock,
  Trash2,
  Edit,
  History,
  CheckCircle2,
  Building2,
  CreditCard,
  UserCheck,
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { useAppContext } from "../../contexts/AppContext";
import {
  useCustomerDebtsRepo,
  useSupplierDebtsRepo,
  useDeleteCustomerDebtRepo,
  useDeleteSupplierDebtRepo,
} from "../../hooks/useDebtsRepository";
import type { CustomerDebt, SupplierDebt } from "../../types";

import CollectDebtModal from "./modals/CollectDebtModal";
import AddDebtModal from "./modals/AddDebtModal";
import DebtHistoryModal from "./modals/DebtHistoryModal";

export const DebtManager: React.FC = () => {
  const { currentBranchId } = useAppContext();

  // Data queries
  const { data: customerDebts = [], isLoading: isLoadingCustomer } =
    useCustomerDebtsRepo();
  const { data: supplierDebts = [], isLoading: isLoadingSupplier } =
    useSupplierDebtsRepo();

  const { mutateAsync: deleteCustomerDebt } = useDeleteCustomerDebtRepo();
  const { mutateAsync: deleteSupplierDebt } = useDeleteSupplierDebtRepo();

  // Active Tab: customer | supplier | installment
  const [activeTab, setActiveTab] = useState<"customer" | "supplier" | "installment">(
    "customer"
  );

  // Status Filter: all | overdue | upcoming | paid
  const [statusFilter, setStatusFilter] = useState<
    "all" | "overdue" | "upcoming" | "paid"
  >("all");

  const [search, setSearch] = useState<string>("");

  // Modals state
  const [collectingDebtItem, setCollectingDebtItem] = useState<{
    debt: CustomerDebt | SupplierDebt;
    type: "customer" | "supplier";
  } | null>(null);

  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [historyDebtItem, setHistoryDebtItem] = useState<{
    debt: CustomerDebt | SupplierDebt;
    type: "customer" | "supplier";
  } | null>(null);

  const [openActionId, setOpenActionId] = useState<string | null>(null);

  // Filter by branch
  const branchCustomerDebts = useMemo(
    () =>
      customerDebts.filter(
        (d) => !d.branchId || d.branchId === currentBranchId
      ),
    [customerDebts, currentBranchId]
  );

  const branchSupplierDebts = useMemo(
    () =>
      supplierDebts.filter(
        (d) => !d.branchId || d.branchId === currentBranchId
      ),
    [supplierDebts, currentBranchId]
  );

  // High-level statistics
  const totalCustomerRemaining = useMemo(
    () =>
      branchCustomerDebts.reduce(
        (sum, d) => sum + (d.remainingAmount > 0 ? d.remainingAmount : 0),
        0
      ),
    [branchCustomerDebts]
  );

  const totalSupplierRemaining = useMemo(
    () =>
      branchSupplierDebts.reduce(
        (sum, d) => sum + (d.remainingAmount > 0 ? d.remainingAmount : 0),
        0
      ),
    [branchSupplierDebts]
  );

  const customerUnpaidCount = useMemo(
    () => branchCustomerDebts.filter((d) => d.remainingAmount > 0).length,
    [branchCustomerDebts]
  );

  const supplierUnpaidCount = useMemo(
    () => branchSupplierDebts.filter((d) => d.remainingAmount > 0).length,
    [branchSupplierDebts]
  );

  const totalAllRemaining = totalCustomerRemaining + totalSupplierRemaining;

  // Filtered List based on active tab & search
  const currentTabItems = useMemo(() => {
    let list: Array<{ debt: CustomerDebt | SupplierDebt; type: "customer" | "supplier" }> = [];

    if (activeTab === "customer") {
      list = branchCustomerDebts.map((d) => ({ debt: d, type: "customer" as const }));
    } else if (activeTab === "supplier") {
      list = branchSupplierDebts.map((d) => ({ debt: d, type: "supplier" as const }));
    } else {
      // Installment tab (filter customer debts with installment marker if any)
      list = branchCustomerDebts
        .filter((d) => d.description?.toLowerCase().includes("trả góp"))
        .map((d) => ({ debt: d, type: "customer" as const }));
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    return list.filter(({ debt }) => {
      // 1. Search term match
      if (search.trim()) {
        const keyword = search.trim().toLowerCase();
        const targetName =
          "customerName" in debt
            ? (debt as CustomerDebt).customerName
            : (debt as SupplierDebt).supplierName;
        const phone = debt.phone || "";
        const desc = debt.description || "";
        const plate = "licensePlate" in debt ? (debt as CustomerDebt).licensePlate || "" : "";
        const model = "vehicleModel" in debt ? (debt as CustomerDebt).vehicleModel || "" : "";

        const match =
          targetName.toLowerCase().includes(keyword) ||
          phone.toLowerCase().includes(keyword) ||
          desc.toLowerCase().includes(keyword) ||
          plate.toLowerCase().includes(keyword) ||
          model.toLowerCase().includes(keyword);

        if (!match) return false;
      }

      // 2. Status filter
      if (statusFilter === "overdue") {
        if (!debt.dueDate || debt.remainingAmount <= 0) return false;
        return debt.dueDate.slice(0, 10) < todayStr;
      } else if (statusFilter === "upcoming") {
        if (!debt.dueDate || debt.remainingAmount <= 0) return false;
        return debt.dueDate.slice(0, 10) >= todayStr;
      } else if (statusFilter === "paid") {
        return debt.remainingAmount <= 0;
      }

      return true;
    });
  }, [activeTab, branchCustomerDebts, branchSupplierDebts, search, statusFilter]);

  const currentTabTotalRemaining = useMemo(() => {
    return currentTabItems.reduce((sum, item) => sum + item.debt.remainingAmount, 0);
  }, [currentTabItems]);

  const handleDelete = async (id: string, type: "customer" | "supplier") => {
    if (!window.confirm("Bạn có chắc chắn muốn xóa khoản công nợ này?")) return;
    try {
      if (type === "customer") {
        await deleteCustomerDebt(id);
      } else {
        await deleteSupplierDebt(id);
      }
      showToast.success("Xóa khoản nợ thành công!");
    } catch (err: any) {
      showToast.error("Không thể xóa khoản nợ: " + err.message);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 space-y-6">
      {/* 1. Header & Top Summary Cards */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-600/20 text-blue-400 border border-blue-500/30">
              <HandCoins className="w-6 h-6" />
            </div>
            Quản lý Công Nợ
          </h1>
          <p className="text-xs text-slate-400 font-medium mt-1">
            Theo dõi công nợ khách hàng và nhà cung cấp
          </p>
        </div>

        {/* 4 Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* Tổng công nợ */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-1">
            <span className="text-[11px] font-semibold text-slate-400 block">
              Tổng công nợ
            </span>
            <div className="text-base font-black text-white">
              {formatCurrency(totalAllRemaining)}
            </div>
            <span className="text-[10px] text-slate-500 block">
              -{customerUnpaidCount + supplierUnpaidCount} khoản
            </span>
          </div>

          {/* Công nợ KH */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-1">
            <span className="text-[11px] font-semibold text-blue-400 block">
              Công nợ KH
            </span>
            <div className="text-base font-black text-blue-300">
              {formatCurrency(totalCustomerRemaining)}
            </div>
            <span className="text-[10px] text-slate-500 block">
              -{customerUnpaidCount} khoản
            </span>
          </div>

          {/* Công nợ NCC */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-1">
            <span className="text-[11px] font-semibold text-purple-400 block">
              Công nợ NCC
            </span>
            <div className="text-base font-black text-purple-300">
              {formatCurrency(totalSupplierRemaining)}
            </div>
            <span className="text-[10px] text-slate-500 block">
              -{supplierUnpaidCount} khoản
            </span>
          </div>

          {/* Trả góp */}
          <div className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-xl space-y-1">
            <span className="text-[11px] font-semibold text-amber-400 block">
              Trả góp
            </span>
            <div className="text-base font-black text-amber-300">
              {formatCurrency(0)}
            </div>
            <span className="text-[10px] text-slate-500 block">-0 khoản</span>
          </div>
        </div>
      </div>

      {/* 2. Main Content Card */}
      <div className="bg-slate-900/80 border border-slate-800/90 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        {/* Tab Navigation */}
        <div className="flex items-center gap-2 border-b border-slate-800 pb-3 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setActiveTab("customer")}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "customer"
                ? "bg-blue-600/20 text-blue-400 border border-blue-500/30 shadow-lg shadow-blue-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <User className="w-4 h-4" /> Công nợ KH
            <span className="px-1.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[11px]">
              {customerUnpaidCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("supplier")}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "supplier"
                ? "bg-purple-600/20 text-purple-400 border border-purple-500/30 shadow-lg shadow-purple-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <Building2 className="w-4 h-4" /> Công nợ NCC
            <span className="px-1.5 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[11px]">
              {supplierUnpaidCount}
            </span>
          </button>

          <button
            onClick={() => setActiveTab("installment")}
            className={`h-10 px-4 rounded-xl font-bold text-xs flex items-center gap-2 transition-all shrink-0 ${
              activeTab === "installment"
                ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 shadow-lg shadow-amber-950/40"
                : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
            }`}
          >
            <CreditCard className="w-4 h-4" /> Trả góp
            <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[11px]">
              0
            </span>
          </button>
        </div>

        {/* Search, Filter Pills & Actions Bar */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search box */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Tìm SĐT / Tên KH / Tên sản phẩm / IMEI..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-10 pl-10 pr-3 bg-slate-950/80 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Quick Filter Pills */}
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none py-1">
            <button
              onClick={() => setStatusFilter("all")}
              className={`px-3 h-8 rounded-lg text-xs font-semibold transition-colors shrink-0 ${
                statusFilter === "all"
                  ? "bg-slate-700 text-white"
                  : "bg-slate-800/50 text-slate-400 hover:text-slate-200"
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setStatusFilter("overdue")}
              className={`px-3 h-8 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                statusFilter === "overdue"
                  ? "bg-red-600/30 text-red-300 border border-red-500/40"
                  : "bg-slate-800/50 text-red-400 hover:bg-red-950/30"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" /> Quá hạn
            </button>
            <button
              onClick={() => setStatusFilter("upcoming")}
              className={`px-3 h-8 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors shrink-0 ${
                statusFilter === "upcoming"
                  ? "bg-amber-600/30 text-amber-300 border border-amber-500/40"
                  : "bg-slate-800/50 text-amber-400 hover:bg-amber-950/30"
              }`}
            >
              <Clock className="w-3.5 h-3.5" /> Sắp đến hạn
            </button>
          </div>

          {/* Summary badge & Action Buttons */}
          <div className="flex items-center gap-3 self-end lg:self-auto shrink-0">
            <div className="text-xs font-bold text-slate-300">
              Tổng công nợ:{" "}
              <span className="text-red-400 font-extrabold text-sm ml-1">
                {formatCurrency(currentTabTotalRemaining)}
              </span>
            </div>

            <button
              onClick={() => setShowAddModal(true)}
              className="h-10 px-3.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs flex items-center gap-1.5 transition-colors"
            >
              <Plus className="w-4 h-4 text-blue-400" /> Thêm công nợ
            </button>

            <button
              onClick={() => {
                if (currentTabItems.length > 0) {
                  setCollectingDebtItem(currentTabItems[0]);
                } else {
                  showToast.warning("Không có khoản nợ nào để thu!");
                }
              }}
              className="h-10 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-950/50"
            >
              <HandCoins className="w-4 h-4" /> Thu nợ
            </button>
          </div>
        </div>

        {/* 3. Debt Table List */}
        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/40">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-900/90 text-slate-400 font-semibold">
                  <th className="py-3 px-4 w-[280px]">
                    {activeTab === "supplier" ? "Nhà cung cấp nợ" : "Khách hàng nợ"}
                  </th>
                  <th className="py-3 px-4 min-w-[220px]">Nội dung</th>
                  <th className="py-3 px-4 text-right w-[120px]">Số tiền</th>
                  <th className="py-3 px-4 text-right w-[120px]">Đã trả</th>
                  <th className="py-3 px-4 text-right w-[130px]">Còn nợ</th>
                  <th className="py-3 px-4 text-center w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {currentTabItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-slate-500">
                      <div className="text-3xl mb-2">💳</div>
                      <p className="font-semibold text-sm">Không tìm thấy khoản công nợ nào</p>
                      <p className="text-xs text-slate-600 mt-1">
                        Hãy thử đổi bộ lọc hoặc thêm khoản nợ mới
                      </p>
                    </td>
                  </tr>
                ) : (
                  currentTabItems.map(({ debt, type }) => {
                    const targetName =
                      type === "customer"
                        ? (debt as CustomerDebt).customerName
                        : (debt as SupplierDebt).supplierName;
                    const phone = debt.phone || "--";
                    const model =
                      type === "customer"
                        ? (debt as CustomerDebt).vehicleModel ||
                          (debt as CustomerDebt).licensePlate ||
                          "--"
                        : "--";
                    const staff = debt.staffName || "N/A";
                    const createdDateStr = debt.createdDate
                      ? new Date(debt.createdDate).toLocaleDateString("vi-VN")
                      : "--";

                    const dueDateStr = debt.dueDate
                      ? new Date(debt.dueDate).toLocaleDateString("vi-VN")
                      : null;

                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isOverdue =
                      debt.dueDate &&
                      debt.remainingAmount > 0 &&
                      debt.dueDate.slice(0, 10) < todayStr;

                    return (
                      <tr
                        key={debt.id}
                        className="hover:bg-slate-800/40 transition-colors group"
                      >
                        {/* Đối tượng nợ */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 font-bold text-xs shrink-0 mt-0.5">
                              {targetName.slice(0, 1).toUpperCase()}
                            </div>
                            <div className="space-y-0.5">
                              <div className="font-bold text-sm text-white leading-tight">
                                {targetName}
                              </div>
                              <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                <Phone className="w-3 h-3" /> {phone}
                              </div>
                              {model !== "--" && (
                                <div className="flex items-center gap-1 text-[11px] text-slate-400">
                                  <Car className="w-3 h-3 text-slate-500" /> {model}
                                </div>
                              )}
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <Calendar className="w-3 h-3" /> {createdDateStr}
                                {dueDateStr && (
                                  <span
                                    className={`ml-1 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                      isOverdue
                                        ? "bg-red-500/20 text-red-400 border border-red-500/30"
                                        : "bg-amber-500/10 text-amber-300"
                                    }`}
                                  >
                                    {isOverdue ? "⚠️ Quá hạn: " : "Hạn: "}
                                    {dueDateStr}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] text-slate-500">
                                <UserCheck className="w-3 h-3 text-blue-400" /> NV: {staff}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Nội dung nợ */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="text-xs text-slate-200 font-medium leading-relaxed">
                            {debt.description}
                          </div>
                        </td>

                        {/* Số tiền gốc */}
                        <td className="py-3.5 px-4 align-top text-right font-bold text-slate-200 text-xs">
                          {formatCurrency(debt.totalAmount)}
                        </td>

                        {/* Đã trả */}
                        <td className="py-3.5 px-4 align-top text-right font-bold text-emerald-400 text-xs">
                          {formatCurrency(debt.paidAmount)}
                        </td>

                        {/* Còn nợ */}
                        <td className="py-3.5 px-4 align-top text-right font-extrabold text-red-400 text-sm">
                          {formatCurrency(debt.remainingAmount)}
                        </td>

                        {/* Nút Thao tác 3 chấm */}
                        <td className="py-3.5 px-4 align-top text-center relative">
                          <button
                            onClick={() =>
                              setOpenActionId(openActionId === debt.id ? null : debt.id)
                            }
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                          >
                            <MoreVertical className="w-4 h-4" />
                          </button>

                          {/* Action Dropdown Menu */}
                          {openActionId === debt.id && (
                            <div
                              className="absolute right-4 top-10 z-30 w-44 bg-slate-900 border border-slate-800 rounded-xl shadow-2xl py-1 text-left animate-fadeIn"
                              onMouseLeave={() => setOpenActionId(null)}
                            >
                              <button
                                onClick={() => {
                                  setOpenActionId(null);
                                  setCollectingDebtItem({ debt, type });
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <HandCoins className="w-4 h-4" /> Thu nợ đợt này
                              </button>
                              <button
                                onClick={() => {
                                  setOpenActionId(null);
                                  setHistoryDebtItem({ debt, type });
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 flex items-center gap-2"
                              >
                                <History className="w-4 h-4 text-blue-400" /> Lịch sử thanh toán
                              </button>
                              <button
                                onClick={() => {
                                  setOpenActionId(null);
                                  handleDelete(debt.id, type);
                                }}
                                className="w-full px-3 py-2 text-xs font-semibold text-red-400 hover:bg-slate-800 flex items-center gap-2 border-t border-slate-800/80 mt-1"
                              >
                                <Trash2 className="w-4 h-4" /> Xóa khoản nợ
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modals */}
      {collectingDebtItem && (
        <CollectDebtModal
          debt={collectingDebtItem.debt}
          type={collectingDebtItem.type}
          onClose={() => setCollectingDebtItem(null)}
        />
      )}

      {showAddModal && (
        <AddDebtModal
          initialType={activeTab === "supplier" ? "supplier" : "customer"}
          onClose={() => setShowAddModal(false)}
        />
      )}

      {historyDebtItem && (
        <DebtHistoryModal
          debt={historyDebtItem.debt}
          type={historyDebtItem.type}
          onClose={() => setHistoryDebtItem(null)}
        />
      )}
    </div>
  );
};

export default DebtManager;
