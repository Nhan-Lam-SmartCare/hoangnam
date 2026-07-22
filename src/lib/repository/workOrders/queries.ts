import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { RepoResult, success, failure } from "../types";
import { normalizeWorkOrder } from "./normalize";
import { attachRepairServices } from "./internal";

const WORK_ORDERS_TABLE = "work_orders";

export async function fetchWorkOrders(): Promise<RepoResult<WorkOrder[]>> {
  try {
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("creationDate", { ascending: false }) // Fixed casing
      .limit(100); // Only load 100 most recent orders

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    const normalized = (data || []).map(normalizeWorkOrder);
    return success(await attachRepairServices(normalized));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

// Optimized fetch with filtering and pagination
export async function fetchWorkOrdersFiltered(options?: {
  limit?: number;
  daysBack?: number;
  status?: string;
  branchId?: string;
  ownerUserId?: string;
  ownerDisplayName?: string;
}): Promise<RepoResult<WorkOrder[]>> {
  try {
    const {
      limit = 100, // Default load 100 recent orders
      daysBack = 7, // Default 7 days back
      status,
      branchId,
      ownerUserId,
      ownerDisplayName,
    } = options || {};

    const normalizedOwnerId = String(ownerUserId || "").trim();
    const normalizedOwnerName = String(ownerDisplayName || "").trim().toLowerCase();

    const applyCommonFilters = (query: any) => {
      let nextQuery = query
        .order("creationDate", { ascending: false }) // Fixed casing
        .limit(limit);

      // Filter by date (last N days) - if daysBack is 0, load all
      if (daysBack > 0) {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        nextQuery = nextQuery.gte("creationDate", startDate.toISOString()); // Fixed casing
      }

      // Filter by status
      if (status && status !== "all") {
        nextQuery = nextQuery.eq("status", status);
      }

      // Filter by branch
      if (branchId && branchId !== "all") {
        nextQuery = nextQuery.eq("branchId", branchId); // Fixed casing
      }

      return nextQuery;
    };

    const isMissingColumnError = (err: any, columnName: string) => {
      const code = String(err?.code || "").toUpperCase();
      const message = String(err?.message || "").toLowerCase();
      const details = String(err?.details || "").toLowerCase();
      const hint = String(err?.hint || "").toLowerCase();
      const needle = columnName.toLowerCase();
      return (
        code === "PGRST204" ||
        message.includes("column") ||
        details.includes("column") ||
        hint.includes("column")
      ) && (message.includes(needle) || details.includes(needle) || hint.includes(needle));
    };

    let data: any[] | null = null;
    let error: any = null;

    if (normalizedOwnerId) {
      const ownerColumns = ["created_by", "createdBy", "createdby"];

      for (let i = 0; i < ownerColumns.length; i++) {
        const ownerColumn = ownerColumns[i];
        const query = applyCommonFilters(
          supabase.from(WORK_ORDERS_TABLE).select("*")
        ).eq(ownerColumn, normalizedOwnerId);

        const res = await query;
        data = res.data;
        error = res.error;

        if (!error) {
          break;
        }

        // Try next ownership column when current schema does not have this column.
        if (isMissingColumnError(error, ownerColumn) && i < ownerColumns.length - 1) {
          continue;
        }

        break;
      }

      // Final fallback for old schema: filter by assigned technician name to avoid showing all tickets.
      if (error && isMissingColumnError(error, "createdby")) {
        const fallbackRes = await applyCommonFilters(
          supabase.from(WORK_ORDERS_TABLE).select("*")
        );
        data = fallbackRes.data;
        error = fallbackRes.error;
        if (!error) {
          if (!normalizedOwnerName) {
            data = [];
          } else {
            const allOrders = (data || []).map(normalizeWorkOrder);
            const filteredByTechnician = allOrders.filter(
              (order) => String(order.technicianName || "").trim().toLowerCase() === normalizedOwnerName
            );
            return success(await attachRepairServices(filteredByTechnician));
          }
        }
      }
    } else {
      const res = await applyCommonFilters(
        supabase.from(WORK_ORDERS_TABLE).select("*")
      );
      data = res.data;
      error = res.error;
    }

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách phiếu sửa chữa",
        cause: error,
      });
    const normalized = (data || []).map(normalizeWorkOrder);
    return success(await attachRepairServices(normalized));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}
