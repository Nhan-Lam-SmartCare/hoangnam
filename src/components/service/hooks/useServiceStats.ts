import { useMemo } from "react";
import type { WorkOrder, WorkOrderPart, Part } from "../../../types";
import type { ServiceStats } from "../types/service.types";

interface UseServiceStatsOptions {
    workOrders: WorkOrder[];
    dateFilter: "all" | "today" | "week" | "month";
    parts?: Part[]; // Optional parts list for cost lookup fallback
    currentBranchId?: string;
}

interface UseServiceStatsReturn {
    stats: ServiceStats;
    dateFilteredOrders: WorkOrder[];
    totalOpenTickets: number;
    urgentTickets: number;
    urgentRatio: number;
    completionRate: number;
    profitMargin: number;
}

/**
 * Hook to calculate service statistics from work orders
 * 
 * @param options - Work orders, date filter settings, optional parts list, and branch ID
 * @returns Calculated statistics and derived metrics
 */
export function useServiceStats({
    workOrders,
    dateFilter,
    parts = [],
    currentBranchId = ""
}: UseServiceStatsOptions): UseServiceStatsReturn {

    // Create a map for fast part cost lookup
    const partCostMap = useMemo(() => {
        const map = new Map<string, number>();
        parts.forEach((part) => {
            // Priority: costPrice[branch] > costPrice (number) > importPrice > 0
            let cost = 0;
            const p = part as any;

            if (p.costPrice && typeof p.costPrice === 'object' && currentBranchId) {
                cost = p.costPrice[currentBranchId] || 0;
            } else if (typeof p.costPrice === 'number') {
                cost = p.costPrice;
            } else if (p.importPrice && typeof p.importPrice === 'number') {
                cost = p.importPrice; // Handle legacy importPrice field
            }

            if (part.id) map.set(part.id, cost);
            if (part.sku) map.set(part.sku, cost);
        });
        return map;
    }, [parts, currentBranchId]);

    // Helper to get part cost with fallback
    const getPartCost = (partId: string, sku: string, fallbackCost: number) => {
        if (fallbackCost > 0) return fallbackCost;
        return partCostMap.get(partId) || partCostMap.get(sku) || 0;
    };

    // Filter orders by date
    const dateFilteredOrders = useMemo(() => {
        let filtered = [...workOrders];

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

        return filtered;
    }, [workOrders, dateFilter]);

    // Calculate stats
    const stats = useMemo((): ServiceStats => {
        const pending = dateFilteredOrders.filter(
            (o) => o.status === "Tiếp nhận"
        ).length;

        const inProgress = dateFilteredOrders.filter(
            (o) => o.status === "Đang sửa"
        ).length;

        const done = dateFilteredOrders.filter(
            (o) => o.status === "Đã sửa xong"
        ).length;

        const delivered = dateFilteredOrders.filter(
            (o) => o.status === "Trả máy"
        ).length;

        // Calculate revenue from paid orders
        const filteredRevenue = dateFilteredOrders
            .filter((o) => o.paymentStatus === "paid")
            .reduce((sum, o) => sum + o.total, 0);

        // Calculate profit = Revenue - Cost (parts + services)
        const filteredProfit = dateFilteredOrders
            .filter((o) => o.paymentStatus === "paid")
            .reduce((sum, o) => {
                // Parts cost with fallback lookup
                const partsCost = o.partsUsed?.reduce(
                    (s: number, p: WorkOrderPart) => {
                        const cost = getPartCost(
                            p.partId || (p as any).partid,
                            p.sku || "",
                            p.costPrice || 0
                        );
                        return s + cost * (p.quantity || 1);
                    },
                    0
                ) || 0;

                // Services cost
                const servicesCost = o.additionalServices?.reduce(
                    (s: number, svc: { costPrice?: number; quantity?: number }) =>
                        s + (svc.costPrice || 0) * (svc.quantity || 1),
                    0
                ) || 0;

                return sum + (o.total - partsCost - servicesCost);
            }, 0);

        return {
            pending,
            inProgress,
            done,
            delivered,
            filteredRevenue,
            filteredProfit,
        };
    }, [dateFilteredOrders, partCostMap]);

    // Calculate derived metrics
    const totalOpenTickets = stats.pending + stats.inProgress + stats.done;
    const urgentTickets = stats.pending + stats.inProgress;
    const urgentRatio = totalOpenTickets
        ? Math.round((urgentTickets / totalOpenTickets) * 100)
        : 0;
    const completionRate = totalOpenTickets
        ? Math.round((stats.done / totalOpenTickets) * 100)
        : 0;
    const profitMargin = stats.filteredRevenue
        ? Math.round((stats.filteredProfit / stats.filteredRevenue) * 100)
        : 0;

    return {
        stats,
        dateFilteredOrders,
        totalOpenTickets,
        urgentTickets,
        urgentRatio,
        completionRate,
        profitMargin,
    };
}
