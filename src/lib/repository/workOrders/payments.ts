import { supabase } from "../../../supabaseClient";
import type { WorkOrder } from "../../../types";
import { updatePaymentSourceBalance } from "../paymentSourcesRepository";
import { formatWorkOrderId } from "../../../utils/format";

const getMissingColumnFromSupabaseError = (err: any): string | null => {
  const message = String(err?.message || "");
  const details = String(err?.details || "");
  const hint = String(err?.hint || "");
  const text = `${message} ${details} ${hint}`;
  
  const match1 = text.match(/Could not find the '([^']+)' column/i);
  if (match1) return match1[1];
  
  const match2 = text.match(/column "([^"]+)"/i);
  if (match2) return match2[1];
  
  const match3 = text.match(/column '([^']+)'/i);
  if (match3) return match3[1];
  
  const match4 = text.match(/'([^']+)'/i);
  if (match4) return match4[1];
  
  return null;
};

const buildCashTxCreatorFields = (user: any): Record<string, any> => {
  if (!user) return {};
  const creatorId = user.id;
  const creatorName =
    user.user_metadata?.name ||
    user.user_metadata?.full_name ||
    user.user_metadata?.display_name ||
    user.email?.split("@")?.[0] ||
    null;

  return {
    userid: creatorId,
    username: creatorName,
    created_by: creatorId,
    createdby: creatorId,
    created_by_name: creatorName,
    createdbyname: creatorName,
    userId: creatorId,
    userName: creatorName,
    createdBy: creatorId,
    createdByName: creatorName,
  };
};

export const insertCashTransactionWithCreator = async (payload: Record<string, any>) => {
  const { data } = await supabase.auth.getUser();
  const user = data?.user;
  const creatorFields = buildCashTxCreatorFields(user);
  let workingPayload = { ...payload, ...creatorFields };
  let lastError: any = null;

  for (let i = 0; i < 8; i += 1) {
    const { error } = await supabase.from("cash_transactions").insert(workingPayload);
    if (!error) return { ok: true, error: null as any };

    const missingColumn = getMissingColumnFromSupabaseError(error);
    if (missingColumn && missingColumn in workingPayload) {
      delete workingPayload[missingColumn];
      lastError = error;
      continue;
    }

    return { ok: false, error };
  }

  return { ok: false, error: lastError };
};

export function sumManualPartCostExpense(order: WorkOrder): {
  total: number;
  labels: string[];
} {
  const parts = Array.isArray(order.partsUsed) ? order.partsUsed : [];
  let total = 0;
  const labels: string[] = [];

  for (const part of parts as any[]) {
    const partId = String(part?.partId || part?.partid || part?.part_id || "").trim();
    // Manual/free part in current flow has no stable partId.
    if (partId) continue;

    const qty = Math.max(0, Number(part?.quantity || 0));
    const cost = Math.max(0, Number(part?.costPrice || part?.costprice || 0));
    if (qty <= 0 || cost <= 0) continue;

    total += qty * cost;
    labels.push(String(part?.partName || part?.part_name || "Linh kiện tự do").trim());
  }

  return { total, labels };
}

export async function ensureManualPartExpenseOnPayment(
  order: WorkOrder,
  paymentMethod?: string
): Promise<void> {
  const { total, labels } = sumManualPartCostExpense(order);
  if (total <= 0) return;

  const marker = "[MANUAL_PART_COST]";
  const reference = String(order.id || "").trim();
  if (!reference) return;

  try {
    const { data: existingRows } = await supabase
      .from("cash_transactions")
      .select("id, category, description, reference")
      .eq("reference", reference)
      .limit(20);

    const exists = (existingRows || []).some((row: any) => {
      const category = String(row?.category || "").toLowerCase();
      const description = String(row?.description || "").toLowerCase();
      return category === "parts_purchase" && description.includes(marker.toLowerCase());
    });

    if (exists) return;

    const txId =
      typeof crypto !== "undefined" && (crypto as any).randomUUID
        ? (crypto as any).randomUUID()
        : `${Math.random().toString(36).slice(2)}-${Date.now()}`;

    const branchId = String(order.branchId || "CN1");
    const orderSuffix = reference.split("-").pop() || reference;
    const topNames = labels.slice(0, 3).join(", ");
    const description = `${marker} Chi giá nhập linh kiện tự do - Phiếu #${orderSuffix}${
      topNames ? ` - ${topNames}` : ""
    }`;

    const payloadAttempts: Array<Record<string, any>> = [
      {
        id: txId,
        type: "expense",
        category: "parts_purchase",
        amount: -total,
        date: new Date().toISOString(),
        description,
        reference,
        paymentsource: paymentMethod || order.paymentMethod || "cash",
        branchid: branchId,
      },
      {
        id: txId,
        type: "expense",
        category: "parts_purchase",
        amount: -total,
        date: new Date().toISOString(),
        description,
        reference,
        paymentSource: paymentMethod || order.paymentMethod || "cash",
        branchId,
      },
      {
        id: txId,
        type: "expense",
        category: "parts_purchase",
        amount: -total,
        date: new Date().toISOString(),
        description,
        reference,
        branch_id: branchId,
      },
    ];

    for (const payload of payloadAttempts) {
      const result = await insertCashTransactionWithCreator(payload);
      if (result.ok) return;
    }

    console.warn("[completeWorkOrderPayment] Failed to create manual-part expense transaction", {
      orderId: order.id,
      total,
    });
  } catch (error) {
    console.warn("[completeWorkOrderPayment] Manual-part expense creation error", {
      orderId: order.id,
      error,
    });
  }
}

