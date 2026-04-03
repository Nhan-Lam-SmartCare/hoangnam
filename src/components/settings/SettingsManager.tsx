import { useState, useEffect } from "react";
// Dùng supabaseClient thống nhất để tránh nhiều phiên GoTrue
import { supabase } from "../../supabaseClient";
import { useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import {
  getWorkerMonthlyLaborDetails,
  getWorkerMonthlySalary,
  type WorkerLaborDetailRow,
} from "../../lib/repository/repairLaborRepository";
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
  Search,
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
  facebook?: string;
}

interface StaffMember {
  id: string;
  email: string;
  name: string;
  role: "owner" | "manager" | "staff";
  branch_id: string;
  department?: string;
  position?: string;
  base_salary?: number;
  created_at: string;
}

interface Branch {
  id: string;
  name: string;
}

type StaffOverridesMap = Record<
  string,
  {
    department?: string;
    position?: string;
    base_salary?: number;
  }
>;

const STAFF_DEPARTMENTS = ["Kỹ thuật", "Bán hàng", "Quản lý"] as const;
const STAFF_OVERRIDES_STORAGE_KEY = "staff_overrides_v1";
const BRANCH_OVERRIDES_STORAGE_KEY = "branch_overrides_v1";

interface SettingsManagerProps {
  initialTab?: "general" | "branding" | "banking" | "invoice" | "security" | "staff";
  standaloneStaffPage?: boolean;
}

