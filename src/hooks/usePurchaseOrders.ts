/**
 * Purchase Orders Repository
 * Quản lý đơn đặt hàng từ nhà cung cấp
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import type {
  PurchaseOrder,
  PurchaseOrderItem,
  CreatePurchaseOrderInput,
  UpdatePurchaseOrderInput,
} from "../types";

// =====================================================
// Query Keys
// =====================================================
export const PURCHASE_ORDERS_QUERY_KEY = "purchase_orders";
export const PURCHASE_ORDER_ITEMS_QUERY_KEY = "purchase_order_items";

// =====================================================
// Fetch all Purchase Orders
// =====================================================
export function usePurchaseOrders(branchId?: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_QUERY_KEY, branchId],
    queryFn: async () => {
      let query = supabase
        .from("purchase_orders")
        .select(
          `
          *,
          supplier:suppliers(*),
          items:purchase_order_items(
            *,
            part:parts(*)
          )
        `
        )
        .order("created_at", { ascending: false });

      if (branchId) {
        query = query.eq("branch_id", branchId);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Fetch user info for creators
      const pos = (data || []) as PurchaseOrder[];
      const userIds = [
        ...new Set(pos.map((po) => po.created_by).filter(Boolean)),
      ];

      if (userIds.length > 0) {
        const { data: users } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .in("id", userIds);

        if (users) {
          const userMap = new Map(users.map((u) => [u.id, u]));
          pos.forEach((po) => {
            if (po.created_by) {
              const user = userMap.get(po.created_by);
              if (user) {
                po.creator = { email: user.email, name: user.full_name };
              }
            }
          });
        }
      }

      return pos;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
}

// =====================================================
// Fetch single Purchase Order by ID
// =====================================================
export function usePurchaseOrder(id: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDERS_QUERY_KEY, id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .select(
          `
          *,
          supplier:suppliers(*),
          items:purchase_order_items(
            *,
            part:parts(*)
          )
        `
        )
        .eq("id", id)
        .single();

      if (error) throw error;

      const po = data as PurchaseOrder;

      // Fetch creator info
      if (po.created_by) {
        const { data: user } = await supabase
          .from("user_profiles")
          .select("id, email, full_name")
          .eq("id", po.created_by)
          .single();

        if (user) {
          po.creator = { email: user.email, name: user.full_name };
        }
      }

      return po;
    },
    enabled: !!id,
  });
}

// =====================================================
// Fetch PO Items for a specific PO
// =====================================================
export function usePurchaseOrderItems(poId: string) {
  return useQuery({
    queryKey: [PURCHASE_ORDER_ITEMS_QUERY_KEY, poId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .select(
          `
          *,
          part:parts(*)
        `
        )
        .eq("po_id", poId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return (data || []) as PurchaseOrderItem[];
    },
    enabled: !!poId,
  });
}

// =====================================================
// Check if part has pending/ordered POs
// Returns list of POs that contain this part
// =====================================================
export async function checkPartInPendingPOs(partId: string, branchId: string) {
  const { data, error } = await supabase
    .from("purchase_order_items")
    .select(
      `
      *,
      purchase_order:purchase_orders!inner(
        *,
        supplier:suppliers(name)
      )
    `
    )
    .eq("part_id", partId)
    .eq("purchase_order.branch_id", branchId)
    .in("purchase_order.status", ["draft", "ordered"]);

  if (error) throw error;
  return data || [];
}

// =====================================================
// Create Purchase Order
// =====================================================
export function useCreatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreatePurchaseOrderInput) => {
      // 1. Create PO header
      const { data: po, error: poError } = await supabase
        .from("purchase_orders")
        .insert({
          supplier_id: input.supplier_id,
          branch_id: input.branch_id,
          expected_date: input.expected_date,
          notes: input.notes,
          status: "draft",
          created_by: (await supabase.auth.getUser()).data.user?.id,
        })
        .select()
        .single();

      if (poError) throw poError;

      // 2. Create PO items
      const itemsToInsert = input.items.map((item) => ({
        po_id: po.id,
        part_id: item.part_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        notes: item.notes,
      }));

      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert);

      if (itemsError) throw itemsError;

      return po;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Update Purchase Order
// =====================================================
// =====================================================
// Update Purchase Order (Full: Header + Items)
// =====================================================
export function useUpdatePurchaseOrderFull() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      input,
    }: {
      id: string;
      input: CreatePurchaseOrderInput;
    }) => {
      // 1. Update PO Header
      const { error: poError } = await supabase
        .from("purchase_orders")
        .update({
          supplier_id: input.supplier_id,
          expected_date: input.expected_date,
          notes: input.notes,
        })
        .eq("id", id);

      if (poError) throw poError;

      // 2. Delete existing items
      const { error: deleteError } = await supabase
        .from("purchase_order_items")
        .delete()
        .eq("po_id", id);

      if (deleteError) throw deleteError;

      // 3. Insert new items
      const itemsToInsert = input.items.map((item) => ({
        po_id: id,
        part_id: item.part_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
        notes: item.notes,
      }));

      const { error: insertError } = await supabase
        .from("purchase_order_items")
        .insert(itemsToInsert);

      if (insertError) throw insertError;

      return { id, ...input };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDER_ITEMS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Update Purchase Order (Header only)
// =====================================================
export function useUpdatePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...updates }: UpdatePurchaseOrderInput) => {
      const { data, error } = await supabase
        .from("purchase_orders")
        .update(updates)
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Update PO Item (e.g., quantity received)
// =====================================================
export function useUpdatePurchaseOrderItem() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      quantity_received,
      notes,
    }: {
      id: string;
      quantity_received?: number;
      notes?: string;
    }) => {
      const { data, error } = await supabase
        .from("purchase_order_items")
        .update({ quantity_received, notes })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [PURCHASE_ORDER_ITEMS_QUERY_KEY],
      });
    },
  });
}

// =====================================================
// Delete Purchase Order (and cascade items)
// =====================================================
export function useDeletePurchaseOrder() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("purchase_orders")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
    },
  });
}

// =====================================================
// Convert PO to Receipt (Inventory Transaction)
// This creates an inventory_transactions entry and updates PO status
// =====================================================
export async function convertPOToReceipt(
  poId: string,
  paymentSource: string = "cash"
): Promise<{ receipt: any; cashTxCreated: boolean; cashTxError?: any }> {
  // 1. Fetch PO with items and supplier info
  const { data: po, error: poError } = await supabase
    .from("purchase_orders")
    .select(
      `
      *,
      items:purchase_order_items(
        *,
        part:parts(id, name, sku, stock, retailPrice, wholesalePrice, category)
      ),
      supplier:suppliers(id, name)
    `
    )
    .eq("id", poId)
    .single();

  if (poError) throw poError;
  if (!po) throw new Error("PO not found");

  if (po.status === "received") {
    throw new Error("Đơn đặt hàng này đã được nhập kho rồi");
  }

  const isMissingColumn = (err: any, columnName: string) => {
    return (
      err?.code === "PGRST204" &&
      typeof err?.message === "string" &&
      err.message.includes(`'${columnName}'`)
    );
  };

  // 2. Create inventory transactions (one per item in old schema)
  const currentDate = new Date().toISOString();
  const supplierName = po.supplier?.name || "Không xác định";
  const baseNotes = `Nhập kho từ đơn đặt hàng ${po.po_number} | NCC: ${supplierName}`;

  const txRecords = po.items.map((item: any) => ({
    id: `GR-${Date.now()}-${Math.random().toString(36).substring(7)}`,
    type: "Nhập kho",
    partId: item.part_id,
    partName: item.part?.name || "Unknown",
    quantity: item.quantity_ordered,
    date: currentDate,
    unitPrice: item.unit_price,
    totalPrice: item.quantity_ordered * item.unit_price,
    branchId: po.branch_id,
    supplierId: po.supplier_id,
    notes: baseNotes,
  }));

  // Try insert with supplierId; if column missing, retry without it
  let receipts: any[] | null = null;
  let receiptError: any = null;
  {
    const attempt1 = await supabase
      .from("inventory_transactions")
      .insert(txRecords)
      .select();
    receipts = attempt1.data as any;
    receiptError = attempt1.error;
  }

  if (receiptError && isMissingColumn(receiptError, "supplierId")) {
    const txRecordsWithoutSupplier = txRecords.map(({ supplierId, ...rest }: any) => rest);
    const attempt2 = await supabase
      .from("inventory_transactions")
      .insert(txRecordsWithoutSupplier)
      .select();
    receipts = attempt2.data as any;
    receiptError = attempt2.error;
  }

  if (receiptError) throw receiptError;

  // 3. Create cash transaction for supplier payment (expense)
  const totalAmount = po.final_amount || po.total_amount || 0;
  const cashTxId = `CT-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  // Note: many DB columns were created unquoted (camelCase becomes lowercase in Postgres)
  // so we prefer branchid/paymentsource to match the physical columns.
  const cashTxBaseLower: any = {
    id: cashTxId,
    category: "supplier_payment",
    amount: totalAmount,
    date: currentDate,
    description: `Chi trả NCC ${supplierName} - Đơn ${po.po_number}`,
    branchid: po.branch_id,
    paymentsource: paymentSource,
    reference: po.po_number,
  };

  const cashTxBaseCamel: any = {
    id: cashTxId,
    category: "supplier_payment",
    amount: totalAmount,
    date: currentDate,
    description: `Chi trả NCC ${supplierName} - Đơn ${po.po_number}`,
    branchId: po.branch_id,
    paymentSource: paymentSource,
    reference: po.po_number,
  };

  // Try richer schema first; if columns don't exist, fall back to base
  let cashTxError: any = null;
  let cashTxCreated = false;
  {
    // Attempt 1: lower-case physical columns + new columns
    const a1 = await supabase.from("cash_transactions").insert({
      ...cashTxBaseLower,
      type: "expense",
      supplierId: po.supplier_id,
    });
    cashTxError = a1.error;
    cashTxCreated = !a1.error;
  }

  if (
    cashTxError &&
    (isMissingColumn(cashTxError, "type") ||
      isMissingColumn(cashTxError, "supplierId"))
  ) {
    // Attempt 2: lower-case physical columns only
    const a2 = await supabase.from("cash_transactions").insert(cashTxBaseLower);
    cashTxError = a2.error;
    cashTxCreated = !a2.error;
  }

  if (
    cashTxError &&
    (isMissingColumn(cashTxError, "branchId") ||
      isMissingColumn(cashTxError, "paymentSource"))
  ) {
    // Attempt 3: camelCase columns only
    const a3 = await supabase.from("cash_transactions").insert(cashTxBaseCamel);
    cashTxError = a3.error;
    cashTxCreated = !a3.error;
  }

  if (
    cashTxError &&
    (isMissingColumn(cashTxError, "branchId") || isMissingColumn(cashTxError, "paymentSource"))
  ) {
    // Attempt 4: camelCase columns + new columns
    const a4 = await supabase.from("cash_transactions").insert({
      ...cashTxBaseCamel,
      type: "expense",
      supplierId: po.supplier_id,
    });
    cashTxError = a4.error;
    cashTxCreated = !a4.error;
  }

  if (cashTxError) {
    console.error("Error creating cash transaction:", cashTxError);
    // Don't throw - inventory is already created
  }

  // 4. Update PO status and link to first receipt
  const { error: updateError } = await supabase
    .from("purchase_orders")
    .update({
      status: "received",
      received_date: currentDate,
      receipt_id: receipts?.[0]?.id || null,
    })
    .eq("id", poId);

  if (updateError) throw updateError;

  return {
    receipt: receipts?.[0],
    cashTxCreated,
    cashTxError: cashTxError || undefined,
  };
}

// =====================================================
// Hook: useConvertPOToReceipt
// Convert PO to inventory receipt
// =====================================================
export function useConvertPOToReceipt() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ poId, paymentSource }: { poId: string; paymentSource: string }) =>
      convertPOToReceipt(poId, paymentSource),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [PURCHASE_ORDERS_QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      queryClient.invalidateQueries({ queryKey: ["inventory_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["cash_transactions"] });
    },
  });
}
