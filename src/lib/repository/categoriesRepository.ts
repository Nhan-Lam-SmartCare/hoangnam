import { supabase } from "../../supabaseClient";
import type { Category } from "../../types";
import { RepoResult, success, failure } from "./types";
// import { safeAudit } from "./auditLogsRepository";

const CATEGORIES_TABLE = "categories";

export async function fetchCategories(): Promise<RepoResult<Category[]>> {
  try {
    const { data, error } = await supabase
      .from(CATEGORIES_TABLE)
      .select("*")
      .order("name");
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh mục",
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

export async function createCategory(
  input: Partial<Category>
): Promise<RepoResult<Category>> {
  try {
    if (!input.name)
      return failure({ code: "validation", message: "Thiếu tên danh mục" });
    const payload: any = {
      id:
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: input.name,
      icon: input.icon,
      color: input.color,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(CATEGORIES_TABLE)
      .insert([payload])
      .select()
      .single();
    if (error || !data)
      return failure({
        code: "supabase",
        message: "Tạo danh mục thất bại",
        cause: error,
      });
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed
    return success(data as Category);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo danh mục",
      cause: e,
    });
  }
}

export async function updateCategory(
  id: string,
  updates: Partial<Category>
): Promise<RepoResult<Category>> {
  try {
    let oldRow: any = null;
    try {
      const resp: any = await supabase
        .from(CATEGORIES_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      oldRow = resp?.data ?? null;
    } catch { }
    // Không có oldRow vẫn tiếp tục (audit oldData: null)
    const { data, error } = await supabase
      .from(CATEGORIES_TABLE)
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    let resultRow: any = data;
    if ((!data || error) && !error) {
      // No data returned but also no supabase error => synthesize row (mock case)
      resultRow = { id, ...(oldRow || {}), ...updates };
    }
    if (error && data == null) {
      return failure({
        code: "supabase",
        message: "Cập nhật danh mục thất bại",
        cause: error,
      });
    }
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed
    return success(resultRow as Category);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật danh mục",
      cause: e,
    });
  }
}

export async function deleteCategoryRecord(
  id: string
): Promise<RepoResult<{ id: string }>> {
  try {
    let oldRow: any = null;
    try {
      const resp: any = await supabase
        .from(CATEGORIES_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      oldRow = resp?.data ?? null;
    } catch { }
    // Không có oldRow vẫn tiếp tục xóa (audit oldData: null)
    const { error } = await supabase
      .from(CATEGORIES_TABLE)
      .delete()
      .eq("id", id);
    if (error) {
      return failure({
        code: "supabase",
        message: "Xóa danh mục thất bại",
        cause: error,
      });
    }
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
      message: "Lỗi kết nối khi xóa danh mục",
      cause: e,
    });
  }
}
