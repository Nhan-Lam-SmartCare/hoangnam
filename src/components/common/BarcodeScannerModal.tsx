import React, { useEffect, useRef, useState, useCallback } from "react";
import { X, Camera, FlashlightOff, Flashlight, SwitchCamera } from "lucide-react";
import { Html5Qrcode, Html5QrcodeScannerState } from "html5-qrcode";

interface BarcodeScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan: (barcode: string) => void;
  title?: string;
}

const BarcodeScannerModal: React.FC<BarcodeScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  title = "Quét mã vạch",
}) => {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [lastScanned, setLastScanned] = useState<string>("");
  const hasScannedRef = useRef(false);
  const mountedRef = useRef(true);

  // Dừng scanner và gọi callback
  const handleSuccessfulScan = useCallback(async (decodedText: string) => {
    // Chỉ xử lý 1 lần
    if (hasScannedRef.current) return;
    hasScannedRef.current = true;


    // Vibrate
    if (navigator.vibrate) {
      navigator.vibrate(100);
    }

    setLastScanned(decodedText);

    // Dừng scanner trước
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
      } catch (e) {
        // Ignore
      }
    }
    setIsScanning(false);

    // Delay nhỏ để UI cập nhật, rồi gọi callback và đóng
    setTimeout(() => {
      if (mountedRef.current) {
        onScan(decodedText);
        onClose();
      }
    }, 300);
  }, [onScan, onClose]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (isOpen) {
      hasScannedRef.current = false;
      setLastScanned("");
      startScanner();
    } else {
      stopScanner();
    }

    return () => {
      stopScanner();
    };
  }, [isOpen, facingMode]);

  const startScanner = async () => {
    try {
      setError(null);

      // Stop existing scanner if any
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === Html5QrcodeScannerState.SCANNING) {
            await scannerRef.current.stop();
          }
          scannerRef.current.clear();
        } catch (e) {
          // Ignore
        }
      }

      const scanner = new Html5Qrcode("barcode-scanner-container");
      scannerRef.current = scanner;

      // iOS-optimized config with specific formats to improve performance
      const config: any = {
        fps: 20,
        qrbox: { width: 300, height: 180 },
        aspectRatio: 1.5,
        disableFlip: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
        // Limit formats to speed up detection on iOS JS-scanner
        formatsToSupport: [
          0, // QR_CODE
          3, // CODE_39
          5, // CODE_128 (Common for logistic/parts)
          9, // EAN_13 (Common products)
          10, // EAN_8
          14, // UPC_A
          15, // UPC_E
          2, // CODABAR
        ],
        videoConstraints: {
          facingMode: facingMode,
          focusMode: "continuous",
          width: { ideal: 1280 }, // 720p is good balance
          height: { ideal: 720 },
        },
      };

      await scanner.start(
        { facingMode },
        config,
        handleSuccessfulScan,
        () => {
          // Ignore scan errors (no code found)
        }
      );

      // Note: Do NOT apply zoom on iOS - it triggers macro mode and causes blur
      setIsScanning(true);
    } catch (err: any) {
      console.error("Scanner error:", err);
      if (err.toString().includes("NotAllowedError")) {
        setError("Vui lòng cấp quyền camera để quét mã vạch");
      } else if (err.toString().includes("NotFoundError")) {
        setError("Không tìm thấy camera trên thiết bị");
      } else {
        setError("Không thể khởi động camera: " + (err.message || err));
      }
      setIsScanning(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === Html5QrcodeScannerState.SCANNING) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (e) {
        // Ignore cleanup errors
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
  };

  const toggleTorch = async () => {
    try {
      const track = (scannerRef.current as any)?.getRunningTrackCameraCapabilities?.();
      if (track?.torchFeature?.isSupported()) {
        await track.torchFeature.apply(!torchOn);
        setTorchOn(!torchOn);
      }
    } catch (e) {
    }
  };

  const switchCamera = () => {
    setFacingMode(prev => prev === "environment" ? "user" : "environment");
  };

  const handleClose = () => {
    stopScanner();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col z-[200]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-black/50">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Camera className="w-5 h-5" />
          {title}
        </h2>
        <button
          onClick={handleClose}
          className="p-2 rounded-full bg-white/20 text-white hover:bg-white/30"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Scanner Area */}
      <div className="flex-1 flex flex-col items-center justify-center p-4">
        {error ? (
          <div className="text-center">
            <div className="text-red-400 mb-4 px-4">{error}</div>
            <button
              onClick={startScanner}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg font-medium"
            >
              Thử lại
            </button>
          </div>
        ) : (
          <>
            {/* Scanner container */}
            <div className="relative w-full max-w-sm">
              <div
                id="barcode-scanner-container"
                className="w-full rounded-xl overflow-hidden bg-black"
                style={{ minHeight: 300 }}
              />

              {/* Scan frame overlay */}
              {isScanning && (
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="w-[300px] h-[180px] relative">
                    {/* Corner markers */}
                    <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-green-400 rounded-tl" />
                    <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-green-400 rounded-tr" />
                    <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-green-400 rounded-bl" />
                    <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-green-400 rounded-br" />

                    {/* Scanning line animation */}
                    <div className="absolute inset-x-0 h-0.5 bg-green-400 animate-scan" />
                  </div>
                </div>
              )}
            </div>

            {/* Last scanned */}
            {lastScanned && (
              <div className="mt-4 px-4 py-2 bg-green-600/20 border border-green-500 rounded-lg">
                <p className="text-green-400 text-sm text-center font-mono">
                  ✓ Đã quét: {lastScanned}
                </p>
              </div>
            )}

            {/* Instructions - with iOS distance guidance */}
            <div className="mt-4 text-center px-4">
              <p className="text-white/70 text-sm">
                Đưa mã vạch vào khung hình để quét
              </p>
              <p className="text-amber-400/80 text-xs mt-1">
                📱 iPhone: Giữ cách 15-25cm để tránh bị mờ
              </p>
            </div>
          </>
        )}
      </div>

      {/* Controls */}
      {isScanning && (
        <div className="flex items-center justify-center gap-6 p-6 bg-black/50">
          <button
            onClick={toggleTorch}
            className={`p-4 rounded-full ${torchOn ? "bg-yellow-500 text-black" : "bg-white/20 text-white"}`}
            title="Đèn flash"
          >
            {torchOn ? <Flashlight className="w-6 h-6" /> : <FlashlightOff className="w-6 h-6" />}
          </button>
          <button
            onClick={switchCamera}
            className="p-4 rounded-full bg-white/20 text-white"
            title="Đổi camera"
          >
            <SwitchCamera className="w-6 h-6" />
          </button>
        </div>
      )}

      {/* CSS for scan animation */}
      <style>{`
        @keyframes scan {
          0%, 100% { top: 0; }
          50% { top: calc(100% - 2px); }
        }
        .animate-scan {
          animation: scan 2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
};

export default BarcodeScannerModal;
