import React from "react";

interface StatusItemProps {
    icon: React.ReactNode;
    label: string;
    count: number;
    color: "blue" | "green" | "amber" | "slate" | "red";
}

const STAT_COLORS = {
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
    green:
        "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400",
    amber:
        "bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400",
    slate:
        "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
    red: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400",
};

const StatusItem: React.FC<StatusItemProps> = ({
    icon,
    label,
    count,
    color,
}) => {
    return (
        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
            <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${STAT_COLORS[color]}`}>{icon}</div>
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {label}
                </span>
            </div>
            <span className="text-sm font-bold text-slate-900 dark:text-white">
                {count}
            </span>
        </div>
    );
};

export default StatusItem;
