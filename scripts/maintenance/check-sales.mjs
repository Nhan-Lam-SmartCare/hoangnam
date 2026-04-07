import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// Login
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
console.log("Checking sales...\n");

// Get all sales
const {
  data: sales,
  error,
  count,
} = await supabase
  .from("sales")
  .select("*", { count: "exact" })
  .order("date", { ascending: false })
  .limit(10);

if (error) {
  console.error("Error fetching sales:", error);
} else {
  console.log(`Total sales count: ${count}`);
  console.log(`\nRecent sales (limit 10):`);
  if (sales && sales.length > 0) {
    sales.forEach((sale, idx) => {
      console.log(`\n${idx + 1}. ID: ${sale.id}`);
      console.log(`   Date: ${sale.date}`);
      console.log(`   Total: ${sale.total}`);
      console.log(`   Branch: ${sale.branchid}`);
      console.log(`   Items: ${sale.items?.length || 0}`);
    });
  } else {
    console.log("No sales found");
  }
}
