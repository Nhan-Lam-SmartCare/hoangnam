import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE; // optional (for admin create)

if (!supabaseUrl) {
  console.error("Missing VITE_SUPABASE_URL in .env");
  process.exit(1);
}

const supabaseAnon = supabaseAnonKey
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;
const supabaseAdmin = serviceRoleKey
  ? createClient(supabaseUrl, serviceRoleKey)
  : null;

// Real users to create with explicit passwords
const realUsers = [
  { email: "truongcuongya123@gmail.com", password: "Cuong123456" },
  { email: "nguyenthanhloc28052007@gmail.com", password: "Loc123456" },
  { email: "lam.tcag@gmail.com", password: "Lam123456" },
];

// Optional demo users (kept for convenience)
const demoUsers = [
  { email: "owner.motocare.test@gmail.com", password: "Motocare@2025!" },
  { email: "manager.motocare.test@gmail.com", password: "Motocare@2025!" },
  { email: "staff.motocare.test@gmail.com", password: "Motocare@2025!" },
];

async function ensureUserAdmin(email, password) {
  if (!supabaseAdmin) return false;
  const res = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (res.error && res.error.code !== "user_already_exists") {
    console.log("admin.createUser error for", email, res.error);
  } else {
    console.log(
      "admin create/exists:",
      email,
      res.data?.user?.id || "existing"
    );
  }
  return true;
}

async function ensureUserAnon(email, password) {
  if (!supabaseAnon) {
    console.log("Anon client not configured; skip signUp for", email);
    return;
  }
  const r1 = await supabaseAnon.auth.signUp({ email, password });
  if (r1.error && r1.error.code !== "user_already_exists") {
    console.log("signUp error for", email, r1.error);
  } else {
    console.log(
      "signUp ok/existing for",
      email,
      r1.data?.user?.id || "existing",
      r1.error?.message ? `(warn: ${r1.error.message})` : ""
    );
  }
}

async function main() {
  // Prefer admin create if service role provided; otherwise fallback to anon signUp
  for (const u of realUsers) {
    const usedAdmin = await ensureUserAdmin(u.email, u.password);
    if (!usedAdmin) await ensureUserAnon(u.email, u.password);
  }

  // Optional demo accounts
  for (const u of demoUsers) {
    const usedAdmin = await ensureUserAdmin(u.email, u.password);
    if (!usedAdmin) await ensureUserAnon(u.email, u.password);
  }

  if (!supabaseAdmin) {
    console.log(
      "Note: SUPABASE_SERVICE_ROLE not set. If your project requires email confirmations, please confirm the accounts via email or disable confirm in Auth settings for dev."
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
