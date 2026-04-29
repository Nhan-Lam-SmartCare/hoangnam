import React from "react";
import type { Vehicle } from "../../../types";

interface WorkOrderVehicleSectionProps {
  customerVehicles: Vehicle[];
  selectedVehicleId?: string;
  editingVehicleId: string | null;
  editVehicleModel: string;
  editVehicleLicensePlate: string;
  onOpenAddVehicleModal: () => void;
  onSelectVehicle: (vehicle: Vehicle) => void;
  onStartEditVehicle: (vehicle: Vehicle) => void;
  onCancelEditVehicle: () => void;
  onSaveEditedVehicle: () => void;
  onEditVehicleModelChange: (value: string) => void;
  onEditVehicleLicensePlateChange: (value: string) => void;
}

export const WorkOrderVehicleSection: React.FC<WorkOrderVehicleSectionProps> = ({
  customerVehicles,
  selectedVehicleId,
  editingVehicleId,
  editVehicleModel,
  editVehicleLicensePlate,
  onOpenAddVehicleModal,
  onSelectVehicle,
  onStartEditVehicle,
  onCancelEditVehicle,
  onSaveEditedVehicle,
  onEditVehicleModelChange,
  onEditVehicleLicensePlateChange,
}) => {
  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          {customerVehicles.length > 0
            ? "Chọn thiết bị"
            : "Thiết bị của khách hàng"}
          {customerVehicles.length > 0 && (
            <span className="text-xs text-slate-500 ml-1">
              ({customerVehicles.length} thiết bị)
            </span>
          )}
        </label>
        <button
          type="button"
          onClick={onOpenAddVehicleModal}
          className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium"
          title="Thêm thiết bị mới"
        >
          + Thêm thiết bị
        </button>
      </div>

      {customerVehicles.length > 0 ? (
        <div className="space-y-2">
          {customerVehicles.map((vehicle) => {
            const isSelected = selectedVehicleId === vehicle.id;
            const isPrimary = vehicle.isPrimary;
            const isEditing = editingVehicleId === vehicle.id;

            return (
              <div
                key={vehicle.id}
                className={`w-full rounded-lg border-2 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    : "border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700"
                }`}
              >
                {isEditing ? (
                  <div className="p-3 space-y-2">
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Tên thiết bị
                      </label>
                      <input
                        type="text"
                        value={editVehicleModel}
                        onChange={(e) => onEditVehicleModelChange(e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        placeholder="Nhập tên thiết bị (VD: iPhone 13...)"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-slate-500 dark:text-slate-400">
                        Serial/IMEI
                      </label>
                      <input
                        type="text"
                        value={editVehicleLicensePlate}
                        onChange={(e) =>
                          onEditVehicleLicensePlateChange(e.target.value)
                        }
                        className="w-full px-2 py-1.5 text-sm border border-slate-300 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        placeholder="Nhập Serial/IMEI"
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-1">
                      <button
                        type="button"
                        onClick={onCancelEditVehicle}
                        className="px-3 py-1 text-xs bg-slate-200 dark:bg-slate-600 text-slate-700 dark:text-slate-200 rounded-md hover:bg-slate-300 dark:hover:bg-slate-500"
                      >
                        Hủy
                      </button>
                      <button
                        type="button"
                        onClick={onSaveEditedVehicle}
                        className="px-3 py-1 text-xs bg-blue-500 text-white rounded-md hover:bg-blue-600"
                      >
                        Lưu
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onSelectVehicle(vehicle)}
                    className="w-full text-left px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2">
                      {isPrimary && (
                        <span className="text-yellow-500" title="Thiết bị chính">
                          ⭐
                        </span>
                      )}
                      <div className="flex-1">
                        <div className="font-medium text-sm text-slate-900 dark:text-slate-100">
                          {vehicle.model}
                        </div>
                        <div className="text-xs font-mono text-slate-600 dark:text-slate-400 mt-0.5">
                          {vehicle.licensePlate}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStartEditVehicle(vehicle);
                          }}
                          className="text-slate-400 hover:text-blue-500 p-1"
                          title="Sửa thông tin thiết bị"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            className="w-4 h-4"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        {isSelected && (
                          <svg
                            className="w-5 h-5 text-blue-500"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                    </div>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-4 px-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Chưa có thiết bị nào. Nhấn "+ Thêm thiết bị" để thêm.
          </p>
        </div>
      )}
    </div>
  );
};
