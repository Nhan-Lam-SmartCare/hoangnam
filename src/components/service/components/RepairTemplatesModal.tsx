/**
 * RepairTemplatesModal.tsx
 * Component quản lý mẫu sửa chữa thường dùng
 */

import React, { useState, useMemo, useEffect } from "react";
import { Plus, X, Trash2, Search, Package } from "lucide-react";
import { formatCurrency } from "../../../utils/format";
import { NumberInput } from "../../common/NumberInput";
import {
  useRepairTemplates,
  useCreateRepairTemplate,
  useUpdateRepairTemplate,
  useDeleteRepairTemplate,
} from "../../../hooks/useRepairTemplatesRepository";
import type { Part } from "../../../types";

interface TemplatePart {
  name: string;
  quantity: number;
  price: number;
  unit: string;
  sku?: string;
  partId?: string;
}

interface ServiceTemplate {
  id: string;
  name: string;
  description: string;
  duration: number;
  laborCost: number;
  parts: TemplatePart[];
}

interface RepairTemplatesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApplyTemplate: (template: ServiceTemplate) => void;
  parts: Part[];
  currentBranchId: string | null;
}

export function RepairTemplatesModal({
  isOpen,
  onClose,
  onApplyTemplate,
  parts,
  currentBranchId,
}: RepairTemplatesModalProps) {
  // Fetch templates from database
  const { data: repairTemplatesData, isLoading } = useRepairTemplates();
  const createTemplateMutation = useCreateRepairTemplate();
  const updateTemplateMutation = useUpdateRepairTemplate();
  const deleteTemplateMutation = useDeleteRepairTemplate();

  // Local state
  const [showEditor, setShowEditor] = useState(false);
  const [editingTemplate, setEditingTemplate] =
    useState<ServiceTemplate | null>(null);
  const [templateForm, setTemplateForm] = useState({
    id: "",
    name: "",
    description: "",
    duration: 30,
    laborCost: 0,
    parts: [] as TemplatePart[],
  });

  // Part picker modal state
  const [showPartPicker, setShowPartPicker] = useState(false);
  const [partSearchTerm, setPartSearchTerm] = useState("");

  // Convert database format to display format
  const serviceTemplates = useMemo(() => {
    if (!repairTemplatesData) return [];
    return repairTemplatesData.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description || "",
      duration: t.duration,
      laborCost: t.labor_cost,
      parts: t.parts || [],
    }));
  }, [repairTemplatesData]);

  // Filter parts for search - tìm theo tên hoặc SKU
  const filteredParts = useMemo(() => {
    const term = partSearchTerm.toLowerCase().trim();
    if (!term) return parts.slice(0, 20);
    return parts
      .filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term)
      )
      .slice(0, 20);
  }, [parts, partSearchTerm]);

  // Handlers
  const handleCreateTemplate = () => {
    setEditingTemplate(null);
    setTemplateForm({
      id: "",
      name: "",
      description: "",
      duration: 30,
      laborCost: 0,
      parts: [],
    });
    setShowEditor(true);
  };

  const handleEditTemplate = (template: ServiceTemplate) => {
    setEditingTemplate(template);
    setTemplateForm({
      id: template.id,
      name: template.name,
      description: template.description,
      duration: template.duration,
      laborCost: template.laborCost,
      parts: [...template.parts],
    });
    setShowEditor(true);
  };

  const handleSaveTemplate = async () => {
    if (!templateForm.name.trim()) {
      return;
    }

    try {
      if (editingTemplate) {
        await updateTemplateMutation.mutateAsync({
          id: editingTemplate.id,
          updates: {
            name: templateForm.name,
            description: templateForm.description,
            duration: templateForm.duration,
            labor_cost: templateForm.laborCost,
            parts: templateForm.parts,
          },
        });
      } else {
        await createTemplateMutation.mutateAsync({
          name: templateForm.name,
          description: templateForm.description,
          duration: templateForm.duration,
          labor_cost: templateForm.laborCost,
          parts: templateForm.parts,
        });
      }
      setShowEditor(false);
      setEditingTemplate(null);
    } catch (error) {
      console.error("Error saving template:", error);
    }
  };

  const handleDeleteTemplate = async (templateId: string) => {
    if (!confirm("Bạn có chắc muốn xóa mẫu sửa chữa này?")) return;
    try {
      await deleteTemplateMutation.mutateAsync(templateId);
    } catch (error) {
      console.error("Error deleting template:", error);
    }
  };

  // Mở modal chọn phụ tùng
  const handleOpenPartPicker = () => {
    setPartSearchTerm("");
    setShowPartPicker(true);
  };

  // Chọn phụ tùng từ danh sách
  const handleSelectPart = (part: Part) => {
    // Kiểm tra xem phụ tùng đã tồn tại chưa
    const existingIndex = templateForm.parts.findIndex(
      (p) => p.name === part.name
    );

    if (existingIndex >= 0) {
      // Nếu đã có, tăng số lượng
      const updatedParts = [...templateForm.parts];
      updatedParts[existingIndex].quantity += 1;
      setTemplateForm({ ...templateForm, parts: updatedParts });
    } else {
      // Nếu chưa có, thêm mới
      setTemplateForm({
        ...templateForm,
        parts: [
          ...templateForm.parts,
          {
            name: part.name,
            quantity: 1,
            price: part.retailPrice?.[currentBranchId || ""] || 0,
            unit: "cái",
            sku: part.sku || "",
            partId: part.id || "",
          },
        ],
      });
    }
    setShowPartPicker(false);
  };

  const handleRemovePart = (index: number) => {
    setTemplateForm({
      ...templateForm,
      parts: templateForm.parts.filter((_, i) => i !== index),
    });
  };

  const handleUpdatePartQuantity = (index: number, quantity: number) => {
    const updatedParts = [...templateForm.parts];
    updatedParts[index].quantity = Math.max(1, quantity);
    setTemplateForm({ ...templateForm, parts: updatedParts });
  };

  if (!isOpen) return null;

  // Check if mobile
  const isMobile = typeof window !== "undefined" && window.innerWidth < 768;

  return (
    <>
      {/* Main Template List Modal */}
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-0 md:p-4">
        <div
          className={`bg-white dark:bg-[#1e1e2d] w-full h-full md:rounded-xl md:max-w-4xl md:max-h-[90vh] md:h-auto overflow-hidden flex flex-col ${
            isMobile ? "" : "rounded-xl"
          }`}
        >
          {/* Header */}
          <div className="sticky top-0 bg-white dark:bg-[#1e1e2d] border-b border-slate-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between z-10">
            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
              Mẫu sửa chữa thường dùng
            </h2>
            <div className="flex items-center gap-2">
              <button
                onClick={handleCreateTemplate}
                className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs md:text-sm flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden xs:inline">Tạo mẫu mới</span>
                <span className="xs:hidden">Tạo mẫu</span>
              </button>
              <button
                onClick={onClose}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg"
                aria-label="Đóng"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 pb-24 md:pb-6">
            <p className="text-xs md:text-sm text-slate-600 dark:text-gray-400 mb-4">
              Chọn mẫu sửa chữa để tự động điền thông tin vào phiếu sửa chữa
            </p>

            {isLoading ? (
              <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                Đang tải...
              </div>
            ) : serviceTemplates.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-slate-500 dark:text-gray-400 mb-4">
                  Chưa có mẫu sửa chữa nào
                </p>
                <button
                  onClick={handleCreateTemplate}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg"
                >
                  Tạo mẫu đầu tiên
                </button>
              </div>
            ) : (
              <div className="space-y-3 md:grid md:grid-cols-2 md:gap-4 md:space-y-0">
                {serviceTemplates.map((template) => (
                  <div
                    key={template.id}
                    className="bg-[#2b2b40] md:bg-white md:dark:bg-[#2b2b40] border border-gray-700 md:border-slate-200 md:dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition"
                  >
                    {/* Template Header */}
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0 mr-3">
                        <h3 className="font-semibold text-white md:text-slate-900 md:dark:text-white truncate">
                          {template.name}
                        </h3>
                        <p className="text-sm text-gray-400 md:text-slate-500 md:dark:text-gray-400 line-clamp-2">
                          {template.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {template.duration} phút
                        </p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-lg font-bold text-blue-400 md:text-blue-600 md:dark:text-blue-400">
                          {formatCurrency(
                            template.laborCost +
                              template.parts.reduce(
                                (s, p) => s + p.price * p.quantity,
                                0
                              )
                          )}
                        </p>
                      </div>
                    </div>

                    {/* Parts List */}
                    <div className="mt-3 pt-3 border-t border-gray-700 md:border-slate-200 md:dark:border-gray-700">
                      <p className="text-xs font-medium text-gray-300 md:text-slate-600 md:dark:text-gray-300 mb-2">
                        Phụ tùng cần thiết:
                      </p>
                      {template.parts.length === 0 ? (
                        <p className="text-xs text-gray-500">
                          Không có phụ tùng
                        </p>
                      ) : (
                        <div className="space-y-1">
                          {template.parts.slice(0, 3).map((part, idx) => (
                            <div
                              key={idx}
                              className="flex justify-between text-xs text-gray-400 md:text-slate-500 md:dark:text-gray-400"
                            >
                              <span className="truncate flex-1 mr-2">
                                {part.name} x{part.quantity} {part.unit}
                              </span>
                              <span className="flex-shrink-0">
                                {formatCurrency(part.price * part.quantity)}
                              </span>
                            </div>
                          ))}
                          {template.parts.length > 3 && (
                            <p className="text-xs text-gray-500">
                              +{template.parts.length - 3} phụ tùng khác
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action Buttons */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => onApplyTemplate(template)}
                          className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium"
                        >
                          Áp dụng
                        </button>
                        <button
                          onClick={() => handleEditTemplate(template)}
                          className="px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm font-medium"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteTemplate(template.id)}
                          className="px-3 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg text-sm font-medium"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Template Editor Modal */}
      {showEditor && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-0 md:p-4">
          <div
            className={`bg-white dark:bg-[#1e1e2d] w-full h-full md:rounded-xl md:max-w-3xl md:max-h-[90vh] md:h-auto overflow-hidden flex flex-col ${
              isMobile ? "" : "rounded-xl"
            }`}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between bg-white dark:bg-[#1e1e2d]">
              <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                {editingTemplate ? "Sửa mẫu sửa chữa" : "Tạo mẫu sửa chữa mới"}
              </h2>
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingTemplate(null);
                }}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 pb-32 md:pb-4">
              <div className="space-y-4">
                {/* Template Name */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                    Tên mẫu <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="VD: Thay dầu động cơ"
                    value={templateForm.name}
                    onChange={(e) =>
                      setTemplateForm({ ...templateForm, name: e.target.value })
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2b40] text-slate-900 dark:text-white text-sm"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                    Mô tả
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Mô tả chi tiết dịch vụ..."
                    value={templateForm.description}
                    onChange={(e) =>
                      setTemplateForm({
                        ...templateForm,
                        description: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2.5 border border-slate-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2b40] text-slate-900 dark:text-white resize-none text-sm"
                  />
                </div>

                {/* Duration & Labor Cost */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      Thời gian (phút)
                    </label>
                    <input
                      type="number"
                      min="5"
                      step="5"
                      value={templateForm.duration}
                      onChange={(e) =>
                        setTemplateForm({
                          ...templateForm,
                          duration: Number(e.target.value),
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2b40] text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-gray-300 mb-1">
                      Chi phí công
                    </label>
                    <NumberInput
                      placeholder="0"
                      value={templateForm.laborCost || ""}
                      onChange={(val) =>
                        setTemplateForm({
                          ...templateForm,
                          laborCost: val,
                        })
                      }
                      className="w-full px-3 py-2.5 border border-slate-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2b40] text-slate-900 dark:text-white text-sm"
                    />
                  </div>
                </div>

                {/* Parts List */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-gray-300">
                      Phụ tùng cần thiết
                    </label>
                    <button
                      onClick={handleOpenPartPicker}
                      className="px-2.5 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-xs flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Thêm
                    </button>
                  </div>

                  {templateForm.parts.length === 0 ? (
                    <div
                      onClick={handleOpenPartPicker}
                      className="text-center py-6 text-slate-500 dark:text-gray-400 text-sm bg-slate-50 dark:bg-[#2b2b40] rounded-lg cursor-pointer hover:bg-slate-100 dark:hover:bg-[#353550] transition-colors"
                    >
                      <Package className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      Chưa có phụ tùng - Nhấn để thêm
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {templateForm.parts.map((part, index) => (
                        <div
                          key={index}
                          className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-[#2b2b40] rounded-lg"
                        >
                          {/* Part Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                              {part.name}
                            </p>
                            <p className="text-xs text-blue-600 dark:text-blue-400">
                              {formatCurrency(part.price)} / {part.unit}
                            </p>
                          </div>

                          {/* Quantity Controls */}
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() =>
                                handleUpdatePartQuantity(
                                  index,
                                  part.quantity - 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-gray-600 hover:bg-slate-300 dark:hover:bg-gray-500 rounded text-slate-700 dark:text-white font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-medium text-slate-900 dark:text-white">
                              {part.quantity}
                            </span>
                            <button
                              onClick={() =>
                                handleUpdatePartQuantity(
                                  index,
                                  part.quantity + 1
                                )
                              }
                              className="w-7 h-7 flex items-center justify-center bg-slate-200 dark:bg-gray-600 hover:bg-slate-300 dark:hover:bg-gray-500 rounded text-slate-700 dark:text-white font-bold"
                            >
                              +
                            </button>
                          </div>

                          {/* Subtotal */}
                          <div className="text-right w-24 flex-shrink-0">
                            <p className="text-sm font-semibold text-slate-900 dark:text-white">
                              {formatCurrency(part.price * part.quantity)}
                            </p>
                          </div>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleRemovePart(index)}
                            className="p-1.5 text-red-500 hover:bg-red-500/20 rounded-lg flex-shrink-0"
                            title="Xóa"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Total Preview */}
                {(templateForm.laborCost > 0 ||
                  templateForm.parts.length > 0) && (
                  <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
                    <div className="text-sm space-y-1">
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-gray-400">
                          Chi phí công:
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(templateForm.laborCost)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600 dark:text-gray-400">
                          Phụ tùng:
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(
                            templateForm.parts.reduce(
                              (sum, p) => sum + p.price * p.quantity,
                              0
                            )
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between pt-2 border-t border-blue-500/30">
                        <span className="font-medium text-slate-900 dark:text-white">
                          Tổng ước tính:
                        </span>
                        <span className="font-bold text-blue-600 dark:text-blue-400">
                          {formatCurrency(
                            templateForm.laborCost +
                              templateForm.parts.reduce(
                                (sum, p) => sum + p.price * p.quantity,
                                0
                              )
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Footer - Fixed on mobile */}
            <div className="fixed md:relative bottom-0 left-0 right-0 border-t border-slate-200 dark:border-gray-700 px-4 py-3 flex justify-end gap-3 bg-white dark:bg-[#1e1e2d]">
              <button
                onClick={() => {
                  setShowEditor(false);
                  setEditingTemplate(null);
                }}
                className="px-4 py-2.5 bg-slate-200 dark:bg-gray-700 hover:bg-slate-300 dark:hover:bg-gray-600 text-slate-700 dark:text-gray-200 rounded-lg text-sm font-medium"
              >
                Hủy
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={!templateForm.name.trim()}
                className="px-6 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:bg-slate-300 dark:disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm"
              >
                {editingTemplate ? "Cập nhật" : "Tạo mẫu"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Part Picker Modal */}
      {showPartPicker && (
        <div className="fixed inset-0 bg-black/60 flex items-end md:items-center justify-center z-[70]">
          <div className="bg-white dark:bg-[#1e1e2d] w-full md:max-w-lg md:rounded-xl md:mx-4 rounded-t-2xl max-h-[80vh] flex flex-col">
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-700 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                Chọn phụ tùng
              </h3>
              <button
                onClick={() => setShowPartPicker(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-gray-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Search */}
            <div className="px-4 py-3 border-b border-slate-200 dark:border-gray-700">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Tìm theo tên, mã SKU, barcode..."
                  value={partSearchTerm}
                  onChange={(e) => setPartSearchTerm(e.target.value)}
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-gray-600 rounded-lg bg-white dark:bg-[#2b2b40] text-slate-900 dark:text-white text-sm placeholder-gray-400"
                />
              </div>
            </div>

            {/* Parts List */}
            <div className="flex-1 overflow-y-auto">
              {filteredParts.length === 0 ? (
                <div className="text-center py-12 text-slate-500 dark:text-gray-400">
                  <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p>Không tìm thấy phụ tùng</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-200 dark:divide-gray-700">
                  {filteredParts.map((part) => {
                    const stock = part.stock?.[currentBranchId || ""] || 0;
                    const price =
                      part.retailPrice?.[currentBranchId || ""] || 0;
                    const isAlreadyAdded = templateForm.parts.some(
                      (p) => p.name === part.name
                    );

                    return (
                      <button
                        key={part.id}
                        onClick={() => handleSelectPart(part)}
                        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-gray-700/50 text-left transition-colors"
                      >
                        {/* Part Icon */}
                        <div className="w-10 h-10 bg-blue-500/10 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Package className="w-5 h-5 text-blue-500" />
                        </div>

                        {/* Part Info */}
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-slate-900 dark:text-white text-sm truncate">
                            {part.name}
                          </p>
                          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-gray-400">
                            {part.sku && <span>SKU: {part.sku}</span>}
                            <span>Tồn: {stock}</span>
                          </div>
                        </div>

                        {/* Price & Status */}
                        <div className="text-right flex-shrink-0">
                          <p className="font-semibold text-blue-600 dark:text-blue-400 text-sm">
                            {formatCurrency(price)}
                          </p>
                          {isAlreadyAdded && (
                            <span className="text-xs text-green-500">
                              Đã thêm
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
