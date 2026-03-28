import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Wrench,
  ShoppingCart as Cart,
  Boxes,
  Users,
  Shield,
  Menu,
  X,
  LogOut,
  User,
  Crown,
  UserCog,
  Bell,
  Settings,
  CircleUser
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { USER_ROLES, USER_ROLE_LABELS } from "../../constants";
import { useTheme } from "../../contexts/ThemeContext";

// Color types and constants
export type ColorKey =
  | "blue"
  | "violet"
  | "emerald"
  | "amber"
  | "cyan"
  | "indigo"
  | "rose"
  | "orange"
  | "teal"
  | "fuchsia"
  | "slate";

export const NAV_COLORS: Record<
  ColorKey,
  { text: string; bg: string; hoverBg: string }
> = {
  blue: {
    text: "text-blue-600 dark:text-blue-400",
    bg: "bg-blue-50 dark:bg-blue-900/30",
    hoverBg: "hover:bg-blue-50 dark:hover:bg-blue-900/20",
  },
  violet: {
    text: "text-violet-600 dark:text-violet-400",
    bg: "bg-violet-50 dark:bg-violet-900/30",
    hoverBg: "hover:bg-violet-50 dark:hover:bg-violet-900/20",
  },
  emerald: {
    text: "text-emerald-600 dark:text-emerald-400",
    bg: "bg-emerald-50 dark:bg-emerald-900/30",
    hoverBg: "hover:bg-emerald-50 dark:hover:bg-emerald-900/20",
  },
  amber: {
    text: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-50 dark:bg-amber-900/30",
    hoverBg: "hover:bg-amber-50 dark:hover:bg-amber-900/20",
  },
  cyan: {
    text: "text-cyan-600 dark:text-cyan-400",
    bg: "bg-cyan-50 dark:bg-cyan-900/30",
    hoverBg: "hover:bg-cyan-50 dark:hover:bg-cyan-900/20",
  },
  indigo: {
    text: "text-indigo-600 dark:text-indigo-400",
    bg: "bg-indigo-50 dark:bg-indigo-900/30",
    hoverBg: "hover:bg-indigo-50 dark:hover:bg-indigo-900/20",
  },
  rose: {
    text: "text-rose-600 dark:text-rose-400",
    bg: "bg-rose-50 dark:bg-rose-900/30",
    hoverBg: "hover:bg-rose-50 dark:hover:bg-rose-900/20",
  },
  orange: {
    text: "text-orange-600 dark:text-orange-400",
    bg: "bg-orange-50 dark:bg-orange-900/30",
    hoverBg: "hover:bg-orange-50 dark:hover:bg-orange-900/20",
  },
  teal: {
    text: "text-teal-600 dark:text-teal-400",
    bg: "bg-teal-50 dark:bg-teal-900/30",
    hoverBg: "hover:bg-teal-50 dark:hover:bg-teal-900/20",
  },
  fuchsia: {
    text: "text-fuchsia-600 dark:text-fuchsia-400",
    bg: "bg-fuchsia-50 dark:bg-fuchsia-900/30",
    hoverBg: "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-900/20",
  },
  slate: {
    text: "text-slate-600 dark:text-slate-400",
    bg: "bg-slate-50 dark:bg-slate-900/30",
    hoverBg: "hover:bg-slate-50 dark:hover:bg-slate-900/20",
  },
};

// Mobile Drawer Link Component
export const MobileDrawerLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  color: ColorKey;
  onClick?: () => void;
}> = ({ to, icon, label, color, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  const colorConfig = NAV_COLORS[color as ColorKey] || NAV_COLORS.slate;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition ${isActive
        ? `${colorConfig.bg} ${colorConfig.text} shadow-sm`
        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50"
        }`}
    >
      <div className={`${isActive ? colorConfig.text : ""}`}>{icon}</div>
      <span className="font-medium text-sm">{label}</span>
    </Link>
  );
};

// Mobile Nav Link Component
export const MobileNavLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
}> = ({ to, icon, label, onClick }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition ${isActive
        ? "bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400"
        : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
        }`}
    >
      {icon}
      <span className="font-medium">{label}</span>
    </Link>
  );
};

