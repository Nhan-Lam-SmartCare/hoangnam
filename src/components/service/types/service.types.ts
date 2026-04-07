/**
 * Shared types for Service Manager components
 * Extracted from ServiceManager.tsx for reusability
 */

import type { WorkOrder, WorkOrderPart } from "../../../types";

// ============================================
// Store Settings
// ============================================
export interface StoreSettings {
    store_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    bank_qr_url?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_holder?: string;
    bank_branch?: string;
    work_order_prefix?: string;
}

// ============================================
// Work Order Status Types
// ============================================
export type WorkOrderStatus = "Tiếp nhận" | "Đang sửa" | "Đã sửa xong" | "Trả máy";
export type ServiceTabKey = "all" | "pending" | "inProgress" | "done" | "delivered";
export type FilterColor = "slate" | "blue" | "orange" | "green" | "purple";

// ============================================
// Service Stats
// ============================================
export interface ServiceStats {
    pending: number;
    inProgress: number;
    done: number;
    delivered: number;
    filteredRevenue: number;
    filteredProfit: number;
}

// ============================================
// Filter Types
// ============================================
export interface ServiceFilters {
    searchQuery: string;
    debouncedSearchQuery: string;
    activeTab: ServiceTabKey;
    dateFilter: "all" | "today" | "week" | "month";
    technicianFilter: string;
    paymentFilter: "all" | "paid" | "unpaid" | "partial";
}

// ============================================
// Quick Status Filter Item
// ============================================
export interface QuickStatusFilter {
    key: ServiceTabKey;
    label: string;
    color: FilterColor;
    count: number;
}

// ============================================
// Status Snapshot Card
// ============================================
export interface StatusSnapshotCard {
    key: ServiceTabKey;
    label: string;
    value: number;
    subtitle: string;
    accent: string;
    dot: string;
}

// ============================================
// Filter Badge Classes
// ============================================
export const FILTER_BADGE_CLASSES: Record<FilterColor, string> = {
    slate: "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-200",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-300",
    orange: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-300",
    green: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-300",
    purple: "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300",
};

// ============================================
// Common CSS Classes
// ============================================
export const FILTER_INPUT_CLASS =
    "px-4 py-2 bg-slate-50 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-200";

// ============================================
// Props Types for Components
// ============================================
export interface ServiceStatsProps {
    stats: ServiceStats;
    dateFilterLabel: string;
    showProfit: boolean;
    isOwner: boolean;
    onToggleProfit: () => void;
    onCardClick: (tabKey: ServiceTabKey) => void;
}

export interface ServiceFiltersProps {
    filters: ServiceFilters;
    quickStatusFilters: QuickStatusFilter[];
    technicians: Array<{ id: string; name: string }>;
    onSearchChange: (value: string) => void;
    onTabChange: (tab: ServiceTabKey) => void;
    onDateFilterChange: (value: string) => void;
    onTechnicianFilterChange: (value: string) => void;
    onPaymentFilterChange: (value: string) => void;
    onClearFilters: () => void;
}

export interface ServiceTableRowProps {
    order: WorkOrder;
    isOwner: boolean;
    showProfit: boolean;
    onEdit: (order: WorkOrder) => void;
    onPrint: (order: WorkOrder) => void;
    onRefund: (order: WorkOrder) => void;
    onDelete: (order: WorkOrder) => void;
    onCall: (phone: string) => void;
}

export interface PrintPreviewModalProps {
    order: WorkOrder | null;
    storeSettings: StoreSettings | null;
    isOpen: boolean;
    onClose: () => void;
    onPrint: () => void;
    onShare: () => void;
    isSharing: boolean;
}

export interface RefundModalProps {
    order: WorkOrder | null;
    isOpen: boolean;
    refundReason: string;
    onReasonChange: (value: string) => void;
    onConfirm: () => void;
    onClose: () => void;
}

// ============================================
// Utility Functions
// ============================================

/**
 * Calculate profit for a work order
 */
export function calculateOrderProfit(order: WorkOrder): number {
    const partsCost = order.partsUsed?.reduce(
        (sum: number, part: WorkOrderPart) => sum + (part.costPrice || 0) * (part.quantity || 1),
        0
    ) || 0;

    const servicesCost = order.additionalServices?.reduce(
        (sum: number, svc: { costPrice?: number; quantity?: number }) =>
            sum + (svc.costPrice || 0) * (svc.quantity || 1),
        0
    ) || 0;

    return order.total - partsCost - servicesCost;
}

/**
 * Get date filter label in Vietnamese
 */
export function getDateFilterLabel(dateFilter: string): string {
    switch (dateFilter) {
        case "today":
            return "hôm nay";
        case "week":
            return "7 ngày qua";
        case "month":
            return "tháng này";
        default:
            return "tất cả";
    }
}

/**
 * Format masked phone number for display
 */
export function formatMaskedPhone(phone?: string): string {
    if (!phone) return "";
    if (phone.length <= 4) return phone;
    return phone.slice(0, -4).replace(/./g, "*") + phone.slice(-4);
}
