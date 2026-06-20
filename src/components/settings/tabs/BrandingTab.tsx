import React from "react";
import { Upload, X, Image as ImageIcon } from "lucide-react";
import { StoreSettings } from "../types";

interface BrandingTabProps {
  settings: StoreSettings;
  updateField: (field: keyof StoreSettings, value: any) => void;
  isOwner: boolean;
  uploadingLogo: boolean;
  uploadingQR: boolean;
  handleLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
  handleQRUpload: (e: React.ChangeEvent<HTMLInputElement>) => Promise<void>;
}

export const BrandingTab: React.FC<BrandingTabProps> = ({
  settings,
  updateField,
  isOwner,
  uploadingLogo,
  uploadingQR,
  handleLogoUpload,
  handleQRUpload,
}) => {
  return (
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
                className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors ${
                  isOwner ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
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
                className={`flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover:border-blue-500 dark:hover:border-blue-400 transition-colors ${
                  isOwner ? "cursor-pointer" : "opacity-50 cursor-not-allowed"
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
              onChange={(e) => updateField("primary_color", e.target.value)}
              disabled={!isOwner}
              className="w-12 h-10 md:w-16 md:h-12 rounded border border-slate-300 dark:border-slate-600 cursor-pointer disabled:opacity-50"
            />
            <input
              type="text"
              value={settings.primary_color || "#3B82F6"}
              onChange={(e) => updateField("primary_color", e.target.value)}
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
  );
};
