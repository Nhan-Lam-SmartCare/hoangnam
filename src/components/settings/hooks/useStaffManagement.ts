import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "../../../supabaseClient";
import * as XLSX from "xlsx";
import { useAuth } from "../../../contexts/AuthContext";
import { showToast } from "../../../utils/toast";
import {
  getWorkerMonthlyLaborDetails,
  getWorkerMonthlySalary,
  type WorkerLaborDetailRow,
} from "../../../lib/repository/repairLaborRepository";
import {
  APP_ACTION_OPTIONS,
  canDo,
  normalizePermissionMap,
  type AppAction,
  type PermissionMap,
} from "../../../utils/permissions";
import { StaffMember, Branch, StoreSettings } from "../types";

const BRANCH_TABLE_DISABLED_KEY = "motocare-schema-missing-branches";
const STAFF_OVERRIDES_STORAGE_KEY = "staff_overrides_v1";
const BRANCH_OVERRIDES_STORAGE_KEY = "branch_overrides_v1";
export const STAFF_DEPARTMENTS = ["Kỹ thuật", "Bán hàng", "Quản lý"] as const;

type StaffOverridesMap = Record<
  string,
  {
    department?: string;
    position?: string;
    base_salary?: number;
    permissions?: PermissionMap;
  }
>;

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

