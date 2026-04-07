// Constants for Inventory Manager
import type { FilterTheme, FilterThemeStyles } from './types';

export const LOW_STOCK_THRESHOLD = 5;

export const FILTER_THEME_STYLES: Record<FilterTheme, FilterThemeStyles> = {
    neutral: {
        buttonActive:
            'border-blue-500 bg-blue-500/10 shadow-[0_5px_25px_rgba(59,130,246,0.15)] text-slate-900 dark:text-slate-100',
        buttonInactive:
            'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-blue-300/70',
        badgeActive:
            'border-blue-500 text-blue-600 bg-white/60 dark:bg-slate-900/40 dark:text-blue-400',
        badgeInactive:
            'border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300',
    },
    success: {
        buttonActive:
            'border-emerald-500 bg-emerald-50 shadow-[0_5px_25px_rgba(16,185,129,0.2)] text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200',
        buttonInactive:
            'border-emerald-200 bg-emerald-50/40 hover:border-emerald-400/70 dark:border-emerald-800 dark:bg-emerald-950/20',
        badgeActive:
            'border-emerald-500 text-emerald-700 bg-emerald-50 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-600',
        badgeInactive:
            'border-emerald-200 text-emerald-600 dark:border-emerald-700 dark:text-emerald-400',
    },
    warning: {
        buttonActive:
            'border-amber-500 bg-amber-50 shadow-[0_5px_25px_rgba(245,158,11,0.25)] text-amber-900 dark:bg-amber-950/50 dark:text-amber-200',
        buttonInactive:
            'border-amber-200 bg-amber-50/40 hover:border-amber-400/70 dark:border-amber-800 dark:bg-amber-950/20',
        badgeActive:
            'border-amber-500 text-amber-700 bg-amber-50 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-600',
        badgeInactive:
            'border-amber-200 text-amber-600 dark:border-amber-700 dark:text-amber-400',
    },
    danger: {
        buttonActive:
            'border-red-500 bg-red-50 shadow-[0_5px_25px_rgba(239,68,68,0.25)] text-red-900 dark:bg-red-950/50 dark:text-red-200',
        buttonInactive:
            'border-red-200 bg-red-50/40 hover:border-red-400/70 dark:border-red-800 dark:bg-red-950/20',
        badgeActive:
            'border-red-500 text-red-700 bg-red-50 dark:bg-red-950/50 dark:text-red-300 dark:border-red-700',
        badgeInactive:
            'border-red-200 text-red-600 dark:border-red-700 dark:text-red-400',
    },
};

// Tab names for inventory manager
export const INVENTORY_TABS = {
    STOCK: 'stock',
    CATEGORIES: 'categories',
    LOOKUP: 'lookup',
    HISTORY: 'history',
    PURCHASE_ORDERS: 'purchase-orders',
} as const;

export type InventoryTab = typeof INVENTORY_TABS[keyof typeof INVENTORY_TABS];

// LocalStorage keys
export const STORAGE_KEYS = {
    GOODS_RECEIPT_DRAFT: (branchId: string) => `goods_receipt_draft_${branchId}`,
} as const;
