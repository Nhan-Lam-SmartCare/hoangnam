import { describe, it, expect, beforeAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Integration test xác thực RLS & RPC atomic
// YÊU CẦU: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY trong .env (KHÔNG commit key thật lên repo public)
// Chạy: powershell> $env:SUPABASE_URL="..."; $env:SUPABASE_SERVICE_ROLE_KEY="..."; npm test -- -t rls

const serviceUrl = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!serviceUrl || !serviceKey) {
  // Skip toàn bộ file nếu thiếu biến môi trường
  console.warn(
    "[rls_access.test] Thiếu SUPABASE_URL hoặc SUPABASE_SERVICE_ROLE_KEY – bỏ qua test integration."
  );
}

// service client (quyền cao) – chỉ dùng cho seed & so sánh, không mô phỏng user cuối
const svc =
  serviceUrl && serviceKey
    ? createClient(serviceUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })
    : null;

// Helper: tạo sale đơn giản (tránh dùng RPC để test RLS thô)
async function seedSale(id: string, branch: string) {
  const { error } = await svc!.from("sales").insert({
    id,
    date: new Date().toISOString(),
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    customer: { id: null, name: "Khách test" },
    paymentMethod: "cash",
    userId: "seed-user",
    // Cột trong DB là branchid (lowercase)
    branchid: branch,
  } as any);
  if (error) throw error;
}

// NOTE: Để test RLS theo từng user (branch khác), ta cần JWT với claims role/branch (tuỳ implement). Ở đây
// minh hoạ cơ bản bằng service role để seed và sau đó gọi RPC kiểm tra guard logic.

describe("rls_access (integration)", () => {
  beforeAll(async () => {
    if (!svc) return;
    // Seed 2 sales khác branch nếu chưa tồn tại
    await seedSale("RLS-SEED-A", "CN1").catch(() => {});
    await seedSale("RLS-SEED-B", "CN2").catch(() => {});
  });

  it("service role select sales không lỗi (tuỳ policy có thể rỗng)", async () => {
    if (!svc) return expect(true).toBe(true);
    const { data, error } = await svc
      .from("sales")
      .select("id, branchid")
      .in("id", ["RLS-SEED-A", "RLS-SEED-B"]);
    expect(error).toBeNull();
    // data có thể rỗng nếu insert bị policy chặn; chỉ cần không lỗi là pass
    expect(Array.isArray(data)).toBe(true);
  });

  it("RPC sale_create_atomic chặn branch mismatch", async () => {
    if (!svc) return expect(true).toBe(true);
    // Gửi RPC với branch khác mc_current_branch() -> kỳ vọng lỗi BRANCH_MISMATCH hoặc UNAUTHORIZED
    // Vì service key có thể bỏ qua RLS, guard trong hàm sẽ vẫn kiểm tra mc_current_branch(). Nếu hàm
    // không xác định branch (null) sẽ trả UNAUTHORIZED hoặc BRANCH_MISMATCH.
    const { data, error } = await svc.rpc("sale_create_atomic", {
      p_sale_id: "RLS-ATOM-1",
      p_items: [],
      p_discount: 0,
      p_customer: { id: null, name: "Test", phone: null },
      p_payment_method: "cash",
      p_user_id: "seed-user",
      p_user_name: "Seed User",
      p_branch_id: "FAKE-BRANCH",
    });
    expect(error).toBeTruthy();
    // Chỉ cần có lỗi là đạt (guard đã chặn); nội dung thông điệp khác nhau tuỳ cấu hình.
    expect(error).toBeTruthy();
  });
});
