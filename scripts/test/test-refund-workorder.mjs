import { createClient } from "@supabase/supabase-js";
import "dotenv/config";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function testRefund() {
  // Login first
  const { data: authData, error: authError } =
    await supabase.auth.signInWithPassword({
      email: "owner@demo.com",
      password: "owner123",
    });

  if (authError) {
    console.error("❌ Login failed:", authError.message);
    return;
  }

  console.log("✅ Logged in as:", authData.user.email);
  console.log("User ID:", authData.user.id);

  // Get a work order to test
  const { data: orders, error: ordersError } = await supabase
    .from("work_orders")
    .select("*")
    .eq("refunded", false)
    .limit(1);

  if (ordersError || !orders || orders.length === 0) {
    console.error("❌ No work orders found or error:", ordersError?.message);
    return;
  }

  const testOrder = orders[0];
  console.log("\n📋 Testing refund for order:", testOrder.id);
  console.log("Order code:", testOrder.orderCode);
  console.log("Status:", testOrder.status);
  console.log("Branch ID:", testOrder.branchId || testOrder.branchid);
  console.log("Total Paid:", testOrder.totalPaid);
  console.log("Payment Method:", testOrder.paymentMethod);

  // Test refund
  console.log("\n🔄 Calling work_order_refund_atomic...");
  const { data, error } = await supabase.rpc("work_order_refund_atomic", {
    p_order_id: testOrder.id,
    p_refund_reason: "Test refund từ script",
    p_user_id: authData.user.id,
  });

  if (error) {
    console.error("❌ Refund failed:", error);
    console.error("Error details:", JSON.stringify(error, null, 2));
    return;
  }

  console.log("✅ Refund successful!");
  console.log("Result:", JSON.stringify(data, null, 2));
}

testRefund().catch(console.error);
