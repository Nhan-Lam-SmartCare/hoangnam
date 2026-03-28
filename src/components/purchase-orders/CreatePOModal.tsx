import React, { useState, useMemo, useRef } from "react";
import {
  X,
  Plus,
  Trash2,
  Search,
  ShoppingCart,
  AlertCircle,
  Package,
  Filter,
  FileText,
  Edit3,
  Share2, // Changed from Printer to Share2
} from "lucide-react";
import { useSuppliers } from "../../hooks/useSuppliers";
import { useParts } from "../../hooks/useSupabase";
import { useCreatePurchaseOrder, useUpdatePurchaseOrderFull } from "../../hooks/usePurchaseOrders";
import { useAppContext } from "../../contexts/AppContext";
import { useCategories } from "../../hooks/useCategories";
import { useCreatePartRepo } from "../../hooks/usePartsRepository";
import { formatCurrency } from "../../utils/format";
import { showToast } from "../../utils/toast";
import FormattedNumberInput from "../common/FormattedNumberInput";
import SupplierModal from "../inventory/components/SupplierModal";
import { useStoreSettings } from "../../hooks/useStoreSettings";
import html2canvas from "html2canvas";
import type { CreatePurchaseOrderInput, Part, PurchaseOrder } from "../../types";

interface CreatePOModalProps {
  isOpen: boolean;
  onClose: () => void;
  prefilledPartIds?: string[];
  existingPO?: PurchaseOrder;
}

interface POItem {
  part_id: string;
  quantity_ordered: number;
  unit_price: number;
}

