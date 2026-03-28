import React, { useState, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useAppContext } from '../../contexts/AppContext';
import { useQueryClient } from '@tanstack/react-query';
import { useConfirm } from '../../hooks/useConfirm';
import { useSupplierDebtsRepo } from '../../hooks/useDebtsRepository';
import { usePartsRepo } from '../../hooks/usePartsRepository';
import { useInventoryTxRepo } from '../../hooks/useInventoryTransactionsRepository';
import { useSuppliers } from '../../hooks/useSuppliers';
import { formatCurrency, formatDate } from '../../utils/format';
import { showToast } from '../../utils/toast';
import { supabase } from '../../supabaseClient';
import {
  Boxes, Package, Search, FileText, Filter, Edit, Trash2,
  Plus, Repeat, UploadCloud, DownloadCloud, MoreHorizontal, ShoppingCart,
  Calendar, ArrowUpRight, ArrowDownLeft, X, Check, AlertTriangle, Printer,
  ChevronDown, ChevronUp, ChevronLeft, ChevronRight
} from 'lucide-react';
import ConfirmModal from '../common/ConfirmModal';
import InventoryHistoryModal from './modals/InventoryHistoryModal';
import EditReceiptModal from './components/EditReceiptModal';
import BatchPrintBarcodeModal from './BatchPrintBarcodeModal';
import { InventoryTransaction, Part } from '../../types';
import { canDo } from '../../utils/permissions';
import { getCategoryColor } from '../../utils/categoryColors';

