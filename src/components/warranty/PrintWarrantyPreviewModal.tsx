import React from "react";
import { Share2, Printer, X } from "lucide-react";
import { formatDate } from "../../utils/format";
import { showToast } from "../../utils/toast";
import type { WarrantyCard } from "../../hooks/useWarrantyRepository";

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  print_paper_size_warranty?: string;
}

const PAPER_SIZE_MAP: Record<string, { width: string; pageSize: string }> = {
  "58mm": { width: "58mm", pageSize: "58mm auto" },
  "80mm": { width: "80mm", pageSize: "80mm auto" },
  "A5":   { width: "148mm", pageSize: "A5 portrait" },
  "A4":   { width: "210mm", pageSize: "A4 portrait" },
};

const resolvePaperSize = (key: string, fallback = "A5") => {
  if (PAPER_SIZE_MAP[key]) return PAPER_SIZE_MAP[key];
  const match = key.match(/^(\d+)mm$/i);
  if (match) {
    const w = `${match[1]}mm`;
    return { width: w, pageSize: `${w} auto` };
  }
  return PAPER_SIZE_MAP[fallback] || PAPER_SIZE_MAP["A5"];
};

interface PrintWarrantyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  warrantyCard: WarrantyCard | null;
  storeSettings?: StoreSettings | null;
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #dbe2ea",
  borderRadius: "3.5mm",
  padding: "3mm",
  marginBottom: "4mm",
  color: "#000",
};

const sectionTitleStyle: React.CSSProperties = {
  fontWeight: "bold",
  marginBottom: "1.5mm",
  fontSize: "10.5pt",
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  marginBottom: "1.5mm",
  fontSize: "9.5pt",
};

const labelStyle: React.CSSProperties = {
  width: "32mm",
  color: "#475569",
  flexShrink: 0,
};

const valueStyle: React.CSSProperties = {
  flex: 1,
  fontWeight: 600,
  wordBreak: "break-word" as const,
};

