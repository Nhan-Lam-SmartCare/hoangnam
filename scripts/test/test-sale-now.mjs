import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Login with real account
console.log("Logging in...");
const {
  data: { user },
  error: loginError,
} = await supabase.auth.signInWithPassword({
  email: "nhanxn@gmail.com",
  password: "Xn#232425",
});

if (loginError) {
  console.error("Login failed:", loginError.message);
  process.exit(1);
}

console.log("Logged in as:", user.email);
console.log("User ID:", user.id);

// Test sale creation
console.log("\nTesting sale_create_atomic...");

const testSaleId = `test-sale-${Date.now()}`;
const testItems = [
  {
    partId: "b343bf93-fab1-4228-bbb0-fa0beff81c98",
    partName: "BO THANG TRUOC SAU WAVE ALPHA DUM",
    quantity: 1,
    sellingPrice: 50000,
  },
];

const { data, error } = await supabase.rpc("sale_create_atomic", {
  p_sale_id: testSaleId,
  p_items: testItems,
  p_discount: 0,
  p_customer: { name: "Test Customer", phone: "0123456789" },
  p_payment_method: "cash",
  p_user_id: user.id,
  p_user_name: user.email,
  p_branch_id: "CN1",
});

if (error) {
  console.error("Sale creation error:", error);
  console.error("Error code:", error.code);
  console.error("Error details:", error.details);
  console.error("Error hint:", error.hint);
} else {
  console.log("✅ Sale created successfully!");
  console.log("Result:", JSON.stringify(data, null, 2));
}
