import React, { useState, useMemo, useCallback } from "react";
import { FileText, Download, Info, FileSpreadsheet } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useSales } from "../../hooks/useSupabase";
import { useWorkOrdersRepo } from "../../hooks/useWorkOrdersRepository";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useStoreSettings } from "../../hooks/useStoreSettings";
import { showToast } from "../../utils/toast";
import { formatCurrency, formatDate } from "../../utils/format";
import {
  exportVATReportXML,
  exportRevenueXML,
  prepareVATReportData,
  type OrganizationTaxInfo,
} from "../../utils/taxReportXML";
import { exportS1aHKD, type BusinessInfo } from "../../utils/excelExport";
import { calculateFinancialSummary, getWorkOrderAccountingDate } from "../../lib/reports/financialSummary";

/**
 * TAX REPORT EXPORT COMPONENT
 * Component để xuất báo cáo thuế theo định dạng XML chuẩn Tổng cục Thuế
 */

type TrackedTaxProduct = {
  label: string;
  aliases: string[];
};

const TRACKED_TAX_PRODUCTS: TrackedTaxProduct[] = [
  {
    label: "Bình pin khởi động NL5A 12v6Ah - Cao",
    aliases: ["binh pin khoi dong nl5a 12v6ah cao", "nl5a 12v6ah"],
  },
  {
    label: "Bình pin khởi động NL5S 12v6Ah - Lùn",
    aliases: ["binh pin khoi dong nl5s 12v6ah lun", "nl5s 12v6ah"],
  },
  {
    label: "Bình pin khởi động NL6V 12v6Ah - Lỡ",
    aliases: ["binh pin khoi dong nl6v 12v6ah lo", "nl6v 12v6ah"],
  },
  {
    label: "Khối pin 48V15Ah",
    aliases: ["khoi pin 48v15ah", "48v15ah"],
  },
  {
    label: "Khối pin 24v15Ah",
    aliases: ["khoi pin 24v15ah", "24v15ah"],
  },
  {
    label: "Sạc pin 24v3a",
    aliases: ["sac pin 24v3a", "24v3a"],
  },
  {
    label: "Sạc pin 48V3A - 54,4V",
    aliases: ["sac pin 48v3a 54 4v", "48v3a 54 4v", "48v3a"],
  },
];

