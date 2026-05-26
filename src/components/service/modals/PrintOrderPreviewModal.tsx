import React from "react";
import { Capacitor } from "@capacitor/core";
import { Share2, Printer, X } from "lucide-react";
import { formatCurrency, formatWorkOrderId } from "../../../utils/format";
import { showToast } from "../../../utils/toast";
import type { WorkOrder, WorkOrderPart } from "../../../types";
import { sanitizeIssueDescriptionForPrint } from "../utils/service.utils";
import { shareBlobNative } from "../../../utils/nativeShare";

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
  work_order_prefix?: string;
  print_paper_size_receipt?: string;
}

const PAPER_SIZE_MAP: Record<string, { width: string; pageSize: string }> = {
  "58mm": { width: "58mm", pageSize: "58mm auto" },
  "80mm": { width: "80mm", pageSize: "80mm auto" },
  "A5":   { width: "148mm", pageSize: "A5 portrait" },
  "A4":   { width: "210mm", pageSize: "A4 portrait" },
};

const resolvePaperSize = (key: string, fallback = "80mm") => {
  if (PAPER_SIZE_MAP[key]) return PAPER_SIZE_MAP[key];
  const match = key.match(/^(\d+)mm$/i);
  if (match) {
    const w = `${match[1]}mm`;
    return { width: w, pageSize: `${w} auto` };
  }
  return PAPER_SIZE_MAP[fallback] || PAPER_SIZE_MAP["80mm"];
};

interface PrintOrderPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  printOrder: WorkOrder | null;
  storeSettings?: StoreSettings;
  onPrint: () => void;
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
};

