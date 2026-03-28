import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkAuth() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();

  if (error) {
    console.error("❌ Error getting session:", error);
    return;
  }

  if (!session) {
    console.log("❌ No active session - user not logged in");
    return;
  }

  console.log("✅ User logged in:");
  console.log("Email:", session.user.email);
  console.log("User ID:", session.user.id);
  console.log("Role:", session.user.role);

  // Get user profile
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", session.user.id)
    .single();

  if (profileError) {
    console.error("❌ Error getting profile:", profileError);
  } else {
    console.log("\n👤 Profile:");
    console.log(profile);
  }
}

checkAuth().catch(console.error);
