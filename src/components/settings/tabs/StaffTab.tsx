import React from "react";
import {
  UserPlus,
  Mail,
  Building2,
  Lock,
  Shield,
  Search,
  Users,
  Check,
  X,
  Edit2,
  Trash2,
  Info,
} from "lucide-react";
import LoadingSpinner from "../../common/LoadingSpinner";
import { StaffMember, Branch } from "../types";
import { useStaffManagement, STAFF_DEPARTMENTS } from "../hooks/useStaffManagement";
import { APP_ACTION_OPTIONS } from "../../../utils/permissions";

interface StaffTabProps {
  staffState: ReturnType<typeof useStaffManagement>;
  isOwner: boolean;
}

export const StaffTab: React.FC<StaffTabProps> = ({ staffState, isOwner }) => {
  const {
    branches,
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
    resettingStaff,
    resetTargetStaff,
    resetTargetStaffName,
    resetStaffPassword,
    setResetStaffPassword,
    permissionTargetStaff,
    permissionTargetStaffName,
    permissionDraft,
    savingPermissionDraft,
    savingStaff,
    staffSearch,
    setStaffSearch,
    staffDepartmentFilter,
    setStaffDepartmentFilter,
    totalBaseSalary,
    activeDepartmentCount,
    payrollSeedRows,
    filteredStaffList,
    handleAddBranch,
    handleUpdateBranch,
    handleDeleteBranch,
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
    generateTemporaryPassword,
  } = staffState;

  const PERMISSION_GROUPS: Array<{
    key: "sales" | "service" | "inventory" | "finance" | "admin";
    label: string;
  }> = [
    { key: "sales", label: "Bán hàng" },
    { key: "service", label: "Sửa chữa" },
    { key: "inventory", label: "Kho" },
    { key: "finance", label: "Tài chính" },
    { key: "admin", label: "Quản trị" },
  ];

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

  const [editingBranchId, setEditingBranchId] = React.useState<string | null>(null);
  const [editingBranchName, setEditingBranchName] = React.useState<string>("");


  const normalizeBranchId = (value: string) => {
    const cleaned = String(value || "").trim().toUpperCase();
    const firstNumber = cleaned.match(/\d+/)?.[0];

    if (!firstNumber) return "";

    const index = Number.parseInt(firstNumber, 10);
    if (!Number.isFinite(index) || index <= 0) return "";

    return `CN${index}`;
  };

  return (
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

        {/* Branch List Table */}
        {branches && branches.length > 0 && (
          <div className="border-t border-white/10 px-4 py-3 bg-slate-900/20">
            <div className="text-[11px] uppercase tracking-wide text-slate-400 mb-2">
              Danh sách chi nhánh ({branches.length})
            </div>
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {branches.map((branch) => {
                const isEditing = editingBranchId === branch.id;
                return (
                  <div
                    key={branch.id}
                    className="flex items-center justify-between p-2 rounded-lg bg-white/5 border border-white/5 text-xs text-white"
                  >
                    <div className="flex items-center gap-3 flex-1 mr-4">
                      <span className="font-bold text-slate-400 px-1.5 py-0.5 rounded bg-white/10">
                        {branch.id}
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editingBranchName}
                          onChange={(e) => setEditingBranchName(e.target.value)}
                          className="flex-1 px-2.5 py-1 text-xs border border-white/20 rounded bg-slate-800 text-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      ) : (
                        <span className="font-semibold">{branch.name}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <button
                            onClick={() => {
                              handleUpdateBranch(branch.id, editingBranchName);
                              setEditingBranchId(null);
                            }}
                            className="px-2.5 py-1 rounded bg-green-600 hover:bg-green-700 text-[10px] font-bold uppercase tracking-wider text-white"
                          >
                            Lưu
                          </button>
                          <button
                            onClick={() => setEditingBranchId(null)}
                            className="px-2.5 py-1 rounded bg-slate-700 hover:bg-slate-650 text-[10px] font-bold uppercase tracking-wider text-white"
                          >
                            Hủy
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            onClick={() => {
                              setEditingBranchId(branch.id);
                              setEditingBranchName(branch.name);
                            }}
                            className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"
                            title="Sửa tên chi nhánh"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {branch.id !== "CN1" && (
                            <button
                              onClick={() => {
                                if (
                                  window.confirm(
                                    `Bạn có chắc chắn muốn xóa chi nhánh ${branch.name} (${branch.id})? Các tài khoản nhân viên thuộc chi nhánh này sẽ cần đổi chi nhánh.`
                                  )
                                ) {
                                  handleDeleteBranch(branch.id);
                                }
                              }}
                              className="p-1 hover:bg-red-500/20 rounded text-red-400 hover:text-red-300"
                              title="Xóa chi nhánh"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
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
                onChange={(e) => setNewStaffRole(e.target.value as "manager" | "staff")}
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
                onChange={(e) => setNewStaffDepartment(e.target.value as any)}
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

            <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-3.5">
              <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between mb-3">
                <div>
                  <div className="text-xs md:text-sm font-semibold text-white">
                    Phân quyền chi tiết
                  </div>
                  <div className="text-[11px] text-slate-400 mt-0.5">
                    Tick quyền theo từng mục để cấp quyền sử dụng cho tài khoản nhân viên.
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={applyRoleDefaultPermissions}
                    className="px-2.5 py-1.5 rounded-lg border border-white/15 text-slate-200 hover:bg-white/10 text-xs font-medium"
                  >
                    Theo vai trò mặc định
                  </button>
                  <button
                    type="button"
                    onClick={allowAllNewStaffPermissions}
                    className="px-2.5 py-1.5 rounded-lg border border-emerald-400/30 text-emerald-300 hover:bg-emerald-500/10 text-xs font-medium"
                  >
                    Cho phép tất cả
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {PERMISSION_GROUPS.map((group) => {
                  const actions = APP_ACTION_OPTIONS.filter(
                    (item: any) => item.group === group.key
                  );
                  if (actions.length === 0) return null;

                  return (
                    <div key={group.key} className="rounded-lg border border-white/10 bg-slate-900/40 p-2.5">
                      <div className="text-[11px] uppercase tracking-wide text-slate-300 mb-2">
                        {group.label}
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {actions.map((item: any) => {
                          const checked = getEffectivePermission(
                            newStaffRole,
                            newStaffPermissions,
                            item.key
                          );

                          return (
                            <label
                              key={item.key}
                              className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 px-2.5 py-2 cursor-pointer hover:bg-white/10"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) =>
                                  toggleNewStaffPermission(item.key, e.target.checked)
                                }
                                className="h-4 w-4 rounded border-slate-500 text-blue-500 focus:ring-blue-500"
                              />
                              <span className="text-xs text-slate-200">{item.label}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
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
                value={resetTargetStaffName}
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

      {permissionTargetStaff && (
        <div className="overflow-hidden rounded-[28px] border border-cyan-400/20 bg-[radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_32%),linear-gradient(145deg,rgba(15,23,42,0.96),rgba(15,23,42,0.82))] p-5 md:p-6">
          <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Shield className="w-4 h-4 text-cyan-300" />
            Phân quyền chi tiết
          </h3>
          <p className="text-xs text-slate-400 mb-4">
            Tài khoản: {permissionTargetStaffName}
          </p>

          <div className="space-y-3">
            {PERMISSION_GROUPS.map((group) => {
              const actions = APP_ACTION_OPTIONS.filter(
                (item: any) => item.group === group.key
              );

              return (
                <div
                  key={group.key}
                  className="rounded-xl border border-white/10 bg-white/5 p-3"
                >
                  <div className="text-[11px] uppercase tracking-wide text-slate-300 mb-2">
                    {group.label}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {actions.map((item: any) => {
                      const checked = getEffectivePermission(
                        permissionTargetStaff.role,
                        permissionDraft,
                        item.key
                      );

                      return (
                        <label
                          key={item.key}
                          className="flex items-center gap-2 rounded-md border border-white/10 bg-slate-900/40 px-2.5 py-2 cursor-pointer hover:bg-white/10"
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) =>
                              togglePermissionDraft(item.key, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-500 text-cyan-500 focus:ring-cyan-500"
                          />
                          <span className="text-xs text-slate-200">{item.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={closePermissionEditor}
              disabled={savingPermissionDraft}
              className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-slate-300 hover:text-white disabled:opacity-70"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleSavePermissionDraft}
              disabled={savingPermissionDraft}
              className="w-full sm:w-auto px-4 py-2 bg-cyan-600 hover:bg-cyan-700 disabled:bg-slate-500 text-white rounded-lg text-sm font-medium"
            >
              {savingPermissionDraft ? "Đang lưu..." : "Lưu phân quyền"}
            </button>
          </div>
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
                              {(staff.name || staff.email)?.[0]?.toUpperCase() || "?"}
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
                                  role: e.target.value as any,
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
                                    onClick={() => openPermissionEditor(staff)}
                                    disabled={savingStaff || savingPermissionDraft}
                                    className="p-2 text-cyan-300 hover:bg-cyan-500/10 rounded-xl disabled:opacity-60"
                                    title="Phân quyền chi tiết"
                                  >
                                    <Shield className="w-4 h-4" />
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
                                role: e.target.value as any,
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
                              onClick={() => openPermissionEditor(staff)}
                              disabled={savingStaff || savingPermissionDraft}
                              className="px-3 py-2 rounded-lg bg-cyan-600/20 text-cyan-300 border border-cyan-400/30 text-xs font-semibold disabled:opacity-70"
                            >
                              Quyền
                            </button>
                            <button
                              onClick={() => openResetStaffDialog(staff)}
                              disabled={resettingStaff || savingStaff}
                              className="px-3 py-2 rounded-lg bg-amber-600/20 text-amber-300 border border-amber-400/30 text-xs font-semibold disabled:opacity-70"
                            >
                              Đặt MK
                            </button>
                          </div>
                        )}
                        {staff.role !== "owner" && (
                          <div className="pt-2 grid grid-cols-1 gap-2">
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
  );
};
