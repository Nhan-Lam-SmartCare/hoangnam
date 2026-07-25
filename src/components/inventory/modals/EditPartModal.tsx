import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useCategories, useCreateCategory } from "../../../hooks/useCategories";
import { showToast } from "../../../utils/toast";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import type { Part } from "../../../types";
import UiModal from "../../ui/Modal";
import { supabase } from "../../../supabaseClient";



import { isPhoneBranch } from "../../../utils/branchUtils";

interface EditPartModalProps {
  part: Part;
  onClose: () => void;
  onSave: (part: Partial<Part> & { id: string }) => void;
  currentBranchId: string;
}

const EditPartModal: React.FC<EditPartModalProps> = ({
  part,
  onClose,
  onSave,
  currentBranchId,
}) => {
  const { data: branches = [] } = useQuery({
    queryKey: ["allBranchesForSelect"],
    queryFn: async () => {
      const { data } = await supabase.from("branches").select("id, name").order("name");
      return data || [];
    }
  });

  const hideLaborCost = isPhoneBranch(currentBranchId, branches);

  const [formData, setFormData] = useState({
    name: part.name,
    category: part.category || "",
    warrantyPeriod:
      part.warrantyPeriod ||
      (part as any).warrantyperiod ||
      (part as any).warranty_period ||
      (part as any).warranty ||
      "",
    retailPrice: part.retailPrice?.[currentBranchId] || 0,
    laborCost: Number((part as any).laborCost?.[currentBranchId] || 0),
    costPrice: part.costPrice?.[currentBranchId] || 0,
    stock: part.stock?.[currentBranchId] || 0,
    branchId: (part as any).branch_id || (part as any).branchId || "",
  });

  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    onSave({
      id: part.id,
      name: formData.name.trim(),
      category: formData.category.trim() || undefined,
      warrantyPeriod: formData.warrantyPeriod.trim() || undefined,
      stock: {
        ...(part.stock || {}),
        [currentBranchId]: formData.stock,
      },
      costPrice: {
        ...(part.costPrice || {}),
        [currentBranchId]: formData.costPrice,
      },
      retailPrice: {
        ...(part.retailPrice || {}),
        [currentBranchId]: formData.retailPrice,
      },
      laborCost: {
        ...((part as any).laborCost || {}),
        [currentBranchId]: formData.laborCost,
      } as any,
      wholesalePrice: {
        ...(part.wholesalePrice || {}),
        [currentBranchId]: formData.laborCost,
      },
      branch_id: formData.branchId || null,
    } as any);
  };


  return (
    <UiModal
      open={true}
      title="Chỉnh sửa sản phẩm"
      onClose={onClose}
      className="max-w-2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4 max-h-[75vh] overflow-y-auto pr-1 custom-scrollbar">
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Tên sản phẩm <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) =>
              setFormData({ ...formData, name: e.target.value })
            }
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Danh mục
          </label>
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">-- Chọn hoặc tạo mới --</option>
                {categories.map((c: any) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setShowInlineCat(true)}
                className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600 font-bold"
                title="Thêm danh mục mới"
              >
                +
              </button>
            </div>
            {showInlineCat && (
              <div className="flex gap-2">
                <input
                  autoFocus
                  type="text"
                  value={inlineCatName}
                  onChange={(e) => setInlineCatName(e.target.value)}
                  placeholder="Nhập tên danh mục mới"
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                />
                <button
                  type="button"
                  onClick={async () => {
                    const trimmed = inlineCatName.trim();
                    if (!trimmed)
                      return showToast.warning("Vui lòng nhập tên danh mục");
                    try {
                      const res = await createCategory.mutateAsync({
                        name: trimmed,
                      });
                      setFormData({ ...formData, category: res.name });
                      setInlineCatName("");
                      setShowInlineCat(false);
                    } catch (err: any) {
                      showToast.error(err?.message || "Lỗi tạo danh mục");
                    }
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                >
                  Lưu
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowInlineCat(false);
                    setInlineCatName("");
                  }}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                >
                  Hủy
                </button>
              </div>
            )}
          </div>
        </div>

        <div className={`grid ${hideLaborCost ? "grid-cols-2" : "grid-cols-3"} gap-4`}>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Giá nhập
            </label>
            <FormattedNumberInput
              value={formData.costPrice || 0}
              onValue={(v) =>
                setFormData({
                  ...formData,
                  costPrice: Math.max(0, Math.round(v)),
                })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Giá bán lẻ
            </label>
            <FormattedNumberInput
              value={formData.retailPrice}
              onValue={(v) =>
                setFormData({
                  ...formData,
                  retailPrice: Math.max(0, Math.round(v)),
                })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
            />
          </div>

          {!hideLaborCost && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tiền công
              </label>
              <FormattedNumberInput
                value={formData.laborCost}
                onValue={(v) =>
                  setFormData({
                    ...formData,
                    laborCost: Math.max(0, Math.round(v)),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
              />
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Bảo hành
            </label>
            <input
              type="text"
              value={formData.warrantyPeriod}
              onChange={(e) =>
                setFormData({ ...formData, warrantyPeriod: e.target.value })
              }
              placeholder="Ví dụ: 12 tháng, 1 năm"
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Tồn kho hiện tại
            </label>
            <input
              type="number"
              value={formData.stock}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  stock: Number(e.target.value),
                })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
              min="0"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Số lượng tồn kho tại chi nhánh hiện tại
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
            Gán sản phẩm cho chi nhánh
          </label>
          <select
            value={formData.branchId}
            onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">Tất cả chi nhánh</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name} ({b.id})
              </option>
            ))}

          </select>
          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
            Sản phẩm được gán cho chi nhánh cụ thể sẽ chỉ hiển thị ở kho chi nhánh đó. Chọn "Tất cả chi nhánh" để hiển thị mọi nơi.
          </p>
        </div>


        {/* Info */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 text-xs">
          <div className="text-blue-800 dark:text-blue-300">
            <div className="font-medium mb-1">Lưu ý:</div>
            <ul className="list-disc list-inside space-y-1">
              <li>
                Bạn có thể chỉnh sửa trực tiếp giá nhập, giá bán, tiền công và tồn kho
              </li>
              <li>
                Hoặc sử dụng "Tạo phiếu nhập" để ghi nhận lịch sử nhập kho chi tiết
              </li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm"
          >
            Hủy
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
          >
            Lưu thay đổi
          </button>
        </div>
      </form>
    </UiModal>
  );
};

export default EditPartModal;
