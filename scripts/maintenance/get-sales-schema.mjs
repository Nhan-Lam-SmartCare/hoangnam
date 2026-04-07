import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing env vars");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function getTableSchema() {
  console.log("Fetching sales table schema from database...\n");

  // Use information_schema to get exact column names
  const { data, error } = await supabase.rpc("exec_raw_sql", {
    query: `
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sales'
      ORDER BY ordinal_position;
    `,
  });

  if (error) {
    console.log("RPC not available, trying direct insert to check error...\n");

    // Try inserting with different column name variations to see which works
    const testId = "TEST-" + Date.now();

    // Test 1: Try camelCase
    console.log("Test 1: Trying camelCase columns...");
    const { error: e1 } = await supabase.from("sales").insert({
      id: testId + "-1",
      date: new Date().toISOString(),
      items: [],
      subtotal: 0,
      total: 0,
      customer: {},
      paymentMethod: "cash",
      userId: "test",
      branchId: "CN1",
    });
    console.log("Result:", e1 ? e1.message : "✅ Success");

    // Test 2: Try lowercase
    console.log("\nTest 2: Trying lowercase columns...");
    const { error: e2 } = await supabase.from("sales").insert({
      id: testId + "-2",
      date: new Date().toISOString(),
      items: [],
      subtotal: 0,
      total: 0,
      customer: {},
      paymentmethod: "cash",
      userid: "test",
      branchid: "CN1",
    });
    console.log("Result:", e2 ? e2.message : "✅ Success");
  } else {
    console.log("Sales table columns:");
    console.table(data);
  }
}

getTableSchema().catch(console.error);
