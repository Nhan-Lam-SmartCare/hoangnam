#!/usr/bin/env node
/**
 * Check user profile info to debug RLS issues
 * Usage: node scripts/test/check-user-info.mjs
 */

import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser(email, password) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Checking user: ${email}`);
  console.log("=".repeat(60));

  // Login
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (authError) {
    console.error("❌ Login failed:", authError.message);
    return;
  }

  console.log("✅ Login successful");
  console.log("User ID:", authData.user.id);
  console.log("Email:", authData.user.email);

  // Get profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", authData.user.id)
    .single();

  if (profileError) {
    console.error("❌ Failed to fetch profile:", profileError.message);
  } else {
    console.log("\n📋 Profile:");
    console.log("  - Role:", profile.role || "(NULL)");
    console.log("  - Branch ID:", profile.branch_id || "(NULL)");
    console.log("  - Full Name:", profile.full_name || "(NULL)");
    console.log("  - Created:", profile.created_at);
  }

  // Test current_branch function
  const { data: branchTest, error: branchError } = await supabase.rpc("mc_current_branch");

  if (branchError) {
    console.error("❌ mc_current_branch() failed:", branchError.message);
  } else {
    console.log("\n🏢 mc_current_branch():", branchTest || "(NULL)");
  }

  // Test is_manager_or_owner function
  const { data: roleTest, error: roleError } = await supabase.rpc("mc_is_manager_or_owner");

  if (roleError) {
    console.error("❌ mc_is_manager_or_owner() failed:", roleError.message);
  } else {
    console.log("👤 mc_is_manager_or_owner():", roleTest);
  }

  // Test work_orders access
  const { data: workOrders, error: woError } = await supabase
    .from("work_orders")
    .select("id")
    .limit(1);

  if (woError) {
    console.error("❌ Cannot read work_orders:", woError.message);
  } else {
    console.log("📝 Can read work_orders:", workOrders?.length || 0, "rows");
  }

  // Logout
  await supabase.auth.signOut();
}

async function main() {
  const testUsers = [
    { email: "nguyenthanhloc28052007@gmail.com", password: "Loc123456" },
    { email: "truongcuongya123@gmail.com", password: "Cuong123456" },
    { email: "lam.tcag@gmail.com", password: "Lam123456" },
  ];

  for (const user of testUsers) {
    await checkUser(user.email, user.password);
  }

  console.log("\n" + "=".repeat(60));
  console.log("✅ All checks completed");
  console.log("=".repeat(60));
}

main().catch(console.error);
