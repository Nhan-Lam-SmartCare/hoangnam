import React, { useEffect, useMemo, useState } from "react";
import { Printer, Trash2, Plus, X } from "lucide-react";
import { CashSessionPanel } from "./CashSessionPanel";
import { useAppContext } from "../../contexts/AppContext";
import {
  useCashTxRepo,
  useCreateCashTxRepo,
  useDeleteCashTxRepo,
} from "../../hooks/useCashTransactionsRepository";
import { useStoreSettings } from "../../hooks/useStoreSettings";
import type { StoreSettings } from "../../hooks/useStoreSettings";
import { useEmployeesDirectoryRepo } from "../../hooks/useEmployeesRepository";
import type { Employee } from "../../types";
import { supabase } from "../../supabaseClient";
import { formatCurrency, formatDate } from "../../utils/format";
import { formatCashTxCategory } from "../../lib/finance/cashTxCategories";
import { printElementById } from "../../utils/print";

type CashBookSummary = {
  income: number;
  expense: number;
  balance: number;
};

const PAPER_SIZE_MAP: Record<string, { width: string; pageSize: string }> = {
  "58mm": { width: "58mm", pageSize: "58mm auto" },
  "80mm": { width: "80mm", pageSize: "80mm auto" },
  "A5": { width: "148mm", pageSize: "A5 portrait" },
  "A4": { width: "210mm", pageSize: "A4 portrait" },
};

const resolvePaperSize = (key: string, fallback = "80mm") => {
  if (PAPER_SIZE_MAP[key]) return PAPER_SIZE_MAP[key];
  const match = key.match(/^(\d+)mm$/i);
  if (match) {
    const w = `${match[1]}mm`;
    return { width: w, pageSize: `${w} auto` };
  }
  return PAPER_SIZE_MAP[fallback] || PAPER_SIZE_MAP["80mm"];
};

const resolveTxCode = (tx: any) =>
  (tx as any).reference || (tx as any).ref || (tx as any).code || tx.id || "-";

const resolveTxCodeShort = (tx: any) => {
  const raw = String(resolveTxCode(tx) || "-");
  const digits = raw.replace(/\D/g, "");
  if (digits.length >= 8) return digits.slice(-8);
  if (digits.length >= 6) return digits.slice(-6);
  const compact = raw.replace(/[^a-zA-Z0-9]/g, "");
  if (compact.length >= 8) return compact.slice(-8);
  if (compact.length >= 6) return compact.slice(-6);
  return raw;
};

const resolveTxCreatedAt = (tx: any) =>
  (tx as any).created_at || (tx as any).createdAt || tx.date || undefined;

const resolveTxCreatorName = (tx: any) =>
  (tx as any).username ||
  (tx as any).userName ||
  (tx as any).created_by_name ||
  (tx as any).createdByName ||
  (tx as any).creator_name ||
  (tx as any).creatorName ||
  "-";

const resolvePaymentSourceId = (tx: any) =>
  (tx as any).paymentSourceId ||
  (tx as any).paymentsource ||
  (tx as any).paymentSource ||
  (tx as any).payment_source_id ||
  (tx as any).payment_source ||
  "cash";

const CashBookSummaryCards: React.FC<{ summary: CashBookSummary }> = ({ summary }) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
    <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 p-3 border border-emerald-100 dark:border-emerald-900/40">
      <div className="text-xs text-emerald-700 dark:text-emerald-300">Tổng thu</div>
      <div className="text-lg font-bold text-emerald-700 dark:text-emerald-300">{formatCurrency(summary.income)}</div>
    </div>
    <div className="rounded-lg bg-red-50 dark:bg-red-900/20 p-3 border border-red-100 dark:border-red-900/40">
      <div className="text-xs text-red-700 dark:text-red-300">Tổng chi</div>
      <div className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(summary.expense)}</div>
    </div>
    <div className="rounded-lg bg-blue-50 dark:bg-blue-900/20 p-3 border border-blue-100 dark:border-blue-900/40">
      <div className="text-xs text-blue-700 dark:text-blue-300">Số dư</div>
      <div className="text-lg font-bold text-blue-700 dark:text-blue-300">{formatCurrency(summary.balance)}</div>
    </div>
  </div>
);

