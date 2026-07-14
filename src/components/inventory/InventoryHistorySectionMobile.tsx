import React, { useState, useMemo } from "react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency, formatDate } from "../../utils/format";
import { useSupplierDebtsRepo } from "../../hooks/useDebtsRepository";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useSuppliers } from "../../hooks/useSuppliers";
import { useCashTxRepo } from "../../hooks/useCashTransactionsRepository";
import type { InventoryTransaction } from "../../types";

interface InventoryHistorySectionMobileProps {
  transactions: InventoryTransaction[];
  canViewImportPrice?: boolean;
  canEditReceipt?: boolean;
  canDeleteReceipt?: boolean;
  onEdit?: (receipt: any) => void;
  onDelete?: (receipt: any) => void;
}

const InventoryHistorySectionMobile: React.FC<
  InventoryHistorySectionMobileProps
> = ({
  transactions,
  canViewImportPrice = true,
  canEditReceipt = false,
  canDeleteReceipt = false,
  onEdit,
  onDelete,
}) => {
  const { currentBranchId } = useAppContext();
  const { data: supplierDebts = [] } = useSupplierDebtsRepo();
  const { data: cashTransactions = [] } = useCashTxRepo({
    branchId: currentBranchId,
    type: "expense",
    limit: 1000,
  });
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
  const [showFilters, setShowFilters] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<{
    receiptCode: string;
    date: Date;
    supplier: string;
    items: InventoryTransaction[];
    total: number;
  } | null>(null);

  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter((t) => {
      const rawType = String(t.type || "").toLowerCase();
      const rawNotes = String(t.notes || "").toLowerCase();
      const hasReceiptHint =
        rawNotes.includes("phiếu nhập") ||
        rawNotes.includes("phieu nhap") ||
        rawNotes.includes("nhập kho") ||
        rawNotes.includes("nhap kho") ||
        rawNotes.includes("nh-");
      const isImportType =
        rawType === "nhập kho" ||
        rawType === "nhap kho" ||
        rawType === "import" ||
        rawType === "receipt";
      const likelyImportRow = Number(t.quantity || 0) > 0 && Number(t.totalPrice || 0) >= 0;

      return isImportType || hasReceiptHint || likelyImportRow;
    });
    const now = new Date();

    switch (activeTimeFilter) {
      case "7days": {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        filtered = filtered.filter((t) => new Date(t.date) >= sevenDaysAgo);
        break;
      }
      case "30days": {
        const thirtyDaysAgo = new Date(
          now.getTime() - 30 * 24 * 60 * 60 * 1000
        );
        filtered = filtered.filter((t) => new Date(t.date) >= thirtyDaysAgo);
        break;
      }
      case "thisMonth": {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        filtered = filtered.filter((t) => new Date(t.date) >= startOfMonth);
        break;
      }
      case "custom":
        filtered = filtered.filter((t) => {
          const date = new Date(t.date);
          return (
            date >= new Date(customStartDate) && date <= new Date(customEndDate)
          );
        });
        break;
    }

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

  const groupedReceipts = useMemo(() => {
    const groups = new Map<string, InventoryTransaction[]>();

    filteredTransactions.forEach((transaction) => {
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

    return Array.from(groups.entries())
      .map(([_key, items], index) => {
        const firstItem = items[0];
        const date = new Date(firstItem.date);

        let receiptCode = "";
        if (firstItem.notes) {
          const match = firstItem.notes.match(/NH-\d{8}-[A-Z0-9]{3,4}/);
          if (match) {
            receiptCode = match[0];
          }
        }

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
  }, [filteredTransactions, suppliers]);

  const receiptDebtMap = useMemo(() => {
    const map = new Map<string, any>();
    const receiptCodeRegex = /NH-\d{8}-[A-Z0-9]{3,4}/i;

    for (const debt of supplierDebts || []) {
      const description = String((debt as any)?.description || "");
      const match = description.match(receiptCodeRegex);
      if (!match) continue;
      map.set(match[0].toUpperCase(), debt);
    }

    return map;
  }, [supplierDebts]);

  const receiptPaidFromCashMap = useMemo(() => {
    const map = new Map<string, number>();
    const receiptCodeRegex = /NH-\d{8}-[A-Z0-9]{3,4}/gi;

    for (const tx of cashTransactions || []) {
      const text = `${(tx as any)?.notes || ""} ${(tx as any)?.description || ""}`;
      const matches = text.match(receiptCodeRegex);
      if (!matches || matches.length === 0) continue;

      const amount = Math.abs(Number((tx as any)?.amount || 0));
      if (amount <= 0) continue;

      for (const code of matches) {
        const normalized = code.toUpperCase();
        map.set(normalized, Number(map.get(normalized) || 0) + amount);
      }
    }

    return map;
  }, [cashTransactions]);

  const totalAmount = useMemo(() => {
    return groupedReceipts.reduce((sum, receipt) => {
      const rawTotal = Number(receipt.total || 0);
      const receiptDebt = receiptDebtMap.get(receipt.receiptCode);
      const debtTotal = Number(receiptDebt?.totalAmount || 0);
      const paidFromCash = Number(receiptPaidFromCashMap.get(receipt.receiptCode) || 0);
      const effectiveTotal =
        rawTotal > 0 ? rawTotal : debtTotal > 0 ? debtTotal : paidFromCash;
      return sum + effectiveTotal;
    }, 0);
  }, [groupedReceipts, receiptDebtMap, receiptPaidFromCashMap]);

  return (
    <>
      <div className="flex flex-col h-full bg-slate-50 dark:bg-[#0f172a]">
        <div className="sticky top-0 z-10 bg-white dark:bg-[#1e293b] border-b border-slate-200 dark:border-slate-700 p-3 space-y-2">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm NCC, phụ tùng..."
            className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100 placeholder-slate-400 text-sm"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(true)}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium"
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
                  d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z"
                />
              </svg>
              Bộ lọc
            </button>
            <div className="px-4 py-2 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-300">
              {groupedReceipts.length}
            </div>
          </div>
        </div>

        <div className="px-3 py-3 bg-blue-50 dark:bg-blue-900/20 border-b border-blue-100 dark:border-blue-800">
          <div className="flex justify-between items-center">
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Tổng giá trị nhập
            </div>
            <div className="text-xl font-bold text-blue-600 dark:text-blue-400">
              {formatCurrency(totalAmount)}
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto">
          {groupedReceipts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <div className="text-6xl mb-4">📦</div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 mb-2">
                Không có dữ liệu
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Thử thay đổi bộ lọc hoặc thời gian
              </p>
            </div>
          ) : (
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              {groupedReceipts.map((receipt) => {
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

                const receiptDebt = receiptDebtMap.get(receipt.receiptCode);
                const paidFromCash = Number(receiptPaidFromCashMap.get(receipt.receiptCode) || 0);
                const rawTotal = Number(receipt.total || 0);
                const debtTotal = Number(receiptDebt?.totalAmount || 0);
                const effectiveTotal =
                  rawTotal > 0 ? rawTotal : debtTotal > 0 ? debtTotal : paidFromCash;
                const remainingDebt = receiptDebt?.remainingAmount || 0;
                const hasDebt = remainingDebt > 0;

                return (
                  <button
                    key={receipt.receiptCode}
                    onClick={() =>
                      setSelectedReceipt({
                        ...receipt,
                        total: effectiveTotal,
                        date: new Date(receipt.date),
                      })
                    }
                    className="w-full p-4 bg-white dark:bg-[#1e293b] hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div>
                        <div className="text-sm font-bold text-cyan-600 dark:text-cyan-400">
                          {receipt.receiptCode}
                        </div>
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                          {formattedDate} · {formattedTime}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          Tổng tiền
                        </div>
                        <div className="text-base font-bold text-slate-900 dark:text-white">
                          {formatCurrency(effectiveTotal)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center text-lg">
                        🏢
                      </div>
                      <div className="text-sm font-medium text-slate-900 dark:text-white">
                        {receipt.supplier}
                      </div>
                    </div>

                    <div className="text-xs text-slate-600 dark:text-slate-400">
                      {receipt.items.length} sản phẩm
                    </div>

                    {hasDebt && (
                      <div className="mt-2">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-200">
                          ⚠️ Còn nợ {formatCurrency(remainingDebt)}
                        </span>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showFilters && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setShowFilters(false)}
          />
          <div className="relative bg-white dark:bg-[#1e293b] rounded-t-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Bộ lọc thời gian
              </h3>
              <button
                onClick={() => setShowFilters(false)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Thời gian
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { key: "7days", label: "7 ngày qua" },
                    { key: "30days", label: "30 ngày qua" },
                    { key: "thisMonth", label: "Tháng này" },
                    { key: "custom", label: "Tùy chọn" },
                  ].map((filter) => (
                    <button
                      key={filter.key}
                      onClick={() => setActiveTimeFilter(filter.key)}
                      className={`px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${activeTimeFilter === filter.key
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                    >
                      {filter.label}
                    </button>
                  ))}
                </div>
              </div>

              {activeTimeFilter === "custom" && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Từ ngày
                    </label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Đến ngày
                    </label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg dark:bg-slate-700 dark:text-slate-100"
                    />
                  </div>
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 dark:border-slate-700">
              <button
                onClick={() => setShowFilters(false)}
                className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium"
              >
                Áp dụng
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReceipt && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSelectedReceipt(null)}
          />
          <div className="relative bg-white dark:bg-[#1e293b] rounded-t-2xl w-full h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                Chi tiết phiếu nhập
              </h3>
              <button
                onClick={() => setSelectedReceipt(null)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg"
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
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              <div className="bg-cyan-50 dark:bg-cyan-900/20 rounded-lg p-3">
                <div className="text-xs text-cyan-600 dark:text-cyan-400 mb-1">
                  Mã phiếu
                </div>
                <div className="text-lg font-bold text-cyan-600 dark:text-cyan-400">
                  {selectedReceipt.receiptCode}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 dark:bg-slate-800 rounded-lg p-3">
                  <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                    Ngày nhập
                  </div>
                  <div className="text-sm font-medium text-slate-900 dark:text-white">
                    {formatDate(new Date(selectedReceipt.date))}
                  </div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3">
                  <div className="text-xs text-blue-600 dark:text-blue-400 mb-1">
                    Tổng tiền
                  </div>
                  <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                    {formatCurrency(selectedReceipt.total)}
                  </div>
                </div>
              </div>

              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
                <div className="text-xs text-orange-600 dark:text-orange-400 mb-1">
                  Nhà cung cấp
                </div>
                <div className="text-base font-semibold text-orange-900 dark:text-orange-100">
                  {selectedReceipt.supplier}
                </div>
              </div>

              <div>
                <h4 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-2">
                  Danh sách sản phẩm ({selectedReceipt.items.length})
                </h4>
                <div className="space-y-2">
                  {selectedReceipt.items.map((item) => {
                    const part = parts.find((p) => p.id === item.partId);
                    const sellingPrice =
                      part?.retailPrice?.[currentBranchId || ""] || 0;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg"
                      >
                        <div className="flex-1">
                          <div className="text-sm font-medium text-slate-900 dark:text-white">
                            {item.quantity} x {item.partName}
                          </div>
                          {canViewImportPrice && (
                            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                              Giá nhập: {formatCurrency(item.unitPrice || 0)} / SP
                            </div>
                          )}
                          {sellingPrice > 0 && (
                            <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                              Giá bán: {formatCurrency(sellingPrice)} / SP
                            </div>
                          )}
                        </div>
                        {canViewImportPrice && (
                          <div className="text-sm font-bold text-slate-900 dark:text-white">
                            {formatCurrency(
                              item.quantity * (item.unitPrice || 0)
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Action Buttons */}
              {(canEditReceipt || canDeleteReceipt) && (
                <div className="grid grid-cols-2 gap-3 pt-2">
                  {canEditReceipt && (
                    <button
                      onClick={() => {
                        if (onEdit) {
                          onEdit(selectedReceipt);
                          setSelectedReceipt(null);
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl font-medium active:scale-95 transition-transform"
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
                      Chỉnh sửa
                    </button>
                  )}
                  {canDeleteReceipt && (
                    <button
                      onClick={() => {
                        if (onDelete) {
                          onDelete(selectedReceipt);
                          setSelectedReceipt(null);
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-medium active:scale-95 transition-transform"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                      Xóa phiếu
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default React.memo(InventoryHistorySectionMobile);
