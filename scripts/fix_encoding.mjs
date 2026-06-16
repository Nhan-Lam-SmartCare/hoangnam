/**
 * Fix double UTF-8 / CP437 encoding in source files.
 * This script reads the files as raw bytes, maps CP437-mojibake characters
 * back to their byte indices, and writes the correct UTF-8 text back.
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

const cp437ToUnicode = [
  0x00C7, 0x00FC, 0x00E9, 0x00E2, 0x00E4, 0x00E0, 0x00E5, 0x00E7,
  0x00EA, 0x00EB, 0x00E8, 0x00EF, 0x00EE, 0x00EC, 0x00C4, 0x00C5,
  0x00C9, 0x00E6, 0x00C6, 0x00F4, 0x00F6, 0x00F2, 0x00FB, 0x00F9,
  0x00FF, 0x00D6, 0x00DC, 0x00A2, 0x00A3, 0x00A5, 0x20A7, 0x0192,
  0x00E1, 0x00ED, 0x00F3, 0x00FA, 0x00F1, 0x00D1, 0x00AA, 0x00BA,
  0x00BF, 0x2310, 0x00AC, 0x00BD, 0x00BC, 0x00A1, 0x00AB, 0x00BB,
  0x2591, 0x2592, 0x2593, 0x2502, 0x2524, 0x2561, 0x2562, 0x2555,
  0x2556, 0x2563, 0x2551, 0x2557, 0x255D, 0x255C, 0x255B, 0x2510,
  0x2514, 0x2534, 0x252C, 0x251C, 0x2500, 0x253C, 0x255E, 0x255F,
  0x255A, 0x2554, 0x2566, 0x2569, 0x2560, 0x2550, 0x256C, 0x2567,
  0x2568, 0x2564, 0x2565, 0x2559, 0x2558, 0x2552, 0x2553, 0x256B,
  0x256A, 0x2518, 0x250C, 0x2588, 0x2584, 0x258C, 0x2590, 0x2580,
  0x03B1, 0x00DF, 0x0393, 0x03C0, 0x03A3, 0x03C3, 0x00B5, 0x03C4,
  0x03A6, 0x0398, 0x03A9, 0x03B4, 0x221E, 0x03C6, 0x03B5, 0x2229,
  0x2261, 0x00B1, 0x2265, 0x2264, 0x2320, 0x2321, 0x00F7, 0x2248,
  0x00B0, 0x2219, 0x00B7, 0x221A, 0x207F, 0x00B2, 0x25A0, 0x00A0
];

const unicodeToCp437 = new Map();
cp437ToUnicode.forEach((u, i) => {
  unicodeToCp437.set(u, i + 0x80);
});

function decodeCp437String(str) {
  const bytes = [];
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      const byteVal = unicodeToCp437.get(code);
      if (byteVal !== undefined) {
        bytes.push(byteVal);
      } else {
        bytes.push(code & 0xFF);
      }
    }
  }
  return Buffer.from(bytes).toString("utf-8");
}

function fixEncoding(filepath) {
  try {
    const fileText = fs.readFileSync(filepath, "utf-8");
    const fixedText = decodeCp437String(fileText);

    if (fileText === fixedText) {
      console.log(`SKIP (no change): ${filepath}`);
      return false;
    }

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
    if (fixEncoding(fullPath)) {
      fixedCount++;
    }
  } else {
    console.log(`NOT FOUND: ${filepath}`);
  }
}

console.log(`\nTotal fixed: ${fixedCount}/${filesToFix.length}`);