type CashBookFiltersProps = {
  typeFilter: "all" | "income" | "expense";
  startDate: string;
  endDate: string;
  onTypeFilterChange: (value: "all" | "income" | "expense") => void;
  onStartDateChange: (value: string) => void;
  onEndDateChange: (value: string) => void;
  onReset: () => void;
};

const CashBookFilters: React.FC<CashBookFiltersProps> = ({
  typeFilter,
  startDate,
  endDate,
  onTypeFilterChange,
  onStartDateChange,
  onEndDateChange,
  onReset,
}) => (
  <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-2.5 sm:p-3 bg-slate-50 dark:bg-slate-900/40">
    <div className="flex flex-wrap items-center gap-2">
      {[
        { key: "all", label: "Tất cả" },
        { key: "income", label: "Thu" },
        { key: "expense", label: "Chi" },
      ].map((item) => (
        <button
          key={item.key}
          onClick={() => onTypeFilterChange(item.key as "all" | "income" | "expense")}
          className={`px-3 py-1.5 text-sm rounded-lg border transition ${
            typeFilter === item.key
              ? "bg-blue-600 text-white border-blue-600"
              : "bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-600"
          }`}
        >
          {item.label}
        </button>
      ))}

      <div className="h-6 w-px bg-slate-300 dark:bg-slate-600 mx-1 hidden sm:block" />

      <input
        type="date"
        value={startDate}
        onChange={(e) => onStartDateChange(e.target.value)}
        className="w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        title="Từ ngày"
      />
      <input
        type="date"
        value={endDate}
        onChange={(e) => onEndDateChange(e.target.value)}
        className="w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
        title="Đến ngày"
      />
      <button
        onClick={onReset}
        className="w-full sm:w-auto px-3 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700"
      >
        Xóa lọc
      </button>
    </div>
  </div>
);

