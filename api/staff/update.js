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
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body) return JSON.parse(req.body);

  return await new Promise((resolve, reject) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk.toString();
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

async function assertOwner(accessToken, env) {
  const { supabaseUrl, supabaseAnonKey, serviceRoleKey } = env;
  const requesterClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user: requester },
    error: requesterError,
  } = await requesterClient.auth.getUser();

  if (requesterError || !requester) {
    throw new Error("Invalid session");
  }

  const { data: ownerProfile, error: ownerProfileError } = await adminClient
    .from("profiles")
    .select("role")
    .eq("id", requester.id)
    .maybeSingle();

  if (ownerProfileError) throw ownerProfileError;
  if (ownerProfile?.role !== "owner") {
    const error = new Error("Only owners can manage staff accounts");
    error.statusCode = 403;
    throw error;
  }

  return { adminClient };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const env = getSupabaseEnv();
  if (!env.supabaseUrl || !env.supabaseAnonKey || !env.serviceRoleKey) {
    return sendJson(res, 500, {
      error:
        "Missing server env. Set SUPABASE_URL (or VITE_SUPABASE_URL), SUPABASE_ANON_KEY (or VITE_SUPABASE_ANON_KEY), and SUPABASE_SERVICE_ROLE_KEY.",
    });
  }

  const accessToken = getBearerToken(req);
  if (!accessToken) {
    return sendJson(res, 401, { error: "Missing access token" });
  }

  try {
    const { adminClient } = await assertOwner(accessToken, env);
    const body = await readJsonBody(req);

    const userId = String(body?.id || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const name = String(body?.name || "").trim() || email.split("@")[0];
    const role =
      body?.role === "manager"
        ? "manager"
        : body?.role === "owner"
          ? "owner"
          : "staff";
    const branchId = String(body?.branch_id || "CN1").trim() || "CN1";
    const department = String(body?.department || "Kỹ thuật").trim() || "Kỹ thuật";
    const position = String(body?.position || "").trim();
    const baseSalary = Number(body?.base_salary || 0);

    if (!userId) return sendJson(res, 400, { error: "Missing staff id" });
    if (!email) return sendJson(res, 400, { error: "Email is required" });

    const { data: existingProfile, error: existingProfileError } = await adminClient
      .from("profiles")
      .select("id")
      .eq("email", email)
      .neq("id", userId)
      .maybeSingle();

    if (existingProfileError) throw existingProfileError;
    if (existingProfile) {
      return sendJson(res, 409, { error: "Email already exists" });
    }

    const { error: updateAuthError } = await adminClient.auth.admin.updateUserById(
      userId,
      {
        email,
        user_metadata: {
          name,
          role,
          branch_id: branchId,
          department,
          position,
          base_salary: baseSalary,
        },
      }
    );

    if (updateAuthError) {
      return sendJson(res, 400, {
        error: updateAuthError.message || "Could not update account",
      });
    }

    const { error: updateProfileError } = await adminClient
      .from("profiles")
      .update({
        email,
        name,
        full_name: name,
        role,
        branch_id: branchId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateProfileError) throw updateProfileError;

    const upsertEmployeeError = await upsertEmployeeWithFallback(adminClient, {
      id: userId,
      name,
      email,
      position,
      department,
      baseSalary,
      branchId,
    });

    if (upsertEmployeeError) throw upsertEmployeeError;

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
      },
    });
  } catch (error) {
    console.error("Failed to update staff account:", error);
    return sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