export const CreatePOModal: React.FC<CreatePOModalProps> = ({
  isOpen,
  onClose,
  prefilledPartIds = [],
  existingPO,
}) => {
  const { currentBranchId } = useAppContext();
  const branchId = currentBranchId || "";
  const { data: suppliers = [] } = useSuppliers();
  const { data: allParts = [] } = useParts();
  const { data: categories = [] } = useCategories();
  const createPOMutation = useCreatePurchaseOrder();
  const updatePOFullMutation = useUpdatePurchaseOrderFull(); // ✅ New hook
  const createPartMutation = useCreatePartRepo();
  const { data: storeSettings } = useStoreSettings();

  const [supplierId, setSupplierId] = useState(existingPO?.supplier_id || "");
  const [expectedDate, setExpectedDate] = useState(() => {
    if (existingPO?.expected_date) return existingPO.expected_date.split("T")[0];
    const date = new Date();
    date.setDate(date.getDate() + 7); // Default to 7 days from now
    return date.toISOString().split("T")[0];
  });
  const [notes, setNotes] = useState(existingPO?.notes || "");
  const [showCreateProduct, setShowCreateProduct] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [items, setItems] = useState<POItem[]>(() => {
    if (existingPO && existingPO.items) {
      return existingPO.items.map((item: any) => ({
        part_id: item.part_id,
        quantity_ordered: item.quantity_ordered,
        unit_price: item.unit_price,
      }));
    }
    return prefilledPartIds.map((id: string) => {
      const part = allParts.find((p) => p.id === id);
      const costPrice = part?.costPrice
        ? typeof part.costPrice === "object"
          ? part.costPrice[branchId] || 0
          : part.costPrice
        : 0;
      return {
        part_id: id,
        quantity_ordered: 1,
        unit_price: costPrice,
      };
    });
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [showLowStockOnly, setShowLowStockOnly] = useState(!existingPO); // If editing, show all by default
  const [selectedPartIds, setSelectedPartIds] = useState<Set<string>>(
    new Set(existingPO ? existingPO.items?.map((i: any) => i.part_id) : prefilledPartIds)
  );
  const [showMobileCart, setShowMobileCart] = useState(false);

  const [newlyCreatedParts, setNewlyCreatedParts] = useState<Part[]>([]);

  // Merge allParts with newlyCreatedParts to ensure immediate UI update
  const effectiveAllParts = useMemo(() => {
    const combined = [...allParts];
    newlyCreatedParts.forEach(np => {
      if (!combined.find(p => p.id === np.id)) {
        combined.push(np);
      }
    });
    return combined;
  }, [allParts, newlyCreatedParts]);

  const partsMap = useMemo(() => {
    const map = new Map();
    effectiveAllParts.forEach((p) => map.set(p.id, p));
    return map;
  }, [effectiveAllParts]);

  // Filter parts: Low stock (< 2) + search + category
  const filteredParts = useMemo(() => {
    let filtered = effectiveAllParts;

    // Filter by low stock - Only apply if NO search term
    // If searching, we want to find ANY product matching the name/sku
    if (showLowStockOnly && !searchTerm) {
      filtered = filtered.filter((p) => {
        const stock =
          typeof p.stock === "object" ? p.stock[branchId] || 0 : p.stock || 0;
        return stock < 2;
      });
    }

    // Filter by category
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.category === categoryFilter);
    }

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(term) ||
          p.barcode?.toLowerCase().includes(term) ||
          p.sku?.toLowerCase().includes(term) ||
          p.category?.toLowerCase().includes(term)
      );
    }

    // Sort by stock (lowest first)
    return filtered.sort((a, b) => {
      const stockA =
        typeof a.stock === "object" ? a.stock[branchId] || 0 : a.stock || 0;
      const stockB =
        typeof b.stock === "object" ? b.stock[branchId] || 0 : b.stock || 0;
      return stockA - stockB;
    });
  }, [effectiveAllParts, showLowStockOnly, categoryFilter, searchTerm, branchId]);

  const togglePartSelection = (partId: string) => {
    const newSelected = new Set(selectedPartIds);
    if (newSelected.has(partId)) {
      newSelected.delete(partId);
      // Remove from cart
      setItems(items.filter((item) => item.part_id !== partId));
    } else {
      newSelected.add(partId);
      // Add to cart
      const part = partsMap.get(partId);
      const costPrice = part?.costPrice
        ? typeof part.costPrice === "object"
          ? part.costPrice[branchId] || 0
          : part.costPrice
        : 0;
      setItems([
        ...items,
        {
          part_id: partId,
          quantity_ordered: 1,
          unit_price: costPrice,
        },
      ]);
    }
    setSelectedPartIds(newSelected);
  };

  const updateItem = (partId: string, field: keyof POItem, value: number) => {
    setItems(
      items.map((item) =>
        item.part_id === partId ? { ...item, [field]: value } : item
      )
    );
  };

  const previewRef = useRef<HTMLDivElement>(null);

  const handleShareImage = async () => {
    if (!previewRef.current) return;

    try {
      showToast.info("Đang tạo hình ảnh...");

      const canvas = await html2canvas(previewRef.current, {
        backgroundColor: "#ffffff",
        scale: 2,
        useCORS: true,
      });

      canvas.toBlob(async (blob) => {
        if (!blob) {
          showToast.error("Không thể tạo hình ảnh");
          return;
        }

        const file = new File([blob], `don-hang-${Date.now()}.png`, { type: "image/png" });

        // Check if Web Share API is supported
        if (navigator.share && navigator.canShare({ files: [file] })) {
          try {
            await navigator.share({
              title: "Phiếu đặt hàng",
              text: `Phiếu đặt hàng - ${storeSettings?.store_name || "MotoCare"}`,
              files: [file],
            });
            showToast.success("Đã chia sẻ thành công!");
          } catch (err: any) {
            if (err.name !== "AbortError") {
              showToast.error("Lỗi khi chia sẻ");
            }
          }
        } else {
          // Fallback: Download the image
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `don-hang-${Date.now()}.png`;
          link.click();
          URL.revokeObjectURL(url);
          showToast.success("Đã tải hình ảnh xuống!");
        }
      }, "image/png");
    } catch (error) {
      console.error("Error generating image:", error);
      showToast.error("Không thể tạo hình ảnh");
    }
  };

  const removeItem = (partId: string) => {
    setItems(items.filter((item) => item.part_id !== partId));
    const newSelected = new Set(selectedPartIds);
    newSelected.delete(partId);
    setSelectedPartIds(newSelected);
  };

  const handleSubmit = async () => {
    if (!supplierId) {
      showToast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    if (items.length === 0) {
      showToast.error("Vui lòng thêm ít nhất 1 sản phẩm");
      return;
    }
    if (
      items.some((item) => item.quantity_ordered <= 0 || item.unit_price < 0)
    ) {
      showToast.error("Số lượng và đơn giá phải hợp lệ");
      return;
    }

    const input: CreatePurchaseOrderInput = {
      supplier_id: supplierId,
      branch_id: branchId,
      expected_date: expectedDate || undefined,
      notes: notes || undefined,
      items,
    };

    try {
      if (existingPO) {
        // Update existing PO
        await updatePOFullMutation.mutateAsync({
          id: existingPO.id,
          input
        });
        showToast.success("Đã cập nhật đơn đặt hàng");
      } else {
        // Create new PO
        await createPOMutation.mutateAsync(input);
        showToast.success("Đã tạo đơn đặt hàng");
      }

      onClose();
      // Reset form
      if (!existingPO) {
        setSupplierId("");
        const resetDate = new Date();
        resetDate.setDate(resetDate.getDate() + 7);
        setExpectedDate(resetDate.toISOString().split("T")[0]);
        setNotes("");
        setItems([]);
      }
    } catch (error) {
      console.error("Error creating/updating PO:", error);
      showToast.error("Lỗi khi lưu đơn đặt hàng");
    }
  };

  const totalAmount = items.reduce(
    (sum, item) => sum + item.quantity_ordered * item.unit_price,
    0
  );

  if (!isOpen) return null;

  console.log("CreatePOModal rendering:", {
    isOpen,
    prefilledPartIds,
    itemsCount: items.length,
    filteredPartsCount: filteredParts.length,
  });

  return (
    <>
      <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] sm:p-4 print:p-0">
        <div className="bg-white dark:bg-slate-800 rounded-none sm:rounded-lg shadow-xl w-full h-full sm:h-auto sm:max-w-7xl sm:max-h-[95vh] overflow-hidden flex flex-col print:shadow-none print:h-auto print:w-full">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 sm:py-2 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-blue-700 print:hidden">
            <div className="flex items-center gap-2">
              <ShoppingCart className="w-5 h-5 text-white" />
              <h2 className="text-base sm:text-base font-semibold text-white">
                {showPreview ? "Xem mẫu phiếu đặt hàng" : "Tạo đơn đặt hàng mới"}
              </h2>
            </div>
            <div className="flex items-center gap-2">
              {!showPreview ? (
                <button
                  onClick={() => items.length > 0 ? setShowPreview(true) : showToast.warning("Vui lòng chọn sản phẩm trước")}
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium border border-white/20"
                >
                  <FileText className="w-4 h-4" />
                  <span>Xem mẫu in</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={handleShareImage}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors text-sm font-medium border border-white/20"
                  >
                    <Share2 className="w-4 h-4" />
                    <span>Chia sẻ</span>
                  </button>
                  <button
                    onClick={() => setShowPreview(false)}
                    className="flex items-center gap-2 px-3 py-1.5 bg-white text-blue-700 hover:bg-slate-100 rounded-lg transition-colors text-sm font-medium shadow-sm"
                  >
                    <Edit3 className="w-4 h-4" />
                    <span>Chỉnh sửa</span>
                  </button>
                </>
              )}
              <button
                onClick={onClose}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 sm:w-4 sm:h-4 text-white" />
              </button>
            </div>
          </div>

          {/* PREVIEW MODE */}
          {showPreview ? (
            <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 p-4 sm:p-8 flex justify-center print:p-0 print:bg-white print:overflow-visible">
              <div ref={previewRef} className="bg-white w-full max-w-[210mm] min-h-[297mm] shadow-lg p-8 rounded-sm text-slate-900 relative print:shadow-none print:w-full print:min-h-0 print:p-0">
                {/* Official Document Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-800 pb-4 mb-6">
                  <div>
                    <h1 className="text-2xl font-bold uppercase tracking-wider mb-1">Phiếu Đặt Hàng</h1>
                    <p className="text-sm text-slate-500 font-mono">#{new Date().getTime().toString().slice(-8)}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-3 mb-2">
                      {storeSettings?.logo_url ? (
                        <img src={storeSettings.logo_url} alt="Logo" className="w-12 h-12 object-contain rounded" />
                      ) : (
                        <div className="w-10 h-10 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-xl print:bg-black print:text-white">
                          {storeSettings?.store_name?.charAt(0) || "M"}
                        </div>
                      )}
                      <div className="text-right">
                        <div className="font-bold text-lg text-slate-900 leading-tight">{storeSettings?.store_name || "MotoCare Store"}</div>
                        <div className="text-xs text-blue-600 font-medium italic print:text-black">{storeSettings?.slogan || "Phụ tùng chính hãng"}</div>
                      </div>
                    </div>
                    <div className="text-sm text-slate-500">{storeSettings?.address || "---"}</div>
                    <div className="text-sm text-slate-500">Hotline: {storeSettings?.phone || "---"}</div>
                  </div>
                </div>

                {/* Order Info */}
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div>
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Nhà cung cấp</div>
                    <div className="font-semibold text-lg">{suppliers.find(s => s.id === supplierId)?.name || "---"}</div>
                    <div className="text-sm text-slate-600 mt-1">{suppliers.find(s => s.id === supplierId)?.phone || "SĐT: ---"}</div>
                    <div className="text-sm text-slate-600">{suppliers.find(s => s.id === supplierId)?.address || "Địa chỉ: ---"}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-xs font-bold text-slate-400 uppercase mb-1">Dự kiến giao hàng</div>
                    <div className="font-semibold">{expectedDate ? new Date(expectedDate).toLocaleDateString('vi-VN') : "---"}</div>
                    <div className="mt-4 text-xs font-bold text-slate-400 uppercase mb-1">Ghi chú</div>
                    <div className="text-sm italic text-slate-700">{notes || "Không có ghi chú"}</div>
                  </div>
                </div>

                {/* Table */}
                <table className="w-full mb-8">
                  <thead>
                    <tr className="bg-slate-100 text-slate-700 border-b border-slate-300">
                      <th className="py-2 px-3 text-left w-12 text-sm font-semibold">STT</th>
                      <th className="py-2 px-3 text-left text-sm font-semibold">Tên sản phẩm / Mã hàng</th>
                      <th className="py-2 px-3 text-right w-24 text-sm font-semibold">Số lượng</th>
                      <th className="py-2 px-3 text-right w-32 text-sm font-semibold">Đơn giá</th>
                      <th className="py-2 px-3 text-right w-32 text-sm font-semibold">Thành tiền</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {items.map((item, index) => {
                      const part = partsMap.get(item.part_id);
                      return (
                        <tr key={index}>
                          <td className="py-3 px-3 text-sm text-slate-500">{index + 1}</td>
                          <td className="py-3 px-3">
                            <div className="text-sm font-medium text-slate-900">{part?.name}</div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-slate-500 font-mono">{part?.sku || part?.barcode}</span>
                              {part?.category && (
                                <span className="px-1.5 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 rounded">
                                  {part.category}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-3 text-right text-sm font-medium">{item.quantity_ordered}</td>
                          <td className="py-3 px-3 text-right text-sm text-slate-600">{formatCurrency(item.unit_price)}</td>
                          <td className="py-3 px-3 text-right text-sm font-bold text-slate-900">{formatCurrency(item.quantity_ordered * item.unit_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-slate-300">
                      <td colSpan={4} className="py-4 px-3 text-right text-base font-bold uppercase text-slate-700">Tổng cộng</td>
                      <td className="py-4 px-3 text-right text-lg font-bold text-blue-600">{formatCurrency(totalAmount)}</td>
                    </tr>
                  </tfoot>
                </table>

                {/* Footer Signature */}
                <div className="grid grid-cols-2 gap-8 mt-12 pt-12 border-t border-dashed border-slate-300">
                  <div className="text-center">
                    <div className="font-bold text-sm uppercase text-slate-500 mb-20">Người lập phiếu</div>
                    <div className="font-medium text-slate-900">....................................</div>
                  </div>
                  <div className="text-center">
                    <div className="font-bold text-sm uppercase text-slate-500 mb-20">Xác nhận nhà cung cấp</div>
                    <div className="font-medium text-slate-900">....................................</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Body - Split Layout (Standard Mode) */
            /* Modified for 50/50 split on desktop */
            <div className="flex-1 overflow-hidden flex flex-col sm:flex-row">
              {/* Left: Product Selection - Width 50% on desktop */}
              <div className="flex-1 sm:w-1/2 flex flex-col border-r border-slate-200 dark:border-slate-700">
                {/* Filters */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 space-y-3">
                  {/* Search & Create Button */}
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Tìm theo tên, SKU, mã vạch..."
                        className="w-full pl-9 pr-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowCreateProduct(true)}
                      className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium whitespace-nowrap"
                      title="Tạo sản phẩm mới"
                    >
                      <Plus className="w-4 h-4" />
                      Tạo mới
                    </button>
                  </div>

                  {/* Filter Pills */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* Category Dropdown */}
                    <select
                      value={categoryFilter}
                      onChange={(e) => setCategoryFilter(e.target.value)}
                      className="px-3 py-1 border border-slate-300 dark:border-slate-600 rounded-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-medium focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">Tất cả danh mục</option>
                      {categories.map((cat: any) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </select>

                    <button
                      onClick={() => setShowLowStockOnly(false)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${!showLowStockOnly
                        ? "bg-slate-600 text-white"
                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                        }`}
                    >
                      <span>Tất cả</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${!showLowStockOnly
                          ? "bg-white/20 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        {allParts.length}
                      </span>
                    </button>

                    <button
                      onClick={() => setShowLowStockOnly(true)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium transition ${showLowStockOnly
                        ? "bg-red-600 text-white"
                        : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 hover:bg-red-100"
                        }`}
                    >
                      <span>Sắp hết</span>
                      <span
                        className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${showLowStockOnly
                          ? "bg-white/20 text-white"
                          : "bg-red-200 dark:bg-red-800 text-red-700 dark:text-red-300"
                          }`}
                      >
                        {
                          allParts.filter((p) => {
                            const stock =
                              typeof p.stock === "object"
                                ? p.stock[branchId] || 0
                                : p.stock || 0;
                            return stock < 2;
                          }).length
                        }
                      </span>
                    </button>
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                    <span>{filteredParts.length} sản phẩm</span>
                    <span>{selectedPartIds.size} đã chọn</span>
                  </div>
                </div>

                {/* Product List */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {filteredParts.length === 0 ? (
                    <div className="text-center py-16">
                      <Package className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-slate-500 dark:text-slate-400 mb-4">
                        Không tìm thấy sản phẩm
                      </p>
                      {searchTerm && (
                        <div className="flex flex-col items-center gap-2">
                          <p className="text-sm text-slate-600 dark:text-slate-400">
                            Bạn đang tìm:{" "}
                            <span className="font-semibold">"{searchTerm}"</span>
                          </p>
                          <button
                            onClick={() => setShowCreateProduct(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors text-sm font-medium"
                          >
                            <Plus className="w-4 h-4" />
                            Tạo sản phẩm mới
                          </button>
                          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                            Hoặc thử tìm kiếm với từ khóa khác
                          </p>
                        </div>
                      )}
                    </div>
                  ) : (
                    filteredParts.map((part) => {
                      const isSelected = selectedPartIds.has(part.id);
                      const stock =
                        typeof part.stock === "object"
                          ? part.stock[branchId] || 0
                          : part.stock || 0;
                      const isLowStock = stock < 2;

                      return (
                        <div
                          key={part.id}
                          onClick={() => togglePartSelection(part.id)}
                          className={`p-3 rounded-lg border cursor-pointer transition-all ${isSelected
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-950/20"
                            : "border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                            }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Info */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <div className="font-medium text-slate-900 dark:text-slate-100 text-sm">
                                    {part.name}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-500 mt-0.5">
                                    SKU: {part.sku || part.barcode || "—"} •{" "}
                                    {part.category}
                                  </div>
                                </div>

                                {/* Stock Badge */}
                                <div
                                  className={`px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap ${stock === 0
                                    ? "bg-red-100 dark:bg-red-950/50 text-red-700 dark:text-red-300"
                                    : isLowStock
                                      ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300"
                                      : "bg-green-100 dark:bg-green-950/50 text-green-700 dark:text-green-300"
                                    }`}
                                >
                                  Tồn: {stock}
                                </div>
                              </div>

                              <div className="mt-1 flex items-center gap-4 text-sm">
                                <div className="text-slate-600 dark:text-slate-400">
                                  Giá nhập:{" "}
                                  <span className="font-medium text-blue-600 dark:text-blue-400">
                                    {formatCurrency(
                                      typeof part.costPrice === "object"
                                        ? part.costPrice[branchId] || 0
                                        : part.costPrice || 0
                                    )}
                                  </span>
                                </div>
                                <div className="text-slate-600 dark:text-slate-400">
                                  Giá bán:{" "}
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    {formatCurrency(
                                      typeof part.retailPrice === "object"
                                        ? part.retailPrice[branchId] || 0
                                        : part.retailPrice || 0
                                    )}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Mobile: Sticky Cart Button */}
                <div className="sm:hidden fixed bottom-0 left-0 right-0 p-4 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 z-40">
                  <button
                    onClick={() => setShowMobileCart(true)}
                    className="w-full flex items-center justify-between px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium shadow-lg"
                  >
                    <div className="flex items-center gap-2">
                      <ShoppingCart className="w-5 h-5" />
                      <span>Xem giỏ hàng</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm">{formatCurrency(totalAmount)}</span>
                      {items.length > 0 && (
                        <span className="px-2 py-0.5 bg-white/20 rounded-full text-xs font-bold">
                          {items.length}
                        </span>
                      )}
                    </div>
                  </button>
                </div>
              </div>

              {/* Right: Shopping Cart - Width 50% on desktop */}
              <div className={`${showMobileCart ? 'fixed inset-0 z-50' : 'hidden'} sm:flex sm:inset-auto sm:z-auto w-full sm:w-1/2 flex-col bg-slate-50 dark:bg-slate-900`}>
                {/* Cart Header */}
                <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between sm:block">
                  {/* Mobile close button */}
                  <h3 className="font-semibold text-slate-900 dark:text-slate-100 sm:hidden">Giỏ hàng</h3>
                  <button
                    onClick={() => setShowMobileCart(false)}
                    className="sm:hidden w-9 h-9 flex items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  {/* Desktop header */}
                  <div className="hidden sm:block">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                        Giỏ hàng
                      </h3>
                      <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded text-xs font-medium">
                        {items.length} sản phẩm
                      </span>
                    </div>
                  </div>

                  {/* Supplier & Date */}
                  <div className="space-y-3">
                    {/* Supplier */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        <Package className="w-3.5 h-3.5" />
                        Nhà cung cấp
                      </label>
                      <div className="flex gap-2">
                        <select
                          value={supplierId}
                          onChange={(e) => setSupplierId(e.target.value)}
                          className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">-- Chọn nhà cung cấp --</option>
                          {suppliers.map((s) => (
                            <option key={s.id} value={s.id}>
                              {s.name}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => setShowSupplierModal(true)}
                          className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors"
                          title="Thêm nhà cung cấp mới"
                        >
                          <Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                  </div>
                </div>

                {/* Cart Items */}
                <div className="flex-1 overflow-y-auto p-4 space-y-2">
                  {items.length === 0 ? (
                    <div className="text-center py-16">
                      <ShoppingCart className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
                      <p className="text-slate-500 dark:text-slate-400 text-sm">
                        Chưa có sản phẩm nào
                      </p>
                      <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
                        Chọn sản phẩm bên trái
                      </p>
                    </div>
                  ) : (
                    items.map((item) => {
                      const part = partsMap.get(item.part_id);
                      if (!part) return null;
                      const itemTotal = item.quantity_ordered * item.unit_price;

                      return (
                        <div
                          key={item.part_id}
                          className="group p-3 bg-white dark:bg-slate-800 rounded-md border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-blue-300 dark:hover:border-blue-500 transition-all duration-200"
                        >
                          {/* Top: Name & Info */}
                          <div className="flex justify-between items-start gap-2 mb-2">
                            <div className="min-w-0">
                              <div className="font-semibold text-slate-800 dark:text-slate-100 text-sm truncate" title={part.name}>
                                {part.name}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-slate-500 dark:text-slate-500 font-mono">
                                  {part.sku || part.barcode}
                                </span>
                                {part.category && (
                                  <span className="px-1.5 py-0.5 text-[10px] font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded">
                                    {part.category}
                                  </span>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={() => removeItem(item.part_id)}
                              className="text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 p-1 rounded transition-colors opacity-0 group-hover:opacity-100"
                              title="Xóa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Bottom: Inputs */}
                          <div className="flex items-center gap-2">
                            {/* Qty */}
                            <div className="w-14">
                              <input
                                type="text"
                                inputMode="numeric"
                                value={item.quantity_ordered}
                                onChange={(e) =>
                                  updateItem(
                                    item.part_id,
                                    "quantity_ordered",
                                    parseInt(e.target.value.replace(/[^0-9]/g, "")) || 1
                                  )
                                }
                                onClick={(e) => e.currentTarget.select()}
                                className="w-full px-1 py-1 h-8 text-center text-sm font-medium border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 transition-colors"
                              />
                            </div>

                            <span className="text-slate-400 text-xs">x</span>

                            {/* Price */}
                            <div className="w-28">
                              <FormattedNumberInput
                                value={item.unit_price}
                                onValue={(val: number) =>
                                  updateItem(item.part_id, "unit_price", val)
                                }
                                className="w-full px-2 py-1 h-8 text-right text-sm font-medium border border-slate-300 dark:border-slate-600 rounded bg-slate-50 dark:bg-slate-900 focus:bg-white dark:focus:bg-slate-800 focus:ring-2 focus:ring-blue-500 transition-colors"
                              />
                            </div>

                            {/* Spacer & Equals */}
                            <div className="flex-1 border-b border-dashed border-slate-200 dark:border-slate-700 mx-2"></div>

                            {/* Total */}
                            <div className="text-right text-sm font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {formatCurrency(itemTotal)}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Cart Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800">
                  {/* Date & Notes - 2 columns */}
                  <div className="grid grid-cols-[auto_1fr] gap-3 mb-3">
                    {/* Expected Delivery Date */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        <AlertCircle className="w-3.5 h-3.5" />
                        Ngày giao hàng
                      </label>
                      <input
                        type="date"
                        value={expectedDate}
                        onChange={(e) => setExpectedDate(e.target.value)}
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                    {/* Notes */}
                    <div>
                      <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                        <FileText className="w-3.5 h-3.5" />
                        Ghi chú
                      </label>
                      <textarea
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        rows={1}
                        placeholder="Nhập ghi chú..."
                        className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm focus:ring-2 focus:ring-blue-500 resize-none"
                      />
                    </div>
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between mb-3 pb-3 border-b border-slate-200 dark:border-slate-700">
                    <span className="font-semibold text-slate-900 dark:text-slate-100">
                      Tổng cộng:
                    </span>
                    <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {formatCurrency(totalAmount)}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <button
                      onClick={onClose}
                      className="flex-1 px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors text-sm font-medium"
                    >
                      Hủy
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={createPOMutation.isPending || items.length === 0}
                      className="flex-1 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
                    >
                      {createPOMutation.isPending ? "Đang tạo..." : "Tạo đơn"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Create Product Modal */}
          {showCreateProduct && (
            <CreateProductModal
              onClose={() => setShowCreateProduct(false)}
              onCreated={(newPart) => {
                setShowCreateProduct(false);
                setNewlyCreatedParts((prev) => [...prev, newPart]); // Add to local state

                // Auto-select the newly created product
                const costPrice =
                  typeof newPart.costPrice === "object"
                    ? newPart.costPrice[branchId] || 0
                    : newPart.costPrice || 0;
                setSelectedPartIds(new Set([...selectedPartIds, newPart.id]));
                setItems([
                  ...items,
                  {
                    part_id: newPart.id,
                    quantity_ordered: 1,
                    unit_price: costPrice,
                  },
                ]);
                showToast.success("Đã tạo và thêm sản phẩm vào đơn hàng");
              }}
            />
          )}
        </div>
      </div>

      {/* Supplier Modal */}
      <SupplierModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        mode="add"
        onSave={(newSupplier) => {
          if (newSupplier && newSupplier.id) {
            setSupplierId(newSupplier.id);
          }
          setShowSupplierModal(false);
        }}
      />
    </>
  );
};

// Create Product Modal Component
interface CreateProductModalProps {
  onClose: () => void;
  onCreated: (part: Part) => void;
}

const CreateProductModal: React.FC<CreateProductModalProps> = ({
  onClose,
  onCreated,
}) => {
  const { currentBranchId } = useAppContext();
  const branchId = currentBranchId || "";
  const { data: categories = [] } = useCategories();
  const createPartMutation = useCreatePartRepo();

  const [formData, setFormData] = useState({
    name: "",
    sku: "",
    barcode: "",
    category: "",
    costPrice: 0,
    retailPrice: 0,
    wholesalePrice: 0,
    stock: 0,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name.trim()) {
      showToast.warning("Vui lòng nhập tên sản phẩm");
      return;
    }

    try {
      const newPart = await createPartMutation.mutateAsync({
        name: formData.name.trim(),
        sku: formData.sku.trim() || `SP-${Date.now()}`,
        barcode: formData.barcode.trim(),
        category: formData.category,
        stock: { [branchId]: formData.stock },
        retailPrice: { [branchId]: formData.retailPrice },
        wholesalePrice: { [branchId]: formData.wholesalePrice },
        costPrice: { [branchId]: formData.costPrice },
      });

      showToast.success("Tạo sản phẩm thành công");
      onCreated(newPart);
    } catch (error) {
      console.error("Error creating part:", error);
      showToast.error("Lỗi khi tạo sản phẩm");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-green-600 to-green-700">
          <div className="flex items-center gap-2">
            <Plus className="w-5 h-5 text-white" />
            <h2 className="text-base font-semibold text-white">
              Tạo sản phẩm mới
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
          >
            <X className="w-4 h-4 text-white" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* Name */}
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
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
                placeholder="Nhập tên sản phẩm"
                autoFocus
              />
            </div>

            {/* SKU & Barcode */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mã SKU
                </label>
                <input
                  type="text"
                  value={formData.sku}
                  onChange={(e) =>
                    setFormData({ ...formData, sku: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
                  placeholder="Tự động nếu để trống"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Mã vạch
                </label>
                <input
                  type="text"
                  value={formData.barcode}
                  onChange={(e) =>
                    setFormData({ ...formData, barcode: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
                  placeholder="Mã vạch sản phẩm"
                />
              </div>
            </div>

            {/* Category */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Danh mục
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value })
                }
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
              >
                <option value="">-- Chọn danh mục --</option>
                {categories.map((cat: any) => (
                  <option key={cat.id} value={cat.name}>
                    {cat.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Prices */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Giá nhập
                </label>
                <FormattedNumberInput
                  value={formData.costPrice}
                  onValue={(value) =>
                    setFormData({ ...formData, costPrice: value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Giá bán lẻ
                </label>
                <FormattedNumberInput
                  value={formData.retailPrice}
                  onValue={(value) =>
                    setFormData({ ...formData, retailPrice: value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Giá bán sỉ
                </label>
                <FormattedNumberInput
                  value={formData.wholesalePrice}
                  onValue={(value) =>
                    setFormData({ ...formData, wholesalePrice: value })
                  }
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>

            {/* Stock */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Tồn kho ban đầu
              </label>
              <FormattedNumberInput
                value={formData.stock}
                onValue={(value) => setFormData({ ...formData, stock: value })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-green-500"
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-200 dark:border-slate-700">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={createPartMutation.isPending}
              className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {createPartMutation.isPending ? "Đang tạo..." : "Tạo sản phẩm"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreatePOModal;
