import React from "react";
import { Bike, Lock, Grid3x3, CheckCircle, Wrench, ChevronRight } from "lucide-react";
import { AndroidPatternLock } from "../../common/AndroidPatternLock";
import { DevicePhotoGallery } from "../../common/DevicePhotoGallery";
import type { Vehicle } from "../../../types";

interface WorkOrderMobileIssueSectionProps {
  selectedVehicle: Vehicle | null;
  setActiveSection: (section: "info" | "issue" | "parts" | "payment") => void;
  currentKm: string;
  setCurrentKm: (km: string) => void;
  isPatternMode: boolean;
  setIsPatternMode: (mode: boolean) => void;
  issueDescription: string;
  setIssueDescription: (desc: string) => void;
  devicePhotos: string[];
  handleAddDevicePhoto: (file: File) => Promise<void>;
  handleRemoveDevicePhoto: (photoUrl: string) => Promise<void>;
  isUploadingPhoto: boolean;
}

export const WorkOrderMobileIssueSection: React.FC<WorkOrderMobileIssueSectionProps> = ({
  selectedVehicle,
  setActiveSection,
  currentKm,
  setCurrentKm,
  isPatternMode,
  setIsPatternMode,
  issueDescription,
  setIssueDescription,
  devicePhotos,
  handleAddDevicePhoto,
  handleRemoveDevicePhoto,
  isUploadingPhoto,
}) => {
  if (!selectedVehicle) {
    return (
      <div className="flex flex-col items-center justify-center py-10 text-slate-400 text-center">
        <Bike className="w-12 h-12 mb-3 opacity-20" />
        <p className="text-sm">
          Vui lòng chọn khách hàng và thiết bị ở tab <strong>Thông tin</strong> trước.
        </p>
        <button
          type="button"
          onClick={() => setActiveSection("info")}
          className="mt-4 text-blue-500 text-xs font-bold"
        >
          Quay lại chọn thiết bị
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
            Mật khẩu màn hình
          </label>
          <button
            type="button"
            onClick={() => {
              if (currentKm.startsWith("Pattern:")) {
                setCurrentKm("");
              }
              setIsPatternMode(!isPatternMode);
            }}
            className="text-[10px] font-bold text-blue-500 flex items-center gap-1 active:scale-95 transition-transform"
          >
            {isPatternMode ? (
              <>
                <Lock className="w-3 h-3" /> Nhập số/chữ
              </>
            ) : (
              <>
                <Grid3x3 className="w-3 h-3" /> Vẽ hình (Android)
              </>
            )}
          </button>
        </div>

        {isPatternMode ? (
          <div className="bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl p-4 flex flex-col items-center">
            <div className="mb-2 text-xs font-bold text-slate-500">Vẽ mật khẩu mở khóa</div>
            <AndroidPatternLock
              initialValue={currentKm.startsWith("Pattern:") ? currentKm.replace("Pattern:", "").trim() : ""}
              onPatternComplete={(pattern: string | null) => {
                if (pattern) {
                  setCurrentKm(`Pattern: ${pattern}`);
                  if (navigator.vibrate) navigator.vibrate(50);
                }
              }}
            />
            {currentKm.startsWith("Pattern:") ? (
              <div className="mt-2 text-xs font-mono text-emerald-500 font-bold flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Đã lưu hình vẽ
              </div>
            ) : (
              <div className="mt-2 text-[10px] text-slate-400 italic">Vẽ hình để lưu mật khẩu</div>
            )}
          </div>
        ) : (
          <div className="relative">
            <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              value={currentKm}
              onChange={(e) => setCurrentKm(e.target.value)}
              placeholder="Mật khẩu (nếu có)..."
              className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-sm focus:border-blue-500 transition-all font-mono"
            />
          </div>
        )}
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider ml-1">
          Mô tả sự cố
        </label>
        <div className="relative">
          <Wrench className="absolute left-3.5 top-3.5 w-4 h-4 text-slate-500" />
          <textarea
            value={issueDescription}
            onChange={(e) => setIssueDescription(e.target.value)}
            placeholder="Mô tả các vấn đề cần sửa chữa..."
            rows={3}
            className="w-full pl-11 pr-4 py-3 bg-white dark:bg-[#1e1e2d] border border-slate-200 dark:border-slate-700/50 rounded-xl text-slate-900 dark:text-white text-sm resize-none focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="pt-2">
        <DevicePhotoGallery
          photos={devicePhotos}
          onAddPhoto={handleAddDevicePhoto}
          onRemovePhoto={handleRemoveDevicePhoto}
          isUploading={isUploadingPhoto}
        />
      </div>

      <button
        type="button"
        onClick={() => setActiveSection("parts")}
        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs rounded-xl flex items-center justify-center gap-2 mt-4 shadow-lg shadow-blue-500/20"
      >
        Tiếp tục: Thêm linh kiện <ChevronRight className="w-4 h-4" />
      </button>
    </div>
  );
};
