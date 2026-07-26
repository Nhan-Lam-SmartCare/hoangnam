/**
 * partUnitsRepository — truy cập bảng `part_units` (tồn kho theo TỪNG MÁY).
 *
 * Bối cảnh: xem {@link PartUnit} trong src/types.ts và
 * sql/2026-07-26_create_part_units.sql.
 *
 * Quy ước: mọi hàm trả `RepoResult<T>`, không throw cho lỗi nghiệp vụ.
 * Các thao tác đổi trạng thái đi qua RPC `SECURITY DEFINER` chứ không UPDATE
 * trực tiếp, vì:
 *   - IMEI phải duy nhất TOÀN HỆ THỐNG, trong khi RLS chặn staff nhìn sang chi
 *     nhánh khác. RPC chạy quyền owner mới kiểm tra xuyên chi nhánh được.
 *   - Đánh dấu "đã bán" cần `SELECT ... FOR UPDATE` để hai người bán cùng một
 *     chiếc máy thì đúng một người thắng. Client không khóa hàng được.
 */
import { supabase } from "../../supabaseClient";
import { RepoResult, success, failure } from "./types";
import type {
  PartUnit,
  PartUnitImeiConflict,
  PartUnitStatus,
  PartUnitWithPart,
} from "../../types";

const TABLE = "part_units";

/** Cột DB là snake_case; phần còn lại của app dùng camelCase. */
function normalizeUnitRow(row: any): PartUnit {
  return {
    id: String(row?.id || ""),
    partId: String(row?.part_id || ""),
    branchId: String(row?.branch_id || ""),
    imei: String(row?.imei || ""),
    color: row?.color || undefined,
    importPrice: Number(row?.import_price || 0),
    sellingPrice:
      row?.selling_price === null || row?.selling_price === undefined
        ? undefined
        : Number(row.selling_price),
    status: (row?.status || "in_stock") as PartUnitStatus,
    isPlaceholder: Boolean(row?.is_placeholder),
    receiptCode: row?.receipt_code || undefined,
    supplierId: row?.supplier_id || undefined,
    receivedAt: row?.received_at || row?.created_at || "",
    soldAt: row?.sold_at || undefined,
    saleId: row?.sale_id || undefined,
    workOrderId: row?.work_order_id || undefined,
    warrantyCardId: row?.warranty_card_id || undefined,
    note: row?.note || undefined,
  };
}

const SELECT_COLS =
  "id,part_id,branch_id,imei,color,import_price,selling_price,status," +
  "is_placeholder,receipt_code,supplier_id,received_at,sold_at,sale_id," +
  "work_order_id,warranty_card_id,note,created_at";

/**
 * Danh sách máy của một sản phẩm tại một chi nhánh.
 * Bỏ trống `statuses` để lấy tất cả (kể cả đã bán — dùng cho lịch sử).
 */
export async function fetchUnitsByPart(
  partId: string,
  branchId: string,
  statuses?: PartUnitStatus[]
): Promise<RepoResult<PartUnit[]>> {
  try {
    if (!partId) {
      return failure({ code: "validation", message: "Thiếu mã sản phẩm" });
    }

    let query = supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .eq("part_id", partId)
      .order("received_at", { ascending: true });

    if (branchId) query = query.eq("branch_id", branchId);
    if (statuses?.length) query = query.in("status", statuses);

    const { data, error } = await query;
    if (error) {
      return failure({
        code: "supabase",
        message: `Không tải được danh sách máy: ${error.message}`,
        cause: error,
      });
    }

    return success((data || []).map(normalizeUnitRow));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải danh sách máy",
      cause: e,
    });
  }
}

/** Máy còn bán được. Đây là truy vấn nóng nhất ở màn Bán hàng. */
export async function fetchAvailableUnits(
  partId: string,
  branchId: string
): Promise<RepoResult<PartUnit[]>> {
  return fetchUnitsByPart(partId, branchId, ["in_stock"]);
}

/**
 * Số máy CÒN TRONG KHO của nhiều sản phẩm cùng lúc, để bảng tồn kho biết dòng
 * nào có chi tiết IMEI mà không phải bắn một query cho mỗi dòng.
 *
 * Chỉ đếm `in_stock`: đây là con số đem so với `parts.stock` để phát hiện lệch.
 */
