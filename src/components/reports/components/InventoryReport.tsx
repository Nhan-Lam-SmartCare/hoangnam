import React from "react";
import { Boxes, Tag, AlertTriangle } from "lucide-react";
import { formatCurrency } from "../../../utils/format";

interface InventoryReportProps {
  partsLoading: boolean;
  inventoryReport: {
    totalValue: number;
    lowStockCount: number;
    lowStockItems: any[];
    parts: any[];
  };
}

export const InventoryReport: React.FC<InventoryReportProps> = ({
  partsLoading,
  inventoryReport,
}) => {
  return (
    <div className="space-y-6">
      {partsLoading && (
        <div className="text-sm text-slate-505 dark:text-slate-400">
          Đang tải tồn kho...
        </div>
      )}
      {/* Thống kê cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Tổng giá trị tồn */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Tổng giá trị tồn kho
            </span>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 shadow-[0_0_15px_rgba(59,130,246,0.15)] group-hover:scale-110 transition-transform duration-300">
              <Boxes className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-blue-600 dark:text-blue-400 leading-none font-mono tracking-tight transition-colors">
            {formatCurrency(inventoryReport.totalValue).replace("₫", "")}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Tính theo giá bán lẻ hiện hành <br/>
            (Giá trị hàng hóa sẵn có tại kho chi nhánh)
          </div>
        </div>

        {/* Card 2: Tổng sản phẩm */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Tổng danh mục sản phẩm
            </span>
            <div className="p-2.5 rounded-xl bg-purple-505/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 shadow-[0_0_15px_rgba(168,85,247,0.15)] group-hover:scale-110 transition-transform duration-300">
              <Tag className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400 leading-none font-mono tracking-tight transition-colors">
            {inventoryReport.parts.length}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Số lượng mã sản phẩm khác nhau <br/>
            đang có hồ sơ lưu trữ và kiểm soát kho
          </div>
        </div>

        {/* Card 3: Sản phẩm sắp hết */}
        <div className="bg-white dark:bg-slate-800/90 backdrop-blur-xl border border-slate-200 dark:border-slate-700/80 hover:border-slate-350 dark:hover:border-slate-600/80 shadow-sm dark:shadow-[0_8px_30px_rgba(0,0,0,0.2)] hover:shadow-md dark:hover:shadow-[0_15px_45px_rgba(0,0,0,0.4)] transition-all duration-300 rounded-2xl p-5 relative overflow-hidden group">
          <div className="flex items-center justify-between mb-4">
            <span className="text-[11px] font-black uppercase tracking-wider text-slate-550 dark:text-slate-300">
              Sản phẩm sắp hết hàng
            </span>
            <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.15)] group-hover:scale-110 transition-transform duration-300">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-rose-600 dark:text-rose-400 leading-none font-mono tracking-tight">
            {inventoryReport.lowStockCount}
          </div>
          <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-3 leading-relaxed border-t border-slate-200 dark:border-slate-700 pt-2.5">
            Số lượng mã hàng sắp hết hàng <br/>
            (Có tồn kho thực tế dưới 10 cái)
          </div>
        </div>
      </div>

      {inventoryReport.lowStockCount > 0 && (
        <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl mt-6">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 shadow-[0_0_15px_rgba(244,63,94,0.2)] animate-pulse">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
                Cảnh báo hàng sắp hết
              </h3>
              <span className="px-2.5 py-0.5 bg-rose-50 text-rose-600 dark:bg-rose-500/20 dark:text-rose-400 text-[10px] font-black uppercase rounded-full border border-rose-100 dark:border-rose-505/30">
                {inventoryReport.lowStockCount} sản phẩm
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/40">
                  <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
                    Sản phẩm
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-32">
                    Tồn kho
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-40">
                    Đơn giá bán lẻ
                  </th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-44">
                    Tổng giá trị tồn
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
                {inventoryReport.lowStockItems.map((part) => (
                  <tr key={part.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                    <td className="px-4 py-3 text-slate-800 dark:text-slate-300 font-extrabold">
                      {part.name}
                    </td>
                    <td className="px-4 py-3 text-right text-rose-600 dark:text-rose-400 font-black font-mono">
                      {part.stock}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono font-semibold">
                      {formatCurrency(part.price)}
                    </td>
                    <td className="px-4 py-3 text-right font-black text-slate-700 dark:text-slate-300 font-mono">
                      {formatCurrency(part.value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Danh sách toàn bộ tồn kho */}
      <div className="bg-white/80 dark:bg-[#0D121F]/60 backdrop-blur-md border border-slate-200 dark:border-slate-800/80 rounded-2xl overflow-hidden shadow-sm dark:shadow-2xl">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-505/20 shadow-sm">
              <Boxes className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-black text-slate-800 dark:text-slate-200 tracking-wide uppercase">
              Danh sách tồn kho
            </h3>
            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400 text-[10px] font-black uppercase rounded-full border border-blue-100 dark:border-blue-505/30">
              {inventoryReport.parts.length} sản phẩm
            </span>
          </div>
          <div className="text-[10px] text-slate-550 dark:text-slate-500 hidden sm:block italic">
            Đỏ: Sắp hết · Vàng: Ít hàng · Xanh: Đủ hàng
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700/70 bg-slate-50 dark:bg-slate-800/40">
                <th className="px-4 py-3 text-left text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider">
                  Tên sản phẩm
                </th>
                <th className="px-4 py-3 text-center text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-28">
                  Tồn kho
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-40">
                  Đơn giá bán lẻ
                </th>
                <th className="px-4 py-3 text-right text-[10px] font-bold text-slate-550 dark:text-slate-400 uppercase tracking-wider w-44">
                  Tổng giá trị tồn
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800/60">
              {inventoryReport.parts
                .slice()
                .sort((a: any, b: any) => a.stock - b.stock)
                .map((part: any) => {
                  const isLow = part.stock < 5;
                  const isWarning = part.stock >= 5 && part.stock < 10;
                  const stockColorClass = isLow
                    ? "text-rose-600 dark:text-rose-400 font-black"
                    : isWarning
                    ? "text-amber-600 dark:text-amber-400 font-black"
                    : "text-emerald-600 dark:text-emerald-400 font-semibold";
                  const dotColor = isLow
                    ? "bg-rose-500 dark:bg-rose-400 animate-pulse"
                    : isWarning
                    ? "bg-amber-500 dark:bg-amber-400"
                    : "bg-emerald-500/60 dark:bg-emerald-400/60";
                  return (
                    <tr key={part.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dotColor}`} />
                          <span className="text-slate-800 dark:text-slate-200 font-semibold">{part.name}</span>
                        </div>
                      </td>
                      <td className={`px-4 py-3 text-center font-mono ${stockColorClass}`}>
                        {part.stock}
                      </td>
                      <td className="px-4 py-3 text-right text-slate-500 dark:text-slate-400 font-mono">
                        {formatCurrency(part.price)}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 dark:text-slate-300 font-mono">
                        {formatCurrency(part.value)}
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
