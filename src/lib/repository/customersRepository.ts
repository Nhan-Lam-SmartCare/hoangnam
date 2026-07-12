import { supabase } from "../../supabaseClient";
import type { Customer } from "../../types";
import { RepoResult, success, failure } from "./types";

const TABLE = "customers";

/** Tìm khách hàng theo id (chỉ lấy id để xác nhận tồn tại). */
export async function findCustomerById(
  id: string
): Promise<RepoResult<Customer | null>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id")
      .eq("id", id)
      .single();
    if (error) {
      // .single() trả lỗi khi không có dòng — coi như không tìm thấy, không phải lỗi CSDL.
      return success(null);
    }
    return success(data ? ({ id: data.id } as Customer) : null);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tìm khách hàng",
      cause: e,
    });
  }
}

/** Tìm khách hàng trùng số điện thoại (lấy 1 dòng để gộp xe/thông tin). */
export async function findDuplicateCustomerByPhone(
  phone: string
): Promise<RepoResult<any | null>> {
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("id, name, vehiclemodel, licenseplate, vehicles")
      .eq("phone", phone)
      .limit(1);
    if (error) {
      return failure({
        code: "supabase",
        message: "Lỗi tìm khách hàng trùng số điện thoại",
        cause: error,
      });
    }
    return success(data && data.length > 0 ? data[0] : null);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tìm khách hàng trùng",
      cause: e,
    });
  }
}

/**
 * Cập nhật khách hàng, thử lần lượt nhiều payload (tương thích schema cột khác nhau).
 * Trả success nếu 1 payload thành công; failure với lỗi cuối nếu tất cả đều lỗi.
 */
export async function updateCustomerWithFallback(
  customerId: string,
  payloads: Array<Record<string, any>>
): Promise<RepoResult<null>> {
  let lastError: any = null;
  for (const payload of payloads) {
    const { error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", customerId);
    if (!error) return success(null);
    lastError = error;
  }
  return failure({
    code: "supabase",
    message: "Lỗi cập nhật khách hàng",
    cause: lastError,
  });
}

/**
 * Thêm khách hàng, thử lần lượt nhiều payload (tương thích schema cột khác nhau).
 * Trả success nếu 1 payload thành công; failure với lỗi cuối nếu tất cả đều lỗi.
 */
export async function insertCustomerWithFallback(
  payloads: Array<Record<string, any>>
): Promise<RepoResult<null>> {
  let lastError: any = null;
  for (const payload of payloads) {
    const { error } = await supabase.from(TABLE).insert([payload]);
    if (!error) return success(null);
    lastError = error;
  }
  return failure({
    code: "supabase",
    message: "Lỗi thêm khách hàng",
    cause: lastError,
  });
}
