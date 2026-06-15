import React from "react";
import { Users, Building, DollarSign, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

interface DebtReportProps {
  debtReport: {
    totalCustomerDebt: number;
    totalSupplierDebt: number;
    netDebt: number;
    customerDebts: any[];
    supplierDebts: any[];
  };
}

export const DebtReport: React.FC<DebtReportProps> = ({ debtReport }) => {
  return (
    <div className="space-y-6">
      {/* Thống kê tổng quan - 3 cards ngang */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Nợ khách hàng */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Phải thu khách hàng
            </span>
            <div className="p-2.5 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-505/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 leading-none font-mono tracking-tight">
            {formatCurrency(debtReport.totalCustomerDebt)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Lũy kế nợ từ tất cả người mua hàng <br/>
            ({debtReport.customerDebts.length} khách hàng phát sinh công nợ)
          </div>
        </div>

        {/* Card 2: Nợ nhà cung cấp */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Phải trả nhà cung cấp
            </span>
            <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100 dark:border-rose-505/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Building className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono tracking-tight">
            {formatCurrency(debtReport.totalSupplierDebt)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Lũy kế nợ nhập kho đối với đối tác <br/>
            ({debtReport.supplierDebts.length} nhà cung cấp phát sinh công nợ)
          </div>
        </div>

        {/* Card 3: Công nợ ròng */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm hover:shadow-md dark:shadow-[0_8px_30px_rgba(0,0,0,0.25)] dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Dư nợ ròng
            </span>
            <div className="p-2.5 rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-505/20 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none font-mono tracking-tight">
            {formatCurrency(debtReport.netDebt)}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-100 dark:border-slate-800 pt-2.5">
            Chênh lệch Phải thu - Phải trả <br/>
            (Số tiền thực thu về sau khi cấn trừ nợ NCC)
          </div>
        </div>
      </div>

      {/* Hai cột danh sách công nợ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Phải thu khách hàng */}
        <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm dark:shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-505/20 shadow-sm">
              <Users className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Phải thu khách hàng
            </h3>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {debtReport.customerDebts.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-505/20 shadow-sm mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-black uppercase text-slate-505 dark:text-slate-400 tracking-wider">
                  Không phát sinh công nợ
                </p>
              </div>
            ) : (
              debtReport.customerDebts.map((customer, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/20 rounded-xl transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-xs font-black text-slate-650 dark:text-slate-300">
                      {(customer.name || "K").charAt(0).toUpperCase()}
                    </div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                      {customer.name}
                    </span>
                  </div>
                  <span className="text-emerald-600 dark:text-emerald-400 font-mono font-black text-xs">
                    {formatCurrency(customer.debt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Phải trả nhà cung cấp */}
        <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl p-5 shadow-sm dark:shadow-2xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-100 dark:border-rose-505/20 shadow-sm">
              <Building className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Phải trả nhà cung cấp
            </h3>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {debtReport.supplierDebts.length === 0 ? (
              <div className="text-center py-10">
                <div className="inline-flex p-3 rounded-2xl bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-505/20 shadow-sm mb-3">
                  <CheckCircle2 className="w-6 h-6" />
                </div>
                <p className="text-xs font-black uppercase text-slate-550 dark:text-slate-400 tracking-wider">
                  Không phát sinh công nợ
                </p>
              </div>
            ) : (
              debtReport.supplierDebts.map((supplier, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700/40 hover:bg-slate-100/80 dark:hover:bg-slate-800/20 rounded-xl transition-all duration-300 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700/50 flex items-center justify-center text-xs font-black text-slate-650 dark:text-slate-300">
                      {(supplier.name || "N").charAt(0).toUpperCase()}
                    </div>
                    <span className="font-extrabold text-slate-800 dark:text-slate-200 text-xs">
                      {supplier.name}
                    </span>
                  </div>
                  <span className="text-rose-600 dark:text-rose-400 font-mono font-black text-xs">
                    {formatCurrency(supplier.debt)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
