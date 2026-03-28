import React, { useState, useEffect } from "react";
import { useCategories, useCreateCategory } from "../../../hooks/useCategories";
import { showToast } from "../../../utils/toast";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import { validatePriceAndQty } from "../../../utils/validation";
import type { Part } from "../../../types";

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
  const [formData, setFormData] = useState({
    name: part.name,
    category: part.category || "",
    retailPrice: part.retailPrice?.[currentBranchId] || 0,
    wholesalePrice: part.wholesalePrice?.[currentBranchId] || 0,
    costPrice: part.costPrice?.[currentBranchId] || 0,
    stock: part.stock?.[currentBranchId] || 0,
  });
  const { data: categories = [] } = useCategories();
  const createCategory = useCreateCategory();
  const [showInlineCat, setShowInlineCat] = useState(false);
  const [inlineCatName, setInlineCatName] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast.warning("Vui l�ng nh�p t�n s�n ph�m");
      return;
    }

    onSave({
      id: part.id,
      name: formData.name.trim(),
      category: formData.category.trim() || undefined,
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
      wholesalePrice: {
        ...(part.wholesalePrice || {}),
        [currentBranchId]: formData.wholesalePrice,
      },
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
            Ch�0nh s�a s�n ph�m
          </h2>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              T�n s�n ph�m <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Danh m�c
            </label>
            <div className="flex flex-col gap-2">
              <div className="flex gap-2">
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData({ ...formData, category: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                >
                  <option value="">-- Ch�n ho�c t�o m�:i --</option>
                  {categories.map((c: any) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setShowInlineCat(true)}
                  className="px-3 py-2 bg-white dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-600"
                  title="Th�m danh m�c m�:i"
                >
                  +
                </button>
              </div>
              {showInlineCat && (
                <form
                  onSubmit={async (e) => {
                    e.preventDefault();
                    const trimmed = inlineCatName.trim();
                    if (!trimmed)
                      return showToast.warning("Vui l�ng nh�p t�n danh m�c");
                    try {
                      const res = await createCategory.mutateAsync({
                        name: trimmed,
                      });
                      setFormData({ ...formData, category: res.name });
                      setInlineCatName("");
                      setShowInlineCat(false);
                    } catch (err: any) {
                      showToast.error(err?.message || "L�i t�o danh m�c");
                    }
                  }}
                  className="flex gap-2"
                >
                  <input
                    autoFocus
                    type="text"
                    value={inlineCatName}
                    onChange={(e) => setInlineCatName(e.target.value)}
                    placeholder="Nh�p t�n danh m�c m�:i"
                    className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-sm text-slate-900 dark:text-slate-100"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium"
                  >
                    L�u
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowInlineCat(false);
                      setInlineCatName("");
                    }}
                    className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-600"
                  >
                    H�y
                  </button>
                </form>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Gi� nh�p
              </label>
              <input
                type="number"
                value={formData.costPrice || 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    costPrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Gi� b�n l�
              </label>
              <input
                type="number"
                value={formData.retailPrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    retailPrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Gi� b�n s�0
              </label>
              <input
                type="number"
                value={formData.wholesalePrice}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    wholesalePrice: Number(e.target.value),
                  })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                min="0"
              />
            </div>
          </div>

          {/* Stock adjustment */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              T�n kho hi�!n t�i
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
              className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
              min="0"
            />
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              S� l��ng t�n kho t�i chi nh�nh hi�!n t�i
            </p>
          </div>

          {/* Info */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="text-sm text-blue-800 dark:text-blue-300">
              <div className="font-medium mb-1">L�u �:</div>
              <ul className="list-disc list-inside space-y-1">
                <li>
                  B�n c� th� ch�0nh s�a tr�c ti�p gi� nh�p, gi� b�n v� t�n kho
                </li>
                <li>
                  Ho�c s� d�ng "T�o phi�u nh�p" �� ghi nh�n l�9ch s� nh�p kho chi
                  ti�t
                </li>
              </ul>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              H�y
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              L�u thay ��"i
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EditPartModal;
