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

async function checkAllColumns() {
  console.log("=== SALES TABLE ===");
  const { data: sales, error: e1 } = await supabase
    .from("sales")
    .select("*")
    .limit(1);
  if (sales && sales[0]) console.log(Object.keys(sales[0]));
  else console.log("Error or empty:", e1?.message);

  console.log("\n=== CUSTOMER_DEBTS TABLE ===");
  const { data: debts, error: e2 } = await supabase
    .from("customer_debts")
    .select("*")
    .limit(1);
  if (debts && debts[0]) console.log(Object.keys(debts[0]));
  else console.log("Error or empty:", e2?.message);

  console.log("\n=== CASH_TRANSACTIONS TABLE ===");
  const { data: cash, error: e3 } = await supabase
    .from("cash_transactions")
    .select("*")
    .limit(1);
  if (cash && cash[0]) console.log(Object.keys(cash[0]));
  else console.log("Error or empty:", e2?.message);

  console.log("\n=== INVENTORY_TRANSACTIONS TABLE ===");
  const { data: inv, error: e4 } = await supabase
    .from("inventory_transactions")
    .select("*")
    .limit(1);
  if (inv && inv[0]) console.log(Object.keys(inv[0]));
  else console.log("Error or empty:", e3?.message);
}

checkAllColumns().catch(console.error);
