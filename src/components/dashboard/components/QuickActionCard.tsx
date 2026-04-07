import React from "react";
import { Link } from "react-router-dom";

// QuickActionCard Component với style tối giản cho mobile
const QUICK_ACTION_COLORS: Record<string, { text: string; bg: string }> = {
    purple: {
        text: "text-purple-600 dark:text-purple-400",
        bg: "bg-purple-50 dark:bg-purple-900/20",
    },
    emerald: {
        text: "text-emerald-600 dark:text-emerald-400",
        bg: "bg-emerald-50 dark:bg-emerald-900/20",
    },
    blue: {
        text: "text-blue-600 dark:text-blue-400",
        bg: "bg-blue-50 dark:bg-blue-900/20",
    },
    orange: {
        text: "text-orange-600 dark:text-orange-400",
        bg: "bg-orange-50 dark:bg-orange-900/20",
    },
    cyan: {
        text: "text-cyan-600 dark:text-cyan-400",
        bg: "bg-cyan-50 dark:bg-cyan-900/20",
    },
    rose: {
        text: "text-rose-600 dark:text-rose-400",
        bg: "bg-rose-50 dark:bg-rose-900/20",
    },
    amber: {
        text: "text-amber-600 dark:text-amber-400",
        bg: "bg-amber-50 dark:bg-amber-900/20",
    },
    violet: {
        text: "text-violet-600 dark:text-violet-400",
        bg: "bg-violet-50 dark:bg-violet-900/20",
    },
    slate: {
        text: "text-slate-600 dark:text-slate-400",
        bg: "bg-slate-50 dark:bg-slate-800",
    },
};

interface QuickActionCardProps {
    to: string;
    icon: React.ReactNode;
    label: string;
    color: string;
    labelClassName?: string;
    onClick?: () => void;
}

const QuickActionCard: React.FC<QuickActionCardProps> = ({
    to,
    icon,
    label,
    color,
    labelClassName,
    onClick,
}) => {
    const colorStyle = QUICK_ACTION_COLORS[color] || QUICK_ACTION_COLORS.slate;

    return (
        <Link
            to={to}
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-3 md:p-4 rounded-xl transition-all ${colorStyle.bg} active:scale-95 touch-manipulation border border-transparent dark:border-white/5`}
        >
            <div className={`mb-2 ${colorStyle.text}`}>{icon}</div>
            <span
                className={`text-xs md:text-sm font-medium text-center text-slate-700 dark:text-slate-300 ${labelClassName || ""
                    }`}
            >
                {label}
            </span>
        </Link>
    );
};

export default QuickActionCard;
