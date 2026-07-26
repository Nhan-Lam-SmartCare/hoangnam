/* eslint-disable max-lines */
/* eslint-disable max-lines-per-function */
/* eslint-disable complexity */
// Đã refactor 3178 -> ~1100 dòng: logic nằm ở ./hooks/*, UI con ở ./components/*.
// File này giờ là orchestrator (state UI nhỏ + ghép layout/modals). Còn vượt
// ngưỡng max-lines (800) do khối JSX modals/tab — sẽ giảm tiếp khi tách modals.
import React, {
  useState,
  useEffect,
  useMemo,
} from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";
import {
  Search,
  FileText,
  Plus,
  Repeat,
  UploadCloud,
  DownloadCloud,
  ShoppingCart,
  ScanLine,
} from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
// import { safeAudit } from "../../lib/repository/auditLogsRepository";
import { useQueryClient } from "@tanstack/react-query";
import {
  useCreatePartRepo,
  useUpdatePartRepo,
  useDeletePartRepo,
} from "../../hooks/usePartsRepository";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import { useConfirm } from "../../hooks/useConfirm";
import ConfirmModal from "../common/ConfirmModal";
import CategoriesManager from "../categories/CategoriesManager";
import { useCreateInventoryTxRepo } from "../../hooks/useInventoryTransactionsRepository";
import { useUpdateWorkOrderAtomicRepo } from "../../hooks/useWorkOrdersRepository";
import { useCategories } from "../../hooks/useCategories";
import type { Part, WorkOrder } from "../../types";
import InventoryHistorySectionMobile from "../inventory/InventoryHistorySectionMobile";
import BatchPrintBarcodeModal from "../inventory/BatchPrintBarcodeModal";
import BarcodeScannerModal from "../common/BarcodeScannerModal";
import { PurchaseOrdersList } from "../purchase-orders/PurchaseOrdersList";
import CreatePOModal from "../purchase-orders/CreatePOModal";
import { PODetailView } from "../purchase-orders/PODetailView";
import { ExternalDataImport } from "../inventory/ExternalDataImport";
import type { PurchaseOrder } from "../../types";
import EditReceiptModal from "./modals/EditReceiptModal";
// Extracted modals
import GoodsReceiptMobileWrapper from "./modals/GoodsReceiptMobileWrapper";
import GoodsReceiptModal from "./modals/GoodsReceiptModal";
import InventoryHistorySection from "./InventoryHistorySection";
import ImportInventoryModal from "./modals/ImportInventoryModal";
import EditPartModal from "./modals/EditPartModal";
import { LOW_STOCK_THRESHOLD } from "./constants";
import StockTableRow from "./components/StockTableRow";
import StockMobileList from "./components/StockMobileList";
import StockTableHeader from "./components/StockTableHeader";
import ImeiSearchResults from "./components/ImeiSearchResults";
import { usePartUnitCounts } from "../../hooks/usePartUnitsRepository";
import InventoryPagination from "./components/InventoryPagination";
import InventoryTabs from "./components/InventoryTabs";
import InventoryBottomNav from "./components/InventoryBottomNav";
import InventoryToolbar from "./components/InventoryToolbar";
import { useInventoryExcelActions } from "./hooks/useInventoryExcelActions";
import { usePartActions } from "./hooks/usePartActions";
import { useInventoryImport } from "./hooks/useInventoryImport";
import { useInventoryFilters } from "./hooks/useInventoryFilters";
import { useInventoryData } from "./hooks/useInventoryData";
import { useGoodsReceiptActions } from "./hooks/useGoodsReceiptActions";
import { useBranchesRepo } from "../../hooks/useBranchesRepository";
import { isPhoneBranch } from "../../utils/branchUtils";

