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

async function checkFunction() {
  try {
    // Get function definition
    const { data, error } = await supabase.rpc("execute_sql", {
      query: `
        SELECT 
          pg_get_functiondef(oid) as definition,
          proargnames as arg_names,
          proargtypes::regtype[] as arg_types
        FROM pg_proc 
        WHERE proname = 'sale_create_atomic'
        ORDER BY oid DESC
        LIMIT 1
      `,
    });

    if (error) {
      console.error("Error:", error);
      return;
    }

    console.log("Function definition:");
    console.log(data);
  } catch (err) {
    console.error("Exception:", err);
  }
}

checkFunction();
