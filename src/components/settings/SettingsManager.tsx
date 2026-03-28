import { useState, useEffect } from "react";
// Dùng supabaseClient thống nhất để tránh nhiều phiên GoTrue
import { supabase } from "../../supabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
// import { safeAudit } from "../../lib/repository/auditLogsRepository";
import LoadingSpinner from "../common/LoadingSpinner";
import { MFASetup } from "../auth/MFASetup";
import {
  Lock,
  Settings as SettingsIcon,
  Save,
  Info,
  Store,
  Palette,
  Landmark,
  FileText,
  Upload,
  Image as ImageIcon,
  Shield,
  Users,
  UserPlus,
  Edit2,
  Trash2,
  Check,
  X,
  Mail,
  Building2,
} from "lucide-react";

interface StoreSettings {
  id: string;
  store_name: string;
  store_name_en?: string;
  slogan?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  tax_code?: string;
  logo_url?: string;
  bank_qr_url?: string;
  primary_color?: string;
  business_hours?: string;
  established_year?: number;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  invoice_prefix?: string;
  receipt_prefix?: string;
  work_order_prefix?: string;
  invoice_footer_note?: string;
  currency?: string;
  date_format?: string;
  timezone?: string;
}

interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "staff";
  branch_id: string;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

export const SettingsManager = () => {
  const { profile, hasRole } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "branding" | "banking" | "invoice" | "security" | "staff"
  >("general");

  // Staff management state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"manager" | "staff">(
    "staff"
  );
  const [newStaffBranch, setNewStaffBranch] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  // Load staff when tab changes to staff
  useEffect(() => {
    if (activeTab === "staff" && hasRole(["owner"])) {
      loadStaff();
      loadBranches();
    }
  }, [activeTab]);

  const loadBranches = async () => {
    try {
      // Try to get branches from database first
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");

      if (!error && data && data.length > 0) {
        setBranches(data);
        if (!newStaffBranch) {
          setNewStaffBranch(data[0].id);
        }
      } else {
        // Fallback: Get unique branch IDs from work_orders or use default
        const { data: workOrders } = await supabase
          .from("work_orders")
          .select("branchid")
          .limit(100);

        const uniqueBranches = [
          ...new Set(workOrders?.map((w) => w.branchid).filter(Boolean) || []),
        ];

        if (uniqueBranches.length > 0) {
          const branchList = uniqueBranches.map((id) => ({
            id,
            name: id === "CN1" ? "Chi nhánh 1" : id,
          }));
          setBranches(branchList);
          if (!newStaffBranch) {
            setNewStaffBranch(branchList[0].id);
          }
        } else {
          // Default branch if nothing found
          setBranches([{ id: "CN1", name: "Chi nhánh 1" }]);
          if (!newStaffBranch) {
            setNewStaffBranch("CN1");
          }
        }
      }
    } catch (error) {
      console.error("Error loading branches:", error);
      // Set default branch on error
      setBranches([{ id: "CN1", name: "Chi nhánh 1" }]);
      setNewStaffBranch("CN1");
    }
  };

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      // Try RPC function first (bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_all_users_for_owner"
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        setStaffList(rpcData as StaffMember[]);
      } else {
        // Fallback: Try to get from profiles table
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, name, role, branch_id, created_at")
          .order("created_at", { ascending: false });

        if (!profilesError && profilesData && profilesData.length > 0) {
          setStaffList(profilesData as StaffMember[]);
        } else {
          // Last fallback: Show current user profile
          if (profile) {
            setStaffList([
              {
                id: profile.id,
                email: profile.email,
                name: profile.name || profile.full_name || "",
                role: profile.role,
                branch_id: "CN1",
                created_at: profile.created_at,
              },
            ]);
          }

          // Show info toast about RPC function
          if (rpcError) {
            console.log(
              "RPC not available, using fallback. Run sql/2025-12-02_user_management_rpc.sql to enable full user management."
            );
          }
        }
      }
    } catch (error) {
      console.error("Error loading staff:", error);
      // Show current user as fallback
      if (profile) {
        setStaffList([
          {
            id: profile.id,
            email: profile.email,
            name: profile.name || profile.full_name || "",
            role: profile.role,
            branch_id: "CN1",
            created_at: profile.created_at,
          },
        ]);
      }
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleUpdateStaffRole = async (
    staffId: string,
    newRole: "owner" | "manager" | "staff",
    newBranchId: string
  ) => {
    setSavingStaff(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole, branch_id: newBranchId })
        .eq("id", staffId);

      if (error) throw error;

      showToast.success("Đã cập nhật quyền nhân viên");
      setEditingStaff(null);
      await loadStaff();

      // Audit log
      // safeAudit(profile?.id || null, {
      //   action: "staff.update_role",
      //   tableName: "profiles",
      //   recordId: staffId,
      //   newData: { role: newRole, branch_id: newBranchId },
      // });
    } catch (error: any) {
      console.error("Error updating staff role:", error);
      showToast.error(error.message || "Không thể cập nhật quyền");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleInviteStaff = async () => {
    if (!newStaffEmail.trim()) {
      showToast.error("Vui lòng nhập email");
      return;
    }

    setSavingStaff(true);
    try {
      // Check if email already exists
      const { data: existingUser } = await supabase
        .from("profiles")
        .select("id")
        .eq("email", newStaffEmail.trim().toLowerCase())
        .maybeSingle();

      if (existingUser) {
        showToast.error("Email này đã tồn tại trong hệ thống");
        setSavingStaff(false);
        return;
      }

      // Use Supabase admin invite (requires service role or invite enabled)
      // For now, we'll create a placeholder profile that will be linked when user signs up
      const { data, error } = await supabase.auth.admin.inviteUserByEmail(
        newStaffEmail.trim(),
        {
          data: {
            name: newStaffName.trim() || newStaffEmail.split("@")[0],
            role: newStaffRole,
            branch_id: newStaffBranch,
          },
        }
      );

      if (error) {
        // If admin invite fails, try alternative approach
        if (
          error.message.includes("not authorized") ||
          error.message.includes("admin")
        ) {
          // Fallback: Just show instructions
          showToast.info(
            `Để thêm nhân viên mới:\n1. Nhân viên đăng ký tài khoản với email: ${newStaffEmail}\n2. Quay lại đây để cập nhật quyền`,
            { autoClose: 8000 }
          );
          setShowAddStaff(false);
          resetNewStaffForm();
          return;
        }
        throw error;
      }

      showToast.success(`Đã gửi lời mời đến ${newStaffEmail}`);
      setShowAddStaff(false);
      resetNewStaffForm();
      await loadStaff();

      // void safeAudit(profile?.id || null, {
      //   action: "staff.invite",
      //   tableName: "profiles",
      //   newData: {
      //     email: newStaffEmail,
      //     role: newStaffRole,
      //     branch_id: newStaffBranch,
      //   },
      // });
    } catch (error: any) {
      console.error("Error inviting staff:", error);
      showToast.error(error.message || "Không thể mời nhân viên");
    } finally {
      setSavingStaff(false);
    }
  };

  const resetNewStaffForm = () => {
    setNewStaffEmail("");
    setNewStaffName("");
    setNewStaffRole("staff");
    setNewStaffBranch(branches[0]?.id || "");
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case "owner":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300";
      case "manager":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300";
      default:
        return "bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "owner":
        return "Chủ cửa hàng";
      case "manager":
        return "Quản lý";
      default:
        return "Nhân viên";
    }
  };

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .from("store_settings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (error) throw error;
      setSettings(data);
    } catch (error) {
      console.error("Error loading settings:", error);
      showToast.error("Không thể tải cài đặt");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const previous = { ...settings };

      console.log("Saving settings:", settings);

      // Update settings
      const { error, data } = await supabase
        .from("store_settings")
        .update(settings)
        .eq("id", settings.id)
        .select();

      if (error) {
        console.error("Update error:", error);
        throw error;
      }

      console.log("Update result:", data);

      // Reload settings after save to confirm changes
      await loadSettings();

      showToast.success("Đã lưu cài đặt thành công!");
      // void safeAudit(profile?.id || null, {
      //   action: "settings.update",
      //   tableName: "store_settings",
      //   recordId: settings.id,
      //   oldData: previous,
      //   newData: settings,
      // });
    } catch (error: any) {
      console.error("Error saving settings:", error);
      showToast.error(error.message || "Không thể lưu cài đặt");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof StoreSettings, value: any) => {
    if (!settings) return;
    setSettings({ ...settings, [field]: value });
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      showToast.error("Vui lòng chọn file ảnh");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      showToast.error("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    setUploadingLogo(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `logo-${Date.now()}.${fileExt}`;
      const filePath = `store-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      updateField("logo_url", data.publicUrl);
      showToast.success("Đã tải logo lên thành công!");
    } catch (error: any) {
      console.error("Error uploading logo:", error);
      showToast.error(error.message || "Không thể tải logo lên");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      showToast.error("Vui lòng chọn file ảnh");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast.error("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    setUploadingQR(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `bank-qr-${Date.now()}.${fileExt}`;
      const filePath = `store-assets/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      updateField("bank_qr_url", data.publicUrl);
      showToast.success("Đã tải mã QR ngân hàng lên thành công!");
    } catch (error: any) {
      console.error("Error uploading QR:", error);
      showToast.error(error.message || "Không thể tải mã QR lên");
    } finally {
      setUploadingQR(false);
    }
  };

  // Check permissions
  if (!hasRole(["owner", "manager"])) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center flex items-center gap-2 text-slate-600 dark:text-slate-400">
          <Lock className="w-5 h-5" aria-hidden="true" />
          <p className="text-lg">
            Chỉ chủ cửa hàng và quản lý mới có quyền truy cập cài đặt
          </p>
        </div>
      </div>
    );
  }

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-96">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const isOwner = hasRole(["owner"]);

  return (
    <div className="space-y-4 md:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <SettingsIcon
              className="w-6 h-6 md:w-7 md:h-7 text-blue-600"
              aria-hidden="true"
            />
            <span>Cài đặt hệ thống</span>
          </h1>
          <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Quản lý thông tin cửa hàng và cấu hình hệ thống
          </p>
        </div>
        {isOwner && (
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm md:text-base font-semibold transition-colors inline-flex items-center justify-center gap-2"
            aria-label="Lưu thay đổi"
          >
            {saving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
                <span>Lưu thay đổi</span>
              </>
            )}
          </button>
        )}
      </div>

      {!isOwner && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 md:p-4 flex items-start gap-2">
          <Info
            className="w-4 h-4 md:w-5 md:h-5 text-yellow-700 dark:text-yellow-300 mt-0.5 flex-shrink-0"
            aria-hidden="true"
          />
          <p className="text-xs md:text-sm text-yellow-800 dark:text-yellow-200">
            Bạn chỉ có quyền xem. Chỉ chủ cửa hàng mới có thể chỉnh sửa cài đặt.
          </p>
        </div>
      )}

      {/* Tabs Navigation */}
      <div>
        {/* Mobile View: Dropdown */}
        <div className="md:hidden mb-4">
          <label htmlFor="tabs" className="sr-only">
            Chọn mục cài đặt
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {(() => {
                const currentTab = [
                  { id: "general", icon: <Store className="w-5 h-5 text-slate-500" /> },
                  { id: "branding", icon: <Palette className="w-5 h-5 text-slate-500" /> },
                  { id: "banking", icon: <Landmark className="w-5 h-5 text-slate-500" /> },
                  { id: "invoice", icon: <FileText className="w-5 h-5 text-slate-500" /> },
                  { id: "security", icon: <Shield className="w-5 h-5 text-slate-500" /> },
                  { id: "staff", icon: <Users className="w-5 h-5 text-slate-500" /> },
                ].find((t) => t.id === activeTab);
                return currentTab?.icon;
              })()}
            </div>
            <select
              id="tabs"
              name="tabs"
              className="block w-full pl-10 pr-10 py-3 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-xl bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm appearance-none"
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value as any)}
            >
              <option value="general">Thông tin chung</option>
              <option value="branding">Thương hiệu</option>
              <option value="banking">Ngân hàng</option>
              <option value="invoice">Hóa đơn</option>
              <option value="security">Bảo mật</option>
              {hasRole(["owner"]) && <option value="staff">Nhân viên</option>}
            </select>
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <svg className="h-5 w-5 text-slate-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        {/* Desktop View: Tabs */}
        <div className="hidden md:block border-b border-slate-200 dark:border-slate-700">
          <nav className="-mb-px flex space-x-8" aria-label="Tabs">
            {[
              {
                id: "general",
                label: "Thông tin chung",
                icon: <Store className="w-4 h-4" />,
              },
              {
                id: "branding",
                label: "Thương hiệu",
                icon: <Palette className="w-4 h-4" />,
              },
              {
                id: "banking",
                label: "Ngân hàng",
                icon: <Landmark className="w-4 h-4" />,
              },
              {
                id: "invoice",
                label: "Hóa đơn",
                icon: <FileText className="w-4 h-4" />,
              },
              {
                id: "security",
                label: "Bảo mật",
                icon: <Shield className="w-4 h-4" />,
              },
              ...(hasRole(["owner"])
                ? [
                  {
                    id: "staff",
                    label: "Nhân viên",
                    icon: <Users className="w-4 h-4" />,
                  },
                ]
                : []),
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`
                  whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 transition-colors
                  ${activeTab === tab.id
                    ? "border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300"
                  }
                `}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 md:p-6">
        {/* General Tab */}
        {activeTab === "general" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Thông tin cửa hàng
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Tên cửa hàng *
                </label>
                <input
                  type="text"
                  value={settings.store_name || ""}
                  onChange={(e) => updateField("store_name", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Tên tiếng Anh
                </label>
                <input
                  type="text"
                  value={settings.store_name_en || ""}
                  onChange={(e) => updateField("store_name_en", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Slogan
                </label>
                <input
                  type="text"
                  value={settings.slogan || ""}
                  onChange={(e) => updateField("slogan", e.target.value)}
                  disabled={!isOwner}
                  placeholder="Chăm sóc xe máy chuyên nghiệp"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Địa chỉ
                </label>
                <input
                  type="text"
                  value={settings.address || ""}
                  onChange={(e) => updateField("address", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Số điện thoại
                </label>
                <input
                  type="tel"
                  value={settings.phone || ""}
                  onChange={(e) => updateField("phone", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Facebook
                </label>
                <input
                  type="text"
                  value={settings.email || ""}
                  onChange={(e) => updateField("email", e.target.value)}
                  disabled={!isOwner}
                  placeholder="Link Facebook hoặc Tên Fanpage"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={settings.website || ""}
                  onChange={(e) => updateField("website", e.target.value)}
                  disabled={!isOwner}
                  placeholder="https://..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã số thuế
                </label>
                <input
                  type="text"
                  value={settings.tax_code || ""}
                  onChange={(e) => updateField("tax_code", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Giờ mở cửa
                </label>
                <input
                  type="text"
                  value={settings.business_hours || ""}
                  onChange={(e) =>
                    updateField("business_hours", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="8:00 - 18:00 (T2-T7)"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Năm thành lập
                </label>
                <input
                  type="number"
                  value={settings.established_year || ""}
                  onChange={(e) =>
                    updateField("established_year", Number(e.target.value))
                  }
                  disabled={!isOwner}
                  placeholder="2020"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>
          </div>
        )}

        {/* Branding Tab */}
        {activeTab === "branding" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Thương hiệu & Hình ảnh
            </h2>

            {/* Logo Upload */}
            <div className="space-y-4">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Logo cửa hàng
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label
                      className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors ${isOwner
                        ? "cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                        }`}
                    >
                      <Upload className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                      <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                        {uploadingLogo ? "Đang tải lên..." : "Chọn ảnh logo"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                        disabled={!isOwner || uploadingLogo}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Kích thước tối đa: 2MB. Định dạng: JPG, PNG, SVG
                    </p>
                  </div>
                  {settings.logo_url && (
                    <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center">
                      <img
                        src={settings.logo_url}
                        alt="Store Logo"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Hoặc nhập URL Logo
                </label>
                <input
                  type="url"
                  value={settings.logo_url || ""}
                  onChange={(e) => updateField("logo_url", e.target.value)}
                  disabled={!isOwner}
                  placeholder="https://..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            {/* QR Code Upload */}
            <div className="space-y-4 pt-4 md:pt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã QR ngân hàng
                </label>
                <div className="flex items-start gap-4">
                  <div className="flex-1">
                    <label
                      className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors ${isOwner
                        ? "cursor-pointer"
                        : "opacity-50 cursor-not-allowed"
                        }`}
                    >
                      <ImageIcon className="w-4 h-4 md:w-5 md:h-5 text-slate-500" />
                      <span className="text-xs md:text-sm text-slate-600 dark:text-slate-400">
                        {uploadingQR ? "Đang tải lên..." : "Chọn ảnh QR Code"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleQRUpload}
                        disabled={!isOwner || uploadingQR}
                        className="hidden"
                      />
                    </label>
                    <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                      Kích thước tối đa: 2MB. Định dạng: JPG, PNG
                    </p>
                  </div>
                  {settings.bank_qr_url && (
                    <div className="w-24 h-24 md:w-32 md:h-32 border-2 border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden bg-white dark:bg-slate-700 flex items-center justify-center">
                      <img
                        src={settings.bank_qr_url}
                        alt="Bank QR Code"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Hoặc nhập URL mã QR
                </label>
                <input
                  type="url"
                  value={settings.bank_qr_url || ""}
                  onChange={(e) => updateField("bank_qr_url", e.target.value)}
                  disabled={!isOwner}
                  placeholder="https://..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            {/* Color Theme */}
            <div className="pt-4 md:pt-6 border-t border-slate-200 dark:border-slate-700">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Màu chủ đạo
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={settings.primary_color || "#3B82F6"}
                    onChange={(e) =>
                      updateField("primary_color", e.target.value)
                    }
                    disabled={!isOwner}
                    className="w-12 h-10 md:w-16 md:h-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer disabled:opacity-50"
                  />
                  <input
                    type="text"
                    value={settings.primary_color || "#3B82F6"}
                    onChange={(e) =>
                      updateField("primary_color", e.target.value)
                    }
                    disabled={!isOwner}
                    placeholder="#3B82F6"
                    className="flex-1 px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                  />
                </div>
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Màu này sẽ được sử dụng trong giao diện hệ thống
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Banking Tab */}
        {activeTab === "banking" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Thông tin ngân hàng
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Tên ngân hàng *
                </label>
                <input
                  type="text"
                  value={settings.bank_name || ""}
                  onChange={(e) => updateField("bank_name", e.target.value)}
                  disabled={!isOwner}
                  placeholder="VD: Vietcombank, Techcombank, MB Bank..."
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Số tài khoản *
                </label>
                <input
                  type="text"
                  value={settings.bank_account_number || ""}
                  onChange={(e) =>
                    updateField("bank_account_number", e.target.value)
                  }
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Chủ tài khoản *
                </label>
                <input
                  type="text"
                  value={settings.bank_account_holder || ""}
                  onChange={(e) =>
                    updateField("bank_account_holder", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="VD: NGUYEN VAN A"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Chi nhánh
                </label>
                <input
                  type="text"
                  value={settings.bank_branch || ""}
                  onChange={(e) => updateField("bank_branch", e.target.value)}
                  disabled={!isOwner}
                  placeholder="VD: Chi nhánh Quận 1, TP.HCM"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3 md:p-4">
              <div className="flex gap-2 md:gap-3">
                <Info className="w-4 h-4 md:w-5 md:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                <div className="text-xs md:text-sm text-blue-800 dark:text-blue-300">
                  <p className="font-medium mb-1">Thông tin ngân hàng</p>
                  <p>
                    Thông tin này sẽ được hiển thị trên các hóa đơn, biên nhận
                    và phiếu dịch vụ. Khách hàng có thể quét mã QR hoặc chuyển
                    khoản theo thông tin này.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Invoice Tab */}
        {activeTab === "invoice" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Cấu hình hóa đơn
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã hóa đơn bán
                </label>
                <input
                  type="text"
                  value={settings.invoice_prefix || "HD"}
                  onChange={(e) =>
                    updateField("invoice_prefix", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="HD"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  VD: HD-001, HD-002
                </p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã phiếu nhập
                </label>
                <input
                  type="text"
                  value={settings.receipt_prefix || "PN"}
                  onChange={(e) =>
                    updateField("receipt_prefix", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="PN"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  VD: PN-001, PN-002
                </p>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Mã phiếu sửa chữa
                </label>
                <input
                  type="text"
                  value={settings.work_order_prefix || "SC"}
                  onChange={(e) =>
                    updateField("work_order_prefix", e.target.value)
                  }
                  disabled={!isOwner}
                  placeholder="SC"
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400 mt-1">
                  VD: SC-001, SC-002
                </p>
              </div>
            </div>

            <div>
              <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                Ghi chú cuối hóa đơn
              </label>
              <textarea
                rows={3}
                value={settings.invoice_footer_note || ""}
                onChange={(e) =>
                  updateField("invoice_footer_note", e.target.value)
                }
                disabled={!isOwner}
                placeholder="Cảm ơn quý khách đã tin tưởng và sử dụng dịch vụ!"
                className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Định dạng ngày
                </label>
                <select
                  value={settings.date_format || "DD/MM/YYYY"}
                  onChange={(e) => updateField("date_format", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                  <option value="MM/DD/YYYY">MM/DD/YYYY</option>
                  <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Đơn vị tiền tệ
                </label>
                <select
                  value={settings.currency || "VND"}
                  onChange={(e) => updateField("currency", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="VND">VND - Việt Nam Đồng</option>
                  <option value="USD">USD - Đô la Mỹ</option>
                </select>
              </div>

              <div>
                <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5 md:mb-2">
                  Múi giờ
                </label>
                <select
                  value={settings.timezone || "Asia/Ho_Chi_Minh"}
                  onChange={(e) => updateField("timezone", e.target.value)}
                  disabled={!isOwner}
                  className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                >
                  <option value="Asia/Ho_Chi_Minh">Hồ Chí Minh (GMT+7)</option>
                  <option value="Asia/Bangkok">Bangkok (GMT+7)</option>
                  <option value="Asia/Singapore">Singapore (GMT+8)</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === "security" && (
          <div className="space-y-4 md:space-y-6">
            <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
              Bảo mật tài khoản
            </h2>

            {isOwner ? (
              <div className="space-y-6">
                {/* 2FA Section */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 md:p-6">
                  <div className="flex items-start gap-3 md:gap-4 mb-4">
                    <div className="p-2 md:p-3 bg-blue-100 dark:bg-blue-900/40 rounded-lg">
                      <Shield className="w-5 h-5 md:w-6 md:h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">
                        Xác thực 2 bước (2FA)
                      </h3>
                      <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
                        Bảo vệ tài khoản của bạn bằng một lớp bảo mật bổ sung.
                        Sau khi bật, bạn sẽ cần nhập mã từ ứng dụng
                        Authenticator mỗi khi đăng nhập.
                      </p>
                    </div>
                  </div>

                  {/* MFA Setup Component */}
                  <MFASetup />
                </div>

                {/* Security Tips */}
                <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 md:p-6">
                  <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-3">
                    Mẹo bảo mật
                  </h3>
                  <ul className="space-y-2 text-xs md:text-sm text-slate-600 dark:text-slate-400">
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Sử dụng mật khẩu mạnh với ít nhất 8 ký tự, bao gồm chữ
                      hoa, chữ thường và số
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Bật xác thực 2 bước (2FA) để bảo vệ tài khoản
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Không chia sẻ mật khẩu hoặc mã xác thực với bất kỳ ai
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Đăng xuất khi sử dụng máy tính công cộng
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-green-500 mt-0.5">✓</span>
                      Thường xuyên kiểm tra nhật ký hoạt động của tài khoản
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-start gap-3">
                <Info className="w-5 h-5 text-yellow-700 dark:text-yellow-300 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800 dark:text-yellow-200">
                  <p className="font-medium mb-1">Quyền hạn chế</p>
                  <p>
                    Chỉ chủ cửa hàng (Owner) mới có thể thiết lập xác thực 2
                    bước. Liên hệ chủ cửa hàng để được hỗ trợ.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Staff Management Tab */}
        {activeTab === "staff" && isOwner && (
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white">
                  Quản lý nhân viên
                </h2>
                <p className="text-xs md:text-sm text-slate-600 dark:text-slate-400 mt-1">
                  Thêm, sửa quyền và quản lý tài khoản nhân viên
                </p>
              </div>
              <button
                onClick={() => setShowAddStaff(true)}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                Thêm nhân viên
              </button>
            </div>

            {/* Add Staff Form */}
            {showAddStaff && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4 md:p-6">
                <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-green-600" />
                  Thêm nhân viên mới
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Email *
                    </label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="email"
                        value={newStaffEmail}
                        onChange={(e) => setNewStaffEmail(e.target.value)}
                        placeholder="email@example.com"
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Họ tên
                    </label>
                    <input
                      type="text"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                      placeholder="Nguyễn Văn A"
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Vai trò
                    </label>
                    <select
                      value={newStaffRole}
                      onChange={(e) =>
                        setNewStaffRole(e.target.value as "manager" | "staff")
                      }
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      <option value="staff">Nhân viên</option>
                      <option value="manager">Quản lý</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Chi nhánh
                    </label>
                    <div className="relative">
                      <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <select
                        value={newStaffBranch}
                        onChange={(e) => setNewStaffBranch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      >
                        {branches.map((branch) => (
                          <option key={branch.id} value={branch.id}>
                            {branch.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 mt-4">
                  <button
                    onClick={() => {
                      setShowAddStaff(false);
                      resetNewStaffForm();
                    }}
                    className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleInviteStaff}
                    disabled={savingStaff || !newStaffEmail.trim()}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium inline-flex items-center gap-2"
                  >
                    {savingStaff ? "Đang xử lý..." : "Mời nhân viên"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  💡 Nhân viên sẽ nhận email mời và tự đăng ký tài khoản. Sau đó
                  bạn có thể cập nhật quyền tại đây.
                </p>
              </div>
            )}

            {/* Staff List */}
            {loadingStaff ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : staffList.length === 0 ? (
              <div className="text-center py-12 text-slate-500 dark:text-slate-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Chưa có nhân viên nào</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                        Nhân viên
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                        Vai trò
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                        Chi nhánh
                      </th>
                      <th className="text-right py-3 px-4 text-xs md:text-sm font-semibold text-slate-600 dark:text-slate-400">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffList.map((staff) => (
                      <tr
                        key={staff.id}
                        className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-600 flex items-center justify-center text-sm font-medium text-slate-600 dark:text-slate-300">
                              {(staff.name ||
                                staff.email)?.[0]?.toUpperCase() || "?"}
                            </div>
                            <span className="text-sm font-medium text-slate-900 dark:text-white">
                              {staff.name || "Chưa đặt tên"}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-sm text-slate-600 dark:text-slate-400">
                          {staff.email}
                        </td>
                        <td className="py-3 px-4">
                          {editingStaff?.id === staff.id ? (
                            <select
                              value={editingStaff.role}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  role: e.target.value as
                                    | "owner"
                                    | "manager"
                                    | "staff",
                                })
                              }
                              className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                              <option value="staff">Nhân viên</option>
                              <option value="manager">Quản lý</option>
                              {staff.role === "owner" && (
                                <option value="owner">Chủ cửa hàng</option>
                              )}
                            </select>
                          ) : (
                            <span
                              className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getRoleBadgeColor(
                                staff.role
                              )}`}
                            >
                              {getRoleLabel(staff.role)}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {editingStaff?.id === staff.id ? (
                            <select
                              value={editingStaff.branch_id || ""}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  branch_id: e.target.value,
                                })
                              }
                              className="px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                              {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-600 dark:text-slate-400">
                              {branches.find((b) => b.id === staff.branch_id)
                                ?.name ||
                                staff.branch_id ||
                                "-"}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {editingStaff?.id === staff.id ? (
                              <>
                                <button
                                  onClick={() =>
                                    handleUpdateStaffRole(
                                      staff.id,
                                      editingStaff.role,
                                      editingStaff.branch_id
                                    )
                                  }
                                  disabled={savingStaff}
                                  className="p-1.5 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded"
                                  title="Lưu"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingStaff(null)}
                                  className="p-1.5 text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 rounded"
                                  title="Hủy"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {staff.role !== "owner" && (
                                  <button
                                    onClick={() =>
                                      setEditingStaff({ ...staff })
                                    }
                                    className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded"
                                    title="Sửa quyền"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Help Section */}
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 md:p-6">
              <h3 className="text-sm md:text-base font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-600" />
                Hướng dẫn phân quyền
              </h3>
              <div className="space-y-3 text-xs md:text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      "owner"
                    )}`}
                  >
                    Chủ cửa hàng
                  </span>
                  <span>
                    Toàn quyền: quản lý nhân viên, cài đặt, báo cáo, tài
                    chính...
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      "manager"
                    )}`}
                  >
                    Quản lý
                  </span>
                  <span>
                    Xem báo cáo, quản lý phiếu, kho, khách hàng. Không thể cài
                    đặt hệ thống.
                  </span>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      "staff"
                    )}`}
                  >
                    Nhân viên
                  </span>
                  <span>
                    Tạo/sửa phiếu sửa chữa, bán hàng. Chỉ xem dữ liệu chi nhánh
                    được gán.
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Save Button (Bottom) */}
      {isOwner && activeTab !== "staff" && (
        <div className="flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full sm:w-auto px-4 py-2 md:px-6 md:py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 text-white rounded-lg text-sm md:text-base font-semibold transition-colors inline-flex items-center justify-center gap-2"
            aria-label="Lưu tất cả thay đổi"
          >
            {saving ? (
              <span>Đang lưu...</span>
            ) : (
              <>
                <Save className="w-4 h-4 md:w-5 md:h-5" aria-hidden="true" />
                <span>Lưu tất cả thay đổi</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
