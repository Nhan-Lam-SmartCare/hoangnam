import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const supabaseUrl = "https://mwulglxdjcqkebqpvvsx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13dWxnbHhkamNxa2VicXB2dnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTQyNTAsImV4cCI6MjA0NjUzMDI1MH0.vXOwJwGp5ByM0e9IXrF7MVlpZcPQWHhOTg9Xc1hCjIQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log("🚀 Applying vehicle migration...\n");

    // Read SQL file
    const sqlPath = join(
      __dirname,
      "../sql/2025-11-17_add_vehicleid_to_work_orders.sql"
    );
    const sql = readFileSync(sqlPath, "utf-8");

    console.log("📄 SQL to execute:");
    console.log(sql);
    console.log("\n");

    // Execute SQL
    const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });

    if (error) {
      console.error("❌ Migration failed:", error);
      return;
    }

    console.log("✅ Migration applied successfully!");

    // Verify column was added
    console.log("\n🔍 Verifying column exists...");
    const { data: columns, error: verifyError } = await supabase
      .from("work_orders")
      .select("vehicleid")
      .limit(1);

    if (verifyError) {
      console.error("❌ Verification failed:", verifyError);
      return;
    }

    console.log("✅ Column vehicleid exists and is accessible!");
    console.log("\n✨ Migration complete!");
  } catch (err) {
    console.error("❌ Unexpected error:", err);
  }
}

applyMigration();
