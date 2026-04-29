import React, { useState, useRef } from "react";
import { Camera, X, Loader2, ImagePlus } from "lucide-react";
import { MAX_DEVICE_PHOTOS, isValidImageFile } from "../../utils/imageCompressor";
import { showToast } from "../../utils/toast";

interface DevicePhotoGalleryProps {
  photos: string[];
  onAddPhoto: (file: File) => Promise<void>;
  onRemovePhoto: (url: string) => Promise<void>;
  isUploading: boolean;
  disabled?: boolean;
}

export const DevicePhotoGallery: React.FC<DevicePhotoGalleryProps> = ({
  photos,
  onAddPhoto,
  onRemovePhoto,
  isUploading,
  disabled = false,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!isValidImageFile(file)) {
      showToast.error("Vui lòng chọn file ảnh hợp lệ (JPG, PNG, WebP)");
      return;
    }

    try {
      await onAddPhoto(file);
    } catch (error: any) {
      // Error handled by parent usually, but just in case
      console.error(error);
    } finally {
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const handleAddClick = () => {
    if (disabled || isUploading) return;
    if (photos.length >= MAX_DEVICE_PHOTOS) {
      showToast.error(`Tối đa ${MAX_DEVICE_PHOTOS} ảnh cho mỗi thiết bị`);
      return;
    }
    fileInputRef.current?.click();
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Ảnh thiết bị khi nhận ({photos.length}/{MAX_DEVICE_PHOTOS})
        </label>
        <span className="text-xs text-slate-500">Tùy chọn, tối đa 4 ảnh</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Render existing photos */}
        {photos.map((url, index) => (
          <div
            key={`${url}-${index}`}
            className="relative aspect-square rounded-xl overflow-hidden group border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800"
          >
            <img
              src={url}
              alt={`Device photo ${index + 1}`}
              className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform duration-300"
              onClick={() => setPreviewUrl(url)}
            />
            {!disabled && (
              <button
                type="button"
                onClick={() => onRemovePhoto(url)}
                className="absolute top-1.5 right-1.5 p-1.5 bg-black/50 hover:bg-red-500 text-white rounded-lg backdrop-blur-sm transition-colors opacity-0 group-hover:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 md:opacity-0 focus:opacity-100"
                title="Xóa ảnh"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}

        {/* Add photo button */}
        {photos.length < MAX_DEVICE_PHOTOS && (
          <div
            onClick={handleAddClick}
            className={`relative aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
              disabled || isUploading
                ? "border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 cursor-not-allowed opacity-70"
                : "border-blue-200 dark:border-blue-900/50 bg-blue-50/50 dark:bg-blue-900/10 hover:border-blue-400 dark:hover:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/30 cursor-pointer"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept="image/*"
              capture="environment" // Gợi ý mở camera sau trên mobile
              className="hidden"
            />
            {isUploading ? (
              <>
                <Loader2 className="w-6 h-6 text-blue-500 animate-spin" />
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">Đang tải lên...</span>
              </>
            ) : (
              <>
                <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-500">
                  <Camera className="w-5 h-5" />
                </div>
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium px-2 text-center">
                  Thêm ảnh (hoặc chụp)
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {previewUrl && (
        <div 
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 backdrop-blur-sm"
          onClick={() => setPreviewUrl(null)}
        >
          <button
            onClick={() => setPreviewUrl(null)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white bg-black/50 hover:bg-black/70 rounded-xl transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={previewUrl}
            alt="Preview"
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
