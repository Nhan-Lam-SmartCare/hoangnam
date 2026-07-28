import React, { useState, useMemo } from "react";
import type { PartUnitStatus, PartUnit, Part } from "../../../types";
import { formatCurrency, formatDate } from "../../../utils/format";
import { usePartUnits, useUpdatePartUnit, useCreatePartUnit } from "../../../hooks/usePartUnitsRepository";
import { useSuppliers } from "../../../hooks/useSuppliers";
import { Edit2, Check, X, Loader2, Plus, Sparkles } from "lucide-react";
import { showToast } from "../../../utils/toast";

export interface PartUnitsPanelProps {
  partId: string;
  branchId: string;
  /** Tồn kho theo `parts.stock` — đem đối chiếu với số máy đếm được. */
  expectedStock: number;
  canViewImportPrice: boolean;
  /** `false` cho mobile: thẻ hẹp, bỏ cột giá nhập & ngày cho đỡ vỡ layout. */
  dense?: boolean;
  part?: Part;
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
 * Hỗ trợ chỉnh sửa trực tiếp IMEI và Màu sắc từng chiếc máy + hiển thị Nhà cung cấp.
 */
const PartUnitsPanel: React.FC<PartUnitsPanelProps> = ({
  partId,
  branchId,
  expectedStock,
  canViewImportPrice,
  dense = false,
  part,
}) => {
  const { data: units = [], isLoading, error } = usePartUnits(partId, branchId);
  const { data: suppliers = [] } = useSuppliers();
  const updateUnitMutation = useUpdatePartUnit();
  const createUnitMutation = useCreatePartUnit();

  /**
   * Ô nhập cho các máy CHƯA có bản ghi IMEI, một dòng cho mỗi máy còn thiếu.
   *
   * Phải là danh sách chứ không phải một ô duy nhất: sản phẩm tồn 3 mà chỉ ghi
   * được 1 IMEI thì màn Bán hàng bắt chọn máy nhưng chỉ liệt kê 1 chiếc — hệ
   * thống báo còn 3 mà bán được 1. Điền dở dang còn kẹt hơn là chưa điền gì.
   */
  const [drafts, setDrafts] = useState<Record<number, { imei: string; color: string }>>({});
  const setDraft = (i: number, patch: Partial<{ imei: string; color: string }>) =>
    setDrafts((prev) => {
      const current = prev[i] || { imei: "", color: "" };
      return { ...prev, [i]: { ...current, ...patch } };
    });

  const supplierNameById = useMemo(() => {
    const map = new Map<string, string>();
    suppliers.forEach((s: any) => {
      if (s.id && s.name) map.set(s.id, s.name);
    });
    return map;
  }, [suppliers]);

  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editImei, setEditImei] = useState("");
  const [editColor, setEditColor] = useState("");

  const startEdit = (unit: PartUnit) => {
    setEditingUnitId(unit.id);
    setEditImei(unit.isPlaceholder ? "" : unit.imei || "");
    setEditColor(unit.color || "");
  };

  const cancelEdit = () => {
    setEditingUnitId(null);
    setEditImei("");
    setEditColor("");
  };

  const saveEdit = async (unitId: string) => {
    if (!editImei.trim()) return;
    try {
      await updateUnitMutation.mutateAsync({
        id: unitId,
        patch: {
          imei: editImei.trim(),
          color: editColor.trim() || undefined,
        },
      });
      cancelEdit();
    } catch {
      // Error toast handled by useUpdatePartUnit
    }
  };

  const createOneUnit = async (imei: string, color: string) => {
    await createUnitMutation.mutateAsync({
      partId,
      branchId,
      imei: imei.trim(),
      color: color.trim() || undefined,
      supplierId: (part as any)?.supplierId || (part as any)?.supplier_id || undefined,
      // Bảng bên dưới hiện giá nhập của sản phẩm, nên phải lưu đúng con số đó.
      // Bỏ trống thì DB nhận 0 và máy này báo lãi bằng cả giá bán.
      importPrice: Number(part?.costPrice?.[branchId] || 0),
    });
  };