const PrintOrderPreviewModal: React.FC<PrintOrderPreviewModalProps> = ({
  isOpen,
  onClose,
  printOrder,
  storeSettings,
  onPrint,
}) => {
  if (!isOpen || !printOrder) return null;

  const printableIssueDescription = sanitizeIssueDescriptionForPrint(
    printOrder.issueDescription
  );

  const additionalServices = printOrder.additionalServices || [];
  const additionalServicesTotal = additionalServices.reduce(
    (sum: number, service: any) =>
      sum + (service.price || 0) * (service.quantity || 1),
    0
  );

  const isMobileDevice =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)").matches;

  const isNative = Capacitor.isNativePlatform();

  const paperSizeKey = storeSettings?.print_paper_size_receipt || "80mm";
  const paperSize = resolvePaperSize(paperSizeKey, "80mm");

  const getReceiptFileName = () =>
    `Phieu_${formatWorkOrderId(
      printOrder.id,
      storeSettings?.work_order_prefix
    )}.png`;

  const createReceiptImageBlob = async (): Promise<Blob | null> => {
    const html2canvas = (await import("html2canvas")).default;
    const element = document.getElementById("mobile-print-preview-content");

    if (!element) {
      showToast.error("Khong tim thay noi dung phieu!");
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
    const title = `Phiếu ${formatWorkOrderId(
      printOrder.id,
      storeSettings?.work_order_prefix
    )}`;
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
      showToast.info("Dang tao hinh anh...");
      const blob = await createReceiptImageBlob();
      if (!blob) return;

      const fileName = getReceiptFileName();
      if (await shareReceiptImage(blob, fileName)) {
        showToast.success("Da mo chia se phieu!");
        return;
      }

      downloadReceiptImage(blob, fileName);
      showToast.success("Da tai hinh anh!");
    } catch (error) {
      console.error("Share failed:", error);
      showToast.error("Khong the chia se. Vui long thu lai!");
    }
  };

  const printViaIframe = async (blob: Blob) => {
    try {
      const url = URL.createObjectURL(blob);
      // Remove any existing print iframe
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

      // Cleanup after printing
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
      showToast.info("Dang chuan bi phieu cho may in...");
      const blob = await createReceiptImageBlob();
      if (!blob) return;

      const fileName = getReceiptFileName();

      // Strategy 1: Try Web Share API (best for mobile - opens print apps directly)
      try {
        if (await shareReceiptImage(blob, fileName)) {
          showToast.info("Chon ung dung may in Bluetooth/LAN de in.");
          return;
        }
      } catch (shareErr) {
        console.warn("Share API failed, trying iframe print:", shareErr);
      }

      // Strategy 2: Try printing via hidden iframe (works on most mobile browsers)
      try {
        if (await printViaIframe(blob)) {
          showToast.info("Dang mo hop thoai in...");
          return;
        }
      } catch (iframeErr) {
        console.warn("Iframe print failed, downloading:", iframeErr);
      }

      // Strategy 3: Fallback - just download the image
      downloadReceiptImage(blob, fileName);
      showToast.info("Da tai anh phieu. Mo anh bang ung dung may in de in.");
    } catch (error) {
      console.error("Mobile print failed:", error);
      showToast.error("Khong the in tren dien thoai. Thu nut Chia se hoac In he thong.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-2 md:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Xem trước phiếu in
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
              {isNative ? "In phiếu" : (isMobileDevice ? "In DT" : "In phieu")}
            </button>

            {isMobileDevice && !isNative && (
              <button
                onClick={onPrint}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-600 px-3 py-1.5 text-sm text-white transition hover:bg-slate-700"
                title="Dung hop thoai in cua trinh duyet neu dien thoai ho tro"
              >
                <Printer className="h-4 w-4" />
                In he thong
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
                      {storeSettings.bank_qr_url && (
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
                            src={storeSettings.bank_qr_url}
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
                      PHIẾU DỊCH VỤ SỬA CHỮA
                    </h1>
                  </div>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "flex-start",
                      gap: "2mm",
                      fontSize: "8.5pt",
                      color: "#666",
                    }}
                  >
                    <div>
                      {new Date(printOrder.creationDate).toLocaleString(
                        "vi-VN",
                        {
                          year: "numeric",
                          month: "2-digit",
                          day: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        }
                      )}
                    </div>

                    <div style={{ fontWeight: "bold" }}>
                      Mã:{" "}
                      {formatWorkOrderId(
                        printOrder.id,
                        storeSettings?.work_order_prefix
                      )}
                    </div>
                  </div>
                </div>

                <div style={cardStyle}>
                  <div
                    style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}
                  >
                    <span style={{ fontWeight: "bold" }}>Khách hàng:</span>{" "}
                    {printOrder.customerName}
                  </div>
                  <div
                    style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}
                  >
                    <span style={{ fontWeight: "bold" }}>SĐT:</span>{" "}
                    {printOrder.customerPhone}
                  </div>
                  <div
                    style={{ marginBottom: "1.2mm", wordBreak: "break-word" }}
                  >
                    <span style={{ fontWeight: "bold" }}>Tên thiết bị:</span>{" "}
                    {printOrder.vehicleModel}
                  </div>
                  <div style={{ wordBreak: "break-word" }}>
                    <span style={{ fontWeight: "bold" }}>Serial/IMEI:</span>{" "}
                    {printOrder.licensePlate}
                  </div>
                </div>

                <div style={cardStyle}>
                  <div style={sectionTitleStyle}>Mô tả sự cố:</div>
                  <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                    {printableIssueDescription || "Không có ghi chú"}
                  </div>
                </div>

                {printOrder.partsUsed && printOrder.partsUsed.length > 0 && (
                  <div style={{ marginBottom: "4mm", color: "#000" }}>
                    <p
                      style={{
                        fontWeight: "bold",
                        margin: "0 0 2mm 0",
                        fontSize: "11pt",
                      }}
                    >
                      Linh kiện:
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2mm",
                      }}
                    >
                      {printOrder.partsUsed.map(
                        (part: WorkOrderPart, index: number) => (
                          <div
                            key={`${part.partId}-${index}`}
                            style={{
                              border: "1px solid #ddd",
                              borderRadius: "2mm",
                              padding: "2.8mm 3mm",
                              backgroundColor: "#fff",
                            }}
                          >
                            <div
                              style={{
                                fontSize: "10pt",
                                fontWeight: "bold",
                                marginBottom: "1mm",
                                wordBreak: "break-word",
                              }}
                            >
                              {part.partName}
                            </div>
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "baseline",
                                gap: "2mm",
                                fontSize: "9pt",
                                color: "#374151",
                              }}
                            >
                              <div>
                                SL: {part.quantity} x{" "}
                                {formatCurrency(part.price)}
                              </div>
                              <div
                                style={{
                                  fontWeight: "bold",
                                  color: "#111827",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {formatCurrency(part.price * part.quantity)}
                              </div>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {additionalServices.length > 0 && (
                  <div style={{ marginBottom: "4mm", color: "#000" }}>
                    <p
                      style={{
                        fontWeight: "bold",
                        margin: "0 0 2mm 0",
                        fontSize: "11pt",
                      }}
                    >
                      Dịch vụ thêm:
                    </p>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "2mm",
                      }}
                    >
                      {additionalServices.map((service: any, idx: number) => (
                        <div
                          key={idx}
                          style={{
                            border: "1px solid #ddd",
                            borderRadius: "2mm",
                            padding: "2.8mm 3mm",
                            backgroundColor: "#fff",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "10pt",
                              fontWeight: "bold",
                              marginBottom: "1mm",
                            }}
                          >
                            {service.description || service.name}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              fontSize: "9pt",
                              color: "#374151",
                            }}
                          >
                            <div>
                              SL: {service.quantity || 1} x{" "}
                              {formatCurrency(service.price || 0)}
                            </div>
                            <div
                              style={{
                                fontWeight: "bold",
                                color: "#111827",
                              }}
                            >
                              {formatCurrency(
                                (service.price || 0) *
                                  (service.quantity || 1)
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div style={{ ...cardStyle, backgroundColor: "#f9f9f9" }}>
                  <table style={{ width: "100%", borderSpacing: 0 }}>
                    <tbody>
                      {(printOrder.laborCost ?? 0) > 0 && (
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Tiền công:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(printOrder.laborCost || 0)}
                          </td>
                        </tr>
                      )}

                      {additionalServicesTotal > 0 && (
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            Giá công/đặt hàng:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                            }}
                          >
                            {formatCurrency(additionalServicesTotal)}
                          </td>
                        </tr>
                      )}

                      {(printOrder.discount ?? 0) > 0 && (
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                              color: "#e74c3c",
                            }}
                          >
                            Giảm giá:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingBottom: "2mm",
                              fontSize: "10pt",
                              color: "#e74c3c",
                            }}
                          >
                            -{formatCurrency(printOrder.discount || 0)}
                          </td>
                        </tr>
                      )}

                      <tr style={{ borderTop: "2px solid #333" }}>
                        <td
                          style={{
                            fontWeight: "bold",
                            paddingTop: "2mm",
                            fontSize: "12pt",
                          }}
                        >
                          TỔNG CỘNG:
                        </td>
                        <td
                          style={{
                            textAlign: "right",
                            paddingTop: "2mm",
                            fontSize: "12pt",
                            fontWeight: "bold",
                            color: "#2563eb",
                          }}
                        >
                          {formatCurrency(printOrder.total)} đ
                        </td>
                      </tr>

                      {(printOrder.totalPaid ?? 0) > 0 && (
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              paddingTop: "2mm",
                              fontSize: "10pt",
                              color: "#16a34a",
                            }}
                          >
                            Đã thanh toán:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingTop: "2mm",
                              fontSize: "10pt",
                              color: "#16a34a",
                            }}
                          >
                            {formatCurrency(printOrder.totalPaid || 0)}
                          </td>
                        </tr>
                      )}

                      {(printOrder.remainingAmount ?? 0) > 0 && (
                        <tr>
                          <td
                            style={{
                              fontWeight: "bold",
                              fontSize: "11pt",
                              color: "#dc2626",
                            }}
                          >
                            Còn lại:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              fontSize: "11pt",
                              fontWeight: "bold",
                              color: "#dc2626",
                            }}
                          >
                            {formatCurrency(printOrder.remainingAmount || 0)}
                          </td>
                        </tr>
                      )}

                      {printOrder.paymentMethod && (
                        <tr>
                          <td
                            style={{
                              paddingTop: "2mm",
                              fontSize: "9pt",
                              color: "#666",
                            }}
                          >
                            Hình thức thanh toán:
                          </td>
                          <td
                            style={{
                              textAlign: "right",
                              paddingTop: "2mm",
                              fontSize: "9pt",
                              color: "#666",
                            }}
                          >
                            {printOrder.paymentMethod === "cash"
                              ? "Tiền mặt"
                              : printOrder.paymentMethod === "bank"
                                ? "Chuyển khoản"
                                : printOrder.paymentMethod}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div
                  style={{
                    marginTop: "4mm",
                    padding: "3mm",
                    backgroundColor: "#fff9e6",
                    border: "1px solid #ffd700",
                    borderRadius: "2mm",
                    fontSize: "9pt",
                    textAlign: "center",
                  }}
                >
                  <p style={{ margin: 0, fontStyle: "italic" }}>
                    Cảm ơn quý khách đã sử dụng dịch vụ!
                  </p>
                  <p style={{ margin: "1mm 0 0 0", fontStyle: "italic" }}>
                    Vui lòng giữ phiếu này để đối chiếu khi nhận máy
                  </p>
                </div>

              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintOrderPreviewModal;
