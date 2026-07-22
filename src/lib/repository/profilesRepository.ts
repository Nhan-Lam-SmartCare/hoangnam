import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";

export interface ProfileLike {
  id: string;
  name: string | null;
  full_name: string | null;
  email: string | null;
  role: string | null;
  branch_id: string | null;
}

export async function fetchProfilesForTechnicians(): Promise<RepoResult<ProfileLike[]>> {
  try {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, full_name, email, role, branch_id")
      .order("name");
    if (error) {
      return failure({
        code: "supabase",
        message: "Lỗi tải danh sách hồ sơ kỹ thuật viên",
        cause: error,
      });
    }
    return success(data || []);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải danh sách hồ sơ",
      cause: e,
    });
  }
}
