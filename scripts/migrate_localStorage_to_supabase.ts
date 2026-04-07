/**
 * Script di chuyển dữ liệu từ localStorage sang Supabase
 *
 * Cách chạy:
 * 1. Mở browser console trên trang web đang chạy (http://localhost:5173)
 * 2. Copy toàn bộ code này vào console và nhấn Enter
 * 3. Chờ script hoàn thành
 *
 * Hoặc tạo một component tạm thời để chạy migration
 */

// ============================================
// CHẠY TRONG BROWSER CONSOLE (copy từ đây)
// ============================================

(async function migrateLocalStorageToSupabase() {
  const SUPABASE_URL =
    (window as any).__SUPABASE_URL__ || import.meta?.env?.VITE_SUPABASE_URL;
  const SUPABASE_ANON_KEY =
    (window as any).__SUPABASE_ANON_KEY__ ||
    import.meta?.env?.VITE_SUPABASE_ANON_KEY;

  // Get supabase client from window if available (from React app)
  const supabase =
    (window as any).supabase ||
    (await import("../src/supabaseClient")).supabase;

  console.log("🚀 Bắt đầu di chuyển dữ liệu từ localStorage sang Supabase...");

  // Load localStorage data
  const stored = localStorage.getItem("motocare-data");
  if (!stored) {
    console.error(
      "❌ Không tìm thấy dữ liệu trong localStorage (key: motocare-data)"
    );
    return;
  }

  let data: any;
  try {
    data = JSON.parse(stored);
  } catch (e) {
    console.error("❌ Không thể parse dữ liệu localStorage:", e);
    return;
  }

  console.log("📦 Dữ liệu localStorage:", {
    parts: data.parts?.length || 0,
    customers: data.customers?.length || 0,
    sales: data.sales?.length || 0,
    paymentSources: data.paymentSources?.length || 0,
    suppliers: data.suppliers?.length || 0,
    inventoryTransactions: data.inventoryTransactions?.length || 0,
    payrollRecords: data.payrollRecords?.length || 0,
  });

  const results = {
    customers: { success: 0, failed: 0, skipped: 0 },
    parts: { success: 0, failed: 0, skipped: 0 },
    sales: { success: 0, failed: 0, skipped: 0 },
    paymentSources: { success: 0, failed: 0, skipped: 0 },
    suppliers: { success: 0, failed: 0, skipped: 0 },
    inventoryTransactions: { success: 0, failed: 0, skipped: 0 },
  };

  // 1. MIGRATE CUSTOMERS
  console.log("\n📋 1. Di chuyển KHÁCH HÀNG...");
  if (data.customers?.length > 0) {
    for (const customer of data.customers) {
      try {
        // Check if exists
        const { data: existing } = await supabase
          .from("customers")
          .select("id")
          .eq("id", customer.id)
          .single();

        if (existing) {
          results.customers.skipped++;
          continue;
        }

        const payload = {
          id: customer.id,
          name: customer.name,
          phone: customer.phone || null,
          created_at: customer.created_at || new Date().toISOString(),
        };

        const { error } = await supabase.from("customers").insert([payload]);
        if (error) {
          console.error(`  ❌ Customer ${customer.id}:`, error.message);
          results.customers.failed++;
        } else {
          results.customers.success++;
        }
      } catch (e: any) {
        console.error(`  ❌ Customer ${customer.id}:`, e.message);
        results.customers.failed++;
      }
    }
    console.log(
      `  ✅ Customers: ${results.customers.success} thành công, ${results.customers.skipped} bỏ qua, ${results.customers.failed} lỗi`
    );
  }

  // 2. MIGRATE SUPPLIERS
  console.log("\n📋 2. Di chuyển NHÀ CUNG CẤP...");
  if (data.suppliers?.length > 0) {
    for (const supplier of data.suppliers) {
      try {
        const { data: existing } = await supabase
          .from("suppliers")
          .select("id")
          .eq("id", supplier.id)
          .single();

        if (existing) {
          results.suppliers.skipped++;
          continue;
        }

        const payload = {
          id: supplier.id,
          name: supplier.name,
          phone: supplier.phone || null,
          email: supplier.email || null,
          address: supplier.address || null,
          created_at: supplier.created_at || new Date().toISOString(),
        };

        const { error } = await supabase.from("suppliers").insert([payload]);
        if (error) {
          console.error(`  ❌ Supplier ${supplier.id}:`, error.message);
          results.suppliers.failed++;
        } else {
          results.suppliers.success++;
        }
      } catch (e: any) {
        console.error(`  ❌ Supplier ${supplier.id}:`, e.message);
        results.suppliers.failed++;
      }
    }
    console.log(
      `  ✅ Suppliers: ${results.suppliers.success} thành công, ${results.suppliers.skipped} bỏ qua, ${results.suppliers.failed} lỗi`
    );
  }

  // 3. MIGRATE PAYMENT SOURCES
  console.log("\n📋 3. Di chuyển NGUỒN TIỀN...");
  if (data.paymentSources?.length > 0) {
    for (const ps of data.paymentSources) {
      try {
        const { data: existing } = await supabase
          .from("payment_sources")
          .select("id")
          .eq("id", ps.id)
          .single();

        if (existing) {
          results.paymentSources.skipped++;
          continue;
        }

        const payload = {
          id: ps.id,
          name: ps.name,
          balance: ps.balance || {},
          created_at: new Date().toISOString(),
        };

        const { error } = await supabase
          .from("payment_sources")
          .insert([payload]);
        if (error) {
          console.error(`  ❌ PaymentSource ${ps.id}:`, error.message);
          results.paymentSources.failed++;
        } else {
          results.paymentSources.success++;
        }
      } catch (e: any) {
        console.error(`  ❌ PaymentSource ${ps.id}:`, e.message);
        results.paymentSources.failed++;
      }
    }
    console.log(
      `  ✅ PaymentSources: ${results.paymentSources.success} thành công, ${results.paymentSources.skipped} bỏ qua, ${results.paymentSources.failed} lỗi`
    );
  }

  // 4. MIGRATE PARTS (Phụ tùng)
  console.log("\n📋 4. Di chuyển PHỤ TÙNG...");
  if (data.parts?.length > 0) {
    for (const part of data.parts) {
      try {
        // Check by id or sku
        const { data: existing } = await supabase
          .from("parts")
          .select("id")
          .or(`id.eq.${part.id},sku.eq.${part.sku}`)
          .single();

        if (existing) {
          results.parts.skipped++;
          continue;
        }

        const payload = {
          id: part.id,
          name: part.name,
          sku: part.sku,
          stock: part.stock || {},
          retailprice: part.retailPrice || {}, // lowercase for DB
          wholesaleprice: part.wholesalePrice || {},
          category: part.category || null,
          description: part.description || null,
          warrantyperiod: part.warrantyPeriod || null,
          costprice: part.costPrice || {},
          created_at: part.created_at || new Date().toISOString(),
        };

        const { error } = await supabase.from("parts").insert([payload]);
        if (error) {
          console.error(`  ❌ Part ${part.id} (${part.sku}):`, error.message);
          results.parts.failed++;
        } else {
          results.parts.success++;
        }
      } catch (e: any) {
        console.error(`  ❌ Part ${part.id}:`, e.message);
        results.parts.failed++;
      }
    }
    console.log(
      `  ✅ Parts: ${results.parts.success} thành công, ${results.parts.skipped} bỏ qua, ${results.parts.failed} lỗi`
    );
  }

  // 5. MIGRATE SALES (Đơn bán hàng)
  console.log("\n📋 5. Di chuyển ĐƠN BÁN HÀNG...");
  if (data.sales?.length > 0) {
    for (const sale of data.sales) {
      try {
        const { data: existing } = await supabase
          .from("sales")
          .select("id")
          .eq("id", sale.id)
          .single();

        if (existing) {
          results.sales.skipped++;
          continue;
        }

        const payload = {
          id: sale.id,
          date: sale.date || new Date().toISOString(),
          items: sale.items || [],
          subtotal: sale.subtotal || 0,
          discount: sale.discount || 0,
          total: sale.total || 0,
          customer: sale.customer || { name: "Khách lẻ" },
          paymentmethod: sale.paymentMethod || "cash", // lowercase for DB
          userid: sale.userId || "migrated",
          username: sale.userName || "Migrated User",
          branchid: sale.branchId || "CN1",
          cashtransactionid: sale.cashTransactionId || null,
          created_at: sale.created_at || sale.date || new Date().toISOString(),
        };

        const { error } = await supabase.from("sales").insert([payload]);
        if (error) {
          console.error(`  ❌ Sale ${sale.id}:`, error.message);
          results.sales.failed++;
        } else {
          results.sales.success++;
        }
      } catch (e: any) {
        console.error(`  ❌ Sale ${sale.id}:`, e.message);
        results.sales.failed++;
      }
    }
    console.log(
      `  ✅ Sales: ${results.sales.success} thành công, ${results.sales.skipped} bỏ qua, ${results.sales.failed} lỗi`
    );
  }

  // 6. MIGRATE INVENTORY TRANSACTIONS
  console.log("\n📋 6. Di chuyển GIAO DỊCH KHO...");
  if (data.inventoryTransactions?.length > 0) {
    for (const tx of data.inventoryTransactions) {
      try {
        const { data: existing } = await supabase
          .from("inventory_transactions")
          .select("id")
          .eq("id", tx.id)
          .single();

        if (existing) {
          results.inventoryTransactions.skipped++;
          continue;
        }

        const payload = {
          id: tx.id,
          type: tx.type,
          partid: tx.partId,
          partname: tx.partName,
          quantity: tx.quantity || 0,
          date: tx.date || new Date().toISOString(),
          unitprice: tx.unitPrice || 0,
          totalprice: tx.totalPrice || 0,
          branchid: tx.branchId || "CN1",
          notes: tx.notes || null,
          saleid: tx.saleId || null,
          workorderid: tx.workOrderId || null,
          supplierid: tx.supplierId || null,
          created_at: tx.created_at || tx.date || new Date().toISOString(),
        };

        const { error } = await supabase
          .from("inventory_transactions")
          .insert([payload]);
        if (error) {
          console.error(`  ❌ InventoryTx ${tx.id}:`, error.message);
          results.inventoryTransactions.failed++;
        } else {
          results.inventoryTransactions.success++;
        }
      } catch (e: any) {
        console.error(`  ❌ InventoryTx ${tx.id}:`, e.message);
        results.inventoryTransactions.failed++;
      }
    }
    console.log(
      `  ✅ InventoryTx: ${results.inventoryTransactions.success} thành công, ${results.inventoryTransactions.skipped} bỏ qua, ${results.inventoryTransactions.failed} lỗi`
    );
  }

  // Summary
  console.log("\n" + "=".repeat(50));
  console.log("📊 TÓM TẮT KẾT QUẢ DI CHUYỂN:");
  console.log("=".repeat(50));
  console.table(results);
  console.log("\n✅ HOÀN TẤT DI CHUYỂN!");
  console.log("💡 Refresh trang web để xem dữ liệu mới từ Supabase.");

  return results;
})();
