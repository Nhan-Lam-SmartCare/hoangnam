import React from "react";

export interface StockTableHeaderProps {
  sortField: string | null;
  sortDirection: "asc" | "desc";
  onSort: (field: string) => void;
  canViewImportPrice: boolean;
  allSelected: boolean;
  hideLaborCost?: boolean;
  onSelectAll: (checked: boolean) => void;
}

/** Đầu bảng tồn kho (desktop) với các cột sắp xếp được + checkbox chọn tất cả. */
const StockTableHeader: React.FC<StockTableHeaderProps> = ({
  sortField,
  sortDirection,
  onSort,
  canViewImportPrice,
  allSelected,
  hideLaborCost = false,
  onSelectAll,
}) => {
  const arrow = (field: string) =>
    sortField === field ? (
      <span className="text-blue-500">{sortDirection === "asc" ? "↑" : "↓"}</span>
    ) : null;

  return (
    <thead className="bg-slate-100 dark:bg-slate-700/50">
      <tr className="border-b border-slate-200 dark:border-slate-600 text-[10px] font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">
        <th className="px-3 py-2.5 text-center w-10">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={(e) => onSelectAll(e.target.checked)}
            className="w-3.5 h-3.5 text-blue-600 rounded border-slate-300 dark:border-slate-600 focus:ring-blue-500"
          />
        </th>
        <th
          className="px-3 py-2.5 text-left cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none w-[280px]"
          onClick={() => onSort("name")}
        >
          <div className="flex items-center gap-1.5">
            <span>Sản phẩm</span>
            {arrow("name")}
          </div>
        </th>
        <th
          className="px-3 py-2.5 text-center cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none w-[100px]"
          onClick={() => onSort("stock")}
        >
          <div className="flex items-center justify-center gap-1.5">
            <span>Tồn kho</span>
            {arrow("stock")}
          </div>
        </th>
        {canViewImportPrice && (
          <th
            className="px-3 py-2.5 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none w-[110px]"
            onClick={() => onSort("costPrice")}
          >
            <div className="flex items-center justify-end gap-1.5">
              <span>Giá nhập</span>
              {arrow("costPrice")}
            </div>
          </th>
        )}
        <th
          className="px-3 py-2.5 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none w-[110px]"
          onClick={() => onSort("retailPrice")}
        >
          <div className="flex items-center justify-end gap-1.5">
            <span>Giá bán lẻ</span>
            {arrow("retailPrice")}
          </div>
        </th>
        {!hideLaborCost && (
          <th
            className="px-3 py-2.5 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none w-[110px]"
            onClick={() => onSort("laborCost")}
          >
            <div className="flex items-center justify-end gap-1.5">
              <span>Tiền công</span>
              {arrow("laborCost")}
            </div>
          </th>
        )}
        <th
          className="px-3 py-2.5 text-right cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors select-none w-[120px]"
          onClick={() => onSort("totalValue")}
        >
          <div className="flex items-center justify-end gap-1.5">
            <span>Giá trị tồn</span>
            {arrow("totalValue")}
          </div>
        </th>
        <th className="px-3 py-2.5 text-center w-14">Hành động</th>
      </tr>
    </thead>
  );
};

export default StockTableHeader;
