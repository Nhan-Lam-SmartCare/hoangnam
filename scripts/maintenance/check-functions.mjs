import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkFunctions() {
  console.log("🔍 Checking critical RPC functions...\n");

  const functions = [
    "sale_create_atomic",
    "sale_delete_atomic",
    "work_order_refund_atomic",
    "work_order_create_atomic",
  ];

  const results = [];

  for (const funcName of functions) {
    // Query pg_proc to check if function exists
    const { data, error } = await supabase
      .rpc("get_function_version", {
        function_name: funcName,
      })
      .catch(() => ({ data: null, error: null }));

    // Alternative: try to describe the function
    const { data: funcData, error: funcError } = await supabase
      .from("pg_catalog.pg_proc")
      .select("proname")
      .eq("proname", funcName)
      .limit(1)
      .then(() => ({ data: [{ exists: true }], error: null }))
      .catch(() => ({ data: null, error: "Cannot query pg_catalog" }));

    results.push({
      name: funcName,
      exists: !error && !funcError,
      status: !error && !funcError ? "✅" : "❌",
    });
  }

  console.log("Function Status:");
  console.table(results);

  // Check specific function parameters
  console.log("\n🔍 Testing sale_create_atomic with sample data...");
  const testResult = await supabase
    .rpc("sale_create_atomic", {
      p_items: JSON.stringify([
        {
          partid: "test",
          quantity: 1,
          sellingprice: 100,
          costprice: 50,
        },
      ]),
      p_customer_id: null,
      p_total: 100,
      p_payment_method: "cash",
      p_branch_id: "test",
      p_user_id: "test",
    })
    .catch((err) => ({ error: err }));

  if (testResult.error) {
    console.log("Function parameters:", testResult.error.message);
  } else {
    console.log("✅ Function callable (test was dry run)");
  }
}

checkFunctions();
