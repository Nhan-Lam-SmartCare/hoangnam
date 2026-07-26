import React, { useMemo, useState } from "react";
import { X, Check, Smartphone } from "lucide-react";
import type { Part, PartUnit } from "../../../types";
import { formatCurrency, formatDate } from "../../../utils/format";
import { useAvailableUnits } from "../../../hooks/usePartUnitsRepository";

export interface ImeiPickerModalProps {
  part: Part;
  branchId: string;
  /** Máy đã nằm trong giỏ — chọn sẵn để người dùng thấy và bỏ chọn được. */
  preselectedUnitIds?: string[];
  onClose: () => void;
  onConfirm: (units: PartUnit[]) => void;
}

/**
 * Chọn CHIẾC MÁY cụ thể để bán.
 *
 * Bán hàng có IMEI không phải bán "2 cái bất kỳ": mỗi chiếc có IMEI, giá nhập và
 * lịch sử riêng, nên phải chỉ đúng chiếc nào rời kho. Nếu không, phiếu bảo hành
 * không biết ghi IMEI nào và `part_units` sẽ lệch với `parts.stock`.
 */
const ImeiPickerModal: React.FC<ImeiPickerModalProps> = ({
  part,
  branchId,
  preselectedUnitIds = [],
  onClose,
  onConfirm,
}) => {
  const { data: units = [], isLoading, error } = useAvailableUnits(
    part.id,
    branchId
  );
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(preselectedUnitIds)
  );
  const [filter, setFilter] = useState("");

  const visibleUnits = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return units;
    return units.filter(
      (u) =>
        u.imei.toLowerCase().includes(q) ||
        (u.color || "").toLowerCase().includes(q)
    );
  }, [units, filter]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleConfirm = () => {
    const picked = units.filter((u) => selected.has(u.id));
    if (picked.length === 0) return;
    onConfirm(picked);
  };

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center bg-black/60 p-0 sm:p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
              <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Chọn máy để bán
            </div>
            <div className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
              {part.name}
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700"
            aria-label="Đóng"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {units.length > 6 && (
          <div className="border-b border-slate-200 px-4 py-2 dark:border-slate-700">
            <input
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Lọc theo IMEI hoặc màu…"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {isLoading && (
            <div className="py-8 text-center text-sm text-slate-400">
              Đang tải danh sách máy…
            </div>
          )}

          {error && (
            <div className="py-8 text-center text-sm text-red-600 dark:text-red-400">
              Không tải được danh sách máy:{" "}
              {(error as any)?.message || "lỗi không rõ"}
            </div>
          )}

          {!isLoading && !error && units.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
              Sản phẩm này chưa có máy nào ghi IMEI trong kho.
              <div className="mt-1 text-xs text-slate-400">
                Bạn vẫn bán được theo số lượng như bình thường.
              </div>
            </div>
          )}

          {!isLoading && !error && units.length > 0 && visibleUnits.length === 0 && (
            <div className="py-8 text-center text-sm text-slate-400">
              Không có máy nào khớp “{filter}”.
            </div>
          )}

          <ul className="space-y-1.5">
            {visibleUnits.map((unit) => {
              const isOn = selected.has(unit.id);
              return (
                <li key={unit.id}>
                  <button
                    onClick={() => toggle(unit.id)}
                    aria-pressed={isOn}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${isOn
                      ? "border-blue-500 bg-blue-50 dark:border-blue-500 dark:bg-blue-950/40"
                      : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:border-slate-600"
                      }`}
                  >
                    <span
                      className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border ${isOn
                        ? "border-blue-600 bg-blue-600 text-white"
                        : "border-slate-300 dark:border-slate-600"
                        }`}
                    >
                      {isOn && <Check className="h-3.5 w-3.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-sm font-bold text-slate-900 dark:text-slate-100">
                        {unit.isPlaceholder ? (
                          <span className="font-sans text-xs font-normal italic text-slate-400">
                            chưa có IMEI
                          </span>
                        ) : (
                          unit.imei
                        )}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-slate-500 dark:text-slate-400">
                        {unit.color && <span>🎨 {unit.color}</span>}
                        {unit.receiptCode && (
                          <span className="font-mono">{unit.receiptCode}</span>
                        )}
                        <span>Nhập {formatDate(unit.receivedAt)}</span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-slate-200 px-4 py-3 dark:border-slate-700">
          <div className="text-xs text-slate-500 dark:text-slate-400">
            Đã chọn <b className="text-slate-900 dark:text-slate-100">{selected.size}</b>
            {" / "}
            {units.length} máy
            {selected.size > 0 && (
              <span className="ml-1">
                ·{" "}
                {formatCurrency(
                  selected.size * (part.retailPrice?.[branchId] || 0)
                )}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              Hủy
            </button>
            <button
              onClick={handleConfirm}
              disabled={selected.size === 0}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Thêm {selected.size > 0 ? `${selected.size} máy` : ""} vào giỏ
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ImeiPickerModal;
