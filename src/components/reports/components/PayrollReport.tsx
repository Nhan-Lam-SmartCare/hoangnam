import React from "react";
import { BriefcaseBusiness, X, Edit3, Save, DollarSign } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import { useMemo, useState } from "react";
import { useAppContext } from "../../../contexts/AppContext";
import { useCreateCashTransaction } from "../../../hooks/useSupabase";
import { showToast } from "../../../utils/toast";
import type { PayrollRecord } from "../../../types";

interface PayrollReportProps {
  salaryReportProps: any;
  employees: any[];
  salaryMonth: number;
  salaryYear: number;
  salesData?: any[];
  currentBranchId?: string;
}

const formatDateTime = (value?: string) => {
  if (!value) return "--";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return "--";
  return dt.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const PayrollReport: React.FC<PayrollReportProps> = ({
  salaryReportProps,
  employees,
  salaryMonth,
  salaryYear,
  salesData = [],
  currentBranchId = "CN1",
}) => {
  const {
    staffSalaryRows,
    loadingSalaryRows,
    selectedSalaryWorker,
    setSelectedSalaryWorker,
    salaryDetailRows,
    loadingSalaryDetails,
    handleExportSalaryDetailsExcel,
    editingBonusPenalty,
    setEditingBonusPenalty,
    handleSaveBonusPenalty,
    handleOpenSalaryDetails,
  } = salaryReportProps;

  const { upsertPayrollRecord, setPayrollRecords, payrollRecords = [] } = useAppContext();
  const createCashTx = useCreateCashTransaction();

  const [payingWorker, setPayingWorker] = useState<any | null>(null);
  const [payMethod, setPayMethod] = useState<"cash" | "bank">("cash");
  const [payNotes, setPayNotes] = useState("");

  const getPaymentStatus = (workerId: string) => {
    const targetMonth = `${salaryYear}-${String(salaryMonth).padStart(2, "0")}`;
    return payrollRecords.find(
      (r) => r.employeeId === workerId && r.month === targetMonth && r.paymentStatus === "paid"
    );
  };

  const handlePaySalary = async (workerRow: any, method: "cash" | "bank", notesStr: string) => {
    try {
      const netSalary = workerRow.finalSalary;
      const recordId = `PAY-${workerRow.workerId}-${salaryYear}-${String(salaryMonth).padStart(2, "0")}`;

      const payrollRecord: PayrollRecord = {
        id: recordId,
        employeeId: workerRow.workerId,
        employeeName: workerRow.workerName,
        month: `${salaryYear}-${String(salaryMonth).padStart(2, "0")}`,
        baseSalary: workerRow.baseSalary || 0,
        allowances: 0,
        bonus: workerRow.bonus || 0,
        deduction: workerRow.penalty || 0,
        workDays: 26,
        standardWorkDays: 26,
        socialInsurance: 0,
        healthInsurance: 0,
        unemploymentInsurance: 0,
        personalIncomeTax: 0,
        netSalary,
        paymentStatus: "paid",
        paymentDate: new Date().toISOString(),
        paymentMethod: method,
        notes: notesStr || `Trả lương tháng ${salaryMonth}/${salaryYear}`,
        branchId: currentBranchId,
        created_at: new Date().toISOString(),
      };

      await upsertPayrollRecord(payrollRecord);

      const cashTxPayload = {
        id: `CT-PAY-${recordId}`,
        type: "expense" as const,
        date: new Date().toISOString(),
        amount: netSalary,
        recipient: workerRow.workerName,
        notes: notesStr || `Trả lương tháng ${salaryMonth}/${salaryYear}`,
        paymentSourceId: method,
        branchId: currentBranchId,
        category: "salary" as const,
      };

      await createCashTx.mutateAsync(cashTxPayload);

      setPayrollRecords((prev) => {
        const filtered = prev.filter((r) => r.id !== recordId);
        return [payrollRecord, ...filtered];
      });

      showToast.success(`Đã trả lương thành công cho ${workerRow.workerName}`);
    } catch (err: any) {
      console.error(err);
      showToast.error(`Lỗi trả lương: ${err.message || err}`);
    }
  };

  const [commissionRates, setCommissionRates] = useState<Record<string, number>>(() => {
    try {
      const raw = localStorage.getItem("employee_commission_rates_v1");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [editingCommissionStaff, setEditingCommissionStaff] = useState<{
    id: string;
    name: string;
    rate: number;
  } | null>(null);

  const combinedSalaryRows = useMemo(() => {
    return (staffSalaryRows || []).map((row: any) => {
      // Find if this worker has any sales commission
      const rate = commissionRates[row.workerId] !== undefined ? commissionRates[row.workerId] : 1;
      
      // Calculate sales commission
      const employeeSales = salesData.filter((sale: any) => {
        // Match branch
        const saleBranch = sale.branchId || sale.branchid || "CN1";
        if (saleBranch !== currentBranchId) return false;
        
        // Match date
        const saleDate = new Date(sale.date);
        if (Number.isNaN(saleDate.getTime())) return false;
        if (saleDate.getMonth() + 1 !== salaryMonth || saleDate.getFullYear() !== salaryYear) return false;
        
        // Match employee
        const isMatchedId = sale.userId === row.workerId || sale.userid === row.workerId;
        const isMatchedName = String(sale.userName || sale.username || "").toLowerCase().trim() === String(row.workerName || "").toLowerCase().trim();
        return isMatchedId || isMatchedName;
      });

      const totalSalesRevenue = employeeSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
      const salesCommission = Math.round(totalSalesRevenue * (rate / 100));

      // Calculate combined bonus and final salary
      const combinedBonus = Number(row.bonus || 0) + salesCommission;
      const combinedFinalSalary = Number(row.finalSalary || 0) + salesCommission;

      return {
        ...row,
        // Override bonus and finalSalary to include sales commission!
        bonus: combinedBonus,
        finalSalary: combinedFinalSalary,
        salesCommission, // Store it just in case
      };
    });
  }, [staffSalaryRows, salesData, commissionRates, currentBranchId, salaryMonth, salaryYear]);

  const employeeSalesSummary = useMemo(() => {
    if (!salesData || !Array.isArray(salesData)) return [];

    const activeStaff = staffSalaryRows || [];

    return activeStaff.map((staff: any) => {
      // Filter sales sold by this employee in the current branch and month/year
      const employeeSales = salesData.filter((sale) => {
        // Match branch
        const saleBranch = sale.branchId || sale.branchid || "CN1";
        if (saleBranch !== currentBranchId) return false;
        
        // Match date
        const saleDate = new Date(sale.date);
        if (Number.isNaN(saleDate.getTime())) return false;
        if (saleDate.getMonth() + 1 !== salaryMonth || saleDate.getFullYear() !== salaryYear) return false;
        
        // Match employee (both ID or username as backup)
        const isMatchedId = sale.userId === staff.workerId || sale.userid === staff.workerId;
        const isMatchedName = String(sale.userName || sale.username || "").toLowerCase().trim() === String(staff.workerName || "").toLowerCase().trim();
        return isMatchedId || isMatchedName;
      });

      const totalSalesCount = employeeSales.length;
      const totalSalesRevenue = employeeSales.reduce((sum, sale) => sum + (Number(sale.total) || 0), 0);
      
      // Get custom commission rate for this employee, default to 1%
      const rate = commissionRates[staff.workerId] !== undefined ? commissionRates[staff.workerId] : 1;
      const suggestedCommission = Math.round(totalSalesRevenue * (rate / 100));

      return {
        employeeId: staff.workerId,
        employeeName: staff.workerName || "Nhân viên",
        totalSalesCount,
        totalSalesRevenue,
        commissionRate: rate,
        suggestedCommission,
      };
    }).filter((row: any) => row.totalSalesCount > 0); // Only show employees with sales in this month
  }, [salesData, staffSalaryRows, salaryMonth, salaryYear, currentBranchId, commissionRates]);

  return (
    <div className="space-y-6">
      {/* Bảng chi tiết lương */}
      <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-505/20 shadow-sm">
              <BriefcaseBusiness className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Bảng công sửa & lương nhân viên
            </h3>
          </div>
        </div>
        
        <div className="overflow-x-auto p-4 hidden md:block">
          {loadingSalaryRows && staffSalaryRows.length > 0 && (
            <div className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Đang cập nhật dữ liệu lương công sửa...
            </div>
          )}
          <table className="w-full min-w-[860px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Nhân viên
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Số công việc
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Tiền công được hưởng
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Lương cơ bản
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Thưởng
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Phạt
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Lương tạm tính
                </th>
                <th className="text-center py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Trạng thái
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody>
               {loadingSalaryRows && combinedSalaryRows.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Đang tính lương công sửa...
                  </td>
                </tr>
              )}
               {!loadingSalaryRows &&
                combinedSalaryRows.map((row: any) => (
                  <tr key={row.workerId} className="border-b border-slate-100 dark:border-white/5">
                    <td className="py-3 px-3 text-sm text-slate-800 dark:text-white">
                      <button
                        type="button"
                        onClick={() => handleOpenSalaryDetails(row)}
                        className="text-left text-blue-600 dark:text-cyan-300 hover:text-blue-500 dark:hover:text-cyan-200 underline-offset-2 hover:underline"
                      >
                        {row.workerName}
                      </button>
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-600 dark:text-slate-300">
                      {row.totalServiceCount}
                    </td>
                    <td className="py-3 px-3 text-sm text-right font-medium text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(Number(row.totalWorkerAmount || 0))} đ
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(Number(row.baseSalary || 0))} đ
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(Number(row.bonus || 0))} đ
                    </td>
                    <td className="py-3 px-3 text-sm text-right text-slate-600 dark:text-slate-300">
                      {formatCurrency(Number(row.penalty || 0))} đ
                    </td>
                    <td className="py-3 px-3 text-sm text-right font-semibold text-blue-600 dark:text-cyan-300">
                      {formatCurrency(Number(row.finalSalary || 0))} đ
                    </td>
                    <td className="py-3 px-3 text-sm text-center">
                      {(() => {
                        const paidRecord = getPaymentStatus(row.workerId);
                        if (paidRecord) {
                          return (
                            <span 
                              className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40" 
                              title={`Đã trả ngày ${new Date(paidRecord.paymentDate || '').toLocaleDateString('vi-VN')} qua ${paidRecord.paymentMethod === 'bank' ? 'Chuyển khoản' : 'Tiền mặt'}`}
                            >
                              Đã trả
                            </span>
                          );
                        }
                        return (
                          <button
                            type="button"
                            onClick={() => {
                              setPayingWorker(row);
                              setPayNotes(`Trả lương tháng ${salaryMonth}/${salaryYear}`);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold shadow-sm transition"
                          >
                            Trả lương
                          </button>
                        );
                      })()}
                    </td>
                    <td className="py-3 px-3 text-sm text-right">
                      <button
                        type="button"
                        onClick={() => setEditingBonusPenalty({ workerId: row.workerId, workerName: row.workerName, bonus: Number(row.bonus || 0), penalty: Number(row.penalty || 0) })}
                        className="text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 transition-colors p-1.5 rounded-md hover:bg-blue-50 dark:hover:bg-blue-900/30"
                        title="Chỉnh sửa thưởng/phạt"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              {!loadingSalaryRows && combinedSalaryRows.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Chưa có dữ liệu công sửa trong kỳ đã chọn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View inside PayrollReport */}
        <div className="mt-4 space-y-2.5 p-4 md:hidden">
          {loadingSalaryRows && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3 text-xs text-slate-500 dark:text-slate-400">
              Đang tính lương công sửa...
            </div>
          )}
           {!loadingSalaryRows &&
            combinedSalaryRows.map((row: any) => (
              <div
                key={row.workerId}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3"
              >
                <div className="flex justify-between items-start">
                  <button
                    type="button"
                    onClick={() => handleOpenSalaryDetails(row)}
                    className="text-sm font-semibold text-blue-600 dark:text-cyan-300 hover:text-blue-500 dark:hover:text-cyan-200"
                  >
                    {row.workerName}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingBonusPenalty({ workerId: row.workerId, workerName: row.workerName, bonus: Number(row.bonus || 0), penalty: Number(row.penalty || 0) })}
                    className="text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 p-1 rounded-md"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>
                </div>
                <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Số công việc</span>
                    <span>{row.totalServiceCount}</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Tiền công được hưởng</span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(Number(row.totalWorkerAmount || 0))} đ
                    </span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Lương cơ bản</span>
                    <span>{formatCurrency(Number(row.baseSalary || 0))} đ</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Thưởng</span>
                    <span>{formatCurrency(Number(row.bonus || 0))} đ</span>
                  </div>
                  <div className="flex justify-between gap-2">
                    <span className="text-slate-500 dark:text-slate-400">Phạt</span>
                    <span>{formatCurrency(Number(row.penalty || 0))} đ</span>
                  </div>
                  <div className="pt-1 flex justify-between gap-2 text-sm border-t border-slate-200 dark:border-white/10 mt-1">
                    <span className="text-slate-800 dark:text-slate-200 font-medium">Lương tạm tính</span>
                    <span className="font-semibold text-blue-600 dark:text-cyan-300">
                      {formatCurrency(Number(row.finalSalary || 0))} đ
                    </span>
                  </div>
                  <div className="pt-2 border-t border-dashed border-slate-200 dark:border-white/10 mt-1 flex justify-between items-center">
                    <span className="text-slate-500 dark:text-slate-400">Thanh toán</span>
                    {(() => {
                      const paidRecord = getPaymentStatus(row.workerId);
                      if (paidRecord) {
                        return (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/40">
                            Đã trả ({paidRecord.paymentMethod === 'bank' ? 'CK' : 'TM'})
                          </span>
                        );
                      }
                      return (
                        <button
                          type="button"
                          onClick={() => {
                            setPayingWorker(row);
                            setPayNotes(`Trả lương tháng ${salaryMonth}/${salaryYear}`);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-bold shadow-sm transition"
                        >
                          Trả lương
                        </button>
                      );
                    })()}
                  </div>
                </div>
              </div>
            ))}
          {!loadingSalaryRows && combinedSalaryRows.length === 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có dữ liệu công sửa trong kỳ đã chọn.
            </div>
          )}
        </div>
      </div>

      {/* Bảng báo cáo doanh số bán hàng của nhân viên */}
      <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 shadow-sm">
              <DollarSign className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Báo cáo doanh số bán hàng & Thưởng nhân viên
            </h3>
          </div>
        </div>

        {/* Desktop View */}
        <div className="overflow-x-auto p-4 hidden md:block">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-slate-200 dark:border-white/10">
                <th className="text-left py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Nhân viên
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Số đơn đã bán
                </th>
                <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Tổng doanh số (Doanh thu)
                </th>
                 <th className="text-right py-3 px-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
                  Thưởng gợi ý (Doanh số)
                </th>
              </tr>
            </thead>
            <tbody>
              {employeeSalesSummary.map((row: any) => (
                <tr key={row.employeeId} className="border-b border-slate-100 dark:border-white/5">
                  <td className="py-3 px-3 text-sm text-slate-800 dark:text-white font-medium">
                    {row.employeeName}
                  </td>
                  <td className="py-3 px-3 text-sm text-right text-slate-600 dark:text-slate-300">
                    {row.totalSalesCount}
                  </td>
                  <td className="py-3 px-3 text-sm text-right font-semibold text-blue-600 dark:text-cyan-300">
                    {formatCurrency(row.totalSalesRevenue)} đ
                  </td>
                   <td className="py-3 px-3 text-sm text-right font-semibold text-slate-700 dark:text-slate-200">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="text-emerald-600 dark:text-emerald-300">
                        {formatCurrency(row.suggestedCommission)} đ
                      </span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        ({row.commissionRate}%)
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingCommissionStaff({
                          id: row.employeeId,
                          name: row.employeeName,
                          rate: row.commissionRate,
                        })}
                        className="text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                        title="Sửa % hoa hồng"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {employeeSalesSummary.length === 0 && (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Chưa có doanh số bán hàng trong kỳ đã chọn.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View */}
        <div className="mt-4 space-y-2.5 p-4 md:hidden">
          {employeeSalesSummary.map((row: any) => (
            <div
              key={row.employeeId}
              className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3"
            >
              <div className="text-sm font-semibold text-slate-800 dark:text-white">
                {row.employeeName}
              </div>
              <div className="mt-2 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Số đơn đã bán</span>
                  <span>{row.totalSalesCount}</span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Tổng doanh số</span>
                  <span className="font-semibold text-blue-600 dark:text-cyan-300">
                    {formatCurrency(row.totalSalesRevenue)} đ
                  </span>
                </div>
                 <div className="flex justify-between gap-2">
                  <span className="text-slate-500 dark:text-slate-400">Thưởng gợi ý ({row.commissionRate}%)</span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-emerald-600 dark:text-emerald-300">
                      {formatCurrency(row.suggestedCommission)} đ
                    </span>
                    <button
                      type="button"
                      onClick={() => setEditingCommissionStaff({
                        id: row.employeeId,
                        name: row.employeeName,
                        rate: row.commissionRate,
                      })}
                      className="text-slate-400 hover:text-blue-600 dark:hover:text-cyan-400 p-0.5 rounded"
                      title="Sửa % hoa hồng"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
          {employeeSalesSummary.length === 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có doanh số bán hàng trong kỳ đã chọn.
            </div>
          )}
        </div>
      </div>

      {/* Edit Bonus/Penalty Modal */}
      {editingBonusPenalty && (
        <div className="fixed inset-0 z-[90] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Thưởng / Phạt
              </h3>
              <button
                type="button"
                onClick={() => setEditingBonusPenalty(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">
                  Nhân viên: <span className="text-blue-600 dark:text-cyan-400">{editingBonusPenalty.workerName}</span>
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tiền thưởng (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={editingBonusPenalty.bonus || ""}
                      onChange={(e) => setEditingBonusPenalty({ ...editingBonusPenalty, bonus: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 dark:focus:border-cyan-400 outline-none text-slate-900 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Tiền phạt (VNĐ)
                    </label>
                    <input
                      type="number"
                      value={editingBonusPenalty.penalty || ""}
                      onChange={(e) => setEditingBonusPenalty({ ...editingBonusPenalty, penalty: Number(e.target.value) })}
                      className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 dark:focus:border-cyan-400 outline-none text-slate-900 dark:text-white"
                      placeholder="0"
                    />
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    const success = await handleSaveBonusPenalty(
                      editingBonusPenalty.workerId,
                      editingBonusPenalty.bonus || 0,
                      editingBonusPenalty.penalty || 0
                    );
                    if (success) {
                      setEditingBonusPenalty(null);
                    }
                  }}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Lưu thay đổi
                </button>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Chi tiết Modal */}
      {selectedSalaryWorker && (
        <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-4 py-4 border-b border-slate-200 dark:border-slate-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                  Chi tiết công sửa - {selectedSalaryWorker.workerName}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Kỳ lương: Tháng {salaryMonth}/{salaryYear}
                </p>
              </div>
              <div className="flex items-center gap-2 self-end sm:self-auto">
                <button
                  type="button"
                  onClick={handleExportSalaryDetailsExcel}
                  className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                >
                  Xuất Excel
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSalaryWorker(null)}
                  className="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                  aria-label="Đóng"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4 overflow-auto max-h-[calc(85vh-74px)]">
              {loadingSalaryDetails ? (
                <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Đang tải chi tiết công sửa...
                </div>
              ) : (
                <>
                  <table className="hidden md:table w-full min-w-[920px]">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                        <th className="text-left py-2 px-2">Thời gian</th>
                        <th className="text-left py-2 px-2">Mã phiếu</th>
                        <th className="text-left py-2 px-2">Khách hàng / Thiết bị</th>
                        <th className="text-left py-2 px-2">Hạng mục</th>
                        <th className="text-left py-2 px-2">Nguồn công</th>
                        <th className="text-right py-2 px-2">Tiền công</th>
                      </tr>
                    </thead>
                    <tbody>
                      {salaryDetailRows.map((detail: any, index: number) => (
                        <tr key={`${detail.workOrderId}-${index}`} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                          <td className="py-2 px-2 text-sm text-slate-700 dark:text-slate-200">
                            {formatDateTime(detail.date)}
                          </td>
                          <td className="py-2 px-2 text-sm text-blue-600 dark:text-cyan-300 font-mono">
                            {detail.workOrderId}
                          </td>
                          <td className="py-2 px-2 text-sm text-slate-700 dark:text-slate-200">
                            <div>{detail.customerName || "Khách lẻ"}</div>
                            <div className="text-xs text-slate-500 dark:text-slate-400">{detail.vehicleModel || "--"}</div>
                          </td>
                          <td className="py-2 px-2 text-sm text-slate-700 dark:text-slate-200">
                            {detail.serviceName || "Tiền công phiếu"}
                          </td>
                          <td className="py-2 px-2 text-sm text-slate-600 dark:text-slate-300">
                            {detail.type === "service_split" ? "Chia công dịch vụ" : "Tiền công theo phiếu"}
                          </td>
                          <td className="py-2 px-2 text-sm text-right font-semibold text-emerald-600 dark:text-emerald-300">
                            {formatCurrency(detail.amount)} đ
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="space-y-2.5 md:hidden">
                    {salaryDetailRows.map((detail: any, index: number) => (
                      <div
                        key={`${detail.workOrderId}-${index}`}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {formatDateTime(detail.date)}
                          </div>
                          <div className="text-xs font-mono text-blue-600 dark:text-cyan-300">
                            {detail.workOrderId}
                          </div>
                        </div>
                        <div className="mt-1 text-sm text-slate-800 dark:text-slate-100 font-medium">
                          {detail.customerName || "Khách lẻ"}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {detail.vehicleModel || "--"}
                        </div>
                        <div className="mt-2 text-xs text-slate-600 dark:text-slate-300">
                          Hạng mục: {detail.serviceName || "Tiền công phiếu"}
                        </div>
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          Nguồn: {detail.type === "service_split" ? "Chia công dịch vụ" : "Tiền công theo phiếu"}
                        </div>
                        <div className="mt-2 text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                          {formatCurrency(detail.amount)} đ
                        </div>
                      </div>
                    ))}
                  </div>

                  {salaryDetailRows.length === 0 && (
                    <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Không có dòng công nào trong kỳ này.
                    </div>
                  )}

                  {salaryDetailRows.length > 0 && (
                    <div className="mt-4 flex justify-end">
                      <div className="rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 px-4 py-2 text-sm text-slate-800 dark:text-slate-200">
                        Tổng tiền công: <span className="font-semibold text-emerald-600 dark:text-emerald-300">{formatCurrency(salaryDetailRows.reduce((sum: number, item: any) => sum + Number(item.amount || 0), 0))} đ</span>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
      {/* Modal chỉnh sửa % hoa hồng */}
      {editingCommissionStaff && (
        <div className="fixed inset-0 z-[95] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Cấu hình tỷ lệ hoa hồng
              </h3>
              <button
                type="button"
                onClick={() => setEditingCommissionStaff(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200 mb-4">
                  Nhân viên: <span className="text-blue-600 dark:text-cyan-400">{editingCommissionStaff.name}</span>
                </p>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Tỷ lệ thưởng (% doanh số bán hàng)
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={editingCommissionStaff.rate}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditingCommissionStaff({
                          ...editingCommissionStaff,
                          rate: val === "" ? 0 : Number(val),
                        });
                      }}
                      className="w-full h-10 pl-3 pr-8 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 dark:focus:border-cyan-400 outline-none text-slate-900 dark:text-white"
                      placeholder="1"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-slate-400 font-medium">
                      %
                    </span>
                  </div>
                </div>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    const newRates = {
                      ...commissionRates,
                      [editingCommissionStaff.id]: editingCommissionStaff.rate,
                    };
                    setCommissionRates(newRates);
                    localStorage.setItem("employee_commission_rates_v1", JSON.stringify(newRates));
                    setEditingCommissionStaff(null);
                  }}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Lưu thiết lập
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Modal Thanh toán lương */}
      {payingWorker && (
        <div className="fixed inset-0 z-[95] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Thanh toán lương nhân viên
              </h3>
              <button
                type="button"
                onClick={() => setPayingWorker(null)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Nhân viên: <span className="text-blue-600 dark:text-cyan-400 font-bold">{payingWorker.workerName}</span>
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Kỳ lương: Tháng {salaryMonth}/{salaryYear}
                </p>
              </div>

              <div className="border-t border-b border-slate-100 dark:border-slate-800 py-3 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Lương cơ bản:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(payingWorker.baseSalary || 0)} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Tiền công được hưởng:</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(payingWorker.totalWorkerAmount || 0)} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Thưởng:</span>
                  <span className="font-medium text-emerald-600 dark:text-emerald-400">+{formatCurrency(payingWorker.bonus || 0)} đ</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Phạt:</span>
                  <span className="font-medium text-rose-600 dark:text-rose-400">-{formatCurrency(payingWorker.penalty || 0)} đ</span>
                </div>
                <div className="flex justify-between text-sm font-bold pt-1 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-slate-800 dark:text-slate-200">Tổng thực nhận:</span>
                  <span className="text-blue-600 dark:text-cyan-400">{formatCurrency(payingWorker.finalSalary || 0)} đ</span>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Hình thức thanh toán
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPayMethod("cash")}
                      className={`h-10 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${
                        payMethod === "cash"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                    >
                      Tiền mặt
                    </button>
                    <button
                      type="button"
                      onClick={() => setPayMethod("bank")}
                      className={`h-10 rounded-xl border text-xs font-semibold flex items-center justify-center transition-all ${
                        payMethod === "bank"
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "border-slate-200 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
                      }`}
                    >
                      Chuyển khoản
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Ghi chú thanh toán
                  </label>
                  <input
                    type="text"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 dark:focus:border-cyan-400 outline-none text-slate-900 dark:text-white"
                    placeholder={`Trả lương tháng ${salaryMonth}/${salaryYear}`}
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={async () => {
                    await handlePaySalary(payingWorker, payMethod, payNotes);
                    setPayingWorker(null);
                  }}
                  className="w-full h-10 flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition-colors shadow-sm"
                >
                  <Save className="w-4 h-4" />
                  Xác nhận trả lương
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