const CashBookTable: React.FC<{
  isLoading: boolean;
  transactions: any[];
  paymentSources: Array<{ id: string; name: string }>;
  onPrint: (tx: any) => void;
  onDelete: (tx: any) => void;
}> = ({
  isLoading,
  transactions,
  paymentSources,
  onPrint,
  onDelete,
}) => (
  <div>
    {isLoading ? (
      <div className="p-8 text-sm text-slate-500 text-center">Đang tải sổ quỹ...</div>
    ) : transactions.length === 0 ? (
      <div className="p-8 text-sm text-slate-500 text-center">Chưa có dữ liệu thu chi.</div>
    ) : (
      <>
        {/* Mobile View: Cards */}
        <div className="block sm:hidden space-y-3 p-3">
          {transactions.map((tx) => {
            const isIncome = (tx.type || "").toLowerCase() === "income";
            const createdAt = resolveTxCreatedAt(tx);
            const createdAtText = formatDate(createdAt ? new Date(createdAt) : undefined, true);
            const creatorName = resolveTxCreatorName(tx);
            const txCode = resolveTxCodeShort(tx);
            const paymentSourceId = resolvePaymentSourceId(tx);
            const paymentSourceName =
              paymentSources.find((source) => source.id === paymentSourceId)?.name ||
              (paymentSourceId === "cash"
                ? "Tiền mặt"
                : paymentSourceId === "bank"
                  ? "Chuyển khoản"
                  : paymentSourceId);
            const notesText = (tx as any).notes || (tx as any).description || "-";
            const detailsText = (tx as any).details || (tx as any).detail || "";
            const recipientText = (tx as any).recipient || "-";
            const categoryText = formatCashTxCategory((tx as any).category);

            return (
              <div
                key={tx.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm p-4 relative"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                        isIncome
                          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800"
                      }`}
                    >
                      {isIncome ? "Thu" : "Chi"}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">#{txCode}</span>
                  </div>
                  <div className="text-right">
                    <div
                      className={`text-lg font-bold bg-clip-text text-transparent ${
                        isIncome ? "bg-gradient-to-r from-emerald-600 to-emerald-500 dark:from-emerald-400 dark:to-emerald-300" : "bg-gradient-to-r from-red-600 to-red-500 dark:from-red-400 dark:to-red-300"
                      }`}
                    >
                      {isIncome ? "+" : "-"}{formatCurrency(Number(tx.amount || 0))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-y-2 mb-4">
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Ngày tạo</div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">{createdAtText}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Người tạo</div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">{creatorName}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Danh mục</div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">{categoryText}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Nguồn tiền</div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">{paymentSourceName}</div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider">Đối tác/Khách</div>
                    <div className="text-xs text-slate-800 dark:text-slate-200 font-medium">{recipientText}</div>
                  </div>
                  {notesText !== "-" && (
                    <div className="col-span-2 bg-slate-50 dark:bg-slate-900/50 p-2 rounded-lg mt-1 border border-slate-100 dark:border-slate-800">
                      <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-0.5">Nội dung</div>
                      <div className="text-[13px] text-slate-700 dark:text-slate-300 line-clamp-2">{notesText}</div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-slate-700/50">
                  <button
                    onClick={() => onPrint(tx)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/40 text-xs font-medium transition-colors"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    In phiếu
                  </button>
                  <button
                    onClick={() => onDelete(tx)}
                    className="flex items-center justify-center gap-1.5 px-3 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-900/20 dark:hover:text-red-400 dark:hover:border-red-800 text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop View: Table */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-slate-100 dark:bg-slate-700 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Ngày</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Loại</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Danh mục</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Nguồn tiền</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Nội dung</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-600 dark:text-slate-200">Đối tượng</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-200">Số tiền</th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-slate-600 dark:text-slate-200">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx) => {
                const isIncome = (tx.type || "").toLowerCase() === "income";
                const createdAt = resolveTxCreatedAt(tx);
                const createdAtText = formatDate(createdAt ? new Date(createdAt) : undefined, false);
                const creatorName = resolveTxCreatorName(tx);
                const txCode = resolveTxCodeShort(tx);
                const paymentSourceId = resolvePaymentSourceId(tx);
                const paymentSourceName =
                  paymentSources.find((source) => source.id === paymentSourceId)?.name ||
                  (paymentSourceId === "cash"
                    ? "Tiền mặt"
                    : paymentSourceId === "bank"
                      ? "Chuyển khoản"
                      : paymentSourceId);
                const notesText = (tx as any).notes || (tx as any).description || "-";
                const detailsText = (tx as any).details || (tx as any).detail || "";
                const recipientText = (tx as any).recipient || "-";
                return (
                  <tr
                    key={tx.id}
                    className="border-t border-slate-200 dark:border-slate-700 even:bg-slate-50/50 even:dark:bg-slate-800/30 hover:bg-slate-50 dark:hover:bg-slate-700/40"
                  >
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-medium">{createdAtText}</span>
                        <span className="text-[11px] text-slate-500">Mã: {txCode}</span>
                        <span className="text-[11px] text-slate-500">Người tạo: {creatorName}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${
                          isIncome
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                        }`}
                      >
                        {isIncome ? "Thu" : "Chi"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{formatCashTxCategory((tx as any).category)}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{paymentSourceName}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{notesText}</td>
                    <td className="px-4 py-3 text-sm text-slate-700 dark:text-slate-200">{recipientText}</td>
                    <td
                      className={`px-4 py-3 text-sm text-right font-semibold whitespace-nowrap ${
                        isIncome ? "text-emerald-700 dark:text-emerald-300" : "text-red-700 dark:text-red-300"
                      }`}
                    >
                      {formatCurrency(Number(tx.amount || 0))}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          onClick={() => onPrint(tx)}
                          className="p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"
                          title="In phiếu"
                        >
                          <Printer className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDelete(tx)}
                          className="p-1.5 rounded-lg border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-700/60 dark:text-red-300 dark:hover:bg-red-900/30"
                          title="Xóa phiếu"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </>
    )}
  </div>
);

type CashTxPrintModalProps = {
  isOpen: boolean;
  tx: any | null;
  branchName: string;
  storeSettings?: StoreSettings | null;
  paymentSources: Array<{ id: string; name: string }>;
  onClose: () => void;
};

const CashTxPrintModal: React.FC<CashTxPrintModalProps> = ({
  isOpen,
  tx,
  branchName,
  storeSettings,
  paymentSources,
  onClose,
}) => {
  if (!isOpen || !tx) return null;

  const isIncome = (tx.type || "").toLowerCase() === "income";
  const title = isIncome ? "PHIẾU THU" : "PHIẾU CHI";
  const createdAt = resolveTxCreatedAt(tx);
  const dateText = formatDate(createdAt ? new Date(createdAt) : new Date(), false);
  const txCode = resolveTxCodeShort(tx);
  const categoryText = formatCashTxCategory((tx as any).category);
  const notesText = (tx as any).notes || (tx as any).description || "-";
  const recipientText = (tx as any).recipient || "Khách lẻ";
  const paymentSourceId = resolvePaymentSourceId(tx);
  const paymentSourceName =
    paymentSources.find((source) => source.id === paymentSourceId)?.name ||
    (paymentSourceId === "cash" ? "Tiền mặt" : paymentSourceId === "bank" ? "Chuyển khoản" : paymentSourceId);
  const storeName = storeSettings?.store_name || "Sơn Nam";
  const logoUrl = storeSettings?.logo_url;
  const hotline = storeSettings?.phone || "";
  const paperSizeKey = storeSettings?.print_paper_size_receipt || "80mm";
  const paperSize = resolvePaperSize(paperSizeKey, "80mm");

  const handlePrint = () => {
    printElementById("cash-tx-receipt", {
      pageSize: paperSize.pageSize,
      paperWidth: paperSize.width,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">Xem trước phiếu in</div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
          >
            ×
          </button>
        </div>

        <div className="p-4 bg-slate-100 dark:bg-slate-900 flex justify-center">
          <div
            id="cash-tx-receipt"
            className="bg-white text-slate-900 shadow-lg"
            style={{ width: paperSize.width, color: "#0f172a" }}
          >
            <div style={{ padding: "12px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderBottom: "1px solid #e2e8f0",
                  paddingBottom: "8px",
                }}
              >
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt="Logo"
                    style={{ width: "44px", height: "44px", objectFit: "contain" }}
                  />
                ) : (
                  <div
                    style={{
                      width: "44px",
                      height: "44px",
                      borderRadius: "10px",
                      background: "#e2e8f0",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 700,
                      color: "#475569",
                      fontSize: "12px",
                    }}
                  >
                    SN
                  </div>
                )}

                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: "13px", letterSpacing: "0.4px" }}>{storeName}</div>
                  <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Chi nhánh: {branchName}</div>
                  {hotline && (
                    <div style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>Hotline: {hotline}</div>
                  )}
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontWeight: 700, fontSize: "12px" }}>{title}</div>
                  <div style={{ fontSize: "10.5px", color: "#64748b", marginTop: "2px" }}>{dateText}</div>
                </div>
              </div>

              <div style={{ marginTop: "10px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "92px 1fr",
                    gap: "6px 8px",
                    fontSize: "11px",
                  }}
                >
                  <div style={{ color: "#64748b" }}>Loại giao dịch</div>
                  <div style={{ fontWeight: 600 }}>{isIncome ? "Thu" : "Chi"}</div>

                  <div style={{ color: "#64748b" }}>Mã phiếu</div>
                  <div style={{ fontWeight: 600 }}>{txCode}</div>

                  <div style={{ color: "#64748b" }}>Danh mục</div>
                  <div style={{ fontWeight: 600 }}>{categoryText}</div>

                  <div style={{ color: "#64748b" }}>Nguồn tiền</div>
                  <div style={{ fontWeight: 600 }}>{paymentSourceName}</div>

                  <div style={{ color: "#64748b" }}>Khách hàng</div>
                  <div style={{ fontWeight: 700, fontSize: "12px" }}>{recipientText}</div>

                  <div style={{ color: "#64748b" }}>Nội dung</div>
                  <div style={{ fontWeight: 600, wordBreak: "break-word" }}>{notesText}</div>
                </div>
              </div>

              <div
                style={{
                  marginTop: "10px",
                  padding: "8px",
                  borderRadius: "8px",
                  background: isIncome ? "#ecfdf5" : "#fef2f2",
                  border: `1px solid ${isIncome ? "#a7f3d0" : "#fecaca"}`,
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "12px",
                }}
              >
                <span style={{ fontWeight: 600 }}>Tổng số tiền</span>
                <span style={{ fontWeight: 800, fontSize: "13px" }}>{formatCurrency(Number(tx.amount || 0))}</span>
              </div>

              <div
                style={{
                  marginTop: "12px",
                  borderTop: "1px dashed #cbd5e1",
                  paddingTop: "10px",
                  fontSize: "11px",
                  textAlign: "center",
                  color: "#64748b",
                }}
              >
                Cảm ơn quý khách. Hẹn gặp lại!
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600"
          >
            Đóng
          </button>
          <button
            onClick={handlePrint}
            className="flex-1 px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700"
          >
            In phiếu
          </button>
        </div>
      </div>
    </div>
  );
};

