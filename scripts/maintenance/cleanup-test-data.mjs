import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  process.env.VITE_SUPABASE_URL || "https://ihcprvamakkvkxdwjthm.supabase.co";
const supabaseAnonKey =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImloY3BydmFtYWtrdmt4ZHdqdGhtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA2Mjk3NjEsImV4cCI6MjA0NjIwNTc2MX0.4cPOBwHCGmDLvHi6j8iXFw_jCmCQOcH6f0U0jyCkQZ0";

const supabase = createClient(supabaseUrl, supabaseAnonKey);

console.log("🗑️  ĐANG XÓA DỮ LIỆU TEST...\n");

async function cleanupTestData() {
  try {
    // 1. Xóa công nợ khách hàng
    console.log("1️⃣  Xóa công nợ khách hàng...");
    const { error: debtError } = await supabase
      .from("customer_debts")
      .delete()
      .neq("id", "");
    if (debtError) throw debtError;
    console.log("   ✅ Đã xóa customer_debts\n");

    // 2. Xóa công nợ nhà cung cấp
    console.log("2️⃣  Xóa công nợ nhà cung cấp...");
    const { error: supplierDebtError } = await supabase
      .from("supplier_debts")
      .delete()
      .neq("id", "");
    if (supplierDebtError) throw supplierDebtError;
    console.log("   ✅ Đã xóa supplier_debts\n");

    // 3. Xóa phiếu sửa chữa
    console.log("3️⃣  Xóa phiếu sửa chữa...");
    const { error: workOrderError } = await supabase
      .from("work_orders")
      .delete()
      .neq("id", "");
    if (workOrderError) throw workOrderError;
    console.log("   ✅ Đã xóa work_orders\n");

    // 4. Xóa giao dịch tiền mặt liên quan
    console.log("4️⃣  Xóa giao dịch tiền mặt (service)...");
    const { error: cashError } = await supabase
      .from("cash_transactions")
      .delete()
      .in("category", ["service_deposit", "service_income", "service_refund"]);
    if (cashError) throw cashError;
    console.log("   ✅ Đã xóa cash_transactions\n");

    // 5. Xóa giao dịch kho
    console.log("5️⃣  Xóa giao dịch kho (work_order)...");
    const { error: inventoryError } = await supabase
      .from("inventory_transactions")
      .delete()
      .eq("reference_type", "work_order");
    if (inventoryError) throw inventoryError;
    console.log("   ✅ Đã xóa inventory_transactions\n");

    // Verify kết quả
    console.log("\n📊 KIỂM TRA KẾT QUẢ:\n");

    const { count: debtCount } = await supabase
      .from("customer_debts")
      .select("*", { count: "exact", head: true });
    console.log(`   customer_debts: ${debtCount || 0} records`);

    const { count: supplierDebtCount } = await supabase
      .from("supplier_debts")
      .select("*", { count: "exact", head: true });
    console.log(`   supplier_debts: ${supplierDebtCount || 0} records`);

    const { count: workOrderCount } = await supabase
      .from("work_orders")
      .select("*", { count: "exact", head: true });
    console.log(`   work_orders: ${workOrderCount || 0} records`);

    const { count: cashCount } = await supabase
      .from("cash_transactions")
      .select("*", { count: "exact", head: true })
      .in("category", ["service_deposit", "service_income", "service_refund"]);
    console.log(`   cash_transactions (service): ${cashCount || 0} records`);

    const { count: inventoryCount } = await supabase
      .from("inventory_transactions")
      .select("*", { count: "exact", head: true })
      .eq("reference_type", "work_order");
    console.log(
      `   inventory_transactions (work_order): ${inventoryCount || 0} records`
    );

    console.log("\n✅ HOÀN TẤT! Dữ liệu đã được xóa sạch.\n");
    console.log("💡 Bây giờ bạn có thể:");
    console.log("   1. Reload trang (F5)");
    console.log("   2. Tạo phiếu sửa chữa mới");
    console.log("   3. Test flow từ đầu\n");
  } catch (error) {
    console.error("\n❌ LỖI:", error);
    process.exit(1);
  }
}

cleanupTestData();
