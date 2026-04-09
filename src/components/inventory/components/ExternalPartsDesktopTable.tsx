import React from 'react';
import { ExternalLink, Plus } from 'lucide-react';
import { ExternalPart } from '../../../types';
import { formatCurrency } from '../../../utils/format';

type ExternalPartsDesktopTableProps = {
  loading: boolean;
  parts: ExternalPart[];
  page: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
  onAddToInventory: (part: ExternalPart) => void;
};

export function ExternalPartsDesktopTable({
  loading,
  parts,
  page,
  totalPages,
  onPrevPage,
  onNextPage,
  onAddToInventory,
}: ExternalPartsDesktopTableProps) {
  return (
    <div className="hidden sm:block bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm flex-1 flex flex-col overflow-hidden">
      <div className="overflow-auto flex-1">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
            <tr>
              <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Hình ảnh</th>
              <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Mã SKU</th>
              <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Tên phụ tùng</th>
              <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700">Giá tham khảo</th>
              <th className="px-6 py-3 text-xs font-medium text-slate-500 dark:text-slate-400 uppercase border-b border-slate-200 dark:border-slate-700 text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  Đang tải dữ liệu...
                </td>
              </tr>
            ) : parts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-slate-500 dark:text-slate-400">
                  Không tìm thấy phụ tùng nào.
                </td>
              </tr>
            ) : (
              parts.map((part) => (
                <tr key={part.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 group">
                  <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    {part.image_url ? (
                      <img
                        src={part.image_url}
                        alt={part.name}
                        className="w-12 h-12 object-cover rounded border border-slate-200 dark:border-slate-600"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-700 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center text-slate-400 text-xs">
                        No img
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-mono text-sm text-slate-600 dark:text-slate-300">
                    {part.sku || '---'}
                  </td>
                  <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700">
                    <div className="font-medium text-slate-900 dark:text-slate-100">{part.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{part.category}</div>
                  </td>
                  <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 font-medium text-blue-600 dark:text-blue-400">
                    {formatCurrency(part.price)}
                  </td>
                  <td className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {part.source_url && (
                        <a
                          href={part.source_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg transition-colors"
                          title="Xem nguồn"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      )}
                      <button
                        onClick={() => onAddToInventory(part)}
                        className="p-2 text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                        title="Thêm vào kho"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
        <div className="text-sm text-slate-500 dark:text-slate-400">
          Trang {page} / {totalPages}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onPrevPage}
            disabled={page === 1}
            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Trước
          </button>
          <button
            onClick={onNextPage}
            disabled={page === totalPages}
            className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-50 hover:bg-slate-50 dark:hover:bg-slate-700"
          >
            Sau
          </button>
        </div>
      </div>
    </div>
  );
}
