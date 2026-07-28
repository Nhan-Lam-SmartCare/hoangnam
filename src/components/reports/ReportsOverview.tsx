import React, { useState, useMemo } from "react";
import {
  DollarSign,
  Wallet,
  Boxes,
  BadgePercent,
  ClipboardList,
  FileSpreadsheet,
  TrendingUp,
  Tag,
  BriefcaseBusiness,
  FileText,
  Users,
} from "lucide-react";

import { useAppContext } from "../../contexts/AppContext";
import { useSales } from "../../hooks/useSupabase";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import {
  useCustomerDebtsRepo,
  useSupplierDebtsRepo,
} from "../../hooks/useDebtsRepository";
import { useSupabaseClient } from "../../hooks/useSupabaseClient";
import type { Sale, Part } from "../../types";
import { showToast } from "../../utils/toast";
import { formatCurrency } from "../../utils/format";
import {
  exportRevenueReport,
  exportCashflowReport,
  exportInventoryReport,
  exportPayrollReport,
  exportDebtReport,
  exportTopProductsReport,
  exportProductProfitReport,
  exportDetailedInventoryReport,
} from "../../utils/excelExport";
import { ReportsManagerMobile } from "./ReportsManagerMobile";
import TaxReportExport from "./TaxReportExport";
import { useDailyFinancials } from "./hooks/useDailyFinancials";
import { useSalaryReport } from "./hooks/useSalaryReport";
import {
  calculateFinancialSummary,
  isExcludedExpenseCategory,
  isExcludedIncomeCategory,
  isRefundCategory,
} from "../../lib/reports/financialSummary";
import { getCashTxCategoryKey } from "../../lib/finance/cashTxCategories";
import { useTheme } from "../../contexts/useTheme";
import {
  RevenueReport,
  CashflowReport,
  InventoryReport,
  PayrollReport,
  DebtReport,
} from "./components";


type ReportTab =
  | "revenue"
  | "cashflow"
  | "inventory"
  | "payroll"
  | "debt"
  | "tax";


type DateRange = "today" | "week" | "month" | "quarter" | "year" | "custom";

const REPORT_TAB_CONFIGS: Array<{
  key: ReportTab;
  label: string;
  icon: React.ReactNode;
  activeClass: string;
  inactiveClass: string;
  dotClass: string;
}> = [
  {
    key: "revenue",
    label: "Doanh thu",
    icon: <DollarSign className="w-4 h-4" />,
    activeClass:
      "bg-gradient-to-r from-blue-600 to-sky-500 text-white border-transparent shadow-lg shadow-blue-500/30",
    inactiveClass:
      "bg-transparent dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-blue-400",
  },
  {
    key: "cashflow",
    label: "Thu chi",
    icon: <Wallet className="w-4 h-4" />,
    activeClass:
      "bg-gradient-to-r from-emerald-50 to-emerald-500 text-white border-transparent shadow-lg shadow-emerald-500/30",
    inactiveClass:
      "bg-transparent dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-emerald-400",
  },
  {
    key: "inventory",
    label: "Tồn kho",
    icon: <Boxes className="w-4 h-4" />,
    activeClass:
      "bg-gradient-to-r from-amber-505 to-orange-500 text-white border-transparent shadow-lg shadow-orange-500/30",
    inactiveClass:
      "bg-transparent dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-amber-400",
  },
  {
    key: "payroll",
    label: "Lương",
    icon: <BriefcaseBusiness className="w-4 h-4" />,
    activeClass:
      "bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white border-transparent shadow-lg shadow-violet-500/30",
    inactiveClass:
      "bg-transparent dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-violet-400",
  },
  {
    key: "debt",
    label: "Công nợ",
    icon: <ClipboardList className="w-4 h-4" />,
    activeClass:
      "bg-gradient-to-r from-rose-500 to-red-500 text-white border-transparent shadow-lg shadow-rose-500/30",
    inactiveClass:
      "bg-transparent dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-rose-400",
  },
  {
    key: "tax",
    label: "Báo cáo thuế",
    icon: <FileText className="w-4 h-4" />,
    activeClass:
      "bg-gradient-to-r from-indigo-505 to-purple-500 text-white border-transparent shadow-lg shadow-indigo-500/30",
    inactiveClass:
      "bg-transparent dark:bg-transparent text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 border border-slate-200 dark:border-slate-700",
    dotClass: "bg-indigo-400",
  },
];


