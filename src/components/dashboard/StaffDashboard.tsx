import React from "react";
import { Link } from "react-router-dom";
import {
  Wrench,
  ShoppingCart,
  Users,
  FileText,
  List,
  Search,
  History,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { canDo } from "../../utils/permissions";

interface QuickAccessCardProps {
  to: string;
  icon: React.ReactNode;
  label: string;
  description: string;
  color: "blue" | "violet" | "emerald" | "amber" | "slate" | "indigo";
}

const QuickAccessCard: React.FC<QuickAccessCardProps> = ({
  to,
  icon,
  label,
  description,
  color,
}) => {
  const colorClasses = {
    blue: "from-blue-500 to-blue-600",
    violet: "from-violet-500 to-violet-600",
    emerald: "from-emerald-500 to-emerald-600",
    amber: "from-amber-500 to-amber-600",
    slate: "from-slate-500 to-slate-600",
    indigo: "from-indigo-500 to-indigo-600",
  };

  return (
    <Link
      to={to}
      className="block bg-white dark:bg-slate-800 rounded-2xl p-5 shadow-sm border border-slate-200 dark:border-slate-700 hover:shadow-md active:scale-[0.98] transition-all"
    >
      <div className="flex items-start gap-4">
        <div
          className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colorClasses[color]} flex items-center justify-center text-white flex-shrink-0`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white text-base mb-1">
            {label}
          </h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
};

export const StaffDashboard: React.FC = () => {
  const { profile } = useAuth();
  const canViewReports = canDo(profile, "reports.view");

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 md:p-6">
      <div className="max-w-4xl mx-auto space-y-4 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-violet-600 dark:from-blue-700 dark:to-violet-800 rounded-2xl p-6 text-white shadow-lg">
          <h1 className="text-2xl md:text-3xl font-bold mb-2">
            Chào mừng bạn! 👋
          </h1>
          <p className="text-blue-100 dark:text-blue-200">
            Chọn chức năng bạn muốn sử dụng
          </p>
        </div>

        {/* Main Functions */}
        <div className="space-y-3 px-4 md:px-0">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
            Chức năng chính
          </h2>

          <QuickAccessCard
            to="/service"
            icon={<Wrench className="w-6 h-6" />}
            label="Phiếu sửa chữa"
            description="Quản lý phiếu sửa chữa, tiếp nhận máy, theo dõi tiến độ"
            color="violet"
          />

          <QuickAccessCard
            to="/sales"
            icon={<ShoppingCart className="w-6 h-6" />}
            label="Bán hàng"
            description="Tạo hóa đơn bán lẻ, bán buôn, quản lý đơn hàng"
            color="blue"
          />

          <QuickAccessCard
            to="/customers"
            icon={<Users className="w-6 h-6" />}
            label="Khách hàng"
            description="Tra cứu thông tin khách hàng, lịch sử mua hàng"
            color="emerald"
          />

          <QuickAccessCard
            to="/service-history"
            icon={<History className="w-6 h-6" />}
            label="Lịch sử sửa chữa"
            description="Xem lịch sử sửa chữa thiết bị khách hàng"
            color="amber"
          />
        </div>

        {/* Utility Functions */}
        <div className="space-y-3 px-4 md:px-0 pb-24 md:pb-6">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider px-2">
            Tiện ích
          </h2>

          <QuickAccessCard
            to="/lookup"
            icon={<Search className="w-6 h-6" />}
            label="Tra cứu sản phẩm"
            description="Tìm kiếm thông tin sản phẩm, phụ tùng"
            color="slate"
          />

          <QuickAccessCard
            to="/categories"
            icon={<List className="w-6 h-6" />}
            label="Danh mục"
            description="Xem danh mục sản phẩm, dịch vụ"
            color="slate"
          />

          {canViewReports && (
            <QuickAccessCard
              to="/reports"
              icon={<FileText className="w-6 h-6" />}
              label="Báo cáo"
              description="Xem báo cáo cơ bản"
              color="indigo"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
