import { createClient } from "@supabase/supabase-js";

function getSupabaseEnv() {
  return {
    supabaseUrl: process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY,
    serviceRoleKey:
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_ROLE,
  };
}

const ALLOWED_ACTIONS = [
  "sale.create",
  "sale.delete",
  "work_order.create",
  "work_order.update",
  "work_order.status.update",
  "work_order.payment.update",
  "work_order.parts.update",
  "work_order.labor.update",
  "work_order.discount.update",
  "work_order.customer.update",
  "work_order.vehicle.update",
  "work_order.outsource_service.update",
  "work_order.delete",
  "work_order.print",
  "work_order.refund",
  "work_order.history.view",
  "inventory.import",
  "inventory.transfer",
  "inventory.export_excel",
  "inventory.import.file",
  "inventory.history.view",
  "inventory.barcode.print",
  "inventory.view_import_price",
  "inventory.receipt.edit",
  "inventory.receipt.delete",
  "part.create",
  "part.update",
  "part.update_price",
  "part.delete",
  "settings.update",
  "cashbook.view",
  "finance.view",
  "payroll.view",
  "analytics.view",
  "reports.view",
  "employees.view",
  "debt.view",
];

function normalizePermissions(input) {
  if (!input || typeof input !== "object") return {};

  return ALLOWED_ACTIONS.reduce((acc, action) => {
    if (typeof input[action] === "boolean") {
      acc[action] = input[action];
    }
    return acc;
  }, {});
}

async function upsertProfileWithPermissionFallback(adminClient, basePayload, permissions) {
  const candidates = [
    { ...basePayload, custom_permissions: permissions },
    { ...basePayload, permission_overrides: permissions },
    { ...basePayload },
  ];

  let lastError = null;
  for (const payload of candidates) {
    const { error } = await adminClient
      .from("profiles")
      .upsert(payload, { onConflict: "id" });

    if (!error) return null;
    lastError = error;
  }

  return lastError;
}

async function upsertEmployeeWithFallback(adminClient, data) {
  const candidatePayloads = [
    {
      id: data.id,
      name: data.name,
      email: data.email,
      position: data.position,
      department: data.department,
      base_salary: data.baseSalary,
      status: "active",
      branchId: data.branchId,
    },
    {
      id: data.id,
      name: data.name,
      email: data.email,
      position: data.position,
      department: data.department,
      base_salary: data.baseSalary,
      status: "active",
      branch_id: data.branchId,
    },
    {
      id: data.id,
      name: data.name,
      email: data.email,
      position: data.position,
      base_salary: data.baseSalary,
      status: "active",
      branchId: data.branchId,
    },
    {
      id: data.id,
      name: data.name,
      email: data.email,
      position: data.position,
      base_salary: data.baseSalary,
      status: "active",
      branch_id: data.branchId,
    },
    {
      id: data.id,
      name: data.name,
      email: data.email,
      status: "active",
    },
  ];

  let lastError = null;
  for (const payload of candidatePayloads) {
    const { error } = await adminClient
      .from("employees")
      .upsert(payload, { onConflict: "id" });

    if (!error) return null;
    lastError = error;
  }

  return lastError;
}

function sendJson(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getBearerToken(req) {
  const header = req.headers.authorization || req.headers.Authorization;
  if (!header || typeof header !== "string") return null;

  const [scheme, token] = header.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  return token;
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body) {
    return JSON.parse(req.body);
  }

  return await new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk.toString();
    });

    req.on("end", () => {
      if (!raw) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });

    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = getSupabaseEnv();

  if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
    return sendJson(res, 500, {
      error:
        "Missing server env. Set SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY), and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return sendJson(res, 401, { error: "Missing access token" });
  }

  const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  try {
    const {
      data: { user: requester },
      error: requesterError,
    } = await requesterClient.auth.getUser();

    if (requesterError || !requester) {
      return sendJson(res, 401, { error: "Invalid session" });
    }

    const { data: ownerProfile, error: ownerProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", requester.id)
      .maybeSingle();

    if (ownerProfileError) {
      return sendJson(res, 500, { error: ownerProfileError.message });
    }

    if (ownerProfile?.role !== "owner") {
      return sendJson(res, 403, {
        error: "Only owners can create staff accounts",
      });
    }

    const body = await readJsonBody(req);
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");
    const name = String(body?.name || "").trim() || email.split("@")[0];
    const role = body?.role === "manager" ? "manager" : "staff";
    const branchId = String(body?.branch_id || "CN1").trim() || "CN1";
    const department = String(body?.department || "Kỹ thuật").trim() || "Kỹ thuật";
    const position = String(body?.position || "").trim();
    const baseSalary = Number(body?.base_salary || 0);
    const permissions = normalizePermissions(body?.permissions || {});

    if (!email) {
      return sendJson(res, 400, { error: "Email is required" });
    }

    if (password.length < 6) {
      return sendJson(res, 400, {
        error: "Temporary password must be at least 6 characters",
      });
    }

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (existingProfileError) {
      return sendJson(res, 500, { error: existingProfileError.message });
    }

    if (existingProfile) {
      return sendJson(res, 409, { error: "Email already exists" });
    }

    const { data: createdUserData, error: createUserError } =
      await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
          name,
          role,
          branch_id: branchId,
          department,
          position,
          base_salary: baseSalary,
          custom_permissions: permissions,
          permission_overrides: permissions,
          created_by_owner_id: requester.id,
        },
      });

    if (createUserError || !createdUserData?.user) {
      return sendJson(res, 400, {
        error: createUserError?.message || "Could not create account",
      });
    }

    const userId = createdUserData.user.id;
    const upsertProfileError = await upsertProfileWithPermissionFallback(
      adminClient,
      {
        id: userId,
        email,
        role,
        name,
        full_name: name,
        branch_id: branchId,
        updated_at: new Date().toISOString(),
      },
      permissions
    );

    if (upsertProfileError) {
      await adminClient.auth.admin.deleteUser(userId);
      return sendJson(res, 500, { error: upsertProfileError.message });
    }

    const upsertEmployeeError = await upsertEmployeeWithFallback(adminClient, {
      id: userId,
      name,
      email,
      position,
      department,
      baseSalary,
      branchId,
    });

    if (upsertEmployeeError) {
      await adminClient.from("profiles").delete().eq("id", userId);
      await adminClient.auth.admin.deleteUser(userId);
      return sendJson(res, 500, { error: upsertEmployeeError.message });
    }

    return sendJson(res, 200, {
      user: {
        id: userId,
        email,
        name,
        role,
        branch_id: branchId,
        department,
        position,
        base_salary: baseSalary,
        permissions,
      },
    });
  } catch (error) {
    console.error("Failed to create staff account:", error);
    return sendJson(res, 500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
