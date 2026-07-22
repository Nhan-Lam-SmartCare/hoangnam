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

/** Tìm kiếm khách hàng theo tên hoặc số điện thoại (phân trang). */
export async function searchCustomers(
  searchTerm: string,
  page: number,
  pageSize: number
): Promise<RepoResult<{ data: any[]; count: number | null }>> {
  try {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const { data, error, count } = await supabase
      .from(TABLE)
      .select("*", { count: "exact", head: false })
      .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
      .range(from, to);

    if (error) {
      return failure({
        code: "supabase",
        message: "Lỗi truy vấn danh sách khách hàng",
        cause: error,
      });
    }

    return success({ data: data || [], count });
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tìm kiếm khách hàng",
      cause: e,
    });
  }
}

/** Lấy thông tin thống kê của khách hàng theo số điện thoại (hỗ trợ camelCase/snake_case). */
export async function getCustomerStatsByPhone(
  phone: string
): Promise<RepoResult<{ id: string; totalSpent: number; visitCount: number } | null>> {
  try {
    const { data: camelCustomer, error: camelError } = await supabase
      .from(TABLE)
      .select("id, totalSpent, visitCount")
      .eq("phone", phone)
      .maybeSingle();

    if (!camelError && camelCustomer) {
      return success({
        id: camelCustomer.id,
        totalSpent: camelCustomer.totalSpent || 0,
        visitCount: camelCustomer.visitCount || 0,
      });
    }

    const { data: lowerCustomer, error: lowerError } = await supabase
      .from(TABLE)
      .select("id, totalspent, visitcount")
      .eq("phone", phone)
      .maybeSingle();

    if (lowerError) {
      return failure({
        code: "supabase",
        message: "Lỗi truy vấn thông tin khách hàng",
        cause: lowerError,
      });
    }

    return success(
      lowerCustomer
        ? {
            id: lowerCustomer.id,
            totalSpent: lowerCustomer.totalspent || 0,
            visitCount: lowerCustomer.visitcount || 0,
          }
        : null
    );
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi lấy thống kê khách hàng",
      cause: e,
    });
  }
}

/** Cập nhật thống kê khách hàng. */
export async function updateCustomerStats(
  id: string,
  totalSpent: number,
  visitCount: number
): Promise<RepoResult<null>> {
  const payloads = [
    {
      totalSpent,
      visitCount,
      lastVisit: new Date().toISOString(),
    },
    {
      totalspent: totalSpent,
      visitcount: visitCount,
      lastvisit: new Date().toISOString(),
    },
  ];
  return updateCustomerWithFallback(id, payloads);
}

/** Cập nhật danh sách xe của khách hàng. */
export async function updateCustomerVehicles(
  customerId: string,
  vehicles: any[]
): Promise<RepoResult<null>> {
  const payloads = [{ vehicles }];
  return updateCustomerWithFallback(customerId, payloads);
}
