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
    customer_id?: string;
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

const WARRANTY_CARD_TABLE_CANDIDATES = [
    "warranty_cards",
    "warrantycards",
    "warrantyCards",
] as const;

const WARRANTY_CLAIM_TABLE_CANDIDATES = [
    "warranty_claims",
    "warrantyclaims",
    "warrantyClaims",
] as const;

const isMissingTableError = (error: any, tableName?: string): boolean => {
    const code = String(error?.code || "").toUpperCase();
    const message = String(error?.message || "").toLowerCase();
    if (code !== "PGRST205") return false;
    if (!tableName) return true;
    return message.includes(String(tableName).toLowerCase());
};

const withPreferredTable = (
    candidates: readonly string[],
    preferredTable?: string | null
): string[] => {
    if (!preferredTable) return [...candidates];
    const filtered = candidates.filter((name) => name !== preferredTable);
    return [preferredTable, ...filtered];
};

const selectWarrantyCardsRows = async (preferredTable?: string | null) => {
    const tableNames = withPreferredTable(WARRANTY_CARD_TABLE_CANDIDATES, preferredTable);
    let lastMissingTableError: any = null;

    for (const tableName of tableNames) {
        const result = await supabase
            .from(tableName)
            .select("*")
            .order("created_at", { ascending: false });

        if (!result.error) {
            return { data: (result.data || []) as WarrantyCard[], error: null, tableName };
        }

        if (isMissingTableError(result.error, tableName)) {
            lastMissingTableError = result.error;
            continue;
        }

        return { data: null as WarrantyCard[] | null, error: result.error, tableName };
    }

    return {
        data: null as WarrantyCard[] | null,
        error: lastMissingTableError,
        tableName: tableNames[0] || "warranty_cards",
    };
};

const insertWarrantyCardRow = async (
    payload: Record<string, any>,
    preferredTable?: string | null
) => {
    const tableNames = withPreferredTable(WARRANTY_CARD_TABLE_CANDIDATES, preferredTable);
    let lastMissingTableError: any = null;

    for (const tableName of tableNames) {
        const result = await supabase
            .from(tableName)
            .insert(payload)
            .select()
            .single();

        if (!result.error) {
            return { data: result.data as WarrantyCard, error: null, tableName };
        }

        if (isMissingTableError(result.error, tableName)) {
            lastMissingTableError = result.error;
            continue;
        }

        return { data: null as WarrantyCard | null, error: result.error, tableName };
    }

    return {
        data: null as WarrantyCard | null,
        error: lastMissingTableError,
        tableName: tableNames[0] || "warranty_cards",
    };
};

const updateWarrantyCardRow = async (
    id: string,
    patch: Record<string, any>,
    preferredTable?: string | null
) => {
    const tableNames = withPreferredTable(WARRANTY_CARD_TABLE_CANDIDATES, preferredTable);
    let lastMissingTableError: any = null;

    for (const tableName of tableNames) {
        const result = await supabase
            .from(tableName)
            .update(patch)
            .eq("id", id)
            .select()
            .single();

        if (!result.error) {
            return { data: result.data, error: null, tableName };
        }

        if (isMissingTableError(result.error, tableName)) {
            lastMissingTableError = result.error;
            continue;
        }

        return { data: null, error: result.error, tableName };
    }

    return { data: null, error: lastMissingTableError, tableName: tableNames[0] || "warranty_cards" };
};

