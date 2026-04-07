/**
 * QuickStatusFilters Component
 * Displays horizontal scrollable status filter tabs
 * Extracted from ServiceManager.tsx for reusability
 */

import React from "react";
import type { ServiceTabKey, FilterColor, ServiceStats } from "../types/service.types";
import { FILTER_BADGE_CLASSES } from "../types/service.types";

interface QuickStatusFilter {
    key: ServiceTabKey;
    label: string;
    color: FilterColor;
    count: number;
}

interface QuickStatusFiltersProps {
    activeTab: ServiceTabKey;
    onTabChange: (tab: ServiceTabKey) => void;
    stats: ServiceStats;
    allCount: number;
}

/**
 * Generate quick status filter items from stats
 */
export const getQuickStatusFilters = (
    stats: ServiceStats,
    allCount: number
): QuickStatusFilter[] => [
        {
            key: "all",
            label: "Tất cả",
            color: "slate",
            count: allCount,
        },
        {
            key: "pending",
            label: "Tiếp nhận",
            color: "blue",
            count: stats.pending,
        },
        {
            key: "inProgress",
            label: "Đang sửa",
            color: "orange",
            count: stats.inProgress,
        },
        {
            key: "done",
            label: "Đã sửa xong",
            color: "green",
            count: stats.done,
        },
        {
            key: "delivered",
            label: "Đã trả máy",
            color: "purple",
            count: stats.delivered,
        },
    ];

export const QuickStatusFilters: React.FC<QuickStatusFiltersProps> = ({
    activeTab,
    onTabChange,
    stats,
    allCount,
}) => {
    const filters = getQuickStatusFilters(stats, allCount);

    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {filters.map((filter) => (
                <button
                    key={filter.key}
                    onClick={() => onTabChange(filter.key)}
                    className={`
            flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium
            whitespace-nowrap transition-all duration-200
            ${activeTab === filter.key
                            ? `${FILTER_BADGE_CLASSES[filter.color]} ring-2 ring-offset-1 ring-${filter.color}-400`
                            : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }
          `}
                >
                    {filter.label}
                    <span
                        className={`
              text-xs px-1.5 py-0.5 rounded-full
              ${activeTab === filter.key
                                ? "bg-white/50 dark:bg-black/20"
                                : "bg-slate-200 dark:bg-slate-700"
                            }
            `}
                    >
                        {filter.count}
                    </span>
                </button>
            ))}
        </div>
    );
};

export default QuickStatusFilters;
