import { supabase } from "../../supabaseClient";
import type { Part } from "../../types";
import { RepoResult, success, failure } from "./types";
import { safeAudit } from "./auditLogsRepository";
import { generateSKU } from "../../utils/sku";

// Centralized table name constant
const PARTS_TABLE = "parts";

function normalizePartRow(row: any): Part {
  const warranty =
    row?.warrantyPeriod ??
    row?.warrantyperiod ??
    row?.warranty_period ??
    row?.warranty ??
    undefined;

  return {
    ...(row || {}),
    warrantyPeriod: warranty,
  } as Part;
}

function getMissingColumnFromSupabaseError(err: any): string | null {
  const message = String(err?.message || "");
  const details = String(err?.details || "");
  const text = `${message} ${details}`;
  const match = text.match(/Could not find the '([^']+)' column/i);
  return match?.[1] || null;
}

async function insertPartWithSchemaFallback(payload: Record<string, any>) {
  const workingPayload: Record<string, any> = { ...payload };

  // Retry a few times in case DB schema is older and misses optional columns.
  for (let i = 0; i < 5; i++) {
    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .insert([workingPayload])
      .select()
      .single();

    if (!error && data) return { data, error: null };

    const missingColumn = getMissingColumnFromSupabaseError(error);
    if (!missingColumn || !(missingColumn in workingPayload)) {
      return { data: null, error };
    }

    delete workingPayload[missingColumn];
    console.warn(
      `[partsRepository] Missing column '${missingColumn}' in DB schema, retrying insert without it`
    );
  }

  return {
    data: null,
    error: { message: "Insert parts failed after schema fallback retries" },
  };
}

async function updatePartWithSchemaFallback(
  id: string,
  updates: Record<string, any>
) {
  const workingUpdates: Record<string, any> = { ...updates };

  for (let i = 0; i < 5; i++) {
    if (Object.keys(workingUpdates).length === 0) {
      return {
        data: null,
        error: {
          message:
            "Không có cột hợp lệ để cập nhật. Kiểm tra schema bảng parts (warrantyPeriod/warrantyperiod/warranty_period).",
        },
      };
    }

    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .update(workingUpdates)
      .eq("id", id)
      .select()
      .single();

    if (!error && data) return { data, error: null };

    const missingColumn = getMissingColumnFromSupabaseError(error);
    if (!missingColumn || !(missingColumn in workingUpdates)) {
      return { data: null, error };
    }

    delete workingUpdates[missingColumn];
    console.warn(
      `[partsRepository] Missing column '${missingColumn}' in DB schema, retrying update without it`
    );
  }

  return {
    data: null,
    error: { message: "Update parts failed after schema fallback retries" },
  };
}

// Fetch all parts
export async function fetchParts(): Promise<RepoResult<Part[]>> {
  try {
    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .select("*")
      .order("name");
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phụ tùng",
        cause: error,
      });
    return success((data || []).map((row: any) => normalizePartRow(row)));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

/**
 * Lấy TẤT CẢ phụ tùng để tính tổng tồn kho/giá trị (không phân trang).
 * Dùng "*" để tương thích DB thiếu cột optional. Lọc theo category nếu có.
 */
export async function fetchAllPartsForTotals(
  categoryFilter?: string
): Promise<RepoResult<Part[]>> {
  try {
    let query = supabase.from(PARTS_TABLE).select("*").order("name");
    if (categoryFilter && categoryFilter !== "all") {
      query = query.eq("category", categoryFilter);
    }
    const { data, error } = await query;
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải phụ tùng để tính tồn kho",
        cause: error,
      });
    return success((data || []).map((row: any) => normalizePartRow(row)));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải phụ tùng",
      cause: e,
    });
  }
}

/** Lấy các phụ tùng theo danh sách SKU (dùng cho lọc SKU trùng). */
export async function fetchPartsBySkus(
  skus: string[]
): Promise<RepoResult<Part[]>> {
  try {
    if (!skus || skus.length === 0) return success([]);
    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .select("*")
      .in("sku", skus)
      .order("sku");
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải phụ tùng theo SKU",
        cause: error,
      });
    return success((data || []).map((row: any) => normalizePartRow(row)));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải phụ tùng theo SKU",
      cause: e,
    });
  }
}