// Desktop NavLink Component
export const NavLink: React.FC<{
  to: string;
  icon: React.ReactNode;
  label: string;
  colorKey: ColorKey;
}> = ({ to, icon, label, colorKey }) => {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={`flex flex-col items-center gap-0.5 px-2.5 py-1 rounded-md transition ${isActive
        ? "bg-white/20 text-white font-bold"
        : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
    >
      <span className="flex items-center justify-center">{icon}</span>
      <span className="text-[10px] font-medium whitespace-nowrap">{label}</span>
    </Link>
  );
};

// Bottom Navigation Bar for Mobile
export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const role = profile?.role;
  const isOwnerOrManager =
    role === USER_ROLES.OWNER || role === USER_ROLES.MANAGER;
  const [showMenu, setShowMenu] = useState(false);
  const { theme, toggleTheme } = useTheme();

  // Hide bottom nav on specific pages if needed
  // Note: We want it visible mostly everywhere now
  if (location.pathname === "/sales") {
    return null;
  }

  const allNavItems = [
    {
      to: "/dashboard",
      icon: <LayoutDashboard className="w-6 h-6" />,
      label: "Tổng quan",
      color: "blue",
      show: isOwnerOrManager,
    },
    {
      to: "/service",
      icon: <Wrench className="w-6 h-6" />,
      label: "Sửa chữa",
      color: "violet",
      show: true,
    },
    {
      to: "/inventory",
      icon: <Boxes className="w-6 h-6" />,
      label: "Kho",
      color: "amber",
      show: isOwnerOrManager,
    },
    {
      to: "/warranty",
      icon: <Shield className="w-6 h-6" />,
      label: "Bảo hành",
      color: "emerald",
      show: true,
    },
    // "Thêm" menu item
    {
      to: "#menu",
      icon: <Menu className="w-6 h-6" />,
      label: "Thêm",
      color: "slate",
      show: true,
      onClick: (e: React.MouseEvent) => {
        e.preventDefault();
        setShowMenu(true);
      },
    },
  ];

  const navItems = allNavItems.filter((item) => item.show);

  return (
    <>
      <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-slate-800 safe-area-bottom shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        {/* Backdrop blur effect for modern look */}
        <div className="absolute inset-0 bg-white/80 dark:bg-slate-800/80 backdrop-blur-lg -z-10"></div>

        <div
          className={`grid gap-1 px-2 py-2 ${navItems.length === 3
            ? "grid-cols-3"
            : navItems.length === 4
              ? "grid-cols-4"
              : "grid-cols-5"
            }`}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            const colorKey = item.color as ColorKey;

            return (
              <Link
                key={item.label}
                to={item.to}
                onClick={item.onClick}
                className={`flex flex-col items-center gap-1 px-1 py-2 rounded-lg transition-all duration-200 ${isActive && !item.onClick
                  ? `${NAV_COLORS[colorKey].bg} ${NAV_COLORS[colorKey].text}`
                  : "text-slate-500 dark:text-slate-400 active:scale-95"
                  }`}
              >
                <div
                  className={`transition-transform ${isActive ? "scale-105" : ""
                    }`}
                >
                  {React.cloneElement(
                    item.icon as React.ReactElement<{ className?: string }>,
                    {
                      className: "w-6 h-6",
                    }
                  )}
                </div>
                <span
                  className={`text-[9px] font-medium truncate w-full text-center ${isActive ? "font-semibold" : ""
                    }`}
                >
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Mobile Menu Drawer */}
      {showMenu && (
        <div className="fixed inset-0 z-[60] md:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setShowMenu(false)}
          />

          {/* Drawer Content */}
          <div className="absolute right-0 top-0 bottom-0 w-[85vw] max-w-sm bg-white dark:bg-[#1e1e2d] shadow-2xl animate-slide-in-left border-l border-slate-200 dark:border-slate-800">
            <div className="h-full flex flex-col">
              {/* Header */}
              <div className="p-5 bg-gradient-to-br from-blue-600 to-blue-800 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-20">
                  <Shield className="w-24 h-24 rotate-12" />
                </div>

                <div className="relative z-10 flex items-center gap-4 mb-4">
                  <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-md border-2 border-white/30 flex items-center justify-center text-2xl font-bold shadow-lg">
                    {profile?.full_name?.[0] || profile?.email?.[0]?.toUpperCase() || "U"}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg leading-tight mb-1">
                      {profile?.full_name || "Người dùng"}
                    </h3>
                    <div className="flex items-center gap-1.5 text-xs bg-black/20 px-2 py-1 rounded-full w-fit">
                      {profile?.role === "owner" ? <Crown className="w-3 h-3 text-yellow-300" /> : <User className="w-3 h-3" />}
                      <span className="opacity-90">{USER_ROLE_LABELS[profile?.role || "staff"]}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => setShowMenu(false)}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Menu Items */}
              <div className="flex-1 overflow-y-auto py-2">
                <div className="px-4 py-2 space-y-1">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Ứng dụng</div>

                  <MobileDrawerLink
                    to="/dashboard"
                    icon={<LayoutDashboard className="w-5 h-5" />}
                    label="Tổng quan"
                    color="blue"
                    onClick={() => setShowMenu(false)}
                  />
                  <MobileDrawerLink
                    to="/service"
                    icon={<Wrench className="w-5 h-5" />}
                    label="Quản lý sửa chữa"
                    color="violet"
                    onClick={() => setShowMenu(false)}
                  />
                  <MobileDrawerLink
                    to="/customers"
                    icon={<Users className="w-5 h-5" />}
                    label="Khách hàng"
                    color="cyan"
                    onClick={() => setShowMenu(false)}
                  />
                  <MobileDrawerLink
                    to="/inventory"
                    icon={<Boxes className="w-5 h-5" />}
                    label="Kho hàng & Vật tư"
                    color="amber"
                    onClick={() => setShowMenu(false)}
                  />
                  <MobileDrawerLink
                    to="/warranty"
                    icon={<Shield className="w-5 h-5" />}
                    label="Tra cứu bảo hành"
                    color="emerald"
                    onClick={() => setShowMenu(false)}
                  />
                </div>

                <div className="border-t border-slate-100 dark:border-slate-800 my-2"></div>

                <div className="px-4 py-2 space-y-1">
                  <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2 px-2">Cài đặt</div>

                  {/* Theme Toggle in Menu */}
                  <button
                    onClick={toggleTheme}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                  >
                    <div className="text-slate-500 dark:text-slate-400">
                      {theme === 'dark' ? <Settings className="w-5 h-5" /> : <Settings className="w-5 h-5" />}
                    </div>
                    <span className="font-medium text-sm">Giao diện {theme === 'dark' ? 'Tối' : 'Sáng'}</span>
                  </button>

                  <Link
                    to="/settings"
                    onClick={() => setShowMenu(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
                  >
                    <div className="text-slate-500 dark:text-slate-400">
                      <Settings className="w-5 h-5" />
                    </div>
                    <span className="font-medium text-sm">Cài đặt hệ thống</span>
                  </Link>
                </div>
              </div>

              {/* Logout Footer */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#1a1a2e]">
                <button
                  onClick={() => {
                    signOut();
                    setShowMenu(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-xl font-semibold hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                >
                  <LogOut className="w-5 h-5" />
                  Đăng xuất
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
