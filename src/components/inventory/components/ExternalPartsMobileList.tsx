import React from 'react';
import { ExternalPart } from '../../../types';
import { formatCurrency } from '../../../utils/format';

type ExternalPartsMobileListProps = {
  loading: boolean;
  parts: ExternalPart[];
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
};

export function ExternalPartsMobileList({
  loading,
  parts,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
}: ExternalPartsMobileListProps) {
  return (
    <div className="sm:hidden flex-1 flex flex-col">
      <div className="flex-1 overflow-auto space-y-3 pb-20">
        {loading ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Đang tải dữ liệu...
          </div>
        ) : parts.length === 0 ? (
          <div className="text-center py-12 text-slate-500 dark:text-slate-400">
            Không tìm thấy phụ tùng nào.
          </div>
        ) : (
          parts.map((part) => (
            <div
              key={part.id}
              className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border border-slate-100 dark:border-slate-700"
            >
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  {part.image_url ? (
                    <img
                      src={part.image_url}
                      alt={part.name}
                      className="w-16 h-16 object-cover rounded-xl border-2 border-slate-100 dark:border-slate-700"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-700 rounded-xl border-2 border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs">
                      No img
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight mb-1">
                    {part.name}
                  </div>
                  <div className="text-xs text-slate-400 dark:text-slate-500 mb-2">
                    {part.category}
                  </div>
                  {part.sku && (
                    <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-700 px-2 py-0.5 rounded inline-block mb-2">
                      {part.sku}
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <div className="text-lg font-black text-blue-600 dark:text-blue-400">
                      {formatCurrency(part.price)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white/90 dark:bg-slate-800/90 backdrop-blur-lg border-t border-slate-200 dark:border-slate-700 px-4 py-3 flex items-center justify-between z-10">
        <div className="text-xs text-slate-600 dark:text-slate-300 font-medium">
          Trang {page}/{totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrevPage}
            disabled={page === 1}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 disabled:opacity-40 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
          >
            ←
          </button>
          <button
            onClick={onNextPage}
            disabled={page === totalPages}
            className="px-4 py-2 bg-slate-100 dark:bg-slate-700 disabled:opacity-40 rounded-lg text-sm font-medium text-slate-700 dark:text-slate-200 active:scale-95 transition-transform"
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
