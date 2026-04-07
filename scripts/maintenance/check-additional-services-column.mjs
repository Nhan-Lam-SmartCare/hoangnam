import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkColumn() {
  console.log(
    "🔍 Checking if additionalservices column exists in work_orders table...\n"
  );

  // Try to query the column
  const { data, error } = await supabase
    .from("work_orders")
    .select("id, additionalservices")
    .limit(1);

  if (error) {
    console.error("❌ Column does NOT exist or error occurred:");
    console.error(error);
    console.log(
      "\n📝 You need to run: sql/2025-11-17_add_additional_services_column.sql"
    );
    return false;
  }

  console.log("✅ Column additionalservices EXISTS in work_orders table");
  console.log("Sample data:", data);
  return true;
}

checkColumn();
