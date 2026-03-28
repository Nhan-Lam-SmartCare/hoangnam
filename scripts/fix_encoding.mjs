/**
 * Fix double UTF-8 encoding in source files.
 * When text is encoded as UTF-8 twice, characters like "Tổng" become "Tá»•ng".
 * This script reads the corrupted bytes as Latin-1, then interprets as UTF-8.
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filesToFix = [
  "src/components/inventory/components/AddProductModal.tsx",
  "src/components/inventory/components/EditPartModal.tsx",
  "src/components/inventory/components/EditReceiptModal.tsx",
  "src/components/inventory/components/GoodsReceiptModal.tsx",
  "src/components/inventory/components/ImportInventoryModal.tsx",
  "src/components/inventory/components/InventoryHistoryModal.tsx",
  "src/components/sales/SalesManager.tsx",
  "src/components/service/components/WorkOrderModal.tsx",
  "src/components/service/ServiceManager.tsx",
];

function fixDoubleUtf8(filepath) {
  try {
    // Read raw bytes
    const rawBytes = fs.readFileSync(filepath);

    // Decode as UTF-8 (this treats the double-encoded bytes correctly)
    const corruptedText = rawBytes.toString("utf-8");

    // Convert to Latin-1 buffer, then decode as UTF-8
    // This reverses the double encoding
    const latin1Buffer = Buffer.from(corruptedText, "latin1");
    const fixedText = latin1Buffer.toString("utf-8");

    // Check if text actually changed
    if (corruptedText === fixedText) {
      console.log(`SKIP (no change): ${filepath}`);
      return false;
    }

    // Write fixed content
    fs.writeFileSync(filepath, fixedText, "utf-8");
    console.log(`FIXED: ${filepath}`);
    return true;
  } catch (e) {
    console.log(`ERROR (${e.message}): ${filepath}`);
    return false;
  }
}

const baseDir = __dirname;
let fixedCount = 0;

for (const filepath of filesToFix) {
  const fullPath = path.join(baseDir, "..", filepath);
  if (fs.existsSync(fullPath)) {
    if (fixDoubleUtf8(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`NOT FOUND: ${filepath}`);
  }
}

console.log(`\nTotal fixed: ${fixedCount}/${filesToFix.length}`);
