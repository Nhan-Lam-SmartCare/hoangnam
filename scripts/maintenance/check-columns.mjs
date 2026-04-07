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

async function checkColumns() {
  console.log("Checking inventory_transactions columns...\n");

  // Try to select from inventory_transactions to see actual column names
  const { data, error } = await supabase
    .from("inventory_transactions")
    .select("*")
    .limit(1);

  if (error) {
    console.error("❌ Error querying table:", error.message);
    console.log("\nTrying to get columns from sales table...\n");

    const { data: salesData, error: salesError } = await supabase
      .from("sales")
      .select("*")
      .limit(1);

    if (salesError) {
      console.error("❌ Error querying sales:", salesError.message);
    } else if (salesData && salesData.length > 0) {
      console.log("✅ Sales table columns:");
      console.log(Object.keys(salesData[0]));
    }
  } else {
    if (data && data.length > 0) {
      console.log("✅ inventory_transactions columns:");
      console.log(Object.keys(data[0]));
    } else {
      console.log("⚠️ Table is empty, checking cash_transactions instead...\n");

      const { data: cashData, error: cashError } = await supabase
        .from("cash_transactions")
        .select("*")
        .limit(1);

      if (cashError) {
        console.error("❌ Error:", cashError.message);
      } else if (cashData && cashData.length > 0) {
        console.log("✅ cash_transactions columns:");
        console.log(Object.keys(cashData[0]));
      }
    }
  }
}

checkColumns().catch(console.error);
