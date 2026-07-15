import React from "react";

export interface InventoryPaginationProps {
  page: number;
  totalPages: number;
  pageSize: number;
  /** Tổng số phụ tùng để hiển thị (đã tính client/server filter ở ngoài). */
  totalCount: number;
  isLoading: boolean;
  onPrev: () => void;
  onNext: () => void;
  onPageSizeChange: (size: number) => void;
}

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

/** Thanh phân trang + chọn số dòng/trang cho bảng tồn kho. */
const InventoryPagination: React.FC<InventoryPaginationProps> = ({
  page,
  totalPages,
  pageSize,
  totalCount,
  isLoading,
  onPrev,
  onNext,
  onPageSizeChange,
}) => {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
      <div className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 text-center sm:text-left">
        <span className="font-medium">
          Trang {page}/{totalPages}
        </span>
        <span className="mx-1">•</span>
        <span>{totalCount} phụ tùng</span>
      </div>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <button
          disabled={page === 1 || isLoading}
          onClick={onPrev}
          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-700/50 transition-colors"
        >
          ←
        </button>
        <span className="px-2 py-1 text-xs sm:text-sm font-medium text-slate-300 min-w-[2rem] text-center">
          {page}
        </span>
        <button
          disabled={page >= totalPages || isLoading}
          onClick={onNext}
          className="px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded disabled:opacity-40 hover:bg-slate-700/50 transition-colors"
        >
          →
        </button>
        <select
          value={pageSize}
          onChange={(e) => onPageSizeChange(Number(e.target.value) || 20)}
          className="px-1.5 sm:px-2 py-1.5 text-xs sm:text-sm border border-slate-300 dark:border-slate-600 rounded bg-slate-800 text-slate-200"
        >
          {PAGE_SIZE_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default InventoryPagination;