export interface RecordedWorkOrderCashTx {
  id: string;
  type: "income";
  category: "service_deposit" | "service_income";
  amount: number;
  date: string;
  description: string;
  branchId: string;
  paymentSource?: string;
  reference: string;
}

// Tổng số tiền đã ghi sổ quỹ cho 1 phiếu, gom theo nhóm thu (đặt cọc / thu sửa chữa).
// Quét theo cả `reference` lẫn `workorderid` vì các luồng cũ ghi không nhất quán cột tham chiếu.
export async function sumRecordedWorkOrderIncome(
  reference: string
): Promise<{ deposit: number; income: number }> {
  const seen = new Set<string>();
  let deposit = 0;
  let income = 0;

  const accumulate = (rows: any[] | null | undefined) => {
    for (const row of rows || []) {
      const id = String(row?.id || "");
      if (id) {
        if (seen.has(id)) continue;
        seen.add(id);
      }
      if (String(row?.type || "").toLowerCase() !== "income") continue;
      const amount = Number(row?.amount) || 0;
      if (amount <= 0) continue;
      const category = String(row?.category || "").trim().toLowerCase();
      if (category === "service_deposit") deposit += amount;
      else if (category === "service_income") income += amount;
    }
  };

  // Một số schema không có cột `workorderid`/`workOrderId` → bỏ qua lỗi cột để vẫn idempotent.
  for (const column of ["reference", "workorderid", "workOrderId"]) {
    try {
      const { data, error } = await supabase
        .from("cash_transactions")
        .select("id, amount, category, type")
        .eq(column, reference)
        .limit(500);
      if (!error) accumulate(data);
    } catch {
      // noop: cột tham chiếu không tồn tại trong schema này
    }
  }

  return { deposit, income };
}

export async function recordWorkOrderPaymentTransactions(params: {
  orderId: string;
  customerName: string;
  branchId: string;
  paymentMethod?: string;
  depositAmount?: number;
  servicePayment?: number;
  workOrderPrefix?: string;
}): Promise<RecordedWorkOrderCashTx[]> {
  const reference = String(params.orderId || "").trim();
  if (!reference) return [];

  const targetDeposit = Math.max(0, Number(params.depositAmount) || 0);
  const targetIncome = Math.max(0, Number(params.servicePayment) || 0);
  if (targetDeposit <= 0 && targetIncome <= 0) return [];

  const branchId = String(params.branchId || "CN1");
  const paymentSource = params.paymentMethod || "cash";
  const customerName = params.customerName || "";

  const { deposit: recordedDeposit, income: recordedIncome } =
    await sumRecordedWorkOrderIncome(reference);

  const orderSuffix =
    (formatWorkOrderId(reference, params.workOrderPrefix) || reference)
      .split("-")
      .pop() || reference;

  const created: RecordedWorkOrderCashTx[] = [];

  const makeTxId = (prefix: string): string =>
    typeof crypto !== "undefined" && (crypto as any).randomUUID
      ? (crypto as any).randomUUID()
      : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const writeTx = async (
    category: "service_deposit" | "service_income",
    amount: number,
    description: string
  ) => {
    if (amount <= 0) return;
    const id = makeTxId(category === "service_deposit" ? "SVC-DEP" : "SVC-INC");
    const date = new Date().toISOString();
    const { ok, error } = await insertCashTransactionWithCreator({
      id,
      type: "income",
      category,
      amount,
      date,
      description,
      reference,
      workorderid: reference,
      branchid: branchId,
      paymentsource: paymentSource,
    });
    if (!ok) {
      console.error(
        "[recordWorkOrderPaymentTransactions] Ghi sổ quỹ thất bại",
        { reference, category, amount, error }
      );
      return;
    }

    // Atomically update the payment source balance in DB
    await updatePaymentSourceBalance(paymentSource, branchId, amount);

    created.push({
      id,
      type: "income",
      category,
      amount,
      date,
      description,
      branchId,
      paymentSource,
      reference,
    });
  };

  const depositDelta = Math.max(0, targetDeposit - recordedDeposit);
  await writeTx(
    "service_deposit",
    depositDelta,
    `Đặt cọc sửa chữa #${orderSuffix} - ${customerName}`
  );

  const incomeDelta = Math.max(0, targetIncome - recordedIncome);
  await writeTx(
    "service_income",
    incomeDelta,
    `Thu tiền sửa chữa #${orderSuffix} - ${customerName}`
  );

  return created;
}

