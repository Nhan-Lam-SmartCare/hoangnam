import React from "react";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { Part } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { getCategoryColor } from "../../../utils/categoryColors";
import { getAvatarColor } from "../../../utils/avatarColor";
import { getPartWarrantyText } from "../../../utils/partWarranty";
import { getAvailable } from "../../../utils/inventoryCalc";
import PartUnitsPanel from "./PartUnitsPanel";
import { PartUnitsChevron, PartUnitsBadge } from "./PartUnitsToggle";

export interface StockTableRowProps {
  part: Part;
  branchId: string;
  lowStockThreshold: number;
  /** Giá nhập gần nhất (latestImportPriceByPart[part.id]) để fallback khi thiếu costPrice. */
  latestImportPrice: number;
  isSelected: boolean;
  isDuplicate: boolean;
  isActionsOpen: boolean;
  dropdownPos: { top: number; right: number };
  canViewImportPrice: boolean;
  canUpdatePart: boolean;
  canDeletePart: boolean;
  hideLaborCost?: boolean;
  /** Số máy có IMEI còn trong kho. 0 = không có gì để bung. */
  unitCount?: number;
  isExpanded?: boolean;
  onToggleExpand?: (id: string) => void;
  onToggleSelect: (id: string, checked: boolean) => void;
  onShowReservedInfo: (id: string) => void;
  onToggleActions: (id: string, pos: { top: number; right: number }) => void;
  onEdit: (part: Part) => void;
  onQuickWarranty: (part: Part) => void;
  onDelete: (id: string) => void;
}

/**
 * Một dòng bảng tồn kho (desktop). Chỉ hiển thị + phát callback; không giữ state.
 * Giá trị dẫn xuất (available, giá, trạng thái) tính tại chỗ để dòng tự chứa.
 *
 * Khi bung sẽ render thêm MỘT `<tr>` nữa chứa danh sách máy có IMEI.
 */
