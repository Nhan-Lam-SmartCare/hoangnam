import React from "react";
import { Smartphone } from "lucide-react";
import { formatDate } from "../../../utils/format";
import { useSearchUnitsByImei } from "../../../hooks/usePartUnitsRepository";

export interface ImeiSearchResultsProps {
  /** Từ khoá đã debounce của ô tìm kiếm kho. */
  keyword: string;
  branchId: string;
}

const STATUS_TEXT: Record<string, string> = {
  in_stock: "Còn kho",
  reserved: "Đang giữ",
  sold: "Đã bán",
  returned: "Đã trả",
  warranty: "Bảo hành",
  lost: "Thất lạc",
};

/**
 * Kết quả tra IMEI, hiện phía trên bảng tồn kho.
 *
 * Cố ý tách khỏi bảng chính thay vì trộn vào kết quả lọc: bảng liệt kê SẢN PHẨM,
 * còn đây là MÁY cụ thể — gộp chung sẽ khiến "tồn 2" và "1 kết quả" mâu thuẫn
 * ngay trên cùng một màn hình. Máy đã bán vẫn hiện, vì tra IMEI thường là lúc
 * khách mang máy quay lại bảo hành.
 */
const ImeiSearchResults: React.FC<ImeiSearchResultsProps> = ({
  keyword,
  branchId,
}) => {
  const q = (keyword || "").trim();
  const { data: units = [], isLoading } = useSearchUnitsByImei(q, branchId);

  // Dưới 3 ký tự hook không chạy; không có kết quả thì im lặng nhường chỗ cho bảng.
  if (q.length < 3 || isLoading || units.length === 0) return null;

  return (
    <div className="mx-3 mt-3 rounded-xl border border-blue-200 bg-blue-50/60 dark:border-blue-800 dark:bg-blue-950/30">
      <div className="flex items-center gap-2 border-b border-blue-200 px-3 py-2 dark:border-blue-800">
        <Smartphone className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <span className="text-xs font-semibold text-blue-800 dark:text-blue-300">
          Tìm thấy {units.length} máy khớp IMEI “{q}”
        </span>
      </div>
      <ul className="divide-y divide-blue-100 dark:divide-blue-900">
        {units.map((unit) => (
          <li
            key={unit.id}
            className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-xs"
          >
            <span className="font-mono font-bold text-slate-900 dark:text-slate-100">
              {unit.imei}
            </span>
            <span className="text-slate-700 dark:text-slate-200">
              {unit.partName}
            </span>
            {unit.color && (
              <span className="text-purple-600 dark:text-purple-300">
                🎨 {unit.color}
              </span>
            )}
            <span
              className={`rounded-full px-1.5 py-0 text-[10px] font-semibold ${
                unit.status === "in_stock"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300"
                  : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
              }`}
            >
              {STATUS_TEXT[unit.status] || unit.status}
            </span>
            {unit.receiptCode && (
              <span className="font-mono text-[10px] text-slate-400">
                {unit.receiptCode}
              </span>
            )}
            <span className="ml-auto text-[10px] text-slate-400">
              {unit.status === "sold" && unit.soldAt
                ? `Bán ${formatDate(unit.soldAt)}`
                : `Nhập ${formatDate(unit.receivedAt)}`}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ImeiSearchResults;
