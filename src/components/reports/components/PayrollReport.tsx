import React from "react";
import { BriefcaseBusiness, X } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

interface PayrollReportProps {
  salaryReportProps: any;
  employees: any[];
  salaryMonth: number;
  salaryYear: number;
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
}) => {
  const {
    staffSalaryRows,
    loadingSalaryRows,
    selectedSalaryWorker,
    setSelectedSalaryWorker,
    salaryDetailRows,
    loadingSalaryDetails,
    handleOpenSalaryDetails,
    handleExportSalaryDetailsExcel,
  } = salaryReportProps;

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
              </tr>
            </thead>
            <tbody>
              {loadingSalaryRows && staffSalaryRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
                    Đang tính lương công sửa...
                  </td>
                </tr>
              )}
              {!loadingSalaryRows &&
                staffSalaryRows.map((row: any) => (
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
                  </tr>
                ))}
              {!loadingSalaryRows && staffSalaryRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">
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
            staffSalaryRows.map((row: any) => (
              <div
                key={row.workerId}
                className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3"
              >
                <button
                  type="button"
                  onClick={() => handleOpenSalaryDetails(row)}
                  className="text-sm font-semibold text-blue-600 dark:text-cyan-300 hover:text-blue-500 dark:hover:text-cyan-200"
                >
                  {row.workerName}
                </button>
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
                </div>
              </div>
            ))}
          {!loadingSalaryRows && staffSalaryRows.length === 0 && (
            <div className="rounded-xl border border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-slate-900/40 p-3 text-center text-xs text-slate-500 dark:text-slate-400">
              Chưa có dữ liệu công sửa trong kỳ đã chọn.
            </div>
          )}
        </div>
      </div>

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
    </div>
  );
};
