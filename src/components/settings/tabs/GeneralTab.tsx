import React from "react";
import { StoreSettings } from "../types";

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
    </div>
  );
};
