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

async function testSaleCreateAtomic() {
  console.log("Testing sale_create_atomic function...\n");

  const testPayload = {
    p_sale_id: "TEST-" + Date.now(),
    p_items: [
      {
        partId: "test-part",
        sku: "TEST123",
        partName: "Test Part",
        quantity: 1,
        unitPrice: 100000,
        discount: 0,
      },
    ],
    p_discount: 0,
    p_customer: { name: "Test Customer" },
    p_payment_method: "cash",
    p_user_id: "test-user",
    p_user_name: "Test User",
    p_branch_id: "CN1",
  };

  console.log("Calling sale_create_atomic with test payload...");

  const { data, error } = await supabase.rpc("sale_create_atomic", testPayload);

  if (error) {
    console.error("\n❌ Error calling sale_create_atomic:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
  } else {
    console.log("\n✅ Function called successfully!");
    console.log("Result:", JSON.stringify(data, null, 2));
  }
}

testSaleCreateAtomic().catch(console.error);
