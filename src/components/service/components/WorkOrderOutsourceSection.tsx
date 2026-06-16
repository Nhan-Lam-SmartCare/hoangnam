import React from "react";
import type { WorkOrder } from "../../../types";
import { formatCurrency } from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";
import { showToast } from "../../../utils/toast";
import { supabase } from "../../../supabaseClient";

interface WorkOrderOutsourceSectionProps {
  additionalServices: Array<{
    id: string;
    description: string;
    quantity: number;
    price: number;
    costPrice?: number;
  }>;
  setAdditionalServices: React.Dispatch<
    React.SetStateAction<
      Array<{
        id: string;
        description: string;
        quantity: number;
        price: number;
        costPrice?: number;
      }>
    >
  >;
  newService: {
    description: string;
    quantity: number;
    price: number;
    costPrice: number;
  };
  setNewService: React.Dispatch<
    React.SetStateAction<{
      description: string;
      quantity: number;
      price: number;
      costPrice: number;
    }>
  >;
  canEditPriceAndParts: boolean;
  order: WorkOrder;
}

export const WorkOrderOutsourceSection: React.FC<WorkOrderOutsourceSectionProps> = ({
  additionalServices,
  setAdditionalServices,
  newService,
  setNewService,
  canEditPriceAndParts,
  order,
}) => {
  return (
    <div className="space-y-3 col-start-1 mt-4">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
        Gia công / Đặt hàng ngoài
      </h3>

      <div className="border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-700">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-slate-600 dark:text-slate-300">
                Mô tả
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                SL
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                Đơn giá
              </th>
              <th className="px-4 py-2 text-right text-xs font-medium text-slate-600 dark:text-slate-300">
                Thành tiền
              </th>
              <th className="px-4 py-2 text-center text-xs font-medium text-slate-600 dark:text-slate-300">
                <button
                  type="button"
                  onClick={() => {
                    if (newService.description) {
                      setAdditionalServices([
                        ...additionalServices,
                        { ...newService, id: `SRV-${Date.now()}` },
                      ]);
                      setNewService({
                        description: "",
                        quantity: 1,
                        price: 0,
                        costPrice: 0,
                      });
                    }
                  }}
                  className="px-2 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-xs"
                >
                  Thêm
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {additionalServices.map((service) => (
              <tr
                key={service.id}
                className="border-b border-slate-200 dark:border-slate-700"
              >
                <td className="px-4 py-2 text-sm text-slate-900 dark:text-slate-100">
                  {service.description}
                </td>
                <td className="px-4 py-2 text-center text-sm text-slate-900 dark:text-slate-100">
                  <input
                    type="number"
                    value={service.quantity}
                    min="1"
                    onChange={(e) => {
                      const newQty = Math.max(1, Number(e.target.value));
                      setAdditionalServices(
                        additionalServices.map((s) =>
                          s.id === service.id
                            ? { ...s, quantity: newQty }
                            : s
                        )
                      );
                    }}
                    className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 focus:border-blue-500 focus:outline-none"
                  />
                </td>
                <td className="px-4 py-2 text-right">
                  <NumberInput
                    value={service.price}
                    onChange={(val) =>
                      setAdditionalServices(
                        additionalServices.map((s) =>
                          s.id === service.id
                            ? { ...s, price: val }
                            : s
                        )
                      )
                    }
                    disabled={!canEditPriceAndParts}
                    className={`w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:outline-none text-sm ${
                      !canEditPriceAndParts ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                    placeholder="0"
                  />
                </td>
                <td className="px-4 py-2 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {formatCurrency(service.price * service.quantity)}
                </td>
                <td className="px-4 py-2 text-center">
                  <button
                    type="button"
                    onClick={async () => {
                      const newServices = additionalServices.filter(
                        (s) => s.id !== service.id
                      );
                      setAdditionalServices(newServices);

                      if (newServices.length === 0 && order?.id) {
                        try {
                          await supabase
                            .from("work_orders")
                            .update({ additionalservices: null })
                            .eq("id", order.id);
                          showToast.success("Đã xóa phần gia công/đặt hàng");
                        } catch (error) {
                          console.error(
                            "[WorkOrderOutsourceSection] Error clearing additionalServices:",
                            error
                          );
                        }
                      }
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                    aria-label="Xóa dịch vụ"
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
                        d="M3 6h18M9 6V4h6v2m-7 4v8m4-8v8m4-8v8"
                      />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}

            <tr className="bg-white dark:bg-slate-800">
              <td className="px-4 py-2">
                <input
                  type="text"
                  placeholder="Mô tả..."
                  value={newService.description}
                  onChange={(e) =>
                    setNewService({
                      ...newService,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <input
                  type="number"
                  value={newService.quantity}
                  onChange={(e) =>
                    setNewService({
                      ...newService,
                      quantity: Number(e.target.value),
                    })
                  }
                  className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                />
              </td>
              <td className="px-4 py-2">
                <NumberInput
                  placeholder="Đơn giá"
                  value={newService.price ?? ""}
                  onChange={(val) =>
                    setNewService({
                      ...newService,
                      price: val,
                    })
                  }
                  allowNegative={true}
                  className="w-full px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                />
              </td>
              <td className="px-4 py-2 text-right text-sm text-slate-400">
                {newService.price > 0
                  ? formatCurrency(newService.price * newService.quantity)
                  : "Thành tiền"}
              </td>
              <td className="px-4 py-2 text-center"></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};
