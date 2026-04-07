import React, { useState, useMemo } from 'react'; // Refresh
import { useQueryClient } from '@tanstack/react-query';
import { showToast } from '../../../utils/toast';
import { supabase } from '../../../supabaseClient';
import { X, Calendar, Search, Filter, DownloadCloud, Trash2, ChevronDown, ChevronUp, Printer, FileText } from 'lucide-react';
import { formatCurrency, formatDate } from '../../../utils/format';
import { InventoryTransaction } from '../../../types';
import InventoryHistorySection from '../InventoryHistorySection';
// Inventory History Modal Component (Ảnh 3)
const InventoryHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  transactions: InventoryTransaction[];
}> = ({ isOpen, onClose, transactions }) => {
  const queryClient = useQueryClient();
  const [activeTimeFilter, setActiveTimeFilter] = useState("7days");
  const [customStartDate, setCustomStartDate] = useState(
    formatDate(new Date(), true)
  );
  const [customEndDate, setCustomEndDate] = useState(
    formatDate(new Date(), true)
  );
  const [searchTerm, setSearchTerm] = useState("");

  const filteredTransactions = useMemo(() => {
    // CHỈ LẤY GIAO DỊCH NHẬP KHO
    let filtered = transactions.filter((t) => t.type === "Nhập kho");
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100">
            Lịch sử nhập kho
          </h2>
          <button
            onClick={onClose}
            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
          >
            ×
          </button>
        </div>

        {/* Filters */}
        <div className="p-6 border-b border-slate-200 dark:border-slate-700">
          {/* Time Filter Buttons */}
          <div className="flex flex-wrap gap-2 mb-4">
            {[
              { key: "7days", label: "7 ngày qua" },
              { key: "30days", label: "30 ngày qua" },
              { key: "thisMonth", label: "Tháng này" },
              { key: "custom", label: "Tùy chọn" },
            ].map((filter) => (
              <button
                key={filter.key}
                onClick={() => setActiveTimeFilter(filter.key)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${activeTimeFilter === filter.key
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
            <div className="flex gap-4 mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Từ ngày
                </label>
                <input
                  type="date"
                  value={customStartDate}
                  onChange={(e) => setCustomStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Đến ngày
                </label>
                <input
                  type="date"
                  value={customEndDate}
                  onChange={(e) => setCustomEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                />
              </div>
            </div>
          )}

          {/* Search */}
          <div className="flex gap-4">
            <input
              type="text"
              placeholder="Nhà cung cấp, SKU, tên phụ tùng..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>

        {/* Summary */}
        <div className="px-6 py-4 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700">
          <div className="flex justify-between items-center">
            <div className="text-sm text-slate-600 dark:text-slate-400">
              Tổng số phiếu:{" "}
              <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                {filteredTransactions.length}
              </span>
            </div>
            <div className="text-right">
              <div className="text-sm text-slate-600 dark:text-slate-400">
                Tổng giá trị
              </div>
              <div className="text-lg font-bold text-blue-600">
                {formatCurrency(totalAmount)}
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-y-auto">
          <table className="w-full">
            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0">
              <tr>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Ngày
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nhà cung cấp
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Nội dung
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Số tiền
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-slate-800 divide-y divide-slate-200 dark:divide-slate-700">
              {filteredTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-slate-500"
                  >
                    Không có dữ liệu
                  </td>
                </tr>
              ) : (
                filteredTransactions.map((transaction) => (
                  <tr
                    key={transaction.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {formatDate(new Date(transaction.date), false)}
                      </div>
                      <div className="text-xs text-slate-500">
                        {new Date(transaction.date).toLocaleTimeString(
                          "vi-VN",
                          { hour: "2-digit", minute: "2-digit" }
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-slate-900 dark:text-slate-100">
                        {transaction.notes && transaction.notes.includes("NCC:")
                          ? transaction.notes.split("NCC:")[1]?.trim() ||
                          "Chưa rõ"
                          : "Chưa rõ"}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                        {transaction.partName}
                      </div>
                      <div className="text-xs text-slate-500">
                        SL: {transaction.quantity}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatCurrency(transaction.totalPrice)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            // TODO: Implement edit functionality
                            showToast.info("Tính năng đang phát triển");
                          }}
                          className="p-1.5 text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                          title="Chỉnh sửa"
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
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={async () => {
                            const confirmed = window.confirm(
                              `Bạn có chắc muốn xóa giao dịch nhập "${transaction.partName}"?`
                            );
                            if (confirmed) {
                              try {
                                const { error } = await supabase
                                  .from("inventory_transactions")
                                  .delete()
                                  .eq("id", transaction.id);

                                if (error) throw error;

                                showToast.success("Đã xóa giao dịch");
                                queryClient.invalidateQueries({
                                  queryKey: ["inventoryTransactions"],
                                });
                              } catch (err: any) {
                                showToast.error(
                                  `Lỗi xóa: ${err.message || "Không rõ"}`
                                );
                              }
                            }
                          }}
                          className="p-1.5 text-red-400 hover:bg-red-500/20 rounded transition-colors"
                          title="Xóa"
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
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            Hiển thị {filteredTransactions.length} kết quả
          </div>
        </div>
      </div>
    </div>
  );
};

export default InventoryHistoryModal;
