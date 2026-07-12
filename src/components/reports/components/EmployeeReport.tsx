import React, { useMemo } from "react";
import type { Sale } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../supabaseClient";
import { Users, DollarSign, Wrench, ShoppingCart, TrendingUp } from "lucide-react";

interface EmployeeReportProps {
  sales: Sale[];
  workOrders: any[];
  employees: any[];
  startDate: string;
  endDate: string;
}

export const EmployeeReport: React.FC<EmployeeReportProps> = ({
  sales,
  workOrders,
  employees,
  startDate,
  endDate,
}) => {
  // Query worker splits in the given date range
  const { data: splits = [], isLoading: loadingSplits } = useQuery({
    queryKey: ["workerSplitsForReport", startDate, endDate],
    queryFn: async () => {
      const start = new Date(startDate).toISOString();
      // Add time boundary to include entire end date (up to 23:59:59)
      const end = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1).toISOString();

      const { data, error } = await supabase
        .from("repair_order_service_workers")
        .select(`
          worker_id,
          worker_name,
          worker_amount,
          repair_order_services!inner(repair_order_id, created_at)
        `)
        .gte("repair_order_services.created_at", start)
        .lte("repair_order_services.created_at", end);

      if (error) {
        console.error("Error loading worker splits for report:", error);
        return [];
      }
      return data || [];
    },
    staleTime: 10000,
  });

  const reportData = useMemo(() => {
    // Collect split order ids
    const splitOrderIds = new Set<string>();
    const splitsByWorkerName = new Map<string, number>();
    const splitsByWorkerId = new Map<string, number>();

    splits.forEach((row: any) => {
      const orderId = row.repair_order_services?.repair_order_id;
      if (orderId) splitOrderIds.add(orderId);

      const amount = Number(row.worker_amount || 0);
      const nameKey = String(row.worker_name || "").toLowerCase().trim();
      const idKey = String(row.worker_id || "");

      if (nameKey) {
        splitsByWorkerName.set(nameKey, (splitsByWorkerName.get(nameKey) || 0) + amount);
      }
      if (idKey) {
        splitsByWorkerId.set(idKey, (splitsByWorkerId.get(idKey) || 0) + amount);
      }
    });

    // We process every employee to compute stats
    return employees.map((emp) => {
      const empId = String(emp.id || "");
      const empName = String(emp.name || "").trim();
      const empNameLower = empName.toLowerCase();

      // 1. Calculate sales made by this employee
      const empSales = sales.filter((sale) => {
        const saleUserId = String(sale.userId || "");
        const saleUserName = String(sale.userName || "").toLowerCase().trim();
        return (
          (empId && saleUserId === empId) ||
          (empNameLower && saleUserName === empNameLower)
        );
      });

      const salesCount = empSales.length;
      const salesRevenue = empSales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);

      // 2. Calculate labor wages from work orders
      // For work orders inside date range:
      const dateFilteredWOs = workOrders.filter((wo) => {
        const dateStr = wo.paymentDate || wo.paymentdate || wo.created_at || wo.creationDate || wo.creationdate;
        if (!dateStr) return false;
        const woDate = new Date(dateStr);
        const start = new Date(startDate);
        const end = new Date(new Date(endDate).getTime() + 24 * 60 * 60 * 1000 - 1);
        return woDate >= start && woDate <= end;
      });

      // Split amount for this worker
      let laborWages = 0;
      let repairCount = 0;

      // Add splits
      if (empId && splitsByWorkerId.has(empId)) {
        laborWages += splitsByWorkerId.get(empId) || 0;
      } else if (empNameLower && splitsByWorkerName.has(empNameLower)) {
        laborWages += splitsByWorkerName.get(empNameLower) || 0;
      }

      // Add fallback from work orders where this employee is main technician
      // but the work order does not have detailed splits
      dateFilteredWOs.forEach((wo) => {
        const isCanceled =
          String(wo.status || "").toLowerCase().trim() === "đã hủy" ||
          String(wo.status || "").toLowerCase().trim() === "da huy" ||
          String(wo.status || "").toLowerCase().trim() === "cancelled";
        if (isCanceled) return;

        const technicianLower = String(wo.technicianName || "").toLowerCase().trim();
        if (technicianLower === empNameLower) {
          repairCount += 1;
          
          // If work order was NOT split, assign full laborCost to the technician
          if (!splitOrderIds.has(wo.id)) {
            laborWages += Number(wo.laborCost || wo.laborcost || wo.labor_total || 0);
          }
        }
      });

      return {
        id: empId,
        name: empName,
        role: emp.role || "staff",
        salesCount,
        salesRevenue,
        repairCount,
        laborWages,
        totalContribution: salesRevenue + laborWages,
      };
    }).sort((a, b) => b.totalContribution - a.totalContribution);
  }, [sales, workOrders, employees, splits, startDate, endDate]);

  const totals = useMemo(() => {
    return reportData.reduce(
      (acc, item) => ({
        salesCount: acc.salesCount + item.salesCount,
        salesRevenue: acc.salesRevenue + item.salesRevenue,
        repairCount: acc.repairCount + item.repairCount,
        laborWages: acc.laborWages + item.laborWages,
        totalContribution: acc.totalContribution + item.totalContribution,
      }),
      { salesCount: 0, salesRevenue: 0, repairCount: 0, laborWages: 0, totalContribution: 0 }
    );
  }, [reportData]);

  if (loadingSplits) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Summary Row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-blue-100/60 dark:from-blue-950/20 dark:to-blue-900/10 border border-blue-100 dark:border-blue-500/25 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tổng tiền công thợ</div>
            <div className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(totals.laborWages)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{totals.repairCount} lượt sửa chữa</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/60 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-100 dark:border-emerald-500/25 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-xl">
            <ShoppingCart className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Doanh số bán lẻ</div>
            <div className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(totals.salesRevenue)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">{totals.salesCount} hóa đơn bán hàng</div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-purple-100/60 dark:from-purple-950/20 dark:to-purple-900/10 border border-purple-100 dark:border-purple-500/25 p-4 rounded-2xl flex items-center gap-3">
          <div className="p-3 bg-purple-500/10 text-purple-600 dark:text-purple-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[10px] text-slate-500 uppercase tracking-wider font-bold">Tổng hiệu suất phát sinh</div>
            <div className="text-lg font-black text-slate-900 dark:text-white font-mono mt-0.5">
              {formatCurrency(totals.totalContribution)}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">Công sửa + Doanh số bán hàng</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-900/40 border-b border-slate-200 dark:border-slate-700 font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3">Nhân viên</th>
                <th className="px-4 py-3 text-center">Số đơn sửa</th>
                <th className="px-4 py-3 text-right">Tiền công thợ</th>
                <th className="px-4 py-3 text-center">Số đơn bán</th>
                <th className="px-4 py-3 text-right">Doanh số bán</th>
                <th className="px-4 py-3 text-right">Tổng phát sinh</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-150 dark:divide-slate-700">
              {reportData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/20 transition-colors">
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-600 dark:text-slate-350">
                        {item.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 dark:text-white">{item.name}</div>
                        <div className="text-[10px] text-slate-400 capitalize">{item.role === "manager" ? "Quản lý" : "Nhân viên"}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                    {item.repairCount}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-blue-650 dark:text-blue-400 font-mono">
                    {formatCurrency(item.laborWages)}
                  </td>
                  <td className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-300">
                    {item.salesCount}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600 dark:text-emerald-400 font-mono">
                    {formatCurrency(item.salesRevenue)}
                  </td>
                  <td className="px-4 py-3 text-right font-black text-purple-600 dark:text-purple-400 font-mono">
                    {formatCurrency(item.totalContribution)}
                  </td>
                </tr>
              ))}
              {/* Total row */}
              <tr className="bg-slate-50 dark:bg-slate-900/60 font-bold border-t border-slate-200 dark:border-slate-700">
                <td className="px-4 py-3 uppercase text-slate-800 dark:text-slate-200">Tổng cộng</td>
                <td className="px-4 py-3 text-center text-slate-800 dark:text-slate-200">{totals.repairCount}</td>
                <td className="px-4 py-3 text-right text-blue-650 dark:text-blue-400 font-mono">{formatCurrency(totals.laborWages)}</td>
                <td className="px-4 py-3 text-center text-slate-800 dark:text-slate-200">{totals.salesCount}</td>
                <td className="px-4 py-3 text-right text-emerald-600 dark:text-emerald-400 font-mono">{formatCurrency(totals.salesRevenue)}</td>
                <td className="px-4 py-3 text-right text-purple-650 dark:text-purple-450 font-mono">{formatCurrency(totals.totalContribution)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
