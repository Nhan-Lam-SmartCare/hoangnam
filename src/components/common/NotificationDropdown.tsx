import React, { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  Package,
  Wrench,
  AlertTriangle,
  X,
  ChevronRight,
  Check,
  CheckCheck,
  Trash2,
  ShoppingCart,
  Banknote,
} from "lucide-react";
import { usePartsRepo } from "../../hooks/usePartsRepository";
import { useWorkOrders } from "../../hooks/useSupabase";
import { useAppContext } from "../../contexts/AppContext";
import { useNotifications } from "../../hooks/useNotifications";

interface Alert {
  id: string;
  type: "low-stock" | "work-order";
  title: string;
  message: string;
  link: string;
  icon: React.ReactNode;
  color: string;
}

// Icon for notification types
const NotificationIcon: React.FC<{ type: string; className?: string }> = ({
  type,
  className = "w-4 h-4",
}) => {
  switch (type) {
    case "work_order":
      return <Wrench className={`${className} text-blue-500`} />;
    case "sale":
      return <ShoppingCart className={`${className} text-green-500`} />;
    case "inventory":
      return <Package className={`${className} text-purple-500`} />;
    case "inventory_warning":
      return <AlertTriangle className={`${className} text-amber-500`} />;
    default:
      return <Bell className={`${className} text-slate-500`} />;
  }
};

