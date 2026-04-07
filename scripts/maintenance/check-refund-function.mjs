import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkFunctions() {
  console.log("🔍 Checking available RPC functions...\n");

  // Try to call a simple test
  const { data, error } = await supabase.rpc("work_order_refund_atomic", {
    p_order_id: "test",
    p_refund_reason: "test",
    p_user_id: "test",
  });

  if (error) {
    console.error("❌ Function call error:", error);
    console.error("Error code:", error.code);
    console.error("Error message:", error.message);
    console.error("Error details:", error.details);
    console.error("Error hint:", error.hint);

    if (error.code === "PGRST202" || error.code === "404") {
      console.log(
        '\n❌ Function "work_order_refund_atomic" does NOT exist in database!'
      );
      console.log(
        "\n📝 You need to run the SQL in Supabase SQL Editor manually:"
      );
      console.log("   1. Go to Supabase Dashboard → SQL Editor");
      console.log(
        "   2. Open file: sql/2025-11-17_fix_work_order_refund_no_auth.sql"
      );
      console.log("   3. Copy all content and paste into SQL Editor");
      console.log('   4. Click "Run" button');
    } else if (error.code === "42883") {
      console.log("\n❌ Function exists but signature is wrong!");
    } else {
      console.log(
        "\n⚠️ Function exists but returned error (expected for test call)"
      );
    }
  } else {
    console.log("✅ Function exists and responded!");
    console.log("Response:", data);
  }
}

checkFunctions().catch(console.error);
