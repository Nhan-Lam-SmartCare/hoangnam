import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { Capacitor } from '@capacitor/core';
import { showToast } from './toast';

/**
 * Shares a blob file (like png image) natively on mobile devices using Capacitor,
 * or falls back to Web Share API on modern browsers.
 */
export async function shareBlobNative(blob: Blob, fileName: string, title: string): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    // If not on mobile native, use Web Share API fallback if supported
    if (navigator.share && navigator.canShare) {
      const file = new File([blob], fileName, { type: "image/png" });
      const shareData = {
        files: [file],
        title: title,
        text: title,
      };
      if (navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return true;
        } catch (err) {
          console.warn("Web Share API failed:", err);
        }
      }
    }
    return false;
  }

  // Mobile Native Platform: Use Capacitor Filesystem & Share
  return new Promise<boolean>((resolve) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onloadend = async () => {
      try {
        const base64data = reader.result as string;
        // Extract base64 content
        const base64Content = base64data.split(',')[1];
        
        // Save file to app cache directory (no storage permission required for Cache directory)
        const writeResult = await Filesystem.writeFile({
          path: fileName,
          data: base64Content,
          directory: Directory.Cache,
        });

        // Open native system share sheet
        await Share.share({
          title: title,
          text: title,
          files: [writeResult.uri],
        });
        
        resolve(true);
      } catch (err) {
        console.error("Native share failed:", err);
        showToast.error("Không thể khởi động bảng chia sẻ hệ thống.");
        resolve(false);
      }
    };
    reader.onerror = () => {
      showToast.error("Lỗi chuyển đổi dữ liệu để chia sẻ.");
      resolve(false);
    };
  });
}
