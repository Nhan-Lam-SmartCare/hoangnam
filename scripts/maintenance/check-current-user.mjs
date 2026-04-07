import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkUser() {
  console.log("Checking current user and permissions...\n");

  // Get current user
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    console.error("❌ Not authenticated:", userError.message);
    console.log("\n💡 You need to login first!");
    return;
  }

  console.log("✅ Authenticated user:");
  console.log("  ID:", userData.user.id);
  console.log("  Email:", userData.user.email);

  // Get profile with role
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userData.user.id)
    .single();

  if (profileError) {
    console.error("\n❌ Error fetching profile:", profileError.message);
  } else {
    console.log("\n📋 Profile:");
    console.log("  Name:", profile.name);
    console.log("  Role:", profile.role);
    console.log("  Branch:", profile.branchid);
  }

  // Test the helper functions
  const { data: isManager, error: managerError } = await supabase.rpc(
    "mc_is_manager_or_owner"
  );

  if (managerError) {
    console.error("\n❌ Error checking mc_is_manager_or_owner:", managerError);
  } else {
    console.log("\n🔐 Permission check:");
    console.log("  mc_is_manager_or_owner():", isManager);
  }

  const { data: currentBranch, error: branchError } = await supabase.rpc(
    "mc_current_branch"
  );

  if (branchError) {
    console.error("\n❌ Error checking mc_current_branch:", branchError);
  } else {
    console.log("  mc_current_branch():", currentBranch);
  }
}

checkUser().catch(console.error);
