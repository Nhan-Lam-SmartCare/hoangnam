import React from "react";
import { Boxes, FileText } from "lucide-react";

export interface InventoryBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  canViewInventoryHistory: boolean;
}

/** Thanh điều hướng dưới cùng (mobile) của trang Quản lý kho. */
const InventoryBottomNav: React.FC<InventoryBottomNavProps> = ({
  activeTab,
  onTabChange,
  canViewInventoryHistory,
}) => {
  return (
    <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-50 safe-area-bottom">
      {/* Backdrop blur effect */}
      <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg -z-10"></div>
      <div className={`grid ${canViewInventoryHistory ? "grid-cols-3" : "grid-cols-2"} gap-1 px-2 py-2`}>
        <button
          onClick={() => onTabChange("stock")}
          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${activeTab === "stock"
            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-400 scale-105"
            : "text-slate-500 dark:text-slate-400 active:scale-95"
            }`}
        >
          <Boxes
            className={`w-5 h-5 ${activeTab === "stock" ? "scale-110" : ""
              } transition-transform`}
          />
          <span
            className={`text-[10px] font-medium ${activeTab === "stock" ? "font-semibold" : ""
              }`}
          >
            Tồn kho
          </span>
        </button>
        <button
          onClick={() => onTabChange("purchase-orders")}
          className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${activeTab === "purchase-orders"
            ? "bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400 scale-105"
            : "text-slate-500 dark:text-slate-400 active:scale-95"
            }`}
        >
          <svg
            className={`w-5 h-5 ${activeTab === "purchase-orders" ? "scale-110" : ""
              } transition-transform`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <span
            className={`text-[10px] font-medium ${activeTab === "purchase-orders" ? "font-semibold" : ""
              }`}
          >
            Đặt hàng
          </span>
        </button>
        {canViewInventoryHistory && (
          <button
            onClick={() => onTabChange("history")}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-xl transition-all duration-200 ${activeTab === "history"
              ? "bg-green-100 dark:bg-green-900/40 text-green-600 dark:text-green-400 scale-105"
              : "text-slate-500 dark:text-slate-400 active:scale-95"
              }`}
          >
            <FileText
              className={`w-5 h-5 ${activeTab === "history" ? "scale-110" : ""
                } transition-transform`}
            />
            <span
              className={`text-[10px] font-medium ${activeTab === "history" ? "font-semibold" : ""
                }`}
            >
              Lịch sử
            </span>
          </button>
        )}
      </div>
    </div>
  );
};

export default InventoryBottomNav;
