import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode, Html5QrcodeResult } from "html5-qrcode";
import { X } from "lucide-react";

interface BarcodeScannerProps {
  onResult: (result: string) => void;
  onClose: () => void;
  isScanning: boolean;
}

export const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onResult,
  onClose,
  isScanning,
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (isScanning && !scannerRef.current) {
      const config = {
        fps: 10,
        qrbox: { width: 250, height: 250 },
        aspectRatio: 1.0,
      };

      const html5QrCode = new Html5Qrcode("reader");
      scannerRef.current = html5QrCode;

      html5QrCode
        .start(
          { facingMode: "environment" },
          config,
          (decodedText, _decodedResult) => {
            onResult(decodedText);
            // Stop scanning after successful read? Usually yes for this use case
            // But let parent handle closing
          },
          (errorMessage) => {
            // scan failure, usually ignore
            // console.warn(errorMessage);
          }
        )
        .catch((err) => {
          console.error("Error starting scanner", err);
          setError("Không thể khởi động camera. Vui lòng cấp quyền.");
        });
    }

    return () => {
      if (scannerRef.current && scannerRef.current.isScanning) {
        scannerRef.current
          .stop()
          .then(() => {
            scannerRef.current?.clear();
            scannerRef.current = null;
          })
          .catch((err) => console.error("Failed to stop scanner", err));
      }
    };
  }, [isScanning, onResult]);

  if (!isScanning) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 bg-black/50 absolute top-0 left-0 right-0 z-10">
        <h3 className="text-white font-bold">Quét mã vạch</h3>
        <button onClick={onClose} className="p-2 bg-white/20 rounded-full text-white">
          <X size={24} />
        </button>
      </div>

      <div id="reader" className="w-full h-full bg-black"></div>

      {error && (
        <div className="absolute bottom-10 left-0 right-0 p-4 text-center text-red-500 bg-black/80">
          {error}
        </div>
      )}
      <div className="absolute bottom-20 left-0 right-0 text-center text-white/70 text-sm">
        Đưa mã vạch vào khung hình
      </div>
    </div>
  );
};
