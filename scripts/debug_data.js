/**
 * Debug script - Chạy trong browser console để kiểm tra dữ liệu
 *
 * Mở browser console (F12) tại http://localhost:4310 hoặc 4311
 * Copy và paste đoạn code này
 */

// Check localStorage data
const localData = JSON.parse(localStorage.getItem("motocare-data") || "{}");
console.log("=== LOCAL STORAGE DATA ===");
console.log("Sales:", localData.sales?.length || 0);
console.log("Parts:", localData.parts?.length || 0);
console.log("Customers:", localData.customers?.length || 0);

if (localData.sales?.length > 0) {
  console.log("\n📋 Sample Sales from localStorage:");
  localData.sales.slice(0, 3).forEach((s, i) => {
    console.log(`  ${i + 1}. ID: ${s.id}, Date: ${s.date}, Total: ${s.total}`);
  });
}

// Check Supabase data (if supabase client is available)
(async () => {
  try {
    // Get supabase from window or import
    const { supabase } = await import("./src/supabaseClient");

    console.log("\n=== SUPABASE DATA ===");

    // Sales
    const { data: sales, error: salesErr } = await supabase
      .from("sales")
      .select("id, date, total, branchid")
      .order("date", { ascending: false })
      .limit(5);

    if (salesErr) {
      console.error("Sales error:", salesErr);
    } else {
      console.log("Sales in Supabase:", sales?.length || 0);
      if (sales?.length > 0) {
        console.log("📋 Recent Sales:");
        sales.forEach((s, i) => {
          console.log(
            `  ${i + 1}. ID: ${s.id}, Date: ${s.date}, Total: ${
              s.total
            }, Branch: ${s.branchid}`
          );
        });
      }
    }

    // Parts
    const { count: partsCount } = await supabase
      .from("parts")
      .select("*", { count: "exact", head: true });
    console.log("Parts in Supabase:", partsCount || 0);

    // Customers
    const { count: custCount } = await supabase
      .from("customers")
      .select("*", { count: "exact", head: true });
    console.log("Customers in Supabase:", custCount || 0);
  } catch (e) {
    console.error("Error checking Supabase:", e);
  }
})();