/** Tạo hàng loạt phụ tùng từ danh sách row đã dựng sẵn (dùng cho import Excel). */
export async function bulkCreateParts(
  rows: any[]
): Promise<RepoResult<void>> {
  try {
    if (!rows || rows.length === 0) return success(undefined);
    const { error } = await supabase.from(PARTS_TABLE).insert(rows).select();
    if (error)
      return failure({
        code: "supabase",
        message: `Lỗi tạo phụ tùng: ${error.message}`,
        cause: error,
      });
    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo phụ tùng hàng loạt",
      cause: e,
    });
  }
}

/**
 * Cập nhật hàng loạt tồn kho/giá phụ tùng (dùng cho import Excel).
 * Tolerant: lỗi từng item chỉ ghi log, không dừng cả batch (faithful với luồng cũ).
 * Trả danh sách id lỗi (nếu có) trong meta.
 */
export async function bulkUpdatePartStock(
  updates: Array<{
    id: string;
    stock?: any;
    costPrice?: any;
    retailPrice?: any;
    wholesalePrice?: any;
  }>
): Promise<RepoResult<{ failedIds: string[] }>> {
  const failedIds: string[] = [];
  try {
    for (const update of updates) {
      const { error } = await supabase
        .from(PARTS_TABLE)
        .update({
          stock: update.stock,
          costPrice: update.costPrice,
          retailPrice: update.retailPrice,
          wholesalePrice: update.wholesalePrice,
        })
        .eq("id", update.id);
      if (error) {
        console.error(`❌ Update error for part ${update.id}:`, error);
        failedIds.push(update.id);
      }
    }
    return success({ failedIds });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phụ tùng hàng loạt",
      cause: e,
    });
  }
}

// Fetch parts with pagination & optional filters
export async function fetchPartsPaged(params?: {
  page?: number; // 1-based
  pageSize?: number;
  search?: string; // match name or sku
  category?: string; // exact match
  branchId?: string; // lọc theo chi nhánh (hoặc sản phẩm global chưa gán)
}): Promise<RepoResult<Part[]>> {
  try {
    const pageSize =
      params?.pageSize && params.pageSize > 0 ? params.pageSize : 50;
    const page = params?.page && params.page > 0 ? params.page : 1;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;
    let query = supabase
      .from(PARTS_TABLE)
      .select("*", { count: "exact" })
      .order("name")
      .range(from, to);
    if (params?.category && params.category !== "all") {
      query = query.eq("category", params.category);
    }
    if (params?.branchId) {
      // Show products assigned to this branch, or legacy global products without a branch assigned
      query = query.or(`branch_id.eq.${params.branchId},branch_id.is.null`);
    }
    if (params?.search && params.search.trim()) {
      const term = params.search.trim().toLowerCase();

      // Loại bỏ ký tự đặc biệt để tìm kiếm tốt hơn
      // VD: Tìm "NHB35P" sẽ tìm thấy 'Bộ nắp trước tay lái "NHB35P"'
      const cleanTerm = term.replace(/['"]/g, ""); // Xóa dấu ngoặc kép/đơn

      // Tìm kiếm trong name, sku, category, description
      // Supabase chỉ hỗ trợ OR, không hỗ trợ AND cho nhiều điều kiện phức tạp
      // Giải pháp: Tìm với OR, sau đó filter ở client nếu cần
      query = query.or(
        `name.ilike.%${cleanTerm}%,sku.ilike.%${cleanTerm}%,category.ilike.%${cleanTerm}%,description.ilike.%${cleanTerm}%`
      );
    }
    const { data, error, count } = await query;
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phụ tùng (phân trang)",
        cause: error,
      });
    return success(
      (data || []).map((row: any) => normalizePartRow(row)),
      { total: count, page, pageSize }
    );
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ khi tải phụ tùng (phân trang)",
      cause: e,
    });
  }
}

// Create a part
export async function createPart(
  input: Partial<Part>
): Promise<RepoResult<Part>> {
  try {
    if (!input.name)
      return failure({ code: "validation", message: "Thiếu tên phụ tùng" });

    // Generate unique 8-character SKU if not provided
    const generatedSKU = input.sku || generateSKU();

    const payload: any = {
      id:
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: input.name,
      sku: generatedSKU,
      stock: input.stock || { CN1: 0 },
      retailPrice: input.retailPrice || { CN1: 0 },
      wholesalePrice: input.wholesalePrice || { CN1: 0 },
      laborCost: (input as any).laborCost,
      category: input.category,
      description: input.description,
      warrantyPeriod: input.warrantyPeriod,
      // Legacy DB compatibility: some deployments used different column names
      warrantyperiod: input.warrantyPeriod,
      warranty_period: input.warrantyPeriod,
      warranty: input.warrantyPeriod,
      branch_id: (input as any).branch_id || (input as any).branchId || null,
      // costPrice, vatRate không có trong schema parts của bản hiện tại => không insert
    };
    const { data, error } = await insertPartWithSchemaFallback(payload);
    if (error || !data) {
      const msg =
        (error as any)?.message ||
        (error as any)?.details ||
        "Tạo phụ tùng thất bại";
      return failure({ code: "supabase", message: msg, cause: error });
    }
    // Audit tạo phụ tùng
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    safeAudit(userId, {
      action: "part.create",
      entityType: "part",
      entityId: (data as any)?.id,
      details: { name: input.name, sku: (data as any)?.sku },
    });
    return success(data as Part);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo phụ tùng",
      cause: e,
    });
  }
}

