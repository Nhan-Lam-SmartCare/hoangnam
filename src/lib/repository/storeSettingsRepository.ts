import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";
import type { PrintableStoreSettings } from "../../components/service/utils/service.utils";

const TABLE = "store_settings";

const normalizeStoreSettings = (data: Record<string, any> | null): PrintableStoreSettings | null => {
  if (!data) return null;

  const normalized: Record<string, any> = { ...data };

  if (!normalized.store_name && normalized.storeName) normalized.store_name = normalized.storeName;
  if (!normalized.address && normalized.storeAddress) normalized.address = normalized.storeAddress;
  if (!normalized.phone && normalized.storePhone) normalized.phone = normalized.storePhone;
  if (!normalized.email && normalized.storeEmail) normalized.email = normalized.storeEmail;
  if (!normalized.bank_name && normalized.bankName) normalized.bank_name = normalized.bankName;
  if (!normalized.bank_account_number && normalized.bankAccount) normalized.bank_account_number = normalized.bankAccount;
  if (!normalized.bank_account_holder && normalized.bankAccountName) normalized.bank_account_holder = normalized.bankAccountName;
  if (!normalized.bank_qr_url && normalized.bankQrUrl) normalized.bank_qr_url = normalized.bankQrUrl;
  if (!normalized.work_order_prefix && normalized.workOrderPrefix) normalized.work_order_prefix = normalized.workOrderPrefix;

  return normalized as PrintableStoreSettings;
};

export async function fetchStoreSettingsForBranch(
  branchId?: string
): Promise<RepoResult<PrintableStoreSettings | null>> {
  const normalizedBranchId = String(branchId || "").trim();

  const attempts: Array<() => Promise<Record<string, any> | null>> = [
    async () => {
      if (!normalizedBranchId) return null;
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("branchId", normalizedBranchId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    async () => {
      if (!normalizedBranchId) return null;
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("branch_id", normalizedBranchId)
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .eq("id", "default")
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("updated_at", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  ];

  let lastError: any = null;
  for (const attempt of attempts) {
    try {
      const result = await attempt();
      if (result) return success(normalizeStoreSettings(result));
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    return failure({
      code: "supabase",
      message: "Lỗi lấy cấu hình cửa hàng",
      cause: lastError,
    });
  }
  return success(null);
}
