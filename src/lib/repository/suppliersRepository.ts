import { supabase } from "../../supabaseClient";
import type { Supplier } from "../../types";
import { RepoResult, success, failure } from "./types";
// import { safeAudit } from "./auditLogsRepository";

const SUPPLIERS_TABLE = "suppliers";

export async function fetchSuppliers(): Promise<RepoResult<Supplier[]>> {
  try {
    const { data, error } = await supabase
      .from(SUPPLIERS_TABLE)
      .select("*")
      .order("name");
    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải nhà cung cấp",
        cause: error,
      });
    return success(data || []);
  } catch (e: any) {
    return failure({ code: "network", message: "Lỗi kết nối", cause: e });
  }
}

export async function createSupplier(
  input: Partial<Supplier>
): Promise<RepoResult<Supplier>> {
  try {
    if (!input.name)
      return failure({ code: "validation", message: "Thiếu tên nhà cung cấp" });
    const payload: any = {
      id:
        typeof crypto !== "undefined" && (crypto as any).randomUUID
          ? (crypto as any).randomUUID()
          : `${Math.random().toString(36).slice(2)}-${Date.now()}`,
      name: input.name,
      phone: input.phone,
      address: input.address,
      created_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from(SUPPLIERS_TABLE)
      .insert([payload])
      .select()
      .single();
    if (error || !data) {
      // Bổ sung thông tin chi tiết để dễ debug lỗi 400/403
      const msg =
        (error as any)?.message ||
        (error as any)?.details ||
        "Tạo nhà cung cấp thất bại";
      return failure({
        code: "supabase",
        message: msg,
        cause: error,
      });
    }
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed
    return success(data as Supplier);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo nhà cung cấp",
      cause: e,
    });
  }
}

export async function updateSupplier(
  id: string,
  updates: Partial<Supplier>
): Promise<RepoResult<Supplier>> {
  try {
    let oldRow: any = null;
    try {
      const resp: any = await supabase
        .from(SUPPLIERS_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      oldRow = resp?.data ?? null;
    } catch { }
    const { data, error } = await supabase
      .from(SUPPLIERS_TABLE)
      .update({ ...updates })
      .eq("id", id)
      .select()
      .single();
    if (error)
      return failure({
        code: "supabase",
        message: "Cập nhật nhà cung cấp thất bại",
        cause: error,
      });
    let userId: string | null = null;
    try {
      const { data: userData } = await supabase.auth.getUser();
      userId = userData?.user?.id || null;
    } catch { }
    // Audit removed
    return success((data || { id, ...oldRow, ...updates }) as Supplier);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật nhà cung cấp",
      cause: e,
    });
  }
}

export async function deleteSupplier(
  id: string
): Promise<RepoResult<{ id: string }>> {
  try {
    let oldRow: any = null;
    try {
      const resp: any = await supabase
        .from(SUPPLIERS_TABLE)
        .select("*")
        .eq("id", id)
        .single();
      oldRow = resp?.data ?? null;
    } catch { }
    const { error } = await supabase
      .from(SUPPLIERS_TABLE)
      .delete()
      .eq("id", id);
    if (error)
      return failure({
        code: "supabase",
        message: "Xóa nhà cung cấp thất bại",
        cause: error,
      });
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
      message: "Lỗi kết nối khi xóa nhà cung cấp",
      cause: e,
    });
  }
}
