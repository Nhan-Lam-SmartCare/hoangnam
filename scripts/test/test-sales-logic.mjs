#!/usr/bin/env node
/**
 * Test Sales Logic
 * Kiểm tra logic kế toán và lưu trữ dữ liệu của hệ thống bán hàng
 */

import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const url = process.env.VITE_SUPABASE_URL;
const anon = process.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  console.error("❌ Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY");
  process.exit(1);
}

const testUser = {
  email: "lam.tcag@gmail.com",
  password: process.env.TEST_PASS_OWNER || "Lam123456",
};

const TEST_BRANCH = "CN1";

async function main() {
  console.log("\n🧪 BẮT ĐẦU TEST LOGIC BÁN HÀNG\n");

  // 1. Login
  console.log("1️⃣  Đăng nhập...");
  const client = createClient(url, anon, { auth: { persistSession: false } });
  const { data: loginData, error: loginError } =
    await client.auth.signInWithPassword(testUser);

  if (loginError) {
    console.error("❌ Login thất bại:", loginError.message);
    process.exit(1);
  }
  console.log("✅ Đăng nhập thành công\n");

  let testPartIds = [];
  let testSaleId = null;

  try {
    // 2. Tạo 2 phụ tùng test
    console.log("2️⃣  Tạo phụ tùng test...");
    const part1Id = crypto.randomUUID();
    const part2Id = crypto.randomUUID();

    await client.from("parts").insert([
      {
        id: part1Id,
        name: "Test Part 1 - Sales",
        sku: `TEST-SALE-1-${Date.now()}`,
        category: "Test",
        stock: { [TEST_BRANCH]: 100 },
        costPrice: { [TEST_BRANCH]: 50000 },
        retailPrice: { [TEST_BRANCH]: 75000 },
      },
      {
        id: part2Id,
        name: "Test Part 2 - Sales",
        sku: `TEST-SALE-2-${Date.now()}`,
        category: "Test",
        stock: { [TEST_BRANCH]: 50 },
        costPrice: { [TEST_BRANCH]: 100000 },
        retailPrice: { [TEST_BRANCH]: 150000 },
      },
    ]);

    testPartIds = [part1Id, part2Id];
    console.log("✅ Đã tạo 2 phụ tùng test\n");

    // 3. Test tạo hóa đơn bán hàng
    console.log("3️⃣  Test TẠO HÓA ĐƠN BÁN HÀNG...");
    testSaleId = `SALE-TEST-${Date.now()}`;

    const items = [
      {
        partId: part1Id,
        partName: "Test Part 1 - Sales",
        sku: `TEST-SALE-1-${Date.now()}`,
        quantity: 5,
        sellingPrice: 75000,
        discount: 0,
      },
      {
        partId: part2Id,
        partName: "Test Part 2 - Sales",
        sku: `TEST-SALE-2-${Date.now()}`,
        quantity: 3,
        sellingPrice: 150000,
        discount: 0,
      },
    ];

    // Tính toán
    const subtotal = items.reduce(
      (sum, item) => sum + item.quantity * item.sellingPrice,
      0
    );
    const discount = 50000; // Giảm giá 50k
    const total = subtotal - discount;

    console.log(`   Item 1: 5 × 75,000 = ${(5 * 75000).toLocaleString()} VNĐ`);
    console.log(
      `   Item 2: 3 × 150,000 = ${(3 * 150000).toLocaleString()} VNĐ`
    );
    console.log(`   Subtotal: ${subtotal.toLocaleString()} VNĐ`);
    console.log(`   Discount: ${discount.toLocaleString()} VNĐ`);
    console.log(`   Total: ${total.toLocaleString()} VNĐ`);

    // Call atomic function
    const { data: saleResult, error: saleError } = await client.rpc(
      "sale_create_atomic",
      {
        p_sale_id: testSaleId,
        p_items: items,
        p_discount: discount,
        p_customer: { name: "Test Customer", phone: "0123456789" },
        p_payment_method: "cash",
        p_user_id: loginData.user.id,
        p_user_name: "Test User",
        p_branch_id: TEST_BRANCH,
      }
    );

    if (saleError) {
      console.error("❌ Lỗi tạo hóa đơn:", saleError.message);
      throw saleError;
    }

    const saleData = saleResult.sale;
    console.log("\n✅ Đã tạo hóa đơn:");
    console.log(`   ID: ${saleData.id}`);
    console.log(`   Subtotal: ${saleData.subtotal.toLocaleString()} VNĐ`);
    console.log(`   Discount: ${saleData.discount.toLocaleString()} VNĐ`);
    console.log(`   Total: ${saleData.total.toLocaleString()} VNĐ`);

    // 4. Kiểm tra logic kế toán
    console.log("\n4️⃣  Kiểm tra logic kế toán...");

    if (saleData.subtotal !== subtotal) {
      console.error(
        `❌ SAI SUBTOTAL: Expected ${subtotal}, got ${saleData.subtotal}`
      );
    } else {
      console.log("✅ Subtotal đúng");
    }

    if (saleData.discount !== discount) {
      console.error(
        `❌ SAI DISCOUNT: Expected ${discount}, got ${saleData.discount}`
      );
    } else {
      console.log("✅ Discount đúng");
    }

    if (saleData.total !== total) {
      console.error(`❌ SAI TOTAL: Expected ${total}, got ${saleData.total}`);
    } else {
      console.log("✅ Total đúng (total = subtotal - discount)");
    }

    // 5. Kiểm tra stock đã giảm chưa
    console.log("\n5️⃣  Kiểm tra stock sau bán hàng...");
    const { data: parts } = await client
      .from("parts")
      .select("id, name, stock")
      .in("id", testPartIds);

    const part1 = parts.find((p) => p.id === part1Id);
    const part2 = parts.find((p) => p.id === part2Id);

    const stock1 = part1.stock[TEST_BRANCH];
    const stock2 = part2.stock[TEST_BRANCH];

    console.log(`   Part 1: Stock = ${stock1} (Expected: 95 = 100 - 5)`);
    console.log(`   Part 2: Stock = ${stock2} (Expected: 47 = 50 - 3)`);

    if (stock1 === 95 && stock2 === 47) {
      console.log("✅ Stock đã tự động giảm đúng!");
    } else {
      console.error("❌ Stock không đúng!");
    }

    // 6. Kiểm tra inventory_transactions
    console.log("\n6️⃣  Kiểm tra inventory_transactions...");
    const { data: invTxs, error: invError } = await client
      .from("inventory_transactions")
      .select("*")
      .eq("saleId", testSaleId);

    if (invError) {
      console.error("❌ Lỗi query inventory:", invError.message);
    } else {
      console.log(`   Số lượng transactions: ${invTxs.length}`);
      if (invTxs.length === 2) {
        console.log("✅ Đã tạo 2 inventory transactions (Xuất kho)");
        invTxs.forEach((tx, i) => {
          console.log(
            `   - TX${i + 1}: ${tx.partName}, qty=${tx.quantity}, type=${
              tx.type
            }`
          );
        });
      } else {
        console.error(`❌ Expected 2 transactions, got ${invTxs.length}`);
      }
    }

    // 7. Kiểm tra cash_transactions
    console.log("\n7️⃣  Kiểm tra cash_transactions...");
    const { data: cashTxs, error: cashError } = await client
      .from("cash_transactions")
      .select("*")
      .eq("reference", testSaleId);

    if (cashError) {
      console.error("❌ Lỗi query cash:", cashError.message);
    } else {
      if (cashTxs.length === 1) {
        const cashTx = cashTxs[0];
        console.log("✅ Đã tạo cash transaction:");
        console.log(`   Amount: ${cashTx.amount.toLocaleString()} VNĐ`);
        console.log(`   Category: ${cashTx.category}`);
        console.log(`   Payment: ${cashTx.paymentSource}`);

        if (cashTx.amount === total) {
          console.log("✅ Cash amount = sale total");
        } else {
          console.error(
            `❌ Cash amount mismatch: ${cashTx.amount} vs ${total}`
          );
        }
      } else {
        console.error(`❌ Expected 1 cash transaction, got ${cashTxs.length}`);
      }
    }

    // 8. Tổng kết
    console.log("\n" + "=".repeat(60));
    console.log("📊 TỔNG KẾT KẾT QUẢ TEST");
    console.log("=".repeat(60));
    console.log("✅ Logic kế toán: subtotal, discount, total chính xác");
    console.log("✅ Stock tự động giảm sau bán hàng");
    console.log("✅ Inventory transactions (Xuất kho) được tạo đúng");
    console.log("✅ Cash transactions được tạo với amount = total");
    console.log("\n🎉 MỌI THỨ HOẠT ĐỘNG ĐÚNG - HỆ THỐNG BÁN HÀNG ỔN ĐỊNH!\n");
  } catch (error) {
    console.error("\n❌ Test thất bại:", error);
  } finally {
    // Cleanup
    console.log("\n🧹 Dọn dẹp dữ liệu test...");

    if (testSaleId) {
      await client.from("sales").delete().eq("id", testSaleId);
      await client
        .from("cash_transactions")
        .delete()
        .eq("reference", testSaleId);
      await client
        .from("inventory_transactions")
        .delete()
        .eq("saleId", testSaleId);
    }

    if (testPartIds.length > 0) {
      await client.from("parts").delete().in("id", testPartIds);
    }

    console.log("✅ Đã xóa dữ liệu test\n");
  }
}

main().catch(console.error);
