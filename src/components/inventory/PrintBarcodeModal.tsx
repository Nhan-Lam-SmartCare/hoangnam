import React, { useRef, useEffect, useState } from "react";
import { X, Printer, Plus, Minus } from "lucide-react";
import JsBarcode from "jsbarcode";
import { Part } from "../../types";
import { formatCurrency } from "../../utils/format";

interface PrintBarcodeModalProps {
  part: Part;
  currentBranchId: string;
  onClose: () => void;
}

type BarcodeFormat = "CODE128" | "EAN13" | "CODE39";

// Preset sizes phù hợp với Xprinter XP-360B (20-82mm width)
type LabelPreset = "20x35-dual" | "30x20" | "40x30" | "50x30" | "60x40" | "80x50" | "100x80";

const LABEL_PRESETS: Record<
  LabelPreset,
  {
    width: number;
    height: number;
    name: string;
    barcodeHeight: number;
    fontSize: number;
    columns?: number;
  }
> = {
  "20x35-dual": {
    width: 35,
    height: 22,
    name: "22x35mm (giay doi)",
    barcodeHeight: 24,
    fontSize: 8,
    columns: 2,
  },
  "30x20": {
    width: 30,
    height: 20,
    name: "30×20mm (nhỏ)",
    barcodeHeight: 25,
    fontSize: 7,
  },
  "40x30": {
    width: 40,
    height: 30,
    name: "40×30mm (phổ biến)",
    barcodeHeight: 35,
    fontSize: 8,
  },
  "50x30": {
    width: 50,
    height: 30,
    name: "50×30mm (vừa)",
    barcodeHeight: 40,
    fontSize: 9,
  },
  "60x40": {
    width: 60,
    height: 40,
    name: "60×40mm (lớn)",
    barcodeHeight: 45,
    fontSize: 10,
  },
  "80x50": {
    width: 80,
    height: 50,
    name: "80×50mm (max)",
    barcodeHeight: 55,
    fontSize: 12,
  },
  "100x80": {
    width: 100,
    height: 80,
    name: "100×80mm (rất lớn)",
    barcodeHeight: 70,
    fontSize: 14,
  },
};

