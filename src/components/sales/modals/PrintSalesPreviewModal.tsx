import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Share2, Printer, X } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import { showToast } from "../../../utils/toast";
import { shareBlobNative } from "../../../utils/nativeShare";
import { getDynamicQrUrl } from "../../service/utils/service.utils";
import type { CartItem } from "../../../types";

export interface PrintSalesPayload {
  customer: { name: string; phone?: string };
  items: CartItem[];
  subtotalValue: number;
  discountValue: number;
  totalValue: number;
  payment: "cash" | "bank";
  noteText?: string;
  dateValue?: string;
  saleId?: string;
}

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  bank_qr_url?: string;
  bank_name?: string;
  bank_account_number?: string;
  bank_account_holder?: string;
  bank_branch?: string;
  print_paper_size_sales?: string;
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

interface PrintSalesPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  printPayload: PrintSalesPayload | null;
  storeSettings?: StoreSettings;
  onPrint: () => void;
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #dbe2ea",
  borderRadius: "3.5mm",
  padding: "3mm",
  marginBottom: "4mm",
  color: "#000",
  fontSize: "8.5pt",
};

const PrintSalesPreviewModal: React.FC<PrintSalesPreviewModalProps> = ({
  isOpen,
  onClose,
  printPayload,
  storeSettings,
  onPrint,
}) => {
  if (!isOpen || !printPayload) return null;

  const [selectedPaperSizeKey, setSelectedPaperSizeKey] = useState<string>(
    storeSettings?.print_paper_size_sales || "A5"
  );

  useEffect(() => {
    if (storeSettings?.print_paper_size_sales && isOpen) {
      setSelectedPaperSizeKey(storeSettings.print_paper_size_sales);
    }
  }, [storeSettings?.print_paper_size_sales, isOpen]);

  const paperSize = resolvePaperSize(selectedPaperSizeKey, "A5");

  const isMobileDevice =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)").matches;

  const isNative = Capacitor.isNativePlatform();

  const getReceiptFileName = () =>
    `HoaDon_${printPayload.saleId || "DRAFT"}.png`;

  const createReceiptImageBlob = async (): Promise<Blob | null> => {
    const html2canvas = (await import("html2canvas")).default;
    const element = document.getElementById("mobile-print-preview-content");

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
    const title = `Hóa đơn ${printPayload.saleId || "DRAFT"}`;
    return await shareBlobNative(blob, fileName, title);
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
      const existingIframe = document.getElementById("mobile-print-iframe");
      if (existingIframe) existingIframe.remove();

      const iframe = document.createElement("iframe");
      iframe.id = "mobile-print-iframe";
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
          @page { size: ${paperSize.pageSize}; margin: 0; }
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

  const handleMobilePrint = async () => {
    if (isNative || !isMobileDevice) {
      onPrint();
      return;
    }

    try {
      showToast.info("Đang chuẩn bị hóa đơn cho máy in...");
      const blob = await createReceiptImageBlob();
      if (!blob) return;

      const fileName = getReceiptFileName();

      try {
        if (await shareReceiptImage(blob, fileName)) {
          showToast.info("Chọn ứng dụng máy in Bluetooth/LAN để in.");
          return;
        }
      } catch (shareErr) {
        console.warn("Share API failed, trying iframe print:", shareErr);
      }

      try {
        if (await printViaIframe(blob)) {
          showToast.info("Đang mở hộp thoại in...");
          return;
        }
      } catch (iframeErr) {
        console.warn("Iframe print failed, downloading:", iframeErr);
      }

      downloadReceiptImage(blob, fileName);
      showToast.info("Đã tải ảnh hóa đơn. Mở ảnh bằng ứng dụng máy in để in.");
    } catch (error) {
      console.error("Mobile print failed:", error);
      showToast.error("Không thể in trên điện thoại. Thử nút Chia sẻ hoặc In hệ thống.");
    }
  };

  const qrUrl = getDynamicQrUrl(
    {
      id: printPayload.saleId || "DRAFT",
      total: printPayload.totalValue,
      isSale: true,
      code: printPayload.saleId,
    },
    storeSettings || null
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-2 md:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Xem trước hóa đơn
          </h2>

          <div className="flex flex-wrap items-center gap-2 md:justify-end">
            <select
              value={selectedPaperSizeKey}
              onChange={(e) => setSelectedPaperSizeKey(e.target.value)}
              className="px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:border-blue-500"
            >
              <option value="58mm">Khổ 58mm</option>
              <option value="80mm">Khổ 80mm</option>
              <option value="A5">Khổ A5</option>
              <option value="A4">Khổ A4</option>
            </select>
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
              {isNative ? "In phiếu" : (isMobileDevice ? "In ĐT" : "In phiếu")}
            </button>

            {isMobileDevice && !isNative && (
              <button
                onClick={onPrint}
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

        <div className="flex-1 overflow-y-auto bg-slate-100 p-4 dark:bg-slate-900">
          <div className="flex justify-center">
            <div
              id="mobile-print-preview-content"
              className="relative flex-shrink-0 bg-white shadow-lg"
              style={{
                width: paperSize.width,
                minHeight: "auto",
                color: "#000000",
                backgroundColor: "#ffffff",
              }}
            >
              <div style={{ padding: "16px" }}>
                <div
                  style={{
                    borderBottom: "2px solid #3b82f6",
                    paddingBottom: "3mm",
                    marginBottom: "4mm",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      textAlign: "center",
                      gap: "1.8mm",
                      marginBottom: storeSettings?.bank_name ? "3.5mm" : "0",
                    }}
                  >
                    {storeSettings?.logo_url && (
                      <div
                        style={{
                          width: "19mm",
                          height: "19mm",
                          borderRadius: "999px",
                          border: "1px solid #bfdbfe",
                          background:
                            "linear-gradient(180deg, #ffffff 0%, #eff6ff 100%)",
                          boxShadow: "0 1.5mm 3mm rgba(37, 99, 235, 0.12)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          padding: "2mm",
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

                    <div
                      style={{
                        fontWeight: "bold",
                        fontSize: "14pt",
                        lineHeight: "1.15",
                        color: "#1d4ed8",
                        letterSpacing: "0.15mm",
                        maxWidth: "100%",
                      }}
                    >
                      {storeSettings?.store_name || "SƠN NAM"}
                    </div>

                    <div
                      style={{
                        fontSize: "8.5pt",
                        lineHeight: "1.45",
                        color: "#334155",
                        maxWidth: "94%",
                      }}
                    >
                      {storeSettings?.address ||
                        "Ấp Phú Lợi B, Xã Long Phú Thuận, Đồng Tháp"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "1.6mm",
                        fontSize: "8.5pt",
                        fontWeight: "bold",
                        color: "#0f172a",
                        padding: "1.2mm 3mm",
                        borderRadius: "999px",
                        border: "1px solid #bfdbfe",
                        backgroundColor: "#eff6ff",
                      }}
                    >
                      <span style={{ color: "#2563eb" }}>Hotline</span>
                      <span>{storeSettings?.phone || "0947.747.907"}</span>
                    </div>
                  </div>

                  {storeSettings?.bank_name && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "3mm",
                        width: "100%",
                        border: "1px solid #93c5fd",
                        borderRadius: "3.5mm",
                        padding: "2.8mm 3mm",
                        background:
                          "linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)",
                        boxShadow:
                          "inset 0 0 0 0.3mm rgba(255, 255, 255, 0.65)",
                      }}
                    >
                      {qrUrl && (
                        <div
                          style={{
                            width: "20mm",
                            height: "20mm",
                            borderRadius: "2.5mm",
                            overflow: "hidden",
                            border: "1px solid #bfdbfe",
                            backgroundColor: "#ffffff",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                          }}
                        >
                          <img
                            src={qrUrl}
                            alt="QR Banking"
                            style={{
                              width: "100%",
                              height: "100%",
                              objectFit: "contain",
                            }}
                          />
                        </div>
                      )}

                      <div style={{ flex: 1, minWidth: 0, color: "#0f172a" }}>
                        <div
                          style={{
                            fontWeight: "bold",
                            fontSize: "8.8pt",
                            marginBottom: "1mm",
                            color: "#1e3a8a",
                          }}
                        >
                          {storeSettings.bank_name}
                        </div>

                        {storeSettings.bank_account_number && (
                          <div
                            style={{
                              fontSize: "8pt",
                              marginBottom: "0.6mm",
                            }}
                          >
                            STK: {storeSettings.bank_account_number}
                          </div>
                        )}

                        {storeSettings.bank_account_holder && (
                          <div style={{ fontSize: "8pt", fontWeight: 600 }}>
                            {storeSettings.bank_account_holder}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                <div style={{ marginBottom: "4mm" }}>
                  <div style={{ textAlign: "center", marginBottom: "2mm" }}>
                    <h1
                      style={{
                        fontSize: "13pt",
                        fontWeight: "bold",
                        margin: "0",
                        textTransform: "uppercase",
                        color: "#1e40af",
                        lineHeight: 1.25,
                      }}
                    >
                      HÓA ĐƠN BÁN HÀNG
                    </h1>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={{ marginBottom: "1.2mm" }}>
                    <span style={{ fontWeight: "bold" }}>Ngày giờ:</span>{" "}
                    {new Date(printPayload.dateValue || Date.now()).toLocaleString("vi-VN")}
                  </div>
                  <div style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}>
                    <span style={{ fontWeight: "bold" }}>Khách hàng:</span>{" "}
                    {printPayload.customer.name}
                    {printPayload.customer.phone ? ` - ${printPayload.customer.phone}` : ""}
                  </div>
                  {printPayload.saleId && (
                    <div style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}>
                      <span style={{ fontWeight: "bold" }}>Mã đơn:</span>{" "}
                      {printPayload.saleId}
                    </div>
                  )}
                  <div>
                    <span style={{ fontWeight: "bold" }}>Thanh toán:</span>{" "}
                    {printPayload.payment === "cash" ? "Tiền mặt" : "Chuyển khoản"}
                  </div>
                </div>

                <div style={{ marginBottom: "4mm", color: "#000" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt" }}>
                    <thead>
                      <tr>
                        <th style={{ textAlign: "left", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px", fontWeight: "bold" }}>Sản phẩm</th>
                        <th style={{ textAlign: "center", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px", fontWeight: "bold", width: "10mm" }}>SL</th>
                        <th style={{ textAlign: "right", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px", fontWeight: "bold", width: "18mm" }}>Đơn giá</th>
                        <th style={{ textAlign: "right", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px", fontWeight: "bold", width: "22mm" }}>Thành tiền</th>
                      </tr>
                    </thead>
                    <tbody>
                      {printPayload.items.map((it: CartItem, idx: number) => (
                        <tr key={idx}>
                          <td style={{ borderBottom: "1px dashed #cbd5e1", padding: "6px 4px" }}>
                            {it.partName}
                            {it.discount && it.discount > 0 ? (
                              <div style={{ fontSize: "7.5pt", color: "#ef4444", marginTop: "1px" }}>
                                (Giảm: -{formatCurrency(it.discount)} đ)
                              </div>
                            ) : null}
                          </td>
                          <td style={{ textAlign: "center", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px" }}>{it.quantity}</td>
                          <td style={{ textAlign: "right", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px" }}>{formatCurrency(it.sellingPrice)}</td>
                          <td style={{ textAlign: "right", borderBottom: "1px dashed #cbd5e1", padding: "6px 4px" }}>
                            {formatCurrency(it.sellingPrice * it.quantity - (it.discount || 0))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: "10px", fontSize: "9pt", color: "#000" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "3px 0" }}>
                    <span>Tạm tính</span>
                    <span>{formatCurrency(printPayload.subtotalValue)} đ</span>
                  </div>
                  {printPayload.discountValue > 0 && (
                    <div style={{ display: "flex", justifyContent: "space-between", margin: "3px 0", color: "#e74c3c" }}>
                      <span>Giảm giá</span>
                      <span>-{formatCurrency(printPayload.discountValue)} đ</span>
                    </div>
                  )}
                  <div style={{ display: "flex", justifyContent: "space-between", margin: "5px 0 3px 0", fontWeight: "bold", fontSize: "11pt", color: "#2563eb" }}>
                    <span>TỔNG CỘNG</span>
                    <span>{formatCurrency(printPayload.totalValue)} đ</span>
                  </div>
                </div>

                {printPayload.noteText && (
                  <div style={{ ...cardStyle, marginTop: "4mm", backgroundColor: "#fff9e6", border: "1px solid #ffd700" }}>
                    <div style={{ fontWeight: "bold", marginBottom: "0.8mm" }}>Ghi chú:</div>
                    <div>{printPayload.noteText}</div>
                  </div>
                )}

                <div style={{ marginTop: "20px", textAlign: "center", fontSize: "8.5pt", color: "#334155", fontStyle: "italic" }}>
                  <p style={{ margin: 0 }}>Cảm ơn quý khách đã tin tưởng và ủng hộ!</p>
                  <p style={{ margin: "1mm 0 0 0" }}>Hẹn gặp lại quý khách!</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintSalesPreviewModal;
