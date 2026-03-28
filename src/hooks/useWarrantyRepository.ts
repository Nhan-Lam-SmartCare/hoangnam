import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";

export interface WarrantyCard {
    id: string;
    device_id?: string;
    customer_id?: string;
    customer_name?: string;
    customer_phone?: string;
    device_model: string;
    imei_serial?: string;
    warranty_start_date: string;
    warranty_end_date: string;
    warranty_period_months: number;
    warranty_type: 'standard' | 'extended' | 'premium';
    covered_parts: string[];
    coverage_terms?: string;
    work_order_id?: string;
    issued_by?: string;
    branch_id: string;
    status: 'active' | 'expired' | 'voided' | 'claimed';
    notes?: string;
    created_at: string;
    updated_at: string;
}

export interface WarrantyClaim {
    id: string;
    warranty_card_id: string;
    work_order_id: string;
    claim_date: string;
    issue_description?: string;
    is_covered: boolean;
    denial_reason?: string;
    parts_replaced?: any[];
    labor_hours?: number;
    status: 'pending' | 'approved' | 'rejected' | 'completed';
    approved_by?: string;
    completed_by?: string;
    completed_at?: string;
    created_at: string;
}

export interface CreateWarrantyCardInput {
    customer_name?: string;
    customer_phone?: string;
    device_model: string;
    imei_serial?: string;
    warranty_period_months: number;
    warranty_type?: 'standard' | 'extended' | 'premium';
    covered_parts?: string[];
    coverage_terms?: string;
    work_order_id?: string;
    notes?: string;
}

// Hook to fetch warranty cards
export const useWarrantyCards = () => {
    const { profile } = useAuth();

    return useQuery({
        queryKey: ["warranty_cards", profile?.branch_id],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("warranty_cards")
                .select("*")
                .eq("branch_id", profile?.branch_id)
                .order("created_at", { ascending: false });

            if (error) throw error;
            return data as WarrantyCard[];
        },
        enabled: !!profile?.branch_id,
    });
};

// Hook to check active warranty
export const useCheckWarranty = (imei?: string, phone?: string, deviceModel?: string) => {
    return useQuery({
        queryKey: ["check_warranty", imei, phone, deviceModel],
        queryFn: async () => {
            const { data, error } = await supabase.rpc("check_active_warranty", {
                p_imei: imei || null,
                p_phone: phone || null,
                p_device_model: deviceModel || null,
            });

            if (error) throw error;
            return data && data.length > 0 ? data[0] : null;
        },
        enabled: !!(imei || (phone && deviceModel)),
    });
};

// Hook to create warranty card
export const useCreateWarrantyCard = () => {
    const { profile } = useAuth();
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: CreateWarrantyCardInput) => {
            const warrantyStartDate = new Date();
            const warrantyEndDate = new Date();
            warrantyEndDate.setMonth(warrantyEndDate.getMonth() + input.warranty_period_months);

            const { data, error } = await supabase
                .from("warranty_cards")
                .insert({
                    customer_name: input.customer_name,
                    customer_phone: input.customer_phone,
                    device_model: input.device_model,
                    imei_serial: input.imei_serial,
                    warranty_start_date: warrantyStartDate.toISOString().split('T')[0],
                    warranty_end_date: warrantyEndDate.toISOString().split('T')[0],
                    warranty_period_months: input.warranty_period_months,
                    warranty_type: input.warranty_type || 'standard',
                    covered_parts: input.covered_parts || ['screen', 'battery', 'mainboard'],
                    coverage_terms: input.coverage_terms,
                    work_order_id: input.work_order_id,
                    issued_by: profile?.email,
                    branch_id: profile?.branch_id,
                    notes: input.notes,
                })
                .select()
                .single();

            if (error) throw error;
            return data as WarrantyCard;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
        },
    });
};

// Hook to create warranty claim
export const useCreateWarrantyClaim = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            warrantyCardId,
            workOrderId,
            issueDescription,
            partsReplaced,
        }: {
            warrantyCardId: string;
            workOrderId: string;
            issueDescription?: string;
            partsReplaced?: any[];
        }) => {
            const { data, error } = await supabase
                .from("warranty_claims")
                .insert({
                    warranty_card_id: warrantyCardId,
                    work_order_id: workOrderId,
                    issue_description: issueDescription,
                    parts_replaced: partsReplaced || [],
                    status: 'pending',
                })
                .select()
                .single();

            if (error) throw error;

            // Update work order to mark as warranty claim
            await supabase
                .from("work_orders")
                .update({
                    is_warranty_claim: true,
                    warranty_card_id: warrantyCardId,
                    warranty_claim_id: data.id,
                })
                .eq("id", workOrderId);

            return data as WarrantyClaim;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
            queryClient.invalidateQueries({ queryKey: ["workOrders"] });
        },
    });
};

// Hook to get warranty claims
export const useWarrantyClaims = (warrantyCardId?: string) => {
    return useQuery({
        queryKey: ["warranty_claims", warrantyCardId],
        queryFn: async () => {
            let query = supabase
                .from("warranty_claims")
                .select("*, warranty_cards(*), work_orders(*)")
                .order("created_at", { ascending: false });

            if (warrantyCardId) {
                query = query.eq("warranty_card_id", warrantyCardId);
            }

            const { data, error } = await query;
            if (error) throw error;
            return data;
        },
        enabled: true,
    });
};

// Hook to update warranty card status
export const useUpdateWarrantyStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            status,
            notes,
        }: {
            id: string;
            status: 'active' | 'expired' | 'voided' | 'claimed';
            notes?: string;
        }) => {
            const { data, error } = await supabase
                .from("warranty_cards")
                .update({ status, notes, updated_at: new Date().toISOString() })
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
        },
    });
};
