import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, "..", ".env") });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(
    "Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const sqlFile = process.argv[2];
if (!sqlFile) {
  console.error("Usage: node apply-sql-direct.mjs <path-to-sql-file>");
  process.exit(1);
}

const sqlContent = readFileSync(sqlFile, "utf-8");

console.log(`📄 Applying SQL from: ${sqlFile}`);
console.log(`📝 SQL length: ${sqlContent.length} characters`);

// Split by statement if needed (simple approach - split by semicolon at end of line)
const statements = sqlContent
  .split(/;\s*$/gm)
  .map((s) => s.trim())
  .filter((s) => s.length > 0 && !s.startsWith("--"));

console.log(`📊 Found ${statements.length} SQL statements\n`);

async function executeStatements() {
  for (let i = 0; i < statements.length; i++) {
    const statement = statements[i];
    console.log(`\n[${i + 1}/${statements.length}] Executing statement...`);
    console.log(statement.substring(0, 100) + "...\n");

    try {
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: supabaseServiceKey,
          Authorization: `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sql: statement }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`❌ Error:`, error);
        process.exit(1);
      }

      console.log(`✅ Success`);
    } catch (error) {
      console.error(`❌ Error:`, error.message);
      process.exit(1);
    }
  }

  console.log(`\n✅ All statements executed successfully!`);
}

executeStatements().catch(console.error);
