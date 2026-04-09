import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

// Kiểm chứng RLS bằng user thật (staff CN1): chỉ thấy sales cùng chi nhánh
// Yêu cầu cả 3 biến: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, VITE_SUPABASE_ANON_KEY

const url = process.env.SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;

if (!url || !serviceKey || !anonKey) {
  console.warn(
    "[rls_user_flow.test] Thiếu env (URL/service/anon) – bỏ qua test integration user flow."
  );
}

const admin = url && serviceKey ? createClient(url, serviceKey) : null;
const anonClient = url && anonKey ? createClient(url, anonKey) : null;

let userId: string | null = null;
const email = `rls-test+${Date.now()}@example.com`;
const password = "Rls123!test";

function getMissingColumnName(error: any): string | null {
  const code = String(error?.code || "").toUpperCase();
  const message = String(error?.message || "");
  if (code !== "PGRST204" && !message.toLowerCase().includes("column")) {
    return null;
  }
  const quote = message.match(/'([^']+)'\s+column/i);
  if (quote?.[1]) return quote[1];
  const dquote = message.match(/"([^"]+)"\s+column/i);
  if (dquote?.[1]) return dquote[1];
  return null;
}

function removeMissingKey(payload: Record<string, any>, missingColumn: string): boolean {
  const key = String(missingColumn || "").replace(/["']/g, "").trim();
  if (!key) return false;
  if (Object.prototype.hasOwnProperty.call(payload, key)) {
    delete payload[key];
    return true;
  }
  return false;
}

async function upsertProfile(id: string, role: string, branch: string) {
  // Ưu tiên bảng profiles; nếu không có, thử user_profiles.
  // Cần linh hoạt cột branch/email giữa các schema thực tế.
  const profilePayload: Record<string, any> = {
    id,
    email,
    role,
    branch_id: branch,
    branchId: branch,
    branchid: branch,
  };

  const upsertWithFallback = async (tableName: string) => {
    const working = { ...profilePayload };
    for (let i = 0; i < 8; i += 1) {
      const { error } = await admin!
        .from(tableName)
        .upsert(working as any, { onConflict: "id" });
      if (!error) return true;
      const missingColumn = getMissingColumnName(error);
      if (!missingColumn) return false;
      const removed = removeMissingKey(working, missingColumn);
      if (!removed) return false;
    }
    return false;
  };

  const okProfiles = await upsertWithFallback("profiles");
  if (!okProfiles) {
    const okUserProfiles = await upsertWithFallback("user_profiles");
    if (!okUserProfiles) {
      throw new Error("Cannot upsert profile on profiles/user_profiles");
    }
  }
}

async function upsertSaleSeed(id: string, branch: string, customerName: string) {
  const payload: Record<string, any> = {
    id,
    date: new Date().toISOString(),
    items: [],
    subtotal: 0,
    discount: 0,
    total: 0,
    customer: { name: customerName },
    paymentMethod: "cash",
    userId: "seed",
    branchid: branch,
    branch_id: branch,
    branchId: branch,
  };

  const working = { ...payload };
  for (let i = 0; i < 10; i += 1) {
    const { error } = await admin!
      .from("sales")
      .upsert(working as any, { onConflict: "id" });
    if (!error) return;
    const missingColumn = getMissingColumnName(error);
    if (!missingColumn) {
      throw error;
    }
    const removed = removeMissingKey(working, missingColumn);
    if (!removed) {
      throw error;
    }
  }

  throw new Error("Cannot upsert seed sale after fallback attempts");
}

async function assertSalesSchemaReady() {
  const { error } = await admin!.from("sales").select("id").limit(1);
  if (error) {
    throw new Error(
      `[rls_user_flow.test] Thiếu schema/policy cho public.sales. Hãy chạy migration sql/2026-04-05_add_sales_table_and_rls.sql. Chi tiết: ${error.message}`
    );
  }
}

describe("rls_user_flow (integration)", () => {
  beforeAll(async () => {
    if (!admin || !anonClient) return;
    await assertSalesSchemaReady();
    // Tạo user xác thực và xác nhận email
    const { data: created, error: createErr } =
      await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
    if (createErr) throw createErr;
    userId = created.user?.id || null;
    if (!userId) throw new Error("No user id returned");

    // Gán role=staff, branch=CN1 vào profiles
    await upsertProfile(userId, "staff", "CN1");

    // Seed sales nếu chưa có (chung với file rls_access)
    await upsertSaleSeed("RLS-SEED-A", "CN1", "A");
    await upsertSaleSeed("RLS-SEED-B", "CN2", "B");
  }, 30000);

  afterAll(async () => {
    if (!admin || !userId) return;
    // Optionally xoá user test để sạch dữ liệu
    await admin.auth.admin.deleteUser(userId);
  });

  it("staff CN1 chỉ nhìn thấy sale CN1 (bị filter CN2)", async () => {
    if (!anonClient) return expect(true).toBe(true);
    // Đăng nhập user
    const { data: signInData, error: signInErr } =
      await anonClient.auth.signInWithPassword({ email, password });
    expect(signInErr).toBeNull();
    expect(signInData.session).toBeTruthy();

    // SELECT sales -> staff chỉ thấy cùng branch
    const { data, error } = await anonClient
      .from("sales")
      .select("id")
      .in("id", ["RLS-SEED-A", "RLS-SEED-B"]);
    expect(error).toBeNull();
    const ids = (data || []).map((r) => r.id);
    expect(ids.length).toBeGreaterThan(0);
    // Phải thấy A
    expect(ids).toEqual(expect.arrayContaining(["RLS-SEED-A"]));
    // Không thấy B
    expect(ids).not.toEqual(expect.arrayContaining(["RLS-SEED-B"]));
  }, 60000);
});
