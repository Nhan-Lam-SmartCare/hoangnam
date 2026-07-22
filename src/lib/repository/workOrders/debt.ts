import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { normalizeStatusKey } from "./normalize";

function buildDebtDescription(workOrder: WorkOrder): string {
  const workOrderSuffix = workOrder.id.split("-").pop() || workOrder.id;
  let description = `${workOrder.vehicleModel || "Xe"} (Phiếu sửa chữa #${workOrderSuffix})`;

  if (workOrder.issueDescription) {
    description += `\nVấn đề: ${workOrder.issueDescription}`;
  }

  if (workOrder.partsUsed && workOrder.partsUsed.length > 0) {
    description += "\n\nPhụ tùng đã thay:";
    workOrder.partsUsed.forEach((part: any) => {
      description += `\n  - ${part.quantity} x ${part.partName || part.part_name || "Phụ tùng"} - ${(part.price * part.quantity).toLocaleString()}đ`;
    });
  }

  if (workOrder.additionalServices && workOrder.additionalServices.length > 0) {
    description += "\n\nDịch vụ:";
    workOrder.additionalServices.forEach((service: any) => {
      description += `\n  - ${service.quantity} x ${service.description || service.serviceName} - ${(service.price * service.quantity).toLocaleString()}đ`;
    });
  }

  if (workOrder.laborCost && workOrder.laborCost > 0) {
    description += `\n\nCông lao động: ${workOrder.laborCost.toLocaleString()}đ`;
  }

  if (workOrder.discount && workOrder.discount > 0) {
    description += `\nGiảm giá: -${workOrder.discount.toLocaleString()}đ`;
  }

  return description;
}

export async function syncCustomerDebtForWorkOrder(
  order: WorkOrder
): Promise<void> {
  const remainingAmount = Math.max(0, Number(order.remainingAmount || 0));
  const totalAmount = Number(order.total || 0);
  const paidAmount = Number(order.totalPaid || 0);

  const completionStatusKey = normalizeStatusKey(order.status);
  const isHandoverStatus = completionStatusKey === "tra may";

  if (!isHandoverStatus || remainingAmount <= 0) {
    try {
      await supabase
        .from("customer_debts")
        .delete()
        .eq("work_order_id", order.id);
    } catch (err) {
      console.warn("[syncCustomerDebt] Error deleting customer debt:", err);
    }
    return;
  }

  try {
    const safeCustomerId = order.customerPhone || order.id || `CUST-ANON-${Date.now()}`;
    const safeCustomerName = order.customerName?.trim() || order.customerPhone || "Khách vãng lai";
    const description = buildDebtDescription(order);

    const payload = {
      customerId: safeCustomerId,
      customerName: safeCustomerName,
      phone: order.customerPhone || null,
      licensePlate: order.licensePlate || null,
      description: description,
      totalAmount: totalAmount,
      paidAmount: paidAmount,
      remainingAmount: remainingAmount,
      createdDate: new Date().toISOString().split("T")[0],
      branchId: order.branchId || "CN1",
      workOrderId: order.id,
    };

    const debtId = `CDEBT-WO-${order.id}`;
    const newDebt = {
      id: debtId,
      customer_id: payload.customerId,
      customer_name: payload.customerName,
      phone: payload.phone,
      license_plate: payload.licensePlate,
      description: payload.description,
      total_amount: payload.totalAmount,
      paid_amount: payload.paidAmount,
      remaining_amount: payload.remainingAmount,
      created_date: payload.createdDate,
      branch_id: payload.branchId,
      work_order_id: payload.workOrderId,
      sale_id: null,
    };

    const { data: existing } = await supabase
      .from("customer_debts")
      .select("id")
      .eq("work_order_id", order.id)
      .maybeSingle();

    if (existing) {
      await supabase.from("customer_debts").update(newDebt).eq("id", existing.id);
    } else {
      await supabase.from("customer_debts").insert(newDebt);
    }
  } catch (err) {
    console.error("[syncCustomerDebt] Error upserting customer debt:", err);
  }
}
