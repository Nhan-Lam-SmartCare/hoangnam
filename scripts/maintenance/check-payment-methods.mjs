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

async function checkPaymentMethods() {
  console.log("Checking payment methods in sales table...\n");

  const { data, error } = await supabase
    .from("sales")
    .select("id, paymentmethod, customer, total")
    .order("date", { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("No sales found");
    return;
  }

  console.log("Recent sales:");
  console.table(
    data.map((s) => ({
      id: s.id,
      paymentmethod: s.paymentmethod,
      customer: s.customer?.name || "N/A",
      total: s.total,
    }))
  );

  // Check column name case sensitivity
  console.log("\n=== Raw data sample ===");
  console.log(JSON.stringify(data[0], null, 2));
}

checkPaymentMethods().catch(console.error);
