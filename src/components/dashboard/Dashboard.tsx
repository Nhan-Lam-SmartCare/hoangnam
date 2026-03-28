import React, { useState, useCallback, useEffect } from "react";
import {
  DollarSign,
  TrendingUp,
  Wallet,
  Landmark,
  BarChart3,
  Package,
  Trash2,
  Trophy,
  Users,
  BriefcaseBusiness,
  Boxes,
  AlertTriangle,
  Wrench,
  ShoppingCart,
  FileText,
  Search,
  Settings,
  List,
  Eye,
  EyeOff,
  Bell,
  CheckCircle2,
  Car,
  Clock,
  XCircle,
  HandCoins,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

import { useAuth } from "../../contexts/AuthContext";
import { formatCurrency } from "../../utils/format";
import { loadDemoData, clearDemoData } from "../../utils/demoData";

// Components
import StatCard from "./components/StatCard";
import StatusItem from "./components/StatusItem";
import QuickActionCard from "./components/QuickActionCard";

// Hooks
import { useDashboardData } from "./hooks/useDashboardData";

const Dashboard: React.FC = () => {
  const { profile } = useAuth();
  const [reportFilter, setReportFilter] = useState<string>("month");
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedQuarter, setSelectedQuarter] = useState<number>(Math.ceil((new Date().getMonth() + 1) / 3));
  const [isLoading, setIsLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(false);
  const [showRevenue, setShowRevenue] = useState(false);

  // Load data using custom hook
  const {
    todayStats,
    filteredStats,
    last7DaysRevenue,
    incomeExpenseData,
    topProducts,
    workOrderStats,
    alerts,
    cashBalance,
    bankBalance,
    // @ts-ignore
    debugData,
  } = useDashboardData(reportFilter);

  // ... (existing code)

  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  const handleLoadDemo = useCallback(async () => {
    if (window.confirm("Bạn có chắc muốn nạp dữ liệu mẫu?")) {
      await loadDemoData();
      window.location.reload();
    }
  }, []);

  const handleClearDemo = useCallback(async () => {
    if (
      window.confirm(
        "CẢNH BÁO: Hành động này sẽ xóa toàn bộ dữ liệu! Bạn có chắc chắn?"
      )
    ) {
      await clearDemoData();
      window.location.reload();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-3 md:space-y-4">
      {/* Header - Lời chào người dùng - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-gradient-to-r from-red-600 to-yellow-500 rounded-2xl p-4 md:p-6 text-white shadow-lg">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h1 className="text-lg md:text-xl font-semibold mb-1">
              Xin chào,{" "}
              {profile?.name ||
                profile?.full_name ||
                profile?.email?.split("@")[0] ||
                "Người dùng"}{" "}
              👋
            </h1>
            <p className="text-sm md:text-base text-blue-100 dark:text-violet-100">
              {new Date().toLocaleDateString("vi-VN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </p>

            {/* Finance stats hidden */}
          </div>

          <Bell className="w-6 h-6 md:w-7 md:h-7 opacity-80 hover:opacity-100 cursor-pointer transition" />
        </div>
      </div>

      {/* Báo cáo nhanh hidden */}

      {/* Danh sách trạng thái phiếu sửa chữa - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-3">
          Trạng thái phiếu sửa chữa
        </h3>
        <div className="space-y-2">
          <StatusItem
            icon={<Package className="w-5 h-5" />}
            label="Biên nhận mới"
            count={workOrderStats.newOrders}
            color="blue"
          />
          <StatusItem
            icon={<CheckCircle2 className="w-5 h-5" />}
            label="Đã sửa xong"
            count={workOrderStats.completed}
            color="green"
          />
          <StatusItem
            icon={<Clock className="w-5 h-5" />}
            label="Đang sửa"
            count={workOrderStats.inProgress}
            color="amber"
          />
          <StatusItem
            icon={<Car className="w-5 h-5" />}
            label="Đã trả/giao xe"
            count={workOrderStats.delivered}
            color="slate"
          />
          <StatusItem
            icon={<XCircle className="w-5 h-5" />}
            label="Đã hủy"
            count={workOrderStats.cancelled}
            color="red"
          />
        </div>
      </div>

      {/* Quick Actions - Grid 4 cột với 12 tính năng - Chỉ hiện trên mobile */}
      <div className="md:hidden bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border border-slate-200 dark:border-slate-700">
        <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-4">
          Truy cập nhanh
        </h3>
        <div className="grid grid-cols-4 gap-3 md:gap-4">
          <QuickActionCard
            to="/service"
            icon={<Wrench className="w-6 h-6 md:w-7 md:h-7" />}
            label="Sửa chữa"
            color="blue"
          />
          <QuickActionCard
            to="/inventory"
            icon={<Boxes className="w-6 h-6 md:w-7 md:h-7" />}
            label="Kho hàng"
            color="orange"
          />
          <QuickActionCard
            to="/customers"
            icon={<Users className="w-6 h-6 md:w-7 md:h-7" />}
            label="Khách hàng"
            color="cyan"
          />
          <QuickActionCard
            to="/settings"
            icon={<Settings className="w-6 h-6 md:w-7 md:h-7" />}
            label="Cài đặt"
            color="slate"
          />
        </div>
      </div>

      {/* Cảnh báo quan trọng - Chỉ hiện trên mobile khi có cảnh báo */}
      {alerts.length > 0 && (
        <div className="md:hidden space-y-3">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-slate-800 rounded-xl p-4 md:p-5 shadow-sm border-l-4 border-l-amber-500 border border-t-slate-200 border-r-slate-200 border-b-slate-200 dark:border-t-slate-700 dark:border-r-slate-700 dark:border-b-slate-700"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5" />
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white text-sm">
                    {alert.type}
                  </h3>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                    {alert.message}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Desktop View Helpers - Tiêu đề ngày tháng + Bộ lọc */}
      <div className="hidden md:flex items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white">
          Tổng quan{" "}
          {reportFilter === "today" && "hôm nay"}
          {reportFilter === "7days" && "7 ngày qua"}
          {reportFilter === "week" && "tuần này"}
          {reportFilter === "month" && "tháng này"}
          {reportFilter === "year" && `năm ${new Date().getFullYear()}`}
          {reportFilter.startsWith("month") && reportFilter.length > 5 && `tháng ${reportFilter.slice(5)}`}
          {reportFilter.startsWith("q") && reportFilter.length === 2 && `quý ${reportFilter.slice(1)}`}
          {" - "}
          {new Date().toLocaleDateString("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
          })}
        </h2>
        <select
          value={reportFilter}
          onChange={(e) => setReportFilter(e.target.value)}
          className="text-sm bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg px-4 py-2 text-slate-700 dark:text-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
        >
          <optgroup label="Thời gian">
            <option value="today">Hôm nay</option>
            <option value="7days">7 ngày qua</option>
            <option value="week">Tuần này</option>
            <option value="month">Tháng này</option>
            <option value="year">Năm nay</option>
          </optgroup>
          <optgroup label="Theo tháng">
            <option value="month1">Tháng 1</option>
            <option value="month2">Tháng 2</option>
            <option value="month3">Tháng 3</option>
            <option value="month4">Tháng 4</option>
            <option value="month5">Tháng 5</option>
            <option value="month6">Tháng 6</option>
            <option value="month7">Tháng 7</option>
            <option value="month8">Tháng 8</option>
            <option value="month9">Tháng 9</option>
            <option value="month10">Tháng 10</option>
            <option value="month11">Tháng 11</option>
            <option value="month12">Tháng 12</option>
          </optgroup>
          <optgroup label="Theo quý">
            <option value="q1">Quý 1 (T1-T3)</option>
            <option value="q2">Quý 2 (T4-T6)</option>
            <option value="q3">Quý 3 (T7-T9)</option>
            <option value="q4">Quý 4 (T10-T12)</option>
          </optgroup>
        </select>
      </div>

      {/* Overview & Charts - Removed Finance/Sales charts */}
      {/* Work Order Stats and Alerts only */}

      <div className="hidden md:grid gap-4 md:grid-cols-3">
        {/* Alerts & Warnings - Now full width or large part */}
        <div className="md:col-span-1 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-orange-500" />
            Cần chú ý
          </h3>
          <div className="space-y-3">
            {alerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                Mọi thứ đều ổn định!
              </div>
            ) : (
              alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-red-50 dark:bg-red-900/10 rounded-xl border border-red-100 dark:border-red-900/20"
                >
                  <AlertTriangle className={`w-5 h-5 shrink-0 ${alert.color}`} />
                  <div>
                    <h4
                      className={`text-sm font-bold ${alert.color} mb-0.5`}
                    >
                      {alert.type}
                    </h4>
                    <p className="text-xs text-slate-600 dark:text-slate-400">
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Work Order Stats - Expanded */}
        <div className="md:col-span-2 bg-white dark:bg-slate-800 p-6 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
            <Wrench className="w-5 h-5 text-blue-500" />
            Trạng thái sửa chữa
          </h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="flex flex-col items-center justify-center p-4 bg-blue-50 dark:bg-blue-900/10 rounded-xl">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tiếp nhận mới
              </span>
              <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">
                {workOrderStats.newOrders}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-amber-50 dark:bg-amber-900/10 rounded-xl">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Đang sửa chữa
              </span>
              <span className="text-3xl font-bold text-amber-600 dark:text-amber-400">
                {workOrderStats.inProgress}
              </span>
            </div>
            <div className="flex flex-col items-center justify-center p-4 bg-green-50 dark:bg-green-900/10 rounded-xl">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Đã hoàn thành
              </span>
              <span className="text-3xl font-bold text-green-600 dark:text-green-400">
                {workOrderStats.completed}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Demo Controls - Dev only */}
      <div className="mt-8 pt-8 border-t border-slate-200 dark:border-slate-700 flex justify-center gap-4 hidden md:flex">
        <button
          onClick={handleLoadDemo}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition"
        >
          Nạp dữ liệu mẫu
        </button>
        <button
          onClick={handleClearDemo}
          className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-sm font-medium transition flex items-center gap-2"
        >
          <Trash2 className="w-4 h-4" />
          Xóa dữ liệu
        </button>
      </div>
    </div>
  );
};

export default Dashboard;
