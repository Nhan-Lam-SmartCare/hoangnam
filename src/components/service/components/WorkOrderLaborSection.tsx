import React from "react";
import type { Employee, ServiceConfig, WorkOrder, WorkOrderPart } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";
import { showToast } from "../../../utils/toast";
import { getSelectableEmployees } from "../../../utils/employees";
import {
  buildDefaultWorkerSplit,
  splitWorkerAmount,
} from "../../../lib/services/repairLaborService";
import type { RepairServiceDraft, RepairServiceDraftWorker } from "../hooks/useWorkOrderSharedLogic";
import { createEmptyRepairServiceDraft } from "../hooks/useWorkOrderSharedLogic";

interface WorkOrderLaborSectionProps {
  formData: Partial<WorkOrder>;
  setFormData: React.Dispatch<React.SetStateAction<Partial<WorkOrder>>>;
  resolvedTechnicianName: string;
  isTechnicianLockedForStaff: boolean;
  employees: any[];
  repairLaborTotal: number;
  newRepairServiceDraft: RepairServiceDraft;
  setNewRepairServiceDraft: React.Dispatch<React.SetStateAction<RepairServiceDraft>>;
  serviceConfigs: ServiceConfig[];
  employeeOptions: Employee[];
  selectedParts: WorkOrderPart[];
  repairServices: RepairServiceDraft[];
  setRepairServices: React.Dispatch<React.SetStateAction<RepairServiceDraft[]>>;
  getRepairServiceLaborAmount: (service: RepairServiceDraft) => number;
  getRepairServiceWorkers: (service: RepairServiceDraft) => RepairServiceDraftWorker[];
  getSelectedPartCost: (partId: string) => number;
  canEditPriceAndParts: boolean;
  order: WorkOrder;
  currentBranchId: string;
}

