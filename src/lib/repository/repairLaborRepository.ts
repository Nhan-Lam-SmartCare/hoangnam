import { supabase } from "../../supabaseClient";
import type {
  RepairOrderService,
  RepairOrderServiceItem,
  RepairOrderServiceWorker,
  ServiceConfig,
  WorkerMonthlySalary,
} from "../../types";
import { computeMonthlySalarySummary } from "../services/repairLaborService";
import { failure, success, type RepoResult } from "./types";

const SERVICES_TABLE = "services";
const REPAIR_ORDER_SERVICES_TABLE = "repair_order_services";
const REPAIR_ORDER_SERVICE_WORKERS_TABLE = "repair_order_service_workers";
const REPAIR_ORDER_SERVICE_ITEMS_TABLE = "repair_order_service_items";

const toNumber = (value: unknown) => Number(value || 0);

const isWorkOrderCanceledOrRefunded = (order: any): boolean => {
  const status = String(order?.status || "").trim().toLowerCase();
  const refunded =
    order?.refunded === true ||
    String(order?.refunded || "").toLowerCase() === "true" ||
    Number(order?.refunded || 0) === 1;

  return refunded || status === "đã hủy" || status === "da huy" || status === "cancelled";
};

const pickWorkOrderEffectiveDate = (order: any): string | null => {
  return (
    order?.paymentDate ||
    order?.paymentdate ||
    order?.updated_at ||
    order?.updatedAt ||
    order?.creationDate ||
    order?.creationdate ||
    order?.created_at ||
    null
  );
};

const isDateInMonth = (rawDate: string | null, month: number, year: number): boolean => {
  if (!rawDate) return false;
  const dt = new Date(rawDate);
  if (Number.isNaN(dt.getTime())) return false;
  return dt.getMonth() + 1 === month && dt.getFullYear() === year;
};

async function fetchWorkOrdersByTechnicianName(workerName: string): Promise<any[]> {
  if (!workerName?.trim()) return [];

  const orderBuckets: any[] = [];
  const orderQueries = [
    supabase.from("work_orders").select("*").ilike("technicianname", workerName),
    supabase.from("work_orders").select("*").ilike("technicianName", workerName),
  ];

  for (const query of orderQueries) {
    const { data, error } = await query;
    if (!error && data) {
      orderBuckets.push(...data);
    }
  }

  const orderMap = new Map<string, any>();
  for (const order of orderBuckets) {
    if (!order?.id) continue;
    if (!orderMap.has(order.id)) {
      orderMap.set(order.id, order);
    }
  }

  return Array.from(orderMap.values());
}

async function fetchOrderIdsWithWorkerSplit(
  workerId: string,
  orderIds: string[]
): Promise<Set<string>> {
  if (orderIds.length === 0) return new Set<string>();

  const { data: serviceRows } = await supabase
    .from(REPAIR_ORDER_SERVICES_TABLE)
    .select("id, repair_order_id")
    .in("repair_order_id", orderIds);

  const serviceIdToOrderId = new Map<string, string>();
  for (const row of serviceRows || []) {
    if (row?.id && row?.repair_order_id) {
      serviceIdToOrderId.set(row.id, row.repair_order_id);
    }
  }

  const serviceIds = Array.from(serviceIdToOrderId.keys());
  if (serviceIds.length === 0) return new Set<string>();

  const { data: workerRows } = await supabase
    .from(REPAIR_ORDER_SERVICE_WORKERS_TABLE)
    .select("repair_order_service_id")
    .eq("worker_id", workerId)
    .in("repair_order_service_id", serviceIds);

  const orderIdsWithWorkerSplit = new Set<string>();
  for (const row of workerRows || []) {
    const orderId = serviceIdToOrderId.get(row?.repair_order_service_id);
    if (orderId) orderIdsWithWorkerSplit.add(orderId);
  }

  return orderIdsWithWorkerSplit;
}

