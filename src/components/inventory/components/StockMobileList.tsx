import React from "react";
import type { Part } from "../../../types";
import StockMobileCard from "./StockMobileCard";

export interface StockMobileListProps {
  parts: Part[];
  branchId: string;
  lowStockThreshold: number;
  openMenuIndex: number | null;
  canUpdatePart: boolean;
  canDeletePart: boolean;
  hideLaborCost?: boolean;
  /** partId -> số máy có IMEI còn trong kho. */
  unitCounts?: Record<string, number>;
  expandedPartId?: string | null;
  onToggleExpand?: (id: string) => void;
  isDuplicateSku: (sku: string) => boolean;
  onToggleMenu: (index: number) => void;
  onEdit: (part: Part) => void;
  onQuickWarranty: (part: Part) => void;
  onDelete: (id: string) => void;
}

/** Danh sách thẻ tồn kho cho màn hình nhỏ (block sm:hidden). */
const StockMobileList: React.FC<StockMobileListProps> = ({
  parts,
  branchId,
  lowStockThreshold,
  openMenuIndex,
  canUpdatePart,
  canDeletePart,
  hideLaborCost = false,
  unitCounts = {},
  expandedPartId = null,
  onToggleExpand,
  isDuplicateSku,
  onToggleMenu,
  onEdit,
  onQuickWarranty,
  onDelete,
}) => {
  return (
    <div className="block sm:hidden">
      <div className="space-y-3 p-3">
        {parts.map((part, index) => (
          <StockMobileCard
            key={part.id}
            part={part}
            index={index}
            branchId={branchId}
            lowStockThreshold={lowStockThreshold}
            isDuplicate={isDuplicateSku(part.sku || "")}
            isMenuOpen={openMenuIndex === index}
            canUpdatePart={canUpdatePart}
            canDeletePart={canDeletePart}
            hideLaborCost={hideLaborCost}
            unitCount={unitCounts[part.id] || 0}
            isExpanded={expandedPartId === part.id}
            onToggleExpand={onToggleExpand}
            onToggleMenu={onToggleMenu}
            onEdit={onEdit}
            onQuickWarranty={onQuickWarranty}
            onDelete={onDelete}
          />
        ))}
      </div>
    </div>
  );
};

export default StockMobileList;
