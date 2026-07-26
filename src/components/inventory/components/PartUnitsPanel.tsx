import React from "react";
import type { PartUnitStatus } from "../../../types";
import { formatCurrency, formatDate } from "../../../utils/format";
import { usePartUnits } from "../../../hooks/usePartUnitsRepository";

export interface PartUnitsPanelProps {
  partId: string;
  branchId: string;
  /** Tồn kho theo `parts.stock` — đem đối chiếu với số máy đếm được. */
  expectedStock: number;
  canViewImportPrice: boolean;
  /** `false` cho mobile: thẻ hẹp, bỏ cột giá nhập & ngày cho đỡ vỡ layout. */
  dense?: boolean;
}

const STATUS_LABEL: Record<PartUnitStatus, string> = {
  in_stock: "Còn kho",
  reserved: "Đang giữ",
  sold: "Đã bán",
  returned: "Đã trả",
  warranty: "Bảo hành",
  lost: "Thất lạc",
};

const STATUS_CLASS: Record<PartUnitStatus, string> = {
  in_stock:
    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800",
  reserved:
    "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  sold: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600",
  returned:
    "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-800",
  warranty:
    "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-900/30 dark:text-indigo-300 dark:border-indigo-800",
  lost: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
};

/**
 * Chi tiết TỪNG MÁY của một sản phẩm — trả lời câu "tồn 2 thì là hai chiếc nào".
 *
 * Chỉ tải khi được mở (component chỉ render lúc dòng đã bung), nên bảng kho
 * không phải gánh thêm query nào ở trạng thái bình thường.
 */
const PartUnitsPanel: React.FC<PartUnitsPanelProps> = ({
  partId,
  branchId,
  expectedStock,
  canViewImportPrice,
  dense = false,
}) => {
  const { data: units = [], isLoading, error } = usePartUnits(partId, branchId);

  if (isLoading) {
    return (
      <div className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
        Đang tải danh sách máy…
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-3 text-center text-xs text-red-600 dark:text-red-400">
        Không tải được danh sách máy: {(error as any)?.message || "lỗi không rõ"}
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="py-3 text-center text-xs text-slate-400 dark:text-slate-500">
        Sản phẩm này chưa có máy nào được ghi IMEI.
        <div className="mt-0.5 text-[10px]">
          IMEI được tạo lúc nhập kho — phiếu nhập cũ sẽ không có.
        </div>
      </div>
    );
  }

  const inStock = units.filter((u) => u.status === "in_stock").length;
  const lech = inStock - expectedStock;

  return (
    <div className="space-y-1.5">
      {lech !== 0 && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex-shrink-0">⚠️</span>
          <span>
            Lệch số liệu: tồn kho ghi <b>{expectedStock}</b> nhưng chỉ có{" "}
            <b>{inStock}</b> máy còn trong kho
            {lech > 0
              ? " (thừa máy chưa trừ khi bán)"
              : " (thiếu máy chưa ghi IMEI)"}
            .
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-100 dark:bg-slate-700/60">
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <th className="px-2 py-1.5 text-left w-8">#</th>
              <th className="px-2 py-1.5 text-left">IMEI</th>
              <th className="px-2 py-1.5 text-left">Màu</th>
              {canViewImportPrice && !dense && (
                <th className="px-2 py-1.5 text-right">Giá nhập</th>
              )}
              <th className="px-2 py-1.5 text-center">Trạng thái</th>
              {!dense && <th className="px-2 py-1.5 text-left">Phiếu nhập</th>}
              {!dense && <th className="px-2 py-1.5 text-right">Ngày nhập</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {units.map((unit, index) => (
              <tr
                key={unit.id}
                className={
                  unit.status === "sold"
                    ? "bg-slate-50/70 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                    : "bg-white dark:bg-slate-800"
                }
              >
                <td className="px-2 py-1.5 text-slate-400">{index + 1}</td>
                <td className="px-2 py-1.5 font-mono font-semibold text-slate-800 dark:text-slate-100">
                  {unit.isPlaceholder ? (
                    <span
                      className="italic font-normal text-slate-400"
                      title="Máy sinh tự động từ tồn kho cũ, chưa gán IMEI thật"
                    >
                      chưa có IMEI
                    </span>
                  ) : (
                    unit.imei
                  )}
                </td>
                <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                  {unit.color || "—"}
                </td>
                {canViewImportPrice && !dense && (
                  <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300">
                    {formatCurrency(unit.importPrice)}
                  </td>
                )}
                <td className="px-2 py-1.5 text-center">
                  <span
                    className={`inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-semibold ${STATUS_CLASS[unit.status]}`}
                  >
                    {STATUS_LABEL[unit.status] || unit.status}
                  </span>
                </td>
                {!dense && (
                  <td className="px-2 py-1.5 font-mono text-[10px] text-slate-500 dark:text-slate-400">
                    {unit.receiptCode || "—"}
                  </td>
                )}
                {!dense && (
                  <td className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">
                    {formatDate(unit.receivedAt)}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PartUnitsPanel;
