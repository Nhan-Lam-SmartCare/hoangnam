/**
 * Nén ảnh client-side sử dụng Canvas API
 * - Resize max 1024px (giữ tỷ lệ)
 * - Xuất WebP quality 75%
 * - Kết quả: ~50-80KB/ảnh
 */

const MAX_WIDTH = 1024;
const MAX_HEIGHT = 1024;
const QUALITY = 0.75;
const OUTPUT_TYPE = "image/webp";

/**
 * Nén 1 file ảnh → Blob WebP đã nén
 */
export async function compressImage(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      // Tính kích thước mới (giữ tỷ lệ)
      let { width, height } = img;
      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        const ratio = Math.min(MAX_WIDTH / width, MAX_HEIGHT / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      // Vẽ lên canvas
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Không thể tạo canvas context"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      // Xuất WebP
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            // Fallback: nếu WebP không hỗ trợ, thử JPEG
            canvas.toBlob(
              (jpegBlob) => {
                if (jpegBlob) {
                  resolve(jpegBlob);
                } else {
                  reject(new Error("Không thể nén ảnh"));
                }
              },
              "image/jpeg",
              QUALITY
            );
          }
        },
        OUTPUT_TYPE,
        QUALITY
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Không thể đọc file ảnh"));
    };

    img.src = url;
  });
}

/**
 * Lấy kích thước đã format (VD: "45.2 KB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Kiểm tra file có phải ảnh hợp lệ
 */
export function isValidImageFile(file: File): boolean {
  const validTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
  return validTypes.includes(file.type) || /\.(jpg|jpeg|png|webp|heic|heif)$/i.test(file.name);
}

/** Giới hạn ảnh tối đa mỗi phiếu */
export const MAX_DEVICE_PHOTOS = 4;
