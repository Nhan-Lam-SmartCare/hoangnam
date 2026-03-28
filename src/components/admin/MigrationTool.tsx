import React, { useState } from "react";
import { supabase } from "../../supabaseClient";

interface MigrationResults {
  customers: { success: number; failed: number; skipped: number };
  parts: { success: number; failed: number; skipped: number };
  sales: { success: number; failed: number; skipped: number };
  paymentSources: { success: number; failed: number; skipped: number };
  suppliers: { success: number; failed: number; skipped: number };
  inventoryTransactions: { success: number; failed: number; skipped: number };
}

interface SupabaseCounts {
  customers: number;
  parts: number;
  sales: number;
  paymentSources: number;
  suppliers: number;
  inventoryTransactions: number;
  cashTransactions: number;
  workOrders: number;
}

export const MigrationTool: React.FC = () => {
  const [isRunning, setIsRunning] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [results, setResults] = useState<MigrationResults | null>(null);
  const [localData, setLocalData] = useState<any>(null);
  const [supabaseCounts, setSupabaseCounts] = useState<SupabaseCounts | null>(
    null
  );

  const addLog = (msg: string) => {
    setLogs((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
  };

  const loadLocalData = () => {
    const stored = localStorage.getItem("motocare-data");
    if (!stored) {
      addLog("❌ Không tìm thấy dữ liệu trong localStorage");
      return null;
    }
    try {
      const data = JSON.parse(stored);
      setLocalData(data);
      addLog(`📦 Tìm thấy dữ liệu localStorage:`);
      addLog(`   - Parts: ${data.parts?.length || 0}`);
      addLog(`   - Customers: ${data.customers?.length || 0}`);
      addLog(`   - Sales: ${data.sales?.length || 0}`);
      addLog(`   - Suppliers: ${data.suppliers?.length || 0}`);
      addLog(`   - PaymentSources: ${data.paymentSources?.length || 0}`);
      addLog(
        `   - InventoryTransactions: ${data.inventoryTransactions?.length || 0}`
      );
      return data;
    } catch (e) {
      addLog("❌ Lỗi parse dữ liệu localStorage");
      return null;
    }
  };

  const runMigration = async () => {
    setIsRunning(true);
    setLogs([]);
    setResults(null);

    const data = loadLocalData();
    if (!data) {
      setIsRunning(false);
      return;
    }

    const res: MigrationResults = {
      customers: { success: 0, failed: 0, skipped: 0 },
      parts: { success: 0, failed: 0, skipped: 0 },
      sales: { success: 0, failed: 0, skipped: 0 },
      paymentSources: { success: 0, failed: 0, skipped: 0 },
      suppliers: { success: 0, failed: 0, skipped: 0 },
      inventoryTransactions: { success: 0, failed: 0, skipped: 0 },
    };

    // 1. CUSTOMERS
    addLog("\n📋 1. Di chuyển KHÁCH HÀNG...");
    if (data.customers?.length > 0) {
      for (const customer of data.customers) {
        try {
          const { data: existing } = await supabase
            .from("customers")
            .select("id")
            .eq("id", customer.id)
            .maybeSingle();

          if (existing) {
            res.customers.skipped++;
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
            addLog(`  ❌ Customer ${customer.name}: ${error.message}`);
            res.customers.failed++;
          } else {
            res.customers.success++;
          }
        } catch (e: any) {
          res.customers.failed++;
        }
      }
      addLog(
        `  ✅ Customers: ${res.customers.success} OK, ${res.customers.skipped} skip, ${res.customers.failed} fail`
      );
    }

    // 2. SUPPLIERS
    addLog("\n📋 2. Di chuyển NHÀ CUNG CẤP...");
    if (data.suppliers?.length > 0) {
      for (const supplier of data.suppliers) {
        try {
          const { data: existing } = await supabase
            .from("suppliers")
            .select("id")
            .eq("id", supplier.id)
            .maybeSingle();

          if (existing) {
            res.suppliers.skipped++;
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
            addLog(`  ❌ Supplier ${supplier.name}: ${error.message}`);
            res.suppliers.failed++;
          } else {
            res.suppliers.success++;
          }
        } catch (e: any) {
          res.suppliers.failed++;
        }
      }
      addLog(
        `  ✅ Suppliers: ${res.suppliers.success} OK, ${res.suppliers.skipped} skip, ${res.suppliers.failed} fail`
      );
    }

    // 3. PAYMENT SOURCES
    addLog("\n📋 3. Di chuyển NGUỒN TIỀN...");
    if (data.paymentSources?.length > 0) {
      for (const ps of data.paymentSources) {
        try {
          const { data: existing } = await supabase
            .from("payment_sources")
            .select("id")
            .eq("id", ps.id)
            .maybeSingle();

          if (existing) {
            res.paymentSources.skipped++;
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
            addLog(`  ❌ PaymentSource ${ps.name}: ${error.message}`);
            res.paymentSources.failed++;
          } else {
            res.paymentSources.success++;
          }
        } catch (e: any) {
          res.paymentSources.failed++;
        }
      }
      addLog(
        `  ✅ PaymentSources: ${res.paymentSources.success} OK, ${res.paymentSources.skipped} skip, ${res.paymentSources.failed} fail`
      );
    }

    // 4. PARTS
    addLog("\n📋 4. Di chuyển PHỤ TÙNG...");
    if (data.parts?.length > 0) {
      for (const part of data.parts) {
        try {
          const { data: existing } = await supabase
            .from("parts")
            .select("id")
            .eq("id", part.id)
            .maybeSingle();

          if (existing) {
            res.parts.skipped++;
            continue;
          }

          // Also check by SKU
          const { data: existingSku } = await supabase
            .from("parts")
            .select("id")
            .eq("sku", part.sku)
            .maybeSingle();

          if (existingSku) {
            res.parts.skipped++;
            continue;
          }

          const payload = {
            id: part.id,
            name: part.name,
            sku: part.sku,
            stock: part.stock || {},
            retailprice: part.retailPrice || {},
            wholesaleprice: part.wholesalePrice || {},
            category: part.category || null,
            description: part.description || null,
            warrantyperiod: part.warrantyPeriod || null,
            costprice: part.costPrice || {},
            created_at: part.created_at || new Date().toISOString(),
          };

          const { error } = await supabase.from("parts").insert([payload]);
          if (error) {
            addLog(`  ❌ Part ${part.name} (${part.sku}): ${error.message}`);
            res.parts.failed++;
          } else {
            res.parts.success++;
          }
        } catch (e: any) {
          res.parts.failed++;
        }
      }
      addLog(
        `  ✅ Parts: ${res.parts.success} OK, ${res.parts.skipped} skip, ${res.parts.failed} fail`
      );
    }

    // 5. SALES
    addLog("\n📋 5. Di chuyển ĐƠN BÁN HÀNG...");
    if (data.sales?.length > 0) {
      for (const sale of data.sales) {
        try {
          const { data: existing } = await supabase
            .from("sales")
            .select("id")
            .eq("id", sale.id)
            .maybeSingle();

          if (existing) {
            res.sales.skipped++;
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
            paymentmethod: sale.paymentMethod || "cash",
            userid: sale.userId || "migrated",
            username: sale.userName || "Migrated User",
            branchid: sale.branchId || "CN1",
            cashtransactionid: sale.cashTransactionId || null,
            created_at:
              sale.created_at || sale.date || new Date().toISOString(),
          };

          const { error } = await supabase.from("sales").insert([payload]);
          if (error) {
            addLog(`  ❌ Sale ${sale.id}: ${error.message}`);
            res.sales.failed++;
          } else {
            res.sales.success++;
          }
        } catch (e: any) {
          res.sales.failed++;
        }
      }
      addLog(
        `  ✅ Sales: ${res.sales.success} OK, ${res.sales.skipped} skip, ${res.sales.failed} fail`
      );
    }

    // 6. INVENTORY TRANSACTIONS
    addLog("\n📋 6. Di chuyển GIAO DỊCH KHO...");
    if (data.inventoryTransactions?.length > 0) {
      for (const tx of data.inventoryTransactions) {
        try {
          const { data: existing } = await supabase
            .from("inventory_transactions")
            .select("id")
            .eq("id", tx.id)
            .maybeSingle();

          if (existing) {
            res.inventoryTransactions.skipped++;
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
            addLog(`  ❌ InventoryTx ${tx.id}: ${error.message}`);
            res.inventoryTransactions.failed++;
          } else {
            res.inventoryTransactions.success++;
          }
        } catch (e: any) {
          res.inventoryTransactions.failed++;
        }
      }
      addLog(
        `  ✅ InventoryTx: ${res.inventoryTransactions.success} OK, ${res.inventoryTransactions.skipped} skip, ${res.inventoryTransactions.failed} fail`
      );
    }

    setResults(res);
    addLog("\n✅ HOÀN TẤT DI CHUYỂN!");
    addLog("💡 Refresh trang web để xem dữ liệu mới từ Supabase.");
    setIsRunning(false);

    // Auto check Supabase after migration
    await checkSupabaseData();
  };

  // Check Supabase data counts
  const checkSupabaseData = async () => {
    addLog("\n🔍 Kiểm tra dữ liệu trong Supabase...");
    try {
      const counts: SupabaseCounts = {
        customers: 0,
        parts: 0,
        sales: 0,
        paymentSources: 0,
        suppliers: 0,
        inventoryTransactions: 0,
        cashTransactions: 0,
        workOrders: 0,
      };

      const { count: custCount } = await supabase
        .from("customers")
        .select("*", { count: "exact", head: true });
      counts.customers = custCount || 0;

      const { count: partsCount } = await supabase
        .from("parts")
        .select("*", { count: "exact", head: true });
      counts.parts = partsCount || 0;

      const { count: salesCount } = await supabase
        .from("sales")
        .select("*", { count: "exact", head: true });
      counts.sales = salesCount || 0;

      const { count: psCount } = await supabase
        .from("payment_sources")
        .select("*", { count: "exact", head: true });
      counts.paymentSources = psCount || 0;

      const { count: suppCount } = await supabase
        .from("suppliers")
        .select("*", { count: "exact", head: true });
      counts.suppliers = suppCount || 0;

      const { count: invTxCount } = await supabase
        .from("inventory_transactions")
        .select("*", { count: "exact", head: true });
      counts.inventoryTransactions = invTxCount || 0;

      const { count: cashTxCount } = await supabase
        .from("cash_transactions")
        .select("*", { count: "exact", head: true });
      counts.cashTransactions = cashTxCount || 0;

      const { count: woCount } = await supabase
        .from("work_orders")
        .select("*", { count: "exact", head: true });
      counts.workOrders = woCount || 0;

      setSupabaseCounts(counts);

      addLog(`\n📊 DỮ LIỆU TRONG SUPABASE:`);
      addLog(`   - Customers: ${counts.customers}`);
      addLog(`   - Parts: ${counts.parts}`);
      addLog(`   - Sales: ${counts.sales}`);
      addLog(`   - Payment Sources: ${counts.paymentSources}`);
      addLog(`   - Suppliers: ${counts.suppliers}`);
      addLog(`   - Inventory Transactions: ${counts.inventoryTransactions}`);
      addLog(`   - Cash Transactions: ${counts.cashTransactions}`);
      addLog(`   - Work Orders: ${counts.workOrders}`);

      // Show recent sales
      if (counts.sales > 0) {
        const { data: recentSales } = await supabase
          .from("sales")
          .select("id, date, total, branchid")
          .order("date", { ascending: false })
          .limit(3);

        if (recentSales?.length) {
          addLog(`\n📋 3 đơn bán hàng gần nhất:`);
          recentSales.forEach((s, i) => {
            addLog(
              `   ${i + 1}. ${s.date?.slice(
                0,
                10
              )} - ${s.total?.toLocaleString()}đ (${s.branchid})`
            );
          });
        }
      }
    } catch (e: any) {
      addLog(`❌ Lỗi kiểm tra Supabase: ${e.message}`);
    }
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">
        🔄 Di chuyển dữ liệu localStorage → Supabase
      </h1>

      <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded">
        <p className="text-yellow-800">
          ⚠️ <strong>Lưu ý:</strong> Script này sẽ di chuyển dữ liệu từ
          localStorage sang Supabase. Các bản ghi đã tồn tại sẽ được bỏ qua
          (không ghi đè).
        </p>
      </div>

      <div className="flex flex-wrap gap-4 mb-4">
        <button
          onClick={loadLocalData}
          disabled={isRunning}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
        >
          📦 Xem dữ liệu localStorage
        </button>
        <button
          onClick={checkSupabaseData}
          disabled={isRunning}
          className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 disabled:opacity-50"
        >
          🔍 Kiểm tra Supabase
        </button>
        <button
          onClick={runMigration}
          disabled={isRunning}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 disabled:opacity-50"
        >
          {isRunning ? "⏳ Đang di chuyển..." : "🚀 Bắt đầu di chuyển"}
        </button>
      </div>

      {supabaseCounts && (
        <div className="mb-4 p-4 bg-purple-50 border border-purple-200 rounded">
          <h3 className="font-bold mb-2">🗄️ Dữ liệu trong Supabase:</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>
              Customers: <strong>{supabaseCounts.customers}</strong>
            </div>
            <div>
              Parts: <strong>{supabaseCounts.parts}</strong>
            </div>
            <div>
              Sales: <strong>{supabaseCounts.sales}</strong>
            </div>
            <div>
              Work Orders: <strong>{supabaseCounts.workOrders}</strong>
            </div>
            <div>
              Cash Transactions:{" "}
              <strong>{supabaseCounts.cashTransactions}</strong>
            </div>
            <div>
              Payment Sources: <strong>{supabaseCounts.paymentSources}</strong>
            </div>
            <div>
              Suppliers: <strong>{supabaseCounts.suppliers}</strong>
            </div>
            <div>
              Inventory Tx:{" "}
              <strong>{supabaseCounts.inventoryTransactions}</strong>
            </div>
          </div>
        </div>
      )}

      {results && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded">
          <h3 className="font-bold mb-2">📊 Kết quả Migration:</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-1">Bảng</th>
                <th className="text-center py-1">✅ Thành công</th>
                <th className="text-center py-1">⏭️ Bỏ qua</th>
                <th className="text-center py-1">❌ Lỗi</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(results).map(([key, val]) => (
                <tr key={key} className="border-b">
                  <td className="py-1">{key}</td>
                  <td className="text-center py-1 text-green-600">
                    {val.success}
                  </td>
                  <td className="text-center py-1 text-gray-500">
                    {val.skipped}
                  </td>
                  <td className="text-center py-1 text-red-600">
                    {val.failed}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bg-gray-900 text-green-400 p-4 rounded font-mono text-sm h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <p className="text-gray-500">Nhấn nút để bắt đầu...</p>
        ) : (
          logs.map((log, i) => (
            <div key={i} className="whitespace-pre-wrap">
              {log}
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default MigrationTool;
