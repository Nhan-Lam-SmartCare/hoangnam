import React from "react";
import { MoreHorizontal, Edit, Trash2 } from "lucide-react";
import type { Part } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { getCategoryColor } from "../../../utils/categoryColors";
import { getPartWarrantyText } from "../../../utils/partWarranty";

export interface StockMobileCardProps {
  part: Part;
  index: number;
  branchId: string;
  lowStockThreshold: number;
  isDuplicate: boolean;
  isMenuOpen: boolean;
  canUpdatePart: boolean;
  canDeletePart: boolean;
  hideLaborCost?: boolean;
  onToggleMenu: (index: number) => void;
  onEdit: (part: Part) => void;
  onQuickWarranty: (part: Part) => void;
  onDelete: (id: string) => void;
}

/**
 * Thẻ tồn kho (mobile). Giữ NGUYÊN hành vi bản gốc: hiển thị TỒN THÔ (stock),
 * menu 3 chấm theo index. Không giữ state; phát callback ra ngoài.
 */
const StockMobileCard: React.FC<StockMobileCardProps> = ({
  part,
  index,
  branchId,
  lowStockThreshold,
  isDuplicate,
  isMenuOpen,
  canUpdatePart,
  canDeletePart,
  hideLaborCost = false,
  onToggleMenu,
  onEdit,
  onQuickWarranty,
  onDelete,
}) => {
  const hasPartActions = canUpdatePart || canDeletePart;
  const stock = part.stock[branchId] || 0;
  const retailPrice = part.retailPrice[branchId] || 0;
  const laborCost = Number((part as any).laborCost?.[branchId] || 0);

  return (
    <div
      className={`p-3 rounded-xl bg-[#2d3748] border border-slate-600 transition ${isDuplicate ? "border-l-4 border-l-orange-500" : ""
        }`}
      role="listitem"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {/* Tên sản phẩm: hiển thị đầy đủ */}
            <div className="text-[15px] font-medium text-white leading-tight">
              {part.name}
            </div>
            <div className="text-[11px] text-blue-400 mt-1 truncate font-mono">
              SKU: {part.sku}
            </div>
            {part.description && (
              <div
                className="text-[11px] text-slate-300/90 mt-1 line-clamp-2"
                title={part.description}
              >
                {part.description}
              </div>
            )}
            {/* Danh mục với màu sắc */}
            {part.category && (
              <span
                className={`inline-flex items-center px-2 py-0.5 mt-1.5 rounded-full text-[10px] font-medium ${getCategoryColor(part.category).bg
                  } ${getCategoryColor(part.category).text}`}
              >
                {part.category}
              </span>
            )}
            {getPartWarrantyText(part) && (
              <div className="mt-1 text-[10px] font-semibold text-indigo-300">
                Bảo hành: {getPartWarrantyText(part)}
              </div>
            )}
          </div>
          <div className="text-right flex-shrink-0">
            {/* Hiển thị giá bán */}
            <div className="text-[13px] text-emerald-400 font-semibold">
              {formatCurrency(retailPrice)}
            </div>
            {!hideLaborCost && (
              <div className="text-[11px] text-cyan-400 mt-1 font-medium">
                Công: {formatCurrency(laborCost)}
              </div>
            )}
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between">
          {/* Badge số lượng tồn kho */}
          <span
            className={`inline-flex items-center gap-1 px-2.5 py-1 text-sm font-bold rounded-lg ${stock === 0
              ? "text-red-300 bg-red-900/40 border border-red-700/50"
              : stock < lowStockThreshold
                ? "text-yellow-300 bg-yellow-900/40 border border-yellow-700/50"
                : "text-emerald-300 bg-emerald-900/40 border border-emerald-700/50"
              }`}
          >
            <span className="text-xs opacity-80">SL:</span>
            {stock}
          </span>
          {hasPartActions && (
            <div className="relative">
              {/* Tăng vùng tap cho menu 3 chấm */}
              <button
                onClick={() => onToggleMenu(index)}
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
                aria-label="Thêm hành động"
                className="p-2.5 -m-1 text-slate-400 hover:bg-slate-600 rounded-lg transition active:bg-slate-500"
              >
                <MoreHorizontal className="w-5 h-5" />
              </button>

              {isMenuOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-40 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-[9999]">
                  {canUpdatePart && (
                    <button
                      onClick={() => onEdit(part)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 flex items-center gap-2 text-white"
                      aria-label={`Chỉnh sửa ${part.name}`}
                    >
                      <Edit className="w-4 h-4 text-blue-400" />
                      <span>Chỉnh sửa</span>
                    </button>
                  )}
                  {canUpdatePart && (
                    <button
                      onClick={() => onQuickWarranty(part)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 flex items-center gap-2 text-indigo-300"
                      aria-label={`Sửa bảo hành ${part.name}`}
                    >
                      <span className="w-4 h-4 inline-flex items-center justify-center">🛡</span>
                      <span>Sửa bảo hành</span>
                    </button>
                  )}
                  {canDeletePart && (
                    <button
                      onClick={() => onDelete(part.id)}
                      className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-700 flex items-center gap-2 text-red-400"
                      aria-label={`Xóa ${part.name}`}
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockMobileCard;
