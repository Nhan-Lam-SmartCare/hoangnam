import React, { useMemo, useState } from "react";
import { X, RotateCcw } from "lucide-react";
import { useAppContext } from "../../contexts/AppContext";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import type { Sale } from "../../types";

interface Props {
  sale: Sale;
  onClose: () => void;
  onDone?: () => void;
}

/** Modal chọn item + số lượng để trả một phần đơn bán, kèm hoàn tiền. */
export const ReturnSaleModal: React.FC<Props> = ({ sale, onClose, onDone }) => {
  const { returnSaleItems } = useAppContext();

  const rows = useMemo(
    () =>
      (sale.items || []).map((it) => ({
        partId: it.partId,
        partName: it.partName,
        sellingPrice: it.sellingPrice,
        remaining: Math.max(0, it.quantity - (it.returnedQty || 0)),
      })),
    [sale]
  );

  const [qty, setQty] = useState<Record<string, number>>({});
  const [refundSource, setRefundSource] = useState<"cash" | "bank">("cash");
  const [reason, setReason] = useState("");
  const [refundOverride, setRefundOverride] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selected = rows
    .map((r) => ({
      partId: r.partId,
      quantity: Math.min(Math.max(0, qty[r.partId] || 0), r.remaining),
      sellingPrice: r.sellingPrice,
    }))
    .filter((i) => i.quantity > 0);

  const suggestedRefund = selected.reduce(
    (s, i) => s + i.sellingPrice * i.quantity,
    0
  );
  const effectiveRefund = refundOverride ?? suggestedRefund;

  const submit = async () => {
    if (!selected.length) {
      showToast.warning("Chưa chọn số lượng cần trả.");
      return;
    }
    setSubmitting(true);
    const res = await returnSaleItems({
      saleId: sale.id,
      items: selected.map((i) => ({ partId: i.partId, quantity: i.quantity })),
      refundAmount: Math.max(0, effectiveRefund),
      refundSource,
      reason: reason.trim() || undefined,
    });
    setSubmitting(false);
    if (res.ok) {
      onDone?.();
      onClose();
    }
  };

  const nothingReturnable = rows.every((r) => r.remaining <= 0);

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white dark:bg-slate-800 shadow-xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-2 font-bold text-slate-900 dark:text-white">
            <RotateCcw className="w-5 h-5 text-amber-500" />
            Đổi/Trả hàng — HĐ #{sale.id}
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
          {nothingReturnable ? (
            <div className="text-sm text-slate-500 text-center py-6">
              Đơn này đã được trả hết, không còn mặt hàng nào để trả.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((r) => (
                <div
                  key={r.partId}
                  className="flex items-center gap-3 p-2 rounded-xl border border-slate-200 dark:border-slate-700"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">
                      {r.partName}
                    </div>
                    <div className="text-[11px] text-slate-400">
                      Còn có thể trả: {r.remaining} · {formatCurrency(r.sellingPrice)}
                    </div>
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={r.remaining}
                    disabled={r.remaining <= 0}
                    value={qty[r.partId] || 0}
                    onChange={(e) => {
                      const v = Math.min(
                        r.remaining,
                        Math.max(0, Number(e.target.value) || 0)
                      );
                      setQty((prev) => ({ ...prev, [r.partId]: v }));
                    }}
                    className="w-20 px-2 h-9 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right disabled:opacity-40"
                  />
                </div>
              ))}
            </div>
          )}

          {!nothingReturnable && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <label className="block">
                  <span className="text-xs text-slate-500">Hoàn tiền qua</span>
                  <select
                    value={refundSource}
                    onChange={(e) =>
                      setRefundSource(e.target.value as "cash" | "bank")
                    }
                    className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                  >
                    <option value="cash">Tiền mặt</option>
                    <option value="bank">Chuyển khoản</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-xs text-slate-500">Số tiền hoàn</span>
                  <input
                    type="number"
                    min={0}
                    value={effectiveRefund}
                    onChange={(e) =>
                      setRefundOverride(Math.max(0, Number(e.target.value) || 0))
                    }
                    className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-right"
                  />
                </label>
              </div>

              <label className="block">
                <span className="text-xs text-slate-500">Lý do (tùy chọn)</span>
                <input
                  type="text"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="VD: khách đổi ý, hàng lỗi..."
                  className="mt-1 w-full px-3 h-10 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900"
                />
              </label>

              <div className="flex items-center justify-between text-sm font-semibold pt-1">
                <span className="text-slate-500">Sẽ hoàn khách</span>
                <span className="text-amber-600 dark:text-amber-400 font-mono">
                  {formatCurrency(Math.max(0, effectiveRefund))}
                </span>
              </div>
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 h-11 rounded-xl border border-slate-300 dark:border-slate-600 font-semibold text-slate-600 dark:text-slate-300"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={submitting || nothingReturnable || !selected.length}
            onClick={submit}
            className="flex-1 h-11 rounded-xl bg-amber-600 text-white font-semibold disabled:opacity-50"
          >
            {submitting ? "Đang xử lý..." : "Xác nhận trả hàng"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReturnSaleModal;
