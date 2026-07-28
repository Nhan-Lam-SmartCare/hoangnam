import { useState, useEffect, useRef } from "react";
import { useSupabaseClient } from "../../hooks/useSupabaseClient";
import { useAuth } from "../../contexts/AuthContext";
import { showToast } from "../../utils/toast";
import LoadingSpinner from "../common/LoadingSpinner";
import { PrinterSettings } from "./PrinterSettings";
import {
  Lock,
  Settings as SettingsIcon,
  Save,
  Info,
  Store,
  Palette,
  Landmark,
  FileText,
  Shield,
  Users,
  X,
} from "lucide-react";

import { StoreSettings } from "./types";
import { useStaffManagement } from "./hooks/useStaffManagement";
import { GeneralTab } from "./tabs/GeneralTab";
import { BrandingTab } from "./tabs/BrandingTab";
import { BankingTab } from "./tabs/BankingTab";
import { InvoiceTab } from "./tabs/InvoiceTab";
import { SecurityTab } from "./tabs/SecurityTab";
import { StaffTab } from "./tabs/StaffTab";

interface SettingsManagerProps {
  initialTab?: "general" | "branding" | "banking" | "invoice" | "security" | "staff" | "printer";
  standaloneStaffPage?: boolean;
}

const BRANCH_TABLE_DISABLED_KEY = "motocare-schema-missing-branches";

function readLocalFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("vi-VN").format(Number(value || 0));

export const SettingsManager = ({
  initialTab = "general",
  standaloneStaffPage = false,
}: SettingsManagerProps = {}) => {
  const supabase = useSupabaseClient();
  const { profile, hasRole } = useAuth();
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [uploadingQR, setUploadingQR] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "general" | "branding" | "banking" | "invoice" | "security" | "staff" | "printer"
  >(standaloneStaffPage ? "staff" : initialTab);

  const staffState = useStaffManagement(activeTab);
  const missingStoreSettingsColumnsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    loadSettings();
  }, []);

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

    const exactKey = Object.keys(nextPayload).find(
      (key) => key.toLowerCase() === missingRaw
    );
    if (exactKey) {
      delete nextPayload[exactKey];
      return nextPayload;
    }

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
      let payload = buildStoreSettingsPayload(settings);
      payload.id = "default";

      missingStoreSettingsColumnsRef.current.forEach((missingColumn) => {
        payload = stripMissingColumn(payload, missingColumn);
      });

      let attempts = 0;
      const maxAttempts = 30;
      let saveError: any = null;
      let saved = false;

      while (!saved && attempts < maxAttempts) {
        attempts += 1;

        const { error } = await supabase
          .from("store_settings")
          .upsert(payload, { onConflict: "id" })
          .select();

        if (!error) {
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
        console.warn(
          `[Settings] Legacy schema missing '${missingColumn}', retrying with compatible payload.`
        );
      }

      if (!saved) {
        throw saveError || new Error("Không thể lưu cài đặt cửa hàng");
      }

      await loadSettings();
      showToast.success("Đã lưu cài đặt thành công!");
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
        reject(reader.error || new Error("Không thể đọc file ảnh"));
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
        throw new Error("Không lấy được URL công khai của ảnh");
      }

      return { url: data.publicUrl, mode: "storage" };
    } catch (error) {
      console.warn(
        "[SettingsManager] Upload lên storage thất bại, chuyển sang lưu ảnh trực tiếp trong cài đặt:",
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
            ? "Đã tải logo lên thành công!"
            : "Đã gắn logo vào cài đặt. Nhớ bấm Lưu thay đổi."
        );
      } catch (error: any) {
        console.error("Error uploading logo:", error);
        showToast.error(error.message || "Không thể tải logo lên");
      } finally {
        setUploadingLogo(false);
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
            ? "Đã tải mã QR ngân hàng lên thành công!"
            : "Đã gắn mã QR vào cài đặt. Nhớ bấm Lưu thay đổi."
        );
      } catch (error: any) {
        console.error("Error uploading QR:", error);
        showToast.error(error.message || "Không thể tải mã QR lên");
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
                {staffState.staffList.length} nhân sự
              </span>
              <span className="rounded-full border border-emerald-400/15 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                {formatCurrency(staffState.totalBaseSalary)} đ lương cơ bản
              </span>
              <span className="rounded-full border border-blue-400/15 bg-blue-500/10 px-2.5 py-1 text-blue-200">
                {staffState.activeDepartmentCount || 0} phòng ban
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
      {!standaloneStaffPage && (
        <div>
          {/* Mobile View: Dropdown */}
          <div className="md:hidden mb-4">
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
                    { id: "printer", icon: <SettingsIcon className="w-5 h-5 text-slate-500" /> },
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
                <option value="printer">Máy in</option>
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
                {
                  id: "printer",
                  label: "Máy in",
                  icon: <SettingsIcon className="w-4 h-4" />,
                },
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
      )}

      {/* Tab Content */}
      <div
        className={`${
          standaloneStaffPage
            ? "overflow-hidden rounded-[20px] border border-white/10 bg-slate-950/45 p-4 md:p-4 shadow-[0_10px_24px_rgba(2,6,23,0.22)] backdrop-blur"
            : "bg-white dark:bg-slate-800 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700 p-4 md:p-6"
        }`}
      >
        {activeTab === "general" && (
          <GeneralTab
            settings={settings}
            updateField={updateField}
            isOwner={isOwner}
          />
        )}

        {activeTab === "branding" && (
          <BrandingTab
            settings={settings}
            updateField={updateField}
            isOwner={isOwner}
            uploadingLogo={uploadingLogo}
            uploadingQR={uploadingQR}
            handleLogoUpload={handleLogoUpload}
            handleQRUpload={handleQRUpload}
          />
        )}

        {activeTab === "banking" && (
          <BankingTab
            settings={settings}
            updateField={updateField}
            isOwner={isOwner}
          />
        )}

        {activeTab === "invoice" && (
          <InvoiceTab
            settings={settings}
            updateField={updateField}
            isOwner={isOwner}
          />
        )}

        {activeTab === "security" && (
          <SecurityTab
            isOwner={isOwner}
          />
        )}

        {activeTab === "staff" && isOwner && (
          <StaffTab
            staffState={staffState}
            isOwner={isOwner}
          />
        )}

        {activeTab === "printer" && (
          <PrinterSettings
            settings={settings}
            updateField={updateField}
            isOwner={isOwner}
          />
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