// Update a part by id
export async function updatePart(
  id: string,
  updates: Partial<Part>
): Promise<RepoResult<Part>> {
  try {
    // Lấy dữ liệu cũ để audit
    const { data: oldRows, error: oldErr } = await supabase
      .from(PARTS_TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (oldErr || !oldRows) {
      return failure({
        code: "supabase",
        message: "Không tìm thấy phụ tùng để cập nhật",
        cause: oldErr,
      });
    }
    const updatePayload: Record<string, any> = {
      ...(updates as Record<string, any>),
    };

    if (Object.prototype.hasOwnProperty.call(updates, "warrantyPeriod")) {
      updatePayload.warrantyperiod = (updates as any).warrantyPeriod;
      updatePayload.warranty_period = (updates as any).warrantyPeriod;
      updatePayload.warranty = (updates as any).warrantyPeriod;
    }
    
    if (Object.prototype.hasOwnProperty.call(updates, "branch_id")) {
      updatePayload.branch_id = (updates as any).branch_id;
    } else if (Object.prototype.hasOwnProperty.call(updates, "branchId")) {
      updatePayload.branch_id = (updates as any).branchId;
    }

    const { data, error } = await updatePartWithSchemaFallback(id, updatePayload);
    if (error || !data)
      return failure({
        code: "supabase",
        message: "Cập nhật phụ tùng thất bại",
        cause: error,
      });

    if (Object.prototype.hasOwnProperty.call(updates, "warrantyPeriod")) {
      const expectedWarranty = String((updates as any).warrantyPeriod || "").trim();
      if (expectedWarranty) {
        const savedWarranty = String(
          (data as any)?.warrantyPeriod ??
          (data as any)?.warrantyperiod ??
          (data as any)?.warranty_period ??
          (data as any)?.warranty ??
          ""
        ).trim();

        if (savedWarranty !== expectedWarranty) {
          return failure({
            code: "supabase",
            message:
              "Không lưu được bảo hành. Cần thêm cột bảo hành trong bảng parts (warranty hoặc warrantyPeriod).",
          });
        }
      }
    }
    // Audit cập nhật phụ tùng
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    safeAudit(userId, {
      action: "part.update",
      entityType: "part",
      entityId: id,
      details: { name: (data as any)?.name, changes: Object.keys(updates) },
    });
    return success(data as Part);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phụ tùng",
      cause: e,
    });
  }
}

/**
 * Trừ kho nguyên tử cho một phiếu bán hàng.
 *
 * Ưu tiên gọi RPC `sale_decrement_stock_atomic` (khóa hàng + kiểm tra + trừ kho
 * trong cùng transaction) để tránh bán âm khi nhiều thiết bị bán cùng lúc.
 * Nếu RPC chưa được cài đặt trên CSDL, tự fallback về read-modify-write từng phụ
 * tùng (giữ tương thích với schema cũ).
 */
