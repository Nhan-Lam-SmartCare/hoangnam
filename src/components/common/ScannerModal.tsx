import React, { useEffect, useRef, useState, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import Tesseract from 'tesseract.js';
import { BrowserMultiFormatReader } from '@zxing/library';
import {
    X,
    Maximize,
    Minimize,
    ZoomIn,
    ZoomOut,
    Type,
    ScanLine,
    Camera,
    Image as ImageIcon,
    Flashlight,
    RefreshCcw
} from "lucide-react";
import { showToast } from "../../utils/toast";

interface ScannerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onScan: (result: string) => void;
    title?: string;
}

type ScanMode = 'barcode' | 'ocr';

export const ScannerModal: React.FC<ScannerModalProps> = ({
    isOpen,
    onClose,
    onScan,
    title = "Smart Scanner",
}) => {
    const [error, setError] = useState<string | null>(null);
    const [mode, setMode] = useState<ScanMode>('barcode');
    const [zoom, setZoom] = useState(1);
    const [maxZoom, setMaxZoom] = useState(3);
    const [isProcessing, setIsProcessing] = useState(false);
    const [flashOn, setFlashOn] = useState(false);

    // Refs
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const trackRef = useRef<MediaStreamTrack | null>(null);
    const intervalRef = useRef<NodeJS.Timeout | null>(null);

    // Initialize Camera
    const startCamera = useCallback(async () => {
        try {
            setError(null);
            if (streamRef.current) {
                streamRef.current.getTracks().forEach(t => t.stop());
            }

            const constraints = {
                video: {
                    facingMode: "environment",
                    width: { ideal: 1920 }, // Prefer Full HD
                    height: { ideal: 1080 },
                    focusMode: "continuous"
                }
            };
            // @ts-ignore
            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            streamRef.current = stream;

            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.play();
            }

            const track = stream.getVideoTracks()[0];
            trackRef.current = track;

            // Get capabilities for Zoom/Flash
            const capabilities = track.getCapabilities ? track.getCapabilities() : {};
            // @ts-ignore - non-standard zoom property
            if (capabilities.zoom) {
                // @ts-ignore
                const z = capabilities.zoom;
                console.log("Zoom capabilities:", z);
                setMaxZoom(z.max || 3);
                // Also set initial zoom
                // @ts-ignore
                const settings = track.getSettings();
                // @ts-ignore
                if (settings.zoom) setZoom(settings.zoom);
            }
        } catch (err: any) {
            console.error("Camera error:", err);
            setError("Cannot access camera. Please ensure permissions are granted.");
        }
    }, []);

    // Stop Camera
    const stopCamera = useCallback(() => {
        if (intervalRef.current) clearInterval(intervalRef.current);
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
            });
            streamRef.current = null;
        }
    }, []);

    // Handle Zoom
    const handleZoom = async (newZoom: number) => {
        setZoom(newZoom);
        if (trackRef.current) {
            try {
                // @ts-ignore
                await trackRef.current.applyConstraints({
                    advanced: [{ zoom: newZoom } as any]
                });
            } catch (e) {
                console.warn("Zoom constraint failed, retry with standard constraints:", e);
                // Fallback: try applying without "advanced" if browser supports it directly or different structure
                // But mostly, failure here means the device rejected the specific value or is busy.
            }
        }
    };

    // Handle Flash
    const toggleFlash = async () => {
        if (trackRef.current) {
            try {
                const newFlashState = !flashOn;
                // @ts-ignore
                await trackRef.current.applyConstraints({
                    advanced: [{ torch: newFlashState } as any]
                });
                setFlashOn(newFlashState);
            } catch (e) {
                showToast.error("Flash/Torch not supported on this device");
            }
        }
    };

    // --- BARCODE DETECTION (Native + Fallback) ---
    const scanBarcodeFrame = async () => {
        if (!videoRef.current || isProcessing) return;

        // 1. Try Native BarcodeDetector (Android/Chrome/iOS 17+)
        // @ts-ignore
        if (window.BarcodeDetector) {
            try {
                // @ts-ignore
                const barcodeDetector = new BarcodeDetector({
                    formats: [
                        "qr_code",
                        "ean_13", "ean_8",
                        "code_128", "code_39", "code_93",
                        "upc_a", "upc_e",
                        "itf", "codabar", "data_matrix"
                    ]
                });

                const barcodes = await barcodeDetector.detect(videoRef.current);
                if (barcodes.length > 0) {
                    const code = barcodes[0].rawValue;
                    onResult(code);
                    return;
                }
            } catch (e) {
                // Fallback will run below
            }
        }

        // 2. Fallback: Use ZXing for broad compatibility
        try {
            const codeReader = new BrowserMultiFormatReader();
            // We use 'decodeFromImage' if we can pass the video element or canvas
            // But ZXing mostly wants a stream or deviceId. 
            // For single frame, we can use decodeFromImageElement if we draw to canvas first, or try decodeFromVideoElement (but that takes control).
            // Better: Draw to hidden canvas and scan that.

            if (canvasRef.current && videoRef.current) {
                const canvas = canvasRef.current;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    canvas.width = videoRef.current.videoWidth;
                    canvas.height = videoRef.current.videoHeight;
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                    // Simple decode from current frame
                    // Note: ZXing is a bit heavy to instantiate every frame. 
                    // Ideally should be instantiated once outside. But for now, let's test if this simple fallback works.
                    // If performance is bad, we move instantiation to useRef.
                    const result = await codeReader.decodeFromImage(undefined, canvas.toDataURL());
                    if (result) {
                        onResult(result.getText());
                        return;
                    }
                }
            }
        } catch (e) {
            // Check if it's just "No MultiFormat Readers were able to detect the code"
            if (e instanceof Error && !e.message.includes('No MultiFormat Readers')) {
                // console.error(e);
            }
        }
    };

    // --- OCR DETECTION (Tesseract) ---
    const captureAndOCR = async () => {
        if (!videoRef.current || !canvasRef.current || isProcessing) return;
        setIsProcessing(true);

        try {
            const video = videoRef.current;
            const canvas = canvasRef.current;
            const ctx = canvas.getContext('2d');

            // 1. Define Region of Interest (ROI) - Center 60% of frame
            // This matches the visual guide box in the UI
            const boxWidth = video.videoWidth * 0.8; // 80% width
            const boxHeight = video.videoWidth * 0.8 * (2 / 3); // Aspect ratio 3:2

            const startX = (video.videoWidth - boxWidth) / 2;
            const startY = (video.videoHeight - boxHeight) / 2;

            // UPSCALE for better OCR (Critical for small text)
            const scale = 3; // 3x upscale to improve edge definition
            canvas.width = boxWidth * scale;
            canvas.height = boxHeight * scale;

            // 2. Crop Image to ROI & Scale Up
            ctx?.drawImage(
                video,
                startX, startY, boxWidth, boxHeight, // Source
                0, 0, canvas.width, canvas.height // Destination (Scaled)
            );

            // 3. Image Pre-processing (Grayscale + Binarization)
            const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
            if (imageData) {
                const data = imageData.data;
                for (let i = 0; i < data.length; i += 4) {
                    // Grayscale (Luminosity method)
                    let gray = 0.21 * data[i] + 0.72 * data[i + 1] + 0.07 * data[i + 2];

                    // Aggressive Contrast (Softened Binarization)
                    // Hard thresholding (145) caused character breakage (9->J, 8->B).
                    // We revert to a smoother contrast curve which preserves edge details better.
                    gray = (gray - 128) * 2.5 + 128; // Increase contrast range

                    // Clamp values explicitly instead of binary 0/255
                    if (gray < 20) gray = 0;   // Crush blacks
                    if (gray > 250) gray = 255; // Blow out whites

                    data[i] = gray;     // R
                    data[i + 1] = gray; // G
                    data[i + 2] = gray; // B
                }
                ctx?.putImageData(imageData, 0, 0);
            }

            // 4. Run Tesseract with Whitelist (Alphanumeric + common separators)
            const dataUrl = canvas.toDataURL('image/jpeg', 1.0); // High quality
            const { data: { text } } = await Tesseract.recognize(
                dataUrl,
                'eng',
                {
                    logger: m => { }, // Quiet
                }
            );

            // Parse result for IMEI/Serial patterns
            // CRITICAL FIX: Must allow '/' and ':' so that "S/N:" doesn't become "S N "
            const cleanText = text.toUpperCase().replace(/[^A-Z0-9\n\-\.\:\/]/g, " ");
            console.log("OCR Cleaned:", cleanText);

            // Regex for IMEI (15 digits) or general long alphanumeric sequences
            const imeiMatch = cleanText.match(/\b\d{15}\b/);

            // MEID (14 hex chars mostly, or 18 digits)
            const meidMatch = cleanText.match(/(?:MEID|MEIDDEC|MEIDHEX)[:\.\s]*([A-F0-9]{14,18})/i);

            // Dell Service Tag (7 alphanumeric) or Express Service Code (10-11 digits)
            const serviceTagMatch = cleanText.match(/(?:SERVICE TAG|ST|S\/T|SVC TAG)[:\.\s]*([A-Z0-9]{7})\b/i);
            const expressCodeMatch = cleanText.match(/(?:EXPRESS SERVICE CODE|EXPRESS SVC)[:\.\s]*(\d{10,11})\b/i);

            // MAC Address (e.g. 00:1A:2B:3C:4D:5E or 00-1A...)
            // Matches 6 groups of 2 hex chars separated by : or -
            const macMatch = cleanText.match(/(?:MAC|MAC ADD|MAC ADDRESS)[:\.\s]*([A-F0-9]{2}[:-][A-F0-9]{2}[:-][A-F0-9]{2}[:-][A-F0-9]{2}[:-][A-F0-9]{2}[:-][A-F0-9]{2})/i);

            // S/N regex: Strict Serial Number (Highest Priority)
            // Matches: "S/N: ...", "Serial No.: ...", "SPS#", "ASSY#" 
            // REMOVED "DATE" and "MANUFACTURED" to avoid capturing dates like "2023-09" as Serial Numbers
            const strictSnMatch = cleanText.match(/(?:S\/N|SN|S\.N\.|5\/N|S\/M|SER\.?\s*NO\.?|SERIAL(?:\s+(?:NO\.?|NUMBER|NUM))?|SPS#|ASSY#|FCC ID|IC)[:\.\_\-\s]*([A-Z0-9\-\.]{5,})/i);

            // P/N regex: Part Number or Model (Lower Priority)
            // Matches: "P/N: ...", "Model: ..."
            const pnMatch = cleanText.match(/(?:P\/N|PN|PART(?:\s+(?:NO\.?|NUMBER|NUM))?|MODEL)[:\.\_\-\s]*([A-Z0-9\-\.]{5,})/i);

            // Specific Hardware Serial format (e.g., QQQQQ-QQQQQ-...) and Dell Monitor (CN-...)
            const hardwareSerialMatch = cleanText.match(/\b([A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5})\b/);
            const dellMonitorMatch = cleanText.match(/\b(CN-[A-Z0-9]{5,})\b/);

            // Appliance long serials (often just numbers, 12-20 digits, no prefix or far prefix)
            const applianceMatch = cleanText.match(/\b(\d{12,20})\b/);
            // Fallback: look for long alphanumeric string
            // Exclude common words
            const rawSerialMatch = cleanText.match(/\b(?!(?:TYPE|MODEL|INPUT|OUTPUT|MADE|CHINA|VIETNAM|NGUON|SOURCE|VOLT|WATT|TOTAL|POWER|HERTZ|FREQ|CLASS|CONSUMER|CAMERA|WARNING|CAUTION|LIMITED|NETWORK|TECHNOLOGY))[A-Z0-9\-\.]{8,25}\b/i);

            if (strictSnMatch && strictSnMatch[1]) {
                // Priority 1: Explicit Serial Number (User requested high priority)
                // "S/N: ...", "Serial No.: ..."
                onResult(correctCommonErrors(strictSnMatch[1]));
            } else if (imeiMatch) {
                // Priority 2: IMEI (15 digits) - User explicitly requested high priority for IMEI
                onResult(imeiMatch[0]);
            } else if (serviceTagMatch) {
                // Priority 3: Explicit Dell Service Tag
                onResult(serviceTagMatch[1]);
            } else if (macMatch) {
                // Priority 4: Explicit MAC Address
                onResult(macMatch[1]);
            } else if (meidMatch) {
                // Priority 5: Explicit MEID
                onResult(meidMatch[1]);
            } else if (dellMonitorMatch) {
                // Priority 6: Specific Dell Monitor format
                onResult(dellMonitorMatch[1]);
            } else if (hardwareSerialMatch) {
                // Priority 7: Specific Hardware Serial format
                onResult(hardwareSerialMatch[0]);
            } else if (pnMatch && pnMatch[1]) {
                // Priority 8: Part Number / Model (if no S/N found)
                onResult(pnMatch[1]);
            } else if (expressCodeMatch) {
                onResult(expressCodeMatch[1]);
            } else if (applianceMatch) {
                onResult(applianceMatch[1]);
            } else if (rawSerialMatch) {
                // Heuristic: If it matched the regex, it already contains at least one digit and excluded common words.
                const val = rawSerialMatch[0];
                // Double check: Must contain at least one digit to be a valid non-strict serial
                // This filters out pure text words like "CONSUMER" if they somehow slipped through regex
                if (/\d/.test(val)) {
                    onResult(val.toUpperCase());
                } else {
                    // console.log("Ignored non-numeric fallback:", val);
                }
            } else {
                showToast.info("Không nhận diện được mã. Hãy giữ chắc tay.");
            }

        } catch (err) {
            console.error(err);
            showToast.error("Lỗi nhận diện. Vui lòng thử lại.");
        } finally {
            setIsProcessing(false);
        }
    };

    // Helper to fix common character swaps in Serial Numbers
    // Solves issues like 8->B, 9->J, 5->S, 0->O
    const correctCommonErrors = (str: string) => {
        if (!str) return str;
        let fixed = str;

        // 1. Common letter-to-digit swaps for Serial Numbers
        // IMOU / Generic: J at start often means 9
        if (fixed.startsWith('J')) {
            fixed = '9' + fixed.substring(1);
        }

        // B -> 8 (If looks like number block)
        // S -> 5
        // O -> 0 (Very common in Model/SN mixed strings)
        // naive replacements for safely known patterns:
        fixed = fixed.replace(/O/g, '0');

        return fixed;
    };

    const onResult = (result: string) => {
        if (navigator.vibrate) navigator.vibrate(200);
        onScan(result);
        onClose();
    };

    // Start scanning loop
    useEffect(() => {
        if (isOpen) {
            startCamera();
            if (mode === 'barcode') {
                intervalRef.current = setInterval(scanBarcodeFrame, 200);
            }
        } else {
            stopCamera();
        }
        return () => stopCamera();
    }, [isOpen, mode, startCamera]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[120] bg-black text-white flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 bg-black/50 backdrop-blur absolute top-0 left-0 right-0 z-10">
                <button onClick={toggleFlash} className="p-2 rounded-full bg-white/10">
                    <Flashlight className={`w-5 h-5 ${flashOn ? 'text-yellow-400' : 'text-white'}`} />
                </button>
                <div className="bg-black/60 px-4 py-1 rounded-full text-sm font-bold">
                    {mode === 'barcode' ? 'BARCODE / QR' : 'SCAN TEXT (OCR)'}
                </div>
                <button onClick={onClose} className="p-2 rounded-full bg-white/10">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Viewport */}
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
                <video
                    ref={videoRef}
                    className="absolute inset-0 w-full h-full object-cover"
                    playsInline
                    muted
                />

                {/* Visual Guide Box */}
                <div className="relative z-10 w-[80%] aspect-[3/2] border-2 border-white/50 rounded-lg shadow-[0_0_0_9999px_rgba(0,0,0,0.5)]">
                    <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-blue-500 -ml-1 -mt-1" />
                    <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-blue-500 -mr-1 -mt-1" />
                    <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-blue-500 -ml-1 -mb-1" />
                    <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-blue-500 -mr-1 -mb-1" />

                    {isProcessing && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-[2px]">
                            <RefreshCcw className="w-8 h-8 animate-spin text-blue-500" />
                        </div>
                    )}
                </div>

                {/* Zoom Controls Overlay */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 z-20 flex flex-col gap-4 bg-black/40 p-2 rounded-full backdrop-blur">
                    <button onClick={() => handleZoom(Math.min(maxZoom, zoom + 0.5))} className="p-2">
                        <ZoomIn className="w-6 h-6" />
                    </button>
                    <div className="text-xs font-bold text-center">{zoom}x</div>
                    <button onClick={() => handleZoom(Math.max(1, zoom - 0.5))} className="p-2">
                        <ZoomOut className="w-6 h-6" />
                    </button>
                </div>

                <canvas ref={canvasRef} className="hidden" />
            </div>

            {/* Footer Control */}
            <div className="bg-black p-6 flex flex-col gap-4 pb-10">
                {/* Mode Switcher */}
                <div className="flex bg-white/10 p-1 rounded-xl self-center">
                    <button
                        onClick={() => setMode('barcode')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${mode === 'barcode' ? 'bg-blue-600 shadow-lg' : 'text-slate-400'}`}
                    >
                        <ScanLine className="w-4 h-4" /> Barcode
                    </button>
                    <button
                        onClick={() => setMode('ocr')}
                        className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all ${mode === 'ocr' ? 'bg-purple-600 shadow-lg' : 'text-slate-400'}`}
                    >
                        <Type className="w-4 h-4" /> Scan Text
                    </button>
                </div>

                {/* Capture Button (Only for OCR or difficult manual capture) */}
                <div className="flex items-center justify-center gap-8 mt-2">
                    {mode === 'ocr' ? (
                        <button
                            onClick={captureAndOCR}
                            disabled={isProcessing}
                            className="w-16 h-16 rounded-full bg-white border-4 border-purple-500 flex items-center justify-center active:scale-95 transition-all shadow-[0_0_20px_rgba(168,85,247,0.5)]"
                        >
                            <Camera className="w-8 h-8 text-black" />
                        </button>
                    ) : (
                        <div className="text-center text-slate-400 text-sm">
                            Point camera at barcode<br />to scan automatically
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ScannerModal;
