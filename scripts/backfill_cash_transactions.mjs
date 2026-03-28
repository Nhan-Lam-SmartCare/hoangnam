/**
 * Script: Backfill cash_transactions from work_orders
 * Tạo các giao dịch thu chi từ phiếu sửa chữa đã thanh toán trước đây
 *
 * Chạy: node scripts/backfill_cash_transactions.mjs
 */

import { createClient } from "@supabase/supabase-js";

// Lấy từ env hoặc hardcode (CHỈ DÙNG CHO DEV)
const SUPABASE_URL =
  process.env.VITE_SUPABASE_URL || "https://uluxycppxlzdskyklgqt.supabase.co";
const SUPABASE_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVsdXh5Y3BweGx6ZHNreWtsZ3F0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI1MDU5MzIsImV4cCI6MjA3ODA4MTkzMn0.pCmr1LEfsiPnvWKeTjGX4zGgUOYbwaLoKe1Qzy5jbdk";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function main() {
  console.log("🔄 Bắt đầu backfill cash_transactions từ work_orders...\n");

  // Bước 1: Lấy tất cả work_orders đã có thanh toán
  const { data: workOrders, error: woError } = await supabase
    .from("work_orders")
    .select("*")
    .or("totalpaid.gt.0,depositamount.gt.0")
    .in("paymentstatus", ["paid", "partial"]);

  if (woError) {
    console.error("❌ Lỗi khi lấy work_orders:", woError);
    return;
  }

  console.log(
    `📋 Tìm thấy ${workOrders?.length || 0} phiếu sửa chữa có thanh toán\n`
  );

  if (!workOrders || workOrders.length === 0) {
    console.log("✅ Không có phiếu nào cần backfill");
    return;
  }

  // Bước 2: Lấy các cash_transactions đã có (để tránh duplicate)
  const { data: existingTx } = await supabase
    .from("cash_transactions")
    .select("workorderid, category")
    .not("workorderid", "is", null);

  const existingMap = new Map();
  existingTx?.forEach((tx) => {
    const key = `${tx.workorderid}-${tx.category}`;
    existingMap.set(key, true);
  });

  console.log(
    `📊 Đã có ${existingTx?.length || 0} giao dịch liên quan đến work_orders\n`
  );

  // Bước 3: Chuẩn bị dữ liệu để insert
  const depositTransactions = [];
  const paymentTransactions = [];

  for (const wo of workOrders) {
    const depositAmount = wo.depositamount || 0;
    const totalPaid = wo.totalpaid || 0;
    const paymentAmount = totalPaid - depositAmount;

    // Deposit transaction
    if (depositAmount > 0) {
      const depositKey = `${wo.id}-service_deposit`;
      if (!existingMap.has(depositKey)) {
        depositTransactions.push({
          id: `BACKFILL-DEP-${wo.id}`,
          type: "income",
          category: "service_deposit",
          amount: depositAmount,
          date: wo.depositdate || wo.creationdate || new Date().toISOString(),
          description: `Đặt cọc sửa chữa - ${wo.customername || "N/A"} - ${
            wo.licenseplate || ""
          }`,
          branchid: wo.branchid || "CN1",
          paymentsource: wo.paymentmethod || "cash",
          workorderid: wo.id,
          notes: "[BACKFILL] Tạo tự động từ dữ liệu phiếu sửa chữa cũ",
        });
      }
    }

    // Payment transaction (phần thanh toán sau cọc)
    if (paymentAmount > 0) {
      const paymentKey = `${wo.id}-service_income`;
      if (!existingMap.has(paymentKey)) {
        paymentTransactions.push({
          id: `BACKFILL-PAY-${wo.id}`,
          type: "income",
          category: "service_income",
          amount: paymentAmount,
          date: wo.paymentdate || wo.creationdate || new Date().toISOString(),
          description: `Thu tiền sửa chữa - ${wo.customername || "N/A"} - ${
            wo.licenseplate || ""
          }`,
          branchid: wo.branchid || "CN1",
          paymentsource: wo.paymentmethod || "cash",
          workorderid: wo.id,
          notes: "[BACKFILL] Tạo tự động từ dữ liệu phiếu sửa chữa cũ",
        });
      }
    }
  }

  console.log(`💰 Cần tạo ${depositTransactions.length} giao dịch đặt cọc`);
  console.log(
    `💵 Cần tạo ${paymentTransactions.length} giao dịch thanh toán\n`
  );

  // Bước 4: Insert deposit transactions
  if (depositTransactions.length > 0) {
    console.log("📤 Đang insert deposit transactions...");
    const { data: depData, error: depError } = await supabase
      .from("cash_transactions")
      .upsert(depositTransactions, { onConflict: "id" })
      .select();

    if (depError) {
      console.error("❌ Lỗi insert deposit:", depError);
    } else {
      console.log(`✅ Đã tạo ${depData?.length || 0} giao dịch đặt cọc`);
    }
  }

  // Bước 5: Insert payment transactions
  if (paymentTransactions.length > 0) {
    console.log("📤 Đang insert payment transactions...");
    const { data: payData, error: payError } = await supabase
      .from("cash_transactions")
      .upsert(paymentTransactions, { onConflict: "id" })
      .select();

    if (payError) {
      console.error("❌ Lỗi insert payment:", payError);
    } else {
      console.log(`✅ Đã tạo ${payData?.length || 0} giao dịch thanh toán`);
    }
  }

  // Bước 6: Tổng kết
  console.log("\n📊 Tổng kết:");

  const { data: summary } = await supabase
    .from("cash_transactions")
    .select("category, amount")
    .like("id", "BACKFILL-%");

  if (summary) {
    const depositTotal = summary
      .filter((s) => s.category === "service_deposit")
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    const paymentTotal = summary
      .filter((s) => s.category === "service_income")
      .reduce((sum, s) => sum + (s.amount || 0), 0);

    console.log(`   Đặt cọc: ${depositTotal.toLocaleString("vi-VN")} VNĐ`);
    console.log(`   Thanh toán: ${paymentTotal.toLocaleString("vi-VN")} VNĐ`);
    console.log(
      `   Tổng cộng: ${(depositTotal + paymentTotal).toLocaleString(
        "vi-VN"
      )} VNĐ`
    );
  }

  console.log("\n✅ Hoàn thành backfill!");
}

main().catch(console.error);
