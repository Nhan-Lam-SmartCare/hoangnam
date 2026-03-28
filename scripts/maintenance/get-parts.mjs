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

// Get some real parts
const { data: parts, error } = await supabase
  .from("parts")
  .select("id, name, stock")
  .limit(5);

if (error) {
  console.error("Error fetching parts:", error);
} else {
  console.log("\nAvailable parts:");
  parts.forEach((p) => {
    console.log(
      `- ID: ${p.id}, Name: ${p.name}, Stock: ${JSON.stringify(p.stock)}`
    );
  });
}