const deleteWarrantyCardRow = async (
    id: string,
    preferredTable?: string | null
) => {
    const tableNames = withPreferredTable(WARRANTY_CARD_TABLE_CANDIDATES, preferredTable);
    let lastMissingTableError: any = null;

    for (const tableName of tableNames) {
        const result = await supabase
            .from(tableName)
            .delete()
            .eq("id", id);

        if (!result.error) {
            return { ok: true, error: null, tableName };
        }

        if (isMissingTableError(result.error, tableName)) {
            lastMissingTableError = result.error;
            continue;
        }

        return { ok: false, error: result.error, tableName };
    }

    return { ok: false, error: lastMissingTableError, tableName: tableNames[0] || "warranty_cards" };
};

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
            const { data, error, tableName } = await selectWarrantyCardsRows();

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
                        const retry = await selectWarrantyCardsRows(tableName);
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
                    const retry = await selectWarrantyCardsRows(tableName);
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

    const getMissingColumnNameFromError = (error: any): string | null => {
        const code = String(error?.code || "").toUpperCase();
        const message = String(error?.message || "");
        if (code !== "PGRST204" && !message.toLowerCase().includes("column")) {
            return null;
        }

        const quoted = message.match(/column\s+["']?([a-zA-Z0-9_]+)["']?/i);
        if (quoted?.[1]) return quoted[1];
        const direct = message.match(/'([a-zA-Z0-9_]+)'/);
        if (direct?.[1]) return direct[1];
        return null;
    };

    const getNotNullColumnNameFromError = (error: any): string | null => {
        const code = String(error?.code || "").toUpperCase();
        const message = String(error?.message || "");
        if (code !== "23502" && !message.toLowerCase().includes("null value in column")) {
            return null;
        }
        const match = message.match(/column\s+"([a-zA-Z0-9_]+)"/i);
        return match?.[1] || null;
    };

    const removeMissingColumnKeys = (record: Record<string, any>, missingColumn: string): number => {
        const target = String(missingColumn || "").toLowerCase();
        if (!target) return 0;
        let removed = 0;
        for (const key of Object.keys(record)) {
            if (key.toLowerCase() === target) {
                delete record[key];
                removed += 1;
            }
        }
        return removed;
    };

    const applyNotNullFallback = (
        payload: Record<string, any>,
        columnName: string,
        customerId: string
    ): boolean => {
        const col = String(columnName || "").toLowerCase();
        if (!col) return false;

        if (col === "customer_id" || col === "customerid") {
            payload[columnName] = customerId;
            return true;
        }
        if (col === "status") {
            payload[columnName] = "active";
            return true;
        }
        if (col === "branch_id" || col === "branchid") {
            payload[columnName] = profile?.branch_id || "CN1";
            return true;
        }
        return false;
    };

    const formatBackendError = (error: any): string => {
        const code = String(error?.code || "").trim();
        const message = String(error?.message || "").trim();
        const details = String(error?.details || "").trim();
        const hint = String(error?.hint || "").trim();

                if (code === "PGRST205") {
                    return "Thiếu bảng bảo hành trên Supabase (warranty_cards). Vui lòng chạy script sql/2026-04-11_create_warranty_tables.sql trong SQL Editor.";
                }

        const parts = [message, details, hint].filter(Boolean);
        if (parts.length === 0 && code) {
            return `Lỗi tạo phiếu bảo hành (${code}).`;
        }
        if (code) {
            return `${parts.join(" | ")} (${code})`;
        }
        return parts.join(" | ") || "Không thể tạo phiếu bảo hành.";
    };

    const resolveCustomerId = async (input: CreateWarrantyCardInput): Promise<string | null> => {
        if (input.customer_id) {
            return input.customer_id;
        }

        const rawName = String(input.customer_name || "").trim();
        const rawPhone = String(input.customer_phone || "").trim();
        if (!rawName && !rawPhone) {
            return null;
        }

        if (rawPhone) {
            const byPhone = await supabase
                .from("customers")
                .select("id, name, branch_id")
                .eq("phone", rawPhone)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!byPhone.error && byPhone.data?.id) {
                const patch: Record<string, any> = {
                    lastvisit: new Date().toISOString(),
                };
                if (rawName && String(byPhone.data.name || "").trim() !== rawName) {
                    patch.name = rawName;
                }
                if (!byPhone.data.branch_id && profile?.branch_id) {
                    patch.branch_id = profile.branch_id;
                }
                await supabase.from("customers").update(patch).eq("id", byPhone.data.id);
                return String(byPhone.data.id);
            }
        }

        if (rawName) {
            const byName = await supabase
                .from("customers")
                .select("id, phone, branch_id")
                .ilike("name", rawName)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
            if (!byName.error && byName.data?.id) {
                const patch: Record<string, any> = {
                    lastvisit: new Date().toISOString(),
                };
                if (rawPhone && !String(byName.data.phone || "").trim()) {
                    patch.phone = rawPhone;
                }
                if (!byName.data.branch_id && profile?.branch_id) {
                    patch.branch_id = profile.branch_id;
                }
                await supabase.from("customers").update(patch).eq("id", byName.data.id);
                return String(byName.data.id);
            }
        }

        const newCustomerId = `CUS-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
        const payloadCandidates: Array<Record<string, any>> = [
            {
                id: newCustomerId,
                name: rawName || "Khách hàng",
                phone: rawPhone || null,
                branch_id: profile?.branch_id || null,
                status: "active",
                segment: "New",
                lastvisit: new Date().toISOString(),
            },
            {
                id: newCustomerId,
                name: rawName || "Khách hàng",
                phone: rawPhone || null,
                branch_id: profile?.branch_id || null,
            },
            {
                id: newCustomerId,
                name: rawName || "Khách hàng",
                phone: rawPhone || null,
            },
        ];

        for (const payload of payloadCandidates) {
            const created = await supabase
                .from("customers")
                .insert([payload])
                .select("id")
                .maybeSingle();

            if (!created.error && created.data?.id) {
                return String(created.data.id);
            }

            if (String(created.error?.code || "") === "23505" && rawPhone) {
                const conflict = await supabase
                    .from("customers")
                    .select("id")
                    .eq("phone", rawPhone)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                if (!conflict.error && conflict.data?.id) {
                    return String(conflict.data.id);
                }
            }
        }

        return null;
    };

    return useMutation({
        mutationFn: async (input: CreateWarrantyCardInput) => {
            if (!String(input.customer_name || "").trim() && !String(input.customer_phone || "").trim()) {
                throw new Error("Vui lòng nhập tên hoặc số điện thoại để liên kết khách hàng trước khi cấp phiếu bảo hành.");
            }

            const customerId = await resolveCustomerId(input);
            if (!customerId) {
                throw new Error("Không thể liên kết khách hàng. Vui lòng kiểm tra lại tên/số điện thoại và thử lại.");
            }

            const warrantyStartDate = new Date();
            const warrantyEndDate = new Date();
            warrantyEndDate.setMonth(warrantyEndDate.getMonth() + input.warranty_period_months);

            const insertPayload: Record<string, any> = {
                customer_id: customerId,
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
                branch_id: profile?.branch_id || 'CN1',
                status: 'active',
                notes: input.notes,
            };

            for (const key of Object.keys(insertPayload)) {
                if (insertPayload[key] === undefined) {
                    delete insertPayload[key];
                }
            }

            const workingPayload = { ...insertPayload };
            let result = await insertWarrantyCardRow(workingPayload);
            const activeTable = result.tableName;

            for (let i = 0; i < 20 && result.error; i += 1) {
                const missingColumn = getMissingColumnNameFromError(result.error);
                if (missingColumn) {
                    const removed = removeMissingColumnKeys(workingPayload, missingColumn);
                    if (removed > 0) {
                        result = await insertWarrantyCardRow(workingPayload, activeTable);
                        continue;
                    }
                }

                const notNullColumn = getNotNullColumnNameFromError(result.error);
                if (notNullColumn) {
                    const patched = applyNotNullFallback(workingPayload, notNullColumn, customerId);
                    if (patched) {
                        result = await insertWarrantyCardRow(workingPayload, activeTable);
                        continue;
                    }
                }

                break;
            }

            if (result.error) {
                throw new Error(formatBackendError(result.error));
            }
            return result.data as WarrantyCard;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
            queryClient.invalidateQueries({ queryKey: ["customers"] });
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
    const { profile } = useAuth();
    const profileBranchId =
        profile?.branch_id || (profile as any)?.branchId || null;

    return useQuery({
        queryKey: ["warranty_claims", profileBranchId || "all", warrantyCardId],
        queryFn: async () => {
            let lastMissingTableError: any = null;
            for (const tableName of WARRANTY_CLAIM_TABLE_CANDIDATES) {
                let query = supabase
                    .from(tableName)
                    .select("*, warranty_cards(*), work_orders(*)")
                    .order("created_at", { ascending: false });

                if (warrantyCardId) {
                    query = query.eq("warranty_card_id", warrantyCardId);
                }

                const { data, error } = await query;
                if (!error) {
                    const rows = data || [];
                    if (!profileBranchId) return rows;

                    // Filter claims by their associated warranty card's branch_id
                    return rows.filter((claim: any) => {
                        const cardBranchId =
                            claim?.warranty_cards?.branch_id ??
                            claim?.warranty_cards?.branchid ??
                            claim?.warranty_cards?.branchId ??
                            null;
                        if (!cardBranchId) return true; // Keep legacy claims with no card branch info
                        return String(cardBranchId) === String(profileBranchId);
                    });
                }

                if (isMissingTableError(error, tableName)) {
                    lastMissingTableError = error;
                    continue;
                }

                throw error;
            }

            if (lastMissingTableError) return [];
            return [];
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
            const { data, error } = await updateWarrantyCardRow(
                id,
                { status, notes, updated_at: new Date().toISOString() }
            );

            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
        },
    });
};

export const useDeleteWarrantyCard = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (id: string) => {
            // Best effort: clear related claims first for schemas without ON DELETE CASCADE.
            for (const tableName of WARRANTY_CLAIM_TABLE_CANDIDATES) {
                const claimDelete = await supabase
                    .from(tableName)
                    .delete()
                    .eq("warranty_card_id", id);

                if (!claimDelete.error) break;
                if (isMissingTableError(claimDelete.error, tableName)) continue;
            }

            const result = await deleteWarrantyCardRow(id);
            if (!result.ok) {
                throw result.error || new Error("Không thể xóa phiếu bảo hành.");
            }
            return true;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["warranty_cards"] });
            queryClient.invalidateQueries({ queryKey: ["warranty_claims"] });
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