const PrintBarcodeModal: React.FC<PrintBarcodeModalProps> = ({
  part,
  currentBranchId,
  onClose,
}) => {
  const barcodeRef = useRef<SVGSVGElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  // Settings
  const [quantity, setQuantity] = useState(1);
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [labelPreset, setLabelPreset] = useState<LabelPreset>("20x35-dual");
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>("CODE128");

  // Sử dụng barcode field nếu có, nếu không dùng SKU
  const barcodeValue = part.barcode || part.sku || part.id.slice(0, 12);

  const currentSize = LABEL_PRESETS[labelPreset];
  const labelColumns = currentSize.columns || 1;
  const pageWidth = currentSize.width * labelColumns;
  const pageHeight = currentSize.height;

  // Generate barcode
  useEffect(() => {
    if (barcodeRef.current) {
      try {
        // Tính toán width dựa trên kích thước nhãn
        const barcodeWidth = Math.max(1, (currentSize.width - 10) / 50);

        JsBarcode(barcodeRef.current, barcodeValue, {
          format: barcodeFormat,
          width: barcodeWidth,
          height: currentSize.barcodeHeight,
          displayValue: true,
          fontSize: currentSize.fontSize,
          margin: 2,
          textMargin: 1,
          font: "monospace",
        });
      } catch (error) {
        console.error("Barcode generation error:", error);
        // Fallback to CODE128 if format fails
        JsBarcode(barcodeRef.current, barcodeValue, {
          format: "CODE128",
          width: 1.2,
          height: 35,
          displayValue: true,
          fontSize: 8,
          margin: 2,
        });
      }
    }
  }, [barcodeValue, barcodeFormat, labelPreset, currentSize]);

  // Handle print - tối ưu cho máy in nhiệt Xprinter
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Vui lòng cho phép popup để in");
      return;
    }

    // Truncate name based on label width
    const maxNameLength = Math.floor(currentSize.width / 3);
    const displayName =
      part.name.length > maxNameLength
        ? part.name.slice(0, maxNameLength) + "..."
        : part.name;

    // Generate labels HTML - tối ưu cho máy in nhiệt
    const labelItems = Array(quantity)
      .fill(null)
      .map(
        () => `
        <div class="label">
          ${showName
            ? `<div class="product-name">${displayName}</div>`
            : ""
          }
          ${barcodeRef.current?.outerHTML || ""}
          ${showPrice
            ? `<div class="product-price">${formatCurrency(
              part.retailPrice[currentBranchId] || 0
            )}</div>`
            : ""
          }
        </div>
      `
      );
    const labels =
      labelColumns === 1
        ? labelItems.join("")
        : Array.from(
          { length: Math.ceil(labelItems.length / labelColumns) },
          (_, rowIndex) => {
            const start = rowIndex * labelColumns;
            const rowLabels = labelItems.slice(start, start + labelColumns);
            while (rowLabels.length < labelColumns) {
              rowLabels.push('<div class="label label-empty"></div>');
            }
            return `<div class="label-sheet">${rowLabels.join("")}</div>`;
          }
        ).join("");

    // CSS tối ưu cho máy in nhiệt XP-360B - với hướng dẫn rõ ràng
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In mã vạch - ${part.name}</title>
          <style>
            /* === QUAN TRỌNG: Cài đặt @page cho máy in nhiệt === */
            @page {
              size: ${pageWidth}mm ${pageHeight}mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            
            html, body {
              width: ${pageWidth}mm;
              height: ${pageHeight * Math.ceil(quantity / labelColumns)}mm;
              margin: 0 !important;
              padding: 0 !important;
            }
            
            body {
              font-family: Arial, Helvetica, sans-serif;
              background: white;
            }
            
            .label-sheet {
              width: ${pageWidth}mm;
              height: ${pageHeight}mm;
              display: grid;
              grid-template-columns: repeat(${labelColumns}, ${currentSize.width}mm);
              page-break-after: always;
              page-break-inside: avoid;
              background: white;
            }

            .label-sheet:last-child {
              page-break-after: avoid;
            }
            
            .label {
              width: ${currentSize.width}mm;
              height: ${currentSize.height}mm;
              padding: 1mm 1.2mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              page-break-after: ${labelColumns === 1 ? "always" : "auto"};
              page-break-inside: avoid;
              box-sizing: border-box;
              background: white;
              ${labelColumns > 1 ? "outline: 0.2mm dashed #111; outline-offset: -0.2mm;" : ""}
            }

            ${labelColumns > 1 ? `
            .label + .label {
              border-left: 0.3mm solid #111;
            }
            ` : ""}
            
            .label:last-child {
              page-break-after: avoid;
            }
            
            .product-name {
              font-size: ${Math.max(8, currentSize.fontSize)}px;
              font-weight: bold;
              text-align: center;
              line-height: 1.1;
              max-width: 100%;
              overflow: hidden;
              white-space: nowrap;
              text-overflow: ellipsis;
              margin-bottom: 1mm;
            }
            
            .product-price {
              font-size: ${Math.max(10, currentSize.fontSize + 2)}px;
              font-weight: bold;
              line-height: 1;
              margin-top: 1mm;
            }
            
            svg {
              max-width: ${currentSize.width - 4}mm !important;
              height: ${currentSize.barcodeHeight}px !important;
            }
            
            /* Instructions - hidden when printing */
            .instructions {
              position: fixed;
              top: 0;
              left: ${currentSize.width + 10}mm;
              width: 280px;
              background: #fffbe6;
              border: 2px solid #ffc107;
              border-radius: 8px;
              padding: 16px;
              font-family: Arial, sans-serif;
              font-size: 13px;
              z-index: 1000;
              box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .instructions h3 {
              color: #b8860b;
              margin-bottom: 12px;
              font-size: 15px;
            }
            
            .instructions ol {
              padding-left: 20px;
              line-height: 1.8;
            }
            
            .instructions li {
              margin-bottom: 6px;
            }
            
            .instructions code {
              background: #fff3cd;
              padding: 2px 6px;
              border-radius: 4px;
              font-weight: bold;
            }
            
            @media print {
              .instructions {
                display: none !important;
              }
              
              body { 
                margin: 0 !important; 
                padding: 0 !important;
                width: ${pageWidth}mm !important;
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
            }
          </style>
        </head>
        <body>
          <!-- Hướng dẫn cài đặt -->
          <div class="instructions">
            <h3>⚙️ Hướng dẫn in nhãn:</h3>
            <ol>
              <li>Bấm <code>More settings</code> (Cài đặt khác) trong hộp thoại in</li>
              <li>Chọn <code>Paper size</code> (Khổ giấy) → <strong>${pageWidth}×${pageHeight}mm</strong></li>
              <li>Đặt <code>Margins</code> (Lề) → <strong>None</strong> (Không)</li>
              <li>Tắt <code>Headers and footers</code> (Đầu trang &amp; chân trang)</li>
              <li>Bấm <strong>Print</strong> (In)</li>
            </ol>
            <p style="margin-top: 12px; color: #666; font-size: 11px;">
              💡 Nếu không có size ${pageWidth}×${pageHeight}mm, vào Control Panel → Devices and Printers → Xprinter → Printing Preferences để thêm khổ giấy tùy chỉnh.
            </p>
          </div>
          
          <!-- Labels -->
          ${labels}
          
          <script>
            // Auto print after load
            window.onload = function() {
              // Focus on print dialog
              window.print();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              In mã vạch nội bộ
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Xprinter XP-360B (20-82mm)
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Product Info */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-lg p-3">
            <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">
              {part.name}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">
              Mã: {barcodeValue}
            </p>
            <p className="text-xs text-green-600 dark:text-green-400 font-semibold mt-1">
              {formatCurrency(part.retailPrice[currentBranchId] || 0)}
            </p>
          </div>

          {/* Preview */}
          <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col items-center bg-white">
            <p className="text-xs text-slate-500 mb-2">
              Xem trước nhãn ({currentSize.name})
            </p>
            <div
              ref={printRef}
              className="border-2 border-dashed border-slate-300 rounded flex flex-col items-center justify-center bg-white"
              style={{
                width: `${currentSize.width}mm`,
                height: `${currentSize.height}mm`,
                padding: "1mm",
              }}
            >
              {showName && (
                <p
                  className="font-bold text-center text-slate-900 truncate max-w-full leading-tight"
                  style={{ fontSize: `${currentSize.fontSize - 1}px` }}
                >
                  {part.name.length > Math.floor(currentSize.width / 3)
                    ? part.name.slice(0, Math.floor(currentSize.width / 3)) +
                    "..."
                    : part.name}
                </p>
              )}
              <svg ref={barcodeRef} className="max-w-full"></svg>
              {showPrice && (
                <p
                  className="font-bold text-slate-900 leading-tight"
                  style={{ fontSize: `${currentSize.fontSize}px` }}
                >
                  {formatCurrency(part.retailPrice[currentBranchId] || 0)}
                </p>
              )}
            </div>
          </div>

          {/* Settings */}
          <div className="space-y-3">
            {/* Label Size Preset */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Kích thước nhãn (phù hợp XP-360B)
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(Object.keys(LABEL_PRESETS) as LabelPreset[]).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => setLabelPreset(preset)}
                    className={`px-3 py-2 text-xs rounded-lg transition-colors text-left ${labelPreset === preset
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                  >
                    {LABEL_PRESETS[preset].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Quantity */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Số lượng nhãn
              </label>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <input
                  type="number"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(Math.max(1, parseInt(e.target.value) || 1))
                  }
                  className="w-16 text-center px-2 py-1 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  min="1"
                  max="100"
                />
                <button
                  onClick={() => setQuantity(Math.min(100, quantity + 1))}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Barcode Format */}
            <div className="flex items-center justify-between">
              <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                Loại mã vạch
              </label>
              <select
                value={barcodeFormat}
                onChange={(e) =>
                  setBarcodeFormat(e.target.value as BarcodeFormat)
                }
                className="px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="CODE128">CODE128 (phổ biến)</option>
                <option value="CODE39">CODE39</option>
              </select>
            </div>

            {/* Options */}
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showName}
                  onChange={(e) => setShowName(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Hiện tên
                </span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showPrice}
                  onChange={(e) => setShowPrice(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  Hiện giá
                </span>
              </label>
            </div>

            {/* Tips */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-xs text-amber-800 dark:text-amber-300">
                <strong>💡 Mẹo:</strong> Cài đặt khổ giấy trong driver máy in
                trùng với kích thước nhãn đã chọn để in chính xác.
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg transition-colors"
          >
            Đóng
          </button>
          <button
            onClick={handlePrint}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            In {quantity} nhãn
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrintBarcodeModal;
