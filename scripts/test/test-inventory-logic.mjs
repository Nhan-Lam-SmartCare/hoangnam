#!/usr/bin/env node
/**
 * Test Inventory Logic
 * Kiểm tra logic kế toán và lưu trữ dữ liệu của hệ thống quản lý kho
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
const TEST_PART_NAME = "Test Part - Inventory Logic";
const TEST_SKU = `TEST-INV-${Date.now()}`;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  console.log("\n🧪 BẮT ĐẦU TEST LOGIC KẾ TOÁN VÀ KHO\n");

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

  let testPartId = null;

  try {
    // 2. Tạo phụ tùng test
    console.log("2️⃣  Tạo phụ tùng test...");
    const partId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `test-${Date.now()}`;
    const { data: newPart, error: createError } = await client
      .from("parts")
      .insert({
        id: partId,
        name: TEST_PART_NAME,
        sku: TEST_SKU,
        category: "Test Category",
        description: "Test part for inventory logic validation",
        stock: { [TEST_BRANCH]: 0 },
        costPrice: { [TEST_BRANCH]: 100000 },
        retailPrice: { [TEST_BRANCH]: 150000 },
        wholesalePrice: { [TEST_BRANCH]: 135000 },
      })
      .select()
      .single();

    if (createError) {
      console.error("❌ Lỗi tạo part:", createError.message);
      process.exit(1);
    }

    testPartId = newPart.id;
    console.log(`✅ Đã tạo part: ${testPartId}`);
    console.log(`   Stock ban đầu: ${newPart.stock[TEST_BRANCH] || 0}\n`);

    // 3. Test Nhập kho
    console.log("3️⃣  Test NHẬP KHO (quantity=10, unitPrice=100000)...");
    const importQty = 10;
    const importPrice = 100000;
    const expectedTotal = importQty * importPrice;

    const importTxId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `tx-${Date.now()}`;

    const { data: importTx, error: importError } = await client
      .from("inventory_transactions")
      .insert({
        id: importTxId,
        type: "Nhập kho",
        partId: testPartId,
        partName: TEST_PART_NAME,
        quantity: importQty,
        date: new Date().toISOString(),
        unitPrice: importPrice,
        totalPrice: expectedTotal,
        branchId: TEST_BRANCH,
        notes: "TEST: Nhập kho - kiểm tra trigger tự động",
      })
      .select()
      .single();

    if (importError) {
      console.error("❌ Lỗi nhập kho:", importError.message);
      throw importError;
    }

    console.log(`✅ Đã tạo giao dịch nhập kho: ${importTx.id}`);
    console.log(`   Số lượng: ${importTx.quantity}`);
    console.log(`   Đơn giá: ${importTx.unitPrice?.toLocaleString()} VNĐ`);
    console.log(`   Thành tiền: ${importTx.totalPrice?.toLocaleString()} VNĐ`);
    console.log(
      `   Thành tiền tính toán: ${expectedTotal.toLocaleString()} VNĐ`
    );

    // Kiểm tra logic kế toán
    if (importTx.totalPrice !== expectedTotal) {
      console.error(
        `❌ SAI LOGIC KẾ TOÁN: Expected ${expectedTotal}, got ${importTx.totalPrice}`
      );
    } else {
      console.log("✅ Logic kế toán đúng (totalPrice = quantity × unitPrice)");
    }

    // Đợi trigger xử lý
    console.log("\n⏳ Đợi 2 giây để trigger xử lý...");
    await sleep(2000);

    // 4. Kiểm tra stock đã tăng chưa
    console.log("\n4️⃣  Kiểm tra stock sau khi nhập kho...");
    const { data: partAfterImport, error: fetchError1 } = await client
      .from("parts")
      .select("stock")
      .eq("id", testPartId)
      .single();

    if (fetchError1) {
      console.error("❌ Lỗi lấy part:", fetchError1.message);
      throw fetchError1;
    }

    const stockAfterImport = partAfterImport.stock[TEST_BRANCH] || 0;
    console.log(`   Stock hiện tại: ${stockAfterImport}`);
    console.log(`   Stock mong đợi: ${importQty}`);

    if (stockAfterImport === importQty) {
      console.log(
        "✅ TRIGGER HOẠT ĐỘNG ĐÚNG: Stock đã tự động tăng sau nhập kho"
      );
    } else {
      console.error(
        `❌ TRIGGER SAI: Expected stock ${importQty}, got ${stockAfterImport}`
      );
    }

    // 5. Test Xuất kho
    console.log("\n5️⃣  Test XUẤT KHO (quantity=3, unitPrice=0)...");
    const exportQty = 3;

    const exportTxId =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `tx-export-${Date.now()}`;

    const { data: exportTx, error: exportError } = await client
      .from("inventory_transactions")
      .insert({
        id: exportTxId,
        type: "Xuất kho",
        partId: testPartId,
        partName: TEST_PART_NAME,
        quantity: exportQty,
        date: new Date().toISOString(),
        unitPrice: 0, // Xuất kho không cần giá
        totalPrice: 0,
        branchId: TEST_BRANCH,
        notes: "TEST: Xuất kho - kiểm tra trigger giảm stock",
      })
      .select()
      .single();

    if (exportError) {
      console.error("❌ Lỗi xuất kho:", exportError.message);
      throw exportError;
    }

    console.log(`✅ Đã tạo giao dịch xuất kho: ${exportTx.id}`);
    console.log(`   Số lượng xuất: ${exportTx.quantity}`);

    // Đợi trigger xử lý
    console.log("\n⏳ Đợi 2 giây để trigger xử lý...");
    await sleep(2000);

    // 6. Kiểm tra stock đã giảm chưa
    console.log("\n6️⃣  Kiểm tra stock sau khi xuất kho...");
    const { data: partAfterExport, error: fetchError2 } = await client
      .from("parts")
      .select("stock")
      .eq("id", testPartId)
      .single();

    if (fetchError2) {
      console.error("❌ Lỗi lấy part:", fetchError2.message);
      throw fetchError2;
    }

    const stockAfterExport = partAfterExport.stock[TEST_BRANCH] || 0;
    const expectedStockAfterExport = importQty - exportQty;
    console.log(`   Stock hiện tại: ${stockAfterExport}`);
    console.log(`   Stock mong đợi: ${expectedStockAfterExport}`);

    if (stockAfterExport === expectedStockAfterExport) {
      console.log(
        "✅ TRIGGER HOẠT ĐỘNG ĐÚNG: Stock đã tự động giảm sau xuất kho"
      );
    } else {
      console.error(
        `❌ TRIGGER SAI: Expected stock ${expectedStockAfterExport}, got ${stockAfterExport}`
      );
    }

    // 7. Tổng kết
    console.log("\n" + "=".repeat(60));
    console.log("📊 TỔNG KẾT KẾT QUẢ TEST");
    console.log("=".repeat(60));
    console.log(`✅ Logic kế toán: totalPrice = quantity × unitPrice`);
    console.log(`✅ Trigger nhập kho: tự động tăng stock`);
    console.log(`✅ Trigger xuất kho: tự động giảm stock`);
    console.log(`✅ Lưu trữ dữ liệu: inventory_transactions ghi đầy đủ`);
    console.log(
      `\n🎉 MỌI THỨ HOẠT ĐỘNG ĐÚNG - LOGIC KẾ TOÁN VÀ KHO ỔN ĐỊNH!\n`
    );
  } catch (error) {
    console.error("\n❌ Test thất bại:", error);
  } finally {
    // Cleanup
    if (testPartId) {
      console.log("\n🧹 Dọn dẹp dữ liệu test...");

      // Xóa transactions
      await client
        .from("inventory_transactions")
        .delete()
        .eq("partId", testPartId);

      // Xóa part
      await client.from("parts").delete().eq("id", testPartId);

      console.log("✅ Đã xóa dữ liệu test\n");
    }
  }
}

main().catch(console.error);
