import React from "react";
import type { Part, WorkOrderPart } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { getCategoryColor } from "../../../utils/categoryColors";
import { NumberInput } from "../../common/NumberInput";
import { showToast } from "../../../utils/toast";

interface WorkOrderPartsSectionProps {
  canEditPriceAndParts: boolean;
  showPartSearch: boolean;
  setShowPartSearch: (show: boolean) => void;
  searchPart: string;
  setSearchPart: (search: string) => void;
  partsLoading: boolean;
  filteredParts: Part[];
  currentBranchId: string;
  selectedParts: WorkOrderPart[];
  setSelectedParts: React.Dispatch<React.SetStateAction<WorkOrderPart[]>>;
  getPartLaborBase: (partId: string) => number;
  getIntegratedLaborByQuantity: (laborBase: number, quantity: number) => number;
  getPartWarranty: (partId: string) => string;
  handleAddPart: (part: Part) => void;
}

export const WorkOrderPartsSection: React.FC<WorkOrderPartsSectionProps> = ({
  canEditPriceAndParts,
  showPartSearch,
  setShowPartSearch,
  searchPart,
  setSearchPart,
  partsLoading,
  filteredParts,
  currentBranchId,
  selectedParts,
  setSelectedParts,
  getPartLaborBase,
  getIntegratedLaborByQuantity,
  getPartWarranty,
  handleAddPart,
}) => {
  return (
    <div className="space-y-3 col-start-1">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">3</span>
          Linh kiện sử dụng
        </h3>
        <button
          onClick={() => setShowPartSearch(!showPartSearch)}
          disabled={!canEditPriceAndParts}
          className={`px-3 py-1.5 text-white rounded text-sm flex items-center gap-1 ${
            canEditPriceAndParts
              ? "bg-blue-500 hover:bg-blue-600"
              : "bg-slate-400 dark:bg-slate-600 cursor-not-allowed opacity-50"
          }`}
          title={
            canEditPriceAndParts
              ? "Thêm linh kiện"
              : "Không thể thêm linh kiện cho phiếu đã thanh toán"
          }
        >
          + Thêm linh kiện
        </button>
      </div>

      {showPartSearch && (
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm phụ tùng theo tên hoặc SKU..."
            value={searchPart}
            onChange={(e) => setSearchPart(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
            autoFocus
          />
          <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto z-10">
            {partsLoading ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                Đang tải phụ tùng...
              </div>
            ) : filteredParts.length === 0 ? (
              <div className="px-4 py-3 text-sm text-slate-500">
                Không tìm thấy phụ tùng
              </div>
            ) : (
              <>
                {filteredParts.slice(0, 50).map((part) => {
                  const stock = part.stock?.[currentBranchId] || 0;
                  const warrantyText = getPartWarranty(part.id);
                  const partLaborCost =
                    (part as any)?.laborCost?.[currentBranchId] ||
                    part.wholesalePrice?.[currentBranchId] ||
                    0;
                  return (
                    <button
                      key={part.id}
                      onClick={() => {
                        if (stock <= 0) {
                          showToast.error("Sản phẩm đã hết hàng!");
                          return;
                        }
                        handleAddPart(part);
                      }}
                      className="w-full px-4 py-2.5 text-left hover:bg-slate-100 dark:hover:bg-slate-600 flex items-center justify-between border-b border-slate-100 dark:border-slate-600 last:border-b-0"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                          {part.name}
                        </div>
                        <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
                          Công: {formatCurrency(partLaborCost)}
                        </div>
                        {warrantyText && (
                          <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium mt-0.5">
                            Bảo hành: {warrantyText}
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                            {part.sku}
                          </span>
                          <span className="text-[10px] text-orange-600 dark:text-orange-400 font-medium">
                            Tồn: {stock}
                          </span>
                          {part.category && (
                            <span
                              className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${
                                getCategoryColor(part.category).bg
                              } ${getCategoryColor(part.category).text}`}
                            >
                              {part.category}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(part.retailPrice[currentBranchId] || 0)}
                      </div>
                    </button>
                  );
                })}
                {filteredParts.length > 50 && (
                  <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800 text-center text-xs text-slate-500 italic border-t border-slate-100 dark:border-slate-600">
                    Đang hiển thị 50/{filteredParts.length} kết quả. Vui lòng tìm kiếm chi tiết hơn.
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                Tên
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                SL
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                Đ.Giá
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                T.Tiền
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200 dark:divide-slate-600">
            {selectedParts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-center text-sm text-slate-400">
                  Chưa có linh kiện nào
                </td>
              </tr>
            ) : (
              selectedParts.map((part, idx) => {
                const laborPerUnit = getPartLaborBase(part.partId);
                const integratedLaborLine = getIntegratedLaborByQuantity(
                  laborPerUnit,
                  Number(part.quantity || 0)
                );
                const warrantyText = getPartWarranty(part.partId);

                return (
                  <tr key={idx} className="bg-white dark:bg-slate-800">
                    <td className="px-4 py-2">
                      <div className="text-sm text-slate-900 dark:text-slate-100 font-medium">
                        {part.partName}
                      </div>
                      <div className="text-[10px] text-cyan-600 dark:text-cyan-400 font-medium mt-0.5">
                        Công: {formatCurrency(laborPerUnit)} / SP
                      </div>
                      <div className="text-[10px] text-cyan-500 dark:text-cyan-300 mt-0.5">
                        Công theo SL: {formatCurrency(integratedLaborLine)}
                      </div>
                      {warrantyText && (
                        <div className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-0.5 font-medium">
                          Bảo hành: {warrantyText}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {part.sku && (
                          <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono">
                            {part.sku}
                          </span>
                        )}
                        {part.category && (
                          <span
                            className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${
                              getCategoryColor(part.category).bg
                            } ${getCategoryColor(part.category).text}`}
                          >
                            {part.category}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-center">
                      <input
                        type="number"
                        min="1"
                        value={part.quantity}
                        disabled={!canEditPriceAndParts}
                        onChange={(e) => {
                          const newQty = Number(e.target.value);
                          setSelectedParts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, quantity: newQty } : p))
                          );
                        }}
                        className={`w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 ${
                          !canEditPriceAndParts ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right">
                      <NumberInput
                        placeholder="Đơn giá"
                        value={part.price || ""}
                        onChange={(val) => {
                          setSelectedParts((prev) =>
                            prev.map((p, i) => (i === idx ? { ...p, price: val } : p))
                          );
                        }}
                        disabled={!canEditPriceAndParts}
                        className={`w-28 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm ${
                          !canEditPriceAndParts ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      />
                    </td>
                    <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                      {formatCurrency(part.price * part.quantity)}
                    </td>
                    <td className="px-4 py-2 text-center">
                      <button
                        onClick={() =>
                          setSelectedParts((prev) => prev.filter((_, i) => i !== idx))
                        }
                        disabled={!canEditPriceAndParts}
                        className={`${
                          canEditPriceAndParts
                            ? "text-red-500 hover:text-red-700"
                            : "text-slate-400 cursor-not-allowed"
                        }`}
                        aria-label="Xóa linh kiện"
                        title={
                          canEditPriceAndParts
                            ? "Xóa linh kiện"
                            : "Không thể xóa linh kiện cho phiếu đã thanh toán"
                        }
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          className="w-4 h-4"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                          />
                        </svg>
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
