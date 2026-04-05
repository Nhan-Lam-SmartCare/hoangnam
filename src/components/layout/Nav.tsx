import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../../contexts/useTheme";
import { useAuth } from "../../contexts/AuthContext";
import { useAppContext } from "../../contexts/AppContext";
import { supabase } from "../../supabaseClient";
import NotificationDropdown from "../common/NotificationDropdown";
import { USER_ROLES, USER_ROLE_LABELS } from "../../constants";
import { NavLink } from "./index";
import { canAccessInventorySection } from "../../utils/inventoryAccess";
import { canDo } from "../../utils/permissions";
import {
  LayoutDashboard,
  Wrench,
  Shield,
  Boxes,
  Users,
  UserRoundPlus,
  Landmark,
  FileText,
  Settings as Cog,
  LogOut,
  Sun,
  Moon,
  Crown,
  UserCog,
  User,
  X,
  Menu,
  Home,
} from "lucide-react";

const BRANCH_TABLE_DISABLED_KEY = "motocare-schema-missing-branches";

function readLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeLocalFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    // Ignore localStorage write errors
  }
}

function isMissingTableError(error: any): boolean {
  const details = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    error?.status === 404 ||
    error?.code === "PGRST205" ||
    details.includes("does not exist") ||
    details.includes("could not find")
  );
}

