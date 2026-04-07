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

async function testDeleteWithRestore() {
  console.log("=== TEST: Delete Sale with Inventory Restore ===\n");

  // Step 1: Check if function exists
  console.log("1. Checking if sale_delete_atomic function exists...");

  const { data: funcData, error: funcError } = await supabase.rpc(
    "sale_delete_atomic",
    { p_sale_id: "non-existent-test" }
  );

  if (funcError) {
    if (funcError.message.includes("SALE_NOT_FOUND")) {
      console.log("   ✅ Function exists and works!\n");
    } else if (funcError.code === "PGRST202") {
      console.log("   ❌ Function does NOT exist!");
      console.log(
        "   📝 You need to run: sql/2025-11-17_sale_delete_atomic.sql\n"
      );
      return;
    } else {
      console.log("   ⚠️  Unexpected error:", funcError.message, "\n");
    }
  }

  // Step 2: Test with a real sale (if exists)
  console.log("2. Looking for a test sale to delete...");

  const { data: sales, error: salesError } = await supabase
    .from("sales")
    .select("id, items, branchid")
    .limit(5);

  if (salesError || !sales || sales.length === 0) {
    console.log("   ⚠️  No sales found to test\n");
    return;
  }

  const testSale = sales[0];
  console.log(`   Found sale: ${testSale.id}`);
  console.log(`   Items count: ${testSale.items?.length || 0}`);
  console.log(`   Branch: ${testSale.branchid}\n`);

  // Step 3: Check stock before delete
  if (testSale.items && testSale.items.length > 0) {
    const firstItem = testSale.items[0];
    console.log("3. Stock BEFORE delete:");

    const { data: partBefore } = await supabase
      .from("parts")
      .select("id, name, stock")
      .eq("id", firstItem.partId)
      .single();

    if (partBefore) {
      const stockBefore = partBefore.stock?.[testSale.branchid] || 0;
      console.log(`   ${partBefore.name}: ${stockBefore} units\n`);

      // Step 4: Delete with restore
      console.log("4. Deleting sale and restoring inventory...");

      const { data: deleteResult, error: deleteError } = await supabase.rpc(
        "sale_delete_atomic",
        { p_sale_id: testSale.id }
      );

      if (deleteError) {
        console.log("   ❌ Error:", deleteError.message);
      } else {
        console.log("   ✅ Success!");
        console.log("   Result:", deleteResult);

        // Step 5: Check stock after delete
        console.log("\n5. Stock AFTER delete:");

        const { data: partAfter } = await supabase
          .from("parts")
          .select("id, name, stock")
          .eq("id", firstItem.partId)
          .single();

        if (partAfter) {
          const stockAfter = partAfter.stock?.[testSale.branchid] || 0;
          console.log(`   ${partAfter.name}: ${stockAfter} units`);

          const expectedRestore = firstItem.quantity || 0;
          const actualRestore = stockAfter - stockBefore;

          console.log(`\n   Expected restore: +${expectedRestore}`);
          console.log(`   Actual restore: +${actualRestore}`);

          if (actualRestore === expectedRestore) {
            console.log("   ✅ Inventory restored correctly!");
          } else {
            console.log("   ❌ Inventory restore mismatch!");
          }
        }
      }
    }
  }
}

testDeleteWithRestore().catch(console.error);