// Time ago helper
function timeAgo(dateString: string): string {
  const now = new Date();
  const date = new Date(dateString);
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return "Vừa xong";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} phút trước`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} giờ trước`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ngày trước`;

  return date.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit" });
}

const NotificationDropdown: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"notifications" | "alerts">(
    "notifications"
  );
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { currentBranchId } = useAppContext();

  // Fetch notifications from database
  const {
    notifications,
    unreadCount,
    isLoading: notificationsLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
  } = useNotifications();

  // Fetch data for alerts
  const { data: parts = [] } = usePartsRepo();
  const { data: workOrders = [] } = useWorkOrders();

  // Calculate alerts
  const alerts: Alert[] = [];

  // 1. Low stock alerts
  const lowStockParts = parts.filter(
    (p) =>
      (p.stock[currentBranchId] || 0) < 10 &&
      (p.stock[currentBranchId] || 0) > 0
  );
  const outOfStockParts = parts.filter(
    (p) => (p.stock[currentBranchId] || 0) === 0
  );

  if (outOfStockParts.length > 0) {
    alerts.push({
      id: "out-of-stock",
      type: "low-stock",
      title: "Hết hàng",
      message: `${outOfStockParts.length} sản phẩm đã hết hàng`,
      link: "/inventory?stock=out-of-stock",
      icon: <Package className="w-5 h-5" />,
      color: "text-red-500 bg-red-50 dark:bg-red-900/20",
    });
  }

  if (lowStockParts.length > 0) {
    alerts.push({
      id: "low-stock",
      type: "low-stock",
      title: "Sắp hết hàng",
      message: `${lowStockParts.length} sản phẩm cần nhập thêm`,
      link: "/inventory?stock=low-stock",
      icon: <Package className="w-5 h-5" />,
      color: "text-orange-500 bg-orange-50 dark:bg-orange-900/20",
    });
  }

  // 4. Pending work orders
  const pendingWorkOrders = (workOrders || []).filter(
    (wo) => wo.status === "Tiếp nhận" || wo.status === "Đang sửa"
  );

  if (pendingWorkOrders.length > 0) {
    alerts.push({
      id: "work-orders",
      type: "work-order",
      title: "Phiếu chờ xử lý",
      message: `${pendingWorkOrders.length} xe đang chờ sửa chữa`,
      link: "/service?status=pending",
      icon: <Wrench className="w-5 h-5" />,
      color: "text-blue-500 bg-blue-50 dark:bg-blue-900/20",
    });
  }

  const alertCount = alerts.length;
  const totalCount = unreadCount + alertCount;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        aria-label="Thông báo"
      >
        <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
        {totalCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full animate-pulse">
            {totalCount > 99 ? "99+" : totalCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white dark:bg-slate-800 rounded-xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden z-50">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  Thông báo
                </h3>
              </div>
              <div className="flex items-center gap-1">
                {activeTab === "notifications" && unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Đọc tất cả"
                  >
                    <CheckCheck className="w-4 h-4 text-slate-500" />
                  </button>
                )}
                {activeTab === "notifications" && notifications.length > 0 && (
                  <button
                    onClick={() => {
                      if (confirm("Xóa tất cả thông báo?")) clearAll();
                    }}
                    className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    title="Xóa tất cả"
                  >
                    <Trash2 className="w-4 h-4 text-slate-500" />
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
                >
                  <X className="w-4 h-4 text-slate-400" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-lg p-1">
              <button
                onClick={() => setActiveTab("notifications")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === "notifications"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                Hoạt động
                {unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-red-500 text-white rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab("alerts")}
                className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${activeTab === "alerts"
                  ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
              >
                Cảnh báo
                {alertCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                    {alertCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="max-h-[60vh] overflow-y-auto">
            {activeTab === "notifications" ? (
              /* Notifications Tab */
              notificationsLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600" />
                </div>
              ) : notifications.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                    <Bell className="w-6 h-6 text-slate-400" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Chưa có hoạt động nào
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Thông báo sẽ hiển thị khi có hoạt động mới
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`group relative px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!notification.is_read
                        ? "bg-blue-50/50 dark:bg-blue-900/10"
                        : ""
                        }`}
                    >
                      <div className="flex gap-3">
                        {/* Icon */}
                        <div
                          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${!notification.is_read
                            ? "bg-blue-100 dark:bg-blue-900/30"
                            : "bg-slate-100 dark:bg-slate-700"
                            }`}
                        >
                          <NotificationIcon type={notification.type} />
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <p
                            className={`text-sm ${!notification.is_read
                              ? "font-semibold text-slate-900 dark:text-white"
                              : "font-medium text-slate-700 dark:text-slate-300"
                              }`}
                          >
                            {notification.title}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                            {notification.message}
                          </p>
                          <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-1">
                            {timeAgo(notification.created_at)}
                          </p>
                        </div>

                        {/* Unread indicator */}
                        {!notification.is_read && (
                          <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2" />
                        )}
                      </div>

                      {/* Action buttons - show on hover */}
                      <div className="absolute right-2 top-2 hidden group-hover:flex gap-1">
                        {!notification.is_read && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead(notification.id);
                            }}
                            className="p-1.5 rounded-full bg-white dark:bg-slate-600 shadow-sm hover:bg-slate-100 dark:hover:bg-slate-500 transition-colors"
                            title="Đánh dấu đã đọc"
                          >
                            <Check className="w-3 h-3 text-slate-600 dark:text-slate-300" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteNotification(notification.id);
                          }}
                          className="p-1.5 rounded-full bg-white dark:bg-slate-600 shadow-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                          title="Xóa"
                        >
                          <X className="w-3 h-3 text-slate-600 dark:text-red-400" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )
            ) : /* Alerts Tab */
              alerts.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                    <Check className="w-6 h-6 text-green-500" />
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Không có cảnh báo
                  </p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                    Mọi thứ đang ổn! 👍
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                  {alerts.map((alert) => (
                    <Link
                      key={alert.id}
                      to={alert.link}
                      onClick={() => setIsOpen(false)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors group"
                    >
                      <div
                        className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${alert.color}`}
                      >
                        {alert.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {alert.title}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 truncate">
                          {alert.message}
                        </p>
                      </div>
                      <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300 transition flex-shrink-0 mt-1" />
                    </Link>
                  ))}
                </div>
              )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
            <p className="text-[10px] text-slate-400 dark:text-slate-500 text-center">
              {activeTab === "notifications"
                ? `${notifications.length} thông báo gần nhất`
                : "Nhấn vào cảnh báo để xem chi tiết"}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