  /**
   * Lưu MỘT dòng backfill.
   */
  const handleCreateUnit = async (row: { index: number; imei: string; color: string }) => {
    const targetImei = row.imei.trim();
    if (!targetImei) {
      showToast.warning("Vui lòng nhập IMEI để lưu");
      return;
    }
    try {
      await createOneUnit(targetImei, row.color);
      showToast.success(`Đã lưu máy IMEI ${targetImei}`);
      // Chỉ xóa draft của dòng vừa lưu, giữ nguyên các dòng draft còn lại
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[row.index];
        return next;
      });
    } catch (err: any) {
      console.error("Lỗi lưu IMEI:", err);
      showToast.error(err?.message || "Lỗi khi lưu máy IMEI (có thể IMEI đã tồn tại)");
    }
  };

  /**
   * Lưu tất cả dòng đã điền, chạy TUẦN TỰ để lỗi trùng IMEI chỉ dừng đúng chiếc
   * gây lỗi — các máy trước đó đã vào CSDL và không phải gõ lại.
   */
  const handleCreateAll = async (rows: { index: number; imei: string; color: string }[]) => {
    const filled = rows.filter((r) => r.imei.trim());
    if (filled.length === 0) {
      showToast.warning("Chưa có IMEI nào để lưu");
      return;
    }
    let saved = 0;
    const savedIndices: number[] = [];
    for (const row of filled) {
      try {
        await createOneUnit(row.imei, row.color);
        saved += 1;
        savedIndices.push(row.index);
      } catch (err: any) {
        console.error("Lỗi lưu dòng IMEI:", err);
        showToast.error(`Lỗi ở máy #${row.index + 1} (${row.imei}): ${err?.message || "IMEI bị trùng hoặc không hợp lệ"}`);
        break;
      }
    }
    if (savedIndices.length > 0) {
      setDrafts((prev) => {
        const next = { ...prev };
        savedIndices.forEach((i) => delete next[i]);
        return next;
      });
    }
    if (saved > 0 && saved < filled.length) {
      showToast.warning(`Đã lưu ${saved}/${filled.length} máy, phần còn lại chưa lưu được.`);
    } else if (saved === filled.length) {
      showToast.success(`Đã lưu thành công ${saved} máy IMEI`);
    }
  };

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

  const inStock = units.filter((u) => u.status === "in_stock").length;
  const lech = inStock - expectedStock;

  /**
   * Số máy tồn kho ghi nhận nhưng CHƯA có bản ghi IMEI. Đây chính là những chiếc
   * mà màn Bán hàng không bán được — picker không có gì để chọn — dù tồn kho vẫn
   * báo còn. Sinh đủ số dòng để điền một lượt, chứ không phải một ô duy nhất.
   */
  const missingUnits = Math.max(0, expectedStock - inStock);

  // IMEI/màu ở cột cũ trên `parts` chỉ dùng gợi ý cho dòng đầu, và chỉ khi chưa
  // có máy nào — đã lưu được máy rồi thì nhiều khả năng IMEI đó là chiếc đã lưu.
  const legacyImei = units.length === 0 ? part?.imei || (part as any)?.imeis?.join(", ") || "" : "";
  const legacyColor = units.length === 0 ? part?.color || "" : "";
  const partImportPrice = part?.costPrice?.[branchId] || 0;
  const partSupplierId = (part as any)?.supplierId || (part as any)?.supplier_id;
  const partSupplierName = partSupplierId ? supplierNameById.get(partSupplierId) : undefined;

  const backfillRows = Array.from({ length: missingUnits }, (_, i) => ({
    index: i,
    imei: drafts[i]?.imei ?? (i === 0 ? legacyImei : ""),
    color: drafts[i]?.color ?? (i === 0 ? legacyColor : ""),
  }));

  const renderBackfill = () => (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
        <span>
          ⚠️ Tồn kho ghi <b>{expectedStock} máy</b> nhưng còn <b>{missingUnits} máy</b>{" "}
          chưa có IMEI. Chưa ghi IMEI thì màn Bán hàng không chọn được máy để bán.
        </span>
        {missingUnits > 1 && (
          <button
            type="button"
            onClick={() => handleCreateAll(backfillRows)}
            disabled={createUnitMutation.isPending}
            className="shrink-0 flex items-center gap-1 rounded bg-emerald-600 px-2 py-0.5 text-[11px] font-bold text-white shadow-2xs hover:bg-emerald-700 disabled:opacity-50"
          >
            {createUnitMutation.isPending ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Sparkles className="w-3 h-3" />
            )}
            Lưu tất cả
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-100 dark:bg-slate-700/60">
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <th className="px-2 py-1.5 text-left w-8">#</th>
              <th className="px-2 py-1.5 text-left min-w-[140px]">IMEI</th>
              <th className="px-2 py-1.5 text-left min-w-[100px]">Màu</th>
              {canViewImportPrice && !dense && (
                <th className="px-2 py-1.5 text-right">Giá nhập</th>
              )}
              <th className="px-2 py-1.5 text-center">Trạng thái</th>
              {!dense && <th className="px-2 py-1.5 text-left">Phiếu nhập &amp; NCC</th>}
              {!dense && <th className="px-2 py-1.5 text-right">Ngày nhập</th>}
              <th className="px-2 py-1.5 text-center w-24">Lưu CSDL</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700 bg-white dark:bg-slate-800">
            {backfillRows.map((row) => (
              <tr key={row.index}>
                <td className="px-2 py-1.5 text-slate-400">{units.length + row.index + 1}</td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.imei}
                    onChange={(e) => setDraft(row.index, { imei: e.target.value })}
                    placeholder="Gõ IMEI máy..."
                    className="w-full px-2 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 font-mono text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </td>
                <td className="px-2 py-1.5">
                  <input
                    type="text"
                    value={row.color}
                    onChange={(e) => setDraft(row.index, { color: e.target.value })}
                    placeholder="Màu..."
                    className="w-full px-2 py-0.5 border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                  />
                </td>
                {canViewImportPrice && !dense && (
                  <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300 font-medium">
                    {formatCurrency(partImportPrice)}
                  </td>
                )}
                <td className="px-2 py-1.5 text-center">
                  <span className="inline-flex items-center rounded-full border px-1.5 py-0 text-[9px] font-semibold bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-800">
                    Còn kho
                  </span>
                </td>
                {!dense && (
                  <td className="px-2 py-1.5 text-[10px]">
                    <div className="font-mono text-slate-500 dark:text-slate-400">
                      Mặc định từ sp
                    </div>
                    {partSupplierName && (
                      <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[150px]">
                        🏢 {partSupplierName}
                      </div>
                    )}
                  </td>
                )}
                {!dense && <td className="px-2 py-1.5 text-right text-slate-400">—</td>}
                <td className="px-2 py-1.5 text-center">
                  <button
                    type="button"
                    onClick={() => handleCreateUnit(row)}
                    disabled={createUnitMutation.isPending || !row.imei.trim()}
                    className="w-full flex items-center justify-center gap-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white shadow-2xs transition hover:bg-blue-700 disabled:opacity-40"
                  >
                    {createUnitMutation.isPending ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Lưu máy
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Chưa lưu được máy nào: không có bảng danh sách để hiện, chỉ còn form điền.
  if (units.length === 0) {
    return renderBackfill();
  }

  return (
    <div className="space-y-1.5">
      {/* Thừa máy: có bản ghi IMEI nhiều hơn tồn kho — không backfill được, chỉ
          báo để người dùng đi soát. Thiếu máy thì rơi vào form backfill bên dưới. */}
      {lech > 0 && (
        <div className="flex items-start gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-800 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
          <span className="flex-shrink-0">⚠️</span>
          <span>
            Lệch số liệu: tồn kho ghi <b>{expectedStock}</b> nhưng có tới{" "}
            <b>{inStock}</b> máy còn trong kho (thừa máy chưa trừ khi bán).
          </span>
        </div>
      )}

      <div className="overflow-hidden rounded-lg border border-slate-200 dark:border-slate-600">
        <table className="w-full text-[11px]">
          <thead className="bg-slate-100 dark:bg-slate-700/60">
            <tr className="text-[10px] uppercase tracking-wide text-slate-500 dark:text-slate-300">
              <th className="px-2 py-1.5 text-left w-8">#</th>
              <th className="px-2 py-1.5 text-left min-w-[140px]">IMEI</th>
              <th className="px-2 py-1.5 text-left min-w-[100px]">Màu</th>
              {canViewImportPrice && !dense && (
                <th className="px-2 py-1.5 text-right">Giá nhập</th>
              )}
              <th className="px-2 py-1.5 text-center">Trạng thái</th>
              {!dense && <th className="px-2 py-1.5 text-left">Phiếu nhập & NCC</th>}
              {!dense && <th className="px-2 py-1.5 text-right">Ngày nhập</th>}
              <th className="px-2 py-1.5 text-center w-14">Sửa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {units.map((unit, index) => {
              const isEditing = editingUnitId === unit.id;
              const isSaving = updateUnitMutation.isPending && isEditing;
              const suppName = unit.supplierId ? supplierNameById.get(unit.supplierId) : undefined;

              return (
                <tr
                  key={unit.id}
                  className={
                    isEditing
                      ? "bg-blue-50/50 dark:bg-blue-950/30"
                      : unit.status === "sold"
                      ? "bg-slate-50/70 text-slate-400 dark:bg-slate-800/40 dark:text-slate-500"
                      : "bg-white dark:bg-slate-800"
                  }
                >
                  <td className="px-2 py-1.5 text-slate-400">{index + 1}</td>
                  
                  {/* IMEI column */}
                  <td className="px-2 py-1.5">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editImei}
                        onChange={(e) => setEditImei(e.target.value)}
                        placeholder="Nhập IMEI mới..."
                        autoFocus
                        className="w-full px-2 py-0.5 border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono text-xs outline-none"
                      />
                    ) : (
                      <span className="font-mono font-semibold text-slate-800 dark:text-slate-100">
                        {unit.isPlaceholder ? (
                          <span
                            className="italic font-normal text-amber-600 dark:text-amber-400"
                            title="Bấm nút sửa để gán IMEI thật"
                          >
                            chưa có IMEI ⚠️
                          </span>
                        ) : (
                          unit.imei
                        )}
                      </span>
                    )}
                  </td>

                  {/* Màu sắc column */}
                  <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300">
                    {isEditing ? (
                      <input
                        type="text"
                        value={editColor}
                        onChange={(e) => setEditColor(e.target.value)}
                        placeholder="Màu sắc..."
                        className="w-full px-2 py-0.5 border border-blue-400 dark:border-blue-500 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs outline-none"
                      />
                    ) : (
                      unit.color || "—"
                    )}
                  </td>

                  {canViewImportPrice && !dense && (
                    <td className="px-2 py-1.5 text-right text-slate-600 dark:text-slate-300 font-medium">
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
                    <td className="px-2 py-1.5 text-[10px]">
                      <div className="font-mono text-slate-700 dark:text-slate-300 font-medium">
                        {unit.receiptCode || "—"}
                      </div>
                      {suppName && (
                        <div
                          className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold truncate max-w-[150px]"
                          title={`Nhà cung cấp: ${suppName}`}
                        >
                          🏢 {suppName}
                        </div>
                      )}
                    </td>
                  )}

                  {!dense && (
                    <td className="px-2 py-1.5 text-right text-slate-500 dark:text-slate-400">
                      {formatDate(unit.receivedAt)}
                    </td>
                  )}

                  {/* Edit Action column */}
                  <td className="px-2 py-1.5 text-center">
                    {isEditing ? (
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(unit.id)}
                          disabled={isSaving || !editImei.trim()}
                          className="p-1 rounded bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition"
                          title="Lưu IMEI & Màu"
                        >
                          {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="p-1 rounded bg-slate-300 text-slate-700 hover:bg-slate-400 dark:bg-slate-700 dark:text-slate-200 transition"
                          title="Hủy"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEdit(unit)}
                        className="p-1 rounded hover:bg-blue-50 text-blue-600 dark:hover:bg-blue-900/30 dark:text-blue-400 transition"
                        title="Chỉnh sửa IMEI / Màu sắc máy này"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Form backfill nằm NGAY DƯỚI bảng chứ không thay thế bảng: lưu chiếc 1
          trong 2 xong mà form biến mất thì không còn đường nhập nốt chiếc 2. */}
      {missingUnits > 0 && renderBackfill()}
    </div>
  );
};

export default PartUnitsPanel;