export async function decrementStockForSale(
  items: Array<{ partId: string; quantity: number }>,
  branchId: string
): Promise<RepoResult<{ mode: "rpc" | "fallback"; failedParts?: string[] }>> {
  const aggregated = items.reduce<Record<string, number>>((acc, it) => {
    if (!it.partId || !(it.quantity > 0)) return acc;
    acc[it.partId] = (acc[it.partId] || 0) + it.quantity;
    return acc;
  }, {});

  const payloadItems = Object.entries(aggregated).map(([partId, quantity]) => ({
    partId,
    quantity,
  }));

  if (payloadItems.length === 0) {
    return success({ mode: "rpc" });
  }

  const isMissingRpc = (err: any) => {
    const code = String(err?.code || "").toUpperCase();
    const text = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
    return (
      code === "PGRST202" || text.includes("sale_decrement_stock_atomic")
    );
  };

  const runFallback = async (): Promise<
    RepoResult<{ mode: "rpc" | "fallback"; failedParts?: string[] }>
  > => {
    const failedParts: string[] = [];
    for (const { partId, quantity } of payloadItems) {
      const { data: row, error: readErr } = await supabase
        .from(PARTS_TABLE)
        .select("stock, name")
        .eq("id", partId)
        .single();
      if (readErr || !row) {
        failedParts.push(partId);
        continue;
      }
      const stockMap = ((row as any).stock || {}) as Record<string, number>;
      const current = Number(stockMap[branchId] || 0);
      if (current < quantity) {
        failedParts.push((row as any).name || partId);
        continue;
      }
      const nextStockMap = {
        ...stockMap,
        [branchId]: current - quantity,
      };
      const { error: updErr } = await supabase
        .from(PARTS_TABLE)
        .update({ stock: nextStockMap })
        .eq("id", partId);
      if (updErr) {
        failedParts.push((row as any).name || partId);
      }
    }
    return success({ mode: "fallback", failedParts });
  };

  try {
    const { data, error } = await supabase.rpc("sale_decrement_stock_atomic", {
      p_items: payloadItems,
      p_branch_id: branchId,
    });

    if (error) {
      if (isMissingRpc(error)) {
        return await runFallback();
      }
      return failure({
        code: "supabase",
        message: error.message || "Trừ kho thất bại",
        cause: error,
      });
    }

    if (data && data.success === false) {
      return failure({
        code: "validation",
        message: data.message || "Không đủ tồn kho để xuất bán",
        cause: data.insufficient,
      });
    }

    return success({ mode: "rpc" });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi trừ kho",
      cause: e,
    });
  }
}

/**
 * Hoàn kho nguyên tử khi hủy/hoàn một phiếu bán hàng (cộng trả lại tồn kho).
 *
 * Ưu tiên RPC `sale_increment_stock_atomic` (khóa hàng + cộng kho trong cùng
 * transaction) để tránh race condition read-modify-write khi nhiều thiết bị thao
 * tác cùng lúc. Nếu RPC chưa được cài trên CSDL, tự fallback về read-modify-write
 * từng phụ tùng (giữ tương thích với schema cũ).
 */
export async function incrementStockForReturn(
  items: Array<{ partId: string; quantity: number }>,
  branchId: string
): Promise<RepoResult<{ mode: "rpc" | "fallback"; failedParts?: string[] }>> {
  const aggregated = items.reduce<Record<string, number>>((acc, it) => {
    if (!it.partId || !(it.quantity > 0)) return acc;
    acc[it.partId] = (acc[it.partId] || 0) + it.quantity;
    return acc;
  }, {});

  const payloadItems = Object.entries(aggregated).map(([partId, quantity]) => ({
    partId,
    quantity,
  }));

  if (payloadItems.length === 0) {
    return success({ mode: "rpc" });
  }

  const isMissingRpc = (err: any) => {
    const code = String(err?.code || "").toUpperCase();
    const text = `${err?.message || ""} ${err?.details || ""}`.toLowerCase();
    return code === "PGRST202" || text.includes("sale_increment_stock_atomic");
  };

  const runFallback = async (): Promise<
    RepoResult<{ mode: "rpc" | "fallback"; failedParts?: string[] }>
  > => {
    const failedParts: string[] = [];
    for (const { partId, quantity } of payloadItems) {
      const { data: row, error: readErr } = await supabase
        .from(PARTS_TABLE)
        .select("stock, name")
        .eq("id", partId)
        .single();
      if (readErr || !row) {
        failedParts.push(partId);
        continue;
      }
      const stockMap = ((row as any).stock || {}) as Record<string, number>;
      const current = Number(stockMap[branchId] || 0);
      const nextStockMap = {
        ...stockMap,
        [branchId]: Math.max(0, current + quantity),
      };
      const { error: updErr } = await supabase
        .from(PARTS_TABLE)
        .update({ stock: nextStockMap })
        .eq("id", partId);
      if (updErr) {
        failedParts.push((row as any).name || partId);
      }
    }
    return success({ mode: "fallback", failedParts });
  };

  try {
    // supabase.rpc có thể chưa tồn tại trong môi trường test/cũ -> bọc try/catch.
    if (typeof (supabase as any).rpc !== "function") {
      return await runFallback();
    }

    const { data, error } = await supabase.rpc("sale_increment_stock_atomic", {
      p_items: payloadItems,
      p_branch_id: branchId,
    });

    if (error) {
      if (isMissingRpc(error)) {
        return await runFallback();
      }
      return failure({
        code: "supabase",
        message: error.message || "Hoàn kho thất bại",
        cause: error,
      });
    }

    if (data && data.success === false) {
      return failure({
        code: "validation",
        message: data.message || "Hoàn kho thất bại",
        cause: data,
      });
    }

    return success({ mode: "rpc" });
  } catch (e: any) {
    // RPC không khả dụng (vd: môi trường test mock thiếu .rpc) -> thử fallback.
    try {
      return await runFallback();
    } catch (inner: any) {
      return failure({
        code: "network",
        message: "Lỗi kết nối khi hoàn kho",
        cause: inner || e,
      });
    }
  }
}

