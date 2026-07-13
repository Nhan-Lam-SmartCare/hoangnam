import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, Wallet, Lock, Unlock } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import {
  fetchOpenCashSession,
  fetchRecentCashSessions,
  openCashSession,
  closeCashSession,
} from "../../lib/repository/cashSessionsRepository";

interface Props {
  onClose: () => void;
}

/** Panel Chốt ca / đối soát quỹ: mở ca, đếm tiền cuối ca, so kỳ vọng vs thực đếm. */
export const CashSessionPanel: React.FC<Props> = ({ onClose }) => {
  const { paymentSources, currentBranchId } = useAppContext();
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  // Số dư hiện tại theo nguồn (kỳ vọng = số dư hệ thống đang có).
  const currentBalances = useMemo(() => {
    const map: Record<string, number> = {};
    paymentSources.forEach((ps) => {
      map[ps.id] = ps.balance?.[currentBranchId] || 0;
    });
    return map;
  }, [paymentSources, currentBranchId]);

  const openQuery = useQuery({
    queryKey: ["cashSession", "open", currentBranchId],
    queryFn: () => fetchOpenCashSession(currentBranchId),
  });
  const recentQuery = useQuery({
    queryKey: ["cashSession", "recent", currentBranchId],
    queryFn: () => fetchRecentCashSessions(currentBranchId, 8),
  });

  const openSession =
    openQuery.data?.ok && openQuery.data.data ? openQuery.data.data : null;

  const [counted, setCounted] = useState<Record<string, number>>({});
  const [note, setNote] = useState("");

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["cashSession"] });
  };

  const openMutation = useMutation({
    mutationFn: () =>
      openCashSession({
        branchId: currentBranchId,
        openedBy: profile?.id,
        openedByName: profile?.name || profile?.full_name || profile?.email,
        openingBalance: currentBalances,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        showToast.success("Đã mở ca.");
        invalidate();
      } else {
        showToast.error(`Không mở được ca: ${res.error.message}`);
      }
    },
  });

  const closeMutation = useMutation({
    mutationFn: () =>
      closeCashSession({
        id: openSession!.id,
        counted,
        expected: currentBalances,
        note: note.trim() || undefined,
        closedBy: profile?.id,
        closedByName: profile?.name || profile?.full_name || profile?.email,
      }),
    onSuccess: (res) => {
      if (res.ok) {
        showToast.success("Đã chốt ca.");
        setCounted({});
        setNote("");
        invalidate();
      } else {
        showToast.error(`Không chốt được ca: ${res.error.message}`);
      }
    },
  });

  const totalExpected = Object.values(currentBalances).reduce(
    (s, n) => s + n,
    0
  );
  const totalCounted = paymentSources.reduce(
    (s, ps) => s + (counted[ps.id] || 0),
    0
  );
  const totalDiff = totalCounted - totalExpected;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <Wallet className="w-5 h-5 text-indigo-500" />
            Chốt ca / Đối soát quỹ
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {openQuery.isLoading ? (
            <div className="text-sm text-slate-500 text-center py-6">
              Đang tải...
            </div>
          ) : !openSession ? (
            <div className="space-y-3">
              <div className="text-sm text-slate-600 dark:text-slate-300">
                Chưa có ca nào đang mở. Mở ca sẽ ghi lại số dư hiện tại của từng
                nguồn tiền làm mốc đầu ca.
              </div>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700">
                {paymentSources.map((ps) => (
                  <div
                    key={ps.id}
                    className="flex items-center justify-between px-3 py-2 text-sm"
                  >
                    <span className="text-slate-600 dark:text-slate-300">
                      {ps.name}
                    </span>
                    <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                      {formatCurrency(currentBalances[ps.id] || 0)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                type="button"
                disabled={openMutation.isPending}
                onClick={() => openMutation.mutate()}
                className="w-full h-11 rounded-xl bg-indigo-600 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Unlock className="w-4 h-4" />
                {openMutation.isPending ? "Đang mở..." : "Mở ca"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-slate-400">
                Ca mở lúc{" "}
                {new Date(openSession.openedAt).toLocaleString("vi-VN")}
                {openSession.openedByName ? ` · ${openSession.openedByName}` : ""}
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="grid grid-cols-12 px-3 py-2 bg-slate-50 dark:bg-slate-900/40 text-[11px] font-bold uppercase text-slate-400">
                  <div className="col-span-4">Nguồn</div>
                  <div className="col-span-3 text-right">Kỳ vọng</div>
                  <div className="col-span-3 text-right">Thực đếm</div>
                  <div className="col-span-2 text-right">Lệch</div>
                </div>
                {paymentSources.map((ps) => {
                  const expected = currentBalances[ps.id] || 0;
                  const cnt = counted[ps.id] || 0;
                  const diff = cnt - expected;
                  return (
                    <div
                      key={ps.id}
                      className="grid grid-cols-12 items-center px-3 py-2 text-sm border-t border-slate-100 dark:border-slate-700"
                    >
                      <div className="col-span-4 text-slate-600 dark:text-slate-300 truncate">
                        {ps.name}
                      </div>
                      <div className="col-span-3 text-right font-mono text-slate-500">
                        {formatCurrency(expected)}
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min={0}
                          value={counted[ps.id] ?? ""}
                          onChange={(e) =>
                            setCounted((prev) => ({
                              ...prev,
                              [ps.id]: Math.max(0, Number(e.target.value) || 0),
                            }))
                          }
                          className="w-full px-2 h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right"
                        />
                      </div>
                      <div
                        className={`col-span-2 text-right font-mono font-semibold ${
                          diff === 0
                            ? "text-slate-400"
                            : diff > 0
                            ? "text-emerald-600"
                            : "text-rose-500"
                        }`}
                      >
                        {diff > 0 ? "+" : ""}
                        {formatCurrency(diff)}
                      </div>
                    </div>
                  );
                })}
                <div className="grid grid-cols-12 items-center px-3 py-2 text-sm border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40 font-bold">
                  <div className="col-span-4">Tổng</div>
                  <div className="col-span-3 text-right font-mono">
                    {formatCurrency(totalExpected)}
                  </div>
                  <div className="col-span-3 text-right font-mono">
                    {formatCurrency(totalCounted)}
                  </div>
                  <div
                    className={`col-span-2 text-right font-mono ${
                      totalDiff === 0
                        ? "text-slate-400"
                        : totalDiff > 0
                        ? "text-emerald-600"
                        : "text-rose-500"
                    }`}
                  >
                    {totalDiff > 0 ? "+" : ""}
                    {formatCurrency(totalDiff)}
                  </div>
                </div>
              </div>

              <label className="block">
                <span className="text-xs text-slate-500">Ghi chú (tùy chọn)</span>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="VD: chênh lệch do trả lẻ..."
                  className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </label>

              <button
                type="button"
                disabled={closeMutation.isPending}
                onClick={() => closeMutation.mutate()}
                className="w-full h-11 rounded-xl bg-rose-600 text-white font-semibold disabled:opacity-50 inline-flex items-center justify-center gap-2"
              >
                <Lock className="w-4 h-4" />
                {closeMutation.isPending ? "Đang chốt..." : "Chốt ca"}
              </button>
            </div>
          )}

          {/* Lịch sử ca gần đây */}
          {recentQuery.data?.ok && recentQuery.data.data.length > 0 && (
            <div className="pt-2">
              <div className="text-xs font-bold uppercase text-slate-400 mb-1">
                Ca gần đây
              </div>
              <div className="space-y-1">
                {recentQuery.data.data
                  .filter((s) => s.status === "closed")
                  .map((s) => {
                    const exp = Object.values(s.expected).reduce(
                      (a, b) => a + b,
                      0
                    );
                    const cnt = Object.values(s.counted).reduce(
                      (a, b) => a + b,
                      0
                    );
                    const diff = cnt - exp;
                    return (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-xs px-3 py-2 rounded-lg border border-slate-100 dark:border-slate-700"
                      >
                        <span className="text-slate-500">
                          {s.closedAt
                            ? new Date(s.closedAt).toLocaleString("vi-VN")
                            : ""}
                        </span>
                        <span
                          className={`font-mono font-semibold ${
                            diff === 0
                              ? "text-slate-400"
                              : diff > 0
                              ? "text-emerald-600"
                              : "text-rose-500"
                          }`}
                        >
                          Lệch {diff > 0 ? "+" : ""}
                          {formatCurrency(diff)}
                        </span>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CashSessionPanel;