export default function ReportsOverview() {
  const supabase = useSupabaseClient();
  const { theme: _theme } = useTheme();
  const { payrollRecords, customers, suppliers, currentBranchId, employees } =
    useAppContext();

  // Repository data (Supabase-backed)
  const { data: salesData = [], isLoading: salesLoading } = useSales();
  const { data: partsData = [], isLoading: partsLoading } = usePartsRepo();
  const { data: workOrdersData = [] } = useWorkOrdersRepo();
  const { data: customerDebtsData = [] } = useCustomerDebtsRepo();
  const { data: supplierDebtsData = [] } = useSupplierDebtsRepo();

  // Fetch unpaid work orders for debt calculation (same as DebtManager)
  const [unpaidWorkOrders, setUnpaidWorkOrders] = useState<any[]>([]);

  React.useEffect(() => {
    const fetchUnpaidWorkOrders = async () => {
      try {
        const { data, error } = await supabase
          .from("work_orders")
          .select("*")
          .eq("status", "Trả máy")
          .eq("branchid", currentBranchId)
          .gt("remainingamount", 0);

        if (!error && data) {
          setUnpaidWorkOrders(data);
        }
      } catch (err) {
        console.error("Error fetching unpaid work orders:", err);
      }
    };

    fetchUnpaidWorkOrders();
  }, [currentBranchId]);

  // Build parts cost lookup map
  const partsCostMap = useMemo(() => {
    const map = new Map<string, number>();
    partsData.forEach((part: Part) => {
      const costPrice = part.costPrice?.[currentBranchId] || 0;
      map.set(part.id, costPrice);
      map.set(part.sku, costPrice); // Also lookup by SKU
    });
    return map;
  }, [partsData, currentBranchId]);

  const [activeTab, setActiveTab] = useState<ReportTab>("revenue");
  const [dateRange, setDateRange] = useState<DateRange>("month");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [selectedMonth, setSelectedMonth] = useState<number>(
    new Date().getMonth() + 1
  ); // 1-12
  const [selectedYear] = useState<number>(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const salaryReportProps = useSalaryReport(employees, selectedMonth, selectedYear, activeTab);

  const getLocalDateKey = (input: string | Date): string => {
    const d = input instanceof Date ? input : new Date(input);
    if (Number.isNaN(d.getTime())) {
      return String(input).slice(0, 10);
    }
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Function to handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("desc"); // Default to descending for numbers
    }
  };

  // Tính toán khoảng thời gian
  const { start, end } = useMemo(() => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (dateRange === "custom" && startDate && endDate) {
      return { start: new Date(startDate), end: new Date(endDate) };
    }

    switch (dateRange) {
      case "today":
        start = new Date(now.setHours(0, 0, 0, 0));
        end = new Date(now.setHours(23, 59, 59, 999));
        break;
      case "week":
        start = new Date(now.setDate(now.getDate() - 7));
        break;
      case "month":
        start = new Date(selectedYear, selectedMonth - 1, 1);
        end = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
        break;
      case "quarter":
        start = new Date(now.setMonth(now.getMonth() - 3));
        break;
      case "year":
        start = new Date(now.setFullYear(now.getFullYear() - 1));
        break;
    }

    return { start, end };
  }, [dateRange, startDate, endDate, selectedMonth, selectedYear]);

  // Báo cáo doanh thu (bao gồm cả Sales và Work Orders đã thanh toán)
  const revenueReport = useMemo(() => {
    const summary = calculateFinancialSummary({
      sales: salesData,
      workOrders: workOrdersData,
      parts: partsData,
      cashTransactions: [],
      branchId: currentBranchId,
      start,
      end,
    });

    const filteredSales = summary.filteredSales as Sale[];
    const filteredWorkOrders = summary.filteredWorkOrders;

    const getPartCost = (partId: string, sku: string, fallbackCost: number) => {
      if (fallbackCost && fallbackCost > 0) return fallbackCost;
      return (
        partsCostMap.get(partId) || partsCostMap.get(sku) || 0
      );
    };

    const totalRevenue = summary.totalRevenue;
    const totalCost = summary.totalCost;
    const totalProfit = summary.totalProfit;

    const dataByDate = new Map<
      string,
      {
        date: string;
        sales: Sale[];
        workOrders: any[];
        totalRevenue: number;
        totalCost: number;
        partsCost: number;
        servicesCost: number;
        totalProfit: number;
        orderCount: number;
      }
    >();

    filteredSales.forEach((sale) => {
      const dateKey = getLocalDateKey(sale.date);
      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, {
          date: dateKey,
          sales: [],
          workOrders: [],
          totalRevenue: 0,
          totalCost: 0,
          partsCost: 0,
          servicesCost: 0,
          totalProfit: 0,
          orderCount: 0,
        });
      }
      const dayData = dataByDate.get(dateKey)!;
      const saleCost = sale.items.reduce((c: number, it: any) => {
        const partCost = getPartCost(
          it.partId,
          it.sku,
          (it as any).costPrice || 0
        );
        return c + partCost * it.quantity;
      }, 0);
      dayData.sales.push(sale);
      dayData.totalRevenue += sale.total;
      dayData.totalCost += saleCost;
      dayData.partsCost += saleCost;
      dayData.totalProfit += sale.total - saleCost;
      dayData.orderCount += 1;
    });

    filteredWorkOrders.forEach((wo: any) => {
      const paymentDateRaw = wo.paymentDate || wo.paymentdate;

      let accountingDateRaw = paymentDateRaw;
      if (!accountingDateRaw) {
        const creationDateRaw = wo.creationDate || wo.creationdate;
        if (creationDateRaw) {
          console.warn(
            `[ReportsOverview] Work order ${wo.id} missing paymentDate, fallback to creationDate (legacy)`
          );
          accountingDateRaw = creationDateRaw;
        }
      }

      if (!accountingDateRaw) {
        console.warn(
          `[ReportsOverview] Work order ${wo.id} has no accounting date, skipping from daily revenue report`
        );
        return;
      }

      const woDateObj = new Date(accountingDateRaw);
      const dateKey = getLocalDateKey(woDateObj);

      if (!dataByDate.has(dateKey)) {
        dataByDate.set(dateKey, {
          date: dateKey,
          sales: [],
          workOrders: [],
          totalRevenue: 0,
          totalCost: 0,
          partsCost: 0,
          servicesCost: 0,
          totalProfit: 0,
          orderCount: 0,
        });
      }
      const dayData = dataByDate.get(dateKey)!;
      const parts = wo.partsUsed || wo.partsused || [];
      const partsCost = parts.reduce((c: number, p: any) => {
        const partId = p.partId || p.partid;
        const sku = p.sku;
        const cost = getPartCost(partId, sku, p.costPrice || p.costprice || 0);
        return c + cost * (p.quantity || 0);
      }, 0);

      const servicesCost = 0;
      const woCost = partsCost;
      const woTotal = wo.totalPaid || wo.totalpaid || wo.total || 0;
      dayData.workOrders.push(wo);
      dayData.totalRevenue += woTotal;
      dayData.totalCost += woCost;
      dayData.partsCost += partsCost;
      dayData.servicesCost += servicesCost;
      dayData.totalProfit += woTotal - woCost;
      dayData.orderCount += 1;
    });

    const dailyReport = Array.from(dataByDate.values()).sort(
      (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    return {
      sales: filteredSales,
      workOrders: filteredWorkOrders,
      dailyReport,
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin:
        totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : 0,
      orderCount: filteredSales.length + filteredWorkOrders.length,
      salesCount: filteredSales.length,
      workOrdersCount: filteredWorkOrders.length,
    };
  }, [salesData, workOrdersData, partsData, currentBranchId, partsCostMap, start, end]);

  // Báo cáo thu chi
  const { data: cashTxData = [], isLoading: cashTxLoading } = useCashTxRepo({
    branchId: currentBranchId,
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  });

  const sortedDailyReport = useMemo(() => {
    const reportableCashTx = cashTxData.filter((t) => {
      const txDate = new Date(t.date);
      if (Number.isNaN(txDate.getTime()) || txDate < start || txDate > end) {
        return false;
      }

      if (t.type === "income") {
        return !isExcludedIncomeCategory(t.category);
      }

      if (t.type === "expense") {
        return t.amount > 0 && (!isExcludedExpenseCategory(t.category) || isRefundCategory(t.category));
      }

      return false;
    });

    const mergedReportMap = new Map(
      revenueReport.dailyReport.map((d) => [d.date, d])
    );

    reportableCashTx.forEach((t) => {
      const dateKey = getLocalDateKey(t.date);
      if (!mergedReportMap.has(dateKey)) {
        mergedReportMap.set(dateKey, {
          date: dateKey,
          sales: [],
          workOrders: [],
          totalRevenue: 0,
          totalCost: 0,
          partsCost: 0,
          servicesCost: 0,
          totalProfit: 0,
          orderCount: 0,
        });
      }
    });

    const baseDailyReport = Array.from(mergedReportMap.values()).sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );

    if (!sortColumn) return baseDailyReport;

    return [...baseDailyReport].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortColumn) {
        case "date":
          aValue = new Date(a.date).getTime();
          bValue = new Date(b.date).getTime();
          break;
        case "totalCost":
          aValue = a.totalCost;
          bValue = b.totalCost;
          break;
        case "totalRevenue":
          aValue = a.totalRevenue;
          bValue = b.totalRevenue;
          break;
        case "totalProfit":
          aValue = a.totalProfit;
          bValue = b.totalProfit;
          break;
        case "orderCount":
          aValue = a.orderCount;
          bValue = b.orderCount;
          break;
        default:
          return 0;
      }

      if (sortDirection === "asc") {
        return aValue - bValue;
      } else {
        return bValue - aValue;
      }
    });
  }, [revenueReport.dailyReport, cashTxData, start, end, sortColumn, sortDirection]);

  const dailyFinancials = useDailyFinancials({
    sortedDailyReport,
    cashTxData,
    partsCostMap,
  });

  const cashTotals = useMemo(() => {
    const filteredTransactions = cashTxData.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });

    const totalIncome = filteredTransactions
      .filter(
        (t) => t.type === "income" && !isExcludedIncomeCategory(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const totalExpense = filteredTransactions
      .filter(
        (t) =>
          t.type === "expense" &&
          t.amount > 0 &&
          !isExcludedExpenseCategory(t.category)
      )
      .reduce((sum, t) => sum + t.amount, 0);

    const totalRefund = filteredTransactions
      .filter((t) => t.type === "expense" && t.amount > 0 && isRefundCategory(t.category))
      .reduce((sum, t) => sum + t.amount, 0);

    return { totalIncome, totalExpense, totalRefund };
  }, [cashTxData, start, end]);

  const financialSummary = useMemo(() => {
    return calculateFinancialSummary({
      sales: salesData,
      workOrders: workOrdersData,
      parts: partsData,
      cashTransactions: cashTxData,
      branchId: currentBranchId,
      start,
      end,
    });
  }, [salesData, workOrdersData, partsData, cashTxData, currentBranchId, start, end]);

  const combinedRevenue = financialSummary.combinedRevenue;
  const netProfit = financialSummary.netProfit;

  const cashflowReport = useMemo(() => {
    const filteredTransactions = cashTxData.filter((t) => {
      const txDate = new Date(t.date);
      return txDate >= start && txDate <= end;
    });

    const income = filteredTransactions
      .filter((t) => t.type === "income")
      .reduce((sum, t) => sum + t.amount, 0);

    const expense = filteredTransactions
      .filter((t) => t.type === "expense")
      .reduce((sum, t) => sum + t.amount, 0);

    const byCategory: Record<string, { income: number; expense: number }> = {};
    filteredTransactions.forEach((t) => {
      const categoryKey = getCashTxCategoryKey(t.category);
      const groupKey = categoryKey || t.category || "other";
      if (!byCategory[groupKey]) {
        byCategory[groupKey] = { income: 0, expense: 0 };
      }
      if (t.type === "income") {
        byCategory[groupKey].income += t.amount;
      } else {
        byCategory[groupKey].expense += t.amount;
      }
    });

    return {
      transactions: filteredTransactions,
      totalIncome: income,
      totalExpense: expense,
      netCashFlow: income - expense,
      byCategory,
    };
  }, [cashTxData, start, end]);

  // Báo cáo tồn kho
  const inventoryReport = useMemo(() => {
    const currentStock = partsData.map((p: Part) => ({
      ...p,
      stock: p.stock[currentBranchId] || 0,
      price: p.retailPrice[currentBranchId] || 0,
      value:
        (p.stock[currentBranchId] || 0) * (p.retailPrice[currentBranchId] || 0),
    }));

    const totalValue = currentStock.reduce(
      (sum: number, p: any) => sum + p.value,
      0
    );
    const lowStock = currentStock.filter((p: any) => p.stock < 10);

    return {
      parts: currentStock,
      totalValue,
      lowStockCount: lowStock.length,
      lowStockItems: lowStock,
    };
  }, [partsData, currentBranchId]);

  // Báo cáo lương (mới)
  const payrollReport = useMemo(() => {
    return {
      records: salaryReportProps.staffSalaryRows || [],
      totalSalary: salaryReportProps.staffSalaryRows?.reduce((sum, r) => sum + Number(r.finalSalary || 0), 0) || 0,
      paidSalary: 0,
      unpaidSalary: 0,
      employeeCount: salaryReportProps.staffSalaryRows?.length || 0,
    };
  }, [salaryReportProps.staffSalaryRows]);

  // Báo cáo công nợ
  const debtReport = useMemo(() => {
    const existingWorkOrderIds = new Set(
      customerDebtsData
        .filter((d: any) => d.workOrderId)
        .map((d: any) => d.workOrderId)
    );

    const workOrderDebts = unpaidWorkOrders
      .filter((wo) => !existingWorkOrderIds.has(wo.id))
      .map((wo) => {
        const totalPaid = (wo.depositamount || 0) + (wo.additionalpayment || 0);
        const remainingAmount = Math.max(0, (wo.total || 0) - totalPaid);

        return {
          id: `WO-${wo.id}`,
          customerId: wo.customerphone || wo.id,
          customerName: wo.customername || "Khách vãng lai",
          phone: wo.customerphone || null,
          totalAmount: wo.total || 0,
          paidAmount: totalPaid,
          remainingAmount: remainingAmount,
          createdDate: wo.creationdate || wo.created_at,
          branchId: wo.branchid || currentBranchId,
          workOrderId: wo.id,
        };
      });

    const allCustomerDebts = [...customerDebtsData, ...workOrderDebts];

    const branchCustomerDebts = allCustomerDebts.filter(
      (debt: any) =>
        debt.branchId === currentBranchId && debt.remainingAmount > 0
    );
    const branchSupplierDebts = supplierDebtsData.filter(
      (debt) => debt.branchId === currentBranchId && debt.remainingAmount > 0
    );

    const customerDebtMap = new Map<
      string,
      { name: string; phone?: string; debt: number }
    >();
    branchCustomerDebts.forEach((debt) => {
      const key =
        debt.phone || debt.customerName?.toLowerCase() || debt.customerName;
      if (!customerDebtMap.has(key)) {
        customerDebtMap.set(key, {
          name: debt.customerName,
          phone: debt.phone,
          debt: 0,
        });
      }
      const current = customerDebtMap.get(key)!;
      current.debt += debt.remainingAmount;
    });

    const supplierDebtMap = new Map<string, { name: string; debt: number }>();
    branchSupplierDebts.forEach((debt) => {
      const key = debt.supplierName;
      if (!supplierDebtMap.has(key)) {
        supplierDebtMap.set(key, {
          name: debt.supplierName,
          debt: 0,
        });
      }
      const current = supplierDebtMap.get(key)!;
      current.debt += debt.remainingAmount;
    });

    const customerDebts = Array.from(customerDebtMap.values()).sort(
      (a, b) => b.debt - a.debt
    );
    const supplierDebts = Array.from(supplierDebtMap.values()).sort(
      (a, b) => b.debt - a.debt
    );

    const totalCustomerDebt = customerDebts.reduce((sum, c) => sum + c.debt, 0);
    const totalSupplierDebt = supplierDebts.reduce((sum, s) => sum + s.debt, 0);

    return {
      customerDebts,
      supplierDebts,
      totalCustomerDebt,
      totalSupplierDebt,
      netDebt: totalCustomerDebt - totalSupplierDebt,
    };
  }, [customerDebtsData, supplierDebtsData, currentBranchId, unpaidWorkOrders]);

  const exportToExcel = () => {
    const startStr = start.toISOString().split("T")[0];
    const endStr = end.toISOString().split("T")[0];

    try {
      switch (activeTab) {
        case "revenue":
          exportRevenueReport(revenueReport.sales, startStr, endStr);
          break;
        case "cashflow":
          exportCashflowReport(cashflowReport.transactions, startStr, endStr);
          break;
        case "inventory":
          exportInventoryReport(partsData, currentBranchId, startStr, endStr);
          break;
        case "payroll": {
          const startMonth = start.toISOString().slice(0, 7);
          const endMonth = end.toISOString().slice(0, 7);
          exportPayrollReport(payrollReport.records, startMonth, endMonth);
          break;
        }
        case "debt":
          exportDebtReport(
            customers,
            suppliers,
            revenueReport.sales,
            startStr,
            endStr
          );
          break;
      }
      showToast.success("Xuất Excel thành công! File đã được tải xuống.");
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Có lỗi khi xuất Excel. Vui lòng thử lại.");
    }
  };

  return (
    <div className="space-y-3">
      {/* Mobile View */}
      <ReportsManagerMobile
        dailyFinancials={dailyFinancials}
        revenueReport={revenueReport}
        cashflowReport={cashflowReport}
        inventoryReport={inventoryReport}
        payrollReport={payrollReport}
        salaryReportProps={salaryReportProps}
        debtReport={debtReport}
        employees={employees}
        dateRange={dateRange}
        setDateRange={setDateRange}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onExportExcel={exportToExcel}
        selectedMonth={selectedMonth}
        setSelectedMonth={setSelectedMonth}
        startDate={startDate}
        setStartDate={setStartDate}
        endDate={endDate}
        setEndDate={setEndDate}
        onDateClick={setSelectedDate}
        cashTotals={cashTotals}
        selectedDate={selectedDate}
      />

      {/* Desktop Controls - Hidden on Mobile */}
      <div className="hidden md:flex flex-col gap-3">
        <div className="flex items-center justify-between gap-4 bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 p-2 rounded-2xl shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.2)]">
          {/* Report Tabs */}
          <div className="flex items-center gap-1.5">
            {REPORT_TAB_CONFIGS.map((tab) => {
              const isActive = activeTab === tab.key;
              let iconColorSchema = "";
              switch (tab.key) {
                case "revenue":
                  iconColorSchema = isActive
                    ? "bg-white/20 text-white"
                    : "bg-blue-500/10 text-blue-600 dark:text-blue-400 group-hover:bg-blue-500/20";
                  break;
                case "cashflow":
                  iconColorSchema = isActive
                    ? "bg-white/20 text-white"
                    : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-500/20";
                  break;
                case "inventory":
                  iconColorSchema = isActive
                    ? "bg-white/20 text-white"
                    : "bg-amber-500/10 text-amber-600 dark:text-amber-400 group-hover:bg-amber-500/20";
                  break;
                case "payroll":
                  iconColorSchema = isActive
                    ? "bg-white/20 text-white"
                    : "bg-violet-500/10 text-violet-600 dark:text-violet-400 group-hover:bg-violet-500/20";
                  break;
                case "debt":
                  iconColorSchema = isActive
                    ? "bg-white/20 text-white"
                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 group-hover:bg-rose-500/20";
                  break;
                case "tax":
                  iconColorSchema = isActive
                    ? "bg-white/20 text-white"
                    : "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 group-hover:bg-indigo-500/20";
                  break;
              }


              return (
                <button
                  type="button"
                  aria-pressed={isActive}
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`group px-3.5 py-2 rounded-xl font-black whitespace-nowrap transition-all duration-300 flex items-center gap-2.5 text-xs uppercase tracking-wider ${
                    isActive
                      ? tab.activeClass
                      : "bg-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/40 border-transparent"
                  }`}
                >
                  <div className={`p-1.5 rounded-lg transition-all duration-300 ${iconColorSchema}`}>
                    {tab.icon}
                  </div>
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Export Excel Button & Advanced Reports */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-505 hover:to-teal-400 text-white rounded-xl font-black shadow-[0_4px_20px_rgba(16,185,129,0.25)] hover:shadow-[0_4px_25px_rgba(16,185,129,0.4)] active:scale-95 transition-all duration-205 flex items-center gap-2 text-xs uppercase tracking-wider border border-emerald-500/30"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>Xuất Excel</span>
            </button>

            {/* Advanced Reports Dropdown */}
            {activeTab === "revenue" && (
              <div className="relative group">
                <button className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-500 hover:from-blue-505 hover:to-indigo-400 text-white rounded-xl font-black shadow-[0_4px_20px_rgba(37,99,235,0.25)] hover:shadow-[0_4px_25px_rgba(37,99,235,0.4)] active:scale-95 transition-all duration-205 flex items-center gap-2 text-xs uppercase tracking-wider border border-blue-500/30">
                  <TrendingUp className="w-4 h-4" />
                  <span>Báo cáo nâng cao</span>
                </button>

                {/* Dropdown menu */}
                <div className="absolute right-0 top-full mt-2 w-64 bg-white/95 dark:bg-[#0F172A]/95 shadow-lg dark:shadow-[0_10px_40px_rgba(0,0,0,0.5)] border border-slate-200 dark:border-slate-800/80 rounded-2xl p-1.5 backdrop-blur-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50 animate-in fade-in slide-in-from-top-2">
                  <button
                    onClick={() => {
                      const startStr = start.toISOString().split("T")[0];
                      const endStr = end.toISOString().split("T")[0];
                      exportTopProductsReport(
                        revenueReport.sales,
                        startStr,
                        endStr,
                        20
                      );
                      showToast.success("Xuất Top sản phẩm thành công!");
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-[#1E293B]/80 transition-colors flex items-center gap-3 text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl"
                  >
                    <Tag className="w-4 h-4 text-blue-500 dark:text-blue-400" />
                    <span>Top sản phẩm bán chạy</span>
                  </button>

                  <button
                    onClick={() => {
                      const startStr = start.toISOString().split("T")[0];
                      const endStr = end.toISOString().split("T")[0];
                      exportProductProfitReport(
                        revenueReport.sales,
                        startStr,
                        endStr
                      );
                      showToast.success("Xuất lợi nhuận sản phẩm thành công!");
                    }}
                    className="w-full px-4 py-3 text-left hover:bg-slate-100 dark:hover:bg-[#1E293B]/80 transition-colors flex items-center gap-3 text-xs uppercase font-bold tracking-wider text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-xl"
                  >
                    <BadgePercent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    <span>Lợi nhuận theo sản phẩm</span>
                  </button>
                </div>
              </div>
            )}

            {/* Advanced Report */}
            {activeTab === "inventory" && (
              <button
                onClick={() => {
                  const startStr = start.toISOString().split("T")[0];
                  const endStr = end.toISOString().split("T")[0];
                  exportDetailedInventoryReport(
                    partsData,
                    currentBranchId,
                    startStr,
                    endStr
                  );
                  showToast.success("Xuất báo cáo tồn kho chi tiết thành công!");
                }}
                className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-500 hover:from-purple-505 hover:to-pink-400 text-white rounded-xl font-black shadow-[0_4px_20px_rgba(168,85,247,0.25)] hover:shadow-[0_4px_25px_rgba(168,85,247,0.4)] active:scale-95 transition-all duration-205 flex items-center gap-2 text-xs uppercase tracking-wider border border-purple-500/30"
              >
                <Boxes className="w-4 h-4" />
                <span>Tồn kho chi tiết</span>
              </button>
            )}
          </div>
        </div>

        {/* Sub-bar for Date Range and Month selectors */}
        <div className="flex items-center gap-4 flex-wrap bg-white/40 dark:bg-[#131926]/30 border border-slate-200 dark:border-slate-800/60 p-2 rounded-2xl shadow-sm dark:shadow-[0_4px_20px_rgb(0,0,0,0.15)]">
          {/* Date Range Selector Pill */}
          <div className="bg-slate-50 dark:bg-[#0B0F19]/80 border border-slate-200 dark:border-slate-800/80 p-1 rounded-xl flex items-center gap-1 shadow-inner">
            {(["today", "week", "month", "quarter", "year", "custom"] as const).map(
              (range) => (
                <button
                  key={range}
                  onClick={() => setDateRange(range)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-[10px] uppercase tracking-wider transition-all duration-200 ${
                    dateRange === range
                      ? "bg-blue-600 text-white shadow-[0_0_12px_rgba(37,99,235,0.4)]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-slate-800/40"
                  }`}
                >
                  {range === "today"
                    ? "Hôm nay"
                    : range === "week"
                    ? "7 ngày"
                    : range === "month"
                    ? "Tháng"
                    : range === "quarter"
                    ? "Quý"
                    : range === "year"
                    ? "Năm"
                    : "Tùy chỉnh"}
                </button>
              )
            )}
          </div>

          {/* Month selector T1..T12 */}
          {dateRange === "month" && (
            <div className="flex items-center gap-1 bg-slate-50 dark:bg-[#0B0F19]/80 border border-slate-200 dark:border-slate-800/80 p-1 rounded-xl shadow-inner flex-wrap">
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <button
                  key={month}
                  onClick={() => setSelectedMonth(month)}
                  className={`px-2.5 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all duration-200 hover:scale-105 ${
                    selectedMonth === month
                      ? "bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.4)]"
                      : "text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-white hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-400"
                  }`}
                >
                  T{month}
                </button>
              ))}
            </div>
          )}

          {/* Custom Date inputs */}
          {dateRange === "custom" && (
            <div className="flex items-center gap-2 bg-slate-50 dark:bg-[#0B0F19]/80 border border-slate-200 dark:border-slate-800/80 px-3 py-1.5 rounded-xl shadow-inner">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 dark:border-slate-800/85 rounded-lg bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
              <span className="text-slate-500 dark:text-slate-500 text-xs font-bold">→</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="px-2.5 py-1 border border-slate-200 dark:border-slate-800/85 rounded-lg bg-white dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
          )}
        </div>
      </div>

      {/* Report Content - Desktop Only */}
      <div className="hidden md:block bg-white/80 dark:bg-[#131926]/20 backdrop-blur-xl rounded-2xl border border-slate-200 dark:border-slate-800/80 p-5 shadow-sm dark:shadow-[0_8px_30px_rgb(0,0,0,0.3)]">
        {activeTab === "revenue" && (
          <RevenueReport
            salesLoading={salesLoading}
            combinedRevenue={combinedRevenue}
            revenueReport={revenueReport}
            cashTotals={cashTotals}
            netProfit={netProfit}
            dailyFinancials={dailyFinancials}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            sortColumn={sortColumn}
            sortDirection={sortDirection}
            handleSort={handleSort}
            partsCostMap={partsCostMap}
          />
        )}

        {activeTab === "cashflow" && (
          <CashflowReport
            cashTxLoading={cashTxLoading}
            cashflowReport={cashflowReport}
          />
        )}

        {activeTab === "inventory" && (
          <InventoryReport
            partsLoading={partsLoading}
            inventoryReport={inventoryReport}
          />
        )}

        {activeTab === "payroll" && (
          <PayrollReport
            salaryReportProps={salaryReportProps}
            employees={employees}
            salaryMonth={selectedMonth}
            salaryYear={selectedYear}
            salesData={salesData}
            currentBranchId={currentBranchId}
          />
        )}

        {activeTab === "debt" && (
          <DebtReport
            debtReport={debtReport}
          />
        )}

        {activeTab === "tax" && (
          <TaxReportExport />
        )}
      </div>

    </div>
  );
}
