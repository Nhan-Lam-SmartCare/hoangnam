/**
 * Custom hook for managing service filters state
 * Extracted from ServiceManager.tsx for reusability
 */

import { useState, useMemo, useCallback } from "react";
import { useDebouncedValue } from "../../../hooks/useDebouncedValue";
import type {
    ServiceTabKey,
    QuickStatusFilter,
    ServiceStats
} from "../types/service.types";
import type { WorkOrder } from "../../../types";

interface UseServiceFiltersOptions {
    workOrders: WorkOrder[];
    stats: ServiceStats;
    dateFilteredOrders: WorkOrder[];
}

interface ServiceFiltersState {
    searchQuery: string;
    activeTab: ServiceTabKey;
    dateFilter: "all" | "today" | "week" | "month";
    technicianFilter: string;
    paymentFilter: "all" | "paid" | "unpaid" | "partial";
}

interface UseServiceFiltersReturn {
    // State values
    filters: ServiceFiltersState;
    debouncedSearchQuery: string;

    // Filtered results
    filteredOrders: WorkOrder[];
    paginatedOrders: WorkOrder[];
    hasMoreOrders: boolean;

    // Quick status filters for UI
    quickStatusFilters: QuickStatusFilter[];

    // Actions
    setSearchQuery: (value: string) => void;
    setActiveTab: (tab: ServiceTabKey) => void;
    setDateFilter: (value: "all" | "today" | "week" | "month") => void;
    setTechnicianFilter: (value: string) => void;
    setPaymentFilter: (value: "all" | "paid" | "unpaid" | "partial") => void;
    clearFilters: () => void;
    loadMore: () => void;
}

const PAGE_SIZE = 20;

/**
 * Hook to manage service filters and return filtered work orders
 */
export function useServiceFilters({
    workOrders,
    stats,
    dateFilteredOrders,
}: UseServiceFiltersOptions): UseServiceFiltersReturn {

    // Filter state
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<ServiceTabKey>("all");
    const [dateFilter, setDateFilter] = useState<"all" | "today" | "week" | "month">("week");
    const [technicianFilter, setTechnicianFilter] = useState("all");
    const [paymentFilter, setPaymentFilter] = useState<"all" | "paid" | "unpaid" | "partial">("all");
    const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

    // Debounce search for performance
    const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);

    // Reset visible count when filters change
    const handleFilterChange = useCallback(() => {
        setVisibleCount(PAGE_SIZE);
    }, []);

    // Filter work orders based on all criteria
    const filteredOrders = useMemo(() => {
        let filtered = workOrders.filter((o) => !o.refunded);

        // Tab filter
        if (activeTab === "delivered") {
            filtered = filtered.filter((o) => o.status === "Trả máy");
        } else {
            filtered = filtered.filter((o) => o.status !== "Trả máy");

            if (activeTab === "pending")
                filtered = filtered.filter((o) => o.status === "Tiếp nhận");
            else if (activeTab === "inProgress")
                filtered = filtered.filter((o) => o.status === "Đang sửa");
            else if (activeTab === "done")
                filtered = filtered.filter((o) => o.status === "Đã sửa xong");
        }

        // Search filter (using debounced value)
        if (debouncedSearchQuery) {
            filtered = filtered.filter(
                (o) =>
                    o.customerName.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                    o.vehicleModel?.toLowerCase().includes(debouncedSearchQuery.toLowerCase()) ||
                    o.licensePlate?.toLowerCase().includes(debouncedSearchQuery.toLowerCase())
            );
        }

        // Date filter
        if (dateFilter !== "all") {
            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

            filtered = filtered.filter((o) => {
                const orderDate = new Date(o.creationDate || (o as any).creationdate);

                if (dateFilter === "today") {
                    return orderDate >= today;
                } else if (dateFilter === "week") {
                    const weekAgo = new Date(today);
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return orderDate >= weekAgo;
                } else if (dateFilter === "month") {
                    const monthAgo = new Date(today);
                    monthAgo.setMonth(monthAgo.getMonth() - 1);
                    return orderDate >= monthAgo;
                }
                return true;
            });
        }

        // Technician filter
        if (technicianFilter !== "all") {
            filtered = filtered.filter((o) => o.technicianName === technicianFilter);
        }

        // Payment filter
        if (paymentFilter !== "all") {
            filtered = filtered.filter((o) => {
                const status = o.paymentStatus || (o as any).paymentstatus;
                if (paymentFilter === "paid") return status === "paid";
                if (paymentFilter === "unpaid") return status === "unpaid";
                if (paymentFilter === "partial") return status === "partial";
                return true;
            });
        }

        // Sort by date descending
        return filtered.sort((a, b) => {
            const dateA = a.creationDate || (a as any).creationdate;
            const dateB = b.creationDate || (b as any).creationdate;
            if (!dateA || !dateB) return 0;
            return new Date(dateB).getTime() - new Date(dateA).getTime();
        });
    }, [
        workOrders,
        activeTab,
        debouncedSearchQuery,
        dateFilter,
        technicianFilter,
        paymentFilter,
    ]);

    // Paginated results
    const paginatedOrders = useMemo(
        () => filteredOrders.slice(0, visibleCount),
        [filteredOrders, visibleCount]
    );

    const hasMoreOrders = filteredOrders.length > visibleCount;

    // Quick status filter items
    const quickStatusFilters = useMemo(
        (): QuickStatusFilter[] => [
            {
                key: "all",
                label: "Tất cả",
                color: "slate",
                count: dateFilteredOrders.filter(
                    (o) => o.status !== "Trả máy" && !o.refunded
                ).length,
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
        ],
        [dateFilteredOrders, stats]
    );

    // Clear all filters
    const clearFilters = useCallback(() => {
        setSearchQuery("");
        setActiveTab("all");
        setDateFilter("week");
        setTechnicianFilter("all");
        setPaymentFilter("all");
        setVisibleCount(PAGE_SIZE);
    }, []);

    // Load more items
    const loadMore = useCallback(() => {
        setVisibleCount((prev) => prev + PAGE_SIZE);
    }, []);

    // Wrapper functions to reset pagination on filter change
    const handleSetActiveTab = useCallback((tab: ServiceTabKey) => {
        setActiveTab(tab);
        handleFilterChange();
    }, [handleFilterChange]);

    const handleSetDateFilter = useCallback((value: "all" | "today" | "week" | "month") => {
        setDateFilter(value);
        handleFilterChange();
    }, [handleFilterChange]);

    const handleSetTechnicianFilter = useCallback((value: string) => {
        setTechnicianFilter(value);
        handleFilterChange();
    }, [handleFilterChange]);

    const handleSetPaymentFilter = useCallback((value: "all" | "paid" | "unpaid" | "partial") => {
        setPaymentFilter(value);
        handleFilterChange();
    }, [handleFilterChange]);

    return {
        filters: {
            searchQuery,
            activeTab,
            dateFilter,
            technicianFilter,
            paymentFilter,
        },
        debouncedSearchQuery,
        filteredOrders,
        paginatedOrders,
        hasMoreOrders,
        quickStatusFilters,
        setSearchQuery,
        setActiveTab: handleSetActiveTab,
        setDateFilter: handleSetDateFilter,
        setTechnicianFilter: handleSetTechnicianFilter,
        setPaymentFilter: handleSetPaymentFilter,
        clearFilters,
        loadMore,
    };
}
