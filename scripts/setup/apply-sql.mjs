import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Use service key for admin operations
);

// Get SQL file from command line argument
const sqlFilePath = process.argv[2];

if (!sqlFilePath) {
  console.error("❌ Please provide SQL file path as argument");
  console.log("Usage: node scripts/apply-sql.mjs sql/your-file.sql");
  process.exit(1);
}

console.log(`📄 Reading SQL from: ${sqlFilePath}`);

const sql = readFileSync(sqlFilePath, "utf8");

console.log("⏳ Applying SQL...");

const { data, error } = await supabase.rpc("exec_sql", { sql_string: sql });

if (error) {
  console.error("❌ Error applying SQL:", error);
  process.exit(1);
} else {
  console.log("✅ SQL applied successfully");
}