const StockTableRow: React.FC<StockTableRowProps> = ({
  part,
  branchId,
  lowStockThreshold,
  latestImportPrice,
  isSelected,
  isDuplicate,
  isActionsOpen,
  dropdownPos,
  canViewImportPrice,
  canUpdatePart,
  canDeletePart,
  hideLaborCost = false,
  unitCount = 0,
  isExpanded = false,
  onToggleExpand,
  onToggleSelect,
  onShowReservedInfo,
  onToggleActions,
  onEdit,
  onQuickWarranty,
  onDelete,
}) => {
  const branchKey = branchId || "";
  const reserved = part.reservedStock?.[branchKey] || 0;
  const available = getAvailable(part, branchId);
  const retailPrice = part.retailPrice?.[branchKey] || 0;
  const laborCost = Number((part as any).laborCost?.[branchKey] || 0);
  const costPrice =
    Number(part.costPrice?.[branchKey] || 0) || Number(latestImportPrice || 0);
  const value = available * retailPrice;
  const productInitial = part.name?.charAt(0)?.toUpperCase() || "?";

  const stockStatusClass =
    available === 0
      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300"
      : available <= lowStockThreshold
        ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-600 dark:bg-amber-950/50 dark:text-amber-300"
        : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-300";
  const stockStatusLabel =
    available === 0
      ? "Hết hàng"
      : available <= lowStockThreshold
        ? "Sắp hết"
        : "Ổn định";
  const stockQtyClass =
    available === 0
      ? "text-red-600 dark:text-red-400"
      : available <= lowStockThreshold
        ? "text-amber-600 dark:text-amber-400"
        : "text-emerald-700 dark:text-emerald-400";
  const rowHighlight = isSelected
    ? "bg-blue-900/20 dark:bg-blue-900/20"
    : isDuplicate
      ? "bg-orange-500/10 border-l-4 border-l-orange-500"
      : "";

  const canExpand = Boolean(onToggleExpand);
  // Cùng công thức với ô rỗng ở InventoryManager: checkbox + tên + tồn + giá bán
  // + giá trị + hành động, cộng giá nhập / tiền công nếu cột đó đang hiện.
  const colSpan = 6 + (canViewImportPrice ? 1 : 0) + (hideLaborCost ? 0 : 1);

  return (
    <>
      <tr
        className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${rowHighlight}`}
      >
        <td className="px-3 py-2 text-center">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={(e) => onToggleSelect(part.id, e.target.checked)}
            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
          />
        </td>
        <td
          className={`px-3 py-2 ${canExpand ? "cursor-pointer group/cell" : ""}`}
          onClick={(e) => {
            if (canExpand && onToggleExpand) {
              onToggleExpand(part.id);
            }
          }}
          title={canExpand ? (isExpanded ? "Bấm để thu gọn chi tiết" : "Bấm để xem chi tiết danh sách máy & IMEI") : undefined}
        >
          <div className="flex items-center gap-2">
            <PartUnitsChevron
              partId={part.id}
              unitCount={unitCount}
              isExpanded={isExpanded}
              onToggle={onToggleExpand}
            />
            <div
              className="h-8 w-8 rounded-lg overflow-hidden flex items-center justify-center text-xs font-semibold text-white flex-shrink-0"
              style={
                part.imageUrl
                  ? undefined
                  : { backgroundColor: getAvatarColor(part.category || "") }
              }
            >
              {part.imageUrl ? (
                <img
                  src={part.imageUrl}
                  alt={part.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span>{productInitial}</span>
              )}
            </div>
            <div className="flex flex-col gap-0.5 min-w-0">
              <div className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-slate-100 break-words whitespace-normal leading-snug max-w-[350px] lg:max-w-[480px] group-hover/cell:text-blue-600 dark:group-hover/cell:text-blue-400 transition-colors">
                {part.name}
                {isDuplicate && (
                  <span
                    className="inline-flex items-center gap-0.5 rounded-full border border-orange-300 bg-orange-50 px-1.5 py-0 text-[9px] font-semibold text-orange-700 dark:bg-orange-900/30 flex-shrink-0"
                    title="Sản phẩm có mã trùng lặp"
                  >
                    ⚠️ Trùng
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                {part.barcode ? (
                  <span className="text-blue-600 dark:text-blue-400">
                    Mã: {part.barcode}
                  </span>
                ) : (
                  <span className="text-blue-600 dark:text-blue-400">
                    SKU: {part.sku || "N/A"}
                  </span>
                )}
              </div>
              {part.description && (
                <div
                  className="text-[10px] text-slate-500 dark:text-slate-400 truncate max-w-[260px]"
                  title={part.description}
                >
                  {part.description}
                </div>
              )}
              {part.category && (
                <span
                  className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg
                    } ${getCategoryColor(part.category).text
                    }`}
                >
                  {part.category}
                </span>
              )}
              {(part.imei || (part as any).imeis?.length > 0) && (
                <span
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 border border-blue-200 dark:border-blue-800 hover:bg-blue-100 dark:hover:bg-blue-900/70 transition-all cursor-pointer shadow-2xs"
                  title="Bấm để xem chi tiết danh sách máy & IMEI"
                >
                  📱 IMEI: {part.imei || (part as any).imeis?.join(", ")}
                </span>
              )}
              {part.color && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-50 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                  🎨 Màu: {part.color}
                </span>
              )}
              {getPartWarrantyText(part) && (
                <span className="inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-semibold bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                  BH: {getPartWarrantyText(part)}
                </span>
              )}
            </div>
          </div>
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-center">
          <div className="flex flex-col items-center gap-0.5">
            <span className={`text-sm font-semibold ${stockQtyClass}`}>
              {available.toLocaleString()}
            </span>
            {reserved > 0 && (
              <span
                className="text-[10px] text-amber-600 dark:text-amber-400 cursor-pointer hover:underline hover:text-amber-700"
                onClick={(e) => {
                  e.stopPropagation();
                  onShowReservedInfo(part.id);
                }}
                title="Nhấn để xem chi tiết phiếu đang giữ hàng"
              >
                (Đặt trước: {reserved})
              </span>
            )}
            <PartUnitsBadge
              partId={part.id}
              unitCount={unitCount}
              expectedStock={available}
              isExpanded={isExpanded}
              onToggle={onToggleExpand}
            />
            <span
              className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0 text-[9px] font-semibold ${stockStatusClass}`}
            >
              <span
                className={`h-1 w-1 rounded-full ${available === 0
                  ? "bg-red-500"
                  : available <= lowStockThreshold
                    ? "bg-amber-500"
                    : "bg-emerald-500"
                  }`}
              ></span>
              {stockStatusLabel}
            </span>
          </div>
        </td>
        {canViewImportPrice && (
          <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-slate-600 dark:text-slate-300">
            {formatCurrency(costPrice)}
          </td>
        )}
        <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-medium text-slate-900 dark:text-slate-100">
          {formatCurrency(retailPrice)}
        </td>
        {!hideLaborCost && (
          <td className="px-3 py-2 whitespace-nowrap text-right text-xs text-slate-600 dark:text-slate-300">
            {formatCurrency(laborCost)}
          </td>
        )}
        <td className="px-3 py-2 whitespace-nowrap text-right text-xs font-semibold text-slate-900 dark:text-slate-100">
          {formatCurrency(value)}
        </td>
        <td className="px-3 py-2 whitespace-nowrap text-center">
          <div className="relative flex justify-end">
            {(canUpdatePart || canDeletePart) && (
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  const rect = event.currentTarget.getBoundingClientRect();
                  onToggleActions(part.id, {
                    top: rect.bottom + 4,
                    right: window.innerWidth - rect.right,
                  });
                }}
                className="rounded-full border border-transparent p-2 text-slate-600 dark:text-slate-300 hover:border-slate-300 dark:border-slate-600 hover:text-slate-900 dark:text-slate-100 transition"
                aria-haspopup="menu"
                aria-expanded={isActionsOpen}
                title="Thao tác nhanh"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>
            )}
            {isActionsOpen && (
              <div
                className="fixed w-44 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-white shadow-xl dark:bg-slate-800 z-[9999]"
                style={{ top: dropdownPos.top, right: dropdownPos.right }}
                onClick={(event) => event.stopPropagation()}
              >
                {canUpdatePart && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onEdit(part);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm hover:bg-blue-50 dark:hover:bg-slate-700"
                  >
                    <Edit className="h-4 w-4 text-blue-500" />
                    Chỉnh sửa
                  </button>
                )}
                {canUpdatePart && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onQuickWarranty(part);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-indigo-600 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-slate-700"
                  >
                    <span className="h-4 w-4 inline-flex items-center justify-center">🛡</span>
                    Sửa bảo hành
                  </button>
                )}
                {canDeletePart && (
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(part.id);
                    }}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-red-500 hover:bg-red-50 dark:hover:bg-slate-700/70"
                  >
                    <Trash2 className="h-4 w-4" />
                    Xóa
                  </button>
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && canExpand && (
        <tr className="bg-slate-50/80 dark:bg-slate-900/40">
          <td colSpan={colSpan} className="px-3 pb-3 pt-1">
            <PartUnitsPanel
              partId={part.id}
              branchId={branchId}
              expectedStock={available}
              canViewImportPrice={canViewImportPrice}
              part={part}
            />
          </td>
        </tr>
      )}
    </>
  );
};

export default StockTableRow;
