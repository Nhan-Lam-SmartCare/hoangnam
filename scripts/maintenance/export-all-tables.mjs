import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "..", "..", ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("❌ Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const TABLES = [
  "categories",
  "parts",
  "suppliers",
  "customers",
  "sales",
  "work_orders",
  "cash_transactions",
  "payment_sources",
  "inventory_transactions",
  "customer_debts",
  "supplier_debts"
];

async function exportAllTables() {
  console.log("⏳ Starting local database backup...");
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const backupDir = path.join(__dirname, "..", "..", "backups", `backup_${timestamp}`);

  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  for (const table of TABLES) {
    try {
      const { data, error } = await supabase.from(table).select("*");

      if (error) throw error;

      const filename = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filename, JSON.stringify(data, null, 2));

      console.log(`✅ Table "${table}": exported ${data.length} rows`);
    } catch (err) {
      console.error(`❌ Table "${table}": error:`, err.message);
    }
  }

  // Create metadata.json
  const metadata = {
    timestamp: new Date().toISOString(),
    tables: TABLES,
    project: supabaseUrl
  };
  fs.writeFileSync(
    path.join(backupDir, "metadata.json"),
    JSON.stringify(metadata, null, 2)
  );

  console.log(`\n🎉 Backup saved successfully to: ${backupDir}`);
}

exportAllTables();
