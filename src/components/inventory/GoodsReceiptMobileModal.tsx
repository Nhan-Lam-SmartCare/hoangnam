import React, { useState, useRef, useEffect, useMemo } from "react";
import { 
  X, 
  Search, 
  Scan, 
  Camera, 
  Plus, 
  User, 
  ChevronRight, 
  Trash2, 
  Barcode, 
  ArrowLeft, 
  Minus,
  Check
} from "lucide-react";
import { formatCurrency } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import { SupplierSelectionModal } from "./SupplierSelectionModal";
import { useSuppliers } from "../../hooks/useSuppliers";
import { showToast } from "../../utils/toast";
import BarcodeScannerModal from "../common/BarcodeScannerModal";
import { NumberInput } from "../common/NumberInput";
import {
  calcSellingFromRule,
  getCategoryPricingRule,
  type RoundingRule,
} from "../../utils/categoryPricingRules";

interface Part {
  id: string;
  name: string;
  sku: string;
  stock: { [branchId: string]: number };
  costPrice?: { [branchId: string]: number };
  retailPrice: { [branchId: string]: number };
  wholesalePrice?: { [branchId: string]: number };
  category?: string;
  barcode?: string;
}

interface ReceiptItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  importPrice: number;
  laborCost?: number;
  sellingPrice: number;
  wholesalePrice: number;
  markupPercent: number;
  roundingRule: RoundingRule;
  imei?: string;
  color?: string;
}

const DEFAULT_MARKUP_PERCENT = 50;

const calcMarkupPercent = (importPrice: number, sellingPrice: number) => {
  if (importPrice <= 0 || sellingPrice <= 0) return DEFAULT_MARKUP_PERCENT;
  return Math.max(0, Math.round(((sellingPrice / importPrice) - 1) * 100));
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  parts: Part[];
  receiptItems: ReceiptItem[];
  setReceiptItems: React.Dispatch<React.SetStateAction<ReceiptItem[]>>;
  selectedSupplier: string;
  setSelectedSupplier: (id: string) => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  onSave: () => void;
  discount: number;
  setDiscount: (val: number) => void;
  discountType: "amount" | "percent";
  setDiscountType: (type: "amount" | "percent") => void;
  paymentMethod: "cash" | "bank";
  setPaymentMethod: (method: "cash" | "bank") => void;
  paymentType: "full" | "partial" | "note";
  setPaymentType: (type: "full" | "partial" | "note") => void;
  partialAmount: number;
  setPartialAmount: (val: number) => void;
  showAddProductModal: boolean;
  setShowAddProductModal: (show: boolean) => void;
  onAddNewProduct: (productData: any) => void;
  currentBranchId: string;
  canViewImportPrice?: boolean;
  canCreatePart?: boolean;
  isSubmitting?: boolean;
}

