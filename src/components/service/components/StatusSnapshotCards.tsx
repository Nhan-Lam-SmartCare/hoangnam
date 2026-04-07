/**
 * StatusSnapshotCards Component
 * Displays status snapshot cards with counts
 * Extracted from ServiceManager.tsx for reusability
 */

import React from "react";
import type { ServiceTabKey, ServiceStats } from "../types/service.types";

interface StatusSnapshotCard {
    key: ServiceTabKey;
    label: string;
    value: number;
    subtitle: string;
    accent: string;
    dot: string;
}

interface StatusSnapshotCardsProps {
    stats: ServiceStats;
    activeTab?: ServiceTabKey;
    onTabChange?: (tab: ServiceTabKey) => void;
}

/**
 * Generate status snapshot cards from stats
 */
export const getStatusSnapshotCards = (stats: ServiceStats): StatusSnapshotCard[] => [
    {
        key: "pending",
        label: "Tiếp nhận",
        value: stats.pending,
        subtitle: "Chờ phân công",
        accent: "from-sky-50 via-sky-50 to-white dark:from-sky-900/30 dark:via-sky-900/10",
        dot: "bg-sky-500",
    },
    {
        key: "inProgress",
        label: "Đang sửa",
        value: stats.inProgress,
        subtitle: "Đang thi công",
        accent: "from-amber-50 via-amber-50 to-white dark:from-amber-900/30 dark:via-amber-900/10",
        dot: "bg-amber-500",
    },
    {
        key: "done",
        label: "Đã sửa xong",
        value: stats.done,
        subtitle: "Chờ giao khách",
        accent: "from-emerald-50 via-emerald-50 to-white dark:from-emerald-900/30 dark:via-emerald-900/10",
        dot: "bg-emerald-500",
    },
    {
        key: "delivered",
        label: "Trả máy",
        value: stats.delivered,
        subtitle: "Hoàn tất",
        accent: "from-purple-50 via-purple-50 to-white dark:from-purple-900/30 dark:via-purple-900/10",
        dot: "bg-purple-500",
    },
];

export const StatusSnapshotCards: React.FC<StatusSnapshotCardsProps> = ({
    stats,
    activeTab,
    onTabChange,
}) => {
    const cards = getStatusSnapshotCards(stats);

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {cards.map((card) => (
                <button
                    key={card.key}
                    onClick={() => onTabChange?.(card.key)}
                    className={`
            relative overflow-hidden rounded-xl p-4 text-left
            bg-gradient-to-br ${card.accent}
            border border-slate-200/50 dark:border-slate-700/50
            hover:shadow-md transition-all duration-200
            ${activeTab === card.key ? "ring-2 ring-offset-1 ring-blue-400" : ""}
          `}
                >
                    {/* Status dot */}
                    <div className={`absolute top-3 right-3 w-2 h-2 rounded-full ${card.dot}`} />

                    {/* Value */}
                    <div className="text-2xl font-bold text-slate-800 dark:text-slate-100">
                        {card.value}
                    </div>

                    {/* Label */}
                    <div className="text-sm font-medium text-slate-700 dark:text-slate-300">
                        {card.label}
                    </div>

                    {/* Subtitle */}
                    <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {card.subtitle}
                    </div>
                </button>
            ))}
        </div>
    );
};

export default StatusSnapshotCards;