export async function fetchUnitCountsByParts(
  partIds: string[],
  branchId: string
): Promise<RepoResult<Record<string, number>>> {
  try {
    const ids = Array.from(new Set((partIds || []).filter(Boolean)));
    if (ids.length === 0) return success({});

    let query = supabase
      .from(TABLE)
      .select("part_id")
      .in("part_id", ids)
      .eq("status", "in_stock");

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) {
      return failure({
        code: "supabase",
        message: `Không đếm được số máy: ${error.message}`,
        cause: error,
      });
    }

    const counts: Record<string, number> = {};
    for (const row of data || []) {
      const pid = String((row as any)?.part_id || "");
      if (!pid) continue;
      counts[pid] = (counts[pid] || 0) + 1;
    }
    return success(counts);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi đếm số máy",
      cause: e,
    });
  }
}

/**
 * Tìm máy theo IMEI (khớp một phần, không phân biệt hoa thường).
 * Dùng cho ô tìm kiếm kho và tra bảo hành.
 *
 * Tên sản phẩm lấy bằng query thứ hai thay vì embed PostgREST: người dùng tìm
 * IMEI là để biết "máy này là máy nào", một kết quả thiếu tên thì vô dụng — nên
 * không đánh cược vào việc PostgREST suy ra đúng quan hệ khoá ngoại.
 */
export async function searchUnitsByImei(
  keyword: string,
  branchId?: string,
  limit = 20
): Promise<RepoResult<PartUnitWithPart[]>> {
  try {
    const q = (keyword || "").trim();
    if (!q) return success([]);

    let query = supabase
      .from(TABLE)
      .select(SELECT_COLS)
      .ilike("imei", `%${q}%`)
      .limit(limit);

    if (branchId) query = query.eq("branch_id", branchId);

    const { data, error } = await query;
    if (error) {
      return failure({
        code: "supabase",
        message: `Không tìm được IMEI: ${error.message}`,
        cause: error,
      });
    }

    const units = (data || []).map(normalizeUnitRow);
    if (units.length === 0) return success([]);

    const partIds = Array.from(new Set(units.map((u) => u.partId)));
    const { data: parts, error: partsError } = await supabase
      .from("parts")
      .select("id,name,sku")
      .in("id", partIds);

    // Thiếu tên sản phẩm không đáng để bỏ cả kết quả tìm kiếm — vẫn trả IMEI.
    if (partsError) {
      console.warn("[partUnits] Không tải được tên sản phẩm:", partsError.message);
    }

    const nameById = new Map<string, { name: string; sku?: string }>();
    for (const p of parts || []) {
      nameById.set(String((p as any).id), {
        name: String((p as any).name || ""),
        sku: (p as any).sku || undefined,
      });
    }

    return success(
      units.map((u) => ({
        ...u,
        partName: nameById.get(u.partId)?.name || "(không rõ sản phẩm)",
        partSku: nameById.get(u.partId)?.sku,
      }))
    );
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tìm IMEI",
      cause: e,
    });
  }
}

/**
 * Tiền kiểm IMEI TRƯỚC khi lưu phiếu nhập.
 *
 * `receipt_create_atomic` đã tự kiểm tra bên trong rồi, nên hàm này thuần túy để
 * UI cảnh báo SỚM — ngay lúc nhân viên vừa gõ xong, thay vì đợi bấm NHẬP KHO.
 *
 * Mảng rỗng = tất cả IMEI đều dùng được.
 */
export async function checkImeis(
  imeis: string[]
): Promise<RepoResult<PartUnitImeiConflict[]>> {
  try {
    const clean = (imeis || [])
      .map((s) => (s || "").trim())
      .filter((s) => s.length > 0);

    if (clean.length === 0) return success([]);

    const { data, error } = await supabase.rpc("part_units_check_imeis", {
      p_imeis: clean,
    });

    if (error) {
      return failure({
        code: "supabase",
        message: `Không kiểm tra được IMEI: ${error.message}`,
        cause: error,
      });
    }

    const rows = Array.isArray(data) ? data : [];
    return success(
      rows.map((r: any) => ({
        imei: String(r?.imei || ""),
        status: (r?.status || "in_stock") as PartUnitStatus,
        partName: String(r?.partName || ""),
        soldAt: r?.soldAt || undefined,
      }))
    );
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi kiểm tra IMEI",
      cause: e,
    });
  }
}

