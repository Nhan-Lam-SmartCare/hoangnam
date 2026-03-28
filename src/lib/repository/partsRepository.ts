import { supabase } from "../../supabaseClient";
import type { Part } from "../../types";
import { RepoResult, success, failure } from "./types";
// import { safeAudit } from "./auditLogsRepository";
import { generateSKU } from "../../utils/sku";

// Centralized table name constant
const PARTS_TABLE = "parts";

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
    return success(data || []);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
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
    return success((data || []) as Part[], { total: count, page, pageSize });
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
      category: input.category,
      description: input.description,
      warrantyPeriod: input.warrantyPeriod,
      // costPrice, vatRate không có trong schema parts của bản hiện tại => không insert
    };
    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .insert([payload])
      .select()
      .single();
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
    // Audit removed
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
    const { data, error } = await supabase
      .from(PARTS_TABLE)
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error || !data)
      return failure({
        code: "supabase",
        message: "Cập nhật phụ tùng thất bại",
        cause: error,
      });
    // Audit cập nhật phụ tùng
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed
    return success(data as Part);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật phụ tùng",
      cause: e,
    });
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
    // Audit removed
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
