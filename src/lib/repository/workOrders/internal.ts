import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { formatWorkOrderId } from "../../../utils/format";
import { normalizeWorkOrder } from "./normalize";

const WORK_ORDERS_TABLE = "work_orders";

export function getMissingColumnNameFromError(error: any): string | null {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  if (code !== "PGRST204" && !message.toLowerCase().includes("column")) {
    return null;
  }

  const singleQuoteMatch = message.match(/'([^']+)'\s+column/i);
  if (singleQuoteMatch?.[1]) return singleQuoteMatch[1];

  const doubleQuoteMatch = message.match(/"([^"]+)"\s+column/i);
  if (doubleQuoteMatch?.[1]) return doubleQuoteMatch[1];

  return null;
}

export function removeMissingColumnKeys(payload: Record<string, any>, missingColumn: string): number {
  const cleanedMissing = String(missingColumn || "").replace(/['"]/g, "").trim();
  if (!cleanedMissing) return 0;

  // Remove only the exact key reported by DB to avoid deleting similarly named fields.
  if (Object.prototype.hasOwnProperty.call(payload, cleanedMissing)) {
    delete payload[cleanedMissing];
    return 1;
  }

  return 0;
}

export async function resolveRefundTargetWorkOrder(
  orderId: string
): Promise<{ id: string; row: any } | null> {
  const { data: exactRow } = await supabase
    .from(WORK_ORDERS_TABLE)
    .select("*")
    .eq("id", orderId)
    .maybeSingle();

  if (exactRow?.id) {
    return { id: String(exactRow.id), row: exactRow };
  }

  const normalizedInput = formatWorkOrderId(orderId);
  if (!normalizedInput) return null;

  const suffix = normalizedInput.split("-").pop() || "";
  let candidates: any[] = [];

  if (suffix) {
    const { data } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .ilike("id", `%${suffix}`)
      .limit(30);
    candidates = data || [];
  }

  if (candidates.length === 0) {
    const { data } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(500);
    candidates = data || [];
  }

  const matched = candidates.find(
    (row) => formatWorkOrderId(String(row?.id || "")) === normalizedInput
  );

  if (!matched?.id) return null;
  return { id: String(matched.id), row: matched };
}

export async function clearWorkerCompensationForCanceledOrder(orderId: string): Promise<void> {
  try {
    let serviceIds: string[] = [];

    const serviceIdQueries = [
      supabase
        .from("repair_order_services")
        .select("id")
        .eq("repair_order_id", orderId),
      supabase
        .from("repair_order_services")
        .select("id")
        .eq("repairOrderId", orderId),
    ];

    for (const query of serviceIdQueries) {
      const { data, error } = await query;
      if (!error && data) {
        serviceIds = data.map((row: any) => String(row.id)).filter(Boolean);
        if (serviceIds.length > 0) break;
      }
    }

    if (serviceIds.length > 0) {
      await supabase
        .from("repair_order_service_workers")
        .update({ worker_amount: 0 })
        .in("repair_order_service_id", serviceIds);

      const servicePayloads: Array<Record<string, any>> = [
        {
          worker_amount: 0,
          worker_share_percent: 0,
          is_payable_to_worker: false,
        },
        {
          workerAmount: 0,
          workerSharePercent: 0,
          isPayableToWorker: false,
        },
      ];

      for (const payload of servicePayloads) {
        const { error } = await supabase
          .from("repair_order_services")
          .update(payload)
          .in("id", serviceIds);
        if (!error) break;
      }
    }

    const orderPayloads: Array<Record<string, any>> = [
      { worker_total: 0 },
      { workerTotal: 0 },
      { worker_total: 0, workerTotal: 0 },
    ];

    for (const payload of orderPayloads) {
      const { error } = await supabase
        .from(WORK_ORDERS_TABLE)
        .update(payload)
        .eq("id", orderId);
      if (!error) break;
    }
  } catch (error) {
    console.warn("[refundWorkOrder] Failed clearing worker compensation for canceled order", {
      orderId,
      error,
    });
  }
}

export async function syncTechnicianAndLaborFallback(
  orderId: string,
  technicianName: string,
  laborCost: number
): Promise<void> {
  const payloads: Array<Record<string, any>> = [
    {
      technicianname: technicianName,
      laborcost: laborCost,
    },
    {
      technicianName: technicianName,
      laborCost: laborCost,
    },
  ];

  for (const payload of payloads) {
    const { error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .update(payload)
      .eq("id", orderId);
    if (!error) return;
  }
}

export async function attachRepairServices(workOrders: WorkOrder[]): Promise<WorkOrder[]> {
  if (workOrders.length === 0) return workOrders;

  const orderIds = workOrders.map((order) => order.id);
  const { data, error } = await supabase
    .from("repair_order_services")
    .select("*, repair_order_service_workers(*), repair_order_service_items(*)")
    .in("repair_order_id", orderIds);

  if (error || !data) {
    return workOrders;
  }

  const serviceMap = new Map<string, any[]>();
  for (const row of data) {
    const existing = serviceMap.get(row.repair_order_id) || [];
    existing.push({
      id: row.id,
      repairOrderId: row.repair_order_id,
      serviceId: row.service_id || undefined,
      serviceName: row.service_name,
      laborCalcType: row.labor_calc_type || "fixed",
      laborFixedAmount: Number(row.labor_fixed_amount || 0),
      laborPercentOfCost: Number(row.labor_percent_of_cost || 0),
      minimumLaborAmount: Number(row.minimum_labor_amount || 0),
      relatedProductCost: Number(row.related_product_cost || 0),
      laborAmount: Number(row.labor_amount || 0),
      workerSharePercent: Number(row.worker_share_percent || 0),
      workerAmount: Number(row.worker_amount || 0),
      isBillable: row.is_billable ?? true,
      isPayableToWorker: row.is_payable_to_worker ?? true,
      note: row.note || "",
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      workers: (row.repair_order_service_workers || []).map((worker: any) => ({
        id: worker.id,
        repairOrderServiceId: worker.repair_order_service_id,
        workerId: worker.worker_id,
        workerName: worker.worker_name || "",
        sharePercent: Number(worker.share_percent || 0),
        workerAmount: Number(worker.worker_amount || 0),
        createdAt: worker.created_at,
      })),
      relatedItems: (row.repair_order_service_items || []).map((item: any) => ({
        id: item.id,
        repairOrderServiceId: item.repair_order_service_id,
        partId: item.part_id,
        partName: item.part_name || "",
        quantity: Number(item.quantity || 0),
        unitCost: Number(item.unit_cost || 0),
        lineCost: Number(item.line_cost || 0),
        createdAt: item.created_at,
      })),
    });
    serviceMap.set(row.repair_order_id, existing);
  }

  return workOrders.map((order) => ({
    ...order,
    repairServices: serviceMap.get(order.id) || [],
  }));
}

export function parseMissingWorkOrderColumn(error: any): string | null {
  if (!error || String(error.code || "").toUpperCase() !== "PGRST204") {
    return null;
  }
  const message = String(error.message || "");
  const match = message.match(/'([^']+)'\s+column\s+of\s+'work_orders'/i);
  return match?.[1] || null;
}

export function normalizeColumnKey(key: string): string {
  return String(key || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s-]/g, "");
}

export function removeMissingColumnFromPayload(
  payload: Record<string, any>,
  missingColumn: string
): { nextPayload: Record<string, any>; removedCount: number } {
  const nextPayload = { ...payload };

  if (Object.prototype.hasOwnProperty.call(nextPayload, missingColumn)) {
    delete nextPayload[missingColumn];
    return { nextPayload, removedCount: 1 };
  }

  const target = normalizeColumnKey(missingColumn);
  const keyToDelete = Object.keys(nextPayload).find(
    (key) => normalizeColumnKey(key) === target
  );

  if (keyToDelete) {
    delete nextPayload[keyToDelete];
    return { nextPayload, removedCount: 1 };
  }

  return { nextPayload, removedCount: 0 };
}

export function parseNotNullColumn(error: any): string | null {
  if (!error || String(error.code || "") !== "23502") {
    return null;
  }
  const message = String(error.message || "");
  const match = message.match(/null\s+value\s+in\s+column\s+"([^"]+)"/i);
  return match?.[1] || null;
}

