#!/usr/bin/env node
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const serviceRole =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRole) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment"
  );
  process.exit(1);
}

const admin = createClient(url, serviceRole, { auth: { persistSession: false } });

const normalizeEmail = (value) => String(value || "").trim().toLowerCase();

async function fetchAllAuthUsers() {
  const users = [];
  let page = 1;
  const perPage = 200;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const rows = data?.users || [];
    users.push(...rows);

    if (rows.length < perPage) break;
    page += 1;
  }

  return users;
}

async function fetchProfiles() {
  const selectCandidates = [
    "id,email,role,status,branch_id,branchId,branchid,updated_at,created_at",
    "id,email,role,branch_id,branchId,branchid,updated_at,created_at",
    "id,email,role,branch_id,updated_at,created_at",
    "id,email,role,branchId,updated_at,created_at",
    "id,email,role,branchid,updated_at,created_at",
    "id,email,role,updated_at,created_at",
  ];

  let lastError = null;

  for (const columns of selectCandidates) {
    const { data, error } = await admin
      .from("profiles")
      .select(columns)
      .limit(5000);

    if (!error) {
      return data || [];
    }

    lastError = error;
    const msg = String(error.message || "").toLowerCase();
    if (!msg.includes("column")) {
      throw error;
    }
  }

  if (lastError) throw lastError;
  return [];
}

function collectIssues(authUsers, profiles) {
  const validRoles = new Set(["owner", "manager", "staff"]);
  const aliasStaffRoles = new Set([
    "employee",
    "nhanvien",
    "nhan_vien",
    "nhan-vien",
    "technician",
    "tech",
    "sales",
    "sale",
  ]);

  const authById = new Map(authUsers.map((u) => [String(u.id), u]));
  const profileById = new Map(profiles.map((p) => [String(p.id), p]));

  const missingProfileById = authUsers.filter((u) => !profileById.has(String(u.id)));

  const orphanProfiles = profiles.filter((p) => !authById.has(String(p.id)));

  const invalidRoleProfiles = profiles.filter((p) => {
    const role = String(p.role || "").trim().toLowerCase();
    return role && !validRoles.has(role) && !aliasStaffRoles.has(role);
  });

  const missingRoleProfiles = profiles.filter(
    (p) => !String(p.role || "").trim()
  );

  const missingBranchProfiles = profiles.filter((p) => {
    const role = String(p.role || "").trim().toLowerCase();
    const branch =
      String(p.branch_id || "").trim() ||
      String(p.branchId || "").trim() ||
      String(p.branchid || "").trim();
    return role !== "owner" && !branch;
  });

  const emailMismatchById = profiles
    .map((p) => {
      const authUser = authById.get(String(p.id));
      if (!authUser) return null;
      const pEmail = normalizeEmail(p.email);
      const aEmail = normalizeEmail(authUser.email);
      if (!pEmail || !aEmail || pEmail === aEmail) return null;
      return {
        id: p.id,
        profileEmail: p.email,
        authEmail: authUser.email,
        role: p.role || null,
      };
    })
    .filter(Boolean);

  const profileEmailMap = new Map();
  for (const p of profiles) {
    const e = normalizeEmail(p.email);
    if (!e) continue;
    if (!profileEmailMap.has(e)) profileEmailMap.set(e, []);
    profileEmailMap.get(e).push(p);
  }
  const duplicateProfileEmails = Array.from(profileEmailMap.entries())
    .filter(([, rows]) => rows.length > 1)
    .map(([email, rows]) => ({
      email,
      count: rows.length,
      ids: rows.map((r) => r.id),
    }));

  return {
    counts: {
      authUsers: authUsers.length,
      profiles: profiles.length,
      missingProfileById: missingProfileById.length,
      orphanProfiles: orphanProfiles.length,
      missingRoleProfiles: missingRoleProfiles.length,
      invalidRoleProfiles: invalidRoleProfiles.length,
      missingBranchProfiles: missingBranchProfiles.length,
      emailMismatchById: emailMismatchById.length,
      duplicateProfileEmails: duplicateProfileEmails.length,
    },
    details: {
      missingProfileById: missingProfileById.map((u) => ({
        id: u.id,
        email: u.email,
        lastSignInAt: u.last_sign_in_at,
      })),
      orphanProfiles: orphanProfiles.map((p) => ({
        id: p.id,
        email: p.email || null,
        role: p.role || null,
      })),
      missingRoleProfiles: missingRoleProfiles.map((p) => ({
        id: p.id,
        email: p.email || null,
      })),
      invalidRoleProfiles: invalidRoleProfiles.map((p) => ({
        id: p.id,
        email: p.email || null,
        role: p.role || null,
      })),
      missingBranchProfiles: missingBranchProfiles.map((p) => ({
        id: p.id,
        email: p.email || null,
        role: p.role || null,
        branch_id: p.branch_id || p.branchId || p.branchid || null,
      })),
      emailMismatchById,
      duplicateProfileEmails,
    },
  };
}

function printSection(title, rows, limit = 20) {
  if (!rows?.length) {
    console.log(`\n${title}: OK`);
    return;
  }

  console.log(`\n${title}: ${rows.length}`);
  rows.slice(0, limit).forEach((row, idx) => {
    console.log(`${idx + 1}. ${JSON.stringify(row)}`);
  });
  if (rows.length > limit) {
    console.log(`... and ${rows.length - limit} more`);
  }
}

async function main() {
  try {
    const [authUsers, profiles] = await Promise.all([
      fetchAllAuthUsers(),
      fetchProfiles(),
    ]);

    const report = collectIssues(authUsers, profiles);

    console.log("=== ACCOUNT AUDIT SUMMARY ===");
    console.log(JSON.stringify(report.counts, null, 2));

    printSection("Missing profile by auth.id", report.details.missingProfileById);
    printSection("Orphan profiles (id not in auth.users)", report.details.orphanProfiles);
    printSection("Profiles missing role", report.details.missingRoleProfiles);
    printSection("Profiles invalid role", report.details.invalidRoleProfiles);
    printSection("Profiles missing branch (non-owner)", report.details.missingBranchProfiles);
    printSection("Email mismatch by id", report.details.emailMismatchById);
    printSection("Duplicate profile emails", report.details.duplicateProfileEmails);

    const hasIssues = Object.entries(report.counts)
      .filter(([k]) => !["authUsers", "profiles"].includes(k))
      .some(([, v]) => Number(v) > 0);

    if (hasIssues) {
      process.exitCode = 2;
      console.log("\nResult: ISSUES_FOUND");
      return;
    }

    console.log("\nResult: OK");
  } catch (error) {
    console.error("Audit failed:", error?.message || error);
    process.exit(1);
  }
}

main();
