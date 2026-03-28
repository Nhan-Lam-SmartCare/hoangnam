import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

const tables = [
  "customers",
  "work_orders",
  "sales",
  "vehicles",
  "cash_transactions",
  "parts",
  "employees",
];

console.log("\n🔍 Checking which tables exist...\n");

for (const table of tables) {
  try {
    const { count, error } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (error) {
      console.log(`❌ ${table}: ${error.message}`);
    } else {
      console.log(`✅ ${table}: ${count} records`);
    }
  } catch (e) {
    console.log(`❌ ${table}: ${e.message}`);
  }
}