/**
 * Đánh dấu các máy đã bán. Hoặc TẤT CẢ chuyển sang 'sold', hoặc KHÔNG máy nào —
 * RPC khóa hàng bằng FOR UPDATE nên chống được hai phiên bán trùng một máy.
 */
export async function markUnitsSold(
  unitIds: string[],
  saleId: string,
  soldAt?: string
): Promise<RepoResult<number>> {
  try {
    const ids = (unitIds || []).filter(Boolean);
    if (ids.length === 0) return success(0);

    const { data, error } = await supabase.rpc("part_units_mark_sold", {
      p_unit_ids: ids,
      p_sale_id: saleId,
      p_sold_at: soldAt || new Date().toISOString(),
    });

    if (error) {
      return failure({
        code: "supabase",
        message: `Không cập nhật được trạng thái máy: ${error.message}`,
        cause: error,
      });
    }

    if (data && data.success === false) {
      return failure({
        code: "validation",
        message: data.message || "Máy không còn khả dụng để bán",
      });
    }

    return success(Number(data?.updated || 0));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật trạng thái máy",
      cause: e,
    });
  }
}

/** Hoàn máy về kho (hủy đơn / khách trả hàng). Cập nhật trên cùng dòng cũ. */
export async function releaseUnits(
  unitIds: string[],
  reason?: string
): Promise<RepoResult<number>> {
  try {
    const ids = (unitIds || []).filter(Boolean);
    if (ids.length === 0) return success(0);

    const { data, error } = await supabase.rpc("part_units_release", {
      p_unit_ids: ids,
      p_reason: reason || null,
    });

    if (error) {
      return failure({
        code: "supabase",
        message: `Không hoàn được máy về kho: ${error.message}`,
        cause: error,
      });
    }

    return success(Number(data?.updated || 0));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi hoàn máy về kho",
      cause: e,
    });
  }
}

/** Hoàn toàn bộ máy của một đơn bán. */
export async function releaseUnitsBySale(
  saleId: string,
  reason?: string
): Promise<RepoResult<number>> {
  try {
    if (!saleId) return success(0);

    const { data, error } = await supabase.rpc("part_units_release_by_sale", {
      p_sale_id: saleId,
      p_reason: reason || null,
    });

    if (error) {
      return failure({
        code: "supabase",
        message: `Không hoàn được máy của đơn ${saleId}: ${error.message}`,
        cause: error,
      });
    }

    return success(Number(data?.updated || 0));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi hoàn máy của đơn bán",
      cause: e,
    });
  }
}

/**
 * Sửa thông tin một máy (điền IMEI thật cho dòng placeholder, đổi màu, ghi chú).
 * Không cho đổi `status` qua đây — trạng thái chỉ đi qua RPC để giữ tính nguyên tử.
 */
export async function updateUnit(
  id: string,
  patch: Partial<Pick<PartUnit, "imei" | "color" | "sellingPrice" | "note">>
): Promise<RepoResult<PartUnit>> {
  try {
    if (!id) return failure({ code: "validation", message: "Thiếu mã máy" });

    const payload: Record<string, any> = {};
    if (patch.imei !== undefined) {
      const imei = (patch.imei || "").trim();
      if (!imei) {
        return failure({ code: "validation", message: "IMEI không được để trống" });
      }
      payload.imei = imei;
      // Điền IMEI thật xong thì hết là placeholder.
      payload.is_placeholder = false;
    }
    if (patch.color !== undefined) payload.color = (patch.color || "").trim() || null;
    if (patch.sellingPrice !== undefined) payload.selling_price = patch.sellingPrice ?? null;
    if (patch.note !== undefined) payload.note = (patch.note || "").trim() || null;

    if (Object.keys(payload).length === 0) {
      return failure({ code: "validation", message: "Không có gì để cập nhật" });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .update(payload)
      .eq("id", id)
      .select(SELECT_COLS)
      .single();

    if (error || !data) {
      const isDuplicate = String(error?.code) === "23505";
      return failure({
        code: isDuplicate ? "validation" : "supabase",
        message: isDuplicate
          ? `IMEI ${payload.imei} đã tồn tại trong hệ thống`
          : `Cập nhật máy thất bại: ${error?.message || "Lỗi không xác định"}`,
        cause: error,
      });
    }

    return success(normalizeUnitRow(data));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật máy",
      cause: e,
    });
  }
}