export async function syncAdditionalServicesTransactions(
  orderId: string,
  additionalServices: any[],
  branchId: string
): Promise<void> {
  if (!additionalServices || additionalServices.length === 0) return;

  const totalOutsourcingCost = additionalServices.reduce(
    (sum: number, service: any) => sum + (service.costPrice || 0) * service.quantity,
    0
  );

  const negativeSalesPayment = additionalServices.reduce((sum: number, service: any) => {
    if (service.price < 0 && (service.costPrice || 0) === 0) {
      return sum + Math.abs(service.price * service.quantity);
    }
    return sum;
  }, 0);

  if (totalOutsourcingCost > 0) {
    try {
      const { data: existingTx } = await supabase
        .from("cash_transactions")
        .select("id")
        .eq("reference", orderId)
        .eq("category", "outsourcing")
        .maybeSingle();

      if (!existingTx) {
        const outsourcingTxId = `EXPENSE-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { ok, error } = await insertCashTransactionWithCreator({
          id: outsourcingTxId,
          type: "expense",
          category: "outsourcing",
          amount: -totalOutsourcingCost,
          date: new Date().toISOString(),
          description: `Chi chi phí gia công ngoài - Phiếu #${orderId.split("-").pop()} - ${additionalServices
            .map((s: any) => s.description || s.serviceName)
            .join(", ")}`,
          branchid: branchId,
          paymentsource: "cash",
          reference: orderId,
        });

        if (ok) {
          await updatePaymentSourceBalance("cash", branchId, -totalOutsourcingCost);
        } else {
          console.error("[syncAdditionalServices] Outsourcing expense insert failed:", error);
        }
      }
    } catch (err) {
      console.error("[syncAdditionalServices] Outsourcing error:", err);
    }
  }

  if (negativeSalesPayment > 0) {
    try {
      const negativeServices = additionalServices.filter((s: any) => s.price < 0 && (s.costPrice || 0) === 0);
      const { data: existingNegTx } = await supabase
        .from("cash_transactions")
        .select("id")
        .eq("reference", orderId)
        .eq("category", "refund")
        .maybeSingle();

      if (!existingNegTx) {
        const negativeSalesTxId = `EXPENSE-NEG-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const { ok, error } = await insertCashTransactionWithCreator({
          id: negativeSalesTxId,
          type: "expense",
          category: "refund",
          amount: -negativeSalesPayment,
          date: new Date().toISOString(),
          description: `Chi tiền (giá bán âm) - Phiếu #${orderId.split("-").pop()} - ${negativeServices
            .map((s: any) => s.description || s.serviceName)
            .join(", ")}`,
          branchid: branchId,
          paymentsource: "cash",
          reference: orderId,
        });

        if (ok) {
          await updatePaymentSourceBalance("cash", branchId, -negativeSalesPayment);
        } else {
          console.error("[syncAdditionalServices] Negative sales insert failed:", error);
        }
      }
    } catch (err) {
      console.error("[syncAdditionalServices] Negative sales error:", err);
    }
  }
}
