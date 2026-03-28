import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://mwulglxdjcqkebqpvvsx.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13dWxnbHhkamNxa2VicXB2dnN4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA5NTQyNTAsImV4cCI6MjA0NjUzMDI1MH0.vXOwJwGp5ByM0e9IXrF7MVlpZcPQWHhOTg9Xc1hCjIQ";

const supabase = createClient(supabaseUrl, supabaseKey);

async function addVehicleIdColumn() {
  try {
    console.log("🚀 Adding vehicleid column to work_orders...\n");

    // Try to select to check if column already exists
    console.log("🔍 Checking if column exists...");
    const { data: testData, error: testError } = await supabase
      .from("work_orders")
      .select("vehicleid")
      .limit(1);

    if (!testError) {
      console.log("✅ Column vehicleid already exists!");
      console.log("Sample data:", testData);
      return;
    }

    console.log(
      "Column doesn't exist yet, need to add it manually via Supabase SQL Editor"
    );
    console.log("\n📋 Run this SQL in Supabase SQL Editor:");
    console.log("──────────────────────────────────────");
    console.log(
      "ALTER TABLE work_orders ADD COLUMN IF NOT EXISTS vehicleid TEXT;"
    );
    console.log(
      "CREATE INDEX IF NOT EXISTS idx_work_orders_vehicleid ON work_orders(vehicleid);"
    );
    console.log(
      "COMMENT ON COLUMN work_orders.vehicleid IS 'ID của xe cụ thể từ customer.vehicles[] array';"
    );
    console.log("──────────────────────────────────────");
  } catch (err) {
    console.error("❌ Error:", err);
  }
}

addVehicleIdColumn();
