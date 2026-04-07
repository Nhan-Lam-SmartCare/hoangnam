import React, { useRef, useEffect, useState, useMemo } from "react";
import {
  X,
  Printer,
  Search,
  Check,
  Package,
  Filter,
  Eye,
  ChevronLeft,
  ChevronRight,
  Edit3,
} from "lucide-react";
import JsBarcode from "jsbarcode";
import { Part } from "../../types";
import { formatCurrency } from "../../utils/format";

interface BatchPrintBarcodeModalProps {
  parts: Part[];
  currentBranchId: string;
  onClose: () => void;
  initialQuantities?: Record<string, number>;
}

type BarcodeFormat = "CODE128" | "CODE39";
type LabelPreset = "30x20" | "40x30" | "50x30" | "60x40" | "80x50" | "100x80";
type QuantityMode = "stock" | "fixed" | "custom";
type ViewMode = "select" | "preview";

const LABEL_PRESETS: Record<
  LabelPreset,
  {
    width: number;
    height: number;
    name: string;
    barcodeHeight: number;
    fontSize: number;
  }
> = {
  "30x20": {
    width: 30,
    height: 20,
    name: "30×20mm",
    barcodeHeight: 22,
    fontSize: 10, // Increased from 7
  },
  "40x30": {
    width: 40,
    height: 30,
    name: "40×30mm",
    barcodeHeight: 32,
    fontSize: 12, // Increased from 8
  },
  "50x30": {
    width: 50,
    height: 30,
    name: "50×30mm",
    barcodeHeight: 35,
    fontSize: 13, // Increased from 9
  },
  "60x40": {
    width: 60,
    height: 40,
    name: "60×40mm",
    barcodeHeight: 40,
    fontSize: 14, // Increased from 10
  },
  "80x50": {
    width: 80,
    height: 50,
    name: "80×50mm",
    barcodeHeight: 50,
    fontSize: 16, // Increased from 12
  },
  "100x80": {
    width: 100,
    height: 80,
    name: "100×80mm",
    barcodeHeight: 65,
    fontSize: 18, // Increased from 14
  },
};

// Barcode Preview Component
const BarcodePreview: React.FC<{
  value: string;
  format: BarcodeFormat;
  size: (typeof LABEL_PRESETS)["40x30"];
}> = ({ value, format, size }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (svgRef.current) {
      try {
        JsBarcode(svgRef.current, value, {
          format: format,
          width: 1.5,
          height: size.barcodeHeight,
          displayValue: true,
          fontSize: size.fontSize,
          margin: 2,
          textMargin: 1,
          font: "monospace",
        });
      } catch {
        JsBarcode(svgRef.current, value, {
          format: "CODE128",
          width: 1.2,
          height: 35,
          displayValue: true,
          fontSize: 8,
          margin: 2,
        });
      }
    }
  }, [value, format, size]);

  return <svg ref={svgRef} className="max-w-full h-auto" />;
};

interface SelectedPart {
  part: Part;
  quantity: number;
}

