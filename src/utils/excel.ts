import * as XLSX from "xlsx";
import type { Part } from "../types";
import { generateSKU, isValidSKU } from "./sku";

/**
 * Export parts to Excel file
 */
export const exportPartsToExcel = (
  parts: Part[],
  currentBranchId: string,
  filename: string = "BaoCao_TonKho.xlsx"
) => {
  // Prepare data for export
  const data = parts.map((part, index) => ({
    STT: index + 1,
    "Tên sản phẩm": part.name,
    SKU: part.sku,
    "Danh mục": part.category || "",
    "Tồn kho": part.stock[currentBranchId] || 0,
    "Giá bán lẻ": part.retailPrice[currentBranchId] || 0,
    "Giá bán sỉ": part.wholesalePrice?.[currentBranchId] || 0,
    "Giá trị tồn":
      (part.stock[currentBranchId] || 0) *
      (part.retailPrice[currentBranchId] || 0),
    "Mô tả": part.description || "",
  }));

  // Create worksheet
  const ws = XLSX.utils.json_to_sheet(data);

  // Set column widths
  ws["!cols"] = [
    { wch: 5 }, // STT
    { wch: 30 }, // Tên sản phẩm
    { wch: 15 }, // SKU
    { wch: 20 }, // Danh mục
    { wch: 10 }, // Tồn kho
    { wch: 15 }, // Giá bán lẻ
    { wch: 15 }, // Giá bán sỉ
    { wch: 15 }, // Giá trị tồn
    { wch: 40 }, // Mô tả
  ];

  // Create workbook
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Tồn kho");

  // Save file
  XLSX.writeFile(wb, filename);
};

/**
 * Export inventory template for import
 */
