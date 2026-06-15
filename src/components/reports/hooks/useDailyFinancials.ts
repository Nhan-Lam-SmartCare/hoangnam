import { useMemo } from "react";
import type { Sale } from "../../../types";
import {
  isExcludedExpenseCategory,
  isExcludedIncomeCategory,
  isRefundCategory,
} from "../../../lib/reports/financialSummary";

// Helper to get local date key format (YYYY-MM-DD) from date input
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

export interface DailyFinancialItem {
  date: string;
  salesRevenue: number;
  woRevenue: number;
  salesCOGS: number;
  woParts: number;
  laiGop: number;
  thuKhac: number;
  chiKhac: number;
  chiHoan: number;
  thuChiKhac: number;
  laiRong: number;
  dayCashTx: any[];
  sales: Sale[];
  workOrders: any[];
  orderCount: number;
}

interface UseDailyFinancialsParams {
  sortedDailyReport: any[];
  cashTxData: any[];
  partsCostMap: Map<string, number>;
}

export const useDailyFinancials = ({
  sortedDailyReport,
  cashTxData,
  partsCostMap,
}: UseDailyFinancialsParams): DailyFinancialItem[] => {
  return useMemo(() => {
    return sortedDailyReport.map((day) => {
      const salesRevenue = day.sales.reduce((sum: number, s: any) => sum + s.total, 0);
      const woRevenue = day.workOrders.reduce(
        (sum: number, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
        0
      );

      // COGS (cost of goods sold) for sales
      const salesCOGS = day.sales.reduce((sum: number, s: any) => {
        return (
          sum +
          s.items.reduce((c: number, it: any) => {
            const cost =
              it.costPrice || partsCostMap.get(it.partId) || partsCostMap.get(it.sku) || 0;
            return c + cost * it.quantity;
          }, 0)
        );
      }, 0);

      // Parts cost for work orders
      const woParts = day.workOrders.reduce((sum: number, wo: any) => {
        const parts = wo.partsUsed || wo.partsused || [];
        return (
          sum +
          parts.reduce((c: number, p: any) => {
            const partId = p.partId || p.partid;
            const cost =
              p.costPrice ||
              p.costprice ||
              partsCostMap.get(partId) ||
              partsCostMap.get(p.sku) ||
              0;
            return c + cost * (p.quantity || 0);
          }, 0)
        );
      }, 0);

      const laiGop = salesRevenue + woRevenue - (salesCOGS + woParts);

      // Calculate other daily income and expenses
      const dayDateStr = day.date;
      const thuKhac = cashTxData
        .filter(
          (t) =>
            t.type === "income" &&
            !isExcludedIncomeCategory(t.category) &&
            getLocalDateKey(t.date) === dayDateStr
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const chiKhac = cashTxData
        .filter(
          (t) =>
            t.type === "expense" &&
            t.amount > 0 &&
            !isExcludedExpenseCategory(t.category) &&
            getLocalDateKey(t.date) === dayDateStr
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const chiHoan = cashTxData
        .filter(
          (t) =>
            t.type === "expense" &&
            t.amount > 0 &&
            isRefundCategory(t.category) &&
            getLocalDateKey(t.date) === dayDateStr
        )
        .reduce((sum, t) => sum + t.amount, 0);

      const thuChiKhac = thuKhac - chiKhac - chiHoan;
      const laiRong = laiGop + thuKhac - chiKhac - chiHoan;

      // Filter daily cash transactions (other categories, including refunds)
      const dayCashTx = cashTxData.filter(
        (t) =>
          getLocalDateKey(t.date) === dayDateStr &&
          ((!isExcludedIncomeCategory(t.category) && !isExcludedExpenseCategory(t.category)) ||
            (t.type === "expense" && t.amount > 0 && isRefundCategory(t.category)))
      );

      return {
        date: day.date,
        salesRevenue,
        woRevenue,
        salesCOGS,
        woParts,
        laiGop,
        thuKhac,
        chiKhac,
        chiHoan,
        thuChiKhac,
        laiRong,
        dayCashTx,
        sales: day.sales,
        workOrders: day.workOrders,
        orderCount: day.sales.length + day.workOrders.length,
      };
    });
  }, [sortedDailyReport, cashTxData, partsCostMap]);
};
