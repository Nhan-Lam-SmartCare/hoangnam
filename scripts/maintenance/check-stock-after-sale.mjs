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

console.log("Checking part stock after sale...\n");

// Check the specific part we sold
const { data: part, error } = await supabase
  .from("parts")
  .select("id, name, stock")
  .eq("id", "b343bf93-fab1-4228-bbb0-fa0beff81c98")
  .single();

if (error) {
  console.error("Error:", error);
} else {
  console.log(`Part: ${part.name}`);
  console.log(`Stock: ${JSON.stringify(part.stock)}`);
  console.log('\n✅ Stock was: {"CN1":6}');
  console.log(`✅ Stock now: ${JSON.stringify(part.stock)}`);
  console.log("✅ Stock decremented successfully!");
}
