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

async function checkDebts() {
  console.log("Checking customer_debts table...\n");

  const { data, error } = await supabase
    .from("customer_debts")
    .select("id, customer_name, description, total_amount")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("❌ Error:", error.message);
    return;
  }

  if (!data || data.length === 0) {
    console.log("No debts found");
    return;
  }

  console.log("Recent debts:\n");
  data.forEach((debt, i) => {
    console.log(`${i + 1}. ID: ${debt.id}`);
    console.log(`   Customer: ${debt.customer_name}`);
    console.log(`   Amount: ${debt.total_amount}`);
    console.log(`   Description:`);
    console.log(`   ${debt.description.split("\n").join("\n   ")}`);
    console.log("");
  });
}

checkDebts().catch(console.error);
