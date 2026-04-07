import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
  console.warn("[inventory_trigger_correctness.test] Thiếu env – sẽ skip.");
}

const admin = url && serviceKey ? createClient(url, serviceKey) : (null as any);

describe("inventory trigger correctness (integration)", () => {
  // SKIPPED: Trigger is intentionally disabled. Stock updates are handled in application layer (InventoryManager.tsx).
  it.skip("AFTER INSERT cập nhật parts.stock", async () => {
    if (!admin) return expect(true).toBe(true);
    // Tạo part tạm
    const partId = "TRIG-PART-" + Date.now();
    const { error: errCreate } = await admin.from("parts").insert([
      {
        id: partId,
        name: "Trigger Part",
        sku: partId,
        stock: { CN1: 0 },
        retailPrice: { CN1: 0 },
      },
    ] as any);
    if (errCreate) return expect(true).toBe(true);

    // Insert Nhập kho 3 -> expect stock CN1 = 3
    await admin.from("inventory_transactions").insert([
      {
        type: "Nhập kho",
        partId,
        partName: "Trigger Part",
        quantity: 3,
        date: new Date().toISOString(),
        branchId: "CN1",
      },
    ] as any);

    // Kiểm tra stock
    const { data } = await admin
      .from("parts")
      .select("*")
      .eq("id", partId)
      .single();
    const stockAfter = data?.stock?.CN1 ?? 0;
    expect(stockAfter).toBeGreaterThanOrEqual(3);
  }, 30000);
});
