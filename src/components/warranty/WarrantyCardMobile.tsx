import React from "react";
import { Smartphone, Printer, Wrench, MoreVertical, Calendar } from "lucide-react";
import { type WarrantyCard } from "../../hooks/useWarrantyRepository";
import { formatDate } from "../../utils/format";

interface WarrantyCardProps {
    card: WarrantyCard;
    quantity?: number;
    canCreateClaim: boolean;
    canManageClaim: boolean;
    canDeleteCard: boolean;
    activeDropdownId: string | null;
    setActiveDropdownId: (id: string | null) => void;
    onPrint: (card: WarrantyCard) => void;
    onClaim: (card: WarrantyCard) => void;
    onVoid: (id: string) => Promise<void>;
    onDelete: (id: string) => Promise<void>;
    getStatusBadge: (status: string, endDate: string) => React.ReactNode;
}

export const WarrantyCardMobile: React.FC<WarrantyCardProps> = ({
    card,
    quantity = 1,
    canCreateClaim,
    canManageClaim,
    canDeleteCard,
    activeDropdownId,
    setActiveDropdownId,
    onPrint,
    onClaim,
    onVoid,
    onDelete,
    getStatusBadge,
}) => {
    const getDaysRemaining = (endDate: string) => {
        const days = Math.ceil((new Date(endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
        return days > 0 ? days : 0;
    };

    const daysRemaining = getDaysRemaining(card.warranty_end_date);

    // Calculate percentage of remaining time
    const startDate = card.warranty_start_date ? new Date(card.warranty_start_date) : null;
    const endDate = new Date(card.warranty_end_date);
    const totalMs = startDate ? endDate.getTime() - startDate.getTime() : (card.warranty_period_months * 30 * 24 * 60 * 60 * 1000);
    const totalDays = Math.max(1, Math.ceil(totalMs / (1000 * 60 * 60 * 24)));
    const percentRemaining = Math.max(0, Math.min(100, Math.round((daysRemaining / totalDays) * 100)));

    return (
        <div
            className={`glass-card-premium rounded-2xl p-4 sm:p-5 border border-slate-200/50 dark:border-slate-700/60 shadow-md relative overflow-visible transition-all duration-300 hover:border-emerald-500/40 dark:hover:border-emerald-450/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:scale-[0.99] ${
                activeDropdownId === card.id ? "z-30" : "z-10"
            }`}
        >
            {/* Subtle top indicator line */}
            <div className={`absolute top-0 left-0 w-full h-[3px] ${
                card.status === "voided"
                    ? "bg-slate-400 dark:bg-slate-600"
                    : daysRemaining === 0
                        ? "bg-gradient-to-r from-rose-500 to-red-650"
                        : daysRemaining <= 30
                            ? "bg-gradient-to-r from-amber-400 to-orange-500"
                            : "bg-gradient-to-r from-emerald-400 to-teal-500"
            }`} />

            {/* Header Row: Smartphone icon + Title & IMEI next to each other */}
            <div className="flex items-center gap-2.5 sm:gap-3.5 mb-3 sm:mb-4">
                <div className="w-9 h-9 sm:w-11 sm:h-11 shrink-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-500/20 dark:border-emerald-500/30 rounded-xl sm:rounded-2xl flex items-center justify-center shadow-inner">
                    <Smartphone className="w-5 h-5 sm:w-5.5 sm:h-5.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1">
                        <h3 className="font-extrabold text-slate-900 dark:text-white text-sm sm:text-base truncate max-w-[140px] sm:max-w-xs leading-snug">
                             {card.device_model}
                        </h3>
                        {quantity > 1 && (
                            <span className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[9px] font-bold">
                                x{quantity}
                            </span>
                        )}
                        {getStatusBadge(card.status, card.warranty_end_date)}
                    </div>
                    <div className="text-[10px] sm:text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1">
                        <span className="uppercase tracking-wider text-[8px] sm:text-[9px]">IMEI:</span> 
                        <span className="font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-1.5 py-0.5 rounded border border-slate-200/50 dark:border-slate-700/60 truncate max-w-[120px]">{card.imei_serial || "N/A"}</span>
                    </div>
                </div>
            </div>

            {/* Content Rows: Spans 100% full width under the header */}
            <div className="space-y-3 sm:space-y-4">
                {/* Dải Timeline hiển thị Ngày mua ➔ Hết hạn */}
                <div className="flex items-center justify-between w-full relative px-2.5 py-2 sm:px-3.5 sm:py-3 bg-slate-100/60 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800/90 rounded-xl">
                    <div className="flex flex-col items-start gap-0.5">
                        <div className="text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Kích hoạt</div>
                        <div className="flex items-center gap-1 text-slate-900 dark:text-slate-100 font-extrabold text-[11px] sm:text-[13px]">
                            <Calendar className="w-3 h-3 text-emerald-500 shrink-0" />
                            {card.warranty_start_date ? formatDate(card.warranty_start_date) : "N/A"}
                        </div>
                    </div>
                    {/* Connecting Line */}
                    <div className="flex-1 flex items-center justify-center px-2 sm:px-4 relative">
                        <div className="w-full border-t border-dashed border-slate-300 dark:border-slate-700 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded-full text-[8px] sm:text-[9px] font-extrabold text-slate-500 dark:text-slate-400 uppercase tracking-widest shrink-0">
                                {card.warranty_period_months}T
                            </div>
                        </div>
                    </div>
                    <div className="flex flex-col items-end gap-0.5">
                        <div className="text-[8px] sm:text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">Hết hạn</div>
                        <div className="flex items-center gap-1 text-slate-900 dark:text-slate-100 font-extrabold text-[11px] sm:text-[13px]">
                            <Calendar className="w-3 h-3 text-rose-500 shrink-0" />
                            {formatDate(card.warranty_end_date)}
                        </div>
                    </div>
                </div>

                {/* Progress bar representing remaining days */}
                <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold">
                        <div className="flex items-center gap-1">
                            <span className="text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider text-[9px] sm:text-[10px]">Hạn:</span>
                            <span className={`text-[10px] sm:text-[11px] font-extrabold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                                card.status === "voided" 
                                    ? "bg-slate-100 text-slate-650 dark:bg-slate-800/80 dark:text-slate-400" 
                                    : daysRemaining === 0 
                                        ? "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400"
                                        : daysRemaining <= 30
                                            ? "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"
                                            : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400"
                            }`}>
                                {card.status === "voided" 
                                    ? "Đã vô hiệu" 
                                    : daysRemaining === 0 
                                        ? "Đã hết hạn" 
                                        : daysRemaining <= 30
                                            ? `Còn ${daysRemaining} ngày`
                                            : `Còn ${daysRemaining} ngày`
                                }
                            </span>
                        </div>
                        <span className={`text-[11px] sm:text-xs font-black ${
                            card.status === "voided" 
                                ? "text-slate-400 dark:text-slate-500" 
                                : daysRemaining === 0 
                                    ? "text-rose-500"
                                    : daysRemaining <= 30
                                        ? "text-amber-500"
                                        : "text-emerald-500"
                        }`}>
                            {card.status === "voided" ? "0" : percentRemaining}%
                        </span>
                    </div>
                    {/* Thin Progress bar with neon glow */}
                    <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/20 dark:border-slate-700/50">
                        <div
                            style={{ width: `${card.status === "voided" ? 0 : percentRemaining}%` }}
                            className={`h-full rounded-full transition-all duration-500 ${
                                card.status === "voided"
                                    ? "bg-slate-400 dark:bg-slate-600"
                                    : daysRemaining === 0
                                        ? "bg-gradient-to-r from-rose-500 to-red-650"
                                        : daysRemaining <= 30
                                            ? "bg-gradient-to-r from-amber-400 to-orange-500 shadow-[0_0_10px_rgba(245,158,11,0.4)]"
                                            : "bg-gradient-to-r from-emerald-400 to-teal-500 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                            }`}
                        />
                    </div>
                </div>

                {card.covered_parts && card.covered_parts.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 text-[11px] sm:text-xs font-semibold pt-0.5">
                        <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Phạm vi:</span>
                        {card.covered_parts.map((part: string, idx: number) => (
                            <span key={idx} className="px-1.5 py-0.5 bg-blue-50/50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 rounded-md text-[10px] font-semibold">
                                {part}
                            </span>
                        ))}
                    </div>
                )}

                {/* Mobile action buttons spanning 100% full width */}
                <div className="flex items-center gap-2 border-t border-slate-100 dark:border-slate-800/60 pt-3 w-full">
                    <button
                        onClick={() => onPrint(card)}
                        className="flex-1 h-9 sm:h-11 px-3 sm:px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-slate-200/40 dark:border-slate-700/60 shadow-sm active:scale-95"
                    >
                        <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>In phiếu</span>
                    </button>
                    <button
                        onClick={() => onClaim(card)}
                        disabled={!canCreateClaim}
                        className="flex-1 h-9 sm:h-11 px-3 sm:px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs font-bold flex items-center justify-center gap-1.5 transition-all border border-emerald-500/20 dark:border-emerald-400/30 shadow-sm active:scale-95 disabled:opacity-40"
                    >
                        <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> <span>Tiếp nhận</span>
                    </button>
                    
                    <div className="relative w-9 sm:w-11 shrink-0">
                        <button
                            onClick={() => setActiveDropdownId(activeDropdownId === card.id ? null : card.id)}
                            className="h-9 w-9 sm:h-11 sm:w-11 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/40 dark:border-slate-700/50 active:scale-95 shadow-sm"
                        >
                            <MoreVertical className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        </button>

                        {activeDropdownId === card.id && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveDropdownId(null)}
                                />
                                <div className="absolute right-0 mt-2 w-40 bg-white/95 dark:bg-[#1e1e2d]/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/80 z-50 overflow-hidden animate-scaleIn">
                                    {card.status !== "voided" && (
                                        <button
                                            onClick={() => {
                                                setActiveDropdownId(null);
                                                onVoid(card.id);
                                            }}
                                            disabled={!canManageClaim}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                                        >
                                            Vô hiệu phiếu
                                        </button>
                                    )}
                                    {canDeleteCard && (
                                        <button
                                            onClick={() => {
                                                setActiveDropdownId(null);
                                                onDelete(card.id);
                                            }}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-red-650 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                                        >
                                            Xóa phiếu
                                        </button>
                                    )}
                                    {(card.status === "voided" && !canDeleteCard) && (
                                        <div className="px-4 py-2.5 text-xs text-slate-400">Không có quyền thao tác</div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