export const SettingsManager = ({
  initialTab = "general",
  standaloneStaffPage = false,
}: SettingsManagerProps = {}) => {
  const { profile, hasRole } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "branding" | "banking" | "invoice" | "security" | "staff"
  >(standaloneStaffPage ? "staff" : initialTab);

  // Staff management state
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadingStaff, setLoadingStaff] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [newBranchId, setNewBranchId] = useState("");
  const [newBranchName, setNewBranchName] = useState("");
  const [savingBranch, setSavingBranch] = useState(false);
  const [showAddStaff, setShowAddStaff] = useState(false);
  const [newStaffEmail, setNewStaffEmail] = useState("");
  const [newStaffName, setNewStaffName] = useState("");
  const [newStaffRole, setNewStaffRole] = useState<"manager" | "staff">(
    "staff"
  );
  const [newStaffBranch, setNewStaffBranch] = useState("");
  const [newStaffDepartment, setNewStaffDepartment] =
    useState<(typeof STAFF_DEPARTMENTS)[number]>("Kỹ thuật");
  const [newStaffPosition, setNewStaffPosition] = useState("");
  const [newStaffBaseSalary, setNewStaffBaseSalary] = useState("0");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [resettingStaff, setResettingStaff] = useState(false);
  const [resetTargetStaff, setResetTargetStaff] = useState<StaffMember | null>(
    null
  );
  const [resetStaffPassword, setResetStaffPassword] = useState("");
  const [savingStaff, setSavingStaff] = useState(false);
  const [staffSearch, setStaffSearch] = useState("");
  const [staffDepartmentFilter, setStaffDepartmentFilter] = useState("all");
  const [branchOverrides, setBranchOverrides] = useState<Branch[]>(() => {
    try {
      const raw = localStorage.getItem(BRANCH_OVERRIDES_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  });
  const [staffOverrides, setStaffOverrides] = useState<StaffOverridesMap>(() => {
    try {
      const raw = localStorage.getItem(STAFF_OVERRIDES_STORAGE_KEY);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [salaryMonth, setSalaryMonth] = useState(new Date().getMonth() + 1);
  const [salaryYear, setSalaryYear] = useState(new Date().getFullYear());
  const [staffSalaryRows, setStaffSalaryRows] = useState<any[]>([]);
  const [loadingSalaryRows, setLoadingSalaryRows] = useState(false);
  const [selectedSalaryWorker, setSelectedSalaryWorker] = useState<any | null>(null);
  const [salaryDetailRows, setSalaryDetailRows] = useState<WorkerLaborDetailRow[]>([]);
  const [loadingSalaryDetails, setLoadingSalaryDetails] = useState(false);
  const salaryRowsCacheRef = useRef<Record<string, any[]>>({});
  const missingStoreSettingsColumnsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STAFF_OVERRIDES_STORAGE_KEY,
        JSON.stringify(staffOverrides || {})
      );
    } catch {
      // Ignore storage write errors
    }
  }, [staffOverrides]);

  useEffect(() => {
    try {
      localStorage.setItem(
        BRANCH_OVERRIDES_STORAGE_KEY,
        JSON.stringify(branchOverrides || [])
      );
    } catch {
      // Ignore storage write errors
    }
  }, [branchOverrides]);

  const mergeBranches = (...branchLists: Branch[][]) => {
    const merged = new Map<string, Branch>();
    branchLists.flat().forEach((branch) => {
      const id = String(branch?.id || "").trim();
      if (!id) return;
      merged.set(id, {
        id,
        name: String(branch?.name || id).trim() || id,
      });
    });

    return Array.from(merged.values()).sort((a, b) =>
      a.name.localeCompare(b.name, "vi", { sensitivity: "base" })
    );
  };

  const normalizeBranchId = (value: string) => {
    const cleaned = String(value || "").trim().toUpperCase();
    const firstNumber = cleaned.match(/\d+/)?.[0];

    if (!firstNumber) return "";

    const index = Number.parseInt(firstNumber, 10);
    if (!Number.isFinite(index) || index <= 0) return "";

    return `CN${index}`;
  };

  // Load staff when tab changes to staff
  useEffect(() => {
    if (activeTab === "staff" && hasRole(["owner"])) {
      loadStaff();
      loadBranches();
    }
  }, [activeTab]);

  async function refreshStaffScreen() {
    await Promise.allSettled([loadStaff(), loadBranches()]);
  }

  const loadBranches = async () => {
    try {
      // Try to get branches from database first
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");

      if (!error && data && data.length > 0) {
        const mergedBranches = mergeBranches(data as Branch[], branchOverrides);
        setBranches(mergedBranches);
        if (!newStaffBranch) {
          setNewStaffBranch((mergedBranches[0] || data[0]).id);
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
          const mergedBranches = mergeBranches(branchList, branchOverrides);
          setBranches(mergedBranches);
          if (!newStaffBranch) {
            setNewStaffBranch((mergedBranches[0] || branchList[0]).id);
          }
        } else {
          // Default branch if nothing found
          const mergedBranches = mergeBranches(
            [{ id: "CN1", name: "Chi nhánh 1" }],
            branchOverrides
          );
          setBranches(mergedBranches);
          if (!newStaffBranch) {
            setNewStaffBranch((mergedBranches[0] || { id: "CN1" }).id);
          }
        }
      }
    } catch (error) {
      console.error("Error loading branches:", error);
      // Set default branch on error
      const mergedBranches = mergeBranches(
        [{ id: "CN1", name: "Chi nhánh 1" }],
        branchOverrides
      );
      setBranches(mergedBranches);
      setNewStaffBranch((mergedBranches[0] || { id: "CN1" }).id);
    }
  };

  const handleAddBranch = async () => {
    const branchId = normalizeBranchId(newBranchId || "");
    const branchName = String(newBranchName || "").trim();

    if (!branchId) {
      showToast.error("Mã chi nhánh phải có số và sẽ được chuẩn hóa dạng CN1, CN2, CN3...");
      return;
    }

    if (!branchName) {
      showToast.error("Vui lòng nhập tên chi nhánh");
      return;
    }

    if (branches.some((b) => normalizeBranchId(b.id) === branchId)) {
      showToast.error("Mã chi nhánh đã tồn tại");
      return;
    }

    const newBranch: Branch = { id: branchId, name: branchName };
    setSavingBranch(true);
    try {
      const { error } = await supabase.from("branches").insert(newBranch);

      if (error) {
        console.warn("Insert branch failed, using local fallback:", error.message);
      }

      setBranchOverrides((prev) => mergeBranches(prev, [newBranch]));
      setBranches((prev) => mergeBranches(prev, [newBranch]));
      setNewStaffBranch(branchId);
      setNewBranchId("");
      setNewBranchName("");

      showToast.success(
        error
          ? "Đã thêm chi nhánh trên giao diện (local fallback)."
          : "Đã thêm chi nhánh mới thành công"
      );

      await refreshStaffScreen();
    } catch (error: any) {
      console.error("Error adding branch:", error);
      showToast.error(error.message || "Không thể thêm chi nhánh");
    } finally {
      setSavingBranch(false);
    }
  };

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const employeeMap = new Map(
        [] as Array<
          [
            string,
            {
              department: string;
              position: string;
              base_salary: number;
            }
          ]
        >
      );

      const employeeSelectCandidates = [
        "id, department, position, base_salary",
        "id, position, base_salary",
        "id, department, base_salary",
        "id, position",
        "id, base_salary",
        "id",
      ];

      let employeeQueryError: any = null;
      for (const selectColumns of employeeSelectCandidates) {
        const { data: employeesData, error } = await supabase
          .from("employees")
          .select(selectColumns);

        if (!error && employeesData) {
          (employeesData as any[]).forEach((employee) => {
            if (!employee?.id) return;
            employeeMap.set(employee.id, {
              department: employee.department || "",
              position: employee.position || "",
              base_salary: Number(employee.base_salary || 0),
            });
          });
          employeeQueryError = null;
          break;
        }

        employeeQueryError = error;
      }

      if (employeeQueryError) {
        console.warn("Could not read optional employees columns:", employeeQueryError.message);
      }

      // Try RPC function first (bypasses RLS)
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_all_users_for_owner"
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        setStaffList(
          (rpcData as StaffMember[]).map((staff) => ({
            ...staff,
            department:
              employeeMap.get(staff.id)?.department ||
              staffOverrides[staff.id]?.department ||
              staff.department ||
              "",
            position:
              employeeMap.get(staff.id)?.position ||
              staffOverrides[staff.id]?.position ||
              staff.position ||
              "",
            base_salary:
              employeeMap.get(staff.id)?.base_salary ||
              Number(
                staffOverrides[staff.id]?.base_salary ?? (staff as any).base_salary ?? 0
              ),
          }))
        );
      } else {
        // Fallback: Try to get from profiles table
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, name, role, branch_id, created_at")
          .order("created_at", { ascending: false });

        if (!profilesError && profilesData && profilesData.length > 0) {
          setStaffList(
            (profilesData as StaffMember[]).map((staff) => ({
              ...staff,
              department:
                employeeMap.get(staff.id)?.department ||
                staffOverrides[staff.id]?.department ||
                (staff as any).department ||
                "",
              position:
                employeeMap.get(staff.id)?.position ||
                staffOverrides[staff.id]?.position ||
                (staff as any).position ||
                "",
              base_salary:
                employeeMap.get(staff.id)?.base_salary ||
                Number(
                  staffOverrides[staff.id]?.base_salary ?? (staff as any).base_salary ?? 0
                ),
            }))
          );
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
                department:
                  employeeMap.get(profile.id)?.department ||
                  staffOverrides[profile.id]?.department ||
                  (profile as any).department ||
                  "",
                position:
                  employeeMap.get(profile.id)?.position ||
                  staffOverrides[profile.id]?.position ||
                  (profile as any).position ||
                  "",
                base_salary:
                  employeeMap.get(profile.id)?.base_salary ||
                  Number(
                    staffOverrides[profile.id]?.base_salary ?? (profile as any).base_salary ?? 0
                  ),
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
            department: "",
            position: "",
            base_salary: 0,
            created_at: profile.created_at,
          },
        ]);
      }
    } finally {
      setLoadingStaff(false);
    }
  };

  const handleUpdateStaff = async () => {
    if (!editingStaff) return;

    if (!editingStaff.email.trim()) {
      showToast.error("Vui lòng nhập email nhân viên");
      return;
    }

    const normalizedDepartment =
      String(editingStaff.department || "Kỹ thuật").trim() || "Kỹ thuật";

    setSavingStaff(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
      }

      const response = await fetch("/api/staff/update", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: editingStaff.id,
          email: editingStaff.email.trim(),
          name: editingStaff.name.trim(),
          role: editingStaff.role,
          branch_id: editingStaff.branch_id,
          department: normalizedDepartment,
          position: editingStaff.position || "",
          base_salary: Number(editingStaff.base_salary || 0),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Không thể cập nhật nhân viên");
      }

      const updatedStaffFromApi = result?.user || {};
      const editedSnapshot = editingStaff;

      setStaffList((prev) =>
        prev.map((staff) =>
          staff.id === editedSnapshot.id
            ? {
                ...staff,
                email: updatedStaffFromApi.email || editedSnapshot.email || staff.email,
                name: updatedStaffFromApi.name || editedSnapshot.name || staff.name,
                role: updatedStaffFromApi.role || editedSnapshot.role || staff.role,
                branch_id:
                  updatedStaffFromApi.branch_id || editedSnapshot.branch_id || staff.branch_id,
                department:
                  updatedStaffFromApi.department || editedSnapshot.department || normalizedDepartment,
                position: updatedStaffFromApi.position || editedSnapshot.position || staff.position,
                base_salary: Number(
                  updatedStaffFromApi.base_salary ?? editedSnapshot.base_salary ?? staff.base_salary ?? 0
                ),
              }
            : staff
        )
      );

      setStaffOverrides((prev) => ({
        ...prev,
        [editedSnapshot.id]: {
          ...(prev[editedSnapshot.id] || {}),
          department:
            updatedStaffFromApi.department || editedSnapshot.department || normalizedDepartment,
          position: updatedStaffFromApi.position || editedSnapshot.position || "",
          base_salary: Number(
            updatedStaffFromApi.base_salary ?? editedSnapshot.base_salary ?? 0
          ),
        },
      }));

      showToast.success("Đã cập nhật thông tin nhân viên");
      setEditingStaff(null);
      await refreshStaffScreen();
    } catch (error: any) {
      console.error("Error updating staff:", error);
      showToast.error(error.message || "Không thể cập nhật nhân viên");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleDeleteStaff = async (staff: StaffMember) => {
    if (staff.role === "owner") {
      showToast.error("Không thể xóa tài khoản chủ cửa hàng");
      return;
    }

    const confirmed = window.confirm(
      `Xóa tài khoản nhân viên ${staff.name || staff.email}? Hành động này không thể hoàn tác.`
    );

    if (!confirmed) return;

    setSavingStaff(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
      }

      const response = await fetch("/api/staff/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ id: staff.id, email: staff.email }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Không thể xóa nhân viên");
      }

      showToast.success("Đã xóa tài khoản nhân viên");
      if (editingStaff?.id === staff.id) {
        setEditingStaff(null);
      }
      await refreshStaffScreen();
    } catch (error: any) {
      console.error("Error deleting staff:", error);
      showToast.error(error.message || "Không thể xóa nhân viên");
    } finally {
      setSavingStaff(false);
    }
  };

  const handleCreateStaffAccount = async () => {
    if (!newStaffEmail.trim()) {
      showToast.error("Vui lòng nhập email");
      return;
    }

    if (!newStaffPassword.trim()) {
      showToast.error("Vui lòng nhập mật khẩu tạm");
      return;
    }

    if (newStaffPassword.trim().length < 6) {
      showToast.error("Mật khẩu tạm phải từ 6 ký tự");
      return;
    }

    setSavingStaff(true);
    try {
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

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
      }

      const response = await fetch("/api/staff/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          email: newStaffEmail.trim(),
          name: newStaffName.trim(),
          role: newStaffRole,
          branch_id: newStaffBranch,
          password: newStaffPassword.trim(),
          department: newStaffDepartment,
          position: newStaffPosition.trim(),
          base_salary: Number(newStaffBaseSalary || 0),
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(result?.error || "Không thể tạo tài khoản nhân viên");
      }

      showToast.success(
        `Đã tạo tài khoản cho ${newStaffEmail}. Nhân viên có thể đăng nhập ngay bằng mật khẩu tạm.`
      );
      if (result?.user?.id) {
        setStaffOverrides((prev) => ({
          ...prev,
          [result.user.id]: {
            ...(prev[result.user.id] || {}),
            department: newStaffDepartment,
            position: newStaffPosition.trim(),
            base_salary: Number(newStaffBaseSalary || 0),
          },
        }));
      }
      setShowAddStaff(false);
      resetNewStaffForm();
      await refreshStaffScreen();
    } catch (error: any) {
      console.error("Error creating staff account:", error);
      showToast.error(error.message || "Không thể tạo tài khoản nhân viên");
    } finally {
      setSavingStaff(false);
    }
  };

  const generateTemporaryPassword = () => {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#";
    let generated = "";

    for (let i = 0; i < 10; i += 1) {
      generated += characters.charAt(Math.floor(Math.random() * characters.length));
    }

    return generated;
  };

  const openResetStaffDialog = (staff: StaffMember) => {
    if (staff.role === "owner") {
      showToast.error("Không thể đặt lại mật khẩu cho tài khoản chủ cửa hàng");
      return;
    }

    setResetTargetStaff(staff);
    setResetStaffPassword(generateTemporaryPassword());
  };

  const closeResetStaffDialog = () => {
    setResetTargetStaff(null);
    setResetStaffPassword("");
  };

  const handleResetStaffPassword = async () => {
    if (!resetTargetStaff) return;

    const password = resetStaffPassword.trim();
    if (password.length < 6) {
      showToast.error("Mật khẩu tạm phải từ 6 ký tự");
      return;
    }

    setResettingStaff(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại");
      }

      const response = await fetch("/api/staff/reset-password", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          id: resetTargetStaff.id,
          email: resetTargetStaff.email,
          password,
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Không thể đặt lại mật khẩu");
      }

      showToast.success(
        `Đã đặt lại mật khẩu tạm cho ${resetTargetStaff.name || resetTargetStaff.email}`
      );
      closeResetStaffDialog();
    } catch (error: any) {
      console.error("Error resetting staff password:", error);
      showToast.error(error.message || "Không thể đặt lại mật khẩu");
    } finally {
      setResettingStaff(false);
    }
  };

  const resetNewStaffForm = () => {
    setNewStaffEmail("");
    setNewStaffName("");
    setNewStaffRole("staff");
    setNewStaffBranch(branches[0]?.id || "");
    setNewStaffDepartment("Kỹ thuật");
    setNewStaffPosition("");
    setNewStaffBaseSalary("0");
    setNewStaffPassword("");
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

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(Number(value || 0));

  const formatDateTime = (value?: string) => {
    if (!value) return "--";
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return "--";
    return dt.toLocaleString("vi-VN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleOpenSalaryDetails = async (row: any) => {
    setSelectedSalaryWorker(row);
    setSalaryDetailRows([]);
    setLoadingSalaryDetails(true);
    try {
      const result = await getWorkerMonthlyLaborDetails(
        row.workerId,
        salaryMonth,
        salaryYear
      );
      if (!result.ok) {
        showToast.error(result.error?.message || "Không thể tải chi tiết công sửa");
        return;
      }
      setSalaryDetailRows(result.data || []);
    } finally {
      setLoadingSalaryDetails(false);
    }
  };

  const handleExportSalaryDetailsExcel = () => {
    if (!selectedSalaryWorker) return;

    const header = [
      "Thoi gian",
      "Ma phieu",
      "Khach hang",
      "Thiet bi",
      "Hang muc",
      "Nguon cong",
      "Tien cong",
    ];

    const rows = salaryDetailRows.map((detail) => [
      formatDateTime(detail.date),
      detail.workOrderId,
      detail.customerName || "Khach le",
      detail.vehicleModel || "",
      detail.serviceName || "Tien cong phieu",
      detail.type === "service_split" ? "Chia cong dich vu" : "Tien cong theo phieu",
      Number(detail.amount || 0),
    ]);

    const totalAmount = salaryDetailRows.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const sheetData = [
      ["Chi tiet cong sua"],
      [
        `Nhan vien: ${selectedSalaryWorker.workerName} - Ky: Thang ${salaryMonth}/${salaryYear}`,
      ],
      [],
      header,
      ...rows,
      [],
      ["Tong tien cong", "", "", "", "", "", totalAmount],
    ];

    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    ws["!cols"] = [
      { wch: 22 },
      { wch: 18 },
      { wch: 24 },
      { wch: 26 },
      { wch: 28 },
      { wch: 20 },
      { wch: 16 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Chi tiet cong");

    const safeName = String(selectedSalaryWorker.workerName || "NhanVien")
      .replace(/\s+/g, "_")
      .replace(/[^\w\-]/g, "");
    const fileName = `ChiTietCong_${safeName}_T${salaryMonth}_${salaryYear}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  const filteredStaffList = useMemo(() => {
    return staffList.filter((staff) => {
      const search = staffSearch.trim().toLowerCase();
      const matchesSearch =
        !search ||
        staff.name?.toLowerCase().includes(search) ||
        staff.email?.toLowerCase().includes(search) ||
        staff.position?.toLowerCase().includes(search) ||
        staff.department?.toLowerCase().includes(search) ||
        getRoleLabel(staff.role).toLowerCase().includes(search);

      const matchesDepartment =
        staffDepartmentFilter === "all" ||
        (staff.department || "Chưa phân loại") === staffDepartmentFilter;

      return matchesSearch && matchesDepartment;
    });
  }, [staffList, staffSearch, staffDepartmentFilter]);

  const salaryStaffIdsKey = useMemo(
    () => filteredStaffList.map((staff) => staff.id).sort().join("|"),
    [filteredStaffList]
  );

  useEffect(() => {
    let active = true;

    const loadSalaryRows = async () => {
      const salaryCacheKey = `${salaryYear}-${String(salaryMonth).padStart(2, "0")}::${salaryStaffIdsKey}`;

      if (activeTab !== "staff" || filteredStaffList.length === 0) {
        if (active) setStaffSalaryRows([]);
        return;
      }

      const cachedRows = salaryRowsCacheRef.current[salaryCacheKey];
      if (cachedRows && active) {
        setStaffSalaryRows(cachedRows);
      }

      if (!cachedRows) {
        setLoadingSalaryRows(true);
      }

      try {
        const rows = await Promise.all(
          filteredStaffList.map(async (staff) => {
            const salaryResult = await getWorkerMonthlySalary(
              staff.id,
              salaryMonth,
              salaryYear
            );

            if (!salaryResult.ok) {
              return {
                workerId: staff.id,
                workerName: staff.name || staff.email || "Chua dat ten",
                totalServiceCount: 0,
                totalWorkerAmount: 0,
                baseSalary: Number(staff.base_salary || 0),
                bonus: 0,
                penalty: 0,
                finalSalary: Number(staff.base_salary || 0),
              };
            }

            return salaryResult.data;
          })
        );

        if (active) {
          salaryRowsCacheRef.current[salaryCacheKey] = rows;
          setStaffSalaryRows(rows);
        }
      } finally {
        if (active) {
          setLoadingSalaryRows(false);
        }
      }
    };

    void loadSalaryRows();

    return () => {
      active = false;
    };
  }, [activeTab, filteredStaffList, salaryMonth, salaryYear, salaryStaffIdsKey]);

  const payrollSummaryByDepartment = STAFF_DEPARTMENTS.map((department) => {
    const staffInDepartment = filteredStaffList.filter(
      (staff) => (staff.department || "Chưa phân loại") === department
    );
    const totalBaseSalary = staffInDepartment.reduce(
      (sum, staff) => sum + Number(staff.base_salary || 0),
      0
    );

    return {
      department,
      count: staffInDepartment.length,
      totalBaseSalary,
    };
  });

  const totalBaseSalary = filteredStaffList.reduce(
    (sum, staff) => sum + Number(staff.base_salary || 0),
    0
  );

  const averageBaseSalary = filteredStaffList.length
    ? Math.round(totalBaseSalary / filteredStaffList.length)
    : 0;

  const payrollSeedRows = filteredStaffList.map((staff) => ({
    id: staff.id,
    name: staff.name || "Chưa đặt tên",
    department: staff.department || "Chưa phân loại",
    position: staff.position || "-",
    branchName:
      branches.find((branch) => branch.id === staff.branch_id)?.name ||
      staff.branch_id ||
      "-",
    baseSalary: Number(staff.base_salary || 0),
  }));

  const totalLaborAmountInMonth = useMemo(
    () =>
      staffSalaryRows.reduce(
        (sum, row) => sum + Number(row.totalWorkerAmount || 0),
        0
      ),
    [staffSalaryRows]
  );

  const activeDepartmentCount = new Set(
    staffList.map((staff) => staff.department).filter(Boolean)
  ).size;

  const loadSettings = async () => {
    try {
      // Always use canonical row id='default' to avoid reading a different stale row.
      const { data: defaultData, error: defaultError } = await supabase
        .from("store_settings")
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (defaultError) throw defaultError;

      // Fallback for legacy databases that may have a non-default id row.
      let data = defaultData;
      if (!data) {
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("store_settings")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (fallbackError) throw fallbackError;
        data = fallbackData;
      }

      if (data) {
        // Normalize camelCase columns (from DB) to snake_case (used by UI)
        const normalized: any = { ...data };
        if (!normalized.store_name && normalized.storeName) normalized.store_name = normalized.storeName;
        if (!normalized.address && normalized.storeAddress) normalized.address = normalized.storeAddress;
        if (!normalized.phone && normalized.storePhone) normalized.phone = normalized.storePhone;
        if (!normalized.email && normalized.storeEmail) normalized.email = normalized.storeEmail;
        if (!normalized.logo_url && normalized.logoUrl) normalized.logo_url = normalized.logoUrl;
        if (!normalized.bank_name && normalized.bankName) normalized.bank_name = normalized.bankName;
        if (!normalized.bank_account_number && normalized.bankAccount) normalized.bank_account_number = normalized.bankAccount;
        if (!normalized.bank_account_holder && normalized.bankAccountName) normalized.bank_account_holder = normalized.bankAccountName;
        if (!normalized.bank_qr_url && normalized.bankQrUrl) normalized.bank_qr_url = normalized.bankQrUrl;
        setSettings(normalized);
      } else {
        // No settings in database - use defaults silently
        setSettings({
          id: "default",
          store_name: "Cửa hàng",
        });
      }
    } catch (error) {
      console.warn("Could not load store settings, using defaults:", error);
      // Set default settings so the page doesn't get stuck on loading spinner
      setSettings({
        id: "default",
        store_name: "Cửa hàng",
      });
    } finally {
      setLoading(false);
    }
  };

  const normalizeSchemaKey = (value: string) =>
    value.toLowerCase().replace(/[_\-\s]/g, "");

  const extractMissingColumnFromError = (error: any): string | null => {
    const raw =
      error?.message ||
      error?.details ||
      error?.hint ||
      (typeof error === "string" ? error : "");
    if (!raw) return null;

    const match = String(raw).match(/Could not find the '([^']+)' column/i);
    return match?.[1] || null;
  };

  const stripMissingColumn = (
    payload: Record<string, any>,
    missingColumn: string
  ) => {
    const missingRaw = String(missingColumn || "").trim().toLowerCase();
    const nextPayload = { ...payload };

    // 1) Prefer exact key match (case-insensitive) so snake_case errors don't remove camelCase aliases.
    const exactKey = Object.keys(nextPayload).find(
      (key) => key.toLowerCase() === missingRaw
    );
    if (exactKey) {
      delete nextPayload[exactKey];
      return nextPayload;
    }

    // 2) Fallback: remove only one normalized match key instead of removing all aliases.
    const normalizedMissing = normalizeSchemaKey(missingColumn);
    const normalizedKey = Object.keys(nextPayload).find(
      (key) => normalizeSchemaKey(key) === normalizedMissing
    );
    if (normalizedKey) {
      delete nextPayload[normalizedKey];
    }

    return nextPayload;
  };

  const buildStoreSettingsPayload = (input: StoreSettings): Record<string, any> => {
    const base = Object.fromEntries(
      Object.entries(input).filter(([, value]) => value !== undefined)
    ) as Record<string, any>;

    const aliases: Array<[string, string]> = [
      ["store_name", "storeName"],
      ["address", "storeAddress"],
      ["phone", "storePhone"],
      ["email", "storeEmail"],
      ["logo_url", "logoUrl"],
      ["bank_name", "bankName"],
      ["bank_account_number", "bankAccount"],
      ["bank_account_holder", "bankAccountName"],
      ["bank_qr_url", "bankQrUrl"],
    ];

    aliases.forEach(([snakeKey, camelKey]) => {
      const snakeValue = base[snakeKey];

      // UI uses snake_case keys as source of truth. 
      // Forcefully sync the edited snake_case value into the legacy camelCase key,
      // so if snake_case is stripped due to schema mismatch, camelCase retains the latest user edit.
      if (snakeValue !== undefined) {
        base[camelKey] = snakeValue;
      }
    });

    return base;
  };

  const handleSave = async () => {
    if (!settings) return;

    setSaving(true);
    try {
      const previous = { ...settings };

      console.log("Saving settings:", settings);

      let payload = buildStoreSettingsPayload(settings);
      payload.id = "default";

      // Pre-strip columns known to be missing in current DB schema to avoid repeated retries.
      missingStoreSettingsColumnsRef.current.forEach((missingColumn) => {
        payload = stripMissingColumn(payload, missingColumn);
      });

      let attempts = 0;
      const maxAttempts = 30;
      let saveError: any = null;
      let saved = false;

      while (!saved && attempts < maxAttempts) {
        attempts += 1;

        const { error, data } = await supabase
          .from("store_settings")
          .upsert(payload, { onConflict: "id" })
          .select();

        if (!error) {
          console.log("Save result:", data);
          saved = true;
          saveError = null;
          break;
        }

        const missingColumn = extractMissingColumnFromError(error);
        if (!missingColumn) {
          saveError = error;
          break;
        }

        const nextPayload = stripMissingColumn(payload, missingColumn);
        if (Object.keys(nextPayload).length === Object.keys(payload).length) {
          saveError = error;
          break;
        }

        missingStoreSettingsColumnsRef.current.add(missingColumn);
        payload = nextPayload;
        console.info(
          `[Settings] Legacy schema missing '${missingColumn}', retrying with compatible payload.`
        );
      }

      if (!saved) {
        throw saveError || new Error("Không thể lưu cài đặt cửa hàng");
      }

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

  const resetFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.target.value = "";
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ""));
      reader.onerror = () =>
        reject(reader.error || new Error("KhÃ´ng thá»ƒ Ä‘á»c file áº£nh"));
      reader.readAsDataURL(file);
    });

  const uploadStoreAsset = async (
    file: File,
    prefix: "logo" | "bank-qr"
  ): Promise<{ url: string; mode: "storage" | "inline" }> => {
    const fileExt = file.name.split(".").pop();
    const fileName = `${prefix}-${Date.now()}.${fileExt}`;
    const filePath = `store-assets/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage
        .from("public-assets")
        .getPublicUrl(filePath);

      if (!data?.publicUrl) {
        throw new Error("KhÃ´ng láº¥y Ä‘Æ°á»£c URL cÃ´ng khai cá»§a áº£nh");
      }

      return { url: data.publicUrl, mode: "storage" };
    } catch (error) {
      console.warn(
        "[SettingsManager] Upload lÃªn storage tháº¥t báº¡i, chuyá»ƒn sang lÆ°u áº£nh trá»±c tiáº¿p trong cÃ i Ä‘áº·t:",
        error
      );

      const dataUrl = await readFileAsDataUrl(file);
      return { url: dataUrl, mode: "inline" };
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const selectedFile = file;

    const finishLogoUpload = async () => {
      setUploadingLogo(true);
      try {
        const result = await uploadStoreAsset(selectedFile, "logo");
        updateField("logo_url", result.url);
        showToast.success(
          result.mode === "storage"
            ? "ÄÃ£ táº£i logo lÃªn thÃ nh cÃ´ng!"
            : "ÄÃ£ gáº¯n logo vÃ o cÃ i Ä‘áº·t. Nhá»› báº¥m LÆ°u thay Ä‘á»•i."
        );
      } catch (error: any) {
        console.error("Error uploading logo:", error);
        showToast.error(error.message || "KhÃ´ng thá»ƒ táº£i logo lÃªn");
      } finally {
        setUploadingLogo(false);
        resetFileInput(e);
      }
    };

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

    return finishLogoUpload();
  };

  const handleQRUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const selectedFile = file;

    const finishQRUpload = async () => {
      setUploadingQR(true);
      try {
        const result = await uploadStoreAsset(selectedFile, "bank-qr");
        updateField("bank_qr_url", result.url);
        showToast.success(
          result.mode === "storage"
            ? "ÄÃ£ táº£i mÃ£ QR ngÃ¢n hÃ ng lÃªn thÃ nh cÃ´ng!"
            : "ÄÃ£ gáº¯n mÃ£ QR vÃ o cÃ i Ä‘áº·t. Nhá»› báº¥m LÆ°u thay Ä‘á»•i."
        );
      } catch (error: any) {
        console.error("Error uploading QR:", error);
        showToast.error(error.message || "KhÃ´ng thá»ƒ táº£i mÃ£ QR lÃªn");
      } finally {
        setUploadingQR(false);
        resetFileInput(e);
      }
    };

    if (!file.type.startsWith("image/")) {
      showToast.error("Vui lòng chọn file ảnh");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      showToast.error("Kích thước ảnh không được vượt quá 2MB");
      return;
    }

    return finishQRUpload();
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
    <div
      className={`${
        standaloneStaffPage ? "space-y-4 md:space-y-5" : "space-y-4 md:space-y-6"
      }`}
    >
      {/* Header */}
      {standaloneStaffPage ? (
        <div className="relative overflow-hidden rounded-[18px] border border-cyan-400/10 bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(17,24,39,0.94))] px-5 py-4 shadow-[0_12px_28px_rgba(2,6,23,0.28)]">
          <div className="absolute inset-y-0 right-0 w-1/2 bg-[radial-gradient(circle,_rgba(148,163,184,0.12),_transparent_55%)]" />
          <div className="relative flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <h1 className="text-xl font-semibold tracking-tight text-white md:text-2xl">
                Nhân viên
              </h1>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-[12px]">
              <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-slate-300">
                {staffList.length} nhân sự
              </span>
              <span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                {formatCurrency(totalBaseSalary)} đ lương cơ bản
              </span>
              <span className="rounded-full border border-blue-400/15 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                {activeDepartmentCount || 0} phòng ban
              </span>
            </div>
          </div>
        </div>
      ) : (
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
      )}

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
      {!standaloneStaffPage && <div>
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
      </div>}

      {/* Tab Content */}
      <div
        className={`${
          standaloneStaffPage
            ? "overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/45 p-4 md:p-4 shadow-[0_10px_24px_rgba(2,6,23,0.22)] backdrop-blur"
            : "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 md:p-6"
        }`}
      >
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
                  value={settings.facebook || ""}
                  onChange={(e) => updateField("facebook", e.target.value)}
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
                {isOwner && settings.logo_url && (
                  <button
                    type="button"
                    onClick={() => updateField("logo_url", "")}
                    className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md border border-red-300 text-red-600 hover:bg-red-50 dark:border-red-500/40 dark:text-red-300 dark:hover:bg-red-500/10 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    Xóa logo
                  </button>
                )}
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
          <div className="space-y-3 md:space-y-4">
            <div className="overflow-hidden rounded-[16px] border border-white/10 bg-slate-900/45">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                <h2 className="text-sm md:text-base font-semibold text-white">
                  Quản lý nhân viên
                </h2>
                <button
                  onClick={() => setShowAddStaff(true)}
                  className="w-full sm:w-auto px-3.5 py-2 rounded-lg bg-gradient-to-r from-emerald-500 to-green-500 hover:from-emerald-400 hover:to-green-400 text-white text-sm font-semibold inline-flex items-center justify-center gap-2"
                >
                  <UserPlus className="w-4 h-4" />
                  Thêm nhân viên
                </button>
              </div>

              <div className="px-4 py-3">
                <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
                  Thêm chi nhánh mới
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[120px_minmax(0,1fr)_auto] gap-2.5">
                  <input
                    type="text"
                    value={newBranchId}
                    onChange={(e) => setNewBranchId(e.target.value)}
                    onBlur={() => {
                      const normalized = normalizeBranchId(newBranchId);
                      if (normalized) {
                        setNewBranchId(normalized);
                      }
                    }}
                    placeholder="Mã CN (vd: CN2, 2, cn02)"
                    className="px-3 py-2 text-sm border border-white/10 rounded-lg bg-white/5 text-white placeholder:text-slate-500"
                  />
                  <input
                    type="text"
                    value={newBranchName}
                    onChange={(e) => setNewBranchName(e.target.value)}
                    placeholder="Tên chi nhánh (vd: Chi nhánh 2)"
                    className="px-3 py-2 text-sm border border-white/10 rounded-lg bg-white/5 text-white placeholder:text-slate-500"
                  />
                  <button
                    onClick={handleAddBranch}
                    disabled={savingBranch}
                    className="px-3.5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-500 text-white text-sm font-semibold"
                  >
                    {savingBranch ? "Đang thêm..." : "Thêm chi nhánh"}
                  </button>
                </div>
              </div>
            </div>

            {/* Add Staff Form */}
            {showAddStaff && (
              <div className="overflow-hidden rounded-[28px] border border-emerald-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.18),_transparent_30%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-5 md:p-6">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-emerald-300" />
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
                    <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">
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
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Phòng ban
                    </label>
                    <select
                      value={newStaffDepartment}
                      onChange={(e) =>
                        setNewStaffDepartment(
                          e.target.value as (typeof STAFF_DEPARTMENTS)[number]
                        )
                      }
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    >
                      {STAFF_DEPARTMENTS.map((department) => (
                        <option key={department} value={department}>
                          {department}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Chức vụ
                    </label>
                    <input
                      type="text"
                      value={newStaffPosition}
                      onChange={(e) => setNewStaffPosition(e.target.value)}
                      placeholder="Ví dụ: Kỹ thuật viên, Tư vấn bán hàng"
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Lương cơ bản
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={newStaffBaseSalary}
                      onChange={(e) => setNewStaffBaseSalary(e.target.value)}
                      placeholder="0"
                      className="w-full px-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                      Mật khẩu tạm *
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={newStaffPassword}
                        onChange={(e) => setNewStaffPassword(e.target.value)}
                        placeholder="Nhập mật khẩu tạm ít nhất 6 ký tự"
                        className="w-full pl-10 pr-4 py-2.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    onClick={() => {
                      setShowAddStaff(false);
                      resetNewStaffForm();
                    }}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  >
                    Hủy
                  </button>
                  <button
                    onClick={handleCreateStaffAccount}
                    disabled={
                      savingStaff ||
                      !newStaffEmail.trim() ||
                      !newStaffPassword.trim()
                    }
                    className="w-full sm:w-auto px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-400 text-white rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    {savingStaff ? "Đang xử lý..." : "Tạo tài khoản"}
                  </button>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-3">
                  Chủ shop có thể tạo sẵn tài khoản và gửi lại email cùng mật
                  khẩu tạm cho nhân viên đăng nhập.
                </p>
              </div>
            )}

            {resetTargetStaff && (
              <div className="overflow-hidden rounded-[28px] border border-amber-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(245,158,11,0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-5 md:p-6">
                <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-amber-300" />
                  Đặt lại mật khẩu nhân viên
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">
                      Nhân viên
                    </label>
                    <input
                      type="text"
                      value={resetTargetStaff.name || resetTargetStaff.email}
                      disabled
                      className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-lg bg-white/5 text-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">
                      Email
                    </label>
                    <input
                      type="text"
                      value={resetTargetStaff.email}
                      disabled
                      className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-lg bg-white/5 text-slate-300"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs md:text-sm font-medium text-slate-300 mb-1.5">
                      Mật khẩu tạm mới *
                    </label>
                    <div className="flex flex-col gap-2 sm:flex-row">
                      <input
                        type="text"
                        value={resetStaffPassword}
                        onChange={(e) => setResetStaffPassword(e.target.value)}
                        placeholder="Nhập mật khẩu tạm mới (>= 6 ký tự)"
                        className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-lg bg-white/5 text-white placeholder:text-slate-500"
                      />
                      <button
                        type="button"
                        onClick={() => setResetStaffPassword(generateTemporaryPassword())}
                        className="px-3.5 py-2 rounded-lg border border-amber-300/30 text-amber-200 hover:bg-amber-500/10 text-sm font-medium"
                      >
                        Tạo nhanh
                      </button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button
                    type="button"
                    onClick={closeResetStaffDialog}
                    disabled={resettingStaff}
                    className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-70"
                  >
                    Hủy
                  </button>
                  <button
                    type="button"
                    onClick={handleResetStaffPassword}
                    disabled={resettingStaff || resetStaffPassword.trim().length < 6}
                    className="w-full sm:w-auto px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:bg-slate-500 text-white rounded-lg text-sm font-medium inline-flex items-center justify-center gap-2"
                  >
                    {resettingStaff ? "Đang xử lý..." : "Xác nhận đặt lại"}
                  </button>
                </div>
                <p className="text-xs text-slate-400 mt-3">
                  Sau khi đặt lại, nhân viên đăng nhập bằng mật khẩu tạm mới và nên đổi lại mật khẩu riêng.
                </p>
              </div>
            )}

            {/* Staff List */}
            {loadingStaff ? (
              <div className="flex items-center justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                <div className="rounded-[16px] border border-white/10 bg-slate-900/55 p-3.5">
                  <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_220px] gap-3">
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">
                        Tìm kiếm nhân sự
                      </div>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={staffSearch}
                          onChange={(e) => setStaffSearch(e.target.value)}
                          placeholder="Tìm theo tên, email, chức vụ, vai trò..."
                          className="w-full pl-10 pr-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/5 text-white placeholder:text-slate-500"
                        />
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-1.5">
                        Lọc phòng ban
                      </div>
                      <select
                        value={staffDepartmentFilter}
                        onChange={(e) => setStaffDepartmentFilter(e.target.value)}
                        className="w-full px-4 py-2.5 text-sm border border-white/10 rounded-xl bg-white/5 text-white"
                      >
                        <option value="all">Tất cả phòng ban</option>
                        {STAFF_DEPARTMENTS.map((department) => (
                          <option key={department} value={department}>
                            {department}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                {filteredStaffList.length === 0 ? (
                  <div className="rounded-[18px] border border-dashed border-white/10 bg-slate-900/45 text-center py-12 text-slate-400">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Không tìm thấy nhân viên phù hợp</p>
                  </div>
                ) : (
                  <div className="overflow-hidden rounded-[18px] border border-white/10 bg-slate-900/55">
                <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
                  <h3 className="text-sm font-semibold text-white">
                    Danh sách nhân viên
                  </h3>
                  <div className="text-xs text-slate-400">
                    {filteredStaffList.length} người
                  </div>
                </div>
                <div className="hidden md:block overflow-x-auto">
                      <table className="w-full min-w-[920px]">
                        <thead>
                          <tr className="border-b border-white/10 bg-white/[0.02]">
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Nhân viên
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Email
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Vai trò
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Phòng ban
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Chức vụ
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Lương cơ bản
                      </th>
                      <th className="text-left py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Chi nhánh
                      </th>
                      <th className="text-right py-3 px-4 text-xs md:text-sm font-semibold text-slate-400">
                        Thao tác
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredStaffList.map((staff) => (
                      <tr
                        key={staff.id}
                        className="border-b border-white/5 hover:bg-white/[0.03]"
                      >
                              <td className="py-2.5 px-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-9 h-9 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center text-sm font-semibold text-white">
                              {(staff.name ||
                                staff.email)?.[0]?.toUpperCase() || "?"}
                            </div>
                            {editingStaff?.id === staff.id ? (
                              <input
                                type="text"
                                value={editingStaff.name}
                                onChange={(e) =>
                                  setEditingStaff({
                                    ...editingStaff,
                                    name: e.target.value,
                                  })
                                }
                                placeholder="Họ tên nhân viên"
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              />
                            ) : (
                              <span className="text-sm font-medium text-white">
                                {staff.name || "Chưa đặt tên"}
                              </span>
                            )}
                          </div>
                        </td>
                              <td className="py-2.5 px-4 text-sm text-slate-300">
                          {editingStaff?.id === staff.id ? (
                            <input
                              type="email"
                              value={editingStaff.email}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  email: e.target.value,
                                })
                              }
                              placeholder="email@example.com"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                          ) : (
                            staff.email
                          )}
                        </td>
                              <td className="py-2.5 px-4">
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
                              className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
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
                              <td className="py-2.5 px-4">
                          {editingStaff?.id === staff.id ? (
                            <select
                              value={editingStaff.department || "Kỹ thuật"}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  department: e.target.value,
                                })
                              }
                              className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                              {STAFF_DEPARTMENTS.map((department) => (
                                <option key={department} value={department}>
                                  {department}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-300">
                              {staff.department || "-"}
                            </span>
                          )}
                        </td>
                              <td className="py-2.5 px-4">
                          {editingStaff?.id === staff.id ? (
                            <input
                              type="text"
                              value={editingStaff.position || ""}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  position: e.target.value,
                                })
                              }
                              placeholder="Chức vụ"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                          ) : (
                            <span className="text-sm text-slate-300">
                              {staff.position || "-"}
                            </span>
                          )}
                        </td>
                              <td className="py-2.5 px-4">
                          {editingStaff?.id === staff.id ? (
                            <input
                              type="number"
                              min="0"
                              step="1000"
                              value={editingStaff.base_salary || 0}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  base_salary: Number(e.target.value || 0),
                                })
                              }
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                          ) : (
                            <span className="text-sm font-medium text-emerald-300">
                              {formatCurrency(Number(staff.base_salary || 0))} đ
                            </span>
                          )}
                        </td>
                              <td className="py-2.5 px-4">
                          {editingStaff?.id === staff.id ? (
                            <select
                              value={editingStaff.branch_id || ""}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  branch_id: e.target.value,
                                })
                              }
                              className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            >
                              {branches.map((branch) => (
                                <option key={branch.id} value={branch.id}>
                                  {branch.name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span className="text-sm text-slate-300">
                              {branches.find((b) => b.id === staff.branch_id)
                                ?.name ||
                                staff.branch_id ||
                                "-"}
                            </span>
                          )}
                        </td>
                              <td className="py-2.5 px-4">
                          <div className="flex items-center justify-end gap-2">
                            {editingStaff?.id === staff.id ? (
                              <>
                                <button
                                  onClick={handleUpdateStaff}
                                  disabled={savingStaff}
                                  className="p-2 text-emerald-300 hover:bg-emerald-500/10 rounded-xl"
                                  title="Lưu"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingStaff(null)}
                                  className="p-2 text-slate-300 hover:bg-white/5 rounded-xl"
                                  title="Hủy"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            ) : (
                              <>
                                {staff.role !== "owner" && (
                                  <button
                                    onClick={() => setEditingStaff({ ...staff })}
                                    className="p-2 text-blue-300 hover:bg-blue-500/10 rounded-xl"
                                    title="Sửa thông tin"
                                  >
                                    <Edit2 className="w-4 h-4" />
                                  </button>
                                )}
                                {staff.role !== "owner" && (
                                  <button
                                    onClick={() => openResetStaffDialog(staff)}
                                    disabled={savingStaff || resettingStaff}
                                    className="p-2 text-amber-300 hover:bg-amber-500/10 rounded-xl disabled:opacity-60"
                                    title="Đặt lại mật khẩu"
                                  >
                                    <Lock className="w-4 h-4" />
                                  </button>
                                )}
                                {staff.role !== "owner" && (
                                  <button
                                    onClick={() => handleDeleteStaff(staff)}
                                    disabled={savingStaff}
                                    className="p-2 text-red-300 hover:bg-red-500/10 rounded-xl"
                                    title="Xóa nhân viên"
                                  >
                                    <Trash2 className="w-4 h-4" />
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

                  <div className="space-y-3 p-3 md:hidden">
                    {filteredStaffList.map((staff) => (
                      <div
                        key={staff.id}
                        className="rounded-2xl border border-white/10 bg-slate-900/70 p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-9 h-9 rounded-xl border border-white/10 bg-gradient-to-br from-cyan-400/20 to-blue-500/20 flex items-center justify-center text-sm font-semibold text-white shrink-0">
                              {(staff.name || staff.email)?.[0]?.toUpperCase() || "?"}
                            </div>
                            <div className="min-w-0">
                              <div className="text-sm font-semibold text-white truncate">
                                {staff.name || "Chưa đặt tên"}
                              </div>
                              <div className="text-xs text-slate-400 truncate">{staff.email}</div>
                            </div>
                          </div>
                          <span
                            className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                              staff.role
                            )}`}
                          >
                            {getRoleLabel(staff.role)}
                          </span>
                        </div>

                        {editingStaff?.id === staff.id ? (
                          <div className="mt-3 grid grid-cols-1 gap-2">
                            <input
                              type="text"
                              value={editingStaff.name}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  name: e.target.value,
                                })
                              }
                              placeholder="Họ tên nhân viên"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                            <input
                              type="email"
                              value={editingStaff.email}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  email: e.target.value,
                                })
                              }
                              placeholder="email@example.com"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <select
                                value={editingStaff.role}
                                onChange={(e) =>
                                  setEditingStaff({
                                    ...editingStaff,
                                    role: e.target.value as "owner" | "manager" | "staff",
                                  })
                                }
                                className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              >
                                <option value="staff">Nhân viên</option>
                                <option value="manager">Quản lý</option>
                                {staff.role === "owner" && <option value="owner">Chủ cửa hàng</option>}
                              </select>
                              <select
                                value={editingStaff.department || "Kỹ thuật"}
                                onChange={(e) =>
                                  setEditingStaff({
                                    ...editingStaff,
                                    department: e.target.value,
                                  })
                                }
                                className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              >
                                {STAFF_DEPARTMENTS.map((department) => (
                                  <option key={department} value={department}>
                                    {department}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <input
                              type="text"
                              value={editingStaff.position || ""}
                              onChange={(e) =>
                                setEditingStaff({
                                  ...editingStaff,
                                  position: e.target.value,
                                })
                              }
                              placeholder="Chức vụ"
                              className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                            />
                            <div className="grid grid-cols-2 gap-2">
                              <input
                                type="number"
                                min="0"
                                step="1000"
                                value={editingStaff.base_salary || 0}
                                onChange={(e) =>
                                  setEditingStaff({
                                    ...editingStaff,
                                    base_salary: Number(e.target.value || 0),
                                  })
                                }
                                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              />
                              <select
                                value={editingStaff.branch_id || ""}
                                onChange={(e) =>
                                  setEditingStaff({
                                    ...editingStaff,
                                    branch_id: e.target.value,
                                  })
                                }
                                className="px-2 py-2 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                              >
                                {branches.map((branch) => (
                                  <option key={branch.id} value={branch.id}>
                                    {branch.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="mt-1 grid grid-cols-2 gap-2">
                              <button
                                onClick={handleUpdateStaff}
                                disabled={savingStaff}
                                className="px-3 py-2 rounded-lg bg-emerald-600/25 text-emerald-300 border border-emerald-400/30 text-xs font-semibold"
                              >
                                Lưu
                              </button>
                              <button
                                onClick={() => setEditingStaff(null)}
                                className="px-3 py-2 rounded-lg bg-slate-800 text-slate-300 border border-white/10 text-xs font-semibold"
                              >
                                Hủy
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="mt-3 space-y-1.5 text-xs text-slate-300">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Phòng ban</span>
                              <span>{staff.department || "-"}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Chức vụ</span>
                              <span>{staff.position || "-"}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Lương cơ bản</span>
                              <span className="font-semibold text-emerald-300">
                                {formatCurrency(Number(staff.base_salary || 0))} đ
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Chi nhánh</span>
                              <span>
                                {branches.find((b) => b.id === staff.branch_id)?.name ||
                                  staff.branch_id ||
                                  "-"}
                              </span>
                            </div>

                            {staff.role !== "owner" && (
                              <div className="pt-2 grid grid-cols-3 gap-2">
                                <button
                                  onClick={() => setEditingStaff({ ...staff })}
                                  className="px-3 py-2 rounded-lg bg-blue-600/20 text-blue-300 border border-blue-400/30 text-xs font-semibold"
                                >
                                  Sửa
                                </button>
                                <button
                                  onClick={() => openResetStaffDialog(staff)}
                                  disabled={resettingStaff || savingStaff}
                                  className="px-3 py-2 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-400/30 text-xs font-semibold disabled:opacity-70"
                                >
                                  Đặt MK
                                </button>
                                <button
                                  onClick={() => handleDeleteStaff(staff)}
                                  disabled={savingStaff}
                                  className="px-3 py-2 rounded-lg bg-red-600/20 text-red-300 border border-red-400/30 text-xs font-semibold"
                                >
                                  Xóa
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  </div>
                )}

                <div className="flex flex-col gap-4">
                <details className="order-2 rounded-[18px] border border-blue-400/15 bg-[radial-gradient(circle_at_top_right,_rgba(59,130,246,0.18),_transparent_28%),linear-gradient(145deg,rgba(15,23,42,0.95),rgba(30,41,59,0.82))] p-4">
                  <summary className="cursor-pointer list-none">
                    <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                      <h3 className="text-sm font-semibold text-white">
                        Dữ liệu bảng lương (tham chiếu)
                      </h3>
                      <div className="text-xs md:text-sm text-slate-400">
                        {payrollSeedRows.length} nhân viên trong phạm vi hiện tại
                      </div>
                    </div>
                  </summary>

                  <div className="hidden md:block mt-4 overflow-x-auto">
                    <table className="w-full min-w-[680px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">
                            Nhân viên
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">
                            Phòng ban
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">
                            Chức vụ
                          </th>
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">
                            Chi nhánh
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Lương cơ bản
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {payrollSeedRows.map((row) => (
                          <tr
                            key={row.id}
                            className="border-b border-white/5"
                          >
                            <td className="py-3 px-3 text-sm text-white">
                              {row.name}
                            </td>
                            <td className="py-3 px-3 text-sm text-slate-300">
                              {row.department}
                            </td>
                            <td className="py-3 px-3 text-sm text-slate-300">
                              {row.position}
                            </td>
                            <td className="py-3 px-3 text-sm text-slate-300">
                              {row.branchName}
                            </td>
                            <td className="py-3 px-3 text-sm text-right font-medium text-emerald-300">
                              {formatCurrency(row.baseSalary)} đ
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-2.5 md:hidden">
                    {payrollSeedRows.map((row) => (
                      <div
                        key={row.id}
                        className="rounded-xl border border-white/10 bg-slate-900/40 p-3"
                      >
                        <div className="text-sm font-semibold text-white">{row.name}</div>
                        <div className="mt-1 text-xs text-slate-400">{row.department} • {row.position}</div>
                        <div className="mt-1 text-xs text-slate-300">Chi nhánh: {row.branchName}</div>
                        <div className="mt-1 text-sm font-semibold text-emerald-300">
                          {formatCurrency(row.baseSalary)} đ
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                <div className="order-1 rounded-[18px] border border-emerald-400/15 bg-[radial-gradient(circle_at_top_right,_rgba(16,185,129,0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.95),rgba(22,101,52,0.3))] p-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-sm font-semibold text-white">
                          Công sửa / Lương
                        </h3>
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
                          Tổng công tháng: {formatCurrency(totalLaborAmountInMonth)} đ
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        Lương công thợ được cộng riêng từ tiền công sửa chữa.
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <select
                        value={salaryMonth}
                        onChange={(e) => setSalaryMonth(Number(e.target.value))}
                        className="px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                      >
                        {Array.from({ length: 12 }).map((_, index) => (
                          <option key={index + 1} value={index + 1}>
                            Tháng {index + 1}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={salaryYear}
                        onChange={(e) => setSalaryYear(Number(e.target.value || new Date().getFullYear()))}
                        className="w-28 px-3 py-2 rounded-lg bg-slate-900/60 border border-white/10 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="hidden md:block mt-4 overflow-x-auto">
                    {loadingSalaryRows && staffSalaryRows.length > 0 && (
                      <div className="mb-3 text-xs text-slate-400">
                        Đang cập nhật dữ liệu lương công sửa...
                      </div>
                    )}
                    <table className="w-full min-w-[860px]">
                      <thead>
                        <tr className="border-b border-white/10">
                          <th className="text-left py-3 px-3 text-xs font-semibold text-slate-400">
                            Nhân viên
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Số công việc
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Tiền công được hưởng
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Lương cơ bản
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Thưởng
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Phạt
                          </th>
                          <th className="text-right py-3 px-3 text-xs font-semibold text-slate-400">
                            Lương tạm tính
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {loadingSalaryRows && (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                              Đang tính lương công sửa...
                            </td>
                          </tr>
                        )}
                        {!loadingSalaryRows &&
                          staffSalaryRows.map((row) => (
                            <tr key={row.workerId} className="border-b border-white/5">
                              <td className="py-3 px-3 text-sm text-white">
                                <button
                                  type="button"
                                  onClick={() => handleOpenSalaryDetails(row)}
                                  className="text-left text-cyan-300 hover:text-cyan-200 underline-offset-2 hover:underline"
                                >
                                  {row.workerName}
                                </button>
                              </td>
                              <td className="py-3 px-3 text-sm text-right text-slate-300">
                                {row.totalServiceCount}
                              </td>
                              <td className="py-3 px-3 text-sm text-right font-medium text-emerald-300">
                                {formatCurrency(Number(row.totalWorkerAmount || 0))} đ
                              </td>
                              <td className="py-3 px-3 text-sm text-right text-slate-300">
                                {formatCurrency(Number(row.baseSalary || 0))} đ
                              </td>
                              <td className="py-3 px-3 text-sm text-right text-slate-300">
                                {formatCurrency(Number(row.bonus || 0))} đ
                              </td>
                              <td className="py-3 px-3 text-sm text-right text-slate-300">
                                {formatCurrency(Number(row.penalty || 0))} đ
                              </td>
                              <td className="py-3 px-3 text-sm text-right font-semibold text-cyan-300">
                                {formatCurrency(Number(row.finalSalary || 0))} đ
                              </td>
                            </tr>
                          ))}
                        {!loadingSalaryRows && staffSalaryRows.length === 0 && (
                          <tr>
                            <td colSpan={7} className="py-6 text-center text-sm text-slate-400">
                              Chưa có dữ liệu công sửa trong kỳ đã chọn.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="mt-4 space-y-2.5 md:hidden">
                    {loadingSalaryRows && (
                      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-xs text-slate-400">
                        Đang tính lương công sửa...
                      </div>
                    )}
                    {!loadingSalaryRows &&
                      staffSalaryRows.map((row) => (
                        <div
                          key={row.workerId}
                          className="rounded-xl border border-white/10 bg-slate-900/40 p-3"
                        >
                          <button
                            type="button"
                            onClick={() => handleOpenSalaryDetails(row)}
                            className="text-sm font-semibold text-cyan-300 hover:text-cyan-200"
                          >
                            {row.workerName}
                          </button>
                          <div className="mt-2 space-y-1.5 text-xs text-slate-300">
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Số công việc</span>
                              <span>{row.totalServiceCount}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Tiền công được hưởng</span>
                              <span className="font-semibold text-emerald-300">
                                {formatCurrency(Number(row.totalWorkerAmount || 0))} đ
                              </span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Lương cơ bản</span>
                              <span>{formatCurrency(Number(row.baseSalary || 0))} đ</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Thưởng</span>
                              <span>{formatCurrency(Number(row.bonus || 0))} đ</span>
                            </div>
                            <div className="flex justify-between gap-2">
                              <span className="text-slate-400">Phạt</span>
                              <span>{formatCurrency(Number(row.penalty || 0))} đ</span>
                            </div>
                            <div className="pt-1 flex justify-between gap-2 text-sm">
                              <span className="text-slate-200">Lương tạm tính</span>
                              <span className="font-semibold text-cyan-300">
                                {formatCurrency(Number(row.finalSalary || 0))} đ
                              </span>
                            </div>
                          </div>
                        </div>
                      ))}
                    {!loadingSalaryRows && staffSalaryRows.length === 0 && (
                      <div className="rounded-xl border border-white/10 bg-slate-900/40 p-3 text-center text-xs text-slate-400">
                        Chưa có dữ liệu công sửa trong kỳ đã chọn.
                      </div>
                    )}
                  </div>

                  {selectedSalaryWorker && (
                    <div className="fixed inset-0 z-[80] bg-black/60 flex items-center justify-center p-4">
                      <div className="w-full max-w-5xl max-h-[85vh] overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
                        <div className="px-4 py-4 border-b border-slate-700 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                          <div>
                            <h3 className="text-base font-semibold text-white">
                              Chi tiết công sửa - {selectedSalaryWorker.workerName}
                            </h3>
                            <p className="text-xs text-slate-400 mt-1">
                              Kỳ lương: Tháng {salaryMonth}/{salaryYear}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 self-end sm:self-auto">
                            <button
                              type="button"
                              onClick={handleExportSalaryDetailsExcel}
                              className="px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium"
                            >
                              Xuất Excel
                            </button>
                            <button
                              type="button"
                              onClick={() => setSelectedSalaryWorker(null)}
                              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300"
                              aria-label="Đóng"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        <div className="p-4 overflow-auto max-h-[calc(85vh-74px)]">
                          {loadingSalaryDetails ? (
                            <div className="py-8 text-center text-sm text-slate-400">
                              Đang tải chi tiết công sửa...
                            </div>
                          ) : (
                            <>
                              <table className="hidden md:table w-full min-w-[920px]">
                                <thead>
                                  <tr className="border-b border-slate-700 text-xs text-slate-400">
                                    <th className="text-left py-2 px-2">Thời gian</th>
                                    <th className="text-left py-2 px-2">Mã phiếu</th>
                                    <th className="text-left py-2 px-2">Khách hàng / Thiết bị</th>
                                    <th className="text-left py-2 px-2">Hạng mục</th>
                                    <th className="text-left py-2 px-2">Nguồn công</th>
                                    <th className="text-right py-2 px-2">Tiền công</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {salaryDetailRows.map((detail, index) => (
                                    <tr key={`${detail.workOrderId}-${index}`} className="border-b border-slate-800">
                                      <td className="py-2 px-2 text-sm text-slate-200">
                                        {formatDateTime(detail.date)}
                                      </td>
                                      <td className="py-2 px-2 text-sm text-cyan-300 font-mono">
                                        {detail.workOrderId}
                                      </td>
                                      <td className="py-2 px-2 text-sm text-slate-200">
                                        <div>{detail.customerName || "Khách lẻ"}</div>
                                        <div className="text-xs text-slate-400">{detail.vehicleModel || "--"}</div>
                                      </td>
                                      <td className="py-2 px-2 text-sm text-slate-200">
                                        {detail.serviceName || "Tiền công phiếu"}
                                      </td>
                                      <td className="py-2 px-2 text-sm text-slate-300">
                                        {detail.type === "service_split" ? "Chia công dịch vụ" : "Tiền công theo phiếu"}
                                      </td>
                                      <td className="py-2 px-2 text-sm text-right font-semibold text-emerald-300">
                                        {formatCurrency(detail.amount)} đ
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>

                              <div className="space-y-2.5 md:hidden">
                                {salaryDetailRows.map((detail, index) => (
                                  <div
                                    key={`${detail.workOrderId}-${index}`}
                                    className="rounded-xl border border-slate-700 bg-slate-800/60 p-3"
                                  >
                                    <div className="flex items-start justify-between gap-2">
                                      <div className="text-xs text-slate-400">
                                        {formatDateTime(detail.date)}
                                      </div>
                                      <div className="text-xs font-mono text-cyan-300">
                                        {detail.workOrderId}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-sm text-slate-100">
                                      {detail.customerName || "Khách lẻ"}
                                    </div>
                                    <div className="text-xs text-slate-400">
                                      {detail.vehicleModel || "--"}
                                    </div>
                                    <div className="mt-2 text-xs text-slate-300">
                                      Hạng mục: {detail.serviceName || "Tiền công phiếu"}
                                    </div>
                                    <div className="text-xs text-slate-300">
                                      Nguồn: {detail.type === "service_split" ? "Chia công dịch vụ" : "Tiền công theo phiếu"}
                                    </div>
                                    <div className="mt-2 text-sm font-semibold text-emerald-300">
                                      {formatCurrency(detail.amount)} đ
                                    </div>
                                  </div>
                                ))}
                              </div>

                              {salaryDetailRows.length === 0 && (
                                <div className="py-8 text-center text-sm text-slate-400">
                                  Không có dòng công nào trong kỳ này.
                                </div>
                              )}

                              {salaryDetailRows.length > 0 && (
                                <div className="mt-4 flex justify-end">
                                  <div className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-2 text-sm text-slate-200">
                                    Tổng tiền công: <span className="font-semibold text-emerald-300">{formatCurrency(salaryDetailRows.reduce((sum, item) => sum + Number(item.amount || 0), 0))} đ</span>
                                  </div>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
                </div>
              </>
            )}

            {/* Help Section */}
            <details className="rounded-[18px] border border-blue-400/15 bg-[linear-gradient(145deg,rgba(30,64,175,0.18),rgba(15,23,42,0.9))] p-4">
              <summary className="cursor-pointer list-none text-sm font-semibold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-blue-300" />
                Phân quyền
              </summary>
              <div className="mt-3 space-y-3 text-xs md:text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      "owner"
                    )}`}
                  >
                    Chủ cửa hàng
                  </span>
                  <span>Toàn quyền quản lý.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      "manager"
                    )}`}
                  >
                    Quản lý
                  </span>
                  <span>Quản lý vận hành, không chỉnh cài đặt hệ thống.</span>
                </div>
                <div className="flex items-start gap-2">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(
                      "staff"
                    )}`}
                  >
                    Nhân viên
                  </span>
                  <span>Làm việc trong phạm vi chi nhánh được gán.</span>
                </div>
              </div>
            </details>
          </div>
        )}
      </div>

      {/* Save Button (Bottom) */}
      {!standaloneStaffPage && isOwner && activeTab !== "staff" && (
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