// eslint-disable-next-line max-lines-per-function, complexity
export function Nav() {
  const [showSettings, setShowSettings] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [branchOptions, setBranchOptions] = useState<
    Array<{ id: string; name: string }>
  >([{ id: "CN1", name: "Chi nhánh 1" }]);
  const { theme, toggleTheme } = useTheme();
  const { profile, user, signOut } = useAuth();
  const { currentBranchId, setCurrentBranchId } = useAppContext();
  const role = profile?.role;
  const preferredName =
    profile?.name?.trim() ||
    profile?.full_name?.trim() ||
    user?.user_metadata?.full_name?.trim() ||
    user?.user_metadata?.name?.trim() ||
    user?.user_metadata?.display_name?.trim();
  const displayName =
    preferredName && preferredName.length > 0
      ? preferredName
      : profile?.email || user?.email || "Tài khoản";
  const displayInitial =
    preferredName?.charAt(0)?.toUpperCase() ||
    profile?.email?.charAt(0)?.toUpperCase() ||
    user?.email?.charAt(0)?.toUpperCase() ||
    "N";
  const isOwnerOrManager =
    role === USER_ROLES.OWNER || role === USER_ROLES.MANAGER;
  const canViewInventory = canAccessInventorySection(profile, user);
  const canViewReports = canDo(profile, "reports.view");
  const canViewCashBook =
    canDo(profile, "cashbook.view") || canDo(profile, "finance.view");
  const can = {
    viewFinance: canViewCashBook,
    viewPayroll: false,
    viewAnalytics: false,
    viewDebt: false,
    viewEmployees: isOwnerOrManager,
    viewSettings: isOwnerOrManager,
    viewInventory: canViewInventory,
    viewDashboard: isOwnerOrManager,
    viewReports: canViewReports,
  } as const;

  useEffect(() => {
    const mergeBranches = (
      ...lists: Array<Array<{ id: string; name?: string }> | undefined>
    ) => {
      const merged = new Map<string, { id: string; name: string }>();

      lists
        .flatMap((list) => list || [])
        .forEach((branch) => {
          const id = String(branch?.id || "").trim();
          if (!id) return;
          merged.set(id, {
            id,
            name: String(branch?.name || id).trim() || id,
          });
        });

      if (!merged.has("CN1")) {
        merged.set("CN1", { id: "CN1", name: "Chi nhánh 1" });
      }

      if (currentBranchId && !merged.has(currentBranchId)) {
        merged.set(currentBranchId, {
          id: currentBranchId,
          name: currentBranchId === "CN1" ? "Chi nhánh 1" : currentBranchId,
        });
      }

      return Array.from(merged.values()).sort((a, b) =>
        a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
      );
    };

    const loadBranches = async () => {
      let localOverrides: Array<{ id: string; name: string }> = [];
      try {
        const raw = localStorage.getItem("branch_overrides_v1");
        const parsed = raw ? JSON.parse(raw) : [];
        if (Array.isArray(parsed)) {
          localOverrides = parsed;
        }
      } catch {
        localOverrides = [];
      }

      if (readLocalFlag(BRANCH_TABLE_DISABLED_KEY)) {
        setBranchOptions(mergeBranches(localOverrides));
        return;
      }

      try {
        const { data, error } = await supabase
          .from("branches")
          .select("id, name")
          .order("name");

        if (!error && data) {
          setBranchOptions(mergeBranches(data as Array<{ id: string; name: string }>, localOverrides));
          return;
        }

        if (isMissingTableError(error)) {
          writeLocalFlag(BRANCH_TABLE_DISABLED_KEY);
        }
      } catch {
        // Fallback below
      }

      setBranchOptions(mergeBranches(localOverrides));
    };

    void loadBranches();
  }, [currentBranchId]);

  return (
    <nav className="hidden md:block bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 border-b border-blue-900/40 sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-2 md:px-4 py-1 md:py-1.5">
        <div className="flex items-center justify-between">
          {/* Left: Brand and Branch Selector */}
          <div className="flex items-center gap-2 md:gap-3">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition"
              aria-label="Menu"
            >
              <Menu className="w-5 h-5 text-white" />
            </button>

            {/* Brand Logo acts as settings toggle */}
            <div className="relative">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="group flex items-center gap-2 focus:outline-none"
                aria-label="Mở cài đặt và tài khoản"
              >
                <img
                  src="/logo-smartcare.png"
                  alt="Sơn Nam"
                  className="w-8 h-8 md:w-10 md:h-10 rounded-lg shadow-sm ring-1 ring-slate-200 dark:ring-slate-700 group-hover:shadow-md group-hover:ring-emerald-400/60 dark:group-hover:ring-emerald-500/60 transition"
                />
                {/* Mobile: Shorter name */}
                <span className="font-bold text-xs tracking-tight text-white lg:hidden">
                  Sơn Nam
                </span>
                {/* Desktop: Full name */}
                <span className="font-bold text-sm tracking-tight text-white hidden lg:inline whitespace-nowrap">
                  Sơn Nam
                </span>
              </button>

              {/* Integrated Settings Dropdown */}
              {showSettings && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setShowSettings(false)}
                  ></div>
                  <div className="absolute top-full left-0 mt-2 w-80 bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-slate-200 dark:border-slate-700 py-2 z-50">
                    <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                        Cài đặt & tài khoản
                      </p>
                      <button
                        onClick={() => setShowSettings(false)}
                        className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
                        aria-label="Đóng"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* User profile summary */}
                    {profile && (
                      <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex items-center gap-3">
                        <div className="w-9 h-9 bg-blue-600 rounded-full flex items-center justify-center text-white font-semibold">
                          {displayInitial}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-slate-900 dark:text-white truncate">
                            {displayName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400 truncate flex items-center gap-1">
                            {profile.role === USER_ROLES.OWNER && (
                              <Crown className="w-3.5 h-3.5 text-yellow-500" />
                            )}
                            {profile.role === USER_ROLES.MANAGER && (
                              <UserCog className="w-3.5 h-3.5 text-indigo-500" />
                            )}
                            {profile.role === USER_ROLES.STAFF && (
                              <User className="w-3.5 h-3.5 text-slate-500" />
                            )}
                            <span>
                              {USER_ROLE_LABELS[profile.role] ||
                                USER_ROLE_LABELS[USER_ROLES.STAFF]}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Theme toggle */}
                    <button
                      onClick={() => {
                        toggleTheme();
                        setShowSettings(false);
                      }}
                      className="w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-between text-sm text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        {theme === "dark" ? (
                          <Moon className="w-4 h-4" />
                        ) : (
                          <Sun className="w-4 h-4" />
                        )}
                        <span>Chế độ {theme === "dark" ? "tối" : "sáng"}</span>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400">
                        {theme === "dark"
                          ? "Chuyển sang sáng"
                          : "Chuyển sang tối"}
                      </span>
                    </button>

                    {/* Go to system settings (restricted) */}
                    {can.viewSettings && (
                      <Link
                        to="/settings"
                        onClick={() => setShowSettings(false)}
                        className="block w-full px-4 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 text-sm text-slate-700 dark:text-slate-200"
                      >
                        <span className="flex items-center gap-2">
                          <Cog className="w-4 h-4" />
                          <span>Cài đặt hệ thống</span>
                        </span>
                      </Link>
                    )}

                    {/* Logout */}
                    {profile && (
                      <button
                        onClick={async () => {
                          try {
                            await signOut();
                          } finally {
                            setShowSettings(false);
                          }
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <span className="flex items-center gap-2">
                          <LogOut className="w-4 h-4" />
                          <span>Đăng xuất</span>
                        </span>
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
            <div className="hidden md:flex items-center gap-2 ml-1">
              <select
                value={currentBranchId || "CN1"}
                onChange={(e) => setCurrentBranchId(e.target.value)}
                className="h-8 min-w-[150px] px-2.5 rounded-lg border border-white/20 bg-white/10 text-white text-xs font-semibold backdrop-blur-sm"
                title="Chọn chi nhánh làm việc"
              >
                {branchOptions.map((branch) => (
                  <option key={branch.id} value={branch.id} className="text-slate-900">
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Center: Main Navigation - Hidden on mobile */}
          <div className="hidden md:flex items-center gap-1">
            {can.viewDashboard && (
              <NavLink
                to="/dashboard"
                colorKey="blue"
                icon={<LayoutDashboard className="w-4 h-4" />}
                label="Tổng quan"
              />
            )}
            <NavLink
              to="/service"
              colorKey="violet"
              icon={<Wrench className="w-4 h-4" />}
              label="Sửa chữa"
            />
            <NavLink
              to="/warranty"
              colorKey="emerald"
              icon={<Shield className="w-4 h-4" />}
              label="Bảo hành"
            />
            {/* Sales link removed */}
            {can.viewInventory && (
              <NavLink
                to="/inventory"
                colorKey="amber"
                icon={<Boxes className="w-4 h-4" />}
                label="Quản lý kho"
              />
            )}
            <NavLink
              to="/customers"
              colorKey="cyan"
              icon={<Users className="w-4 h-4" />}
              label="Khách hàng"
            />
            {can.viewEmployees && (
              <NavLink
                to="/employees"
                colorKey="indigo"
                icon={<UserRoundPlus className="w-4 h-4" />}
                label="Nhân viên"
              />
            )}
            {can.viewReports && (
              <NavLink
                to="/reports"
                colorKey="fuchsia"
                icon={<FileText className="w-4 h-4" />}
                label="Báo cáo"
              />
            )}
            {can.viewFinance && (
              <NavLink
                to="/cash-book"
                colorKey="teal"
                icon={<Landmark className="w-4 h-4" />}
                label="Sổ quỹ"
              />
            )}
            {/* Removed unrelated links: Finance, Debt, Analytics, Promotions */}
          </div>

          {/* Right: Notifications and Home Icon (mobile only) */}
          <div className="flex items-center gap-1">
            {/* Notification Dropdown */}
            <NotificationDropdown />

            {/* Home Button - Only visible on mobile */}
            <Link
              to={role === USER_ROLES.STAFF ? "/staff-dashboard" : "/dashboard"}
              className="md:hidden p-2 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
              title="Trang chủ"
            >
              <Home className="w-6 h-6" />
            </Link>
          </div>
        </div>

        {/* Mobile Menu Drawer - For Secondary Functions */}
        {showMobileMenu && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowMobileMenu(false)}
            ></div>

            {/* Menu Drawer - Redesigned with modern style */}
            <div className="fixed inset-y-0 left-0 w-80 bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 z-50 shadow-2xl md:hidden overflow-y-auto animate-slide-in-left">
              {/* Header with Profile */}
              <div className="relative p-6 pb-8 bg-gradient-to-br from-red-600 to-yellow-500">
                <button
                  onClick={() => setShowMobileMenu(false)}
                  className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition text-white"
                >
                  <X className="w-5 h-5" />
                </button>

                {profile && (
                  <div className="flex items-center gap-3 text-white mt-2">
                    <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-full flex items-center justify-center text-xl font-bold border-2 border-white/30">
                      {profile.full_name?.[0] || profile.email[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold text-base truncate">
                        {profile.full_name || profile.email}
                      </div>
                      <div className="text-xs text-white/80 flex items-center gap-1 mt-0.5">
                        {profile.role === USER_ROLES.OWNER && (
                          <Crown className="w-3 h-3" />
                        )}
                        {profile.role === USER_ROLES.MANAGER && (
                          <UserCog className="w-3 h-3" />
                        )}
                        {profile.role === USER_ROLES.STAFF && (
                          <User className="w-3 h-3" />
                        )}
                        <span>
                          {USER_ROLE_LABELS[profile.role] ||
                            USER_ROLE_LABELS[USER_ROLES.STAFF]}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Removed Management, Finance, Reports, Settings sections from Mobile Drawer */}

              {/* Logout Button - Fixed at bottom */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700">
                <button
                  onClick={async () => {
                    try {
                      await signOut();
                    } finally {
                      setShowMobileMenu(false);
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl font-medium transition shadow-lg shadow-red-500/20"
                >
                  <LogOut className="w-5 h-5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
