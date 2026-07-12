// Verify bao mat: dung ANON key (client CHUA dang nhap) thu doc cac bang/view
// nhay cam. Ky vong sau khi va: anon BI CHAN (loi 401/permission denied) hoac
// tra ve 0 dong. Truoc khi va: anon doc duoc du lieu that.
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

console.log("Project:", (url || "").replace("https://", "").split(".")[0]);
console.log("Dung ANON key (mo phong ke tan cong chua dang nhap)\n");

const anon = createClient(url, anonKey);

const targets = [
  "cash_transactions",
  "payment_sources",
  "inventory_transactions",
  "payroll_records",
  "sales",
  "work_orders",
  "customers",
  "suppliers",
  "categories",
  "notifications",
  "repair_templates",
  "audit_logs",
  "services",
  "repair_order_services",
  "cash_transactions_ledger", // view
  "inventory_balances_view", // view
];

let openCount = 0;
for (const t of targets) {
  const { data, error } = await anon.from(t).select("*").limit(1);
  if (error) {
    // Bi chan = TOT
    console.log(`  ✅ ${t.padEnd(28)} BLOCKED  (${error.code || ""} ${error.message})`);
  } else if (!data || data.length === 0) {
    // Doc duoc nhung rong: co the RLS chan het dong (an toan) hoac bang rong
    console.log(`  ⚠️  ${t.padEnd(28)} readable but 0 rows (RLS loc het? / bang rong)`);
  } else {
    // Doc duoc DU LIEU = HO
    openCount++;
    console.log(`  🔴 ${t.padEnd(28)} EXPOSED  (doc duoc ${data.length} dong!)`);
  }
}

console.log(
  `\nKet luan: ${openCount === 0 ? "✅ Khong bang/view nao lo du lieu cho anon." : "🔴 CON " + openCount + " doi tuong lo du lieu!"}`
);
