import React from "react";
import { LucideIcon } from "lucide-react";

export type CardColorKey =
    | "blue"
    | "emerald"
    | "violet"
    | "amber"
    | "rose"
    | "cyan";

export const CARD_COLORS: Record<
    CardColorKey,
    { card: string; icon: string; accent: string }
> = {
    blue: {
        card: "bg-white dark:bg-slate-800 border border-blue-100 dark:border-blue-900/40",
        icon: "bg-blue-500/15 text-blue-600 dark:text-blue-400",
        accent: "text-blue-600 dark:text-blue-400",
    },
    emerald: {
        card: "bg-white dark:bg-slate-800 border border-emerald-100 dark:border-emerald-900/40",
        icon: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
        accent: "text-emerald-600 dark:text-emerald-400",
    },
    violet: {
        card: "bg-white dark:bg-slate-800 border border-violet-100 dark:border-violet-900/40",
        icon: "bg-violet-500/15 text-violet-600 dark:text-violet-400",
        accent: "text-violet-600 dark:text-violet-400",
    },
    amber: {
        card: "bg-white dark:bg-slate-800 border border-amber-100 dark:border-amber-900/40",
        icon: "bg-amber-500/15 text-amber-600 dark:text-amber-400",
        accent: "text-amber-600 dark:text-amber-400",
    },
    rose: {
        card: "bg-white dark:bg-slate-800 border border-rose-100 dark:border-rose-900/40",
        icon: "bg-rose-500/15 text-rose-600 dark:text-rose-400",
        accent: "text-rose-600 dark:text-rose-400",
    },
    cyan: {
        card: "bg-white dark:bg-slate-800 border border-cyan-100 dark:border-cyan-900/40",
        icon: "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400",
        accent: "text-cyan-600 dark:text-cyan-400",
    },
};

interface StatCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    colorKey: CardColorKey;
    icon: LucideIcon;
}

const StatCard: React.FC<StatCardProps> = ({
    title,
    value,
    subtitle,
    colorKey,
    icon: Icon,
}) => {
    const colors = CARD_COLORS[colorKey];

    return (
        <div className={`rounded-2xl p-4 md:p-5 shadow-sm ${colors.card}`}>
            <div className="flex items-center gap-3 md:gap-4">
                <div className={`p-2.5 md:p-3 rounded-xl ${colors.icon}`}>
                    <Icon className="w-5 h-5 md:w-6 md:h-6" />
                </div>
                <div>
                    <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                        {title}
                    </p>
                    <div className="flex items-baseline gap-2 mt-0.5">
                        <h3 className="text-lg md:text-2xl font-bold text-slate-900 dark:text-white">
                            {value}
                        </h3>
                    </div>
                    {subtitle && (
                        <p className={`text-xs mt-1 ${colors.accent}`}>{subtitle}</p>
                    )}
                </div>
            </div>
        </div>
    );
};

export default StatCard;