const BatchPrintBarcodeModal: React.FC<BatchPrintBarcodeModalProps> = ({
  parts,
  currentBranchId,
  onClose,
  initialQuantities,
}) => {
  // View mode
  const [viewMode, setViewMode] = useState<ViewMode>("select");

  // Selection state
  const [selectedParts, setSelectedParts] = useState<Map<string, SelectedPart>>(
    new Map()
  );

  // Initialize from initialQuantities if provided
  useEffect(() => {
    if (initialQuantities && Object.keys(initialQuantities).length > 0) {
      const newSelected = new Map<string, SelectedPart>();
      parts.forEach((part) => {
        const qty = initialQuantities[part.id];
        if (qty !== undefined && qty > 0) {
          newSelected.set(part.id, { part, quantity: qty });
        }
      });
      if (newSelected.size > 0) {
        setSelectedParts(newSelected);
        setQuantityMode("custom");
      }
    }
  }, [parts, initialQuantities]);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Print settings
  const [labelPreset, setLabelPreset] = useState<LabelPreset>("40x30");
  const [barcodeFormat, setBarcodeFormat] = useState<BarcodeFormat>("CODE128");
  const [showPrice, setShowPrice] = useState(true);
  const [showName, setShowName] = useState(true);
  const [quantityMode, setQuantityMode] = useState<QuantityMode>(
    initialQuantities ? "custom" : "stock"
  );
  const [fixedQuantity, setFixedQuantity] = useState(1);
  const [rotateLabel, setRotateLabel] = useState(false); // Xoay 90° cho cuộn giấy nằm ngang

  // Preview pagination
  const [previewPage, setPreviewPage] = useState(0);
  const labelsPerPage = 6; // Show 6 labels per page in preview

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    parts.forEach((p) => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats).sort();
  }, [parts]);

  // Filter parts
  const filteredParts = useMemo(() => {
    return parts.filter((p) => {
      const matchSearch =
        !searchTerm ||
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.barcode?.toLowerCase().includes(searchTerm.toLowerCase());

      const matchCategory =
        filterCategory === "all" || p.category === filterCategory;

      return matchSearch && matchCategory;
    });
  }, [parts, searchTerm, filterCategory]);

  // Get stock for a part
  const getStock = (part: Part) => part.stock[currentBranchId] || 0;

  // Toggle part selection
  const togglePart = (part: Part) => {
    const newSelected = new Map(selectedParts);
    if (newSelected.has(part.id)) {
      newSelected.delete(part.id);
    } else {
      const qty =
        quantityMode === "stock"
          ? Math.max(1, getStock(part))
          : quantityMode === "fixed"
            ? fixedQuantity
            : 1;
      newSelected.set(part.id, { part, quantity: qty });
    }
    setSelectedParts(newSelected);
  };

  // Select all filtered parts
  const selectAll = () => {
    const newSelected = new Map(selectedParts);
    filteredParts.forEach((part) => {
      if (!newSelected.has(part.id)) {
        const qty =
          quantityMode === "stock"
            ? Math.max(1, getStock(part))
            : quantityMode === "fixed"
              ? fixedQuantity
              : 1;
        newSelected.set(part.id, { part, quantity: qty });
      }
    });
    setSelectedParts(newSelected);
  };

  // Deselect all
  const deselectAll = () => {
    setSelectedParts(new Map());
  };

  // Update quantity for a selected part
  const updateQuantity = (partId: string, quantity: number) => {
    const newSelected = new Map(selectedParts);
    const item = newSelected.get(partId);
    if (item) {
      newSelected.set(partId, { ...item, quantity: Math.max(1, quantity) });
      setSelectedParts(newSelected);
    }
  };

  // Apply quantity mode to all selected
  const applyQuantityMode = () => {
    const newSelected = new Map<string, SelectedPart>();
    selectedParts.forEach((item, id) => {
      const qty =
        quantityMode === "stock"
          ? Math.max(1, getStock(item.part))
          : quantityMode === "fixed"
            ? fixedQuantity
            : item.quantity;
      newSelected.set(id, { ...item, quantity: qty });
    });
    setSelectedParts(newSelected);
  };

  // Total labels count
  const totalLabels = useMemo(() => {
    let total = 0;
    selectedParts.forEach((item) => {
      total += item.quantity;
    });
    return total;
  }, [selectedParts]);

  // Generate all labels for preview
  const allLabels = useMemo(() => {
    const labels: Array<{ part: Part; index: number }> = [];
    selectedParts.forEach(({ part, quantity }) => {
      for (let i = 0; i < quantity; i++) {
        labels.push({ part, index: i });
      }
    });
    return labels;
  }, [selectedParts]);

  // Paginated labels for preview
  const paginatedLabels = useMemo(() => {
    const start = previewPage * labelsPerPage;
    return allLabels.slice(start, start + labelsPerPage);
  }, [allLabels, previewPage, labelsPerPage]);

  const totalPreviewPages = Math.ceil(allLabels.length / labelsPerPage);

  const currentSize = LABEL_PRESETS[labelPreset];

  // Generate barcode SVG string
  const generateBarcodeSVG = (value: string, rotate: boolean = false): string => {
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    try {
      JsBarcode(svg, value, {
        format: barcodeFormat,
        width: Math.max(1, (currentSize.width - 10) / 50),
        height: currentSize.barcodeHeight,
        displayValue: true,
        fontSize: currentSize.fontSize,
        margin: 2,
        textMargin: 1,
        font: "monospace",
      });
    } catch {
      JsBarcode(svg, value, {
        format: "CODE128",
        width: 1.2,
        height: 35,
        displayValue: true,
        fontSize: 8,
        margin: 2,
      });
    }

    // Apply rotation directly to SVG if needed
    if (rotate) {
      const svgWidth = svg.getAttribute('width') || '100';
      const svgHeight = svg.getAttribute('height') || '50';
      // Wrap content in a group with rotation transform
      const innerContent = svg.innerHTML;
      svg.innerHTML = `<g transform="rotate(-90, ${parseFloat(svgWidth) / 2}, ${parseFloat(svgHeight) / 2})">${innerContent}</g>`;
      // Swap width and height for rotated SVG
      svg.setAttribute('width', svgHeight);
      svg.setAttribute('height', svgWidth);
      svg.setAttribute('viewBox', `0 0 ${svgHeight} ${svgWidth}`);
    }

    return svg.outerHTML;
  };

  // Handle batch print
  const handlePrint = () => {
    if (selectedParts.size === 0) {
      alert("Vui lòng chọn ít nhất 1 sản phẩm");
      return;
    }

    // Show confirmation with printer settings reminder FIRST
    const confirmed = confirm(
      `⚠️ HƯỚNG DẪN IN MÁY IN NHIỆT XPRINTER\n\n` +
      `📌 QUAN TRỌNG: Khi hộp thoại in xuất hiện:\n` +
      `→ Nhấn Ctrl+Shift+P để mở System Dialog\n` +
      `→ Hoặc bấm "Print using system dialog..."\n\n` +
      `Kích thước nhãn: ${currentSize.width}×${currentSize.height}mm\n\n` +
      `Cài đặt Xprinter (đã cấu hình):\n` +
      `→ Stock: ${currentSize.width}mm × ${currentSize.height}mm\n` +
      `→ Orientation: Portrait/Landscape tùy cuộn giấy\n\n` +
      `Bấm OK để tiếp tục.`
    );

    if (!confirmed) return;

    // Open print window AFTER confirmation
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Vui lòng cho phép popup để in");
      return;
    }

    // Generate all labels
    let labelsHTML = "";
    selectedParts.forEach(({ part, quantity }) => {
      const barcodeValue = part.barcode || part.sku || part.id.slice(0, 12);
      const barcodeSVG = generateBarcodeSVG(barcodeValue);

      for (let i = 0; i < quantity; i++) {
        // When rotateLabel is true, we keep the content horizontal (no rotation)
        // because the printer will handle the orientation
        // The page size is already swapped (30x40 instead of 40x30)

        labelsHTML += `
          <div class="label">
            <div class="label-content">
              ${showName ? `<div class="label-name">${part.name}</div>` : ""}
              ${barcodeSVG}
              ${showPrice ? `<div class="label-price">${formatCurrency(part.retailPrice[currentBranchId] || 0)}</div>` : ""}
            </div>
          </div>
        `;
      }
    });

    // Calculate dimensions based on rotation
    const pageWidth = rotateLabel ? currentSize.height : currentSize.width;
    const pageHeight = rotateLabel ? currentSize.width : currentSize.height;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In mã vạch hàng loạt - ${selectedParts.size} sản phẩm</title>
          <style>
            @page {
              size: ${pageWidth}mm ${pageHeight}mm;
              margin: 0;
            }
            * { 
              margin: 0; 
              padding: 0; 
              box-sizing: border-box; 
            }
            html, body {
              width: ${pageWidth}mm;
              height: ${pageHeight}mm;
              margin: 0;
              padding: 0;
            }
            body {
              font-family: Arial, sans-serif;
            }
            .label {
              width: ${pageWidth}mm;
              height: ${pageHeight}mm;
              padding: 0;
              display: flex;
              align-items: center;
              justify-content: center;
              box-sizing: border-box;
              overflow: hidden;
              page-break-after: always;
              page-break-inside: avoid;
            }
            .label:last-child {
              page-break-after: avoid;
            }
            .label-content {
              width: ${currentSize.width}mm;
              height: ${currentSize.height}mm;
              padding: 1mm;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              ${rotateLabel ? 'transform: rotate(-90deg); transform-origin: center center;' : ''}
            }
            .label-name {
              font-size: ${Math.max(7, currentSize.fontSize - 1)}px;
              font-weight: bold;
              text-align: center;
              line-height: 1.2;
              max-width: 100%;
              overflow: hidden;
              display: -webkit-box;
              -webkit-line-clamp: 2;
              -webkit-box-orient: vertical;
              word-break: break-word;
              margin-bottom: 1px;
            }
            .label-price {
              font-size: ${currentSize.fontSize}px;
              font-weight: bold;
              line-height: 1;
              margin-top: 1px;
            }
            svg { 
              max-width: ${currentSize.width - 4}mm !important; 
              height: auto !important; 
            }
            @media print {
              html, body {
                width: ${pageWidth}mm !important;
                height: ${pageHeight}mm !important;
              }
              body { 
                -webkit-print-color-adjust: exact; 
                print-color-adjust: exact; 
              }
              .label-content {
                ${rotateLabel ? `
                  transform: rotate(-90deg) !important;
                  transform-origin: center center !important;
                ` : ''}
              }
            }
            /* Screen only: Show print instructions */
            @media screen {
              .print-info {
                background: #fffbeb;
                border: 2px solid #f59e0b;
                padding: 16px;
                margin: 16px;
                border-radius: 8px;
                font-size: 14px;
                line-height: 1.6;
              }
              .print-info h3 {
                color: #b45309;
                margin-bottom: 8px;
              }
              .print-info code {
                background: #fef3c7;
                padding: 2px 6px;
                border-radius: 4px;
                font-weight: bold;
              }
            }
            @media print {
              .print-info { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="print-info">
            <h3>⚠️ Trước khi in, kiểm tra cài đặt:</h3>
            <p><strong>Khổ giấy:</strong> <code>${currentSize.width}×${currentSize.height}mm</code></p>
            <p><strong>Lề:</strong> Không</p>
            <p><strong>Tỷ lệ:</strong> 100%</p>
            <p style="margin-top:8px">Phần này sẽ không được in ra.</p>
          </div>
          ${labelsHTML}
          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
                window.onafterprint = function() { window.close(); };
              }, 500);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2 md:p-4">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
              <Printer className="w-5 h-5 text-blue-600" />
              In mã vạch hàng loạt
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {viewMode === "select"
                ? "Bước 1: Chọn sản phẩm và cài đặt"
                : "Bước 2: Xem trước và chỉnh sửa"}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex bg-slate-100 dark:bg-slate-700 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("select")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${viewMode === "select"
                  ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                  }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                Chọn SP
              </button>
              <button
                onClick={() => {
                  setViewMode("preview");
                  setPreviewPage(0);
                }}
                disabled={selectedParts.size === 0}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center gap-1.5 ${viewMode === "preview"
                  ? "bg-white dark:bg-slate-600 text-blue-600 dark:text-blue-400 shadow-sm"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  }`}
              >
                <Eye className="w-3.5 h-3.5" />
                Xem trước
              </button>
            </div>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        {viewMode === "select" ? (
          /* Selection View */
          <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
            {/* Left: Product Selection */}
            <div className="flex-1 flex flex-col border-r border-slate-200 dark:border-slate-700 overflow-hidden">
              {/* Search & Filter */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-2 shrink-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm sản phẩm, SKU, mã vạch..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                </div>
                <div className="flex gap-2">
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="flex-1 px-3 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  >
                    <option value="all">Tất cả danh mục</option>
                    {categories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={selectAll}
                    className="px-3 py-1.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50"
                  >
                    Chọn tất cả
                  </button>
                  <button
                    onClick={deselectAll}
                    className="px-3 py-1.5 text-xs bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600"
                  >
                    Bỏ chọn
                  </button>
                </div>
              </div>

              {/* Parts List */}
              <div className="flex-1 overflow-y-auto p-2">
                {filteredParts.length === 0 ? (
                  <div className="text-center py-8 text-slate-500">
                    Không tìm thấy sản phẩm
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredParts.map((part) => {
                      const isSelected = selectedParts.has(part.id);
                      const stock = getStock(part);
                      return (
                        <div
                          key={part.id}
                          onClick={() => togglePart(part)}
                          className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected
                            ? "bg-blue-50 dark:bg-blue-900/30 border border-blue-300 dark:border-blue-700"
                            : "bg-slate-50 dark:bg-slate-900/50 border border-transparent hover:bg-slate-100 dark:hover:bg-slate-700"
                            }`}
                        >
                          <div
                            className={`w-5 h-5 rounded flex items-center justify-center shrink-0 ${isSelected
                              ? "bg-blue-600 text-white"
                              : "border-2 border-slate-300 dark:border-slate-600"
                              }`}
                          >
                            {isSelected && <Check className="w-3 h-3" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">
                              {part.name}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                              {part.barcode || part.sku}
                            </p>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                              Tồn kho
                            </p>
                            <p
                              className={`text-sm font-bold ${stock > 0 ? "text-green-600" : "text-red-500"
                                }`}
                            >
                              {stock}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Settings & Selected */}
            <div className="w-full md:w-80 flex flex-col overflow-hidden">
              {/* Settings */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-700 space-y-3 shrink-0">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Cài đặt in
                </h3>

                {/* Quantity Mode */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Số lượng nhãn
                  </label>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setQuantityMode("stock");
                      }}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${quantityMode === "stock"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                    >
                      = Tồn kho
                    </button>
                    <button
                      onClick={() => {
                        setQuantityMode("fixed");
                      }}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${quantityMode === "fixed"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                    >
                      Cố định
                    </button>
                    <button
                      onClick={() => {
                        setQuantityMode("custom");
                      }}
                      className={`flex-1 px-2 py-1.5 text-xs rounded-lg ${quantityMode === "custom"
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                        }`}
                    >
                      Tùy chỉnh
                    </button>
                  </div>
                  {quantityMode === "fixed" && (
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-xs text-slate-500">Mỗi SP in:</span>
                      <input
                        type="number"
                        value={fixedQuantity}
                        onChange={(e) =>
                          setFixedQuantity(
                            Math.max(1, parseInt(e.target.value) || 1)
                          )
                        }
                        className="w-16 px-2 py-1 text-sm text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                        min="1"
                      />
                      <span className="text-xs text-slate-500">nhãn</span>
                    </div>
                  )}
                  {selectedParts.size > 0 && quantityMode !== "custom" && (
                    <button
                      onClick={applyQuantityMode}
                      className="mt-2 w-full px-2 py-1 text-xs bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded hover:bg-amber-200"
                    >
                      Áp dụng cho {selectedParts.size} SP đã chọn
                    </button>
                  )}
                </div>

                {/* Label Size */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                    Kích thước nhãn
                  </label>
                  <select
                    value={labelPreset}
                    onChange={(e) =>
                      setLabelPreset(e.target.value as LabelPreset)
                    }
                    className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700"
                  >
                    {Object.entries(LABEL_PRESETS).map(([key, val]) => (
                      <option key={key} value={key}>
                        {val.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Options */}
                <div className="flex flex-wrap gap-3">
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showName}
                      onChange={(e) => setShowName(e.target.checked)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      Tên
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showPrice}
                      onChange={(e) => setShowPrice(e.target.checked)}
                      className="w-3.5 h-3.5 rounded"
                    />
                    <span className="text-xs text-slate-700 dark:text-slate-300">
                      Giá
                    </span>
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer" title="Xoay 90° khi cuộn giấy nằm ngang">
                    <input
                      type="checkbox"
                      checked={rotateLabel}
                      onChange={(e) => setRotateLabel(e.target.checked)}
                      className="w-3.5 h-3.5 rounded accent-orange-500"
                    />
                    <span className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                      Xoay 90°
                    </span>
                  </label>
                </div>
              </div>

              {/* Selected Parts */}
              <div className="flex-1 overflow-y-auto p-2">
                <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 mb-2 px-1">
                  Đã chọn: {selectedParts.size} SP • {totalLabels} nhãn
                </h3>
                {selectedParts.size === 0 ? (
                  <div className="text-center py-4 text-slate-400 text-xs">
                    <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    Chưa chọn sản phẩm nào
                  </div>
                ) : (
                  <div className="space-y-1">
                    {Array.from(selectedParts.values()).map(
                      ({ part, quantity }) => (
                        <div
                          key={part.id}
                          className="flex items-center gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-900 dark:text-slate-100 truncate">
                              {part.name}
                            </p>
                          </div>
                          {quantityMode === "custom" ? (
                            <input
                              type="number"
                              value={quantity}
                              onChange={(e) =>
                                updateQuantity(
                                  part.id,
                                  parseInt(e.target.value) || 1
                                )
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-14 px-1 py-0.5 text-xs text-center border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                              min="1"
                            />
                          ) : (
                            <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                              ×{quantity}
                            </span>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePart(part);
                            }}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          /* Preview View */
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Preview Settings Bar */}
            <div className="p-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-3 shrink-0 bg-slate-50 dark:bg-slate-900/50">
              <div className="flex items-center gap-2">
                <label className="text-xs font-medium text-slate-600 dark:text-slate-400">
                  Kích thước:
                </label>
                <select
                  value={labelPreset}
                  onChange={(e) =>
                    setLabelPreset(e.target.value as LabelPreset)
                  }
                  className="px-2 py-1 text-sm border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                >
                  {Object.entries(LABEL_PRESETS).map(([key, val]) => (
                    <option key={key} value={key}>
                      {val.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showName}
                    onChange={(e) => setShowName(e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Tên SP
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPrice}
                    onChange={(e) => setShowPrice(e.target.checked)}
                    className="w-3.5 h-3.5 rounded"
                  />
                  <span className="text-xs text-slate-700 dark:text-slate-300">
                    Giá
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded" title="Xoay 90° cho cuộn giấy nằm ngang">
                  <input
                    type="checkbox"
                    checked={rotateLabel}
                    onChange={(e) => setRotateLabel(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-orange-500"
                  />
                  <span className="text-xs text-orange-700 dark:text-orange-300 font-medium">
                    🔄 Xoay 90°
                  </span>
                </label>
              </div>
              <div className="ml-auto text-xs text-slate-500 dark:text-slate-400">
                Tổng:{" "}
                <span className="font-bold text-blue-600">{totalLabels}</span>{" "}
                nhãn
              </div>
            </div>

            {/* Preview Grid */}
            <div className="flex-1 overflow-y-auto p-4 bg-slate-100 dark:bg-slate-900">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
                {paginatedLabels.map(({ part, index }) => {
                  const barcodeValue =
                    part.barcode || part.sku || part.id.slice(0, 12);

                  return (
                    <div
                      key={`${part.id}-${index}`}
                      className="bg-white dark:bg-slate-800 rounded-lg shadow-md p-2 flex flex-col items-center justify-center border-2 border-dashed border-slate-300 dark:border-slate-600"
                      style={{
                        minHeight: `${currentSize.height * 2.5}px`,
                        aspectRatio: `${currentSize.width}/${currentSize.height}`,
                      }}
                    >
                      {showName && (
                        <p
                          className="text-xs font-bold text-slate-900 dark:text-slate-100 text-center w-full mb-1 line-clamp-2 leading-tight"
                          style={{
                            fontSize: `${Math.max(
                              9,
                              currentSize.fontSize - 1
                            )}px`,
                          }}
                        >
                          {part.name}
                        </p>
                      )}
                      <BarcodePreview
                        value={barcodeValue}
                        format={barcodeFormat}
                        size={currentSize}
                      />
                      {showPrice && (
                        <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-1">
                          {formatCurrency(
                            part.retailPrice[currentBranchId] || 0
                          )}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Preview Pagination */}
            {totalPreviewPages > 1 && (
              <div className="flex items-center justify-center gap-3 p-3 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                <button
                  onClick={() => setPreviewPage((p) => Math.max(0, p - 1))}
                  disabled={previewPage === 0}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Trang <span className="font-bold">{previewPage + 1}</span> /{" "}
                  {totalPreviewPages}
                </span>
                <button
                  onClick={() =>
                    setPreviewPage((p) =>
                      Math.min(totalPreviewPages - 1, p + 1)
                    )
                  }
                  disabled={previewPage >= totalPreviewPages - 1}
                  className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-200 dark:hover:bg-slate-600"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-slate-200 dark:border-slate-700 shrink-0">
          <div className="text-sm text-slate-600 dark:text-slate-400">
            <span className="font-semibold text-blue-600">
              {selectedParts.size}
            </span>{" "}
            sản phẩm •
            <span className="font-semibold text-green-600 ml-1">
              {totalLabels}
            </span>{" "}
            nhãn
          </div>
          <div className="flex gap-3">
            {viewMode === "select" ? (
              <>
                <button
                  onClick={onClose}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg"
                >
                  Đóng
                </button>
                <button
                  onClick={() => {
                    setViewMode("preview");
                    setPreviewPage(0);
                  }}
                  disabled={selectedParts.size === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
                >
                  <Eye className="w-4 h-4" />
                  Xem trước ({totalLabels})
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setViewMode("select")}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg flex items-center gap-2"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Quay lại chỉnh sửa
                </button>
                <button
                  onClick={handlePrint}
                  disabled={selectedParts.size === 0}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 disabled:bg-slate-400 disabled:cursor-not-allowed rounded-lg flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  In {totalLabels} nhãn
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BatchPrintBarcodeModal;
