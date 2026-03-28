#!/usr/bin/env node
// Script: test-rls.mjs
// Mục tiêu: đăng nhập các user thực (owner, manager, staff) và kiểm tra nhanh quyền truy cập.
// Yêu cầu: đặt biến môi trường trong .env: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
// Tuỳ chọn: SUPABASE_SERVICE_ROLE (để gọi RPC nếu cần role cao hơn)
// Chạy: node scripts/test-rls.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error(
    "Thiếu VITE_SUPABASE_URL hoặc VITE_SUPABASE_ANON_KEY trong môi trường"
  );
  process.exit(1);
}

// Danh sách user thực và mật khẩu
const users = [
  {
    email: "truongcuongya123@gmail.com",
    password: process.env.TEST_PASS_MANAGER || "Cuong123456",
    expectedRole: "manager",
  },
  {
    email: "nguyenthanhloc28052007@gmail.com",
    password: process.env.TEST_PASS_STAFF || "Loc123456",
    expectedRole: "staff",
  },
  {
    email: "lam.tcag@gmail.com",
    password: process.env.TEST_PASS_OWNER || "Lam123456",
    expectedRole: "owner",
  },
];

// Các bảng quan trọng để kiểm tra SELECT hạn chế (bao phủ cả bảng có/không trong dự án hiện tại)
const restrictedTables = [
  { name: "customers" },
  { name: "parts" },
  { name: "work_orders" },
  { name: "payment_sources" },
  { name: "sales" },
  { name: "inventory_transactions" },
  { name: "cash_transactions" },
];

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function testUser(u) {
  const client = createClient(url, anon, { auth: { persistSession: false } });
  console.log(`\n==> Đăng nhập: ${u.email}`);
  const { data: loginData, error: loginError } =
    await client.auth.signInWithPassword({
      email: u.email,
      password: u.password,
    });
  if (loginError) {
    console.error("  ❌ Login lỗi:", loginError.message);
    return { email: u.email, ok: false, reason: loginError.message };
  }
  const user = loginData.user;
  if (!user)
    return { email: u.email, ok: false, reason: "Không có user sau login" };

  // In thêm thông tin dự án & user id để đối chiếu môi trường
  try {
    const host = new URL(url).host;
    console.log("  Project:", host, " UserID:", user.id);
  } catch {}

  // Lấy profile (bảng profiles hoặc user_profiles) theo id
  let role = null;
  const { data: profile1 } = await client
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  if (profile1 && profile1.role) role = profile1.role;
  if (!role) {
    const { data: profile2 } = await client
      .from("user_profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();
    if (profile2 && profile2.role) role = profile2.role;
  }
  // Lấy role theo email để so chéo
  let roleByEmail = null;
  const { data: pByEmail1 } = await client
    .from("profiles")
    .select("role")
    .ilike("email", u.email)
    .maybeSingle();
  if (pByEmail1 && pByEmail1.role) roleByEmail = pByEmail1.role;
  if (!roleByEmail) {
    const { data: pByEmail2 } = await client
      .from("user_profiles")
      .select("role")
      .ilike("email", u.email)
      .maybeSingle();
    if (pByEmail2 && pByEmail2.role) roleByEmail = pByEmail2.role;
  }

  console.log("  Vai trò theo id:", role, " | theo email:", roleByEmail);

  // Optional: call RPC helpers if available to cross-check server-side helpers
  let rpcCurrentRole = null;
  let rpcIsOwner = null;
  try {
    const { data: cr, error: crErr } = await client.rpc("mc_current_role");
    if (!crErr) rpcCurrentRole = cr;
  } catch (e) {
    /* ignore if RPC not present */
  }
  try {
    const { data: io, error: ioErr } = await client.rpc("mc_is_owner");
    if (!ioErr) rpcIsOwner = io;
  } catch (e) {
    /* ignore if RPC not present */
  }
  if (rpcCurrentRole !== null || rpcIsOwner !== null) {
    console.log(
      "  RPC mc_current_role:",
      rpcCurrentRole,
      " mc_is_owner:",
      rpcIsOwner
    );
  }

  // Kiểm tra vai trò như mong đợi
  const roleOk = role === u.expectedRole;
  if (!roleOk)
    console.warn(`  ⚠️ Role mismatch: expected ${u.expectedRole} got ${role}`);

  // Thử SELECT giới hạn trên từng bảng
  const tableResults = [];
  for (const tbl of restrictedTables) {
    // kiểm tra tồn tại bảng trước bằng information_schema
    const existsRes = await client
      .from("information_schema.tables")
      .select("table_name")
      .eq("table_schema", "public")
      .eq("table_name", tbl.name)
      .limit(1);
    const exists = !!existsRes.data?.length;
    if (!exists) {
      tableResults.push({
        table: tbl.name,
        canSelect: false,
        error: "Table not found (skip RLS test)",
      });
      continue;
    }
    const { data, error } = await client.from(tbl.name).select("id").limit(1);
    const canSelect = !error;
    tableResults.push({ table: tbl.name, canSelect, error: error?.message });
  }

  return { email: u.email, role, roleByEmail, roleOk, tableResults };
}

(async () => {
  console.log("=== BẮT ĐẦU TEST RLS ===");
  const summary = [];
  for (const u of users) {
    // nhỏ delay tránh rate limit
    await delay(400);
    summary.push(await testUser(u));
  }

  console.log("\n=== KẾT QUẢ TỔNG HỢP ===");
  for (const s of summary) {
    console.log(`\nUser: ${s.email}`);
    const expected = users.find((x) => x.email === s.email)?.expectedRole;
    console.log(
      `  Role(id): ${s.role} | Role(email): ${s.roleByEmail} (expected ${expected}) match=${s.roleOk}`
    );
    if (Array.isArray(s.tableResults)) {
      for (const tr of s.tableResults) {
        console.log(
          `  Table ${tr.table}: canSelect=${tr.canSelect} ${
            tr.error ? "- error: " + tr.error : ""
          }`
        );
      }
    } else {
      console.log("  Bỏ qua kiểm tra bảng do đăng nhập thất bại.");
    }
  }

  // Đưa ra cảnh báo nếu staff có quyền không mong đợi
  const staffSummary = summary.find(
    (s) => s.role === "staff" || s.email === users[1].email
  );
  if (staffSummary) {
    const unexpected = staffSummary.tableResults.filter(
      (r) =>
        ["inventory_transactions", "cash_transactions"].includes(r.table) &&
        r.canSelect
    );
    if (unexpected.length) {
      console.warn(
        "\n⚠️ Staff có quyền ngoài dự kiến trên bảng:",
        unexpected.map((x) => x.table).join(", ")
      );
    } else {
      console.log(
        "\n✅ Staff bị chặn đúng trên inventory_transactions, cash_transactions (nếu policies thiết kế vậy)"
      );
    }
  }

  console.log("\n=== HOÀN TẤT ===");
})();