const InventoryHistorySection: React.FC<{
  transactions: InventoryTransaction[];
}> = ({ transactions }) => {
  const { profile } = useAuth();
  const { currentBranchId: branchId } = useAppContext();
  const queryClient = useQueryClient();
  const { confirm, confirmState, handleConfirm, handleCancel } = useConfirm();
  const { data: supplierDebts = [] } = useSupplierDebtsRepo();
  const { data: parts = [] } = usePartsRepo();
  const { data: suppliers = [] } = useSuppliers();
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState(
    formatDate(new Date(), true)
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDate(new Date(), true)
  );
  const [searchTerm, setSearchTerm] = useState("");
  const [editingReceipt, setEditingReceipt] = useState<{
    receiptCode: string;
    date: Date;
    supplier: string;
    items: InventoryTransaction[];
    total: number;
  } | null>(null);
  const { currentBranchId } = useAppContext();

  const filteredTransactions = useMemo(() => {
    // CHỈ LẤY GIAO DỊCH NHẬP KHO
    console.log(
      "📦 [InventoryHistorySection] Tổng số giao dịch:",
      transactions.length
    );
    let filtered = transactions.filter((t) => t.type === "Nhập kho");
    console.log(
      "📦 [InventoryHistorySection] Giao dịch 'Nhập kho':",
      filtered.length
    );
    const now = new Date();

    // Apply time filter
    switch (activeTimeFilter) {
      case "7days":
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.date) >= sevenDaysAgo);
        break;
      case "30days":
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000
        );
        filtered = filtered.filter((t) => new Date(t.date) >= thirtyDaysAgo);
        break;
      case "thisMonth":
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
        break;
      case "custom":
        filtered = filtered.filter((t) => {
          const date = new Date(t.date);
          return (
            date >= new Date(customStartDate) && date <= new Date(customEndDate)
          );
        });
        break;
    }

    // Apply search filter
    if (searchTerm) {
      const q = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.partName.toLowerCase().includes(q) ||
          (t.notes && t.notes.toLowerCase().includes(q))
      );
    }

    return filtered.sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
  }, [
    transactions,
    activeTimeFilter,
    customStartDate,
    customEndDate,
    searchTerm,
  ]);

  const totalAmount = useMemo(() => {
    return filteredTransactions.reduce((sum, t) => sum + t.totalPrice, 0);
  }, [filteredTransactions]);

  // Group transactions by receipt (same date, same supplier/notes)
  const groupedReceipts = useMemo(() => {
    const groups = new Map<string, InventoryTransaction[]>();

    filteredTransactions.forEach((transaction) => {
      // Create a group key based on date and supplier
      const date = new Date(transaction.date);
      const dateKey = `${date.getFullYear()}-${String(
        date.getMonth() + 1
      ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      // Get supplier from supplierId or fallback to notes
      const supplier = transaction.supplierId 
        ? (suppliers.find((s: any) => s.id === transaction.supplierId)?.name || "Không xác định")
        : (transaction.notes?.includes("NCC:")
          ? transaction.notes.split("NCC:")[1]?.trim()
          : "Không xác định");
      const groupKey = `${dateKey}_${supplier}_${date.getHours()}_${date.getMinutes()}`;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, []);
      }
      groups.get(groupKey)!.push(transaction);
    });

    // Convert to array and generate receipt codes
    return Array.from(groups.entries())
      .map(([key, items], index) => {
        const firstItem = items[0];
        const date = new Date(firstItem.date);

        // Extract receipt code from notes if exists (format: "NH-20251119-XXX | NCC: ...")
        let receiptCode = "";
        if (firstItem.notes) {
          const match = firstItem.notes.match(/NH-\d{8}-\d{3}/);
          if (match) {
            receiptCode = match[0];
          }
        }

        // If no receipt code in notes, generate one
        if (!receiptCode) {
          const dateStr = `${date.getFullYear()}${String(
            date.getMonth() + 1
          ).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
          receiptCode = `NH-${dateStr}-${String(groups.size - index).padStart(
            3,
            "0"
          )}`;
        }

        return {
          receiptCode,
          date: firstItem.date,
          supplier: firstItem.supplierId
            ? (suppliers.find((s: any) => s.id === firstItem.supplierId)?.name || "Không xác định")
            : (firstItem.notes?.includes("NCC:")
              ? firstItem.notes.split("NCC:")[1]?.split("|")[0]?.trim()
              : "Không xác định"),
          items,
          total: items.reduce((sum, item) => sum + item.totalPrice, 0),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredTransactions]);

  const [selectedReceipts, setSelectedReceipts] = useState<Set<string>>(
    new Set()
  );
  const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(
    new Set()
  );
  const [showPrintBarcodeModal, setShowPrintBarcodeModal] = useState(false);

  // Memoized list of parts and quantities to be printed from selected receipts
  const { parts: partsForBarcodePrint, quantities: barcodeQuantities } = useMemo(() => {
    if (selectedReceipts.size === 0) return { parts: [], quantities: {} };

    const selectedPartIds = new Set<string>();
    const partsList: Part[] = [];
    const quantities: Record<string, number> = {};

    groupedReceipts.forEach((receipt) => {
      if (selectedReceipts.has(receipt.receiptCode)) {
        receipt.items.forEach((item) => {
          if (item.partId) {
            // Aggregate quantities
            if (!quantities[item.partId]) {
              quantities[item.partId] = 0;
            }
            quantities[item.partId] += item.quantity;

            // Add to parts list if not already added
            if (!selectedPartIds.has(item.partId)) {
              selectedPartIds.add(item.partId);
              const part = parts.find((p) => p.id === item.partId);
              if (part) {
                partsList.push(part);
              }
            }
          }
        });
      }
    });
    return { parts: partsList, quantities };
  }, [selectedReceipts, groupedReceipts, parts]);

  const toggleExpand = (receiptCode: string) => {
    setExpandedReceipts((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(receiptCode)) {
        newSet.delete(receiptCode);
      } else {
        newSet.add(receiptCode);
      }
      return newSet;
    });
  };

  // Xóa phiếu nhập kho đã chọn
  const handleDeleteSelectedReceipts = async () => {
    if (selectedReceipts.size === 0) {
      showToast.warning("Vui lòng chọn ít nhất một phiếu nhập kho");
      return;
    }

    const confirmed = await confirm({
      title: "Xác nhận xóa phiếu nhập kho",
      message: `Bạn có chắc chắn muốn xóa ${selectedReceipts.size} phiếu nhập kho đã chọn? Hành động này sẽ:\n- Xóa các giao dịch nhập kho\n- Tự động hoàn trả tồn kho`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    try {
      // Get all transactions for selected receipts with item details
      const receiptCodesToDelete = Array.from(selectedReceipts);
      const allTransactions: any[] = [];

      groupedReceipts.forEach((receipt) => {
        if (receiptCodesToDelete.includes(receipt.receiptCode)) {
          receipt.items.forEach((item: any) => {
            if (item.id) {
              allTransactions.push({
                id: item.id,
                part_id: item.partId,
                part_name: item.partName,
                quantity_change: item.quantity,
              });
            }
          });
        }
      });

      if (allTransactions.length === 0) {
        showToast.error("Không tìm thấy giao dịch để xóa");
        return;
      }

      // Rollback stock for each part BEFORE deleting transactions
      for (const tx of allTransactions) {
        if (tx.part_id && tx.quantity_change > 0) {
          // Get current part stock
          const { data: partData, error: partError } = await supabase
            .from("parts")
            .select("stock")
            .eq("id", tx.part_id)
            .single();

          if (partError || !partData) {
            console.warn(`Could not find part ${tx.part_id}:`, partError);
            continue;
          }

          // Calculate new stock (deduct the import quantity)
          const currentStock = partData.stock || {};
          const branchStock = currentStock[branchId] || 0;
          const newBranchStock = Math.max(0, branchStock - tx.quantity_change);

          // Update stock
          const { error: updateError } = await supabase
            .from("parts")
            .update({
              stock: {
                ...currentStock,
                [branchId]: newBranchStock,
              },
            })
            .eq("id", tx.part_id);

          if (updateError) {
            console.warn(`Could not update stock for ${tx.part_id}:`, updateError);
          } else {
            console.log(`✅ Trừ tồn kho: ${tx.part_name || tx.part_id} - Số lượng: ${tx.quantity_change} (${branchStock} → ${newBranchStock})`);
          }
        }
      }

      // Delete transactions
      const transactionIds = allTransactions.map(t => t.id);
      const { error } = await supabase
        .from("inventory_transactions")
        .delete()
        .in("id", transactionIds);

      if (error) throw error;

      // Delete supplier debts for each receipt
      for (const receiptCode of receiptCodesToDelete) {
        const { error: debtError } = await supabase
          .from("supplier_debts")
          .delete()
          .ilike("description", `%${receiptCode}%`);

        if (debtError) console.warn(`Could not delete debt for ${receiptCode}:`, debtError);

        // ✅ FIX: Delete associated cash transactions (Sổ quỹ)
        const { error: cashError } = await supabase
          .from("cash_transactions")
          .delete()
          .ilike("description", `%Phiếu nhập ${receiptCode}%`);

        if (cashError) {
          console.warn(`Could not delete cash transaction for ${receiptCode}:`, cashError);
        } else {
          console.log(`✅ Đã xóa giao dịch sổ quỹ cho phiếu ${receiptCode}`);
        }
      }

      showToast.success(`Đã xóa ${selectedReceipts.size} phiếu nhập kho, hoàn trả tồn kho và xóa giao dịch tài chính liên quan`);
      setSelectedReceipts(new Set());

      // Refetch data
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["supplierDebts"] });
      queryClient.invalidateQueries({ queryKey: ["cashTransactions"] }); // ✅ Refresh Cash Book
      queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
      queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });
      queryClient.invalidateQueries({ queryKey: ["allPartsForTotals"] });
    } catch (err: any) {
      console.error("❌ Lỗi xóa phiếu nhập kho:", err);
      showToast.error(`Lỗi: ${err.message || "Không thể xóa"}`);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg shadow-sm border border-slate-200 dark:border-slate-700">
      {/* Header */}
      <div className="p-3 sm:p-6 border-b border-slate-200 dark:border-slate-700">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-slate-100 mb-3 sm:mb-4">
          Lịch sử nhập kho
        </h2>

        {/* Time Filter Buttons */}
        <div className="flex flex-wrap gap-2 mb-3 sm:mb-4">
          {[
            { key: "7days", label: "7 ngày qua" },
            { key: "30days", label: "30 ngày qua" },
            { key: "thisMonth", label: "Tháng này" },
            { key: "custom", label: "Tùy chọn" },
          ].map((filter) => (
            <button
              key={filter.key}
              onClick={() => setActiveTimeFilter(filter.key)}
              className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg text-sm sm:text-base font-medium transition-colors ${activeTimeFilter === filter.key
                ? "bg-blue-600 text-white"
                : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {/* Custom Date Range */}
        {activeTimeFilter === "custom" && (
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Từ ngày
              </label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs sm:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Đến ngày
              </label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
              />
            </div>
          </div>
        )}

        {/* Search */}
        <input
          type="text"
          placeholder="Nhà cung cấp, SKU, tên phụ tùng..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 sm:px-4 sm:py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm sm:text-base"
        />
      </div>

      {/* Summary */}
      <div className="px-3 py-3 sm:px-6 sm:py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Tổng số phiếu:{" "}
              <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-slate-100">
                {groupedReceipts.length}
              </span>
            </div>
            {/* Nút in mã vạch và xóa phiếu đã chọn */}
            {selectedReceipts.size > 0 && (
              <>
                <button
                  onClick={() => setShowPrintBarcodeModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
                >
                  <Printer className="w-4 h-4" />
                  In mã vạch ({partsForBarcodePrint.length} SP)
                </button>
                <button
                  onClick={handleDeleteSelectedReceipts}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Xóa {selectedReceipts.size} phiếu
                </button>
              </>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              Tổng giá trị
            </div>
            <div className="text-base sm:text-lg font-bold text-blue-600">
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>
      </div>

      {/* Receipts List */}
      <div className="divide-y divide-slate-200 dark:divide-slate-700">
        {/* Header Row - Desktop only */}
        {groupedReceipts.length > 0 && (
          <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 bg-slate-100 dark:bg-slate-700 border-b border-slate-200 dark:border-slate-600 sticky top-0 z-10">
            <div className="col-span-1 text-xs font-semibold text-slate-600 dark:text-slate-300"></div>
            <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Mã phiếu
            </div>
            <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Nhà cung cấp
            </div>
            <div className="col-span-4 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Chi tiết
            </div>
            <div className="col-span-2 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Thanh toán
            </div>
            <div className="col-span-1 text-xs font-semibold text-slate-600 dark:text-slate-300">
              Thao tác
            </div>
          </div>
        )}

        {groupedReceipts.length === 0 ? (
          <div className="px-3 py-8 sm:px-6 sm:py-12 text-center text-slate-500">
            <div className="text-4xl sm:text-6xl mb-4">📦</div>
            <div className="text-sm sm:text-base">Không có dữ liệu</div>
          </div>
        ) : (
          groupedReceipts.map((receipt, index) => {
            const receiptDate = new Date(receipt.date);
            const formattedDate = receiptDate.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
            });
            const formattedTime = receiptDate.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit",
            });

            // Check if this receipt has debt
            const receiptDebt = supplierDebts.find((debt) =>
              debt.description?.includes(receipt.receiptCode)
            );

            const paidAmount = receiptDebt
              ? receiptDebt.totalAmount - receiptDebt.remainingAmount
              : receipt.total;
            const remainingDebt = receiptDebt?.remainingAmount || 0;
            const hasDebt = remainingDebt > 0;

            // Unique key combining receiptCode with index to handle duplicates
            const uniqueKey = `${receipt.receiptCode}-${index}`;

            return (
              <div
                key={uniqueKey}
                className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
              >
                {/* Mobile Card */}
                <div className="md:hidden flex flex-col gap-3 bg-white dark:bg-slate-800/60 rounded-2xl border border-slate-200 dark:border-slate-700 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-semibold text-cyan-600 dark:text-cyan-300">
                        📦 {receipt.receiptCode}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1 mt-1">
                        📅{" "}
                        <span>
                          {formattedDate} · {formattedTime}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        Tổng tiền
                      </div>
                      <div className="text-lg font-bold text-slate-900 dark:text-white">
                        {formatCurrency(receipt.total)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-slate-50 dark:bg-slate-900/30 rounded-2xl p-3">
                    <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-orange-600 dark:text-orange-200 font-semibold text-lg">
                      🏢
                    </div>
                    <div>
                      <div className="text-base font-semibold text-slate-900 dark:text-white">
                        {receipt.supplier}
                      </div>
                      {receipt.items[0].notes?.includes("Phone:") && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          📞 {receipt.items[0].notes.split("Phone:")[1]?.trim()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    {(() => {
                      const isExpanded = expandedReceipts.has(
                        receipt.receiptCode
                      );
                      const maxItems = 3;
                      const displayItems = isExpanded
                        ? receipt.items
                        : receipt.items.slice(0, maxItems);
                      const hasMore = receipt.items.length > maxItems;

                      return (
                        <>
                          {displayItems.map((item, idx) => (
                            <div
                              key={item.id}
                              className="flex items-start justify-between text-sm text-slate-700 dark:text-slate-200"
                            >
                              <div>
                                <span className="font-semibold">
                                  {item.quantity} x {item.partName}
                                </span>
                                <div className="text-xs text-slate-400">
                                  {formatCurrency(item.unitPrice || 0)} / sản
                                  phẩm
                                </div>
                              </div>
                              <span className="font-bold text-slate-900 dark:text-white">
                                {formatCurrency(
                                  item.quantity * (item.unitPrice || 0)
                                )}
                              </span>
                            </div>
                          ))}
                          {hasMore && (
                            <button
                              onClick={() => toggleExpand(receipt.receiptCode)}
                              className="w-full text-sm text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium py-2 flex items-center justify-center gap-1 bg-slate-50 dark:bg-slate-900/50 rounded-lg"
                            >
                              {isExpanded ? (
                                <>
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
                                      d="M5 15l7-7 7 7"
                                    />
                                  </svg>
                                  Thu gọn
                                </>
                              ) : (
                                <>
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
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                  Xem thêm ({receipt.items.length - maxItems}{" "}
                                  sản phẩm)
                                </>
                              )}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {hasDebt ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200">
                        ⚠️ Còn nợ {formatCurrency(remainingDebt)}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200">
                        ✓ Đã thanh toán
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-2 pt-3 border-t border-dashed border-slate-200 dark:border-slate-700">
                    <button
                      onClick={() =>
                        setEditingReceipt({
                          ...receipt,
                          date: new Date(receipt.date),
                        })
                      }
                      className="flex-1 min-w-[120px] px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-sm font-medium"
                    >
                      Chỉnh sửa
                    </button>
                  </div>
                </div>

                {/* Desktop Grid */}
                <div className="hidden md:grid grid-cols-12 gap-4 items-start">
                  {/* Checkbox */}
                  <div className="col-span-1 flex items-start pt-1">
                    <input
                      type="checkbox"
                      checked={selectedReceipts.has(receipt.receiptCode)}
                      onChange={(e) => {
                        const newSelected = new Set(selectedReceipts);
                        if (e.target.checked) {
                          newSelected.add(receipt.receiptCode);
                        } else {
                          newSelected.delete(receipt.receiptCode);
                        }
                        setSelectedReceipts(newSelected);
                      }}
                      className="w-4 h-4 rounded border-slate-300"
                    />
                  </div>

                  {/* Cột 1: Mã Phiếu + Thông tin */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                        {receipt.receiptCode}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formattedDate} {formattedTime}
                      </div>
                      {receipt.items[0].notes?.includes("NV:") && (
                        <div className="text-xs text-slate-600 dark:text-slate-300">
                          <span className="font-medium">NV:</span>{" "}
                          {receipt.items[0].notes
                            ?.split("NV:")[1]
                            ?.split("NCC:")[0]
                            ?.trim()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 2: Nhà cung cấp */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {receipt.supplier}
                      </div>
                      {receipt.items[0].notes?.includes("Phone:") && (
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          📞 {receipt.items[0].notes.split("Phone:")[1]?.trim()}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 3: Chi tiết sản phẩm */}
                  <div className="col-span-4">
                    <div className="space-y-1">
                      {(() => {
                        const isExpanded = expandedReceipts.has(
                          receipt.receiptCode
                        );
                        const maxItems = 3;
                        const displayItems = isExpanded
                          ? receipt.items
                          : receipt.items.slice(0, maxItems);
                        const hasMore = receipt.items.length > maxItems;

                        return (
                          <>
                            {displayItems.map((item, idx) => {
                              const part = parts.find(
                                (p) => p.id === item.partId
                              );
                              const sellingPrice =
                                part?.retailPrice?.[currentBranchId || ""] || 0;
                              return (
                                <div
                                  key={item.id}
                                  className="text-xs text-slate-700 dark:text-slate-300"
                                >
                                  <span className="font-medium">
                                    {item.quantity} x
                                  </span>{" "}
                                  {item.partName}
                                  <span className="text-slate-400 ml-1">
                                    (Nhập: {formatCurrency(item.unitPrice || 0)}
                                    )
                                  </span>
                                  {sellingPrice > 0 && (
                                    <span className="text-emerald-600 dark:text-emerald-400 ml-1">
                                      • Bán: {formatCurrency(sellingPrice)}
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                            {hasMore && (
                              <button
                                onClick={() =>
                                  toggleExpand(receipt.receiptCode)
                                }
                                className="text-xs text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 font-medium mt-1 flex items-center gap-1"
                              >
                                {isExpanded ? (
                                  <>
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M5 15l7-7 7 7"
                                      />
                                    </svg>
                                    Thu gọn
                                  </>
                                ) : (
                                  <>
                                    <svg
                                      className="w-3 h-3"
                                      fill="none"
                                      stroke="currentColor"
                                      viewBox="0 0 24 24"
                                    >
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 9l-7 7-7-7"
                                      />
                                    </svg>
                                    Xem thêm ({receipt.items.length - maxItems}{" "}
                                    sản phẩm)
                                  </>
                                )}
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Cột 4: Thanh toán */}
                  <div className="col-span-2">
                    <div className="space-y-1">
                      <div className="text-xs text-slate-600 dark:text-slate-400">
                        Tổng tiền:
                      </div>
                      <div className="text-base font-bold text-slate-900 dark:text-white">
                        {formatCurrency(receipt.total)}
                      </div>

                      {/* Payment details */}
                      {hasDebt ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-xs text-green-600 dark:text-green-400">
                            Đã trả: {formatCurrency(paidAmount)}
                          </div>
                          <div className="text-xs font-semibold text-red-600 dark:text-red-400">
                            Còn nợ: {formatCurrency(remainingDebt)}
                          </div>
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                            ⚠️ Còn nợ
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2">
                          <div className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
                            ✓ Đã thanh toán
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cột 5: Thao tác */}
                  <div className="col-span-1">
                    <button
                      onClick={() =>
                        setEditingReceipt({
                          ...receipt,
                          date: new Date(receipt.date),
                        })
                      }
                      className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                      title="Chỉnh sửa"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer - if needed */}
      <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700">
        <div className="text-sm text-slate-600 dark:text-slate-400">
          Hiển thị {groupedReceipts.length} phiếu nhập
        </div>
      </div>

      {/* Edit Receipt Modal */}
      {editingReceipt && (
        <EditReceiptModal
          receipt={editingReceipt}
          onClose={() => setEditingReceipt(null)}
          onSave={async (updatedData) => {
            try {
              // Track original item IDs to detect deletions
              const originalItemIds = new Set(
                editingReceipt.items.map((i) => i.id)
              );
              const updatedItemIds = new Set(
                updatedData.items
                  .filter((i: any) => !i.id.startsWith("new-"))
                  .map((i: any) => i.id)
              );

              // 1. Handle DELETED items - rollback stock
              const deletedItemIds = Array.from(originalItemIds).filter(
                (id) => !updatedItemIds.has(id)
              );

              for (const deletedId of deletedItemIds) {
                const deletedItem = editingReceipt.items.find(
                  (i) => i.id === deletedId
                );
                if (!deletedItem) continue;

                // Get part info
                const { data: part, error: fetchError } = await supabase
                  .from("parts")
                  .select("stock")
                  .eq("id", deletedItem.partId)
                  .single();

                if (fetchError) {
                  throw new Error(
                    `Không thể lấy thông tin phụ tùng: ${fetchError.message}`
                  );
                }

                if (part) {
                  const currentStock = part.stock?.[currentBranchId] || 0;
                  const newStock = currentStock - deletedItem.quantity;

                  if (newStock < 0) {
                    throw new Error(
                      `Không thể xóa sản phẩm "${deletedItem.partName}" vì sẽ làm tồn kho âm`
                    );
                  }

                  // Update stock
                  const { error: updateError } = await supabase
                    .from("parts")
                    .update({
                      stock: {
                        ...part.stock,
                        [currentBranchId]: newStock,
                      },
                    })
                    .eq("id", deletedItem.partId);

                  if (updateError) {
                    throw new Error(
                      `Không thể cập nhật tồn kho: ${updateError.message}`
                    );
                  }
                }

                // Delete transaction
                const { error: deleteError } = await supabase
                  .from("inventory_transactions")
                  .delete()
                  .eq("id", deletedId);

                if (deleteError) {
                  throw new Error(
                    `Không thể xóa giao dịch: ${deleteError.message}`
                  );
                }
              }

              // 2. Handle UPDATED items - update transaction and adjust stock
              for (const item of updatedData.items) {
                if (item.id.startsWith("new-")) continue; // Skip new items for now

                const originalItem = editingReceipt.items.find(
                  (i) => i.id === item.id
                );

                // Update the transaction record
                const { error } = await supabase
                  .from("inventory_transactions")
                  .update({
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    totalPrice: item.totalPrice,
                    notes: `NV:${updatedData.items[0].notes
                      ?.split("NV:")[1]
                      ?.split("NCC:")[0]
                      ?.trim() ||
                      profile?.name ||
                      profile?.full_name ||
                      "Nhân viên"
                      } NCC:${updatedData.supplier}${updatedData.supplierPhone
                        ? ` Phone:${updatedData.supplierPhone}`
                        : ""
                      }`,
                  })
                  .eq("id", item.id);

                if (error) throw error;

                // If quantity changed, update parts.stock
                if (originalItem && originalItem.quantity !== item.quantity) {
                  const quantityDiff = item.quantity - originalItem.quantity;

                  // Get the part to update its stock
                  const { data: part, error: fetchError } = await supabase
                    .from("parts")
                    .select("stock, id")
                    .eq("id", originalItem.partId)
                    .single();

                  if (fetchError) {
                    throw new Error(
                      `Không thể lấy thông tin phụ tùng: ${fetchError.message}`
                    );
                  }

                  if (part) {
                    const currentStock = part.stock?.[currentBranchId] || 0;
                    const newStock = currentStock + quantityDiff;

                    if (newStock < 0) {
                      throw new Error(
                        `Không thể giảm số lượng vì sẽ làm tồn kho âm (hiện có: ${currentStock})`
                      );
                    }

                    // Update stock in database
                    const { error: updateError } = await supabase
                      .from("parts")
                      .update({
                        stock: {
                          ...part.stock,
                          [currentBranchId]: newStock,
                        },
                      })
                      .eq("id", part.id);

                    if (updateError) {
                      throw new Error(
                        `Không thể cập nhật tồn kho: ${updateError.message}`
                      );
                    }
                  }
                }
              }

              // 3. Handle NEW items - create transaction and add stock
              const newItems = updatedData.items.filter((i: any) =>
                i.id.startsWith("new-")
              );

              for (const newItem of newItems) {
                // Get part info
                const { data: part, error: fetchError } = await supabase
                  .from("parts")
                  .select("stock, id")
                  .eq("id", newItem.partId)
                  .single();

                if (fetchError) {
                  throw new Error(
                    `Không thể lấy thông tin phụ tùng: ${fetchError.message}`
                  );
                }

                if (part) {
                  const currentStock = part.stock?.[currentBranchId] || 0;
                  const newStock = currentStock + newItem.quantity;

                  // Update stock
                  const { error: updateError } = await supabase
                    .from("parts")
                    .update({
                      stock: {
                        ...part.stock,
                        [currentBranchId]: newStock,
                      },
                    })
                    .eq("id", part.id);

                  if (updateError) {
                    throw new Error(
                      `Không thể cập nhật tồn kho: ${updateError.message}`
                    );
                  }
                }

                // Create new transaction
                const { error: insertError } = await supabase
                  .from("inventory_transactions")
                  .insert({
                    type: "Nhập kho",
                    partId: newItem.partId,
                    partName: newItem.partName,
                    quantity: newItem.quantity,
                    date: editingReceipt.date.toISOString(),
                    unitPrice: newItem.unitPrice,
                    totalPrice: newItem.totalPrice,
                    branchId: currentBranchId,
                    notes: `NV:${updatedData.items[0].notes
                      ?.split("NV:")[1]
                      ?.split("NCC:")[0]
                      ?.trim() ||
                      profile?.name ||
                      profile?.full_name ||
                      "Nhân viên"
                      } NCC:${updatedData.supplier}${updatedData.supplierPhone
                        ? ` Phone:${updatedData.supplierPhone}`
                        : ""
                      }`,
                  });

                if (insertError) {
                  throw new Error(
                    `Không thể tạo giao dịch mới: ${insertError.message}`
                  );
                }
              }

              showToast.success(
                `Đã cập nhật phiếu nhập kho (${updatedData.items.length} sản phẩm)`
              );
              queryClient.invalidateQueries({
                queryKey: ["inventoryTransactions"],
              });
              queryClient.invalidateQueries({
                queryKey: ["partsRepo"],
              });
              queryClient.invalidateQueries({
                queryKey: ["partsRepoPaged"],
              });
              setEditingReceipt(null);
            } catch (err: any) {
              showToast.error(`Lỗi cập nhật: ${err.message || "Không rõ"}`);
            }
          }}
          currentBranchId={currentBranchId}
        />
      )}

      {/* Confirm Modal for delete */}
      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
        title={confirmState.title}
        message={confirmState.message}
        confirmText={confirmState.confirmText}
        cancelText={confirmState.cancelText}
        confirmColor={confirmState.confirmColor}
      />

      {/* Print Barcode Modal for selected receipts */}
      {showPrintBarcodeModal && partsForBarcodePrint.length > 0 && (
        <BatchPrintBarcodeModal
          parts={partsForBarcodePrint}
          currentBranchId={currentBranchId || ''}
          onClose={() => setShowPrintBarcodeModal(false)}
          initialQuantities={barcodeQuantities}
        />
      )}
    </div>
  );
};

export default InventoryHistorySection;
