import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";

const TABLE = "notifications";

export interface CreateNotificationInput {
  type: string;
  title: string;
  message: string;
  data?: Record<string, any>;
  createdBy?: string | null;
  recipientRole?: string;
  branchId?: string | null;
}

/** Tạo một thông báo mới (gửi đến vai trò nhận). */
export async function createNotification(
  input: CreateNotificationInput
): Promise<RepoResult<null>> {
  try {
    const { error } = await supabase.from(TABLE).insert({
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      message: input.message,
      data: input.data ?? {},
      created_by: input.createdBy ?? null,
      recipient_role: input.recipientRole ?? "owner",
      branch_id: input.branchId ?? null,
      is_read: false,
      created_at: new Date().toISOString(),
    });

    if (error) {
      return failure({
        code: "supabase",
        message: "Không thể tạo thông báo",
        cause: error,
      });
    }
    return success(null);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tạo thông báo",
      cause: e,
    });
  }
}
