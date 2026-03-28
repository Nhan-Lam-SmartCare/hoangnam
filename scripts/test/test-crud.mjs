#!/usr/bin/env node
// Script: test-crud.mjs
// Purpose: attempt to create an inventory transaction as staff/manager/owner to validate RLS for write operations.
// Usage: node scripts/test-crud.mjs

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;
if (!url || !anon) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in env");
  process.exit(1);
}

const users = [
  {
    email: "truongcuongya123@gmail.com",
    password: process.env.TEST_PASS_MANAGER || "Cuong123456",
    role: "manager",
  },
  {
    email: "nguyenthanhloc28052007@gmail.com",
    password: process.env.TEST_PASS_STAFF || "Loc123456",
    role: "staff",
  },
  {
    email: "lam.tcag@gmail.com",
    password: process.env.TEST_PASS_OWNER || "Lam123456",
    role: "owner",
  },
];

function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID)
    return crypto.randomUUID();
  // fallback
  return "id-" + Math.random().toString(36).slice(2, 10);
}

async function attemptCreate(client, payload) {
  try {
    const { data, error } = await client
      .from("inventory_transactions")
      .insert([payload])
      .select()
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e.message || String(e) };
  }
}

(async () => {
  const results = [];
  for (const u of users) {
    console.log("\n==> Logging in as", u.email);
    const anonClient = createClient(url, anon, {
      auth: { persistSession: false },
    });
    const { data: loginData, error: loginError } =
      await anonClient.auth.signInWithPassword({
        email: u.email,
        password: u.password,
      });
    if (loginError) {
      console.error("  Login failed for", u.email, loginError.message);
      results.push({
        email: u.email,
        ok: false,
        reason: "login failed",
        detail: loginError.message,
      });
      continue;
    }
    const user = loginData.user;
    console.log("  UserID:", user.id);

    const payload = {
      id: uuid(),
      type: "Nhập kho",
      partId: "test-part-1",
      partName: "Test Part 1",
      quantity: 1,
      date: new Date().toISOString(),
      unitPrice: 100,
      totalPrice: 100,
      branchId: process.env.TEST_BRANCH || "CN1",
      notes: "CRUD test - auto",
      created_at: new Date().toISOString(),
    };

    const res = await attemptCreate(anonClient, payload);
    console.log("  Create result:", res);

    // Try delete only if created
    let delRes = null;
    if (res.success && res.data && res.data.id) {
      try {
        const { error } = await anonClient
          .from("inventory_transactions")
          .delete()
          .eq("id", res.data.id);
        if (error) delRes = { success: false, error: error.message };
        else delRes = { success: true };
      } catch (e) {
        delRes = { success: false, error: e.message };
      }
      console.log("  Delete result:", delRes);
    }

    results.push({ email: u.email, role: u.role, create: res, delete: delRes });
  }

  const outPath = new URL("../scripts/test-crud-results.json", import.meta.url);
  const filePath = outPath.pathname.replace("/", "");
  try {
    fs.writeFileSync(
      filePath,
      JSON.stringify({ ts: new Date().toISOString(), results }, null, 2)
    );
    console.log("\nWrote results to", filePath);
  } catch (e) {
    console.error("Failed to write results file", e);
  }

  console.log("\nDone");
})();
