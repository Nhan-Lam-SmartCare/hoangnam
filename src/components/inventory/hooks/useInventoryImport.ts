import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { importPartsFromExcelDetailed } from "../../../utils/excel";
import {
  fetchPartsBySkus,
  bulkCreateParts,
  bulkUpdatePartStock,
} from "../../../lib/repository/partsRepository";
import { bulkCreateInventoryTransactions } from "../../../lib/repository/inventoryTransactionsRepository";
import { showToast } from "../../../utils/toast";

export interface UseInventoryImportParams {
  currentBranchId: string;
  /** Gọi khi import thành công (component đóng modal tại đây). */
  onImported: () => void;
}

/**
 * Import tồn kho từ file Excel: parse → tra SKU theo lô → tạo mới/cộng tồn
 * hàng loạt → ghi giao dịch kho → invalidate cache. Tách nguyên văn từ
 * InventoryManager (hành vi giữ nguyên).
 */
export function useInventoryImport({
  currentBranchId,
  onImported,
}: UseInventoryImportParams) {
  const queryClient = useQueryClient();

  const handleImportExcel = useCallback(
    async (file: File) => {
      try {
        const { items: importedData, errors: rowErrors } =
          await importPartsFromExcelDetailed(file, currentBranchId);

        if (importedData.length === 0) {
          const msg = rowErrors.length
            ? `Không import được: ${rowErrors.slice(0, 3).join("; ")}`
            : "File không có dữ liệu hợp lệ";
          throw new Error(msg);
        }

        // OPTIMIZATION: Batch fetch all parts by SKU in one query
        const allSkus = importedData.map((item) => item.sku);

        // Check for duplicate SKUs in import file
        const skuCounts = new Map<string, number>();
        allSkus.forEach((sku) => {
          skuCounts.set(sku, (skuCounts.get(sku) || 0) + 1);
        });
        const duplicates = Array.from(skuCounts.entries())
          .filter(([_, count]) => count > 1)
          .map(([sku, count]) => `${sku}(${count}x)`);

        if (duplicates.length > 0) {
          console.warn(
            `⚠️ Duplicate SKUs in file: ${duplicates.slice(0, 5).join(", ")}`
          );
        }

        // Fetch existing parts in chunks (Supabase .in() has URL length limit)
        const uniqueSkus = Array.from(new Set(allSkus));
        const CHUNK_SIZE = 100; // Process 100 SKUs per request
        const allExistingParts: any[] = [];

        for (let i = 0; i < uniqueSkus.length; i += CHUNK_SIZE) {
          const chunk = uniqueSkus.slice(i, i + CHUNK_SIZE);
          const chunkRes = await fetchPartsBySkus(chunk);

          if (!chunkRes.ok) {
            console.error(
              `❌ Fetch chunk ${i / CHUNK_SIZE + 1} error:`,
              chunkRes.error.cause
            );
            throw new Error(`Lỗi kiểm tra phụ tùng: ${chunkRes.error.message}`);
          }

          allExistingParts.push(...chunkRes.data);
        }

        const existingPartsMap = new Map(
          allExistingParts.map((p) => [p.sku, p])
        );

        // Prepare batch operations
        const partsToCreate: any[] = [];
        const partsToUpdate: any[] = [];
        const inventoryTxToCreate: any[] = [];
        const processedSkus = new Set<string>(); // Track processed SKUs to avoid duplicates
        let createdCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;
        const importDate = new Date().toISOString();

        for (const item of importedData) {
          // Skip if SKU already processed (duplicate in file)
          if (processedSkus.has(item.sku)) {
            console.warn(`⚠️ Skipping duplicate SKU in file: ${item.sku}`);
            skippedCount++;
            continue;
          }
          processedSkus.add(item.sku);

          const existingPart = existingPartsMap.get(item.sku);

          if (existingPart) {
            // Update existing part
            updatedCount += 1;
            partsToUpdate.push({
              id: existingPart.id,
              stock: {
                ...existingPart.stock,
                [currentBranchId]:
                  (existingPart.stock[currentBranchId] || 0) + item.quantity,
              },
              costPrice: {
                ...existingPart.costPrice,
                [currentBranchId]: item.costPrice,
              },
              retailPrice: {
                ...existingPart.retailPrice,
                [currentBranchId]: item.retailPrice,
              },
              wholesalePrice: {
                ...existingPart.wholesalePrice,
                [currentBranchId]: item.wholesalePrice,
              },
            });

            // Prepare inventory transaction
            inventoryTxToCreate.push({
              type: "Nhập kho",
              date: importDate,
              branchId: currentBranchId,
              partId: existingPart.id,
              partName: item.name,
              quantity: item.quantity,
              unitPrice: item.retailPrice,
              totalPrice: item.quantity * item.retailPrice,
              notes: `Nhập kho từ file Excel`,
            });
          } else {
            // Create new part
            createdCount += 1;
            const newPartId =
              crypto?.randomUUID?.() ||
              `${Math.random().toString(36).slice(2)}-${Date.now()}`;

            partsToCreate.push({
              id: newPartId,
              name: item.name,
              sku: item.sku,
              category: item.category,
              description: item.description,
              stock: {
                [currentBranchId]: item.quantity,
              },
              costPrice: {
                [currentBranchId]: item.costPrice,
              },
              retailPrice: {
                [currentBranchId]: item.retailPrice,
              },
              wholesalePrice: {
                [currentBranchId]: item.wholesalePrice,
              },
            });

            // Prepare inventory transaction
            inventoryTxToCreate.push({
              type: "Nhập kho",
              date: importDate,
              branchId: currentBranchId,
              partId: newPartId,
              partName: item.name,
              quantity: item.quantity,
              unitPrice: item.retailPrice,
              totalPrice: item.quantity * item.retailPrice,
              notes: `Nhập kho từ file Excel`,
            });
          }
        }

        // BATCH: Execute all creates
        if (partsToCreate.length > 0) {
          const createRes = await bulkCreateParts(partsToCreate);
          if (!createRes.ok) {
            console.error("❌ Batch create error:", createRes.error.cause);
            throw new Error(createRes.error.message);
          }
        }

        // BATCH: Execute all updates
        if (partsToUpdate.length > 0) {
          await bulkUpdatePartStock(partsToUpdate);
        }

        // BATCH: Create inventory transactions
        if (inventoryTxToCreate.length > 0) {
          const txRes = await bulkCreateInventoryTransactions(
            inventoryTxToCreate
          );
          if (!txRes.ok) {
            console.warn("⚠️ Inventory transactions error:", txRes.error.cause);
            // Don't throw - transactions are not critical
          }
        }

        // Invalidate queries to refresh UI
        queryClient.invalidateQueries({ queryKey: ["partsRepo"] });
        queryClient.invalidateQueries({ queryKey: ["partsRepoPaged"] });

        onImported();

        let summaryMsg = `Import: tạo mới ${createdCount}, cập nhật ${updatedCount}`;
        if (skippedCount > 0) {
          summaryMsg += `, bỏ qua ${skippedCount} SKU trùng`;
        }
        if (rowErrors.length > 0) {
          summaryMsg += `, ${rowErrors.length} dòng lỗi`;
        }

        showToast.success(summaryMsg);
      } catch (error) {
        console.error("❌ Import error:", error);
        showToast.error(`Lỗi import: ${error}`);
      }
    },
    [currentBranchId, onImported, queryClient]
  );

  return { handleImportExcel };
}