export const exportInventoryTemplate = (
  filename: string = "MauNhapTonKho.xlsx"
) => {
  const templateData = [
    {
      "Tên sản phẩm": "VD: Nhớt Motul 7100 10W40",
      SKU: "A3B7K9M2 (hoặc để trống - hệ thống tự tạo)",
      "Danh mục": "Nhớt động cơ",
      "Số lượng nhập": 50,
      "Giá bán lẻ": 180000,
      "Giá bán sỉ": 150000,
      "Mô tả": "Nhớt cao cấp cho xe côn tay",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(templateData);

  // Set column widths
  ws["!cols"] = [
    { wch: 30 }, // Tên sản phẩm
    { wch: 15 }, // SKU
    { wch: 20 }, // Danh mục
    { wch: 15 }, // Số lượng nhập
    { wch: 15 }, // Giá bán lẻ
    { wch: 15 }, // Giá bán sỉ
    { wch: 40 }, // Mô tả
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Mẫu");

  XLSX.writeFile(wb, filename);
};

/**
 * Import parts from Excel/CSV file
 */
export const importPartsFromExcel = (
  file: File,
  _currentBranchId: string
): Promise<
  Array<{
    name: string;
    sku: string;
    category?: string;
    quantity: number;
    retailPrice: number;
    wholesalePrice: number;
    description?: string;
  }>
> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const isCsv = /\.csv$/i.test(file.name);
        const workbook = XLSX.read(data, { type: isCsv ? "string" : "binary" });

        // Get first sheet
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];

        // Convert to JSON
        // Keep empty cells (defval: "") so we can distinguish blank rows
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          blankrows: false,
        });

        // Helpers: normalize keys and parse numbers robustly
        const stripDiacritics = (s: string) =>
          s
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/đ/gi, (m) => (m === "đ" ? "d" : "D"));
        const norm = (s: string) =>
          stripDiacritics(String(s).toLowerCase().trim()).replace(
            /[^a-z0-9]+/g,
            ""
          );
        const parseNum = (v: any) => {
          if (v == null || v === "") return 0;
          if (typeof v === "number") return v;
          let t = String(v).trim();
          // remove spaces
          t = t.replace(/\s+/g, "");
          // if both dot and comma exist, assume dot is thousands and comma decimal
          if (t.includes(".") && t.includes(",")) {
            t = t.replace(/\./g, "").replace(/,/g, ".");
          } else if (t.includes(",") && !t.includes(".")) {
            // only comma present -> treat comma as decimal
            t = t.replace(/,/g, ".");
          } else {
            // only dot or none -> remove thousands commas just in case
            t = t.replace(/,/g, "");
          }
          const n = parseFloat(t);
          return isNaN(n) ? 0 : n;
        };

        // Build a per-row accessor that tolerates various header names
        const synonyms: Record<string, string[]> = {
          name: [
            "tensanpham",
            "ten",
            "productname",
            "name",
            "tenhang",
            "tenmh",
          ],
          sku: ["sku", "mahang", "mah", "code", "ma", "masp", "mavt"],
          category: ["danhmuc", "nhom", "loai", "category"],
          quantity: ["soluongnhap", "soluong", "ton", "tonkho", "sl", "qty"],
          retailPrice: [
            "giabanle",
            "giale",
            "giaban",
            "gia",
            "retailprice",
            "giabanra",
          ],
          wholesalePrice: ["giabansi", "giasi", "wholesaleprice", "giabuon"],
          description: ["mota", "ghichu", "note", "description"],
        };

        const errors: string[] = [];
        const parts = jsonData
          .map((rowAny: any, rowIndex) => {
            const row: Record<string, any> = rowAny || {};
            // Create a lookup map of normalized header -> value
            const dict: Record<string, any> = {};
            Object.keys(row).forEach((k) => {
              dict[norm(k)] = row[k];
            });
            const get = (key: keyof typeof synonyms, fallback?: any) => {
              for (const alias of synonyms[key]) {
                const v = dict[alias];
                if (v != null && v !== "") return v;
              }
              return fallback;
            };

            const name = String(get("name", "")).trim();
            const sku = String(get("sku", "")).trim();
            const category = get("category");
            const quantity = parseNum(get("quantity", 0));
            const retailPrice = parseNum(get("retailPrice", 0));
            const wholesalePrice = parseNum(get("wholesalePrice", 0));
            const description = get("description");
            // Fallback guess: if name/sku empty but row has other fields
            if ((!name || !sku) && Object.values(row).some((v) => v !== "")) {
              // Heuristic: take first non-empty string as name, second as sku
              const nonEmpty = Object.values(row)
                .map((v) => String(v).trim())
                .filter((v) => v !== "");
              if (!name && nonEmpty.length > 0) {
                const guessedName = nonEmpty[0];
                if (guessedName.length > 0) {
                  row["__guessed_name"] = guessedName;
                }
              }
              if (!sku && nonEmpty.length > 1) {
                const guessedSku = nonEmpty[1];
                if (guessedSku.length > 0) {
                  row["__guessed_sku"] = guessedSku;
                }
              }
            }
            const finalName = name || (row["__guessed_name"] as string) || "";
            const finalSku = sku || (row["__guessed_sku"] as string) || "";

            if (!finalName && !finalSku) {
              // Completely blank or unusable row -> skip silently
              return null;
            }
            if (!finalName || !finalSku) {
              errors.push(
                `Hàng ${rowIndex + 2}: thiếu ${
                  !finalName ? "Tên sản phẩm" : "SKU"
                }`
              );
              return null;
            }
            return {
              name: finalName,
              sku: finalSku,
              category,
              quantity,
              retailPrice,
              wholesalePrice,
              description,
            };
          })
          .filter(Boolean) as Array<{
          name: string;
          sku: string;
          category?: string;
          quantity: number;
          retailPrice: number;
          wholesalePrice: number;
          description?: string;
        }>;

        if (parts.length === 0) {
          throw new Error(
            errors.length > 0
              ? `Không import được: ${errors.slice(0, 3).join("; ")}`
              : "File không có dữ liệu hợp lệ"
          );
        }
        if ((import.meta as any)?.env?.DEV && errors.length) {
          console.warn("Một số dòng bị bỏ qua:", errors);
        }

        resolve(parts);
      } catch (error) {
        // Surface helpful message
        const msg =
          error instanceof Error ? error.message : "Không đọc được dữ liệu";
        reject(new Error(msg));
      }
    };

    reader.onerror = () => {
      reject(new Error("Lỗi đọc file"));
    };

    // For CSV dùng readAsText để tránh lỗi encoding BOM
    if (/\.csv$/i.test(file.name)) {
      reader.readAsText(file, "utf-8");
    } else {
      reader.readAsBinaryString(file);
    }
  });
};

/**
 * Import parts with detailed result (items + non-fatal row errors)
 * Note: Unlike importPartsFromExcel (which throws when no valid rows),
 * this returns both parsed items and a list of skipped-row messages.
 */
