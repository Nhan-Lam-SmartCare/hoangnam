/**
 * StatusSnapshotCards Component
 * Displays status snapshot cards with counts
 * Extracted from ServiceManager.tsx for reusability
 */

import React from "react";
import type { ServiceTabKey, ServiceStats } from "../types/service.types";
import { getStatusSnapshotCards } from "./statusSnapshotCardsData";

interface StatusSnapshotCardsProps {
    stats: ServiceStats;
    activeTab?: ServiceTabKey;
    onTabChange?: (tab: ServiceTabKey) => void;
}

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