// Batch rename category using one SQL update
export async function renameCategory(
  oldName: string,
  newName: string
): Promise<RepoResult<{ updated: number }>> {
  try {
    if (!newName.trim())
      return failure({
        code: "validation",
        message: "Tên danh mục mới không hợp lệ",
      });
    const { error, data } = await supabase
      .from(PARTS_TABLE)
      .update({ category: newName })
      .eq("category", oldName)
      .select("id");

    if (error)
      return failure({
        code: "supabase",
        message: "Đổi tên danh mục thất bại",
        cause: error,
      });
    return success({ updated: (data as any[] | null)?.length || 0 });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi đổi tên danh mục",
      cause: e,
    });
  }
}

// Delete category = set category NULL on affected parts
export async function deleteCategory(
  name: string
): Promise<RepoResult<{ updated: number }>> {
  try {
    const { error, data } = await supabase
      .from(PARTS_TABLE)
      .update({ category: null })
      .eq("category", name)
      .select("id");
    if (error)
      return failure({
        code: "supabase",
        message: "Xóa danh mục thất bại",
        cause: error,
      });
    return success({ updated: (data as any[] | null)?.length || 0 });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa danh mục",
      cause: e,
    });
  }
}

// Delete a part by id
export async function deletePartById(
  id: string
): Promise<RepoResult<{ id: string }>> {
  try {
    // Lấy dữ liệu cũ để audit
    const { data: oldRows, error: oldErr } = await supabase
      .from(PARTS_TABLE)
      .select("*")
      .eq("id", id)
      .single();
    if (oldErr || !oldRows) {
      return failure({
        code: "supabase",
        message: "Không tìm thấy phụ tùng để xóa",
        cause: oldErr,
      });
    }
    const { error } = await supabase.from(PARTS_TABLE).delete().eq("id", id);
    if (error)
      return failure({
        code: "supabase",
        message: "Xóa phụ tùng thất bại",
        cause: error,
      });
    // Audit xóa phụ tùng
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    safeAudit(userId, {
      action: "part.delete",
      entityType: "part",
      entityId: id,
      details: { name: (oldRows as any)?.name, sku: (oldRows as any)?.sku },
    });
    return success({ id });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa phụ tùng",
      cause: e,
    });
  }
}

// Find a part by SKU
export async function fetchPartBySku(
  sku: string
): Promise<RepoResult<Part | null>> {
  try {
    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .select("*")
      .eq("sku", sku)
      .maybeSingle();
    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể tìm phụ tùng theo SKU",
        cause: error,
      });
    }
    return success((data as Part) || null);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tìm phụ tùng theo SKU",
      cause: e,
    });
  }
}

/**
 * Tính tồn kho khả dụng = tồn kho thực - đã đặt trước
 * @param part - Phụ tùng cần tính
 * @param branchId - Chi nhánh
 * @returns Số lượng khả dụng
 */
export function getAvailableStock(part: Part, branchId: string): number {
  const stock = part.stock?.[branchId] ?? 0;
  const reserved = part.reservedStock?.[branchId] ?? 0;
  return Math.max(0, stock - reserved);
}

/**
 * Lấy thông tin tồn kho khả dụng cho tất cả chi nhánh
 * @param part - Phụ tùng cần tính
 * @returns Object chứa tồn kho khả dụng theo chi nhánh
 */
export function getAvailableStockAll(part: Part): {
  [branchId: string]: number;
} {
  const result: { [branchId: string]: number } = {};
  const branches = Object.keys(part.stock || {});

  for (const branchId of branches) {
    result[branchId] = getAvailableStock(part, branchId);
  }

  return result;
}
