import { useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { usePartsRepoPaged } from "../../../hooks/usePartsRepository";
import { useInventoryTxRepo } from "../../../hooks/useInventoryTransactionsRepository";
import { useWorkOrdersRepo } from "../../../hooks/useWorkOrdersRepository";
import { useSupplierDebtsRepo } from "../../../hooks/useDebtsRepository";
import {
  fetchAllPartsForTotals,
  fetchPartsBySkus,
} from "../../../lib/repository/partsRepository";
import {
  getAvailable,
  computeStockHealth,
  computeTotals,
  detectDuplicateSkus,
  isPartInBranch,
} from "../../../utils/inventoryCalc";
import { LOW_STOCK_THRESHOLD } from "../constants";
import type { InventoryTransaction } from "../../../types";

export interface UseInventoryDataParams {
  currentBranchId: string;
  // Từ useInventoryFilters — hook data chỉ ĐỌC, không sở hữu state lọc.
  page: number;
  pageSize: number;
  search: string;
  categoryFilter: string;
  stockFilter: string;
  showDuplicatesOnly: boolean;
  filterBranchOnly: boolean;
  sortField: string | null;
  sortDirection: "asc" | "desc";
  isClientFiltering: boolean;
}

/**
 * Toàn bộ tầng DỮ LIỆU của tab Tồn kho: queries (trang parts, allParts cho
 * thống kê, giao dịch kho, công nợ NCC, work orders) + các memo dẫn xuất
 * (stockHealth, lọc/sort client, phân trang hiển thị, tổng tồn/giá trị,
 * giá nhập gần nhất, lịch sử fallback). Tách NGUYÊN VĂN từ InventoryManager.
 */
export function useInventoryData({
  currentBranchId,
  page,
  pageSize,
  search,
  categoryFilter,
  stockFilter,
  showDuplicatesOnly,
  filterBranchOnly,
  sortField,
  sortDirection,
  isClientFiltering,
}: UseInventoryDataParams) {
  const { data: invTx = [] } = useInventoryTxRepo({
    branchId: currentBranchId,
  });
  const { data: supplierDebts = [] } = useSupplierDebtsRepo();

  const {
    data: pagedResult,
    isLoading: partsLoading,
    refetch: refetchInventory,
  } = usePartsRepoPaged({
    page,
    pageSize,
    search,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    branchId: currentBranchId,
  });

  // Fetch work orders for "Reserved" stock details
  const { data: workOrders = [] } = useWorkOrdersRepo();

  const repoParts = useMemo(() => pagedResult?.data ?? [], [pagedResult?.data]);
  const totalParts = pagedResult?.meta?.total || 0;

  // Fetch ALL parts for accurate totals calculation (stock, costPrice, retailPrice)
  // NOTE: This query does NOT depend on search - only category filter
  const { data: allPartsData, refetch: refetchAllParts } = useQuery({
    queryKey: ["allPartsForTotals", currentBranchId, categoryFilter],
    queryFn: async () => {
      const res = await fetchAllPartsForTotals(categoryFilter);
      if (!res.ok) throw res.error.cause || new Error(res.error.message);
      return res.data;
    },
    staleTime: 30_000, // Cache for 30s to reduce refetches
  });

  const stockHealth = useMemo(
    () => computeStockHealth(allPartsData, currentBranchId, LOW_STOCK_THRESHOLD),
    [allPartsData, currentBranchId]
  );

  const stockQuickFilters = useMemo(
    () => [
      {
        id: "all",
        label: "Tất cả",
        description: "Toàn bộ kho",
        count: stockHealth.totalProducts,
        variant: "neutral" as const,
      },
      {
        id: "in-stock",
        label: "Còn hàng",
        description: "> 0",
        count: stockHealth.inStock,
        variant: "success" as const,
      },
      {
        id: "low-stock",
        label: "Sắp hết",
        description: `<= ${LOW_STOCK_THRESHOLD}`,
        count: stockHealth.lowStock,
        variant: "warning" as const,
      },
      {
        id: "out-of-stock",
        label: "Hết hàng",
        description: "= 0",
        count: stockHealth.outOfStock,
        variant: "danger" as const,
      },
    ],
    [stockHealth]
  );

  // Detect duplicate product SKUs (mã sản phẩm)
  const duplicateSkus = useMemo(
    () => detectDuplicateSkus(allPartsData),
    [allPartsData]
  );

  // Check if a part has duplicate SKU
  const hasDuplicateSku = useCallback(
    (partSku: string) => {
      return duplicateSkus.has(partSku);
    },
    [duplicateSkus]
  );

  // Fetch duplicate parts when filter is enabled
  const { data: duplicatePartsData } = useQuery({
    queryKey: ["duplicateParts", currentBranchId, Array.from(duplicateSkus)],
    queryFn: async () => {
      if (duplicateSkus.size === 0) return [];
      const res = await fetchPartsBySkus(Array.from(duplicateSkus));
      if (!res.ok) throw res.error.cause || new Error(res.error.message);
      return res.data;
    },
    enabled: showDuplicatesOnly && duplicateSkus.size > 0,
    staleTime: 30_000, // Cache for 30s
  });

  // Sau khi chuyển sang server filter, filteredParts = repoParts (có thể thêm client filter tồn kho nếu cần)
  const filteredParts = useMemo(() => {
    let baseList;
    if (showDuplicatesOnly && duplicateSkus.size > 0) {
      baseList = duplicatePartsData || [];
    } else if (stockFilter !== "all") {
      // When filtering by stock status, use allPartsData (stock filter is client-side)
      baseList = allPartsData || [];
    } else {
      // Normal mode: use paginated repoParts (search is done server-side)
      baseList = repoParts;
    }

    if (filterBranchOnly) {
      baseList = baseList.filter((part: any) => isPartInBranch(part, currentBranchId));
    }

    // Client-side multi-keyword search refinement
    // Khi người dùng nhập nhiều từ, filter thêm để chỉ hiện sản phẩm có TẤT CẢ các từ
    if (search && search.trim()) {
      const keywords = search.trim().toLowerCase().split(/\s+/);
      if (keywords.length > 1) {
        baseList = baseList.filter((part: any) => {
          const searchText = `${part.name || ""} ${part.sku || ""} ${part.category || ""
            } ${part.description || ""}`.toLowerCase();
          return keywords.every((keyword) => searchText.includes(keyword));
        });
      }
    }

    // Stock filter
    let filtered = baseList;

    if (stockFilter !== "all") {
      filtered = baseList.filter((part: any) => {
        const available = getAvailable(part, currentBranchId);

        if (stockFilter === "in-stock") return available > 0;
        if (stockFilter === "low-stock")
          return available > 0 && available <= LOW_STOCK_THRESHOLD;
        if (stockFilter === "out-of-stock") return available === 0;
        return true;
      });
    }

    // Apply sorting if sortField is set
    if (sortField) {
      const branchKey = currentBranchId || "";
      const sortedFiltered = [...filtered];
      sortedFiltered.sort((a: any, b: any) => {
        let aVal, bVal;

        if (sortField === "name") {
          aVal = a.name?.toLowerCase() || "";
          bVal = b.name?.toLowerCase() || "";
        } else if (sortField === "sku") {
          aVal = a.sku?.toLowerCase() || "";
          bVal = b.sku?.toLowerCase() || "";
        } else if (sortField === "category") {
          aVal = a.category?.toLowerCase() || "";
          bVal = b.category?.toLowerCase() || "";
        } else if (sortField === "stock") {
          aVal = a.stock?.[branchKey] || 0;
          bVal = b.stock?.[branchKey] || 0;
        } else if (sortField === "costPrice") {
          aVal = a.costPrice?.[branchKey] || 0;
          bVal = b.costPrice?.[branchKey] || 0;
        } else if (sortField === "retailPrice") {
          aVal = a.retailPrice?.[branchKey] || 0;
          bVal = b.retailPrice?.[branchKey] || 0;
        } else if (sortField === "laborCost") {
          const hasLaborA = Object.prototype.hasOwnProperty.call(a, "laborCost");
          const hasLaborB = Object.prototype.hasOwnProperty.call(b, "laborCost");
          aVal = hasLaborA
            ? (a as any).laborCost?.[branchKey] || 0
            : a.wholesalePrice?.[branchKey] || 0;
          bVal = hasLaborB
            ? (b as any).laborCost?.[branchKey] || 0
            : b.wholesalePrice?.[branchKey] || 0;
        } else if (sortField === "totalValue") {
          const stockA = a.stock?.[branchKey] || 0;
          const stockB = b.stock?.[branchKey] || 0;
          const costA = a.costPrice?.[branchKey] || 0;
          const costB = b.costPrice?.[branchKey] || 0;
          aVal = stockA * costA;
          bVal = stockB * costB;
        } else {
          return 0;
        }

        if (typeof aVal === "string" && typeof bVal === "string") {
          return sortDirection === "asc"
            ? aVal.localeCompare(bVal, "vi")
            : bVal.localeCompare(aVal, "vi");
        } else {
          return sortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }
      });
      return sortedFiltered;
    }

    return filtered;
  }, [
    repoParts,
    allPartsData,
    showDuplicatesOnly,
    duplicateSkus,
    duplicatePartsData,
    stockFilter,
    currentBranchId,
    search,
    filterBranchOnly,
    sortField,
    sortDirection,
  ]);

  const totalPages = useMemo(() => {
    if (isClientFiltering) {
      return Math.max(1, Math.ceil(filteredParts.length / pageSize));
    }
    return Math.max(1, Math.ceil(totalParts / pageSize));
  }, [isClientFiltering, filteredParts.length, totalParts, pageSize]);

  const displayedParts = useMemo(() => {
    if (isClientFiltering) {
      return filteredParts.slice((page - 1) * pageSize, page * pageSize);
    }
    return filteredParts;
  }, [isClientFiltering, filteredParts, page, pageSize]);

  // Tổng số lượng + giá trị tồn (một lần lặp, kẹp available không âm).
  const stockTotals = useMemo(
    () => computeTotals(allPartsData, currentBranchId),
    [allPartsData, currentBranchId]
  );

  const latestImportPriceByPart = useMemo(() => {
    const map: Record<string, number> = {};
    for (const tx of invTx || []) {
      if (tx.type !== "Nhập kho") continue;
      const partId = String((tx as any).partId || "").trim();
      if (!partId) continue;
      // use first non-zero import price from newest transactions
      const unitPrice = Number((tx as any).unitPrice || 0);
      if (unitPrice > 0 && map[partId] == null) {
        map[partId] = unitPrice;
      }
    }
    return map;
  }, [invTx]);

  const historyTransactions = useMemo<InventoryTransaction[]>(() => {
    if ((invTx || []).length > 0) {
      return invTx;
    }

    const receiptCodeRegex = /NH-\d{8}-[A-Z0-9]{3,4}/i;
    return (supplierDebts || [])
      .filter((debt: any) => {
        if (currentBranchId && debt?.branchId && debt.branchId !== currentBranchId) {
          return false;
        }
        const description = String(debt?.description || "");
        return receiptCodeRegex.test(description);
      })
      .map((debt: any) => {
        const description = String(debt?.description || "");
        const match = description.match(receiptCodeRegex);
        const receiptCode = match?.[0]?.toUpperCase() || "NH-UNKNOWN";
        const total = Number(debt?.totalAmount || 0);
        const supplierName = String(debt?.supplierName || "Không xác định");
        const debtId = String(debt?.id || "").trim();

        return {
          id: debtId ? `fallback-debt-${debtId}` : `fallback-debt-${receiptCode}`,
          type: "Nhập kho",
          partId: "",
          partName: `Phiếu nhập ${receiptCode}`,
          quantity: 1,
          date: debt?.createdDate || new Date().toISOString(),
          unitPrice: total,
          totalPrice: total,
          branchId: debt?.branchId || currentBranchId || "",
          notes: `${receiptCode} | NCC: ${supplierName} | Fallback từ công nợ NCC`,
        } as InventoryTransaction;
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invTx, supplierDebts, currentBranchId]);

  return {
    // queries
    partsLoading,
    refetchInventory,
    repoParts,
    totalParts,
    allPartsData,
    refetchAllParts,
    workOrders,
    // derived
    stockHealth,
    stockQuickFilters,
    duplicateSkus,
    hasDuplicateSku,
    filteredParts,
    totalPages,
    displayedParts,
    totalStockQuantity: stockTotals.totalQuantity,
    totalStockValue: stockTotals.totalValue,
    latestImportPriceByPart,
    historyTransactions,
  };
}