export const importPartsFromExcelDetailed = (
  file: File,
  _currentBranchId: string
): Promise<{
  items: Array<{
    name: string;
    sku: string;
    category?: string;
    quantity: number;
    costPrice: number;
    retailPrice: number;
    wholesalePrice: number;
    description?: string;
  }>;
  errors: string[];
}> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const isCsv = /\.csv$/i.test(file.name);
        const workbook = XLSX.read(data, { type: isCsv ? "string" : "binary" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(worksheet, {
          defval: "",
          blankrows: false,
        });

        const stripDiacritics = (s: string) =>
          s
            .normalize("NFD")
            .replace(/\p{Diacritic}/gu, "")
            .replace(/đ/gi, (m) => (m === "đ" ? "d" : "D"));
        const norm = (s: string) =>
          stripDiacritics(String(s).toLowerCase().trim()).replace(
            /[^a-z0-9]+/g,
            ""
          );
        const parseNum = (v: any) => {
          if (v == null || v === "") return 0;
          if (typeof v === "number") return v;
          let t = String(v).trim();
          t = t.replace(/\s+/g, "");
          if (t.includes(".") && t.includes(",")) {
            t = t.replace(/\./g, "").replace(/,/g, ".");
          } else if (t.includes(",") && !t.includes(".")) {
            t = t.replace(/,/g, ".");
          } else {
            t = t.replace(/,/g, "");
          }
          const n = parseFloat(t);
          return isNaN(n) ? 0 : n;
        };

        const synonyms: Record<string, string[]> = {
          name: [
            "tensanpham",
            "ten",
            "productname",
            "name",
            "tenhang",
            "tenmh",
          ],
          sku: ["sku", "mahang", "mah", "code", "ma", "masp", "mavt"],
          category: ["danhmuc", "nhom", "loai", "category"],
          quantity: ["soluongnhap", "soluong", "ton", "tonkho", "sl", "qty"],
          costPrice: ["dongianhap", "gianhap", "costprice", "giavon"],
          retailPrice: [
            "giabanle",
            "giale",
            "giaban",
            "gia",
            "retailprice",
            "giabanra",
            "dongiabanle",
          ],
          wholesalePrice: [
            "giabansi",
            "giasi",
            "wholesaleprice",
            "giabuon",
            "dongiabansi",
          ],
          description: ["mota", "ghichu", "note", "description"],
        };

        const errors: string[] = [];
        const items = jsonData
          .map((rowAny: any, rowIndex) => {
            const row: Record<string, any> = rowAny || {};
            const dict: Record<string, any> = {};
            Object.keys(row).forEach((k) => {
              dict[norm(k)] = row[k];
            });
            const get = (key: keyof typeof synonyms, fallback?: any) => {
              for (const alias of synonyms[key]) {
                const v = dict[alias];
                if (v != null && v !== "") return v;
              }
              return fallback;
            };

            const name = String(get("name", "")).trim();
            let sku = String(get("sku", "")).trim().toUpperCase();

            // Auto-generate 8-char SKU if missing or invalid
            if (!sku || !isValidSKU(sku)) {
              sku = generateSKU();
            }

            const category = get("category");
            const quantity = parseNum(get("quantity", 0));
            const costPrice = parseNum(get("costPrice", 0));
            const retailPrice = parseNum(get("retailPrice", 0));
            const wholesalePrice = parseNum(get("wholesalePrice", 0));
            const description = get("description");

            // SKU is now always generated (either from file or auto-generated)
            // Only validate name
            if (!name && Object.values(row).some((v) => v !== "")) {
              const nonEmpty = Object.values(row)
                .map((v) => String(v).trim())
                .filter((v) => v !== "");
              if (nonEmpty.length > 0) {
                const guessedName = nonEmpty[0];
                if (guessedName.length > 0) {
                  errors.push(
                    `Hàng ${rowIndex + 2}: Thiếu tên sản phẩm, tạo SKU: ${sku}`
                  );
                  return null;
                }
              }
            }

            if (!name) return null; // skip blank row

            return {
              name: name,
              sku: sku,
              category,
              quantity,
              costPrice,
              retailPrice,
              wholesalePrice,
              description,
            };
          })
          .filter(Boolean) as Array<{
          name: string;
          sku: string;
          category?: string;
          quantity: number;
          costPrice: number;
          retailPrice: number;
          wholesalePrice: number;
          description?: string;
        }>;

        resolve({ items, errors });
      } catch (error) {
        const msg =
          error instanceof Error ? error.message : "Không đọc được dữ liệu";
        reject(new Error(msg));
      }
    };

    reader.onerror = () => {
      reject(new Error("Lỗi đọc file"));
    };

    if (/\.csv$/i.test(file.name)) {
      reader.readAsText(file, "utf-8");
    } else {
      reader.readAsBinaryString(file);
    }
  });
};