async function getManualLaborFallback(
  workerId: string,
  workerName: string,
  month: number,
  year: number
): Promise<{ amount: number; count: number }> {
  const orders = (await fetchWorkOrdersByTechnicianName(workerName)).filter((order) => {
    if (isWorkOrderCanceledOrRefunded(order)) return false;
    return isDateInMonth(pickWorkOrderEffectiveDate(order), month, year);
  });

  if (orders.length === 0) {
    return { amount: 0, count: 0 };
  }

  const orderIds = orders.map((o) => o.id);
  const orderIdsWithWorkerSplit = await fetchOrderIdsWithWorkerSplit(workerId, orderIds);

  const manualOrders = orders.filter((order) => !orderIdsWithWorkerSplit.has(order.id));
  const manualAmount = manualOrders.reduce(
    (sum, order) => sum + toNumber(order.laborcost || order.laborCost || 0),
    0
  );

  return {
    amount: manualAmount,
    count: manualOrders.filter((order) => toNumber(order.laborcost || order.laborCost || 0) > 0).length,
  };
}

function normalizeServiceConfig(row: any): ServiceConfig {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    description: row.description,
    laborCalcType: row.labor_calc_type || "fixed",
    laborFixedAmount: toNumber(row.labor_fixed_amount),
    laborPercentOfCost: toNumber(row.labor_percent_of_cost),
    minimumLaborAmount: toNumber(row.minimum_labor_amount),
    defaultWorkerSharePercent: toNumber(row.default_worker_share_percent || 30),
    isActive: row.is_active ?? true,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function normalizeRepairOrderServiceWorker(row: any): RepairOrderServiceWorker {
  return {
    id: row.id,
    repairOrderServiceId: row.repair_order_service_id,
    workerId: row.worker_id,
    workerName: row.worker_name || row.employees?.name,
    sharePercent: toNumber(row.share_percent),
    workerAmount: toNumber(row.worker_amount),
    createdAt: row.created_at,
  };
}

function normalizeRepairOrderServiceItem(row: any): RepairOrderServiceItem {
  return {
    id: row.id,
    repairOrderServiceId: row.repair_order_service_id,
    partId: row.part_id,
    partName: row.part_name,
    quantity: toNumber(row.quantity),
    unitCost: toNumber(row.unit_cost),
    lineCost: toNumber(row.line_cost),
    createdAt: row.created_at,
  };
}

function normalizeRepairOrderService(row: any): RepairOrderService {
  return {
    id: row.id,
    repairOrderId: row.repair_order_id,
    serviceId: row.service_id || undefined,
    serviceName: row.service_name,
    laborCalcType: row.labor_calc_type || "fixed",
    laborFixedAmount: toNumber(row.labor_fixed_amount),
    laborPercentOfCost: toNumber(row.labor_percent_of_cost),
    minimumLaborAmount: toNumber(row.minimum_labor_amount),
    relatedProductCost: toNumber(row.related_product_cost),
    laborAmount: toNumber(row.labor_amount),
    workerSharePercent: toNumber(row.worker_share_percent),
    workerAmount: toNumber(row.worker_amount),
    isBillable: row.is_billable ?? true,
    isPayableToWorker: row.is_payable_to_worker ?? true,
    note: row.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workers: (row.repair_order_service_workers || []).map(normalizeRepairOrderServiceWorker),
    relatedItems: (row.repair_order_service_items || []).map(normalizeRepairOrderServiceItem),
  };
}

export interface RepairOrderServiceInput {
  id?: string;
  service_id?: string;
  service_name: string;
  labor_calc_type: "fixed" | "percent_of_cost" | "manual";
  labor_fixed_amount: number;
  labor_percent_of_cost: number;
  minimum_labor_amount: number;
  related_product_cost: number;
  labor_amount: number;
  worker_share_percent: number;
  worker_amount: number;
  is_billable?: boolean;
  is_payable_to_worker?: boolean;
  note?: string;
  workers?: Array<{
    worker_id: string;
    worker_name?: string;
    share_percent: number;
    worker_amount: number;
  }>;
  related_items?: Array<{
    part_id: string;
    part_name?: string;
    quantity: number;
    unit_cost: number;
    line_cost: number;
  }>;
}

export async function fetchServiceConfigs(): Promise<RepoResult<ServiceConfig[]>> {
  try {
    const { data, error } = await supabase
      .from(SERVICES_TABLE)
      .select("*")
      .eq("is_active", true)
      .order("name");

    if (error) {
      return failure({
        code: "supabase",
        message: "Khong the tai cau hinh dich vu sua chua",
        cause: error,
      });
    }

    return success((data || []).map(normalizeServiceConfig));
  } catch (cause) {
    return failure({
      code: "network",
      message: "Loi ket noi khi tai cau hinh dich vu sua chua",
      cause,
    });
  }
}

export async function fetchRepairOrderServices(
  repairOrderId: string
): Promise<RepoResult<RepairOrderService[]>> {
  try {
    const { data, error } = await supabase
      .from(REPAIR_ORDER_SERVICES_TABLE)
      .select(
        "*, repair_order_service_workers(*), repair_order_service_items(*)"
      )
      .eq("repair_order_id", repairOrderId)
      .order("created_at", { ascending: true });

    if (error) {
      return failure({
        code: "supabase",
        message: "Khong the tai cong sua cua phieu sua",
        cause: error,
      });
    }

    return success((data || []).map(normalizeRepairOrderService));
  } catch (cause) {
    return failure({
      code: "network",
      message: "Loi ket noi khi tai cong sua cua phieu sua",
      cause,
    });
  }
}

export async function syncRepairOrderServices(
  repairOrderId: string,
  services: RepairOrderServiceInput[]
): Promise<RepoResult<RepairOrderService[]>> {
  try {
    const { error: rpcError } = await supabase.rpc("upsert_repair_order_labor_bundle", {
      p_repair_order_id: repairOrderId,
      p_services: services,
    });

    if (rpcError) {
      // Fallback for DBs that have not applied the migration yet.
      const { error: deleteWorkersError } = await supabase
        .from(REPAIR_ORDER_SERVICE_WORKERS_TABLE)
        .delete()
        .in(
          "repair_order_service_id",
          (
            await supabase
              .from(REPAIR_ORDER_SERVICES_TABLE)
              .select("id")
              .eq("repair_order_id", repairOrderId)
          ).data?.map((row: any) => row.id) || []
        );

      if (deleteWorkersError) {
        return failure({
          code: "supabase",
          message: "Khong the dong bo chia cong thợ",
          cause: deleteWorkersError,
        });
      }

      await supabase
        .from(REPAIR_ORDER_SERVICE_ITEMS_TABLE)
        .delete()
        .in(
          "repair_order_service_id",
          (
            await supabase
              .from(REPAIR_ORDER_SERVICES_TABLE)
              .select("id")
              .eq("repair_order_id", repairOrderId)
          ).data?.map((row: any) => row.id) || []
        );

      await supabase
        .from(REPAIR_ORDER_SERVICES_TABLE)
        .delete()
        .eq("repair_order_id", repairOrderId);

      if (services.length > 0) {
        const insertedRows = await supabase
          .from(REPAIR_ORDER_SERVICES_TABLE)
          .insert(
            services.map((service) => ({
              repair_order_id: repairOrderId,
              service_id: service.service_id || null,
              service_name: service.service_name,
              labor_calc_type: service.labor_calc_type,
              labor_fixed_amount: service.labor_fixed_amount,
              labor_percent_of_cost: service.labor_percent_of_cost,
              minimum_labor_amount: service.minimum_labor_amount,
              related_product_cost: service.related_product_cost,
              labor_amount: service.labor_amount,
              worker_share_percent: service.worker_share_percent,
              worker_amount: service.worker_amount,
              is_billable: service.is_billable ?? true,
              is_payable_to_worker: service.is_payable_to_worker ?? true,
              note: service.note || null,
            }))
          )
          .select("*");

        if (insertedRows.error) {
          return failure({
            code: "supabase",
            message: "Khong the luu cong sua vao phieu",
            cause: insertedRows.error,
          });
        }

        for (let index = 0; index < (insertedRows.data || []).length; index += 1) {
          const row = insertedRows.data[index];
          const source = services[index];

          if (source.workers && source.workers.length > 0) {
            const { error } = await supabase.from(REPAIR_ORDER_SERVICE_WORKERS_TABLE).insert(
              source.workers.map((worker) => ({
                repair_order_service_id: row.id,
                worker_id: worker.worker_id,
                worker_name: worker.worker_name || null,
                share_percent: worker.share_percent,
                worker_amount: worker.worker_amount,
              }))
            );

            if (error) {
              return failure({
                code: "supabase",
                message: "Khong the luu chia cong thợ",
                cause: error,
              });
            }
          }

          if (source.related_items && source.related_items.length > 0) {
            const { error } = await supabase.from(REPAIR_ORDER_SERVICE_ITEMS_TABLE).insert(
              source.related_items.map((item) => ({
                repair_order_service_id: row.id,
                part_id: item.part_id,
                part_name: item.part_name || null,
                quantity: item.quantity,
                unit_cost: item.unit_cost,
                line_cost: item.line_cost,
              }))
            );

            if (error) {
              return failure({
                code: "supabase",
                message: "Khong the luu vat tu lien ket voi cong sua",
                cause: error,
              });
            }
          }
        }

        await recalculateRepairOrderLaborTotals(repairOrderId);
      } else {
        await recalculateRepairOrderLaborTotals(repairOrderId);
      }
    }

    return fetchRepairOrderServices(repairOrderId);
  } catch (cause) {
    return failure({
      code: "network",
      message: "Loi ket noi khi dong bo cong sua",
      cause,
    });
  }
}

export async function recalculateRepairOrderLaborTotals(
  repairOrderId: string
): Promise<RepoResult<{ laborTotal: number; workerTotal: number }>> {
  try {
    const { data, error } = await supabase.rpc("recalculate_repair_order_labor_totals", {
      p_repair_order_id: repairOrderId,
    });

    if (!error && data) {
      return success({
        laborTotal: toNumber((data as any).labor_total),
        workerTotal: toNumber((data as any).worker_total),
      });
    }

    const servicesResult = await fetchRepairOrderServices(repairOrderId);
    if (!servicesResult.ok) {
      return failure((servicesResult as { error: any }).error);
    }

    const laborTotal = servicesResult.data
      .filter((service) => service.isBillable)
      .reduce((sum, service) => sum + Number(service.laborAmount || 0), 0);

    const workerTotal = servicesResult.data.reduce((sum, service) => {
      if (!service.isPayableToWorker) return sum;
      if (service.workers && service.workers.length > 0) {
        return (
          sum +
          service.workers.reduce((workerSum, worker) => workerSum + Number(worker.workerAmount || 0), 0)
        );
      }
      return sum + Number(service.workerAmount || 0);
    }, 0);

    const { error: updateError } = await supabase
      .from("work_orders")
      .update({
        labor_total: laborTotal,
        worker_total: workerTotal,
        laborcost: laborTotal,
      })
      .eq("id", repairOrderId);

    if (updateError) {
      return failure({
        code: "supabase",
        message: "Khong the cap nhat tong cong cua phieu sua",
        cause: updateError,
      });
    }

    return success({ laborTotal, workerTotal });
  } catch (cause) {
    return failure({
      code: "network",
      message: "Loi ket noi khi tinh tong cong phiếu sua",
      cause,
    });
  }
}

export async function getWorkerMonthlySalary(
  workerId: string,
  month: number,
  year: number
): Promise<RepoResult<WorkerMonthlySalary>> {
  try {
    const { data: employeeRow } = await supabase
      .from("employees")
      .select("id, name, base_salary")
      .eq("id", workerId)
      .maybeSingle();

    const fallbackWorkerName = employeeRow?.name || "Chua phan cong";
    const manualFallback = await getManualLaborFallback(workerId, fallbackWorkerName, month, year);

    const { data, error } = await supabase.rpc("get_worker_monthly_salary", {
      p_worker_id: workerId,
      p_month: month,
      p_year: year,
    });

    if (!error && data) {
      const row = Array.isArray(data) ? data[0] : data;
      const baseSalary = toNumber(row.base_salary || employeeRow?.base_salary);
      const bonus = toNumber(row.bonus);
      const penalty = toNumber(row.penalty);
      const advance = toNumber(row.advance);
      const totalWorkerAmount = toNumber(row.total_worker_amount) + manualFallback.amount;
      const totalServiceCount = toNumber(row.total_service_count) + manualFallback.count;
      return success({
        workerId: row.worker_id,
        workerName: row.worker_name || fallbackWorkerName,
        totalServiceCount,
        totalWorkerAmount,
        baseSalary,
        bonus,
        penalty,
        advance,
        finalSalary: toNumber(baseSalary + totalWorkerAmount + bonus - penalty - advance),
      });
    }

    const startDate = new Date(year, month - 1, 1).toISOString();
    const endDate = new Date(year, month, 1).toISOString();

    const [workerRows, employeeRows, advanceRows] = await Promise.all([
      supabase
        .from(REPAIR_ORDER_SERVICE_WORKERS_TABLE)
        .select("*, repair_order_services!inner(repair_order_id, service_name, created_at)")
        .eq("worker_id", workerId)
        .gte("repair_order_services.created_at", startDate)
        .lt("repair_order_services.created_at", endDate),
      supabase.from("employees").select("*").eq("id", workerId).maybeSingle(),
      employeeRow?.name
        ? supabase
            .from("cash_transactions")
            .select("amount")
            .eq("category", "employee_advance")
            .eq("type", "expense")
            .gte("date", startDate)
            .lt("date", endDate)
            .ilike("recipient", employeeRow.name.trim())
        : Promise.resolve({ data: [], error: null }),
    ]);

    if (workerRows.error) {
      return failure({
        code: "supabase",
        message: "Khong the tai du lieu luong cong sua theo thang",
        cause: workerRows.error,
      });
    }

    const workerName =
      workerRows.data?.[0]?.worker_name ||
      workerRows.data?.[0]?.employees?.name ||
      employeeRows.data?.name ||
      "Chua phan cong";

    const advanceSum = (advanceRows?.data || []).reduce(
      (sum, row) => sum + toNumber((row as any).amount),
      0
    );

    const serviceSummary = computeMonthlySalarySummary({
      workerId,
      workerName,
      serviceWorkers: (workerRows.data || []).map(normalizeRepairOrderServiceWorker),
      employee: employeeRows.data as any,
      advance: advanceSum,
    });

    return success({
      ...serviceSummary,
      totalServiceCount: serviceSummary.totalServiceCount + manualFallback.count,
      totalWorkerAmount: serviceSummary.totalWorkerAmount + manualFallback.amount,
      finalSalary:
        serviceSummary.baseSalary +
        (serviceSummary.totalWorkerAmount + manualFallback.amount) +
        serviceSummary.bonus -
        serviceSummary.penalty -
        (serviceSummary.advance || 0),
    });
  } catch (cause) {
    return failure({
      code: "network",
      message: "Loi ket noi khi tinh luong thang cua thợ",
      cause,
    });
  }
}

export interface WorkerLaborDetailRow {
  type: "service_split" | "manual_labor";
  workOrderId: string;
  date: string;
  customerName: string;
  vehicleModel: string;
  serviceName: string;
  amount: number;
}

export async function getWorkerMonthlyLaborDetails(
  workerId: string,
  month: number,
  year: number
): Promise<RepoResult<WorkerLaborDetailRow[]>> {
  try {
    const { data: employeeRow } = await supabase
      .from("employees")
      .select("id, name")
      .eq("id", workerId)
      .maybeSingle();

    const workerName = employeeRow?.name || "";

    const { data: workerRows, error: workerRowsError } = await supabase
      .from(REPAIR_ORDER_SERVICE_WORKERS_TABLE)
      .select("worker_amount, repair_order_services!inner(repair_order_id, service_name, created_at, updated_at)")
      .eq("worker_id", workerId);

    if (workerRowsError) {
      return failure({
        code: "supabase",
        message: "Khong the tai chi tiet cong thợ",
        cause: workerRowsError,
      });
    }

    const orderIdsFromSplit = Array.from(
      new Set(
        (workerRows || [])
          .map((row: any) => row.repair_order_services?.repair_order_id)
          .filter(Boolean)
      )
    );

    const splitOrderMap = new Map<string, any>();
    if (orderIdsFromSplit.length > 0) {
      const { data: splitOrders } = await supabase
        .from("work_orders")
        .select("*")
        .in("id", orderIdsFromSplit);

      for (const order of splitOrders || []) {
        if (order?.id) {
          splitOrderMap.set(order.id, order);
        }
      }
    }

    const splitDetails: WorkerLaborDetailRow[] = (workerRows || [])
      .map((row: any) => {
        const service = row.repair_order_services;
        const workOrderId = service?.repair_order_id;
        const order = splitOrderMap.get(workOrderId);
        const date =
          pickWorkOrderEffectiveDate(order) ||
          service?.updated_at ||
          service?.created_at ||
          "";

        return {
          type: "service_split" as const,
          workOrderId: workOrderId || "",
          date,
          customerName: order?.customername || order?.customerName || "Khach le",
          vehicleModel: order?.vehiclemodel || order?.vehicleModel || "",
          serviceName: service?.service_name || "Cong sua",
          amount: toNumber(row.worker_amount),
        };
      })
      .filter((item) => {
        if (!item.workOrderId || item.amount <= 0) return false;
        if (!isDateInMonth(item.date, month, year)) return false;
        const order = splitOrderMap.get(item.workOrderId);
        if (!order) return true;
        return !isWorkOrderCanceledOrRefunded(order);
      });

    const orderIdsWithSplit = new Set(splitDetails.map((item) => item.workOrderId));

    const manualOrdersRaw = await fetchWorkOrdersByTechnicianName(workerName);
    const manualDetails: WorkerLaborDetailRow[] = manualOrdersRaw
      .filter((order) => {
        if (!order?.id) return false;
        if (isWorkOrderCanceledOrRefunded(order)) return false;
        if (orderIdsWithSplit.has(order.id)) return false;
        if (!isDateInMonth(pickWorkOrderEffectiveDate(order), month, year)) return false;
        return toNumber(order.laborcost || order.laborCost || 0) > 0;
      })
      .map((order) => ({
        type: "manual_labor" as const,
        workOrderId: order.id,
        date: pickWorkOrderEffectiveDate(order) || "",
        customerName: order.customername || order.customerName || "Khach le",
        vehicleModel: order.vehiclemodel || order.vehicleModel || "",
        serviceName: "Tien cong phiếu",
        amount: toNumber(order.laborcost || order.laborCost || 0),
      }));

    const rows = [...splitDetails, ...manualDetails].sort((a, b) => {
      const aTime = new Date(a.date || 0).getTime();
      const bTime = new Date(b.date || 0).getTime();
      return bTime - aTime;
    });

    return success(rows);
  } catch (cause) {
    return failure({
      code: "network",
      message: "Loi ket noi khi tai chi tiet cong thợ",
      cause,
    });
  }
}
