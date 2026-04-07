import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const key =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error("Missing VITE_SUPABASE_URL or API key in env.");
  process.exit(1);
}

const supabase = createClient(url, key);

const TABLES_TO_CLEAR = [
  "customer_debts",
  "supplier_debts",
  "cash_transactions",
  "inventory_transactions",
  "work_orders",
  "sales",
  "customers",
  "suppliers",
];

const MISSING_TABLE_HINTS = [
  "Could not find the table",
  "relation",
  "does not exist",
];

const isMissingTableError = (message = "") =>
  MISSING_TABLE_HINTS.some((hint) => message.includes(hint));

async function clearTable(table) {
  try {
    const { error } = await supabase
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    if (error) {
      if (isMissingTableError(error.message || "")) {
        console.log(`   ⚠️  Skip ${table}: table not found in current schema`);
        return;
      }
      throw error;
    }

    const { count, error: countError } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });

    if (countError) {
      console.log(`   ✅ Cleared ${table} (count unavailable)`);
      return;
    }

    console.log(`   ✅ Cleared ${table} (remaining: ${count ?? 0})`);
  } catch (error) {
    const message = error?.message || String(error);
    console.log(`   ❌ Failed ${table}: ${message}`);
  }
}

async function main() {
  console.log("\n🧹 Clearing go-live data...\n");

  for (const table of TABLES_TO_CLEAR) {
    console.log(`→ ${table}`);
    await clearTable(table);
  }

  console.log("\n✅ Clear process finished.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err?.message || err);
  process.exit(1);
});
