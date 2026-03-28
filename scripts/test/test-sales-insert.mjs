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
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInsert() {
  console.log("Testing sales insert with all possible columns...\n");

  const testId = "TEST-" + Date.now();

  // Get current user
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData?.user?.id || "00000000-0000-0000-0000-000000000000";

  // Test with username included
  const { data, error } = await supabase
    .from("sales")
    .insert({
      id: testId,
      date: new Date().toISOString(),
      items: [],
      subtotal: 0,
      total: 0,
      customer: {},
      paymentmethod: "cash",
      userid: userId,
      username: "Test User",
      branchid: "CN1",
    })
    .select();

  if (error) {
    console.error("❌ Error:", error.message);
    console.log("\nHint:", error.hint);
    console.log("Details:", error.details);
  } else {
    console.log("✅ Success! Inserted row:");
    console.log(data);

    // Delete test row
    await supabase.from("sales").delete().eq("id", testId);
    console.log("\n✅ Test row deleted");
  }
}

testInsert().catch(console.error);
