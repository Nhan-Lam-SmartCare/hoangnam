import React, { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { Share2, Printer, X } from "lucide-react";
import { showToast } from "../../../utils/toast";
import { shareBlobNative } from "../../../utils/nativeShare";
import type { PawnRecord } from "../../../types";

interface StoreSettings {
  store_name?: string;
  address?: string;
  phone?: string;
  email?: string;
  logo_url?: string;
  print_paper_size_pawn?: string;
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

interface PrintPawnPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  printRecord: PawnRecord | null;
  storeSettings?: StoreSettings;
  onPrint: () => void;
  children?: React.ReactNode;
}

const PrintPawnPreviewModal: React.FC<PrintPawnPreviewModalProps> = ({
  isOpen,
  onClose,
  printRecord,
  storeSettings,
  onPrint,
  children,
}) => {
  if (!isOpen || !printRecord) return null;

  const [selectedPaperSizeKey, setSelectedPaperSizeKey] = useState<string>(
    storeSettings?.print_paper_size_pawn || "A5"
  );

  useEffect(() => {
    if (storeSettings?.print_paper_size_pawn && isOpen) {
      setSelectedPaperSizeKey(storeSettings.print_paper_size_pawn);
    }
  }, [storeSettings?.print_paper_size_pawn, isOpen]);

  const paperSize = resolvePaperSize(selectedPaperSizeKey, "A5");

  const isMobileDevice =
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) ||
    window.matchMedia?.("(pointer: coarse)").matches;

  const isNative = Capacitor.isNativePlatform();

  const getReceiptFileName = () => `BienNhanCamDo_${printRecord.id}.png`;

  const createReceiptImageBlob = async (): Promise<Blob | null> => {
    const html2canvas = (await import("html2canvas")).default;
    const element = document.getElementById("mobile-print-preview-content-pawn");

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
    const title = `Biên nhận cầm đồ ${printRecord.id}`;
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
      showToast.info("Đang chuẩn bị biên nhận cho máy in...");
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
      showToast.info("Đã tải ảnh. Mở ảnh bằng ứng dụng máy in để in.");
    } catch (error) {
      console.error("Mobile print failed:", error);
      showToast.error("Không thể in trên điện thoại. Thử nút Chia sẻ hoặc In hệ thống.");
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/50 p-2 md:p-4">
      <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl dark:bg-slate-800">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-white px-4 py-3 dark:border-slate-700 dark:bg-slate-800 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
            Xem trước biên nhận cầm đồ
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
              id="mobile-print-preview-content-pawn"
              className="relative flex-shrink-0 bg-white shadow-lg print-scale-container"
              style={{
                width: paperSize.width === "80mm" || paperSize.width === "58mm" ? "148mm" : paperSize.width, // Force render at A5 width, then scale for smaller
                minHeight: "auto",
                transform: paperSize.width === "80mm" ? "scale(0.54)" : paperSize.width === "58mm" ? "scale(0.39)" : "none",
                transformOrigin: "top center",
                marginBottom: paperSize.width === "80mm" || paperSize.width === "58mm" ? "-40%" : "0" // Adjust layout flow after scaling
              }}
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrintPawnPreviewModal;