export const WorkOrderLaborSection: React.FC<WorkOrderLaborSectionProps> = ({
  formData,
  setFormData,
  resolvedTechnicianName,
  isTechnicianLockedForStaff,
  employees,
  repairLaborTotal,
  newRepairServiceDraft,
  setNewRepairServiceDraft,
  serviceConfigs,
  employeeOptions,
  selectedParts,
  repairServices,
  setRepairServices,
  getRepairServiceLaborAmount,
  getRepairServiceWorkers,
  getSelectedPartCost,
  canEditPriceAndParts,
  order,
  currentBranchId,
}) => {
  const selectableEmployees = getSelectableEmployees(employees, currentBranchId);
  const selectableWorkerOptions = getSelectableEmployees(employeeOptions, currentBranchId);

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
        <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold">2</span>
        Chi tiết Dịch vụ
      </h3>

      <div className="grid grid-cols-1 gap-3">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Kỹ thuật viên
          </label>
          {isTechnicianLockedForStaff && (
            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
              Tài khoản nhân viên: kỹ thuật viên được cố định theo đăng nhập.
            </p>
          )}
          <select
            value={resolvedTechnicianName}
            disabled={isTechnicianLockedForStaff}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                technicianName: e.target.value,
              }))
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 disabled:opacity-60 disabled:cursor-not-allowed"
          >
            <option value="">-- Chọn kỹ thuật viên --</option>
            {selectableEmployees
              .map((emp) => (
                <option key={emp.id} value={emp.name}>
                  {emp.name}
                </option>
              ))}
          </select>
        </div>
      </div>



      {import.meta.env.VITE_ENABLE_WORKORDER_REPAIR_SECTION === "1" && (
        <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                Dịch vụ / Công sửa
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Tính tiền công riêng với tiền phụ tùng. Lương thợ chỉ lấy từ phần này.
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-slate-500 dark:text-slate-400">Tổng tiền công sửa</div>
              <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(repairLaborTotal)}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Mẫu dịch vụ
              </label>
              <select
                value={newRepairServiceDraft.serviceId || ""}
                onChange={(e) => {
                  const selectedService = serviceConfigs.find((service) => service.id === e.target.value);
                  if (!selectedService) {
                    setNewRepairServiceDraft(createEmptyRepairServiceDraft());
                    return;
                  }

                  setNewRepairServiceDraft({
                    ...createEmptyRepairServiceDraft(),
                    serviceId: selectedService.id,
                    serviceName: selectedService.name,
                    laborCalcType: selectedService.laborCalcType,
                    laborFixedAmount: selectedService.laborFixedAmount,
                    laborPercentOfCost: selectedService.laborPercentOfCost,
                    minimumLaborAmount: selectedService.minimumLaborAmount,
                    defaultWorkerSharePercent: selectedService.defaultWorkerSharePercent,
                    manualLabor:
                      selectedService.laborCalcType === "manual"
                        ? selectedService.laborFixedAmount
                        : 0,
                    workers: buildDefaultWorkerSplit(
                      employeeOptions,
                      resolvedTechnicianName,
                      selectedService.defaultWorkerSharePercent
                    ),
                  });
                }}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="">-- Chọn dịch vụ --</option>
                {serviceConfigs.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Kiểu tính công
              </label>
              <select
                value={newRepairServiceDraft.laborCalcType}
                onChange={(e) =>
                  setNewRepairServiceDraft({
                    ...newRepairServiceDraft,
                    laborCalcType: e.target.value as RepairServiceDraft["laborCalcType"],
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              >
                <option value="fixed">fixed</option>
                <option value="percent_of_cost">percent_of_cost</option>
                <option value="manual">manual</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Tên dịch vụ
              </label>
              <input
                type="text"
                value={newRepairServiceDraft.serviceName}
                onChange={(e) =>
                  setNewRepairServiceDraft({
                    ...newRepairServiceDraft,
                    serviceName: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Công cố định
              </label>
              <NumberInput
                value={newRepairServiceDraft.laborFixedAmount}
                onChange={(value) =>
                  setNewRepairServiceDraft({
                    ...newRepairServiceDraft,
                    laborFixedAmount: value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                % theo giá nhập
              </label>
              <NumberInput
                value={newRepairServiceDraft.laborPercentOfCost}
                onChange={(value) =>
                  setNewRepairServiceDraft({
                    ...newRepairServiceDraft,
                    laborPercentOfCost: value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Công tối thiểu / công tay
              </label>
              <NumberInput
                value={
                  newRepairServiceDraft.laborCalcType === "manual"
                    ? newRepairServiceDraft.manualLabor
                    : newRepairServiceDraft.minimumLaborAmount
                }
                onChange={(value) =>
                  setNewRepairServiceDraft({
                    ...newRepairServiceDraft,
                    manualLabor:
                      newRepairServiceDraft.laborCalcType === "manual"
                        ? value
                        : newRepairServiceDraft.manualLabor,
                    minimumLaborAmount:
                      newRepairServiceDraft.laborCalcType === "manual"
                        ? newRepairServiceDraft.minimumLaborAmount
                        : value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="text-xs font-medium text-slate-600 dark:text-slate-300 mb-2">
                Phụ tùng liên quan
              </div>
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {selectedParts.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Hãy thêm phụ tùng ở phần dưới trước khi gán cho dịch vụ % giá nhập.
                  </div>
                )}
                {selectedParts.map((part) => {
                  const checked = newRepairServiceDraft.relatedItemIds.includes(part.partId);
                  return (
                    <label
                      key={part.partId}
                      className="flex items-center justify-between gap-3 text-xs text-slate-700 dark:text-slate-200"
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setNewRepairServiceDraft({
                              ...newRepairServiceDraft,
                              relatedItemIds: e.target.checked
                                ? [...newRepairServiceDraft.relatedItemIds, part.partId]
                                : newRepairServiceDraft.relatedItemIds.filter((id: string) => id !== part.partId),
                            })
                          }
                        />
                        <span>{part.partName}</span>
                      </span>
                      <span className="text-slate-500 dark:text-slate-400">
                        {formatCurrency((part.costPrice || 0) * (part.quantity || 0))}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="text-xs font-medium text-slate-600 dark:text-slate-300">
                  Gán thợ và chia %
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setNewRepairServiceDraft({
                      ...newRepairServiceDraft,
                      workers: [
                        ...newRepairServiceDraft.workers,
                        { worker_id: "", worker_name: "", share_percent: 0 },
                      ],
                    })
                  }
                  className="text-xs px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded"
                >
                  + Thợ
                </button>
              </div>
              <div className="space-y-2">
                {newRepairServiceDraft.workers.length === 0 && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    Nếu chưa gán, hệ thống sẽ dùng kỹ thuật viên chính và % mặc định của dịch vụ.
                  </div>
                )}
                {newRepairServiceDraft.workers.map((worker: RepairServiceDraftWorker, index: number) => (
                  <div key={`${worker.worker_id}-${index}`} className="grid grid-cols-[1fr,120px,32px] gap-2">
                    <select
                      value={worker.worker_id}
                      onChange={(e) => {
                        const selectedEmployee = employeeOptions.find((employee) => employee.id === e.target.value);
                        setNewRepairServiceDraft({
                          ...newRepairServiceDraft,
                          workers: newRepairServiceDraft.workers.map((item: RepairServiceDraftWorker, itemIndex: number) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  worker_id: e.target.value,
                                  worker_name: selectedEmployee?.name || "",
                                }
                              : item
                          ),
                        });
                      }}
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-slate-100"
                    >
                      <option value="">-- Chọn thợ --</option>
                      {selectableWorkerOptions
                        .map((employee) => (
                          <option key={employee.id} value={employee.id}>
                            {employee.name}
                          </option>
                        ))}
                    </select>
                    <NumberInput
                      value={worker.share_percent}
                      onChange={(value) =>
                        setNewRepairServiceDraft({
                          ...newRepairServiceDraft,
                          workers: newRepairServiceDraft.workers.map((item: RepairServiceDraftWorker, itemIndex: number) =>
                            itemIndex === index ? { ...item, share_percent: value } : item
                          ),
                        })
                      }
                      className="px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-xs text-slate-900 dark:text-slate-100"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setNewRepairServiceDraft({
                          ...newRepairServiceDraft,
                          workers: newRepairServiceDraft.workers.filter((_: any, itemIndex: number) => itemIndex !== index),
                        })
                      }
                      className="text-red-500 hover:text-red-700"
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-[1fr,160px] gap-3 items-end">
            <div>
              <label className="block text-xs font-medium text-slate-600 dark:text-slate-300 mb-1">
                Ghi chú / có tính lương
              </label>
              <input
                type="text"
                value={newRepairServiceDraft.note}
                onChange={(e) =>
                  setNewRepairServiceDraft({
                    ...newRepairServiceDraft,
                    note: e.target.value,
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                placeholder="Bảo hành, hậu mãi, chủ tự làm..."
              />
              <div className="mt-2 flex gap-4 text-xs text-slate-600 dark:text-slate-300">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRepairServiceDraft.isBillable}
                    onChange={(e) =>
                      setNewRepairServiceDraft({
                        ...newRepairServiceDraft,
                        isBillable: e.target.checked,
                      })
                    }
                  />
                  Tính bill khách
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRepairServiceDraft.isPayableToWorker}
                    onChange={(e) =>
                      setNewRepairServiceDraft({
                        ...newRepairServiceDraft,
                        isPayableToWorker: e.target.checked,
                      })
                    }
                  />
                  Tính lương thợ
                </label>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!newRepairServiceDraft.serviceName.trim()) {
                  showToast.error("Vui lòng nhập tên dịch vụ công sửa");
                  return;
                }

                const totalShare = (newRepairServiceDraft.workers || []).reduce(
                  (sum, w) => sum + Number(w.share_percent || 0),
                  0
                );
                if (totalShare > 100) {
                  showToast.error("Tổng phần trăm chia thợ không được vượt quá 100%");
                  return;
                }

                setRepairServices([...repairServices, newRepairServiceDraft]);
                setNewRepairServiceDraft(createEmptyRepairServiceDraft());
              }}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium"
            >
              Thêm công sửa
            </button>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Dịch vụ</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Giá nhập liên quan</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Công khách trả</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-slate-500 dark:text-slate-400">Chia thợ</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                {repairServices.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-3 py-4 text-center text-sm text-slate-500 dark:text-slate-400">
                      Chưa có công sửa nào trong phiếu.
                    </td>
                  </tr>
                )}
                {repairServices.map((service) => {
                  const relatedCost = service.relatedItemIds.reduce(
                    (sum: number, partId: string) => sum + getSelectedPartCost(partId),
                    0
                  );
                  const laborAmount = getRepairServiceLaborAmount(service);
                  const workers = getRepairServiceWorkers(service);
                  const workerSplits = splitWorkerAmount(laborAmount, workers);

                  return (
                    <tr key={service.id} className="bg-white dark:bg-slate-900/30">
                      <td className="px-3 py-2 text-sm text-slate-800 dark:text-slate-200">
                        <div className="font-medium">{service.serviceName}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {service.laborCalcType}
                          {service.note ? ` | ${service.note}` : ""}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-sm text-slate-700 dark:text-slate-300">
                        {formatCurrency(relatedCost)}
                      </td>
                      <td className="px-3 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400">
                        {formatCurrency(laborAmount)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                        {workerSplits.length === 0
                          ? "Chưa gán"
                          : workerSplits
                              .map((worker) => `${worker.worker_name || worker.worker_id}: ${worker.share_percent}% (${formatCurrency(worker.worker_amount)})`)
                              .join(", ")}
                      </td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            setRepairServices(repairServices.filter((item) => item.id !== service.id))
                          }
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Xóa
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