const getCompactCode = (card: WarrantyCard): string => {
  const raw = String(card.id || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const tail = raw.slice(-8) || "UNKNOWN";
  const d = new Date(card.created_at || card.warranty_start_date || Date.now());
  const yy = String(d.getFullYear()).slice(-2);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `BH-${yy}${mm}-${tail}`;
};

const PrintWarrantyPreviewModal: React.FC<PrintWarrantyPreviewModalProps> = ({
  isOpen,
  onClose,
  warrantyCard,
  storeSettings,
}) => {
  if (!isOpen || !warrantyCard) return null;

  const compactCode = getCompactCode(warrantyCard);
  const issueDate = formatDate(warrantyCard.created_at || warrantyCard.warranty_start_date);
  const startDate = formatDate(warrantyCard.warranty_start_date);
  const endDate = formatDate(warrantyCard.warranty_end_date);

  const coveredParts =
    Array.isArray(warrantyCard.covered_parts) && warrantyCard.covered_parts.length > 0
      ? warrantyCard.covered_parts
      : ["Toàn bộ sản phẩm theo chính sách cửa hàng"];

  const isMobileDevice =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)").matches;

  const paperSizeKey = storeSettings?.print_paper_size_warranty || "A5";
  const paperSize = resolvePaperSize(paperSizeKey, "A5");

  const getReceiptFileName = () =>
    `Phieu_${compactCode}.png`;

  const createReceiptImageBlob = async (): Promise<Blob | null> => {
    const html2canvas = (await import("html2canvas")).default;
    const element = document.getElementById("warranty-print-preview-content");

    if (!element) {
      showToast.error("Không tìm thấy nội dung phiếu!");
      return null;
    }

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
      allowTaint: true,
      logging: false,
      width: element.scrollWidth,
      height: element.scrollHeight,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (value) => {
          if (value) resolve(value);
          else reject(new Error("Canvas toBlob returned null"));
        },
        "image/png",
        1.0
      );
    });
  };

  const shareReceiptImage = async (blob: Blob, fileName: string) => {
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: "image/png" });
      const shareData = {
        files: [file],
        title: `Phiếu bảo hành ${compactCode}`,
        text: "In phiếu bảo hành qua ứng dụng máy in Bluetooth/LAN",
      };

      if (navigator.canShare(shareData)) {
        await navigator.share(shareData);
        return true;
      }
    }

    return false;
  };

  const downloadReceiptImage = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleShare = async () => {
    try {
      showToast.info("Đang tạo hình ảnh...");
      const blob = await createReceiptImageBlob();
      if (!blob) return;

      const fileName = getReceiptFileName();
      if (await shareReceiptImage(blob, fileName)) {
        showToast.success("Đã mở chia sẻ phiếu!");
        return;
      }

      downloadReceiptImage(blob, fileName);
      showToast.success("Đã tải hình ảnh!");
    } catch (error) {
      console.error("Share failed:", error);
      showToast.error("Không thể chia sẻ. Vui lòng thử lại!");
    }
  };

  const printViaIframe = async (blob: Blob) => {
    try {
      const url = URL.createObjectURL(blob);
      const existingIframe = document.getElementById("warranty-print-iframe");
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement("iframe");
      iframe.id = "warranty-print-iframe";
      iframe.style.position = "fixed";
      iframe.style.top = "-9999px";
      iframe.style.left = "-9999px";
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      document.body.appendChild(iframe);

      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) {
        URL.revokeObjectURL(url);
        return false;
      }

      iframeDoc.open();
      iframeDoc.write(`<!doctype html><html><head><title>Print</title>
        <style>
          @page { size: ${paperSize.pageSize}; margin: 10mm; }
          body { margin: 0; padding: 0; display: flex; justify-content: center; }
          img { max-width: 100%; height: auto; }
          @media print {
            body { margin: 0; padding: 0; }
            img { max-width: ${paperSize.width}; }
          }
        </style>
      </head><body><img src="${url}" onload="setTimeout(function(){ window.print(); }, 300);" /></body></html>`);
      iframeDoc.close();

      setTimeout(() => {
        iframe.remove();
        URL.revokeObjectURL(url);
      }, 10000);

      return true;
    } catch (err) {
      console.error("printViaIframe failed:", err);
      return false;
    }
  };

  const handleDesktopPrint = () => {
    const element = document.getElementById("warranty-print-preview-content");
    if (!element) return;

    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      showToast.error("Trình duyệt đã chặn cửa sổ in. Vui lòng cho phép popup.");
      return;
    }

    printWindow.document.open();
    printWindow.document.write(`<!doctype html><html><head><title>Phiếu bảo hành - ${compactCode}</title>
      <style>
        @page { size: ${paperSize.pageSize}; margin: 10mm; }
        body { margin: 20px; font-family: Arial, Helvetica, sans-serif; }
      </style>
    </head><body>${element.innerHTML}
      <script>window.onload = function(){ window.print(); window.onafterprint = function(){ window.close(); }; };</script>
    </body></html>`);
    printWindow.document.close();
  };

  const handleMobilePrint = async () => {
    if (!isMobileDevice) {
      handleDesktopPrint();
      return;
    }

    try {
      showToast.info("Đang chuẩn bị phiếu cho máy in...");
      const blob = await createReceiptImageBlob();
      if (!blob) return;

      const fileName = getReceiptFileName();

      // Strategy 1: Try Web Share API
      try {
        if (await shareReceiptImage(blob, fileName)) {
          showToast.info("Chọn ứng dụng máy in Bluetooth/LAN để in.");
          return;
        }
      } catch (shareErr) {
        console.warn("Share API failed, trying iframe print:", shareErr);
      }

      // Strategy 2: Try printing via hidden iframe
      try {
        if (await printViaIframe(blob)) {
          showToast.info("Đang mở hộp thoại in...");
          return;
        }
      } catch (iframeErr) {
        console.warn("Iframe print failed, downloading:", iframeErr);
      }

      // Strategy 3: Fallback - just download the image
      downloadReceiptImage(blob, fileName);
      showToast.info("Đã tải ảnh phiếu. Mở ảnh bằng ứng dụng máy in để in.");
    } catch (error) {
      console.error("Mobile print failed:", error);
      showToast.error("Không thể in trên điện thoại. Thử nút Chia sẻ hoặc In hệ thống.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-2 md:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Xem trước phiếu bảo hành
          </h2>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <button
              onClick={handleShare}
              className="inline-flex items-center gap-1.5 rounded-lg bg-green-600 px-3 py-1.5 text-sm text-white transition hover:bg-green-700"
            >
              <Share2 className="h-4 w-4" />
              Chia sẻ
            </button>

            <button
              onClick={handleMobilePrint}
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white transition hover:bg-blue-700"
            >
              <Printer className="h-4 w-4" />
              {isMobileDevice ? "In ĐT" : "In phiếu"}
            </button>

            {isMobileDevice && (
              <button
                onClick={handleDesktopPrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-1.5 text-sm text-white transition hover:bg-slate-700"
                title="Dùng hộp thoại in của trình duyệt nếu điện thoại hỗ trợ"
              >
                <Printer className="h-4 w-4" />
                In hệ thống
              </button>
            )}

            <button
              onClick={onClose}
              className="rounded-lg bg-slate-100 p-1.5 text-slate-400 hover:text-slate-600 dark:bg-slate-700 dark:hover:text-slate-300"
              aria-label="Đóng"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Preview Content */}
        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 dark:bg-slate-900">
          <div className="flex justify-center">
            <div
              id="warranty-print-preview-content"
              className="relative flex-shrink-0 bg-white shadow-lg"
              style={{
                width: paperSize.width,
                minHeight: "auto",
                color: "#000000",
                backgroundColor: "#ffffff",
              }}
            >
              <div style={{ padding: "14px" }}>
                {/* Header */}
                <div
                  style={{
                    borderBottom: "2px solid #0f766e",
                    paddingBottom: "3mm",
                    marginBottom: "4mm",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "3mm",
                          marginBottom: "2mm",
                        }}
                      >
                        {storeSettings?.logo_url && (
                          <div
                            style={{
                              width: "16mm",
                              height: "16mm",
                              borderRadius: "999px",
                              border: "1px solid #bfdbfe",
                              background:
                                "linear-gradient(180deg, #ffffff 0%, #f0fdfa 100%)",
                              boxShadow: "0 1.5mm 3mm rgba(15, 118, 110, 0.12)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              padding: "1.5mm",
                              flexShrink: 0,
                            }}
                          >
                            <img
                              src={storeSettings.logo_url}
                              alt="Logo"
                              style={{
                                maxWidth: "100%",
                                maxHeight: "100%",
                                objectFit: "contain",
                              }}
                            />
                          </div>
                        )}
                        <div>
                          <div
                            style={{
                              fontWeight: "bold",
                              fontSize: "13pt",
                              lineHeight: "1.15",
                              color: "#0f172a",
                            }}
                          >
                            {storeSettings?.store_name || "MotoCare"}
                          </div>
                          <div
                            style={{
                              fontSize: "8pt",
                              color: "#334155",
                              lineHeight: "1.45",
                            }}
                          >
                            {storeSettings?.address || "-"}
                          </div>
                          <div
                            style={{
                              fontSize: "8pt",
                              color: "#334155",
                            }}
                          >
                            Hotline: {storeSettings?.phone || "-"}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div
                        style={{
                          fontSize: "16pt",
                          fontWeight: "bold",
                          color: "#0f766e",
                          letterSpacing: "0.4px",
                          marginBottom: "2mm",
                        }}
                      >
                        PHIẾU BẢO HÀNH
                      </div>
                      <div
                        style={{
                          fontSize: "8.5pt",
                          color: "#64748b",
                          lineHeight: "1.5",
                        }}
                      >
                        Mã phiếu: {compactCode}
                        <br />
                        Ngày cấp: {issueDate}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Customer Info */}
                <div style={cardStyle}>
                  <div style={sectionTitleStyle}>Thông tin khách hàng</div>
                  <div style={rowStyle}>
                    <div style={labelStyle}>Khách hàng</div>
                    <div style={valueStyle}>
                      {warrantyCard.customer_name || "Khách lẻ"}
                    </div>
                  </div>
                  <div style={{ ...rowStyle, marginBottom: 0 }}>
                    <div style={labelStyle}>Số điện thoại</div>
                    <div style={valueStyle}>
                      {warrantyCard.customer_phone || "-"}
                    </div>
                  </div>
                </div>

                {/* Product Info */}
                <div style={cardStyle}>
                  <div style={sectionTitleStyle}>Thông tin sản phẩm</div>
                  <div style={rowStyle}>
                    <div style={labelStyle}>Thiết bị/Model</div>
                    <div style={valueStyle}>{warrantyCard.device_model}</div>
                  </div>
                  <div style={rowStyle}>
                    <div style={labelStyle}>IMEI/Serial</div>
                    <div style={valueStyle}>
                      {warrantyCard.imei_serial || "-"}
                    </div>
                  </div>
                  <div style={rowStyle}>
                    <div style={labelStyle}>Thời hạn</div>
                    <div style={valueStyle}>
                      {warrantyCard.warranty_period_months} tháng
                    </div>
                  </div>
                  <div style={{ ...rowStyle, marginBottom: 0 }}>
                    <div style={labelStyle}>Hiệu lực</div>
                    <div style={valueStyle}>
                      Từ {startDate} đến {endDate}
                    </div>
                  </div>
                </div>

                {/* Covered Parts */}
                <div style={cardStyle}>
                  <div style={sectionTitleStyle}>Phạm vi bảo hành</div>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: "5mm",
                      fontSize: "9.5pt",
                    }}
                  >
                    {coveredParts.map((part, idx) => (
                      <li key={idx} style={{ marginBottom: "1mm" }}>
                        {part}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Coverage Terms */}
                <div style={cardStyle}>
                  <div style={sectionTitleStyle}>Điều kiện bảo hành</div>
                  <div
                    style={{
                      fontSize: "9pt",
                      color: "#334155",
                      lineHeight: "1.5",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {warrantyCard.coverage_terms ||
                      "Không áp dụng với hư hỏng do rơi vỡ, ngấm nước, cháy nổ, hoặc tự ý can thiệp sửa chữa."}
                  </div>
                </div>

                {/* Signatures */}
                <div
                  style={{
                    marginTop: "6mm",
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: "20px",
                    textAlign: "center",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "10pt",
                        marginBottom: "2mm",
                      }}
                    >
                      Khách hàng
                    </div>
                    <div style={{ height: "20mm" }}></div>
                    <div style={{ fontSize: "8.5pt", color: "#475569" }}>
                      (Ký, ghi rõ họ tên)
                    </div>
                  </div>
                  <div>
                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "10pt",
                        marginBottom: "2mm",
                      }}
                    >
                      Cửa hàng
                    </div>
                    <div style={{ height: "20mm" }}></div>
                    <div style={{ fontSize: "8.5pt", color: "#475569" }}>
                      (Ký, đóng dấu)
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintWarrantyPreviewModal;
