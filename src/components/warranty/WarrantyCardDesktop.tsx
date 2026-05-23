import React from "react";
import { Smartphone, Printer, Wrench, MoreVertical } from "lucide-react";
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
    onVoid: (id: string) => Promise<void> | void;
    onDelete: (id: string) => Promise<void> | void;
    getStatusBadge: (status: string, endDate: string) => React.ReactNode;
}

export const WarrantyCardDesktop: React.FC<WarrantyCardProps> = ({
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

    const getEffectiveStatus = (c: WarrantyCard) => {
        const isExpired = new Date(c.warranty_end_date) < new Date();
        return isExpired ? "expired" : c.status;
    };

    const daysRemaining = getDaysRemaining(card.warranty_end_date);

    return (
        <div
            className={`glass-card-premium rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/60 shadow-md relative overflow-visible transition-all duration-300 hover:border-emerald-500/40 dark:hover:border-emerald-450/30 hover:shadow-[0_8px_30px_rgba(0,0,0,0.12)] hover:-translate-y-0.5 active:scale-[0.99] ${
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

            <div className="flex flex-row items-start justify-between gap-5">
                <div className="flex items-start gap-4 flex-1 min-w-0">
                    {/* Smartphone Icon */}
                    <div className="w-11 h-11 shrink-0 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 dark:from-emerald-500/20 dark:to-teal-500/20 border border-emerald-500/20 dark:border-emerald-500/30 rounded-2xl flex items-center justify-center shadow-inner">
                        <Smartphone className="w-5.5 h-5.5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    
                    {/* Details Block */}
                    <div className="flex-1 min-w-0 space-y-3.5">
                        {/* Device & IMEI row */}
                        <div>
                            <div className="flex flex-wrap items-center gap-2 mb-1.5">
                                <h3 className="font-extrabold text-slate-900 dark:text-white text-base truncate max-w-[200px] sm:max-w-xs leading-snug">
                                    {card.device_model}
                                </h3>
                                {quantity > 1 && (
                                    <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-md text-[10px] font-bold">
                                        x{quantity}
                                    </span>
                                )}
                                {getStatusBadge(card.status, card.warranty_end_date)}
                            </div>
                            <div className="text-xs font-semibold text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                                <span className="uppercase tracking-wider text-[9px]">IMEI/Serial:</span> 
                                <span className="font-extrabold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/80 px-2 py-0.5 rounded-md border border-slate-200/50 dark:border-slate-700/60">{card.imei_serial || "N/A"}</span>
                            </div>
                        </div>

                        {/* DESKTOP VIEW: Retain the classic, clean 4-column grey boxes */}
                        <div className="grid grid-cols-4 gap-3 mt-3">
                            <div className="bg-slate-50/80 dark:bg-[#1a1a27] rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-800/80">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Ngày mua</div>
                                <div className="font-extrabold text-slate-900 dark:text-white text-xs leading-tight">
                                    {card.warranty_start_date ? formatDate(card.warranty_start_date) : "N/A"}
                                    <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 ml-1">({card.warranty_period_months}T)</span>
                                </div>
                            </div>
                            <div className="bg-slate-50/80 dark:bg-[#1a1a27] rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-800/80">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Hết hạn</div>
                                <div className="font-extrabold text-slate-900 dark:text-white text-xs leading-tight">{formatDate(card.warranty_end_date)}</div>
                            </div>
                            <div className="bg-slate-50/80 dark:bg-[#1a1a27] rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-800/80">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Còn lại</div>
                                <div className={`font-extrabold text-xs leading-tight ${daysRemaining > 30 ? "text-emerald-600 dark:text-emerald-400" : daysRemaining > 0 ? "text-orange-500" : "text-rose-500"}`}>
                                    {daysRemaining > 0 ? `${daysRemaining} ngày` : "Đã hết hạn"}
                                </div>
                            </div>
                            <div className="bg-slate-50/80 dark:bg-[#1a1a27] rounded-xl p-2.5 border border-slate-200/50 dark:border-slate-800/80">
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-bold mb-1">Trạng thái</div>
                                <div className="font-extrabold text-slate-900 dark:text-white text-xs leading-tight uppercase tracking-wide">
                                    {getEffectiveStatus(card) === "active" ? "Còn hạn" : getEffectiveStatus(card) === "expired" ? "Hết hạn" : getEffectiveStatus(card) === "claimed" ? "Đang xử lý" : "Vô hiệu"}
                                </div>
                            </div>
                        </div>

                        {card.covered_parts && card.covered_parts.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold pt-1">
                                <span className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider mr-1">Phạm vi:</span>
                                {card.covered_parts.map((part: string, idx: number) => (
                                    <span key={idx} className="px-2.5 py-0.5 bg-blue-50/50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-100 dark:border-blue-500/20 rounded-lg text-xs font-semibold">
                                        {part}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Desktop Actions layout sitting vertically on the right side */}
                <div className="flex flex-col items-center justify-end gap-2 shrink-0 w-36">
                    <button
                        onClick={() => onPrint(card)}
                        className="w-full h-11 px-4 rounded-xl bg-slate-100 hover:bg-slate-200/80 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 text-slate-700 dark:text-slate-200 text-xs sm:text-[13px] font-bold flex items-center justify-center gap-2 transition-all border border-slate-200/40 dark:border-slate-700/60 shadow-sm active:scale-95"
                    >
                        <Printer className="w-4 h-4" /> <span>In phiếu</span>
                    </button>
                    <button
                        onClick={() => onClaim(card)}
                        disabled={!canCreateClaim}
                        className="w-full h-11 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-50/20 dark:bg-emerald-500/20 dark:hover:bg-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs sm:text-[13px] font-bold flex items-center justify-center gap-2 transition-all border border-emerald-500/20 dark:border-emerald-400/30 shadow-sm active:scale-95 disabled:opacity-40"
                    >
                        <Wrench className="w-4 h-4" /> <span>Tiếp nhận</span>
                    </button>
                    
                    <div className="relative w-full shrink-0">
                        <button
                            onClick={() => setActiveDropdownId(activeDropdownId === card.id ? null : card.id)}
                            className="h-11 w-full rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-650 hover:bg-slate-100 dark:hover:bg-slate-800/80 transition-all border border-slate-200/40 dark:border-slate-700/50 active:scale-95 shadow-sm"
                        >
                            <span className="text-xs sm:text-[13px] font-bold text-slate-500 dark:text-slate-400">Tùy chọn</span>
                        </button>

                        {activeDropdownId === card.id && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setActiveDropdownId(null)}
                                />
                                <div className="absolute left-0 mt-2 w-40 bg-white/95 dark:bg-[#1e1e2d]/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/60 dark:border-slate-800/80 z-50 overflow-hidden animate-scaleIn">
                                    {card.status !== "voided" && (
                                        <button
                                            onClick={() => {
                                                setActiveDropdownId(null);
                                                onVoid(card.id);
                                            }}
                                            disabled={!canManageClaim}
                                            className="w-full text-left px-4 py-2.5 text-xs font-bold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
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