export const GoodsReceiptMobileModal: React.FC<Props> = ({
  isOpen,
  onClose,
  parts,
  receiptItems,
  setReceiptItems,
  selectedSupplier,
  setSelectedSupplier,
  searchTerm,
  setSearchTerm,
  onSave,
  discount,
  setDiscount,
  discountType,
  setDiscountType,
  paymentMethod,
  setPaymentMethod,
  paymentType,
  setPaymentType,
  partialAmount,
  setPartialAmount,
  setShowAddProductModal,
  onAddNewProduct: _onAddNewProduct,
  currentBranchId,
  canViewImportPrice = true,
  canCreatePart = false,
  isSubmitting = false,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const { data: suppliers = [] } = useSuppliers();



  const filteredParts = useMemo(() => {
    if (!parts) return [];
    
    const branchParts = parts.filter((part) => {
      const isServiceCategory = ["dịch vụ", "công thợ"].includes((part.category || "").trim().toLowerCase());
      if (isServiceCategory) return true;

      const pBranchId = (part as any).branch_id || (part as any).branchId || "";
      if (pBranchId) {
        return pBranchId === currentBranchId;
      }

      const hasStock = part.stock && part.stock[currentBranchId] !== undefined;
      const hasRetail = part.retailPrice && part.retailPrice[currentBranchId] !== undefined;
      const hasCost = part.costPrice && part.costPrice[currentBranchId] !== undefined;

      return hasStock || hasRetail || hasCost;
    });

    if (!searchTerm || searchTerm.trim() === "") return branchParts;
    const term = searchTerm.toLowerCase().trim();
    return branchParts.filter((part) => 
      part.name?.toLowerCase().includes(term) ||
      part.sku?.toLowerCase().includes(term)
    );
  }, [parts, searchTerm, currentBranchId]);


  const addToReceipt = (part: Part) => {
    const existing = receiptItems.find((item) => item.partId === part.id);
    if (existing) {
      setReceiptItems((items) =>
        items.map((item) =>
          item.partId === part.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      );
      showToast.success(`Đã tăng số lượng ${part.name}`);
    } else {
      const rule = getCategoryPricingRule(part.category || "");
      const importPrice = canViewImportPrice
        ? part.costPrice?.[currentBranchId] || 0
        : 0;
      const existingRetail = part.retailPrice?.[currentBranchId] || 0;
      setReceiptItems((items) => [
        ...items,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          importPrice,
          sellingPrice: existingRetail > 0
            ? existingRetail
            : calcSellingFromRule(importPrice, rule.markupPercent, rule.roundingRule),
          wholesalePrice: part.wholesalePrice?.[currentBranchId] || 0,
          markupPercent: existingRetail > 0 && importPrice > 0
            ? calcMarkupPercent(importPrice, existingRetail)
            : rule.markupPercent,
          roundingRule: rule.roundingRule,
        },
      ]);
      showToast.success(`Đã thêm ${part.name} vào phiếu nhập`);
    }
    setSearchTerm("");
    // Auto focus back to barcode input
    setTimeout(() => barcodeInputRef.current?.focus(), 100);
  };

  // Handle barcode scan
  const handleBarcodeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!barcodeInput.trim()) return;

    const barcode = barcodeInput.trim();
    const foundPart = parts.find(
      (p) =>
        p.sku?.toLowerCase() === barcode.toLowerCase() ||
        p.name?.toLowerCase().includes(barcode.toLowerCase())
    );

    if (foundPart) {
      addToReceipt(foundPart);
      setBarcodeInput("");
    } else {
      // Sản phẩm chưa có trong kho - mở form thêm mới
      showToast.info(
        `Sản phẩm mã ${barcode} chưa có. Vui lòng thêm thông tin sản phẩm mới.`,
        {
          autoClose: 3000,
        }
      );
      if (canCreatePart) {
        setTimeout(() => {
          setShowAddProductModal(true);
        }, 500);
      }
    }
  };

  // Handle camera scan result - Modal tự đóng sau khi quét
  const handleCameraScan = (barcode: string) => {

    // Normalize barcode để so sánh - loại bỏ dấu gạch, khoảng trắng
    const normalizeCode = (code: string): string =>
      code.toLowerCase().replace(/[-\s./\\]/g, "");
    const normalizedBarcode = normalizeCode(barcode);

    // Lấy phần suffix (loại bỏ 5 ký tự đầu) để match với Honda barcodes
    // Ví dụ: "61600KRS971" -> suffix = "krs971", có thể match với SKU "31600-KRS-971"
    const barcodeSuffix = normalizedBarcode.length > 5 ? normalizedBarcode.slice(5) : normalizedBarcode;

    const foundPart = parts.find(
      (p) => {
        const normalizedSku = normalizeCode(p.sku || "");
        const normalizedPartBarcode = normalizeCode(p.barcode || "");
        const skuSuffix = normalizedSku.length > 5 ? normalizedSku.slice(5) : normalizedSku;

        return (
          // Exact match (after removing dashes)
          normalizedPartBarcode === normalizedBarcode ||
          p.barcode?.toLowerCase() === barcode.toLowerCase() ||
          normalizedSku === normalizedBarcode ||
          p.sku?.toLowerCase() === barcode.toLowerCase() ||
          // Suffix match (for Honda-style barcodes where prefix differs: 61600 vs 31600)
          (barcodeSuffix.length >= 4 && normalizedSku.includes(barcodeSuffix)) ||
          (barcodeSuffix.length >= 4 && skuSuffix === barcodeSuffix) ||
          // Contains match (barcode contains SKU or vice versa)
          (normalizedBarcode.length >= 6 && normalizedSku.includes(normalizedBarcode)) ||
          (normalizedSku.length >= 6 && normalizedBarcode.includes(normalizedSku))
        );
      }
    );

    // KHÔNG cần đóng scanner - BarcodeScannerModal tự đóng

    if (foundPart) {
      // Kiểm tra đã có trong phiếu chưa
      const existing = receiptItems.find(
        (item) => item.partId === foundPart.id
      );
      if (existing) {
        // Chỉ tăng số lượng, KHÔNG hiện toast
        setReceiptItems((items) =>
          items.map((item) =>
            item.partId === foundPart.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          )
        );
      } else {
        // Thêm mới - chỉ hiện 1 toast
        const rule = getCategoryPricingRule(foundPart.category || "");
        const importPrice = canViewImportPrice
          ? foundPart.costPrice?.[currentBranchId] || 0
          : 0;
        const existingRetail = foundPart.retailPrice?.[currentBranchId] || 0;
        setReceiptItems((items) => [
          ...items,
          {
            partId: foundPart.id,
            partName: foundPart.name,
            sku: foundPart.sku,
            quantity: 1,
            importPrice,
            sellingPrice: existingRetail > 0
              ? existingRetail
              : calcSellingFromRule(importPrice, rule.markupPercent, rule.roundingRule),
            wholesalePrice: foundPart.wholesalePrice?.[currentBranchId] || 0,
            markupPercent: existingRetail > 0 && importPrice > 0
              ? calcMarkupPercent(importPrice, existingRetail)
              : rule.markupPercent,
            roundingRule: rule.roundingRule,
          },
        ]);
        showToast.success(`Đã thêm ${foundPart.name}`);
      }
      setSearchTerm("");
    } else {
      // Sản phẩm chưa có trong kho - mở form thêm mới
      showToast.info(`Sản phẩm mã ${barcode} chưa có.`);
      setBarcodeInput(barcode);
      if (canCreatePart) {
        setTimeout(() => {
          setShowAddProductModal(true);
        }, 500);
      }
    }
  };

  // Auto focus barcode input when showBarcodeInput is enabled
  useEffect(() => {
    if (showBarcodeInput) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [showBarcodeInput]);

  const removeFromReceipt = (index: number) => {
    setReceiptItems((items) => items.filter((_, i) => i !== index));
  };

  const subtotal = receiptItems.reduce(
    (sum, item) => sum + item.quantity * item.importPrice,
    0
  );

  const discountAmount =
    discountType === "percent"
      ? Math.round((subtotal * discount) / 100)
      : discount;

  const totalAmount = Math.max(0, subtotal - discountAmount);

  const handleContinue = () => {
    if (!selectedSupplier) {
      alert("Vui lòng chọn nhà cung cấp");
      return;
    }
    setStep(2);
  };

  const handleSaveDraft = () => {
    showToast.info("Chức năng lưu nháp đang phát triển");
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-50 dark:bg-[#151521] z-[100] flex flex-col">
        <div className="flex flex-col h-full">
          {step === 1 ? (
            /* ===== BƯỚC 1: CHỌN HÀNG ===== */
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-1 px-3 flex items-center justify-between flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={onClose}
                    className="text-white hover:text-slate-200 transition-colors p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <h2 className="text-xs font-bold text-white">
                    Tạo phiếu nhập
                  </h2>
                </div>
              </div>

              {/* Supplier Selection Card */}
              <div className="p-2 bg-white dark:bg-[#1e1e2d]/50 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                <div
                  onClick={() => setShowSupplierModal(true)}
                  className={`p-2.5 rounded-xl border cursor-pointer active:scale-98 transition-all ${selectedSupplier
                    ? "border-blue-500/40 bg-blue-50/30 dark:bg-blue-950/10 shadow-sm shadow-blue-500/5"
                    : "border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-[#1e1e2d] hover:bg-slate-50 dark:hover:bg-[#252538]"
                    }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      {selectedSupplier ? (
                        <>
                          <div className="text-[10px] uppercase tracking-wider font-extrabold text-blue-600 dark:text-blue-400 mb-0.5">
                            Nhà cung cấp
                          </div>
                          <div className="font-bold text-slate-800 dark:text-slate-100 text-xs truncate">
                            {suppliers.find(
                              (s: any) => s.id === selectedSupplier
                            )?.name || ""}
                          </div>
                          {suppliers.find((s: any) => s.id === selectedSupplier)?.phone && (
                            <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                              📞 {suppliers.find((s: any) => s.id === selectedSupplier)?.phone}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400">
                            <User className="w-3.5 h-3.5" />
                          </div>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            Chọn nhà cung cấp *
                          </span>
                        </div>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                  </div>
                </div>
              </div>

              {/* Sticky Search Bar */}
              <div className="p-2.5 bg-white dark:bg-[#1e1e2d]/50 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10 flex-shrink-0 space-y-2">
                {/* Barcode Scanner Input - Toggle visibility */}
                {showBarcodeInput && (
                  <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                      <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-blue-500" />
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder="Nhập SKU hoặc quét..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="w-full px-4 py-2.5 pl-10 border border-blue-400 dark:border-blue-600 rounded-xl bg-blue-50/30 dark:bg-blue-950/20 text-slate-900 dark:text-slate-100 text-sm font-mono placeholder:text-blue-500/50 outline-none"
                      />
                      {barcodeInput && (
                        <button
                          type="button"
                          onClick={() => setBarcodeInput("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Close barcode input */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowBarcodeInput(false);
                        setBarcodeInput("");
                      }}
                      className="w-11 h-11 shrink-0 flex items-center justify-center border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1e1e2d] rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all active:scale-95 shadow-sm"
                    >
                      <X className="w-4.5 h-4.5" />
                    </button>
                  </form>
                )}

                {/* Manual Search with barcode toggle */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm sản phẩm thủ công..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-9 pr-3 h-11 border border-slate-200 dark:border-slate-850 rounded-xl bg-slate-50 dark:bg-[#151521] text-slate-900 dark:text-slate-100 text-sm outline-none placeholder:text-slate-400/80"
                    />
                  </div>

                  {/* Barcode Toggle Button */}
                  {!showBarcodeInput && (
                    <button
                      type="button"
                      onClick={() => setShowBarcodeInput(true)}
                      className="w-11 h-11 shrink-0 flex items-center justify-center border border-blue-200 dark:border-blue-800/80 bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 rounded-xl transition-all active:scale-95 shadow-sm"
                      title="Quét mã vạch"
                    >
                      <Scan className="w-5 h-5" />
                    </button>
                  )}

                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="w-11 h-11 shrink-0 flex items-center justify-center bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl shadow-md shadow-blue-500/10 transition-all active:scale-95"
                  >
                    <Camera className="w-5 h-5" />
                  </button>
                </div>

                {/* Quick add new product at top for faster operation */}
                {canCreatePart && (
                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="w-full py-2 border border-dashed border-blue-300 dark:border-blue-800 hover:border-blue-500 dark:hover:border-blue-600 text-blue-600 dark:text-blue-400 transition-all bg-blue-50/20 dark:bg-blue-500/5 rounded-xl flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-4 h-4 font-bold" />
                    <span className="font-bold text-xs uppercase tracking-wider">Tạo sản phẩm mới</span>
                  </button>
                )}
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto p-3 bg-slate-50 dark:bg-[#151521]">
                {!parts || parts.length === 0 ? (
                  <div className="text-center py-20 text-slate-500 flex flex-col items-center">
                    <div className="w-10 h-10 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin mb-4"></div>
                    <span className="font-semibold text-sm">Đang tải danh sách sản phẩm...</span>
                  </div>
                ) : filteredParts.length === 0 ? (
                  <div className="text-center py-20 px-4 bg-white dark:bg-[#1e1e2d] rounded-2xl border border-slate-200 dark:border-slate-800/80 shadow-sm max-w-sm mx-auto my-8">
                    <div className="w-16 h-16 bg-slate-50 dark:bg-[#151521] rounded-full flex items-center justify-center mx-auto mb-4">
                      <Search className="w-6 h-6 text-slate-350 dark:text-slate-600" />
                    </div>
                    <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200 mb-1">
                      Không tìm thấy sản phẩm
                    </h3>
                    {searchTerm && (
                      <p className="text-xs text-slate-500 mt-1">
                        Từ khóa: "{searchTerm}"
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {filteredParts.map((part) => {
                      const inCart = receiptItems.find(
                        (item) => item.partId === part.id
                      );
                      return (
                        <div
                          key={part.id}
                          className={`rounded-2xl p-3.5 border transition-all duration-200 ${inCart
                            ? "border-blue-400 bg-blue-50/20 dark:bg-blue-500/10 shadow-[0_0_12px_rgba(59,130,246,0.04)]"
                            : "border-slate-200 dark:border-slate-800 bg-white dark:bg-[#1e1e2d] hover:border-blue-300 dark:hover:border-blue-900/30"
                            }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-snug mb-1">
                                {part.name}
                              </div>
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-[10px] text-blue-600 dark:text-blue-400 font-bold font-mono">
                                  {part.sku}
                                </span>
                                {part.category && (
                                  <span
                                    className={`inline-flex items-center px-2 py-0.5 rounded-md text-[9px] font-bold uppercase tracking-wider ${getCategoryColor(part.category).bg
                                      } ${getCategoryColor(part.category).text}`}
                                  >
                                    {part.category}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2.5 flex gap-4 text-xs font-semibold text-slate-500">
                                {canViewImportPrice && (
                                  <div>
                                    Nhập:{" "}
                                    <span className="text-slate-800 dark:text-slate-200">
                                      {formatCurrency(
                                        part.costPrice?.[currentBranchId] || 0
                                      )}
                                    </span>
                                  </div>
                                )}
                                <div>
                                  Bán:{" "}
                                  <span className="text-emerald-600 dark:text-emerald-400">
                                    {formatCurrency(
                                      part.retailPrice?.[currentBranchId] || 0
                                    )}
                                  </span>
                                </div>
                              </div>
                              {inCart && (
                                <div className="mt-2.5">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-md text-xs font-bold bg-blue-150/40 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300">
                                    Đã chọn: {inCart.quantity}
                                    {canViewImportPrice
                                      ? ` × ${formatCurrency(inCart.importPrice)}`
                                      : ""}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => addToReceipt(part)}
                              className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white flex items-center justify-center shadow-md shadow-blue-500/10 active:scale-95 transition-all"
                            >
                              <Plus className="w-4.5 h-4.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Floating Cart Footer */}
              {receiptItems.length > 0 && (
                <div className="flex-shrink-0 bg-gradient-to-t from-white via-white dark:from-[#151521] dark:via-[#151521] to-transparent pt-6 pb-safe pb-4 px-3">
                  <button
                    onClick={handleContinue}
                    className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-750 active:scale-[0.98] text-white py-3.5 rounded-2xl font-bold text-base flex items-center justify-between px-5 shadow-lg shadow-blue-500/20 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-white/20 rounded-lg w-7 h-7 flex items-center justify-center font-extrabold text-sm">
                        {receiptItems.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        )}
                      </div>
                      <span className="uppercase tracking-wider">Tiếp tục</span>
                    </div>
                    <span className="font-extrabold text-base">
                      {formatCurrency(subtotal)} đ
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ===== BƯỚC 2: THANH TOÁN ===== */
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 py-1 px-3 flex items-center justify-between flex-shrink-0 shadow-sm">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setStep(1)}
                    className="text-white hover:text-slate-200 transition-colors p-0.5"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <h2 className="text-xs font-bold text-white">
                    Xác nhận nhập
                  </h2>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#151521]">
                <div className="p-3 space-y-2.5">
                  {receiptItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-[#1e1e2d] rounded-2xl p-4 border border-slate-200 dark:border-slate-800/80 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3 mb-2.5">
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-snug text-sm">
                            {item.partName}
                          </div>
                          <div className="text-xs text-blue-600 dark:text-blue-400 mt-0.5 font-bold font-mono">
                            SKU: {item.sku}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromReceipt(index)}
                          className="text-slate-450 hover:text-rose-500 p-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Quantity & Price Controls */}
                      <div className="flex items-center justify-between gap-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 pt-3">
                        <div className="flex items-center bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 p-0.5">
                          <button
                            onClick={() => {
                              if (item.quantity > 1) {
                                const updated = [...receiptItems];
                                updated[index].quantity -= 1;
                                setReceiptItems(updated);
                              }
                            }}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-slate-600 dark:text-slate-450 hover:bg-white dark:hover:bg-slate-850 transition shadow-sm"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseInt(e.target.value) || 0;
                              const updated = [...receiptItems];
                              updated[index].quantity = Math.max(1, val);
                              setReceiptItems(updated);
                            }}
                            className="w-10 h-7 text-center font-bold text-sm text-slate-900 dark:text-slate-100 bg-transparent outline-none border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                          <button
                            onClick={() => {
                              const updated = [...receiptItems];
                              updated[index].quantity += 1;
                              setReceiptItems(updated);
                            }}
                            className="w-7 h-7 rounded-md flex items-center justify-center text-blue-600 hover:bg-white dark:hover:bg-slate-850 transition shadow-sm"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>

                        <div className="flex-1 text-right space-y-1">
                          <div className="flex justify-end items-center gap-1.5">
                            <span className="text-xs text-slate-400">Giá nhập:</span>
                            <NumberInput
                              value={item.importPrice}
                              onChange={(val) => {
                                const updated = [...receiptItems];
                                updated[index].importPrice = val;
                                if (updated[index].sellingPrice > 0) {
                                  updated[index].markupPercent = calcMarkupPercent(val, updated[index].sellingPrice);
                                } else {
                                  updated[index].sellingPrice = calcSellingFromRule(
                                    val,
                                    Number(
                                      updated[index].markupPercent ||
                                        DEFAULT_MARKUP_PERCENT
                                    ),
                                    updated[index].roundingRule || "integer"
                                  );
                                }
                                setReceiptItems(updated);
                              }}
                              className="w-20 px-1 py-0.5 text-right text-sm font-semibold border-b border-dashed border-slate-350 dark:border-slate-600 bg-transparent text-slate-800 dark:text-slate-200 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="flex justify-end items-center gap-1.5">
                            <span className="text-xs text-slate-400">Lợi nhuận:</span>
                            <NumberInput
                              value={item.markupPercent}
                              onChange={(val) => {
                                const targetCategory =
                                  parts.find((p) => p.id === item.partId)?.category || "";
                                const updated = [...receiptItems];
                                const markupPercent = Math.max(0, Math.round(val));
                                updated.forEach((entry, entryIndex) => {
                                  const entryCategory =
                                    parts.find((p) => p.id === entry.partId)?.category || "";
                                  if (
                                    entryIndex === index ||
                                    (targetCategory && entryCategory === targetCategory)
                                  ) {
                                    entry.markupPercent = markupPercent;
                                    entry.sellingPrice = calcSellingFromRule(
                                      Number(entry.importPrice || 0),
                                      markupPercent,
                                      entry.roundingRule || "integer"
                                    );
                                  }
                                });
                                setReceiptItems(updated);
                              }}
                              className="w-12 px-1 py-0.5 text-right text-xs font-bold border-b border-dashed border-indigo-300 dark:border-indigo-850 bg-transparent text-indigo-600 dark:text-indigo-400 focus:outline-none focus:border-indigo-500"
                            />
                            <span className="text-xs text-indigo-455">%</span>
                          </div>
                          <div className="flex justify-end items-center gap-1.5">
                            <span className="text-xs text-slate-400">Giá bán lẻ:</span>
                            <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(item.sellingPrice || 0)}
                            </span>
                          </div>
                          <div className="font-extrabold text-sm text-slate-900 dark:text-slate-100 pt-0.5">
                            {formatCurrency(
                              item.quantity * item.importPrice
                            )} đ
                          </div>
                        </div>

                        {/* Sub row: IMEI & Color */}
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">IMEI / Seri:</span>
                            <input
                              type="text"
                              value={item.imei || ""}
                              onChange={(e) => {
                                const updated = [...receiptItems];
                                updated[index].imei = e.target.value;
                                setReceiptItems(updated);
                              }}
                              placeholder="Nhập IMEI / Seri..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 font-mono"
                            />
                          </div>
                          <div>
                            <span className="text-[10px] text-slate-400 font-semibold block mb-0.5">Màu sắc:</span>
                            <input
                              type="text"
                              value={item.color || ""}
                              onChange={(e) => {
                                const updated = [...receiptItems];
                                updated[index].color = e.target.value;
                                setReceiptItems(updated);
                              }}
                              placeholder="Nhập màu sắc..."
                              className="w-full px-2 py-1 text-xs border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Section */}
                <div className="p-3">
                  <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3 shadow-sm">
                    {/* Subtotal */}
                    <div className="flex justify-between text-sm text-slate-500 dark:text-slate-400 font-medium">
                      <span>Tổng tiền hàng</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>

                    {/* Discount */}
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-slate-500 dark:text-slate-400 font-medium">
                        Giảm giá
                      </span>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          placeholder="0"
                          className="w-20 px-2.5 py-1.5 border border-slate-350 dark:border-slate-700 rounded-xl text-right bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none"
                        />
                        <select
                          value={discountType}
                          onChange={(e) =>
                            setDiscountType(
                              e.target.value as "amount" | "percent"
                            )
                          }
                          className="px-2 py-1.5 border border-slate-350 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-xs font-bold outline-none"
                        >
                          <option value="amount">₫</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-3.5 border-t border-slate-100 dark:border-slate-800">
                      <span className="text-sm font-bold text-slate-800 dark:text-slate-200">
                        CẦN THANH TOÁN
                      </span>
                      <span className="text-lg font-black text-rose-600 dark:text-rose-455">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Chips */}
                <div className="p-3">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 pl-1">
                    Phương thức thanh toán
                  </div>
                  <div className="flex gap-2.5">
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm border flex items-center justify-center gap-1.5 ${paymentMethod === "cash"
                        ? "bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-md shadow-emerald-500/10 border-transparent"
                        : "bg-white dark:bg-[#1e1e2d] text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        }`}
                    >
                      💵 Tiền mặt
                    </button>
                    <button
                      onClick={() => setPaymentMethod("bank")}
                      className={`flex-1 py-3 rounded-xl font-bold transition-all text-sm border flex items-center justify-center gap-1.5 ${paymentMethod === "bank"
                        ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/10 border-transparent"
                        : "bg-white dark:bg-[#1e1e2d] text-slate-650 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/80"
                        }`}
                    >
                      🏦 Chuyển khoản
                    </button>
                  </div>
                </div>

                {/* Payment Type Tabs */}
                <div className="p-3">
                  <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2.5 pl-1">
                    Kiểu thanh toán
                  </div>
                  <div className="bg-slate-200/80 dark:bg-slate-900/60 p-1 rounded-xl border border-slate-250/20 dark:border-slate-800/60 shadow-inner flex gap-1">
                    <button
                      onClick={() => {
                        setPaymentType("full");
                        setPartialAmount(0);
                      }}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${paymentType === "full"
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/30 dark:border-slate-700/20"
                        : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                      Trả hết
                    </button>
                    <button
                      onClick={() => setPaymentType("partial")}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${paymentType === "partial"
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/30 dark:border-slate-700/20"
                        : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                      Trả một phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType("note");
                        setPartialAmount(0);
                      }}
                      className={`flex-1 py-2 rounded-lg font-bold text-xs transition-all ${paymentType === "note"
                        ? "bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-sm border border-slate-200/30 dark:border-slate-700/20"
                        : "text-slate-500 dark:text-slate-400"
                        }`}
                    >
                      Ghi nợ
                    </button>
                  </div>
                </div>

                {/* Partial Payment Input */}
                {paymentType === "partial" && (
                  <div className="p-3">
                    <div className="bg-white dark:bg-[#1e1e2d] rounded-2xl p-4 border border-slate-200 dark:border-slate-800 space-y-3">
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider pl-1">
                        Tiền trả NCC
                      </label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={partialAmount}
                        onChange={(e) => {
                          const value = Number(e.target.value);
                          if (value <= totalAmount) {
                            setPartialAmount(value);
                          } else {
                            alert("Số tiền trả không được vượt quá tổng tiền");
                          }
                        }}
                        placeholder="Nhập số tiền trả..."
                        className="w-full px-4 py-3 border border-slate-200 dark:border-slate-850 rounded-xl text-right text-lg font-extrabold bg-slate-50 dark:bg-[#151521] text-slate-900 dark:text-slate-100 outline-none"
                      />
                      <div className="text-xs font-bold text-rose-500 flex justify-between px-1">
                        <span>CÒN NỢ NCC:</span>
                        <span>{formatCurrency(totalAmount - partialAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Debt Info */}
                {paymentType === "note" && (
                  <div className="p-3">
                    <div className="bg-rose-50/50 dark:bg-rose-950/15 border border-rose-100 dark:border-rose-900/30 rounded-2xl p-4">
                      <div className="text-xs font-bold text-rose-600 dark:text-rose-400 uppercase tracking-wider mb-1">
                        Số tiền ghi nợ
                      </div>
                      <div className="text-xl font-black text-rose-650 dark:text-rose-400">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-3 bg-white dark:bg-[#1e1e2d] border-t border-slate-200 dark:border-slate-800 space-y-2 flex-shrink-0">
                <div className="flex gap-2.5">
                  <button
                    disabled
                    onClick={handleSaveDraft}
                    className="flex-1 py-3 border border-slate-250 dark:border-slate-700 text-slate-400 dark:text-slate-500 bg-transparent rounded-xl font-bold text-sm opacity-50 cursor-not-allowed"
                  >
                    💾 Lưu nháp (Coming soon)
                  </button>
                  <button
                    onClick={onSave}
                    disabled={!selectedSupplier || receiptItems.length === 0 || isSubmitting}
                    className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:from-slate-300 disabled:to-slate-350 dark:disabled:from-slate-700 dark:disabled:to-slate-800 text-white rounded-xl font-bold text-sm active:scale-98 transition-transform disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>ĐANG LƯU...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5" />
                        <span>NHẬP KHO</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Supplier Selection Modal */}
      <SupplierSelectionModal
        isOpen={showSupplierModal}
        onClose={() => setShowSupplierModal(false)}
        selectedSupplierId={selectedSupplier}
        onSelectSupplier={setSelectedSupplier}
      />

      {/* Camera Barcode Scanner */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
        title="Quét mã vạch sản phẩm"
      />
    </>
  );
};
