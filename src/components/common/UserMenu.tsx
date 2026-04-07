import React, { useState } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import { useNavigate } from "react-router-dom";
import { Crown, UserCog, User as UserIcon, LogOut } from "lucide-react";

const roleLabels: Record<string, { label: string; icon?: React.ReactNode }> = {
  owner: { label: "Chủ cửa hàng", icon: <Crown className="w-4 h-4" /> },
  manager: { label: "Quản lý", icon: <UserCog className="w-4 h-4" /> },
  staff: { label: "Nhân viên", icon: <UserIcon className="w-4 h-4" /> },
};

export const UserMenu = () => {
  const [showMenu, setShowMenu] = useState(false);
  const { profile, signOut, hasRole } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await signOut();
      showToast.success("Đã đăng xuất");
      navigate("/login");
    } catch (err) {
      showToast.error("Lỗi khi đăng xuất");
    }
  };

  const canAction = hasRole(["manager", "owner"]);

  return (
    <div className="relative inline-block text-left">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
      >
        <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
          {profile?.name?.[0] ||
            profile?.full_name?.[0] ||
            profile?.email?.[0]?.toUpperCase()}
        </div>
        <div className="text-left hidden sm:block">
          <div className="text-sm font-medium text-slate-900 dark:text-white">
            {profile?.name || profile?.full_name || profile?.email}
          </div>
          <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
            {roleLabels[profile?.role || "staff"]?.icon}
            <span>{roleLabels[profile?.role || "staff"]?.label}</span>
          </div>
        </div>
        <svg
          className="w-4 h-4 text-slate-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {showMenu && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setShowMenu(false)}
          />
          <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 py-2 z-20">
            <div className="px-4 py-2 border-b border-slate-200 dark:border-slate-700">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Đăng nhập với
              </div>
              <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                {profile?.email}
              </div>
            </div>

            {/* Admin actions visible only to manager/owner */}
            {canAction && (
              <button
                onClick={() => navigate("/settings")}
                className="w-full px-4 py-2 text-left text-sm text-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900/20 transition-colors flex items-center gap-2"
              >
                <UserCog className="w-4 h-4" />
                <span>Cài đặt & Quản lý</span>
              </button>
            )}

            <button
              onClick={handleLogout}
              className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors flex items-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              <span>Đăng xuất</span>
            </button>
          </div>
        </>
      )}
    </div>
  );
};
