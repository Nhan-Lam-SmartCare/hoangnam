import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function checkSupabaseChanges() {
  console.log("🔍 Kiểm tra các thay đổi trên Supabase...\n");

  const checks = [];

  // 1. Check sale_code column
  console.log("1️⃣ Checking sale_code column in sales table...");
  const { data: saleCodeCheck, error: saleCodeError } = await supabase
    .from("sales")
    .select("id, sale_code")
    .limit(1);

  checks.push({
    item: "Column: sales.sale_code",
    status: !saleCodeError ? "✅ Tồn tại" : "❌ Chưa có",
    file: "sql/2025-11-17_add_sale_code_to_sales.sql",
    data: !saleCodeError ? "OK" : saleCodeError.message,
  });

  // 2. Check additionalservices column
  console.log("2️⃣ Checking additionalservices column in work_orders...");
  const { data: addServCheck, error: addServError } = await supabase
    .from("work_orders")
    .select("id, additionalservices")
    .limit(1);

  checks.push({
    item: "Column: work_orders.additionalservices",
    status: !addServError ? "✅ Tồn tại" : "❌ Chưa có",
    file: "sql/2025-11-17_add_additional_services_column.sql",
    data: !addServError ? "OK" : addServError.message,
  });

  // 3. Test sale_create_atomic function
  console.log("3️⃣ Testing sale_create_atomic function...");
  const { error: saleCreateError } = await supabase.rpc("sale_create_atomic", {
    p_sale_id: "test-id",
    p_items: [],
    p_discount: 0,
    p_customer: {},
    p_payment_method: "cash",
    p_user_id: null,
    p_user_name: "test",
    p_branch_id: "test",
  });

  const saleCreateStatus =
    !saleCreateError ||
    saleCreateError.message.includes("EMPTY_ITEMS") ||
    saleCreateError.message.includes("empty")
      ? "✅ Callable"
      : saleCreateError.message.includes("does not exist")
      ? "❌ Không tồn tại"
      : "⚠️ Có lỗi";

  checks.push({
    item: "Function: sale_create_atomic",
    status: saleCreateStatus,
    file: "sql/2025-11-17_fix_sale_atomic_no_auth.sql",
    data: saleCreateError ? saleCreateError.message.substring(0, 80) : "OK",
  });

  // 4. Test sale_delete_atomic function
  console.log("4️⃣ Testing sale_delete_atomic function...");
  const { error: saleDeleteError } = await supabase.rpc("sale_delete_atomic", {
    p_sale_id: "test-id",
    p_user_id: null,
  });

  const saleDeleteStatus =
    !saleDeleteError || !saleDeleteError.message.includes("does not exist")
      ? "✅ Callable"
      : "❌ Không tồn tại";

  checks.push({
    item: "Function: sale_delete_atomic",
    status: saleDeleteStatus,
    file: "sql/2025-11-17_sale_delete_atomic.sql",
    data: saleDeleteError ? saleDeleteError.message.substring(0, 80) : "OK",
  });

  // 5. Test work_order_refund_atomic function
  console.log("5️⃣ Testing work_order_refund_atomic function...");
  const { error: refundError } = await supabase.rpc(
    "work_order_refund_atomic",
    {
      p_order_id: "test-id",
      p_refund_reason: "test",
      p_user_id: null,
    }
  );

  const refundStatus =
    !refundError || !refundError.message.includes("does not exist")
      ? "✅ Callable"
      : "❌ Không tồn tại";

  checks.push({
    item: "Function: work_order_refund_atomic",
    status: refundStatus,
    file: "sql/2025-11-17_fix_work_order_refund_no_auth.sql",
    data: refundError ? refundError.message.substring(0, 80) : "OK",
  });

  // Print results
  console.log("\n📊 KẾT QUẢ KIỂM TRA:\n");
  console.table(checks);

  // Summary
  const missing = checks.filter((c) => c.status.includes("❌"));
  const warnings = checks.filter((c) => c.status.includes("⚠️"));

  console.log("\n📝 TỔNG KẾT:");
  console.log(
    `✅ Hoàn thành: ${checks.filter((c) => c.status.includes("✅")).length}/${
      checks.length
    }`
  );

  if (missing.length > 0) {
    console.log(`\n❌ CẦN CHẠY CÁC FILE SQL SAU:`);
    missing.forEach((m) => console.log(`   - ${m.file}`));
  }

  if (warnings.length > 0) {
    console.log(`\n⚠️ CẦN KIỂM TRA:`);
    warnings.forEach((w) => console.log(`   - ${w.item}: ${w.data}`));
  }

  if (missing.length === 0 && warnings.length === 0) {
    console.log("\n🎉 TẤT CẢ THAY ĐỔI ĐÃ ĐƯỢC APPLY!");
  }
}

checkSupabaseChanges();
