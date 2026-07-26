import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

export interface PartUnitsChevronProps {
  partId: string;
  /** 0 = không có máy nào => chỉ chiếm chỗ để các dòng thẳng hàng. */
  unitCount: number;
  isExpanded: boolean;
  onToggle?: (id: string) => void;
}

/** Mũi bung/thu ở đầu cột tên sản phẩm (desktop). */
export const PartUnitsChevron: React.FC<PartUnitsChevronProps> = ({
  partId,
  unitCount,
  isExpanded,
  onToggle,
}) => {
  if (unitCount <= 0 || !onToggle) {
    return <span className="w-5 flex-shrink-0" aria-hidden="true" />;
  }

  const Icon = isExpanded ? ChevronDown : ChevronRight;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(partId);
      }}
      className="flex-shrink-0 rounded p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-600 dark:hover:text-slate-200"
      aria-expanded={isExpanded}
      aria-label={isExpanded ? "Thu gọn danh sách máy" : "Xem từng máy"}
      title={`${unitCount} máy có IMEI`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
};

export interface PartUnitsBadgeProps {
  partId: string;
  unitCount: number;
  /** Tồn kho theo `parts.stock`; khác `unitCount` là có lệch, phải cảnh báo. */
  expectedStock: number;
  isExpanded: boolean;
  onToggle?: (id: string) => void;
  /** `card` có nền + mũi bung riêng vì thẻ mobile không có cột tên để gắn mũi. */
  variant?: "table" | "card";
}

/**
 * Nhãn "n máy 📱" — vừa là chỉ báo có chi tiết IMEI, vừa là nút bung.
 *
 * Khi số máy khác tồn kho thì đổi sang màu cảnh báo ngay tại dòng: một trong hai
 * con số đang sai, và người dùng cần biết trước khi đem số đó đi bán.
 */
export const PartUnitsBadge: React.FC<PartUnitsBadgeProps> = ({
  partId,
  unitCount,
  expectedStock,
  isExpanded,
  onToggle,
  variant = "table",
}) => {
  if (unitCount <= 0 || !onToggle) return null;

  const mismatch = unitCount !== expectedStock;
  const isCard = variant === "card";

  const cardClass = mismatch
    ? "border-amber-600/50 bg-amber-900/30 text-amber-300"
    : "border-blue-700/50 bg-blue-900/30 text-blue-300";
  const tableClass = mismatch
    ? "text-amber-600 dark:text-amber-400"
    : "text-blue-600 dark:text-blue-400";

  const Icon = isExpanded ? ChevronDown : ChevronRight;

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onToggle(partId);
      }}
      aria-expanded={isExpanded}
      className={
        isCard
          ? `flex items-center gap-1 rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${cardClass}`
          : `text-[10px] font-medium hover:underline ${tableClass}`
      }
      title={
        mismatch
          ? `Lệch: tồn ${expectedStock} nhưng có ${unitCount} máy`
          : "Xem IMEI từng máy"
      }
    >
      {isCard && <Icon className="h-3.5 w-3.5" />}
      {mismatch && "⚠️ "}
      {unitCount} máy 📱
    </button>
  );
};