export async function updateCustomerMetricsAtomic(
  customerId: string,
  paymentAmount: number,
  isFirstPayment: boolean
): Promise<void> {
  if (paymentAmount <= 0) return;
  try {
    const { error } = await supabase.rpc("update_customer_metrics_atomic", {
      p_customer_id: customerId,
      p_payment_amount: paymentAmount,
      p_is_first_payment: isFirstPayment,
    });

    if (error) {
      console.warn("[updateCustomerMetricsAtomic] RPC failed, using read-modify-write fallback", error);
      const { data: currentStats } = await supabase
        .from("customers")
        .select("totalspent, visitcount")
        .eq("id", customerId)
        .single();

      if (currentStats) {
        const currentTotalSpent = Number(currentStats.totalspent || 0);
        const currentVisitCount = Number(currentStats.visitcount || 0);
        
        const newTotalSpent = currentTotalSpent + paymentAmount;
        const newVisitCount = isFirstPayment ? currentVisitCount + 1 : currentVisitCount;
        
        let newSegment = "New";
        if (newTotalSpent > 10000000) newSegment = "VIP";
        else if (newTotalSpent > 3000000) newSegment = "Loyal";
        else if (newVisitCount > 1) newSegment = "Potential";

        await supabase
          .from("customers")
          .update({
            totalspent: newTotalSpent,
            visitcount: newVisitCount,
            lastvisit: new Date().toISOString(),
            segment: newSegment
          })
          .eq("id", customerId);
      }
    }
  } catch (err) {
    console.warn("Lỗi cập nhật số liệu khách hàng:", err);
  }
}

export async function updateCustomerMetricsOnPayment(
  order: WorkOrder,
  paymentAmount: number,
  isFirstPayment: boolean
): Promise<void> {
  if (paymentAmount <= 0) return;
  if (!order.customerPhone && !order.customerName) return;

  try {
    let customerIdToUpdate = null;
    
    if (order.customerPhone) {
      const { data: existingCustomers } = await supabase
        .from("customers")
        .select("id")
        .eq("phone", order.customerPhone)
        .limit(1);
        
      if (existingCustomers && existingCustomers.length > 0) {
        customerIdToUpdate = existingCustomers[0].id;
      }
    }

    if (customerIdToUpdate) {
      await updateCustomerMetricsAtomic(customerIdToUpdate, paymentAmount, isFirstPayment);
    }
    
    if (order.vehicleId && order.currentKm && order.currentKm > 0) {
       if (customerIdToUpdate) {
         const { data: custData } = await supabase.from("customers").select("vehicles").eq("id", customerIdToUpdate).single();
         if (custData && custData.vehicles) {
            const vehicles = custData.vehicles as any[];
            const vIdx = vehicles.findIndex(v => v.id === order.vehicleId);
            if (vIdx >= 0) {
               vehicles[vIdx].currentKm = order.currentKm;
               await supabase.from("customers").update({ vehicles }).eq("id", customerIdToUpdate);
            }
         }
       }
    }
  } catch (e) {
    console.warn("Lỗi cập nhật số liệu khách hàng:", e);
  }
}
