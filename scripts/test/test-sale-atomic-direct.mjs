#!/usr/bin/env node
/**
 * Test sale_create_atomic function directly
 */
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSaleAtomic() {
  console.log("Testing sale_create_atomic function...\n");

  // Get current user
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    console.error("Auth error:", userError);
    return;
  }

  const userId = userData.user?.id;
  console.log("User ID:", userId);
  console.log("User email:", userData.user?.email);

  // Test payload
  const payload = {
    p_sale_id: `TEST-${Date.now()}`,
    p_items: [
      {
        sku: "806JBDQP",
        partName: "Ắc nội AB 125",
        partId: null,
        quantity: 1,
        sellingPrice: 95000,
      },
    ],
    p_discount: 0,
    p_customer: { name: "Khách test" },
    p_payment_method: "cash",
    p_user_id: userId,
    p_user_name: userData.user?.email || "Test User",
    p_branch_id: "CN1",
  };

  console.log("\nCalling sale_create_atomic with payload:");
  console.log(JSON.stringify(payload, null, 2));

  const { data, error } = await supabase.rpc("sale_create_atomic", payload);

  if (error) {
    console.error("\n❌ ERROR:");
    console.error("Code:", error.code);
    console.error("Message:", error.message);
    console.error("Details:", error.details);
    console.error("Hint:", error.hint);
    console.error("Full error:", JSON.stringify(error, null, 2));
    return;
  }

  console.log("\n✅ SUCCESS:");
  console.log(JSON.stringify(data, null, 2));
}

testSaleAtomic().catch(console.error);
