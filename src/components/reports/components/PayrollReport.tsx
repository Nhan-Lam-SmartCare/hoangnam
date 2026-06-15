import React from "react";
import { DollarSign, Check, Clock, BriefcaseBusiness } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

interface PayrollReportProps {
  payrollReport: {
    totalSalary: number;
    paidSalary: number;
    unpaidSalary: number;
    employeeCount: number;
    records: any[];
  };
  employees: any[];
}

export const PayrollReport: React.FC<PayrollReportProps> = ({
  payrollReport,
  employees,
}) => {
  return (
    <div className="space-y-6">
      {/* Thống kê cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Card 1: Tổng lương */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Tổng quỹ lương
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none font-mono tracking-tight transition-colors">
            {formatCurrency(payrollReport.totalSalary).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Tổng lương thực nhận của nhân viên <br/>
            (Bao gồm lương cứng + hoa hồng thưởng)
          </div>
        </div>

        {/* Card 2: Đã thanh toán */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Đã thanh toán
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-500/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Check className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono tracking-tight">
            {formatCurrency(payrollReport.paidSalary).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Khoản quỹ lương đã được chi trả <br/>
            hoàn tất và ghi nhận vào sổ quỹ
          </div>
        </div>

        {/* Card 3: Chưa thanh toán */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Lương còn nợ
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100 dark:border-rose-505/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono tracking-tight">
            {formatCurrency(payrollReport.unpaidSalary).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Khoản quỹ lương chưa được chi trả <br/>
            (Tính lũy kế đến kỳ hiện tại)
          </div>
        </div>

        {/* Card 4: Số nhân viên */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Tổng số nhân viên
            </span>
            <div className="p-2.5 rounded-xl bg-purple-50 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400 border border-purple-100 dark:border-purple-500/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <BriefcaseBusiness className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 leading-none font-mono tracking-tight">
            {payrollReport.employeeCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Số nhân sự phát sinh ghi nhận công <br/>
            và lương trong khoảng thời gian lọc
          </div>
        </div>
      </div>

      {/* Bảng chi tiết lương */}
      <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-400 border border-violet-100 dark:border-violet-505/20 shadow-sm">
              <BriefcaseBusiness className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Chi tiết lương nhân viên
            </h3>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
                  Tháng
                </th>
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
                  Nhân viên
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-44">
                  Lương thực nhận
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-36">
                  Trạng thái
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {payrollReport.records.map((record) => {
                const employee = employees.find((e) => e.id === record.employeeId);
                const isPaid = record.paymentStatus === "paid";
                return (
                  <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-semibold">
                      {record.month}
                    </td>
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-200 font-extrabold">
                      {record.employeeName || employee?.name || "N/A"}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-800 dark:text-slate-300 font-mono text-sm">
                      {formatCurrency(record.netSalary)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase border tracking-wider ${
                          isPaid
                            ? "bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-505/20 shadow-sm dark:shadow-[0_0_12px_rgba(16,185,129,0.15)]"
                            : "bg-amber-50 text-amber-600 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-505/20 shadow-sm dark:shadow-[0_0_12px_rgba(245,158,11,0.15)]"
                        }`}
                      >
                        <span
                          className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 animate-pulse ${
                            isPaid ? "bg-emerald-500 dark:bg-emerald-400" : "bg-amber-500 dark:bg-amber-400"
                          }`}
                        />
                        {isPaid ? "Đã trả" : "Chưa trả"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
