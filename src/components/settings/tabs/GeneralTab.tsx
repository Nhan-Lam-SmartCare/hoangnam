import React from "react";
import { StoreSettings } from "../types";
import { useBranchesRepo, useUpsertBranchRepo } from "../../../hooks/useBranchesRepository";

interface GeneralTabProps {
  settings: StoreSettings;
  updateField: (field: keyof StoreSettings, value: any) => void;
  isOwner: boolean;
}

export const GeneralTab: React.FC<GeneralTabProps> = ({
  settings,
  updateField,
  isOwner,
}) => {
  const { data: branches = [] } = useBranchesRepo();
  const upsertBranchMutation = useUpsertBranchRepo();
  const [newBranchId, setNewBranchId] = React.useState("");
  const [newBranchName, setNewBranchName] = React.useState("");
  const [editingBranchNames, setEditingBranchNames] = React.useState<Record<string, string>>({});

  const handleSaveBranch = (id: string, name: string) => {
    const trimmedId = id.trim().toUpperCase();
    const trimmedName = name.trim();
    if (!trimmedId || !trimmedName) return;

    upsertBranchMutation.mutate({ id: trimmedId, name: trimmedName, isActive: true });
  };

  return (
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
            placeholder="Sửa chữa thiết bị điện tử chuyên nghiệp"
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
            onChange={(e) => updateField("business_hours", e.target.value)}
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
            onChange={(e) => updateField("established_year", Number(e.target.value))}
            disabled={!isOwner}
            placeholder="2020"
            className="w-full px-3 py-2 md:px-4 md:py-2.5 text-sm md:text-base border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
          />
        </div>
      </div>

      <div className="border-t border-slate-200 dark:border-slate-700 pt-4 md:pt-6">
        <h2 className="text-base md:text-lg font-semibold text-slate-900 dark:text-white mb-3 md:mb-4">
          Quản lý chi nhánh
        </h2>

        <div className="space-y-3">
          {branches.map((branch) => {
            const editingName = editingBranchNames[branch.id] ?? branch.name;
            return (
              <div
                key={branch.id}
                className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 md:items-center rounded-lg border border-slate-200 dark:border-slate-700 p-3"
              >
                <div className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  {branch.id}
                </div>
                <input
                  type="text"
                  value={editingName}
                  disabled={!isOwner}
                  onChange={(e) =>
                    setEditingBranchNames((prev) => ({
                      ...prev,
                      [branch.id]: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={!isOwner || upsertBranchMutation.isPending || !editingName.trim()}
                  onClick={() => handleSaveBranch(branch.id, editingName)}
                  className="px-3 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:bg-slate-400"
                >
                  Lưu
                </button>
              </div>
            );
          })}

          {isOwner && (
            <div className="grid grid-cols-1 md:grid-cols-[120px_1fr_auto] gap-2 md:items-center rounded-lg border border-dashed border-slate-300 dark:border-slate-600 p-3">
              <input
                type="text"
                value={newBranchId}
                onChange={(e) => setNewBranchId(e.target.value)}
                placeholder="CN2"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white uppercase"
              />
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Tên chi nhánh"
                className="w-full px-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              <button
                type="button"
                disabled={
                  upsertBranchMutation.isPending ||
                  !newBranchId.trim() ||
                  !newBranchName.trim()
                }
                onClick={() => {
                  handleSaveBranch(newBranchId, newBranchName);
                  setNewBranchId("");
                  setNewBranchName("");
                }}
                className="px-3 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:bg-slate-400"
              >
                Thêm
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