export const useStaffManagement = (activeTab: string) => {
  const { profile, hasRole } = useAuth();

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
  const [newStaffRole, setNewStaffRole] = useState<"manager" | "staff">("staff");
  const [newStaffBranch, setNewStaffBranch] = useState("");
  const [newStaffDepartment, setNewStaffDepartment] =
    useState<(typeof STAFF_DEPARTMENTS)[number]>("Kỹ thuật");
  const [newStaffPosition, setNewStaffPosition] = useState("");
  const [newStaffBaseSalary, setNewStaffBaseSalary] = useState("0");
  const [newStaffPassword, setNewStaffPassword] = useState("");
  const [newStaffPermissions, setNewStaffPermissions] = useState<PermissionMap>({});
  const [resettingStaff, setResettingStaff] = useState(false);
  const [resetTargetStaff, setResetTargetStaff] = useState<StaffMember | null>(null);
  const [resetStaffPassword, setResetStaffPassword] = useState("");
  const [permissionTargetStaff, setPermissionTargetStaff] = useState<StaffMember | null>(null);
  const [permissionDraft, setPermissionDraft] = useState<PermissionMap>({});
  const [savingPermissionDraft, setSavingPermissionDraft] = useState(false);
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

  const loadBranches = async () => {
    if (readLocalFlag(BRANCH_TABLE_DISABLED_KEY)) {
      const mergedBranches = mergeBranches(
        [{ id: "CN1", name: "Chi nhánh 1" }],
        branchOverrides
      );
      setBranches(mergedBranches);
      if (!newStaffBranch) {
        setNewStaffBranch((mergedBranches[0] || { id: "CN1" }).id);
      }
      return;
    }

    try {
      const { data, error } = await supabase
        .from("branches")
        .select("id, name")
        .order("name");

      if (isMissingTableError(error)) {
        writeLocalFlag(BRANCH_TABLE_DISABLED_KEY);
      }

      if (!error && data && data.length > 0) {
        const mergedBranches = mergeBranches(data as Branch[], branchOverrides);
        setBranches(mergedBranches);
        if (!newStaffBranch) {
          setNewStaffBranch((mergedBranches[0] || data[0]).id);
        }
      } else {
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
      const mergedBranches = mergeBranches(
        [{ id: "CN1", name: "Chi nhánh 1" }],
        branchOverrides
      );
      setBranches(mergedBranches);
      setNewStaffBranch((mergedBranches[0] || { id: "CN1" }).id);
    }
  };

  const loadStaff = async () => {
    setLoadingStaff(true);
    try {
      const employeeMap = new Map<string, { department: string; position: string; base_salary: number }>();

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

      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "get_all_users_for_owner"
      );

      if (!rpcError && rpcData && rpcData.length > 0) {
        setStaffList(
          (rpcData as StaffMember[]).map((staff) => ({
            ...staff,
            permissions: normalizePermissionMap(
              (staff as any).permissions ||
                (staff as any).custom_permissions ||
                (staff as any).permission_overrides ||
                staffOverrides[staff.id]?.permissions ||
                {}
            ),
            custom_permissions: normalizePermissionMap(
              (staff as any).custom_permissions ||
                (staff as any).permissions ||
                (staff as any).permission_overrides ||
                staffOverrides[staff.id]?.permissions ||
                {}
            ),
            permission_overrides: normalizePermissionMap(
              (staff as any).permission_overrides ||
                (staff as any).custom_permissions ||
                (staff as any).permissions ||
                staffOverrides[staff.id]?.permissions ||
                {}
            ),
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
        const { data: profilesData, error: profilesError } = await supabase
          .from("profiles")
          .select("id, email, name, role, branch_id, created_at")
          .order("created_at", { ascending: false });

        if (!profilesError && profilesData && profilesData.length > 0) {
          setStaffList(
            (profilesData as StaffMember[]).map((staff) => ({
              ...staff,
              permissions: normalizePermissionMap(
                (staff as any).permissions ||
                  (staff as any).custom_permissions ||
                  (staff as any).permission_overrides ||
                  staffOverrides[staff.id]?.permissions ||
                  {}
              ),
              custom_permissions: normalizePermissionMap(
                (staff as any).custom_permissions ||
                  (staff as any).permissions ||
                  (staff as any).permission_overrides ||
                  staffOverrides[staff.id]?.permissions ||
                  {}
              ),
              permission_overrides: normalizePermissionMap(
                (staff as any).permission_overrides ||
                  (staff as any).custom_permissions ||
                  (staff as any).permissions ||
                  staffOverrides[staff.id]?.permissions ||
                  {}
              ),
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
          if (profile) {
            setStaffList([
              {
                id: profile.id,
                email: profile.email,
                name: profile.name || profile.full_name || "",
                role: profile.role,
                permissions: normalizePermissionMap(
                  (profile as any).permissions ||
                    (profile as any).custom_permissions ||
                    (profile as any).permission_overrides ||
                    staffOverrides[profile.id]?.permissions ||
                    {}
                ),
                custom_permissions: normalizePermissionMap(
                  (profile as any).custom_permissions ||
                    (profile as any).permissions ||
                    (profile as any).permission_overrides ||
                    staffOverrides[profile.id]?.permissions ||
                    {}
                ),
                permission_overrides: normalizePermissionMap(
                  (profile as any).permission_overrides ||
                    (profile as any).custom_permissions ||
                    (profile as any).permissions ||
                    staffOverrides[profile.id]?.permissions ||
                    {}
                ),
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

          if (rpcError) {
            console.warn("[Settings] staff RPC unavailable, using fallback source.");
          }
        }
      }
    } catch (error) {
      console.error("Error loading staff:", error);
      if (profile) {
        setStaffList([
          {
            id: profile.id,
            email: profile.email,
            name: profile.name || profile.full_name || "",
            role: profile.role,
            permissions: normalizePermissionMap(
              (profile as any).permissions ||
                (profile as any).custom_permissions ||
                (profile as any).permission_overrides ||
                staffOverrides[profile.id]?.permissions ||
                {}
            ),
            custom_permissions: normalizePermissionMap(
              (profile as any).custom_permissions ||
                (profile as any).permissions ||
                (profile as any).permission_overrides ||
                staffOverrides[profile.id]?.permissions ||
                {}
            ),
            permission_overrides: normalizePermissionMap(
              (profile as any).permission_overrides ||
                (profile as any).custom_permissions ||
                (profile as any).permissions ||
                staffOverrides[profile.id]?.permissions ||
                {}
            ),
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

  async function refreshStaffScreen() {
    await Promise.allSettled([loadStaff(), loadBranches()]);
  }

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
      let error: any = null;
      if (!readLocalFlag(BRANCH_TABLE_DISABLED_KEY)) {
        const insertRes = await supabase.from("branches").insert(newBranch);
        error = insertRes.error;
        if (isMissingTableError(error)) {
          writeLocalFlag(BRANCH_TABLE_DISABLED_KEY);
        }
      }

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
          permissions: normalizePermissionMap(
            editingStaff.permissions ||
              editingStaff.custom_permissions ||
              editingStaff.permission_overrides ||
              {}
          ),
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
                permissions: normalizePermissionMap(
                  updatedStaffFromApi.permissions ||
                    updatedStaffFromApi.custom_permissions ||
                    updatedStaffFromApi.permission_overrides ||
                    editedSnapshot.permissions ||
                    editedSnapshot.custom_permissions ||
                    editedSnapshot.permission_overrides ||
                    staff.permissions ||
                    {}
                ),
                custom_permissions: normalizePermissionMap(
                  updatedStaffFromApi.custom_permissions ||
                    updatedStaffFromApi.permissions ||
                    updatedStaffFromApi.permission_overrides ||
                    editedSnapshot.custom_permissions ||
                    editedSnapshot.permissions ||
                    editedSnapshot.permission_overrides ||
                    staff.custom_permissions ||
                    {}
                ),
                permission_overrides: normalizePermissionMap(
                  updatedStaffFromApi.permission_overrides ||
                    updatedStaffFromApi.custom_permissions ||
                    updatedStaffFromApi.permissions ||
                    editedSnapshot.permission_overrides ||
                    editedSnapshot.custom_permissions ||
                    editedSnapshot.permissions ||
                    staff.permission_overrides ||
                    {}
                ),
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
          ...prev[editedSnapshot.id],
          department:
            updatedStaffFromApi.department || editedSnapshot.department || normalizedDepartment,
          position: updatedStaffFromApi.position || editedSnapshot.position || "",
          base_salary: Number(
            updatedStaffFromApi.base_salary ?? editedSnapshot.base_salary ?? 0
          ),
          permissions: normalizePermissionMap(
            updatedStaffFromApi.permissions ||
              updatedStaffFromApi.custom_permissions ||
              updatedStaffFromApi.permission_overrides ||
              {}
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
          permissions: normalizePermissionMap(newStaffPermissions),
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
            ...prev[result.user.id],
            department: newStaffDepartment,
            position: newStaffPosition.trim(),
            base_salary: Number(newStaffBaseSalary || 0),
            permissions: normalizePermissionMap(newStaffPermissions),
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

  const openPermissionEditor = (staff: StaffMember) => {
    if (staff.role === "owner") {
      showToast.error("Không thể chỉnh quyền cho tài khoản chủ cửa hàng");
      return;
    }

    setPermissionTargetStaff(staff);
    setPermissionDraft(
      normalizePermissionMap(
        staff.permissions ||
          staff.custom_permissions ||
          staff.permission_overrides ||
          {}
      )
    );
  };

  const closePermissionEditor = () => {
    setPermissionTargetStaff(null);
    setPermissionDraft({});
  };

  const togglePermissionDraft = (action: AppAction, checked: boolean) => {
    if (!permissionTargetStaff) return;

    setPermissionDraft((prev) => {
      const roleDefault = canDo(permissionTargetStaff.role, action);
      const next = { ...prev };

      if (checked === roleDefault) {
        delete next[action];
      } else {
        next[action] = checked;
      }

      return next;
    });
  };

  const handleSavePermissionDraft = async () => {
    if (!permissionTargetStaff) return;

    setSavingPermissionDraft(true);
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
          id: permissionTargetStaff.id,
          email: permissionTargetStaff.email,
          name: permissionTargetStaff.name,
          role: permissionTargetStaff.role,
          branch_id: permissionTargetStaff.branch_id,
          department: permissionTargetStaff.department || "Kỹ thuật",
          position: permissionTargetStaff.position || "",
          base_salary: Number(permissionTargetStaff.base_salary || 0),
          permissions: normalizePermissionMap(permissionDraft),
        }),
      });

      const result = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(result?.error || "Không thể cập nhật phân quyền");
      }

      setStaffList((prev) =>
        prev.map((staff) =>
          staff.id === permissionTargetStaff.id
            ? {
                ...staff,
                permissions: normalizePermissionMap(permissionDraft),
                custom_permissions: normalizePermissionMap(permissionDraft),
                permission_overrides: normalizePermissionMap(permissionDraft),
              }
            : staff
        )
      );

      setStaffOverrides((prev) => ({
        ...prev,
        [permissionTargetStaff.id]: {
          ...prev[permissionTargetStaff.id],
          permissions: normalizePermissionMap(permissionDraft),
        },
      }));

      showToast.success("Đã cập nhật phân quyền nhân viên");
      closePermissionEditor();
      await refreshStaffScreen();
    } catch (error: any) {
      console.error("Error updating staff permissions:", error);
      showToast.error(error.message || "Không thể cập nhật phân quyền");
    } finally {
      setSavingPermissionDraft(false);
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
    setNewStaffPermissions({});
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

  const getEffectivePermission = (
    role: "owner" | "manager" | "staff",
    overrides: PermissionMap,
    action: AppAction
  ) => {
    if (typeof overrides[action] === "boolean") {
      return Boolean(overrides[action]);
    }
    return canDo(role, action);
  };

  const toggleNewStaffPermission = (action: AppAction, checked: boolean) => {
    setNewStaffPermissions((prev) => {
      const roleDefault = canDo(newStaffRole, action);
      const next = { ...prev };

      if (checked === roleDefault) {
        delete next[action];
      } else {
        next[action] = checked;
      }

      return next;
    });
  };

  const applyRoleDefaultPermissions = () => {
    setNewStaffPermissions({});
  };

  const allowAllNewStaffPermissions = () => {
    const next = APP_ACTION_OPTIONS.reduce<PermissionMap>((acc, item) => {
      acc[item.key] = true;
      return acc;
    }, {});
    setNewStaffPermissions(next);
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
      .replace(/[^\w-]/g, "");
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

  const totalBaseSalary = filteredStaffList.reduce(
    (sum, staff) => sum + Number(staff.base_salary || 0),
    0
  );

  const activeDepartmentCount = new Set(
    staffList.map((staff) => staff.department).filter(Boolean)
  ).size;

  const totalLaborAmountInMonth = useMemo(
    () => staffSalaryRows.reduce((sum, row) => sum + Number(row.totalWorkerAmount || 0), 0),
    [staffSalaryRows]
  );

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

  // Trigger loading when staff tab is activated.
  // Cố ý chỉ phụ thuộc activeTab: refreshStaffScreen là hàm tạo lại mỗi render
  // (không memo hóa) nên đưa vào deps sẽ khiến effect chạy lại liên tục. hasRole
  // ổn định theo phiên đăng nhập. Chỉ cần chạy khi tab chuyển sang "staff".
  useEffect(() => {
    if (activeTab === "staff" && hasRole(["owner"])) {
      refreshStaffScreen();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  return {
    staffList,
    setStaffList,
    branches,
    setBranches,
    loadingStaff,
    editingStaff,
    setEditingStaff,
    newBranchId,
    setNewBranchId,
    newBranchName,
    setNewBranchName,
    savingBranch,
    showAddStaff,
    setShowAddStaff,
    newStaffEmail,
    setNewStaffEmail,
    newStaffName,
    setNewStaffName,
    newStaffRole,
    setNewStaffRole,
    newStaffBranch,
    setNewStaffBranch,
    newStaffDepartment,
    setNewStaffDepartment,
    newStaffPosition,
    setNewStaffPosition,
    newStaffBaseSalary,
    setNewStaffBaseSalary,
    newStaffPassword,
    setNewStaffPassword,
    newStaffPermissions,
    setNewStaffPermissions,
    resettingStaff,
    setResettingStaff,
    resetTargetStaff,
    resetTargetStaffName: resetTargetStaff?.name || resetTargetStaff?.email || "",
    resetStaffPassword,
    setResetStaffPassword,
    permissionTargetStaff,
    permissionTargetStaffName: permissionTargetStaff?.name || permissionTargetStaff?.email || "",
    permissionDraft,
    setPermissionDraft,
    savingPermissionDraft,
    savingStaff,
    staffSearch,
    setStaffSearch,
    staffDepartmentFilter,
    setStaffDepartmentFilter,
    salaryMonth,
    setSalaryMonth,
    salaryYear,
    setSalaryYear,
    staffSalaryRows,
    loadingSalaryRows,
    selectedSalaryWorker,
    setSelectedSalaryWorker,
    salaryDetailRows,
    loadingSalaryDetails,
    totalBaseSalary,
    activeDepartmentCount,
    totalLaborAmountInMonth,
    payrollSeedRows,
    filteredStaffList,
    refreshStaffScreen,
    handleAddBranch,
    handleUpdateStaff,
    handleDeleteStaff,
    handleCreateStaffAccount,
    openResetStaffDialog,
    closeResetStaffDialog,
    handleResetStaffPassword,
    openPermissionEditor,
    closePermissionEditor,
    togglePermissionDraft,
    handleSavePermissionDraft,
    resetNewStaffForm,
    getRoleBadgeColor,
    getRoleLabel,
    getEffectivePermission,
    toggleNewStaffPermission,
    applyRoleDefaultPermissions,
    allowAllNewStaffPermissions,
    handleOpenSalaryDetails,
    handleExportSalaryDetailsExcel,
    generateTemporaryPassword,
  };
};
