import { useMemo } from "react";
// Sales repo removed
import { useWorkOrdersRepo } from "../../../hooks/useWorkOrdersRepository";
import { usePartsRepo } from "../../../hooks/usePartsRepository";
import { useCashTxRepo } from "../../../hooks/useCashTransactionsRepository";
// CashBalance and Loans repos removed
import { useAppContext } from "../../../contexts/AppContext";

import { calculateFinancialSummary } from "../../../lib/reports/financialSummary";

export const useDashboardData = (
    reportFilter: string,
    selectedMonth?: number,
    selectedQuarter?: number
) => {
    const sales: any[] = []; // Sales module removed
    const { data: workOrders = [] } = useWorkOrdersRepo();
    const { data: parts = [] } = usePartsRepo();
    const { data: cashTransactions = [] } = useCashTxRepo();
    // Stubs for removed hooks
    const { cashBalance, bankBalance } = { cashBalance: 0, bankBalance: 0 };
    const { data: loans = [] } = { data: [] as any[] };
    const { currentBranchId } = useAppContext();

    const today = new Date().toISOString().slice(0, 10);

    // Thống kê hôm nay (bao gồm cả Sales và Work Orders đã thanh toán)
    const todayStats = useMemo(() => {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);

        const summary = calculateFinancialSummary({
            sales,
            workOrders,
            parts,
            cashTransactions,
            branchId: currentBranchId,
            start,
            end,
        });

        const revenue = summary.combinedRevenue;
        const grossProfit = summary.totalProfit;
        const profit = summary.netProfit;
        const income = summary.cashIncome;
        const expense = summary.cashExpense;

        const salesCustomers = summary.filteredSales.map(
            (s: any) => s?.customer?.phone || s?.customer?.name
        );
        const woCustomers = summary.filteredWorkOrders.map(
            (wo: any) =>
                wo?.customerPhone ||
                wo?.customerphone ||
                wo?.customerName ||
                wo?.customername
        );
        const customerCount = new Set([...salesCustomers, ...woCustomers].filter(Boolean)).size;

        return {
            revenue,
            profit,
            grossProfit,
            income,
            expense,
            customerCount,
            orderCount: summary.orderCount,
            salesCount: summary.salesCount,
            workOrdersCount: summary.workOrdersCount,
        };
    }, [sales, workOrders, parts, cashTransactions, currentBranchId]);

    // Thống kê theo filter (bao gồm cả Sales và Work Orders)
    const filteredStats = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now; // Ngày hiện tại

        // Handle specific month filters (month1, month2, ... month12)
        if (reportFilter.startsWith("month") && reportFilter.length > 5) {
            const monthNum = parseInt(reportFilter.slice(5), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                startDate = new Date(now.getFullYear(), monthNum - 1, 1);
                endDate = new Date(now.getFullYear(), monthNum, 0); // Last day of month
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }
        // Handle quarter filters (q1, q2, q3, q4)
        else if (reportFilter.startsWith("q") && reportFilter.length === 2) {
            const quarterNum = parseInt(reportFilter.slice(1), 10);
            if (quarterNum >= 1 && quarterNum <= 4) {
                const startMonth = (quarterNum - 1) * 3;
                startDate = new Date(now.getFullYear(), startMonth, 1);
                endDate = new Date(now.getFullYear(), startMonth + 3, 0); // Last day of quarter
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }
        // Handle standard filters
        else {
            switch (reportFilter) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "7days":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "week":
                    const dayOfWeek = now.getDay();
                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Monday = 0
                    startDate = new Date(
                        now.getFullYear(),
                        now.getMonth(),
                        now.getDate() - diff
                    );
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "year":
                    startDate = new Date(now.getFullYear(), 0, 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            }
        }

        // Sử dụng local date format YYYY-MM-DD thay vì ISO string (tránh lỗi timezone)
        const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };

        // Chuyển ISO string hoặc date string sang local date string YYYY-MM-DD
        const toLocalDateStr = (
            dateStr: string | undefined | null
        ): string | null => {
            if (!dateStr) return null;
            try {
                // Parse date string và chuyển sang local date
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return formatLocalDate(d);
            } catch {
                return null;
            }
        };

        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);

        const summary = calculateFinancialSummary({
            sales,
            workOrders,
            parts,
            cashTransactions,
            branchId: currentBranchId,
            start: startDate,
            end: endDate,
        });

        const revenue = summary.combinedRevenue;
        const grossProfit = summary.totalProfit;
        const profit = summary.netProfit;
        const income = summary.cashIncome;
        const expense = summary.cashExpense;

        const salesCustomers = summary.filteredSales.map(
            (s: any) => s?.customer?.phone || s?.customer?.name
        );
        const woCustomers = summary.filteredWorkOrders.map(
            (wo: any) =>
                wo?.customerPhone ||
                wo?.customerphone ||
                wo?.customerName ||
                wo?.customername
        );
        const customerCount = new Set([...salesCustomers, ...woCustomers].filter(Boolean)).size;

        return {
            revenue,
            profit,
            grossProfit,
            income,
            expense,
            customerCount,
            orderCount: summary.orderCount,
        };
    }, [sales, workOrders, parts, cashTransactions, reportFilter, currentBranchId]); // Added getPartCost to dependencyoanh thu 7 ngày gần nhất (bao gồm cả Sales và Work Orders)
    const last7DaysRevenue = useMemo(() => {
        const data = [];
        for (let i = 6; i >= 0; i--) {
            const date = new Date();
            date.setDate(date.getDate() - i);
            const dateStr = date.toISOString().slice(0, 10);

            // Sales revenue
            const daySales = sales.filter((s) => s.date.slice(0, 10) === dateStr);
            const salesRevenue = daySales.reduce((sum, s) => sum + s.total, 0);

            // Work Orders revenue (đã thanh toán)
            const dayWorkOrders = workOrders.filter((wo: any) => {
                const woDate =
                    wo.creationDate?.slice(0, 10) || wo.creationdate?.slice(0, 10);
                const isPaid =
                    wo.paymentStatus === "paid" ||
                    wo.paymentstatus === "paid" ||
                    wo.paymentStatus === "partial" ||
                    wo.paymentstatus === "partial";
                return woDate === dateStr && isPaid;
            });
            const woRevenue = dayWorkOrders.reduce(
                (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
                0
            );

            const revenue = salesRevenue + woRevenue;

            const expense = cashTransactions
                .filter((t) => t.type === "expense" && t.date.slice(0, 10) === dateStr)
                .reduce((sum, t) => sum + t.amount, 0);

            data.push({
                date: date.toLocaleDateString("vi-VN", {
                    day: "2-digit",
                    month: "2-digit",
                }),
                revenue,
                expense,
                profit: revenue - expense, // FIXME: This profit calc is simplified for the chart, ideally should be grossProfit - expense
            });
        }
        return data;
    }, [sales, workOrders, cashTransactions]);

    // Dữ liệu thu chi (lọc theo filter)
    const incomeExpenseData = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;

        // Tính toán date range theo filter (giống filteredStats)
        if (reportFilter.startsWith("month") && reportFilter.length > 5) {
            const monthNum = parseInt(reportFilter.slice(5), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                startDate = new Date(now.getFullYear(), monthNum - 1, 1);
                endDate = new Date(now.getFullYear(), monthNum, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else if (reportFilter.startsWith("q") && reportFilter.length === 2) {
            const quarterNum = parseInt(reportFilter.slice(1), 10);
            if (quarterNum >= 1 && quarterNum <= 4) {
                const startMonth = (quarterNum - 1) * 3;
                startDate = new Date(now.getFullYear(), startMonth, 1);
                endDate = new Date(now.getFullYear(), startMonth + 3, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else {
            switch (reportFilter) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "7days":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "week":
                    const dayOfWeek = now.getDay();
                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
                    break;
                case "month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case "year":
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }

        const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        const toLocalDateStr = (dateStr: string | undefined | null): string | null => {
            if (!dateStr) return null;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return formatLocalDate(d);
            } catch {
                return null;
            }
        };

        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(endDate);

        const income = cashTransactions
            .filter((t) => {
                const txDate = toLocalDateStr(t.date);
                return t.type === "income" && txDate && txDate >= startDateStr && txDate <= endDateStr;
            })
            .reduce((sum, t) => sum + t.amount, 0);
        const expense = cashTransactions
            .filter((t) => {
                const txDate = toLocalDateStr(t.date);
                return t.type === "expense" && txDate && txDate >= startDateStr && txDate <= endDateStr;
            })
            .reduce((sum, t) => sum + t.amount, 0);

        return [
            { name: "Thu", value: income, color: "#10b981" },
            { name: "Chi", value: expense, color: "#ef4444" },
        ];
    }, [cashTransactions, reportFilter]);

    // Top sản phẩm bán chạy (từ cả Sales và Work Orders - lọc theo filter)
    const topProducts = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;

        if (reportFilter.startsWith("month") && reportFilter.length > 5) {
            const monthNum = parseInt(reportFilter.slice(5), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                startDate = new Date(now.getFullYear(), monthNum - 1, 1);
                endDate = new Date(now.getFullYear(), monthNum, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else if (reportFilter.startsWith("q") && reportFilter.length === 2) {
            const quarterNum = parseInt(reportFilter.slice(1), 10);
            if (quarterNum >= 1 && quarterNum <= 4) {
                const startMonth = (quarterNum - 1) * 3;
                startDate = new Date(now.getFullYear(), startMonth, 1);
                endDate = new Date(now.getFullYear(), startMonth + 3, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else {
            switch (reportFilter) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "7days":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "week":
                    const dayOfWeek = now.getDay();
                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
                    break;
                case "month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case "year":
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }

        const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        const toLocalDateStr = (dateStr: string | undefined | null): string | null => {
            if (!dateStr) return null;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return formatLocalDate(d);
            } catch {
                return null;
            }
        };

        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(endDate);

        console.log(`[TopProducts] Filter range: ${startDateStr} to ${endDateStr}`);

        const productSales: Record<string, { name: string; quantity: number }> = {};

        // From sales (filtered)
        const filteredSales = sales.filter((s) => {
            const saleDate = toLocalDateStr(s.date);
            return saleDate && saleDate >= startDateStr && saleDate <= endDateStr;
        });

        filteredSales.forEach((sale) => {
            sale.items.forEach((item) => {
                // Ensure partId exists
                const pId = item.partId || (item as any).id;
                const pName = item.partName || "Sản phẩm không xác định";

                // DEBUG: Trace specific product
                if (pName.toLowerCase().includes("elf")) {
                    console.log(`[TopProducts-DEBUG] Found ELF in Sale: ${sale.id} | Date: ${sale.date} | Item: ${pName} | Qty: ${item.quantity} | ID: ${pId}`);
                }

                if (!pId) return;

                if (!productSales[pId]) {
                    productSales[pId] = {
                        name: pName,
                        quantity: 0,
                    };
                }
                productSales[pId].quantity += item.quantity || 0;
            });
        });

        console.log(`[TopProducts] Processed ${filteredSales.length} sales`);

        // From work orders (filtered)
        const filteredWOs = workOrders.filter((wo: any) => {
            const woDate = toLocalDateStr(wo.creationDate || wo.creationdate);
            // EXCLUDE CANCELLED ORDERS
            const status = (wo.status || "").toLowerCase();
            const isCancelled = status === "đã hủy" || status === "cancelled";

            return woDate && woDate >= startDateStr && woDate <= endDateStr && !isCancelled;
        });

        filteredWOs.forEach((wo: any) => {
            const parts = wo.partsUsed || wo.partsused || wo.parts || wo.items || [];

            if (Array.isArray(parts)) {
                parts.forEach((part: any) => {
                    // Normalize part ID access
                    const partId = part.partId || part.partid || part.id;
                    const partName = part.partName || part.partname || part.name;
                    const qty = part.quantity || part.qty || 0;

                    // DEBUG: Trace specific product
                    if (partName && partName.toLowerCase().includes("elf")) {
                        console.log(`[TopProducts-DEBUG] Found ELF in WO: ${wo.id} | Date: ${wo.creationDate || wo.creationdate} | Item: ${partName} | Qty: ${qty} | ID: ${partId}`);
                    }

                    if (partId && partName) {
                        if (!productSales[partId]) {
                            productSales[partId] = {
                                name: partName,
                                quantity: 0,
                            };
                        }
                        productSales[partId].quantity += qty;
                    }
                });
            }
        });

        console.log(`[TopProducts] Processed ${filteredWOs.length} work orders`);

        const result = Object.values(productSales)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10); // Show top 10

        console.log("[TopProducts] Result:", result);
        return result;

    }, [sales, workOrders, reportFilter]);

    // Thống kê work orders (phiếu sửa chữa - lọc theo filter)
    const workOrderStats = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;

        if (reportFilter.startsWith("month") && reportFilter.length > 5) {
            const monthNum = parseInt(reportFilter.slice(5), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                startDate = new Date(now.getFullYear(), monthNum - 1, 1);
                endDate = new Date(now.getFullYear(), monthNum, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else if (reportFilter.startsWith("q") && reportFilter.length === 2) {
            const quarterNum = parseInt(reportFilter.slice(1), 10);
            if (quarterNum >= 1 && quarterNum <= 4) {
                const startMonth = (quarterNum - 1) * 3;
                startDate = new Date(now.getFullYear(), startMonth, 1);
                endDate = new Date(now.getFullYear(), startMonth + 3, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else {
            switch (reportFilter) {
                case "today":
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                    break;
                case "7days":
                    startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
                    break;
                case "week":
                    const dayOfWeek = now.getDay();
                    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
                    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
                    break;
                case "month":
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
                    break;
                case "year":
                    startDate = new Date(now.getFullYear(), 0, 1);
                    break;
                default:
                    startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        }

        const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        const toLocalDateStr = (dateStr: string | undefined | null): string | null => {
            if (!dateStr) return null;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return formatLocalDate(d);
            } catch {
                return null;
            }
        };

        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(endDate);

        // Filter work orders by date range
        const filteredWOs = (workOrders || []).filter((wo: any) => {
            const woDate = toLocalDateStr(wo.creationDate || wo.creationdate);
            return woDate && woDate >= startDateStr && woDate <= endDateStr;
        });

        const newOrders = filteredWOs.filter(
            (wo) => wo.status === "Tiếp nhận"
        ).length;
        const inProgress = filteredWOs.filter(
            (wo) => wo.status === "Đang sửa"
        ).length;
        const completed = filteredWOs.filter(
            (wo) => wo.status === "Đã sửa xong"
        ).length;
        const delivered = filteredWOs.filter(
            (wo) => wo.status === "Trả máy" || (wo.status as string) === "Đã giao"
        ).length;
        const cancelled = filteredWOs.filter(
            (wo) => (wo.status as string) === "Đã hủy"
        ).length;

        return { newOrders, inProgress, completed, delivered, cancelled };
    }, [workOrders, reportFilter]);

    // DEBUG DATA: Specific audit for "Elf 10W40"
    const debugData = useMemo(() => {
        const now = new Date();
        let startDate: Date;
        let endDate: Date = now;

        if (reportFilter.startsWith("month") && reportFilter.length > 5) {
            const monthNum = parseInt(reportFilter.slice(5), 10);
            if (monthNum >= 1 && monthNum <= 12) {
                startDate = new Date(now.getFullYear(), monthNum - 1, 1);
                endDate = new Date(now.getFullYear(), monthNum, 0);
            } else {
                startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            }
        } else {
            // Default to "month" logic for the user's specific question "from start of month"
            // regardless of filter, but let's stick to the filter if it's set to month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        }

        const formatLocalDate = (d: Date) => {
            const year = d.getFullYear();
            const month = String(d.getMonth() + 1).padStart(2, "0");
            const day = String(d.getDate()).padStart(2, "0");
            return `${year}-${month}-${day}`;
        };
        const toLocalDateStr = (dateStr: string | undefined | null): string | null => {
            if (!dateStr) return null;
            try {
                const d = new Date(dateStr);
                if (isNaN(d.getTime())) return null;
                return formatLocalDate(d);
            } catch {
                return null;
            }
        };

        const startDateStr = formatLocalDate(startDate);
        const endDateStr = formatLocalDate(endDate);

        const transactions: any[] = [];

        // Scan Sales
        sales.forEach(s => {
            const d = toLocalDateStr(s.date);
            if (d && d >= startDateStr && d <= endDateStr) {
                s.items.forEach(item => {
                    const name = item.partName || "";
                    if (name.toLowerCase().includes("elf")) {
                        transactions.push({
                            source: "Bán hàng",
                            id: s.id,
                            code: (s as any).sale_code || "N/A",
                            date: d,
                            product: name,
                            quantity: item.quantity
                        });
                    }
                });
            }
        });

        // Scan Work Orders
        workOrders.forEach(wo => {
            const woAny = wo as any;
            const d = toLocalDateStr(woAny.creationDate || woAny.creationdate);
            const status = ((woAny.status || "") as string).toLowerCase();
            const isCancelled = status === "đã hủy" || status === "cancelled";

            if (!isCancelled && d && d >= startDateStr && d <= endDateStr) {
                const parts = woAny.partsUsed || woAny.partsused || woAny.parts || woAny.items || [];
                if (Array.isArray(parts)) {
                    parts.forEach((part: any) => {
                        const name = part.partName || part.partname || part.name || "";
                        if (name.toLowerCase().includes("elf")) {
                            transactions.push({
                                source: "Sửa chữa",
                                id: woAny.id,
                                code: String(woAny.id || "").slice(0, 8) + "...", // Short ID
                                date: d,
                                product: name,
                                quantity: part.quantity || part.qty || 0
                            });
                        }
                    });
                }
            }
        });

        return transactions;
    }, [sales, workOrders, reportFilter]); // Re-calculate when data changes

    // Cảnh báo
    const alerts = useMemo(() => {
        const warnings: Array<{ type: string; message: string; color: string }> =
            [];

        // Hàng sắp hết
        const lowStockParts = parts.filter(
            (p) => (p.stock[currentBranchId] || 0) < 10
        );
        if (lowStockParts.length > 0) {
            warnings.push({
                type: "Tồn kho thấp",
                message: `${lowStockParts.length} sản phẩm sắp hết hàng`,
                color: "text-orange-600 dark:text-orange-400",
            });
        }

        // Khoản vay đến hạn
        const upcomingLoans = loans.filter((loan) => {
            const daysUntilDue = Math.ceil(
                (new Date(loan.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
            );
            return daysUntilDue <= 30 && daysUntilDue > 0 && loan.status === "active";
        });
        if (upcomingLoans.length > 0) {
            warnings.push({
                type: "Nợ đến hạn",
                message: `${upcomingLoans.length} khoản vay sắp đến hạn`,
                color: "text-red-600 dark:text-red-400",
            });
        }

        // Số dư thấp
        if (cashBalance + bankBalance < 10000000) {
            warnings.push({
                type: "Số dư thấp",
                message: "Số dư tài khoản dưới 10 triệu",
                color: "text-amber-600 dark:text-amber-400",
            });
        }

        return warnings;
    }, [parts, loans, cashBalance, bankBalance, currentBranchId]);

    // Top Customers Data
    const topCustomersData = useMemo(() => {
        const customerSpending: Record<
            string,
            { name: string; phone?: string; total: number }
        > = {};

        // Tính từ Sales (bán hàng)
        sales.forEach((sale) => {
            const key = sale.customer.phone || sale.customer.name;
            if (!customerSpending[key]) {
                customerSpending[key] = {
                    name: sale.customer.name,
                    phone: sale.customer.phone,
                    total: 0,
                };
            }
            customerSpending[key].total += sale.total;
        });

        // Tính từ Work Orders (phiếu sửa chữa đã thanh toán)
        workOrders.forEach((wo: any) => {
            const isPaid =
                wo.paymentStatus === "paid" ||
                wo.paymentstatus === "paid" ||
                wo.paymentStatus === "partial" ||
                wo.paymentstatus === "partial";

            if (isPaid) {
                const customerName = wo.customerName || wo.customername || "";
                const customerPhone = wo.customerPhone || wo.customerphone || "";
                const key = customerPhone || customerName;

                if (key) {
                    if (!customerSpending[key]) {
                        customerSpending[key] = {
                            name: customerName,
                            phone: customerPhone,
                            total: 0,
                        };
                    }
                    customerSpending[key].total +=
                        wo.totalPaid || wo.totalpaid || wo.total || 0;
                }
            }
        });

        return Object.values(customerSpending)
            .sort((a, b) => b.total - a.total)
            .slice(0, 10);
    }, [sales, workOrders]);

    // Monthly Comparison Data
    const monthlyComparisonData = useMemo(() => {
        const months = [];
        const now = new Date();

        for (let i = 2; i >= 0; i--) {
            const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const monthStr = monthDate.toISOString().slice(0, 7); // Format: YYYY-MM
            const monthName = monthDate.toLocaleDateString("vi-VN", {
                month: "short",
                year: "numeric",
            });

            // Tính doanh thu và đơn hàng từ Sales
            const monthSales = sales.filter((s) => {
                if (!s.date) return false;
                const saleMonth = s.date.slice(0, 7);
                return saleMonth === monthStr;
            });
            const salesRevenue = monthSales.reduce((sum, s) => sum + s.total, 0);
            const salesOrders = monthSales.length;

            // Tính doanh thu và đơn hàng từ Work Orders (đã thanh toán)
            const monthWorkOrders = workOrders.filter((wo: any) => {
                // Ưu tiên dùng paymentDate, nếu không có thì dùng creationDate
                const dateRaw =
                    wo.paymentDate ||
                    wo.paymentdate ||
                    wo.creationDate ||
                    wo.creationdate;
                if (!dateRaw) return false;

                const woMonth = dateRaw.slice(0, 7);
                const isPaid =
                    wo.paymentStatus === "paid" ||
                    wo.paymentstatus === "paid" ||
                    wo.paymentStatus === "partial" ||
                    wo.paymentstatus === "partial";
                return woMonth === monthStr && isPaid;
            });
            const woRevenue = monthWorkOrders.reduce(
                (sum, wo: any) => sum + (wo.totalPaid || wo.totalpaid || wo.total || 0),
                0
            );
            const woOrders = monthWorkOrders.length;

            const totalRevenue = salesRevenue + woRevenue;
            const totalOrders = salesOrders + woOrders;

            months.push({
                month: monthName,
                revenue: totalRevenue,
                orders: totalOrders,
            });
        }

        return months;
    }, [sales, workOrders]);

    return {
        todayStats,
        filteredStats,
        topProducts,
        incomeExpenseData,
        last7DaysRevenue,
        workOrderStats,
        alerts,
        cashBalance,
        bankBalance,
        debugData, // EXPORT DEBUG DATA HERE
    };
};