type CashTxFormModalProps = {
  isOpen: boolean;
  formType: "income" | "expense";
  formCategory: string;
  formCategoryOptions: Array<{ value: string; label: string }>;
  formAmount: number;
  formRecipient: string;
  formDate: string;
  formPaymentSourceId: string;
  formNotes: string;
  paymentSources: Array<{ id: string; name: string }>;
  isSaving: boolean;
  employees?: Employee[];
  selectedEmployeeId?: string;
  onEmployeeChange?: (employeeId: string, employeeName: string) => void;
  onClose: () => void;
  onCategoryChange: (value: string) => void;
  onAmountChange: (value: number) => void;
  onRecipientChange: (value: string) => void;
  onDateChange: (value: string) => void;
  onPaymentSourceChange: (value: string) => void;
  onNotesChange: (value: string) => void;
  onSubmit: () => void;
  onOpenManageCategories?: () => void;
};

const CashTxFormModal: React.FC<CashTxFormModalProps> = ({
  isOpen,
  formType,
  formCategory,
  formCategoryOptions,
  formAmount,
  formRecipient,
  formDate,
  formPaymentSourceId,
  formNotes,
  paymentSources,
  isSaving,
  employees = [],
  selectedEmployeeId = "",
  onEmployeeChange,
  onClose,
  onCategoryChange,
  onAmountChange,
  onRecipientChange,
  onDateChange,
  onPaymentSourceChange,
  onNotesChange,
  onSubmit,
  onOpenManageCategories,
}) => {
  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-white dark:bg-slate-800 rounded-t-2xl sm:rounded-2xl border border-slate-200 dark:border-slate-700 shadow-2xl">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="text-base font-semibold text-slate-900 dark:text-slate-100">
            {formType === "income" ? "Tạo phiếu Thu" : "Tạo phiếu Chi"}
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
            ×
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex gap-1.5 items-center">
            <select
              value={formCategory}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none"
            >
              {formCategoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={onOpenManageCategories}
              className="p-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:text-blue-400 hover:dark:bg-blue-900/40 border border-blue-200 dark:border-blue-800/40 transition-colors flex items-center justify-center h-[38px] w-[38px]"
              title="Quản lý danh mục"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <input
            type="number"
            min={0}
            value={formAmount || ""}
            onChange={(e) => onAmountChange(Number(e.target.value) || 0)}
            placeholder="Số tiền"
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          />

          {formCategory === "employee_advance" ? (
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                const empId = e.target.value;
                const emp = employees.find((x) => x.id === empId);
                onEmployeeChange?.(empId, emp?.name || "");
              }}
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            >
              <option value="">-- Chọn nhân viên --</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name} ({emp.position || "Nhân viên"})
                </option>
              ))}
            </select>
          ) : (
            <input
              type="text"
              value={formRecipient}
              onChange={(e) => onRecipientChange(e.target.value)}
              placeholder="Đối tượng"
              className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            />
          )}

          <input
            type="date"
            value={formDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          />

          <select
            value={formPaymentSourceId}
            onChange={(e) => onPaymentSourceChange(e.target.value)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
            title="Nguồn tiền"
          >
            {paymentSources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
            {paymentSources.length === 0 && <option value="cash">Tiền mặt</option>}
          </select>

          <input
            type="text"
            value={formNotes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Nội dung"
            className="sm:col-span-2 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200"
          />
        </div>

        <div className="px-4 pb-4 flex gap-2">
          <button onClick={onClose} className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-600">
            Hủy
          </button>
          <button
            onClick={onSubmit}
            disabled={isSaving || formAmount <= 0 || (formCategory === "employee_advance" && !selectedEmployeeId)}
            className={`flex-1 px-3 py-2 text-sm rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed ${
              formType === "income" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-red-600 hover:bg-red-700"
            }`}
          >
            {isSaving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
};

const CashBookPage: React.FC = () => {
  const { currentBranchId, paymentSources } = useAppContext();
  const { data: storeSettings } = useStoreSettings();
  const { data: employees = [] } = useEmployeesDirectoryRepo();
  const [typeFilter, setTypeFilter] = useState<"all" | "income" | "expense">("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [formType, setFormType] = useState<"income" | "expense">("income");
  const [formAmount, setFormAmount] = useState<number>(0);
  const [formCategory, setFormCategory] = useState<string>("other_income");
  const [formDate, setFormDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [formRecipient, setFormRecipient] = useState<string>("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");
  const [formPaymentSourceId, setFormPaymentSourceId] = useState<string>("cash");
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [printTx, setPrintTx] = useState<any | null>(null);
  const [branchName, setBranchName] = useState<string>("");
  const [showSession, setShowSession] = useState(false);
  const createCashTxMutation = useCreateCashTxRepo();
  const deleteCashTxMutation = useDeleteCashTxRepo();

  const [customIncomeCategories, setCustomIncomeCategories] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("custom_income_categories_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [customExpenseCategories, setCustomExpenseCategories] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("custom_expense_categories_v1");
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [isManageCategoriesOpen, setIsManageCategoriesOpen] = useState(false);
  const [manageCategoryType, setManageCategoryType] = useState<"income" | "expense">("income");
  const [newCategoryName, setNewCategoryName] = useState("");

  const handleAddCategory = () => {
    const trimmed = newCategoryName.trim();
    if (!trimmed) return;

    if (manageCategoryType === "income") {
      if (customIncomeCategories.includes(trimmed)) return;
      const updated = [...customIncomeCategories, trimmed];
      setCustomIncomeCategories(updated);
      localStorage.setItem("custom_income_categories_v1", JSON.stringify(updated));
    } else {
      if (customExpenseCategories.includes(trimmed)) return;
      const updated = [...customExpenseCategories, trimmed];
      setCustomExpenseCategories(updated);
      localStorage.setItem("custom_expense_categories_v1", JSON.stringify(updated));
    }
    setNewCategoryName("");
  };

  const handleDeleteCategory = (nameToDelete: string, type: "income" | "expense") => {
    const ok = window.confirm(`Bạn có chắc muốn xóa danh mục "${nameToDelete}"?`);
    if (!ok) return;

    if (type === "income") {
      const updated = customIncomeCategories.filter((name) => name !== nameToDelete);
      setCustomIncomeCategories(updated);
      localStorage.setItem("custom_income_categories_v1", JSON.stringify(updated));
      if (formCategory === nameToDelete) {
        setFormCategory("other_income");
      }
    } else {
      const updated = customExpenseCategories.filter((name) => name !== nameToDelete);
      setCustomExpenseCategories(updated);
      localStorage.setItem("custom_expense_categories_v1", JSON.stringify(updated));
      if (formCategory === nameToDelete) {
        setFormCategory("other_expense");
      }
    }
  };

  const incomeCategoryOptions = useMemo(() => {
    const base = [
      { value: "sale_income", label: "Bán hàng" },
      { value: "service_income", label: "Dịch vụ" },
      { value: "debt_collection", label: "Thu nợ khách hàng" },
      { value: "collection_on_behalf", label: "Thu hộ" },
      { value: "other_income", label: "Thu khác" },
      { value: "general_income", label: "Thu chung" },
    ];
    const custom = customIncomeCategories.map((name) => ({ value: name, label: name }));
    return [...base, ...custom];
  }, [customIncomeCategories]);

  const expenseCategoryOptions = useMemo(() => {
    const base = [
      { value: "inventory_purchase", label: "Mua hàng" },
      { value: "supplier_payment", label: "Chi trả nhà cung cấp" },
      { value: "salary", label: "Lương nhân viên" },
      { value: "employee_advance", label: "Ứng lương" },
      { value: "debt_payment", label: "Trả nợ nhà cung cấp" },
      { value: "loan_payment", label: "Trả nợ vay" },
      { value: "other_expense", label: "Chi khác" },
      { value: "general_expense", label: "Chi chung" },
    ];
    const custom = customExpenseCategories.map((name) => ({ value: name, label: name }));
    return [...base, ...custom];
  }, [customExpenseCategories]);

  const formCategoryOptions = formType === "income" ? incomeCategoryOptions : expenseCategoryOptions;

  const handleCategoryChange = (val: string) => {
    setFormCategory(val);
    if (val === "employee_advance") {
      setSelectedEmployeeId("");
      setFormRecipient("");
    }
  };

  useEffect(() => {
    setFormCategory(formType === "income" ? "other_income" : "other_expense");
  }, [formType]);

  useEffect(() => {
    let isActive = true;

    const resolveBranchName = async () => {
      if (!currentBranchId) {
        if (isActive) setBranchName("");
        return;
      }

      try {
        const { data, error } = await supabase
          .from("branches")
          .select("name")
          .eq("id", currentBranchId)
          .maybeSingle();

        if (!error && data?.name) {
          if (isActive) setBranchName(String(data.name));
          return;
        }
      } catch {
        // Ignore and fallback
      }

      const fallback = currentBranchId === "CN1" ? "Chi nhánh 1" : currentBranchId;
      if (isActive) setBranchName(fallback);
    };

    void resolveBranchName();
    return () => {
      isActive = false;
    };
  }, [currentBranchId]);

  const handleCreateCashTx = async () => {
    if (!currentBranchId) return;
    if (!formAmount || formAmount <= 0) return;

    await createCashTxMutation.mutateAsync({
      type: formType,
      amount: Math.max(0, Math.round(formAmount)),
      branchId: currentBranchId,
      paymentSourceId: formPaymentSourceId || "cash",
      date: formDate ? `${formDate}T00:00:00` : undefined,
      category: formCategory,
      recipient: formRecipient.trim() || undefined,
      employeeId: formCategory === "employee_advance" ? selectedEmployeeId : undefined,
      notes: formNotes.trim() || undefined,
    });

    setFormAmount(0);
    setFormRecipient("");
    setSelectedEmployeeId("");
    setFormNotes("");
    setIsFormModalOpen(false);
  };

  const openTxModal = (type: "income" | "expense") => {
    setFormType(type);
    setSelectedEmployeeId("");
    setIsFormModalOpen(true);
  };

  const handleDeleteTx = async (tx: any) => {
    if (!tx?.id) return;
    const ok = window.confirm("Bạn có chắc muốn xóa phiếu thu/chi này?");
    if (!ok) return;
    await deleteCashTxMutation.mutateAsync(String(tx.id));
  };

  const queryType = typeFilter === "all" ? undefined : typeFilter;
  const { data: transactions = [], isLoading } = useCashTxRepo({
    branchId: currentBranchId,
    type: queryType,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const sortedTx = useMemo(() => {
    return [...transactions].sort(
      (a, b) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime()
    );
  }, [transactions]);

  const summary = useMemo(() => {
    let income = 0;
    let expense = 0;

    for (const tx of sortedTx) {
      const amount = Number(tx.amount || 0);
      if ((tx.type || "").toLowerCase() === "income") {
        income += amount;
      } else {
        expense += amount;
      }
    }

    return {
      income,
      expense,
      balance: income - expense,
    };
  }, [sortedTx]);

  return (
    <div className="p-3 sm:p-5 lg:p-6 min-h-[calc(100vh-64px)]">
      <div className="app-surface max-w-7xl mx-auto rounded-xl overflow-hidden">
        <div className="p-4 sm:p-5 lg:p-6 space-y-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-slate-100">
                Sổ quỹ
              </h1>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                Theo dõi toàn bộ dòng tiền thu chi theo chi nhánh hiện tại.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 sm:justify-end">
              <button
                onClick={() => setShowSession(true)}
                className="w-full sm:w-auto px-3.5 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
              >
                Chốt ca
              </button>
              <button
                onClick={() => openTxModal("income")}
                className="w-full sm:w-auto px-3.5 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm"
              >
                + Thêm phiếu Thu
              </button>
              <button
                onClick={() => openTxModal("expense")}
                className="w-full sm:w-auto px-3.5 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 shadow-sm"
              >
                - Thêm phiếu Chi
              </button>
            </div>
          </div>

          <CashBookSummaryCards summary={summary} />

          <CashBookFilters
            typeFilter={typeFilter}
            startDate={startDate}
            endDate={endDate}
            onTypeFilterChange={setTypeFilter}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
            onReset={() => {
              setStartDate("");
              setEndDate("");
              setTypeFilter("all");
            }}
          />
        </div>

        <CashBookTable
          isLoading={isLoading}
          transactions={sortedTx}
          paymentSources={paymentSources || []}
          onPrint={(tx) => setPrintTx(tx)}
          onDelete={handleDeleteTx}
        />
      </div>

      <CashTxFormModal
        isOpen={isFormModalOpen}
        formType={formType}
        formCategory={formCategory}
        formCategoryOptions={formCategoryOptions}
        formAmount={formAmount}
        formRecipient={formRecipient}
        formDate={formDate}
        formPaymentSourceId={formPaymentSourceId}
        formNotes={formNotes}
        paymentSources={paymentSources || []}
        isSaving={createCashTxMutation.isPending}
        employees={employees}
        selectedEmployeeId={selectedEmployeeId}
        onEmployeeChange={(id, name) => {
          setSelectedEmployeeId(id);
          setFormRecipient(name);
        }}
        onClose={() => setIsFormModalOpen(false)}
        onCategoryChange={handleCategoryChange}
        onAmountChange={setFormAmount}
        onRecipientChange={setFormRecipient}
        onDateChange={setFormDate}
        onPaymentSourceChange={setFormPaymentSourceId}
        onNotesChange={setFormNotes}
        onSubmit={handleCreateCashTx}
        onOpenManageCategories={() => {
          setManageCategoryType(formType);
          setIsManageCategoriesOpen(true);
        }}
      />

      <CashTxPrintModal
        isOpen={!!printTx}
        tx={printTx}
        branchName={branchName}
        storeSettings={storeSettings}
        paymentSources={paymentSources || []}
        onClose={() => setPrintTx(null)}
      />

      {/* Modal Quản lý danh mục */}
      {isManageCategoriesOpen && (
        <div className="fixed inset-0 z-[60] bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Quản lý danh mục Thu / Chi
              </h3>
              <button
                type="button"
                onClick={() => setIsManageCategoriesOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            
            <div className="p-5 space-y-4">
              {/* Toggle Tab */}
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
                <button
                  type="button"
                  onClick={() => setManageCategoryType("income")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    manageCategoryType === "income"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Danh mục Thu
                </button>
                <button
                  type="button"
                  onClick={() => setManageCategoryType("expense")}
                  className={`py-1.5 text-xs font-semibold rounded-lg transition-all ${
                    manageCategoryType === "expense"
                      ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                  }`}
                >
                  Danh mục Chi
                </button>
              </div>

              {/* Form thêm mới */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  placeholder={manageCategoryType === "income" ? "Nhập tên danh mục thu..." : "Nhập tên danh mục chi..."}
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm focus:border-blue-500 dark:focus:border-cyan-400 outline-none text-slate-900 dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={!newCategoryName.trim()}
                  className="h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-sm transition"
                >
                  Thêm
                </button>
              </div>

              {/* Danh sách danh mục */}
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {manageCategoryType === "income" ? (
                  <>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Danh mục hệ thống (Không thể xóa)</div>
                    {[
                      { label: "Bán hàng" },
                      { label: "Dịch vụ" },
                      { label: "Thu nợ khách hàng" },
                      { label: "Thu hộ" },
                      { label: "Thu khác" },
                      { label: "Thu chung" },
                    ].map((cat) => (
                      <div key={cat.label} className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-700 dark:text-slate-350">{cat.label}</span>
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Hệ thống</span>
                      </div>
                    ))}
                    
                    {customIncomeCategories.length > 0 && (
                      <>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2">Danh mục tự định nghĩa</div>
                        {customIncomeCategories.map((name) => (
                          <div key={name} className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">{name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(name, "income")}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                              title="Xóa danh mục này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Danh mục hệ thống (Không thể xóa)</div>
                    {[
                      { label: "Mua hàng" },
                      { label: "Chi trả nhà cung cấp" },
                      { label: "Lương nhân viên" },
                      { label: "Ứng lương" },
                      { label: "Trả nợ nhà cung cấp" },
                      { label: "Trả nợ vay" },
                      { label: "Chi khác" },
                      { label: "Chi chung" },
                    ].map((cat) => (
                      <div key={cat.label} className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-850/40 border border-slate-100 dark:border-slate-800">
                        <span className="text-xs text-slate-700 dark:text-slate-350">{cat.label}</span>
                        <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400">Hệ thống</span>
                      </div>
                    ))}
                    
                    {customExpenseCategories.length > 0 && (
                      <>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4 mb-2">Danh mục tự định nghĩa</div>
                        {customExpenseCategories.map((name) => (
                          <div key={name} className="flex justify-between items-center py-2 px-3 rounded-lg bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700">
                            <span className="text-xs text-slate-800 dark:text-slate-200 font-medium">{name}</span>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategory(name, "expense")}
                              className="text-slate-400 hover:text-red-600 dark:hover:text-red-400 p-1"
                              title="Xóa danh mục này"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {showSession && (
        <CashSessionPanel onClose={() => setShowSession(false)} />
      )}
    </div>
  );
};

export default CashBookPage;
