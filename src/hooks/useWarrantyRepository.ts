import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { backfillWarrantyCardsForExistingWorkOrders } from "../lib/repository/workOrdersRepository";

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
    work_order_id?: string;
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
    updated_at?: string;
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

const parseWarrantyMonths = (raw: unknown): number => {
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return 0;
    const numMatch = text.match(/\d+/);
    if (!numMatch) return 0;
    const value = Number(numMatch[0]);
    if (!Number.isFinite(value) || value <= 0) return 0;
    if (text.includes("năm") || text.includes("nam") || text.includes("year")) {
        return value * 12;
    }
    return value;
};

const normalizeStatusKey = (raw: unknown): string =>
    String(raw || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();

const shouldGenerateWarrantyLike = (statusRaw: unknown, paymentStatusRaw: unknown): boolean => {
    const statusKey = normalizeStatusKey(statusRaw);
    const paymentStatusKey = normalizeStatusKey(paymentStatusRaw);
    const isPaid =
        paymentStatusKey === "paid" ||
        paymentStatusKey === "da thanh toan" ||
        paymentStatusKey === "thanh toan" ||
        paymentStatusKey === "completed";
    const isCompletedStatus =
        statusKey === "da sua xong" ||
        statusKey === "tra may" ||
        statusKey === "hoan tat" ||
        statusKey === "completed";
    const isCanceled =
        statusKey === "da huy" ||
        statusKey === "huy" ||
        statusKey === "cancelled" ||
        statusKey === "canceled";
    return !isCanceled && (isPaid || isCompletedStatus);
};

const deriveWarrantyCardsFromWorkOrders = async (
    profileBranchId: string | null
): Promise<WarrantyCard[]> => {
    const { data: orders, error } = await supabase
        .from("work_orders")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(500);

    if (error || !orders) return [];

    const today = new Date();
    const fallbackRows: WarrantyCard[] = [];

    for (const row of orders as any[]) {
        const rowBranch =
            row?.branch_id ?? row?.branchid ?? row?.branchId ?? "CN1";

        if (profileBranchId && String(rowBranch) !== String(profileBranchId)) {
            continue;
        }

        const status = row?.status;
        const paymentStatus = row?.paymentStatus ?? row?.paymentstatus;
        if (!shouldGenerateWarrantyLike(status, paymentStatus)) continue;

        const parts = Array.isArray(row?.partsUsed)
            ? row.partsUsed
            : Array.isArray(row?.partsused)
                ? row.partsused
                : [];
        if (parts.length === 0) continue;

        const startBase = row?.creationDate || row?.creationdate || row?.created_at || new Date().toISOString();
        const startDate = new Date(startBase);

        parts.forEach((part: any, idx: number) => {
            const months = parseWarrantyMonths(
                part?.warrantyPeriod ??
                part?.warrantyperiod ??
                part?.warranty_period ??
                part?.warranty ??
                ""
            );
            if (months <= 0) return;

            const qty = Math.max(1, Number(part?.quantity || 1));
            for (let i = 0; i < qty; i += 1) {
                const endDate = new Date(startDate);
                endDate.setMonth(endDate.getMonth() + months);
                const isExpired = endDate < today;

                fallbackRows.push({
                    id: `WO-${row.id}-${String(part?.partId || part?.partid || idx)}-${i}`,
                    customer_name: row?.customerName || row?.customername || "Khách lẻ",
                    customer_phone: row?.customerPhone || row?.customerphone || null,
                    device_model: part?.partName || part?.part_name || "Sản phẩm",
                    imei_serial: part?.sku || row?.licensePlate || row?.licenseplate || null,
                    warranty_start_date: startDate.toISOString().slice(0, 10),
                    warranty_end_date: endDate.toISOString().slice(0, 10),
                    warranty_period_months: months,
                    warranty_type: "standard",
                    covered_parts: ["Lỗi kỹ thuật do nhà sản xuất"],
                    coverage_terms: "Dữ liệu tạm dựng từ phiếu sửa chữa",
                    work_order_id: row?.id,
                    issued_by: "Hệ thống",
                    branch_id: String(rowBranch || "CN1"),
                    status: isExpired ? "expired" : "active",
                    notes: "AUTO-FALLBACK-WO",
                    created_at: String(startBase),
                    updated_at: new Date().toISOString(),
                });
            }
        });
    }

    return fallbackRows;
};

// Hook to fetch warranty cards
export const useWarrantyCards = () => {
    const { profile } = useAuth();
    const profileBranchId =
        profile?.branch_id || (profile as any)?.branchId || null;

    return useQuery({
        queryKey: ["warranty_cards", profileBranchId || "all"],
        queryFn: async () => {
            const query = supabase
                .from("warranty_cards")
                .select("*")
                .order("created_at", { ascending: false });
            const { data, error } = await query;

            if (error) {
                const fallbackRows = await deriveWarrantyCardsFromWorkOrders(profileBranchId ? String(profileBranchId) : null);
                if (fallbackRows.length > 0) return fallbackRows;
                throw error;
            }

            const rows = (data || []) as WarrantyCard[];
            if (!profileBranchId) {
                if (rows.length === 0) {
                    const refill = await backfillWarrantyCardsForExistingWorkOrders();
                    if (refill.ok && refill.data.created > 0) {
                        const retry = await supabase
                            .from("warranty_cards")
                            .select("*")
                            .order("created_at", { ascending: false });
                        if (!retry.error && retry.data) {
                            return retry.data as WarrantyCard[];
                        }
                    }

                    const fallbackRows = await deriveWarrantyCardsFromWorkOrders(null);
                    if (fallbackRows.length > 0) return fallbackRows;
                }
                return rows;
            }

            const filtered = rows.filter((row: any) => {
                const rowBranchId =
                    row?.branch_id ?? row?.branchid ?? row?.branchId ?? null;

                // Old rows may not have branch column; keep visible instead of hiding all.
                if (!rowBranchId) return true;

                return String(rowBranchId) === String(profileBranchId);
            });

            if (filtered.length === 0) {
                let refill = await backfillWarrantyCardsForExistingWorkOrders(
                    String(profileBranchId)
                );
                if (refill.ok && refill.data.created === 0) {
                    refill = await backfillWarrantyCardsForExistingWorkOrders();
                }
                if (refill.ok && refill.data.created > 0) {
                    const retry = await supabase
                        .from("warranty_cards")
                        .select("*")
                        .order("created_at", { ascending: false });
                    if (!retry.error && retry.data) {
                        return (retry.data as WarrantyCard[]).filter((row: any) => {
                            const rowBranchId =
                                row?.branch_id ?? row?.branchid ?? row?.branchId ?? null;
                            if (!rowBranchId) return true;
                            return String(rowBranchId) === String(profileBranchId);
                        });
                    }
                }

                const fallbackRows = await deriveWarrantyCardsFromWorkOrders(String(profileBranchId));
                if (fallbackRows.length > 0) return fallbackRows;

                // Fallback for legacy branch id formats (e.g. CN1 vs UUID):
                // if rows exist but none match exactly, show available rows instead of empty state.
                if (rows.length > 0) {
                    return rows;
                }
            }

            return filtered;
        },
        enabled: true,
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
            workOrderId?: string;
            issueDescription?: string;
            partsReplaced?: any[];
        }) => {
            const { data, error } = await supabase
                .from("warranty_claims")
                .insert({
                    warranty_card_id: warrantyCardId,
                    work_order_id: workOrderId || null,
                    issue_description: issueDescription,
                    parts_replaced: partsReplaced || [],
                    status: 'pending',
                })
                .select()
                .single();

            if (error) throw error;

            // Update work order to mark as warranty claim if a work order id is provided.
            if (workOrderId) {
                const { error: woError } = await supabase
                    .from("work_orders")
                    .update({
                        is_warranty_claim: true,
                        warranty_card_id: warrantyCardId,
                        warranty_claim_id: data.id,
                    })
                    .eq("id", workOrderId);

                // Ignore work order update failure to avoid blocking claim creation.
                if (woError) {
                    // no-op
                }
            }

            return data as WarrantyClaim;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
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

// Hook to update warranty claim status
export const useUpdateWarrantyClaimStatus = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            id,
            status,
            denialReason,
            actor,
        }: {
            id: string;
            status: 'pending' | 'approved' | 'rejected' | 'completed';
            denialReason?: string;
            actor?: string;
        }) => {
            const nowIso = new Date().toISOString();
            const patch: Record<string, any> = {
                status,
                updated_at: nowIso,
            };

            if (status === "rejected") {
                const baseReason = denialReason || "Không thuộc phạm vi bảo hành";
                patch.denial_reason = actor
                    ? `[${nowIso}] ${actor}: ${baseReason}`
                    : `[${nowIso}] ${baseReason}`;
                if (actor) {
                    patch.approved_by = actor;
                }
            }
            if (status === "approved") {
                if (actor) {
                    patch.approved_by = actor;
                }
            }
            if (status === "completed") {
                patch.completed_at = nowIso;
                if (actor) {
                    patch.completed_by = actor;
                }
            }

            const { data, error } = await supabase
                .from("warranty_claims")
                .update(patch)
                .eq("id", id)
                .select()
                .single();

            if (error) throw error;
            return data as WarrantyClaim;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
        },
    });
};
