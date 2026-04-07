/**
 * Script: Backfill costPrice cho các phiếu sửa chữa cũ
 *
 * Vấn đề: Các phiếu cũ không lưu costPrice trong partsused
 * Giải pháp: Lấy costPrice từ bảng parts và cập nhật vào partsused
 *
 * Chạy: node scripts/maintenance/backfill_parts_costprice.mjs
 */

import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config();

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_SERVICE_ROLE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY
);

async function backfillCostPrice() {
  console.log("🔧 Bắt đầu backfill costPrice cho các phiếu sửa chữa...\n");

  // 1. Lấy tất cả phiếu có partsused nhưng thiếu costPrice
  const { data: workOrders, error: woError } = await supabase
    .from("work_orders")
    .select("id, partsused, branchid")
    .not("partsused", "is", null);

  if (woError) {
    console.error("❌ Lỗi lấy work_orders:", woError);
    return;
  }

  console.log(`📋 Tìm thấy ${workOrders.length} phiếu có phụ tùng\n`);

  // 2. Lấy tất cả parts để tra cứu costPrice
  const { data: allParts, error: partsError } = await supabase
    .from("parts")
    .select("*");

  if (partsError) {
    console.error("❌ Lỗi lấy parts:", partsError);
    return;
  }

  // Tạo map để tra cứu nhanh
  const partsMap = new Map();
  allParts.forEach((p) => {
    partsMap.set(p.id, p);
  });

  console.log(`📦 Đã load ${allParts.length} phụ tùng từ database`);

  // Debug: Hiển thị 1 phụ tùng mẫu
  if (allParts.length > 0) {
    const sample = allParts[0];
    console.log(`   Mẫu: ${sample.name}, costPrice:`, sample.costPrice);
  }
  console.log("");

  let updatedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  // 3. Duyệt qua từng phiếu và cập nhật costPrice
  for (const wo of workOrders) {
    if (
      !wo.partsused ||
      !Array.isArray(wo.partsused) ||
      wo.partsused.length === 0
    ) {
      skippedCount++;
      continue;
    }

    const branchId = wo.branchid || "CN1";
    let needsUpdate = false;

    const updatedParts = wo.partsused.map((part) => {
      // Kiểm tra nếu đã có costPrice và > 0 thì bỏ qua
      if (part.costPrice && part.costPrice > 0) {
        return part;
      }

      // Tra cứu costPrice từ bảng parts
      const partInfo = partsMap.get(part.partId);
      if (partInfo && partInfo.costPrice) {
        const costPrice = partInfo.costPrice[branchId] || 0;
        if (costPrice > 0) {
          needsUpdate = true;
          return {
            ...part,
            costPrice: costPrice,
          };
        }
      }

      return part;
    });

    if (needsUpdate) {
      const { error: updateError } = await supabase
        .from("work_orders")
        .update({ partsused: updatedParts })
        .eq("id", wo.id);

      if (updateError) {
        console.error(`❌ Lỗi cập nhật phiếu ${wo.id}:`, updateError.message);
        errorCount++;
      } else {
        console.log(`✅ Đã cập nhật phiếu ${wo.id}`);
        updatedCount++;
      }
    } else {
      skippedCount++;
    }
  }

  console.log("\n========================================");
  console.log("📊 KẾT QUẢ BACKFILL:");
  console.log(`   ✅ Đã cập nhật: ${updatedCount} phiếu`);
  console.log(
    `   ⏭️  Bỏ qua: ${skippedCount} phiếu (đã có costPrice hoặc không có phụ tùng)`
  );
  console.log(`   ❌ Lỗi: ${errorCount} phiếu`);
  console.log("========================================\n");
}

// Chạy script
backfillCostPrice()
  .then(() => {
    console.log("🎉 Hoàn tất!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Lỗi:", err);
    process.exit(1);
  });
