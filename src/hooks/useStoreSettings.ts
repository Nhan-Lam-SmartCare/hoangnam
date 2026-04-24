import { useQuery } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

export interface StoreSettings {
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
}

export const useStoreSettings = () => {
    return useQuery({
        queryKey: ["store_settings"],
        queryFn: async () => {
            const { data: defaultData, error: defaultError } = await supabase
                .from("store_settings")
                .select("*")
                .eq("id", "default")
                .maybeSingle();

            if (defaultError) {
                console.warn("[useStoreSettings] Could not read default row:", defaultError);
            }

            let data = defaultData;
            if (!data) {
                const { data: fallbackData, error: fallbackError } = await supabase
                    .from("store_settings")
                    .select("*")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();

                if (fallbackError) {
                    console.warn("[useStoreSettings] Could not read fallback row:", fallbackError);
                }
                data = fallbackData;
            }

            if (!data) {
                return {
                    id: "default",
                    store_name: "MotoCare",
                } as StoreSettings;
            }

            const normalized: any = { ...data };
            if (!normalized.store_name && normalized.storeName) normalized.store_name = normalized.storeName;
            if (!normalized.address && normalized.storeAddress) normalized.address = normalized.storeAddress;
            if (!normalized.phone && normalized.storePhone) normalized.phone = normalized.storePhone;
            if (!normalized.email && normalized.storeEmail) normalized.email = normalized.storeEmail;
            if (!normalized.logo_url && normalized.logoUrl) normalized.logo_url = normalized.logoUrl;
            if (!normalized.bank_qr_url && normalized.bankQrUrl) normalized.bank_qr_url = normalized.bankQrUrl;

            return normalized as StoreSettings;
        },
        staleTime: 1000 * 60 * 10, // Cache for 10 minutes
    });
};
