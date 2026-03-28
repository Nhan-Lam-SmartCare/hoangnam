import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;
if (!supabaseUrl || !supabaseAnonKey) {
  console.error("Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  // Candidate passwords to try (adjust if you used different ones)
  const candidatePwds = [
    "Motocare123!",
    "Motocare@2025!",
    "MotoCare@2025!",
    "Motocare2025!",
    "Motocare#2025!",
  ];

  const emails = [
    // Demo accounts
    "owner.motocare.test@gmail.com",
    "manager.motocare.test@gmail.com",
    "staff.motocare.test@gmail.com",
    // Optionally append your real users to test quickly
    process.env.TEST_EMAIL_1 || undefined,
    process.env.TEST_EMAIL_2 || undefined,
  ].filter(Boolean);

  for (const email of emails) {
    console.log(`\n=== Testing account: ${email} ===`);
    let success = false;
    for (const pwd of candidatePwds) {
      const res = await supabase.auth.signInWithPassword({
        email,
        password: pwd,
      });
      if (res.data?.session) {
        console.log(`SUCCESS with password: ${pwd}`);
        success = true;
        break;
      } else {
        console.log(
          `Fail (${pwd}) -> ${res.error?.code || "unknown"} (${
            res.error?.status || ""
          })`
        );
      }
      await new Promise((r) => setTimeout(r, 150));
    }
    if (!success) {
      console.log("No password matched.");
    }
  }

  // Domain diagnostic: try sign-up with a gmail test email
  console.log("\n=== SignUp domain diagnostic (gmail) ===");
  const testEmail = `motocare.test.${Date.now()}@gmail.com`;
  const signup = await supabase.auth.signUp({
    email: testEmail,
    password: "Motocare@2025!",
  });
  console.log("Gmail signUp result:", {
    error: signup.error
      ? {
          status: signup.error.status,
          code: signup.error.code,
          message: signup.error.message,
        }
      : null,
    userId: signup.data?.user?.id || null,
    session: !!signup.data?.session,
  });

  console.log("\n=== SignUp domain diagnostic (motocare.vn) ===");
  const diagMotocare = await supabase.auth.signUp({
    email: `diagnostic.${Date.now()}@motocare.vn`,
    password: "Motocare@2025!",
  });
  console.log("Motocare.vn signUp result:", {
    error: diagMotocare.error
      ? {
          status: diagMotocare.error.status,
          code: diagMotocare.error.code,
          message: diagMotocare.error.message,
        }
      : null,
    userId: diagMotocare.data?.user?.id || null,
    session: !!diagMotocare.data?.session,
  });
}

main().catch((err) => {
  console.error("Script error:", err);
  process.exit(1);
});