function normalizeForTaxProduct(value: string): string {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function getTrackedProductIndexByName(name: string): number {
  const normalized = normalizeForTaxProduct(name);
  if (!normalized) return -1;

  return TRACKED_TAX_PRODUCTS.findIndex((product) =>
    product.aliases.some((alias) => normalized.includes(alias))
  );
}

function getLineAmount(line: any): number {
  const quantity = Number(line?.quantity ?? 0) || 0;
  const unitPrice = Number(
    line?.sellingPrice ?? line?.price ?? line?.unitPrice ?? line?.unitprice ?? 0
  ) || 0;
  return quantity * unitPrice;
}

function removeTrackedProductsFromTaxData(
  sales: any[],
  workOrders: any[]
): { sales: any[]; workOrders: any[]; excludedRevenue: number } {
  let excludedRevenue = 0;

  const adjustedSales = (sales || [])
    .map((sale: any) => {
      const items = Array.isArray(sale?.items) ? sale.items : [];
      const subtotal = items.reduce((sum: number, item: any) => sum + getLineAmount(item), 0);
      const saleTotal = Number(sale?.total ?? subtotal) || 0;
      const ratio = subtotal > 0 ? saleTotal / subtotal : 1;

      const keptItems = items.filter((item: any) => {
        const productName = item?.partName || item?.partname || item?.name || "";
        return getTrackedProductIndexByName(productName) < 0;
      });
      const keptSubtotal = keptItems.reduce((sum: number, item: any) => sum + getLineAmount(item), 0);
      const excludedSubtotal = Math.max(0, subtotal - keptSubtotal);
      const excludedAmount = excludedSubtotal * ratio;
      const adjustedTotal = Math.max(0, saleTotal - excludedAmount);

      excludedRevenue += excludedAmount;

      return {
        ...sale,
        items: keptItems,
        subtotal: keptSubtotal,
        total: adjustedTotal,
      };
    })
    .filter((sale: any) => Number(sale?.total ?? 0) > 0);

  const adjustedWorkOrders = (workOrders || [])
    .map((wo: any) => {
      const partsUsed = Array.isArray(wo?.partsUsed)
        ? wo.partsUsed
        : Array.isArray(wo?.partsused)
          ? wo.partsused
          : [];
      const additionalServices = Array.isArray(wo?.additionalServices)
        ? wo.additionalServices
        : Array.isArray(wo?.additionalservices)
          ? wo.additionalservices
          : [];

      const partsTotal = partsUsed.reduce((sum: number, p: any) => sum + getLineAmount(p), 0);
      const servicesTotal = additionalServices.reduce(
        (sum: number, s: any) => sum + getLineAmount(s),
        0
      );
      const laborCost = Number(wo?.laborCost ?? wo?.laborcost ?? wo?.labor_cost ?? 0) || 0;
      const discount = Number(wo?.discount ?? 0) || 0;

      const theoreticalTotal = partsTotal + laborCost + servicesTotal - discount;
      const totalPaid =
        Number(wo?.totalPaid ?? wo?.totalpaid ?? wo?.total ?? theoreticalTotal) || 0;
      const ratio = theoreticalTotal > 0 ? totalPaid / theoreticalTotal : 1;

      const keptParts = partsUsed.filter((part: any) => {
        const productName = part?.partName || part?.partname || part?.name || "";
        return getTrackedProductIndexByName(productName) < 0;
      });
      const keptPartsTotal = keptParts.reduce((sum: number, p: any) => sum + getLineAmount(p), 0);
      const excludedPartsTotal = Math.max(0, partsTotal - keptPartsTotal);
      const excludedAmount = excludedPartsTotal * ratio;
      const adjustedTotalPaid = Math.max(0, totalPaid - excludedAmount);

      excludedRevenue += excludedAmount;

      return {
        ...wo,
        partsUsed: keptParts,
        partsused: keptParts,
        totalPaid: adjustedTotalPaid,
        totalpaid: adjustedTotalPaid,
        total: adjustedTotalPaid,
      };
    })
    .filter((wo: any) => Number(wo?.totalPaid ?? wo?.totalpaid ?? wo?.total ?? 0) > 0);

  return {
    sales: adjustedSales,
    workOrders: adjustedWorkOrders,
    excludedRevenue: Math.round(excludedRevenue),
  };
}

function getTotalSalesRevenue(sales: any[]): number {
  return (sales || []).reduce((sum: number, sale: any) => {
    return sum + (Number(sale?.total) || 0);
  }, 0);
}

function getTotalWorkOrderRevenue(workOrders: any[]): number {
  return (workOrders || []).reduce((sum: number, wo: any) => {
    return sum + (Number(wo?.totalPaid ?? wo?.totalpaid ?? wo?.total) || 0);
  }, 0);
}

function getGoodsAndServiceRevenueFromWorkOrders(workOrders: any[]): {
  woPartsRevenue: number;
  woLaborRevenue: number;
  serviceWoCount: number;
} {
  let woPartsRevenue = 0;
  let woLaborRevenue = 0;
  let serviceWoCount = 0;

  (workOrders || []).forEach((wo: any) => {
    const laborCost = Number(wo?.laborCost ?? wo?.laborcost ?? wo?.labor_cost ?? 0);
    const woTotal = Number(wo?.totalPaid ?? wo?.totalpaid ?? wo?.total ?? 0);
    const labor = Math.min(laborCost, woTotal);
    const parts = Math.max(0, woTotal - labor);

    woLaborRevenue += labor;
    woPartsRevenue += parts;

    if (laborCost > 0) {
      serviceWoCount += 1;
    }
  });

  return { woPartsRevenue, woLaborRevenue, serviceWoCount };
}

const TaxReportExport: React.FC = () => {
  const { currentBranchId } = useAppContext();

  // Fetch data
  const { data: salesData = [] } = useSales();
  const { data: workOrdersData = [] } = useWorkOrdersRepo();
  const { data: cashTxData = [] } = useCashTxRepo({
    branchId: currentBranchId,
  });
  const { data: partsData = [] } = usePartsRepo();
  const { data: storeSettings } = useStoreSettings();

  // State
  const [reportType, setReportType] = useState<"vat" | "revenue" | "s1a-hkd">("s1a-hkd");
  const [periodType, setPeriodType] = useState<"month" | "quarter">("month");
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState(
    Math.floor(new Date().getMonth() / 3) + 1
  );

  const storeName = (storeSettings?.store_name || "MOTOCARE").trim();
  const storeAddress = (storeSettings?.address || "123 Đường ABC, Quận 1, TP.HCM").trim();
  const storePhone = (storeSettings?.phone || "028.1234.5678").trim();
  const storeEmail = (storeSettings?.email || "contact@motocare.vn").trim();
  const storeTaxCode = (storeSettings?.tax_code || "0123456789").trim();

  const businessName = /^h[oộ]\s*kinh\s*doanh/i.test(storeName)
    ? storeName
    : `Hộ kinh doanh ${storeName}`;

  // Organization info
  const organizationInfo: OrganizationTaxInfo = useMemo(
    () => ({
      taxCode: storeTaxCode,
      name: storeName,
      address: storeAddress,
      phone: storePhone,
      email: storeEmail,
      taxAuthority: "Cục Thuế TP. Hồ Chí Minh",
      taxDepartment: "Chi cục Thuế Quận 1",
      legalRepresentative: "Chủ hộ kinh doanh",
      accountantName: "",
      accountantPhone: storePhone,
    }),
    [storeAddress, storeEmail, storeName, storePhone, storeTaxCode]
  );

  // Business info for S1a-HKD
  const businessInfo: BusinessInfo = useMemo(
    () => ({
      businessName,
      taxCode: storeTaxCode,
      address: storeAddress,
      businessLocation: storeAddress,
    }),
    [businessName, storeAddress, storeTaxCode]
  );

  // Calculate date range
  const getDateRange = useCallback(() => {
    let startDate: Date;
    let endDate: Date;

    if (periodType === "month") {
      startDate = new Date(selectedYear, selectedMonth - 1, 1, 0, 0, 0, 0);
      endDate = new Date(selectedYear, selectedMonth, 0, 23, 59, 59, 999);
    } else {
      // Quarter
      const quarterStartMonth = (selectedQuarter - 1) * 3;
      startDate = new Date(selectedYear, quarterStartMonth, 1, 0, 0, 0, 0);
      endDate = new Date(selectedYear, quarterStartMonth + 3, 0, 23, 59, 59, 999);
    }

    return { startDate, endDate };
  }, [periodType, selectedYear, selectedMonth, selectedQuarter]);

  // Filter data by date range
  const getFilteredData = useCallback(() => {
    const { startDate, endDate } = getDateRange();

    const filteredSales = salesData.filter((sale) => {
      const status = (sale as any).status;
      if (status === "cancelled" || status === "refunded") {
        return false;
      }
      
      const saleBranchId = (sale as any).branchId || (sale as any).branchid;
      if (saleBranchId && currentBranchId && saleBranchId !== currentBranchId) {
        return false;
      }
      const saleDate = new Date(sale.date);
      return saleDate >= startDate && saleDate <= endDate;
    });

    const filteredWorkOrders = workOrdersData.filter((wo: any) => {
      const status = String(wo.paymentStatus ?? wo.paymentstatus ?? "").toLowerCase();
      const totalPaid = Number(wo.totalPaid ?? wo.totalpaid ?? 0);
      const isPaidLike = status === "paid" || status === "partial" || totalPaid > 0;
      if (!isPaidLike) {
        return false;
      }
      
      const woBranchId = wo.branchId || wo.branchid;
      if (woBranchId && currentBranchId && woBranchId !== currentBranchId) {
        return false;
      }
      const woDate = getWorkOrderAccountingDate(wo);
      return woDate && woDate >= startDate && woDate <= endDate;
    });

    const filteredCashTx = cashTxData.filter((tx) => {
      const txDate = new Date(tx.date);
      return txDate >= startDate && txDate <= endDate;
    });

    return {
      sales: filteredSales,
      workOrders: filteredWorkOrders,
      cashTransactions: filteredCashTx,
    };
  }, [getDateRange, salesData, workOrdersData, cashTxData, currentBranchId]);

  // Calculate preview stats
  const previewStats = useMemo(() => {
    const { startDate, endDate } = getDateRange();
    
    const financialSummary = calculateFinancialSummary({
      sales: salesData,
      workOrders: workOrdersData,
      parts: partsData,
      cashTransactions: cashTxData,
      branchId: currentBranchId,
      start: startDate,
      end: endDate,
    });

    if (reportType === "s1a-hkd") {
      const filteredWOs = financialSummary.filteredWorkOrders as any[];
      const sanitized = removeTrackedProductsFromTaxData(
        financialSummary.filteredSales,
        filteredWOs
      );

      const totalSalesRevenue = getTotalSalesRevenue(sanitized.sales);
      const totalWorkOrderRevenue = getTotalWorkOrderRevenue(sanitized.workOrders);
      const totalRevenue = totalSalesRevenue + totalWorkOrderRevenue;
      const transactionCount = sanitized.sales.length + sanitized.workOrders.length;

      const woSplit = getGoodsAndServiceRevenueFromWorkOrders(sanitized.workOrders);

      const goodsRevenue = totalSalesRevenue + woSplit.woPartsRevenue;
      const goodsCount = sanitized.sales.length + sanitized.workOrders.length;

      const serviceRevenue = woSplit.woLaborRevenue;
      const serviceWoCount = woSplit.serviceWoCount;

      const goodsGTGT = Math.round(goodsRevenue * 1 / 100);
      const goodsTNCN = Math.round(goodsRevenue * 0.5 / 100);
      const goodsTax = goodsGTGT + goodsTNCN;

      const serviceGTGT = Math.round(serviceRevenue * 3 / 100);
      const serviceTNCN = Math.round(serviceRevenue * 1.5 / 100);
      const serviceTax = serviceGTGT + serviceTNCN;

      const totalTax = goodsTax + serviceTax;

      return {
        totalRevenue,
        totalVAT: totalTax,
        transactionCount,
        taxRate: 0,
        financialSummary,
        taxSales: sanitized.sales,
        taxWorkOrders: sanitized.workOrders,
        excludedTrackedRevenue: sanitized.excludedRevenue,
        goodsRevenue,
        goodsTax,
        goodsGTGT,
        goodsTNCN,
        goodsCount,
        woServiceRevenue: serviceRevenue,
        serviceTax,
        serviceGTGT,
        serviceTNCN,
        woServiceCount: serviceWoCount,
      };
    }

    const vatData = prepareVATReportData(
      financialSummary.filteredSales,
      financialSummary.filteredWorkOrders,
      getFilteredData().cashTransactions,
      organizationInfo,
      startDate,
      endDate
    );

    const totalRevenueBeforeVAT = vatData.outputVAT.totalRevenue;
    const totalVAT = vatData.outputVAT.vatAmount;
    const transactionCount = vatData.outputVAT.transactions.length;

    return { 
      totalRevenue: totalRevenueBeforeVAT, 
      totalVAT, 
      transactionCount,
      taxRate: 10,
      financialSummary,
    };
  }, [
    salesData,
    workOrdersData,
    cashTxData,
    partsData,
    currentBranchId,
    getDateRange,
    getFilteredData,
    organizationInfo,
    reportType,
  ]);

  // Handle export
  const handleExport = () => {
    try {
      const { startDate, endDate } = getDateRange();
      
      const { financialSummary } = previewStats;
      const sales = reportType === "s1a-hkd"
        ? ((previewStats as any).taxSales || financialSummary.filteredSales)
        : financialSummary.filteredSales;
      const workOrders = reportType === "s1a-hkd"
        ? ((previewStats as any).taxWorkOrders || financialSummary.filteredWorkOrders)
        : financialSummary.filteredWorkOrders;
      const { cashTransactions } = getFilteredData();

      if (sales.length === 0 && workOrders.length === 0) {
        showToast.warning("Không có dữ liệu trong kỳ này!");
        return;
      }

      let result;

      if (reportType === "s1a-hkd") {
        result = exportS1aHKD(
          sales,
          workOrders,
          businessInfo,
          startDate,
          endDate
        );
        showToast.success(
          `Đã xuất sổ doanh thu S1a-HKD: ${result.fileName}\nTổng doanh thu: ${formatCurrency(result.totalRevenue)}`
        );
      } else if (reportType === "vat") {
        result = exportVATReportXML(
          sales,
          workOrders,
          cashTransactions,
          organizationInfo,
          startDate,
          endDate
        );
        showToast.success(
          `Đã xuất tờ khai VAT: ${
            result.fileName
          }\nThuế phải nộp: ${formatCurrency(result.vatPayable)}`
        );
      } else {
        result = exportRevenueXML(
          sales,
          workOrders,
          organizationInfo,
          startDate,
          endDate
        );
        showToast.success(`Đã xuất báo cáo doanh thu: ${result.fileName}`);
      }
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Có lỗi khi xuất báo cáo!");
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <FileText className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Xuất báo cáo thuế
            </h1>
          </div>
          <p className="text-xs text-slate-505 dark:text-slate-400 ml-[46px]">
            Xuất file theo định dạng chuẩn Tổng cục Thuế
          </p>
        </div>
        {/* Period Badge */}
        <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-slate-100 dark:bg-slate-700/50 rounded-full">
          <span className="text-xs text-slate-500 dark:text-slate-400">Kỳ:</span>
          <span className="text-xs font-semibold text-slate-800 dark:text-white">
            {periodType === "month"
              ? `T${selectedMonth}/${selectedYear}`
              : `Q${selectedQuarter}/${selectedYear}`}
          </span>
          <span className="text-[10px] text-slate-400 dark:text-slate-500">
            ({formatDate(getDateRange().startDate)} - {formatDate(getDateRange().endDate)})
          </span>
        </div>
      </div>

      {/* Info Banner - compact */}
      {reportType === "s1a-hkd" && (
        <div className="flex items-center gap-2.5 px-4 py-2.5 bg-amber-50 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/40 rounded-lg">
          <Info className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-200">
            <strong>Hộ kinh doanh:</strong> Chỉ cần xuất <strong>Sổ S1a-HKD</strong> (Excel) — không cần kê khai VAT.
          </p>
        </div>
      )}

      {/* Configuration - 2 column layout */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-5">
          {/* Left: Report Type */}
          <div>
            <label className="block text-xs font-semibold text-slate-505 dark:text-slate-400 uppercase tracking-wider mb-2.5">
              Loại báo cáo
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                onClick={() => setReportType("s1a-hkd")}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  reportType === "s1a-hkd"
                    ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-1 ring-emerald-200 dark:ring-emerald-800"
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-505"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileSpreadsheet className={`w-4 h-4 ${reportType === "s1a-hkd" ? "text-emerald-600" : "text-slate-400"}`} />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">S1a-HKD</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">Hộ kinh doanh (Excel)</div>
              </button>

              <button
                onClick={() => setReportType("vat")}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  reportType === "vat"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-1 ring-blue-200 dark:ring-blue-800"
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-505"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className={`w-4 h-4 ${reportType === "vat" ? "text-blue-600" : "text-slate-400"}`} />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Tờ khai VAT</span>
                </div>
                <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">01/GTGT (XML)</div>
              </button>

              <button
                onClick={() => setReportType("revenue")}
                className={`p-3 rounded-lg border-2 transition-all text-left ${
                  reportType === "revenue"
                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/20 ring-1 ring-purple-200 dark:ring-purple-800"
                    : "border-slate-200 dark:border-slate-600 hover:border-slate-300 dark:hover:border-slate-505"
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <FileText className={`w-4 h-4 ${reportType === "revenue" ? "text-purple-600" : "text-slate-400"}`} />
                  <span className="text-sm font-semibold text-slate-900 dark:text-white">Doanh thu</span>
                </div>
                <div className="text-[10px] text-slate-505 dark:text-slate-400 mt-0.5">Chi tiết (XML)</div>
              </button>
            </div>
          </div>

          {/* Right: Period Selectors - compact vertical stack */}
          <div className="lg:w-56 lg:border-l lg:border-slate-200 lg:dark:border-slate-700 lg:pl-5 space-y-3">
            {/* Period Toggle */}
            <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden">
              <button
                onClick={() => setPeriodType("month")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodType === "month"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                }`}
              >
                Tháng
              </button>
              <button
                onClick={() => setPeriodType("quarter")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  periodType === "quarter"
                    ? "bg-blue-600 text-white"
                    : "bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                }`}
              >
                Quý
              </button>
            </div>

            {/* Year & Month/Quarter in a row */}
            <div className="grid grid-cols-2 gap-2">
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                {[2023, 2024, 2025, 2026].map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>

              {periodType === "month" ? (
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                    <option key={month} value={month}>Tháng {month}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={selectedQuarter}
                  onChange={(e) => setSelectedQuarter(parseInt(e.target.value))}
                  className="px-2.5 py-1.5 text-sm border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  {[1, 2, 3, 4].map((q) => (
                    <option key={q} value={q}>Quý {q}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 divide-x divide-slate-200 dark:divide-slate-700">
          <div className="p-4 md:p-5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Giao dịch</div>
            <div className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white">{previewStats.transactionCount}</div>
          </div>
          <div className="p-4 md:p-5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {reportType === "s1a-hkd" ? "Tổng doanh thu" : "Doanh thu chưa VAT"}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(previewStats.totalRevenue)}</div>
          </div>
          <div className="p-4 md:p-5">
            <div className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">
              {reportType === "s1a-hkd" ? "Thuế phải nộp" : "Thuế VAT"}
            </div>
            <div className="text-2xl md:text-3xl font-bold text-orange-500 dark:text-orange-400">{formatCurrency(previewStats.totalVAT)}</div>
          </div>
        </div>

        {/* Tax Breakdown Table - only for S1a-HKD */}
        {reportType === "s1a-hkd" && (
          <div className="border-t border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50/80 dark:bg-slate-700/50">
                  <th className="px-4 md:px-5 py-2.5 text-left text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Phân loại</th>
                  <th className="px-4 md:px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Doanh thu</th>
                  <th className="px-4 md:px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">GTGT</th>
                  <th className="px-4 md:px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">TNCN</th>
                  <th className="px-4 md:px-5 py-2.5 text-right text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Tổng thuế</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {/* Hàng hóa / Phụ tùng */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 md:px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0"></div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">Hàng hóa / Phụ tùng</div>
                        <div className="text-[10px] text-slate-405 dark:text-slate-505">{(previewStats as any).goodsCount || 0} đơn • Thuế suất 1% + 0.5%</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3 text-right font-medium text-slate-900 dark:text-slate-100">{formatCurrency((previewStats as any).goodsRevenue || 0)}</td>
                  <td className="px-4 md:px-5 py-3 text-right text-orange-600 dark:text-orange-400">{formatCurrency((previewStats as any).goodsGTGT || 0)}</td>
                  <td className="px-4 md:px-5 py-3 text-right text-purple-600 dark:text-purple-400">{formatCurrency((previewStats as any).goodsTNCN || 0)}</td>
                  <td className="px-4 md:px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency((previewStats as any).goodsTax || 0)}</td>
                </tr>
                {/* Tiền công sửa chữa */}
                <tr className="hover:bg-slate-50/50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 md:px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0"></div>
                      <div>
                        <div className="font-medium text-slate-900 dark:text-slate-100">Tiền công sửa chữa</div>
                        <div className="text-[10px] text-slate-405 dark:text-slate-505">{(previewStats as any).woServiceCount || 0} phiếu • Thuế suất 3% + 1.5%</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 md:px-5 py-3 text-right font-medium text-slate-900 dark:text-slate-100">{formatCurrency((previewStats as any).woServiceRevenue || 0)}</td>
                  <td className="px-4 md:px-5 py-3 text-right text-orange-600 dark:text-orange-400">{formatCurrency((previewStats as any).serviceGTGT || 0)}</td>
                  <td className="px-4 md:px-5 py-3 text-right text-purple-600 dark:text-purple-400">{formatCurrency((previewStats as any).serviceTNCN || 0)}</td>
                  <td className="px-4 md:px-5 py-3 text-right font-semibold text-slate-900 dark:text-slate-100">{formatCurrency((previewStats as any).serviceTax || 0)}</td>
                </tr>
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 dark:bg-slate-700/40 border-t-2 border-slate-200 dark:border-slate-600">
                  <td className="px-4 md:px-5 py-3 font-bold text-slate-900 dark:text-white">Tổng</td>
                  <td className="px-4 md:px-5 py-3 text-right font-bold text-slate-900 dark:text-white">{formatCurrency(previewStats.totalRevenue)}</td>
                  <td className="px-4 md:px-5 py-3 text-right font-bold text-orange-600 dark:text-orange-400">{formatCurrency(((previewStats as any).goodsGTGT || 0) + ((previewStats as any).serviceGTGT || 0))}</td>
                  <td className="px-4 md:px-5 py-3 text-right font-bold text-purple-600 dark:text-purple-400">{formatCurrency(((previewStats as any).goodsTNCN || 0) + ((previewStats as any).serviceTNCN || 0))}</td>
                  <td className="px-4 md:px-5 py-3 text-right font-bold text-orange-600 dark:text-orange-400 text-base">{formatCurrency(previewStats.totalVAT)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={previewStats.transactionCount === 0}
        className={`w-full py-3.5 rounded-xl font-semibold transition-all flex items-center justify-center gap-2 text-sm ${
          previewStats.transactionCount === 0
            ? "bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-550 cursor-not-allowed"
            : reportType === "s1a-hkd"
              ? "bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-lg shadow-emerald-500/25 hover:shadow-xl hover:shadow-emerald-500/30"
              : "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-xl hover:shadow-blue-500/30"
        }`}
      >
        {reportType === "s1a-hkd" ? (
          <>
            <FileSpreadsheet className="w-5 h-5" />
            Xuất file Excel (S1a-HKD)
          </>
        ) : (
          <>
            <Download className="w-5 h-5" />
            Xuất file XML
          </>
        )}
      </button>

      {previewStats.transactionCount === 0 && (
        <p className="text-center text-xs text-slate-400 dark:text-slate-505">
          Không có dữ liệu trong kỳ này
        </p>
      )}
    </div>
  );
};

export default TaxReportExport;
