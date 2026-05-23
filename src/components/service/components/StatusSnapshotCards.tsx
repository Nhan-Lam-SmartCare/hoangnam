import React from "react";
import { Wrench, Settings, Check, HandCoins } from "lucide-react";
import type { ServiceTabKey, ServiceStats } from "../types/service.types";
import { getStatusSnapshotCards } from "./statusSnapshotCardsData";

interface StatusSnapshotCardsProps {
    stats: ServiceStats;
    activeTab?: ServiceTabKey;
    onTabChange?: (tab: ServiceTabKey) => void;
}

const iconMap: Record<string, React.ComponentType<any>> = {
    Wrench,
    Settings,
    Check,
    HandCoins,
};

export const StatusSnapshotCards: React.FC<StatusSnapshotCardsProps> = ({
    stats,
    activeTab,
    onTabChange,
}) => {
    const cards = getStatusSnapshotCards(stats);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {cards.map((card) => {
                const IconComponent = iconMap[card.icon] || Wrench;
                const isActive = activeTab === card.key;

                return (
                    <button
                        key={card.key}
                        onClick={() => onTabChange?.(card.key)}
                        className={`
                            relative overflow-hidden rounded-2xl p-4 text-left
                            glass-card-premium transition-all duration-300
                            bg-gradient-to-br ${card.accent} ${card.glow}
                            ${isActive 
                                ? "border-blue-500/80 shadow-[0_0_25px_rgba(59,130,246,0.25)] ring-1 ring-blue-500/30" 
                                : "border-slate-200/40 dark:border-slate-800/40"}
                        `}
                    >
                        {/* Status dot in the top right */}
                        <div className={`absolute top-4 right-4 w-2.5 h-2.5 rounded-full ${card.dot}`} />

                        <div className="flex items-center gap-3">
                            {/* Icon container */}
                            <div className={`
                                p-2.5 rounded-xl transition-all duration-300
                                ${isActive 
                                    ? "bg-blue-500/20 text-blue-400" 
                                    : "bg-slate-200/50 dark:bg-slate-800/80 text-slate-500 dark:text-slate-400"}
                            `}>
                                <IconComponent className="w-5 h-5" />
                            </div>

                            {/* Info */}
                            <div>
                                <div className="text-[10px] font-bold tracking-wider uppercase opacity-60">
                                    {card.label}
                                </div>
                                <div className="text-2xl font-black mt-0.5 tracking-tight text-slate-800 dark:text-white">
                                    {card.value}
                                </div>
                            </div>
                        </div>

                        {/* Subtitle / pipeline stage indicator */}
                        <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500 dark:text-slate-400">
                            <span>{card.subtitle}</span>
                            {isActive && (
                                <span className="text-[10px] text-blue-500 dark:text-blue-400 uppercase tracking-wide">
                                    Đang xem
                                </span>
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default StatusSnapshotCards;

