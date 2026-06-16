import { useState, useCallback } from "react";
import { usePrinter } from "../../../hooks/usePrinter";
import { WorkOrder } from "../../../types";
import { StoreSettings } from "../types/service.types";
import { showToast } from "../../../utils/toast";
import {
  fetchStoreSettingsForBranch,
  generateWorkOrderTextReceipt,
} from "../utils/service.utils";

export const useWorkOrderPrinter = (currentBranchId: string) => {
  const { isNative, printViaWiFi, printViaBluetooth } = usePrinter();
  const [printOrder, setPrintOrder] = useState<WorkOrder | null>(null);
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [storeSettings, setStoreSettings] = useState<StoreSettings | null>(null);

  const handlePrintOrder = useCallback(async (order: WorkOrder) => {
    setPrintOrder(order);
    try {
      const data = await fetchStoreSettingsForBranch(
        order.branchId || currentBranchId
      );
      if (data) {
        setStoreSettings(data);
      }
    } catch (err) {
      console.error("Error loading store settings:", err);
    }
    setShowPrintPreview(true);
  }, [currentBranchId]);

  const handleDoPrint = useCallback(async () => {
    const printMode = localStorage.getItem("motocare_print_mode") || "wifi";

    if (isNative && printMode === "bluetooth") {
      if (!printOrder) {
        showToast.error("Không có thông tin hóa đơn sửa chữa.");
        return;
      }
      const text = generateWorkOrderTextReceipt(printOrder, storeSettings);
      await printViaBluetooth(text);
    } else {
      setTimeout(async () => {
        const receiptElement = document.getElementById("work-order-receipt");
        if (!receiptElement) {
          showToast.error("Không tìm thấy mẫu in hóa đơn.");
          return;
        }

        const html = `
          <html>
            <head>
              <meta charset="utf-8" />
              <title>Phiếu sửa chữa</title>
              <style>
                body { margin: 0; padding: 10px; font-family: sans-serif; }
                @media print {
                  body { padding: 0; }
                }
              </style>
            </head>
            <body>
              ${receiptElement.innerHTML}
            </body>
          </html>
        `;

        await printViaWiFi(html);
      }, 500);
    }
  }, [isNative, printOrder, storeSettings, printViaBluetooth, printViaWiFi]);

  const closePrintPreview = useCallback(() => {
    setShowPrintPreview(false);
    setPrintOrder(null);
  }, []);

  return {
    printOrder,
    showPrintPreview,
    storeSettings,
    handlePrintOrder,
    handleDoPrint,
    closePrintPreview,
  };
};
