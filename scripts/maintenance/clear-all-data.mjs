import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log("\n🗑️  BẮT ĐẦU XÓA TOÀN BỘ DỮ LIỆU TEST...\n");

try {
  // 0. Xóa customer_debts
  console.log("0️⃣  Đang xóa customer_debts...");
  const { error: e0 } = await supabase
    .from("customer_debts")
    .delete()
    .neq("id", "00000000");
  if (e0) throw e0;
  console.log("   ✅ Đã xóa customer_debts");

  // 1. Xóa cash_transactions
  console.log("1️⃣  Đang xóa cash_transactions...");
  const { error: e1 } = await supabase
    .from("cash_transactions")
    .delete()
    .neq("id", "00000000");
  if (e1) throw e1;
  console.log("   ✅ Đã xóa cash_transactions");

  // 2. Xóa sales
  console.log("2️⃣  Đang xóa sales...");
  const { error: e2 } = await supabase
    .from("sales")
    .delete()
    .neq("id", "00000000");
  if (e2) throw e2;
  console.log("   ✅ Đã xóa sales");

  // 3. Xóa work_orders
  console.log("3️⃣  Đang xóa work_orders...");
  const { error: e3 } = await supabase
    .from("work_orders")
    .delete()
    .neq("id", "00000000");
  if (e3) throw e3;
  console.log("   ✅ Đã xóa work_orders");

  // 4. Xóa customers
  console.log("4️⃣  Đang xóa customers...");
  const { error: e4 } = await supabase
    .from("customers")
    .delete()
    .neq("id", "00000000");
  if (e4) throw e4;
  console.log("   ✅ Đã xóa customers");

  // 5. Xóa suppliers
  console.log("🟣  Đang xóa suppliers...");
  const { error: eSup } = await supabase
    .from("suppliers")
    .delete()
    .neq("id", "00000000");
  if (eSup) throw eSup;
  console.log("   ✅ Đã xóa suppliers");

  // Kiểm tra kết quả
  console.log("\n📊 KIỂM TRA KẾT QUẢ:\n");

  const tables = [
    "customer_debts",
    "customers",
    "work_orders",
    "sales",
    "cash_transactions",
    "suppliers",
  ];

  for (const table of tables) {
    const { count } = await supabase
      .from(table)
      .select("*", { count: "exact", head: true });
    console.log(`   ${table}: ${count} records`);
  }

  console.log("\n✅ ĐÃ XÓA TOÀN BỘ DỮ LIỆU TEST - SẴN SÀNG BẮT ĐẦU LẠI!\n");
} catch (error) {
  console.error("\n❌ LỖI:", error.message);
  process.exit(1);
}
