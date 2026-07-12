import { supabase } from "../../supabaseClient";
import { failure, RepoResult, success } from "./types";

export interface BranchRecord {
  id: string;
  name: string;
  isActive?: boolean;
  created_at?: string;
  updated_at?: string;
}

const TABLE = "branches";

const mapBranch = (row: any): BranchRecord => ({
  id: String(row?.id || "").trim(),
  name: String(row?.name || row?.branch_name || row?.id || "").trim(),
  isActive: row?.is_active ?? row?.isActive ?? true,
  created_at: row?.created_at,
  updated_at: row?.updated_at,
});

export async function fetchBranches(): Promise<RepoResult<BranchRecord[]>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return success([{ id: "CN1", name: "Chi nhánh 1", isActive: true }]);
    }

    const branches = (data || []).map(mapBranch).filter((branch) => branch.id);
    return success(
      branches.length > 0 ? branches : [{ id: "CN1", name: "Chi nhánh 1", isActive: true }]
    );
  } catch (error: any) {
    return failure({
      code: "network",
      message: "Không thể tải danh sách chi nhánh",
      cause: error,
    });
  }
}

export async function upsertBranch(
  branch: Pick<BranchRecord, "id" | "name"> & Partial<BranchRecord>
): Promise<RepoResult<BranchRecord>> {
  try {
    const id = String(branch.id || "").trim();
    const name = String(branch.name || "").trim();

    if (!id) return failure({ code: "validation", message: "Thiếu mã chi nhánh" });
    if (!name) return failure({ code: "validation", message: "Thiếu tên chi nhánh" });

    const payload: Record<string, any> = {
      id,
      name,
      is_active: branch.isActive ?? true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(TABLE)
      .upsert(payload, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể lưu chi nhánh",
        cause: error,
      });
    }

    return success(mapBranch(data));
  } catch (error: any) {
    return failure({
      code: "network",
      message: "Không thể lưu chi nhánh",
      cause: error,
    });
  }
}
