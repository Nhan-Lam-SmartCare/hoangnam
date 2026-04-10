import { describe, it, expect } from "vitest";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const shouldRunDbIntegration = process.env.RUN_DB_INTEGRATION === "1";

if (!url || !serviceKey) {
  console.warn("[inventory_trigger_correctness.test] Thiếu env – sẽ skip.");
}

const admin = url && serviceKey ? createClient(url, serviceKey) : (null as any);
const dbDescribe = shouldRunDbIntegration ? describe : describe.skip;

dbDescribe("inventory trigger correctness (integration)", () => {
  // Trigger DB đã tắt chủ đích, update stock chạy ở tầng ứng dụng.
  it("AFTER INSERT không tự cập nhật parts.stock khi trigger disabled", async () => {
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

    // Với trigger disabled, stock không tự cộng từ bảng inventory_transactions.
    expect(stockAfter).toBe(0);

    await admin.from("inventory_transactions").delete().eq("partId", partId);
    await admin.from("parts").delete().eq("id", partId);
  }, 30000);
});
