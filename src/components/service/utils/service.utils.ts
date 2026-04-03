/**
 * Service utility functions
 * Extracted from ServiceManager.tsx for reusability
 */

import { supabase } from "../../../supabaseClient";
import { showToast } from "../../../utils/toast";

export interface PrintableStoreSettings {
    store_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    bank_qr_url?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_holder?: string;
    bank_branch?: string;
    work_order_prefix?: string;
}

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

export const fetchStoreSettingsForBranch = async (
    branchId?: string
): Promise<PrintableStoreSettings | null> => {
    const normalizedBranchId = String(branchId || "").trim();

    const attempts: Array<() => Promise<Record<string, any> | null>> = [
        async () => {
            if (!normalizedBranchId) return null;
            const { data, error } = await supabase
                .from("store_settings")
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
                .from("store_settings")
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
                .from("store_settings")
                .select("*")
                .eq("id", "default")
                .maybeSingle();

            if (error) throw error;
            return data;
        },
        async () => {
            const { data, error } = await supabase
                .from("store_settings")
                .select("*")
                .order("updated_at", { ascending: false })
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();

            if (error) throw error;
            return data;
        },
    ];

    for (const attempt of attempts) {
        try {
            const result = await attempt();
            if (result) return normalizeStoreSettings(result);
        } catch (error) {
            console.warn("[service.utils] Skipping incompatible store_settings query:", error);
        }
    }

    return null;
};

export const sanitizeIssueDescriptionForPrint = (issueDescription?: string): string => {
    const cleaned = String(issueDescription || "")
        .replace(/(?:\r?\n)*\[Mật khẩu\/Pattern\]:.*$/is, "")
        .trim();

    return cleaned || "Không có mô tả";
};

/**
 * Download a blob as an image file
 */
export const downloadImage = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast.success("Đã tải phiếu xuống!");
};

/**
 * Format phone number with mask for privacy
 * Shows only last 4 digits
 */
export const formatMaskedPhone = (phone?: string): string => {
    if (!phone) return "N/A";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return phone;
    return `*** *** ${digits.slice(-4)}`;
};

/**
 * Initiate a phone call
 */
export const handleCallCustomer = (phone: string): void => {
    if (phone) {
        window.location.href = `tel:${phone}`;
    }
};

/**
 * Share invoice as image using Web Share API or download
 */
export const shareInvoiceAsImage = async (
    element: HTMLElement,
    orderId: string,
    orderPrefix?: string
): Promise<boolean> => {
    try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
        });

        const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
        });

        const fileName = `phieu-sua-chua-${orderId}.png`;

        if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Phiếu sửa chữa ${orderId}`,
                });
                showToast.success("Đã chia sẻ phiếu thành công!");
                return true;
            }
        }

        // Fallback to download
        downloadImage(blob, fileName);
        return true;
    } catch (error) {
        if ((error as Error).name !== "AbortError") {
            console.error("Error sharing invoice:", error);
            showToast.error("Không thể chia sẻ phiếu");
        }
        return false;
    }
};
