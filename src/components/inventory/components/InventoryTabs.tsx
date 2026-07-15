import React from "react";
import { Boxes, Package, FileText } from "lucide-react";

export interface InventoryTabsProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  canViewInventoryHistory: boolean;
}

/** Thanh tab (desktop) của trang Quản lý kho. */
const InventoryTabs: React.FC<InventoryTabsProps> = ({
  activeTab,
  onTabChange,
  canViewInventoryHistory,
}) => {
  const tabs = [
    { key: "stock", label: "Tồn kho", icon: <Boxes className="w-3.5 h-3.5" /> },
    { key: "categories", label: "Danh mục", icon: <Package className="w-3.5 h-3.5" /> },
    { key: "purchase-orders", label: "Đơn đặt hàng", icon: <Package className="w-3.5 h-3.5" /> },
    { key: "history", label: "Lịch sử", icon: <FileText className="w-3.5 h-3.5" /> },
  ].filter((tab) => (tab.key === "history" ? canViewInventoryHistory : true));

  return (
    <div className="flex gap-1">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${activeTab === tab.key
            ? "bg-blue-600 text-white"
            : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:bg-slate-700"
            }`}
        >
          <span className="inline-flex items-center gap-1">
            {tab.icon}
            {tab.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default InventoryTabs;