// Main Inventory Manager Component (New)
const InventoryManagerNew: React.FC = () => {
  const { currentBranchId } = useAppContext();
  const { data: branches = [] } = useBranchesRepo();
  const hideLaborCost = isPhoneBranch(currentBranchId, branches);
  const [searchParams, setSearchParams] = useSearchParams();
  // Supabase repository mutation for inventory transactions
  useCreateInventoryTxRepo();
  const { mutate: updateWorkOrderAtomic } = useUpdateWorkOrderAtomicRepo();
  const [activeTab, setActiveTab] = useState("stock"); // stock, categories, history, purchase-orders
  const [showGoodsReceipt, setShowGoodsReceipt] = useState(false);
  const [showCreatePO, setShowCreatePO] = useState(false);
  const [selectedPO, setSelectedPO] = useState<PurchaseOrder | null>(null);
  const [editingPO, setEditingPO] = useState<PurchaseOrder | null>(null); // ✅ New state for editing PO

  // P4: toàn bộ state lọc/tìm kiếm/sắp xếp/phân trang tách ra hook tự chứa.
  // Giữ nguyên object `filters` để truyền gọn cho InventoryToolbar.
  const filters = useInventoryFilters();
  const {
    searchInput,
    setSearchInput,
    search,
    setSearch,
    categoryFilter,
    setCategoryFilter,
    stockFilter,
    setStockFilter,
    showDuplicatesOnly,
    setShowDuplicatesOnly,
    filterBranchOnly,
    page,
    setPage,
    pageSize,
    setPageSize,
    sortField,
    sortDirection,
    handleSort,
    isClientFiltering,
  } = filters;

  const [showBarcodeScanner, setShowBarcodeScanner] = useState(false);
  const [editingPart, setEditingPart] = useState<Part | null>(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [reservedInfoPartId, setReservedInfoPartId] = useState<string | null>(null);
  const [showExternalImport, setShowExternalImport] = useState(false);
  const [showBatchPrintModal, setShowBatchPrintModal] = useState(false);
  const [batchPrintInitialQuantities, setBatchPrintInitialQuantities] = useState<Record<string, number> | undefined>(undefined);
  const [mobileMenuOpenIndex, setMobileMenuOpenIndex] = useState<number | null>(
    null
  );
  const [openActionRow, setOpenActionRow] = useState<string | null>(null);
  // Chỉ bung MỘT dòng: mở nhiều dòng cùng lúc sẽ đẩy bảng dài ra và mỗi dòng
  // lại là một query riêng.
  const [expandedPartId, setExpandedPartId] = useState<string | null>(null);
  const [inventoryDropdownPos, setInventoryDropdownPos] = useState({
    top: 0,
    right: 0,
  });

  useEffect(() => {
    if (activeTab === "lookup" || activeTab === "external-lookup") {
      setActiveTab("stock");
    }
  }, [activeTab]);





  // Confirm dialog hook
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();

  // Read filters from URL query params and switch to stock tab
  useEffect(() => {
    const stockParam = searchParams.get("stock");
    const categoryParam = searchParams.get("category");

    // If coming from category click, switch to stock tab and apply filters
    if (stockParam || categoryParam) {
      setActiveTab("stock");

      if (
        stockParam &&
        ["all", "in-stock", "low-stock", "out-of-stock"].includes(stockParam)
      ) {
        setStockFilter(stockParam);
      }

      if (categoryParam) {
        setCategoryFilter(decodeURIComponent(categoryParam));
      }

      // Clear the query params after applying
      const newParams = new URLSearchParams(searchParams);
      newParams.delete("stock");
      newParams.delete("category");
      setSearchParams(newParams, { replace: true });
    }
  }, [searchParams, setSearchParams]); // Re-run when URL changes

  // Read tab parameter from URL query params
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (
      tabParam &&
      ["stock", "categories", "history", "purchase-orders"].includes(tabParam)
    ) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  // P4: toàn bộ tầng dữ liệu (queries + memo dẫn xuất) tách ra hook.
  const {
    partsLoading,
    refetchInventory,
    repoParts,
    totalParts,
    allPartsData,
    refetchAllParts,
    workOrders,
    stockHealth,
    stockQuickFilters,
    duplicateSkus,
    hasDuplicateSku,
    filteredParts,
    totalPages,
    displayedParts,
    totalStockQuantity,
    totalStockValue,
    latestImportPriceByPart,
    historyTransactions,
  } = useInventoryData({
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
  });

  // Auto-disable duplicate filter when no duplicates remain
  useEffect(() => {
    if (showDuplicatesOnly && duplicateSkus.size === 0) {
      setShowDuplicatesOnly(false);
    }
  }, [showDuplicatesOnly, duplicateSkus.size, setShowDuplicatesOnly]);

  // Số máy có IMEI của cả trang, gộp một query — dòng nào có máy thì mới cho bung.
  const displayedPartIds = useMemo(
    () => displayedParts.map((p: Part) => p.id),
    [displayedParts]
  );
  const { data: unitCounts = {} } = usePartUnitCounts(
    displayedPartIds,
    currentBranchId
  );

  // Đổi trang/bộ lọc thì dòng đang bung có thể không còn trên màn -> đóng lại.
  useEffect(() => {
    if (expandedPartId && !displayedPartIds.includes(expandedPartId)) {
      setExpandedPartId(null);
    }
  }, [expandedPartId, displayedPartIds]);

  const queryClient = useQueryClient();
  const updatePartMutation = useUpdatePartRepo();
  useCreatePartRepo();
  const deletePartMutation = useDeletePartRepo();
  const { data: allCategories = [] } = useCategories();

  const { profile } = useAuth();
  const canImportInventory = canDo(profile, "inventory.import");
  const canTransferInventory = canDo(profile, "inventory.transfer");
  const canExportInventoryExcel = canDo(profile, "inventory.export_excel");
  const canImportFile = canDo(profile, "inventory.import.file");
  const canViewInventoryHistory = canDo(profile, "inventory.history.view");
  const canPrintBarcode = canDo(profile, "inventory.barcode.print");
  const canUpdatePart =
    canDo(profile, "part.update") || canDo(profile, "part.update_price");
  const canDeletePart = canDo(profile, "part.delete");
  const canViewImportPrice = canDo(profile, "inventory.view_import_price");
  const canEditReceipt = canDo(profile, "inventory.receipt.edit");
  const canDeleteReceipt = canDo(profile, "inventory.receipt.delete");

  // P4: thao tác Excel (xuất tồn kho + tải template) tách ra hook.
  const { handleExportExcel, handleDownloadTemplate } = useInventoryExcelActions({
    canExportInventoryExcel,
    repoParts,
    currentBranchId,
  });

  // P4: chọn nhiều + xóa/xóa hàng loạt/sửa nhanh bảo hành tách ra hook.
  const {
    selectedItems,
    setSelectedItems,
    handleSelectAll,
    handleSelectItem,
    handleDeleteItem,
    handleQuickWarrantyEdit,
    handleBulkDelete,
  } = usePartActions({
    displayedParts,
    repoParts,
    canUpdatePart,
    canDeletePart,
    confirm,
    deletePartMutation,
    updatePartMutation,
    refetchAllParts,
    onCloseMenus: () => {
      setOpenActionRow(null);
      setMobileMenuOpenIndex(null);
    },
  });

  // P4: import tồn kho từ file Excel tách ra hook.
  const { handleImportExcel } = useInventoryImport({
    currentBranchId,
    onImported: () => setShowImportModal(false),
  });

  // P4: nghiệp vụ phiếu nhập kho (tạo/sửa/xóa) tách ra hook.
  const {
    editingReceipt,
    setEditingReceipt,
    handleSaveGoodsReceipt,
    handleSaveEditedReceipt,
    handleDeleteReceipt,
  } = useGoodsReceiptActions({
    currentBranchId,
    profile,
    allPartsData,
    canDeleteReceipt,
    confirm,
    refetchAllParts,
    refetchInventory,
    onReceiptSaved: () => setShowGoodsReceipt(false),
  });

  useEffect(() => {
    if (activeTab === "history" && !canViewInventoryHistory) {
      setActiveTab("stock");
    }
  }, [activeTab, canViewInventoryHistory]);

  const handleOpenBatchPrintModal = (onlySelected: boolean) => {
    if (!onlySelected || selectedItems.length === 0) {
      setBatchPrintInitialQuantities(undefined);
      setShowBatchPrintModal(true);
      return;
    }

    const initialQuantities = selectedItems.reduce<Record<string, number>>(
      (acc, partId) => {
        acc[partId] = 1;
        return acc;
      },
      {}
    );
    setBatchPrintInitialQuantities(initialQuantities);
    setShowBatchPrintModal(true);
  };

  const handleCloseBatchPrintModal = () => {
    setShowBatchPrintModal(false);
    setBatchPrintInitialQuantities(undefined);
  };

  useEffect(() => {
    if (categoryFilter === "all") return;
    const hasCategory = (allCategories || []).some(
      (cat: any) => cat?.name === categoryFilter
    );
    if (!hasCategory) {
      setCategoryFilter("all");
    }
  }, [categoryFilter, allCategories, setCategoryFilter]);

  const shouldShowLowStockBanner =
    stockHealth.lowStock > 0 && stockFilter !== "low-stock";

  // Handle export to Excel
  const handleTransferInventory = () => {
    if (!canTransferInventory) {
      showToast.error("Bạn không có quyền chuyển kho");
      return;
    }

    showToast.info("Tính năng chuyển kho đang phát triển");
  };

  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleDocumentClick = () => setOpenActionRow(null);
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, []);

  return (
    <div className="h-full flex flex-col bg-slate-50 dark:bg-slate-900 sm:bg-[#1e293b]">
      {/* Desktop Header - Compact */}
      <div className="hidden sm:block bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-1.5">
        <div className="flex items-center justify-between gap-3">
          {/* Tabs - Compact */}
          <InventoryTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            canViewInventoryHistory={canViewInventoryHistory}
          />

          {/* Action Buttons - Compact */}
          <div className="flex items-center gap-2">
            {canPrintBarcode && (
              <button
                onClick={() => handleOpenBatchPrintModal(selectedItems.length > 0)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition"
                title={selectedItems.length > 0 ? `In mã vạch ${selectedItems.length} sản phẩm đã chọn` : "In mã vạch hàng loạt"}
              >
                <svg
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                  />
                </svg>
                In mã vạch
              </button>
            )}

            {canImportInventory && (
              <button
                onClick={() => setShowGoodsReceipt(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition"
              >
                <Plus className="w-3.5 h-3.5" />
                Tạo phiếu nhập
              </button>
            )}
            <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-700 px-1 py-0.5">
              {canTransferInventory && (
                <button
                  disabled
                  onClick={handleTransferInventory}
                  className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 opacity-40 cursor-not-allowed transition"
                  title="Chuyển kho (Coming soon)"
                >
                  <Repeat className="w-3.5 h-3.5" />
                </button>
              )}
              {canExportInventoryExcel && (
                <button
                  onClick={handleExportExcel}
                  className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-emerald-600 hover:bg-white dark:bg-slate-800 transition"
                  title="Xuất Excel"
                >
                  <UploadCloud className="w-3.5 h-3.5" />
                </button>
              )}
              {canImportFile && (
                <>
                  <button
                    onClick={() => setShowImportModal(true)}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:bg-slate-800 transition"
                    title="Nhập CSV"
                  >
                    <DownloadCloud className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => setShowExternalImport(true)}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-blue-600 hover:bg-white dark:bg-slate-800 transition"
                    title="Nhập dữ liệu từ bên ngoài"
                  >
                    <UploadCloud className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={handleDownloadTemplate}
                    className="p-1.5 rounded-md text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-white dark:bg-slate-800 transition"
                    title="Tải mẫu import"
                  >
                    <FileText className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Header - Compact & Clean */}
      <div className="sm:hidden bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 px-3 py-3">
        {/* Search and Create Button Row */}
        <div className="flex items-center gap-2 mb-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, SKU, danh mục..."
              value={searchInput}
              onChange={(e) => {
                setPage(1);
                setSearchInput(e.target.value);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" && searchInput.trim()) {
                  // Search on Enter
                  setSearch(searchInput);
                }
              }}
              className="w-full pl-10 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Barcode Scan Button */}
          <button
            onClick={() => setShowBarcodeScanner(true)}
            className="p-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
            title="Quét mã vạch"
          >
            <ScanLine className="w-5 h-5" />
          </button>

          {/* Create Button */}
          {canImportInventory && (
            <button
              onClick={() => setShowGoodsReceipt(true)}
              className="flex items-center gap-1.5 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Tạo phiếu
            </button>
          )}
        </div>

        {/* Inline Stats */}
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-400">Tổng:</span>
              <span className="font-semibold text-blue-600 dark:text-blue-400">
                {totalStockQuantity.toLocaleString()} sp
              </span>
            </div>
            <div className="h-3 w-px bg-slate-300 dark:bg-slate-600"></div>
            <div className="flex items-center gap-1">
              <span className="text-slate-600 dark:text-slate-400">
                Giá trị:
              </span>
              <span className="font-semibold text-green-600 dark:text-green-400">
                {formatCurrency(totalStockValue)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Filters - Compact for small screens */}
      {activeTab === "stock" && (
        <InventoryToolbar
          filters={filters}
          totalStockQuantity={totalStockQuantity}
          totalStockValue={totalStockValue}
          filteredCount={filteredParts.length}
          totalParts={totalParts}
          stockQuickFilters={stockQuickFilters}
          lowStockCount={stockHealth.lowStock}
          shouldShowLowStockBanner={shouldShowLowStockBanner}
          allCategories={allCategories}
        />
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-2 sm:p-3">
        {activeTab === "stock" && (
          <div className="space-y-2">
            {!partsLoading && totalParts === 0 && historyTransactions.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                Lịch sử nhập kho đang có dữ liệu nhưng danh sách tồn kho đang rỗng. Nguyên nhân thường gặp: bộ lọc đang bật hoặc dữ liệu sản phẩm đã bị thiếu. Hãy thử "Xóa lọc" để kiểm tra trước.
              </div>
            )}
            {/* Duplicate Warning Banner - More compact */}
            {duplicateSkus.size > 0 && (
              <div className="bg-orange-50 dark:bg-orange-900/20 border-l-4 border-orange-500 px-3 py-2 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>⚠️</span>
                  <span className="text-xs font-semibold text-orange-800 dark:text-orange-300">
                    Phát hiện {duplicateSkus.size} sản phẩm trùng mã
                  </span>
                </div>
                <button
                  onClick={() => setShowDuplicatesOnly(!showDuplicatesOnly)}
                  className={`px-2 py-0.5 rounded text-[10px] font-medium transition ${showDuplicatesOnly
                    ? "bg-orange-600 text-white"
                    : "bg-orange-100 dark:bg-orange-900/40 text-orange-800 dark:text-orange-300"
                    }`}
                >
                  {showDuplicatesOnly ? "✓ Đang lọc" : "🔍 Lọc"}
                </button>
              </div>
            )}

            {/* Stock Table + Pagination */}
            <div className="rounded-lg overflow-hidden bg-white dark:bg-slate-800">
              {/* Bulk Actions Bar */}
              {selectedItems.length > 0 && (
                <div className="px-4 py-2 bg-blue-100 dark:bg-blue-900/30 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                  <div className="text-xs font-medium text-blue-900 dark:text-blue-100">
                    Đã chọn {selectedItems.length} sản phẩm
                  </div>
                  <div className="flex items-center gap-2">
                    {canPrintBarcode && (
                      <button
                        onClick={() => handleOpenBatchPrintModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                          />
                        </svg>
                        In mã vạch ({selectedItems.length})
                      </button>
                    )}
                    <button
                      onClick={() => {
                        setShowCreatePO(true);
                      }}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      Đặt hàng ({selectedItems.length})
                    </button>
                    <button
                      onClick={handleBulkDelete}
                      className="flex items-center gap-2 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Xóa đã chọn
                    </button>
                  </div>
                </div>
              )}

              {/* Tra IMEI: dùng chung ô tìm kiếm, hiện trên cả 2 layout */}
              <ImeiSearchResults keyword={search} branchId={currentBranchId} />

              {/* Mobile: stacked cards (visible on small screens) */}
              <StockMobileList
                parts={displayedParts}
                branchId={currentBranchId}
                lowStockThreshold={LOW_STOCK_THRESHOLD}
                openMenuIndex={mobileMenuOpenIndex}
                canUpdatePart={canUpdatePart}
                canDeletePart={canDeletePart}
                hideLaborCost={hideLaborCost}
                unitCounts={unitCounts}
                expandedPartId={expandedPartId}
                onToggleExpand={(id) =>
                  setExpandedPartId((prev) => (prev === id ? null : id))
                }
                isDuplicateSku={hasDuplicateSku}
                onToggleMenu={(index) =>
                  setMobileMenuOpenIndex((prev) =>
                    prev === index ? null : index
                  )
                }
                onEdit={(p) => {
                  setEditingPart(p);
                  setMobileMenuOpenIndex(null);
                }}
                onQuickWarranty={handleQuickWarrantyEdit}
                onDelete={(id) => {
                  handleDeleteItem(id);
                  setMobileMenuOpenIndex(null);
                }}
              />

              {/* Desktop / tablet: wide table (hidden on small screens) */}
              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full">
                  <StockTableHeader
                    sortField={sortField}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    canViewImportPrice={canViewImportPrice}
                    allSelected={
                      displayedParts.length > 0 &&
                      displayedParts.every((p) => selectedItems.includes(p.id))
                    }
                    hideLaborCost={hideLaborCost}
                    onSelectAll={handleSelectAll}
                  />
                  <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-100 dark:divide-slate-700">
                    {filteredParts.length === 0 ? (
                      <tr>
                        <td
                          colSpan={canViewImportPrice ? (hideLaborCost ? 7 : 8) : (hideLaborCost ? 6 : 7)}
                          className="px-4 py-6 text-center text-slate-400 dark:text-slate-500"
                        >
                          <div className="text-4xl mb-2">🗂️</div>
                          <div className="text-sm">Không có sản phẩm nào</div>
                          <div className="text-xs">
                            Hãy thử một bộ lọc khác hoặc thêm sản phẩm mới
                          </div>
                        </td>
                      </tr>
                    ) : (
                      displayedParts.map((part) => (
                        <StockTableRow
                          key={part.id}
                          part={part}
                          branchId={currentBranchId}
                          lowStockThreshold={LOW_STOCK_THRESHOLD}
                          latestImportPrice={latestImportPriceByPart[part.id] || 0}
                          isSelected={selectedItems.includes(part.id)}
                          isDuplicate={hasDuplicateSku(part.sku || "")}
                          isActionsOpen={openActionRow === part.id}
                          dropdownPos={inventoryDropdownPos}
                          canViewImportPrice={canViewImportPrice}
                          canUpdatePart={canUpdatePart}
                          canDeletePart={canDeletePart}
                          hideLaborCost={hideLaborCost}
                          unitCount={unitCounts[part.id] || 0}
                          isExpanded={expandedPartId === part.id}
                          onToggleExpand={(id) =>
                            setExpandedPartId((prev) => (prev === id ? null : id))
                          }
                          onToggleSelect={handleSelectItem}
                          onShowReservedInfo={setReservedInfoPartId}
                          onToggleActions={(id, pos) => {
                            setInventoryDropdownPos(pos);
                            setOpenActionRow((prev) => (prev === id ? null : id));
                          }}
                          onEdit={(p) => {
                            setEditingPart(p);
                            setOpenActionRow(null);
                          }}
                          onQuickWarranty={handleQuickWarrantyEdit}
                          onDelete={(id) => {
                            setOpenActionRow(null);
                            handleDeleteItem(id);
                          }}
                        />
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Controls */}
              <InventoryPagination
                page={page}
                totalPages={totalPages}
                pageSize={pageSize}
                totalCount={isClientFiltering ? filteredParts.length : totalParts}
                isLoading={partsLoading}
                onPrev={() => setPage((p) => Math.max(1, p - 1))}
                onNext={() => setPage((p) => Math.min(totalPages, p + 1))}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setPage(1);
                }}
              />
            </div>
          </div>
        )}

        {activeTab === "history" && canViewInventoryHistory && (
          <>
            {/* Desktop Version */}
            <div className="hidden sm:block">
              <InventoryHistorySection
                transactions={historyTransactions}
                canViewImportPrice={canViewImportPrice}
                canEditReceipt={canEditReceipt}
                canDeleteReceipt={canDeleteReceipt}
                canPrintBarcode={canPrintBarcode}
                onEdit={
                  canEditReceipt
                    ? (receipt) => setEditingReceipt(receipt)
                    : undefined
                }
              />
            </div>
            {/* Mobile Version */}
            <div className="sm:hidden">
              <InventoryHistorySectionMobile
                transactions={historyTransactions}
                canViewImportPrice={canViewImportPrice}
                canEditReceipt={canEditReceipt}
                canDeleteReceipt={canDeleteReceipt}
                onEdit={canEditReceipt ? (receipt) => {
                  // Reconstruct the receipt object for editing
                  // We need to find the original transaction or construct a compatible object
                  // For now, we'll use the receipt object passed from the mobile component
                  // which has { receiptCode, date, supplier, items, total }
                  setEditingReceipt(receipt);
                } : undefined}
                onDelete={canDeleteReceipt ? (receipt) => {
                  handleDeleteReceipt(receipt.receiptCode);
                } : undefined}
              />
            </div>
          </>
        )}

        {activeTab === "categories" && (
          <div className="bg-[#0f172a] -m-3 sm:-m-6">
            <CategoriesManager />
          </div>
        )}

        {activeTab === "purchase-orders" && (
          <div className="bg-white dark:bg-slate-800 p-4 rounded-lg">
            {selectedPO ? (
              <PODetailView
                poId={selectedPO.id}
                onClose={() => setSelectedPO(null)}
                onConverted={() => {
                  setSelectedPO(null);
                  refetchInventory();
                }}
              />
            ) : (
              <PurchaseOrdersList
                onCreateNew={() => {

                  setShowCreatePO(true);
                }}
                onViewDetail={(po) => setSelectedPO(po)}
                onEdit={(po) => setEditingPO(po)}
              />
            )}
          </div>
        )}

      </div>

      {/* Modals */}
      {/* Desktop Version - Original */}
      <div className="hidden sm:block">
        <GoodsReceiptModal
          isOpen={showGoodsReceipt}
          onClose={() => setShowGoodsReceipt(false)}
          parts={allPartsData || []}
          currentBranchId={currentBranchId}
          canViewImportPrice={canViewImportPrice}
          onSave={handleSaveGoodsReceipt}
        />
      </div>

      {/* Mobile Version - New 2-step design */}
      <div className="sm:hidden">
        <GoodsReceiptMobileWrapper
          isOpen={showGoodsReceipt}
          onClose={() => setShowGoodsReceipt(false)}
          parts={allPartsData || []}
          currentBranchId={currentBranchId}
          canViewImportPrice={canViewImportPrice}
          onSave={handleSaveGoodsReceipt}
        />
      </div>

      {/* Batch Print Barcode Modal */}
      {showBatchPrintModal && canPrintBarcode && (
        <BatchPrintBarcodeModal
          parts={allPartsData || []}
          currentBranchId={currentBranchId}
          onClose={handleCloseBatchPrintModal}
          initialQuantities={batchPrintInitialQuantities}
        />
      )}

      {/* Edit Part Modal */}
      {reservedInfoPartId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 animate-in fade-in duration-200">
          <div className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between bg-slate-50 dark:bg-slate-900/50">
              <h3 className="font-semibold text-slate-800 dark:text-slate-200">
                Chi tiết hàng đang đặt trước
              </h3>
              <button
                onClick={() => setReservedInfoPartId(null)}
                className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
              >
                <div className="h-5 w-5 flex items-center justify-center text-slate-500">✕</div>
              </button>
            </div>
            <div className="p-0 max-h-[60vh] overflow-y-auto">
              {(() => {
                const part = allPartsData?.find(p => p.id === reservedInfoPartId);

                // Debug logging

                const reservingOrders = workOrders.filter((wo: WorkOrder) => {
                  if (!wo.partsUsed) return false;

                  // Check if part exists in Work Order
                  const hasPart = wo.partsUsed.some(p => p.partId === reservedInfoPartId);

                  // Logic reserved: 
                  // Chỉ những phiếu CHƯA THANH TOÁN (unpaid/partial) và KHÔNG HỦY mới giữ hàng (Reserved).
                  // Nếu đã thanh toán (paid), hàng đã bị trừ kho (Deducted) nên không còn là Reserved nữa.
                  const isNotCancelled = wo.status !== "Đã hủy";
                  const isNotPaid = wo.paymentStatus !== "paid";

                  return hasPart && isNotCancelled && isNotPaid;
                });


                if (!part) return <div className="p-6 text-center text-slate-500">Không tìm thấy thông tin sản phẩm</div>;

                // const { mutate: updateWorkOrderAtomic } = useUpdateWorkOrderAtomicRepo(); // Moved to top level

                const handleQuickPay = (orderId: string) => {
                  if (window.confirm("Xác nhận đánh dấu phiếu này là ĐÃ THANH TOÁN? Việc này sẽ giải phóng tồn kho đang giữ.")) {
                    updateWorkOrderAtomic({
                      id: orderId,
                      paymentStatus: "paid",
                      totalPaid: reservingOrders.find(wo => wo.id === orderId)?.total || 0,
                    } as any);
                  }
                };

                if (reservingOrders.length === 0) {
                  return (
                    <div className="p-8 text-center flex flex-col items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                        <span className="text-2xl">✓</span>
                      </div>
                      <p className="text-slate-600 dark:text-slate-400">
                        Không tìm thấy phiếu nào đang giữ hàng này.
                      </p>
                      <p className="text-xs text-slate-500">
                        (Có thể số liệu "Đặt trước" trong kho đang bị lệch so với thực tế)
                      </p>
                      {/* Debug Info */}
                      <div className="mt-4 p-2 bg-slate-100 dark:bg-slate-900 rounded text-[10px] text-slate-400 font-mono text-left w-full overflow-hidden">
                        Part Reserved Qty: {part.reservedStock?.[currentBranchId] || 0} <br />
                        Nghi vấn: Số liệu bị lệch. Hãy thử tạo phiếu mới rồi xóa để reset.
                      </div>
                    </div>
                  );
                }

                return (
                  <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    <div className="bg-blue-50/50 dark:bg-blue-900/10 p-3 border-b border-blue-100 dark:border-blue-900/30">
                      <p className="text-sm text-slate-700 dark:text-slate-300">
                        Sản phẩm: <span className="font-semibold text-blue-600 dark:text-blue-400">{part.name}</span>
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Tổng đang giữ: <span className="font-medium text-amber-600">{reservingOrders.reduce((sum, wo) => sum + (wo.partsUsed?.find(p => p.partId === reservedInfoPartId)?.quantity || 0), 0)}</span>
                      </p>
                    </div>
                    {reservingOrders.map((wo: WorkOrder) => {
                      const item = wo.partsUsed?.find(p => p.partId === reservedInfoPartId);
                      return (
                        <div key={wo.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                          <div className="flex justify-between items-start mb-1">
                            <div>
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {wo.customerName}
                              </div>
                              <div className="text-xs text-slate-500 flex gap-2">
                                <span>{wo.vehicleModel || "Xe lai vãng"}</span>
                                {wo.licensePlate && <span>• {wo.licensePlate}</span>}
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className={`px-2 py-0.5 rounded text-[10px] font-medium border
                                 ${wo.status === 'Tiếp nhận' ? 'bg-blue-50 text-blue-600 border-blue-200' :
                                  wo.status === 'Đang sửa' ? 'bg-amber-50 text-amber-600 border-amber-200' :
                                    wo.status === 'Đã sửa xong' ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                                      'bg-slate-100 text-slate-600 border-slate-200'}`}
                              >
                                {wo.status}
                              </div>
                              <div className={`text-[10px] font-bold ${wo.paymentStatus === 'paid' ? 'text-emerald-500' :
                                wo.paymentStatus === 'partial' ? 'text-amber-500' : 'text-red-500'
                                }`}>
                                {wo.paymentStatus === 'paid' ? 'Đã TT' : wo.paymentStatus === 'partial' ? 'TT 1 phần' : 'Chưa TT'}
                              </div>
                              {/* Quick Pay Button - Atomic Fix */}
                              {wo.paymentStatus !== 'paid' && (
                                <button
                                  onClick={() => handleQuickPay(wo.id)}
                                  className="mt-1 px-2 py-1 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 border border-emerald-200 rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                                  title="Đánh dấu đã thanh toán để trừ tồn kho"
                                >
                                  <span>✓ Đã TT & Trừ kho</span>
                                </button>
                              )}
                            </div>
                          </div>
                          <div className="flex justify-between items-center mt-2 text-sm">
                            <span className="text-slate-500 dark:text-slate-400 text-xs">
                              LH: {wo.customerPhone || "---"}
                            </span>
                            <span className="font-medium text-slate-900 dark:text-slate-100 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded">
                              SL: {item?.quantity || 0}
                            </span>
                          </div>
                          <div className="mt-1 text-[10px] text-slate-400">
                            Ngày tạo: {new Date(wo.creationDate).toLocaleString('vi-VN')}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 flex justify-end">
              <button
                onClick={() => setReservedInfoPartId(null)}
                className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Part Modal */}
      {editingPart && (
        <EditPartModal
          part={editingPart}
          onClose={() => setEditingPart(null)}
          onSave={(updatedPart) => {
            // Only send fields that are allowed in database schema
            const updates: Partial<Part> = {
              name: updatedPart.name,
              barcode: updatedPart.barcode,
              category: updatedPart.category,
              stock: updatedPart.stock,
              retailPrice: updatedPart.retailPrice,
              wholesalePrice: updatedPart.wholesalePrice,
              laborCost: (updatedPart as any).laborCost,
              warrantyPeriod: updatedPart.warrantyPeriod,
              imei: updatedPart.imei,
              color: updatedPart.color,
              supplierId: (updatedPart as any).supplierId,
              supplier_id: (updatedPart as any).supplierId,
            } as any;
            // Try to add costPrice if it exists in schema
            if (updatedPart.costPrice) {
              updates.costPrice = updatedPart.costPrice;
            }
            updatePartMutation.mutate({
              id: updatedPart.id,
              updates,
            });
            setEditingPart(null);
          }}
          currentBranchId={currentBranchId}
        />
      )}

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          onClose={() => setEditingReceipt(null)}
          receipt={editingReceipt}
          onSave={handleSaveEditedReceipt}
          currentBranchId={currentBranchId}
        />
      )}

      {/* Import Modal */}
      {showImportModal && (
        <ImportInventoryModal
          onClose={() => setShowImportModal(false)}
          onDownloadTemplate={handleDownloadTemplate}
          onImport={handleImportExcel}
        />
      )}

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmColor={confirmState.confirmColor}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />


      {/* Custom Bottom Navigation for Inventory */}
      <InventoryBottomNav
        activeTab={activeTab}
        onTabChange={setActiveTab}
        canViewInventoryHistory={canViewInventoryHistory}
      />

      {/* Create Purchase Order Modal */}
      {(showCreatePO || editingPO) && (
        <>
          {}
          <CreatePOModal
            isOpen={!!(showCreatePO || editingPO)}
            onClose={() => {
              setShowCreatePO(false);
              setEditingPO(null); // Reset editingPO
              setSelectedItems([]);
            }}
            prefilledPartIds={selectedItems}
            existingPO={editingPO || undefined}
          />
        </>
      )}

      {/* External Import Modal */}
      {showExternalImport && (
        <ExternalDataImport
          onClose={() => setShowExternalImport(false)}
          onImported={() => {
            // Optional: refresh parts if we implement sync later
            // partsRepo.refetch();
          }}
        />
      )}

      {/* Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showBarcodeScanner}
        onClose={() => setShowBarcodeScanner(false)}
        onScan={(barcode: string) => {
          // Set the search term to the scanned barcode
          setSearchInput(barcode);
          setSearch(barcode);
          setPage(1);
        }}
        title="Quét mã sản phẩm"
      />
    </div>
  );
};

export default InventoryManagerNew;
