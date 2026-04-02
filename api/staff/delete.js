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

    if (!userId) return sendJson(res, 400, { error: "Missing staff id" });

    const { data: targetProfile, error: targetProfileError } = await adminClient
      .from("profiles")
      .select("role")
      .eq("id", userId)
      .maybeSingle();

    if (targetProfileError) throw targetProfileError;
    if (targetProfile?.role === "owner") {
      return sendJson(res, 400, { error: "Cannot delete owner account" });
    }

    const { error: deleteEmployeeError } = await adminClient
      .from("employees")
      .delete()
      .eq("id", userId);

    if (deleteEmployeeError) throw deleteEmployeeError;

    const { error: deleteUserError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteUserError) {
      return sendJson(res, 400, {
        error: deleteUserError.message || "Could not delete account",
      });
    }

    return sendJson(res, 200, { success: true });
  } catch (error) {
    console.error("Failed to delete staff account:", error);
    return sendJson(res, error.statusCode || 500, {
      error: error instanceof Error ? error.message : "Internal server error",
    });
  }
}
