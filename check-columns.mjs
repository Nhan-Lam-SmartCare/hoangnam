import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Test with correct column names
try {
  const { error } = await supabase.from("cash_transactions").insert({
    id: "test-123",
    category: "test",
    amount: 100,
    date: new Date().toISOString(),
    description: "test",
    branchid: "test", // lowercase!
    paymentsource: "test", // lowercase!
    reference: "test",
  });

  if (error) {
    console.log("Insert error:", error.message);
  } else {
    console.log("Insert successful with lowercase columns");

    // Cleanup
    await supabase.from("cash_transactions").delete().eq("id", "test-123");
  }
} catch (e) {
  console.log("Exception:", e);
}
