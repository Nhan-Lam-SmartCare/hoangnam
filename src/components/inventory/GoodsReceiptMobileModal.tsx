import React, { useState, useRef, useEffect } from "react";
import { formatCurrency } from "../../utils/format";
import { getCategoryColor } from "../../utils/categoryColors";
import { SupplierSelectionModal } from "./SupplierSelectionModal";
import { useSuppliers } from "../../hooks/useSuppliers";
import { showToast } from "../../utils/toast";
import BarcodeScannerModal from "../common/BarcodeScannerModal";
import { NumberInput } from "../common/NumberInput";

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
  sellingPrice: number;
  wholesalePrice: number;
}

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
  showAddProductModal,
  setShowAddProductModal,
  onAddNewProduct,
  currentBranchId,
  isSubmitting = false,
}) => {
  const [step, setStep] = useState<1 | 2>(1);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const { data: suppliers = [] } = useSuppliers();

  console.log(
    "🔍 GoodsReceiptMobileModal - parts:",
    parts?.length || 0,
    parts?.slice(0, 2)
  );
  console.log("🔍 searchTerm:", searchTerm);

  const filteredParts =
    parts?.filter((part) => {
      if (!searchTerm || searchTerm.trim() === "") return true; // Show all if no search
      const term = searchTerm.toLowerCase().trim();
      return (
        part.name?.toLowerCase().includes(term) ||
        part.sku?.toLowerCase().includes(term)
      );
    }) || [];

  console.log("🔍 filteredParts:", filteredParts?.length || 0);

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
      setReceiptItems((items) => [
        ...items,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          importPrice: part.costPrice?.[currentBranchId] || 0,
          sellingPrice: part.retailPrice?.[currentBranchId] || 0,
          wholesalePrice: part.wholesalePrice?.[currentBranchId] || 0,
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
      setTimeout(() => {
        setShowAddProductModal(true);
      }, 500);
    }
  };

  // Handle camera scan result - Modal tự đóng sau khi quét
  const handleCameraScan = (barcode: string) => {
    console.log("📷 Camera scanned:", barcode);

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
        setReceiptItems((items) => [
          ...items,
          {
            partId: foundPart.id,
            partName: foundPart.name,
            sku: foundPart.sku,
            quantity: 1,
            importPrice: foundPart.costPrice?.[currentBranchId] || 0,
            sellingPrice: foundPart.retailPrice?.[currentBranchId] || 0,
            wholesalePrice: foundPart.wholesalePrice?.[currentBranchId] || 0,
          },
        ]);
        showToast.success(`Đã thêm ${foundPart.name}`);
      }
      setSearchTerm("");
    } else {
      // Sản phẩm chưa có trong kho - mở form thêm mới
      showToast.info(`Sản phẩm mã ${barcode} chưa có.`);
      setBarcodeInput(barcode);
      setTimeout(() => {
        setShowAddProductModal(true);
      }, 500);
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
    alert("Chức năng lưu nháp đang phát triển");
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-white dark:bg-slate-800 z-[100] flex flex-col">
        <div className="flex flex-col h-full">
          {step === 1 ? (
            /* ===== BƯỚC 1: CHỌN HÀNG ===== */
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 flex items-center justify-between flex-shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  <button
                    onClick={onClose}
                    className="text-white text-xl leading-none p-1"
                  >
                    ×
                  </button>
                  <h2 className="text-base font-bold text-white">
                    Tạo phiếu nhập
                  </h2>
                </div>
              </div>

              {/* Supplier Selection Card */}
              <div className="p-3 bg-slate-50 dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
                <div
                  onClick={() => setShowSupplierModal(true)}
                  className={`p-4 rounded-xl border-2 cursor-pointer active:scale-98 transition-transform ${selectedSupplier
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                    }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      {selectedSupplier ? (
                        <>
                          <div className="text-xs text-slate-500 dark:text-slate-400 mb-1">
                            NHÀ CUNG CẤP
                          </div>
                          <div className="font-bold text-slate-900 dark:text-slate-100">
                            {suppliers.find(
                              (s: any) => s.id === selectedSupplier
                            )?.name || ""}
                          </div>
                          {suppliers.find((s: any) => s.id === selectedSupplier)
                            ?.phone && (
                              <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                                {
                                  suppliers.find(
                                    (s: any) => s.id === selectedSupplier
                                  )?.phone
                                }
                              </div>
                            )}
                        </>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span className="text-2xl">👤</span>
                          <span className="text-slate-500 dark:text-slate-400">
                            Chọn nhà cung cấp
                          </span>
                        </div>
                      )}
                    </div>
                    <svg
                      className="w-5 h-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>

              {/* Sticky Search Bar */}
              <div className="p-3 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 sticky top-0 z-10 flex-shrink-0 space-y-2">
                {/* Barcode Scanner Input - Toggle visibility */}
                {showBarcodeInput && (
                  <form onSubmit={handleBarcodeSubmit} className="flex gap-2">
                    <div className="relative flex-1">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                      <input
                        ref={barcodeInputRef}
                        type="text"
                        placeholder="Nhập SKU hoặc quét..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="w-full px-4 py-3 pl-11 border-2 border-blue-400 dark:border-blue-600 rounded-xl bg-blue-50 dark:bg-blue-900/20 text-slate-900 dark:text-slate-100 text-base font-mono placeholder:text-blue-500/70"
                      />
                      {barcodeInput && (
                        <button
                          type="button"
                          onClick={() => setBarcodeInput("")}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <svg
                            className="w-5 h-5"
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
                      )}
                    </div>

                    {/* Close barcode input */}
                    <button
                      type="button"
                      onClick={() => {
                        setShowBarcodeInput(false);
                        setBarcodeInput("");
                      }}
                      className="w-12 h-[50px] flex items-center justify-center border-2 border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                    >
                      <svg
                        className="w-5 h-5"
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
                  </form>
                )}

                {/* Manual Search with barcode toggle */}
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Hoặc tìm kiếm thủ công..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-4 py-3 pl-10 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                    />
                    <svg
                      className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                      />
                    </svg>
                  </div>

                  {/* Barcode Toggle Button */}
                  {!showBarcodeInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowBarcodeInput(true);
                      }}
                      className="w-12 h-[50px] flex items-center justify-center border-2 border-blue-400 dark:border-blue-600 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-xl transition-all active:scale-95"
                      title="Quét mã vạch"
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
                          d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                        />
                      </svg>
                    </button>
                  )}

                  {/* Camera Button */}
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="w-12 h-[50px] flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white rounded-xl shadow-lg transition-all active:scale-95"
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
                        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto p-3 bg-slate-50 dark:bg-slate-900">
                {!parts || parts.length === 0 ? (
                  <div className="text-center text-slate-500 py-12">
                    <div className="text-5xl mb-3">⏳</div>
                    <div>Đang tải danh sách sản phẩm...</div>
                  </div>
                ) : filteredParts.length === 0 ? (
                  <div className="text-center text-slate-500 py-12">
                    <div className="text-5xl mb-3">📦</div>
                    <div>Không tìm thấy sản phẩm</div>
                    {searchTerm && (
                      <div className="text-sm mt-2">
                        Tìm kiếm: "{searchTerm}"
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {filteredParts.map((part) => {
                      const inCart = receiptItems.find(
                        (item) => item.partId === part.id
                      );
                      return (
                        <div
                          key={part.id}
                          className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="font-bold text-slate-900 dark:text-slate-100 text-base leading-tight mb-1">
                                {part.name}
                              </div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-mono">
                                  {part.sku}
                                </span>
                                {part.category && (
                                  <span
                                    className={`inline-flex items-center px-1.5 py-0 rounded-full text-[9px] font-medium ${getCategoryColor(part.category).bg
                                      } ${getCategoryColor(part.category).text}`}
                                  >
                                    {part.category}
                                  </span>
                                )}
                              </div>
                              <div className="mt-2 flex gap-3 text-xs">
                                <div>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Nhập:{" "}
                                  </span>
                                  <span className="font-medium text-orange-600 dark:text-orange-400">
                                    {formatCurrency(
                                      part.costPrice?.[currentBranchId] || 0
                                    )}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    Bán:{" "}
                                  </span>
                                  <span className="font-medium text-green-600 dark:text-green-400">
                                    {formatCurrency(
                                      part.retailPrice?.[currentBranchId] || 0
                                    )}
                                  </span>
                                </div>
                              </div>
                              {inCart && (
                                <div className="mt-2 text-sm">
                                  <span className="text-blue-600 dark:text-blue-400 font-medium">
                                    Đã thêm: {inCart.quantity} ×{" "}
                                    {formatCurrency(inCart.importPrice)}
                                  </span>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => addToReceipt(part)}
                              className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center text-2xl leading-none active:scale-95 transition-transform"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add New Product Button */}
                <button
                  onClick={() => setShowAddProductModal(true)}
                  className="w-full mt-3 py-4 border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-xl text-slate-500 dark:text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-colors flex items-center justify-center gap-2"
                >
                  <span className="text-2xl">+</span>
                  <span className="font-medium">Tạo sản phẩm mới</span>
                </button>
              </div>

              {/* Floating Cart Footer */}
              {receiptItems.length > 0 && (
                <div className="flex-shrink-0 bg-gradient-to-t from-white via-white dark:from-slate-800 dark:via-slate-800 to-transparent pt-6 pb-safe pb-4 px-3">
                  <button
                    onClick={handleContinue}
                    className="w-full bg-blue-600 hover:bg-blue-700 active:scale-98 text-white py-4 rounded-xl font-bold text-lg flex items-center justify-between px-6 shadow-lg transition-transform"
                  >
                    <div className="flex items-center gap-2">
                      <div className="bg-white/20 rounded-full w-8 h-8 flex items-center justify-center font-bold">
                        {receiptItems.reduce(
                          (sum, item) => sum + item.quantity,
                          0
                        )}
                      </div>
                      <span>Tiếp tục</span>
                    </div>
                    <span className="font-bold">
                      {formatCurrency(subtotal)}
                    </span>
                  </button>
                </div>
              )}
            </>
          ) : (
            /* ===== BƯỚC 2: THANH TOÁN ===== */
            <>
              {/* Header */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-2 flex items-center justify-between flex-shrink-0 shadow-md">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="text-white text-xl leading-none p-1"
                  >
                    ←
                  </button>
                  <h2 className="text-base font-bold text-white">
                    Xác nhận nhập
                  </h2>
                </div>
              </div>

              {/* Cart Items List */}
              <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900">
                <div className="p-3 space-y-2">
                  {receiptItems.map((item, index) => (
                    <div
                      key={index}
                      className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700"
                    >
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div className="flex-1">
                          <div className="font-bold text-slate-900 dark:text-slate-100 leading-tight">
                            {item.partName}
                          </div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                            SKU: {item.sku}
                          </div>
                        </div>
                        <button
                          onClick={() => removeFromReceipt(index)}
                          className="text-red-500 hover:text-red-600 text-xl"
                        >
                          ×
                        </button>
                      </div>

                      {/* Quantity & Price Controls */}
                      <div className="flex items-center justify-between gap-2 mt-2">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => {
                              if (item.quantity > 1) {
                                const updated = [...receiptItems];
                                updated[index].quantity -= 1;
                                setReceiptItems(updated);
                              }
                            }}
                            className="w-7 h-7 rounded border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-600 dark:text-slate-400 font-bold active:scale-95 transition-transform"
                          >
                            −
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
                            className="w-12 h-7 text-center font-bold text-base text-slate-900 dark:text-slate-100 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700"
                          />
                          <button
                            onClick={() => {
                              const updated = [...receiptItems];
                              updated[index].quantity += 1;
                              setReceiptItems(updated);
                            }}
                            className="w-7 h-7 rounded border border-blue-500 flex items-center justify-center text-blue-600 font-bold active:scale-95 transition-transform"
                          >
                            +
                          </button>
                        </div>

                        <div className="flex-1 text-right">
                          <div className="flex justify-end items-center gap-1 mb-1">
                            <span className="text-xs text-slate-400">Giá nhập:</span>
                            <NumberInput
                              value={item.importPrice}
                              onChange={(val) => {
                                const updated = [...receiptItems];
                                updated[index].importPrice = val;
                                setReceiptItems(updated);
                              }}
                              className="w-20 px-1 py-0.5 text-right text-sm border-b border-dashed border-slate-300 dark:border-slate-600 bg-transparent text-slate-700 dark:text-slate-300 focus:outline-none focus:border-blue-500"
                            />
                          </div>
                          <div className="font-bold text-orange-600 dark:text-orange-400">
                            {formatCurrency(item.quantity * item.importPrice)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Totals Section */}
                <div className="p-3">
                  <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700 space-y-3">
                    {/* Subtotal */}
                    <div className="flex justify-between text-slate-700 dark:text-slate-300">
                      <span>Tổng tiền hàng</span>
                      <span className="font-medium">
                        {formatCurrency(subtotal)}
                      </span>
                    </div>

                    {/* Discount */}
                    <div className="flex justify-between items-center">
                      <span className="text-slate-700 dark:text-slate-300">
                        Giảm giá
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="numeric"
                          value={discount}
                          onChange={(e) => setDiscount(Number(e.target.value))}
                          placeholder="0"
                          className="w-24 px-3 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                        />
                        <select
                          value={discountType}
                          onChange={(e) =>
                            setDiscountType(
                              e.target.value as "amount" | "percent"
                            )
                          }
                          className="px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm"
                        >
                          <option value="amount">₫</option>
                          <option value="percent">%</option>
                        </select>
                      </div>
                    </div>

                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 border-t-2 border-slate-200 dark:border-slate-700">
                      <span className="text-lg font-bold text-slate-900 dark:text-slate-100">
                        CẦN THANH TOÁN
                      </span>
                      <span className="text-xl font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(totalAmount)}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Payment Method Chips */}
                <div className="p-3">
                  <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Phương thức thanh toán
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${paymentMethod === "cash"
                        ? "bg-green-600 text-white shadow-lg"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
                        }`}
                    >
                      💵 Tiền mặt
                    </button>
                    <button
                      onClick={() => setPaymentMethod("bank")}
                      className={`flex-1 py-3 rounded-xl font-medium transition-all ${paymentMethod === "bank"
                        ? "bg-blue-600 text-white shadow-lg"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-slate-600"
                        }`}
                    >
                      🏦 Chuyển khoản
                    </button>
                  </div>
                </div>

                {/* Payment Type Tabs */}
                <div className="p-3">
                  <div className="bg-slate-200 dark:bg-slate-700 rounded-xl p-1 flex gap-1">
                    <button
                      onClick={() => {
                        setPaymentType("full");
                        setPartialAmount(0);
                      }}
                      className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${paymentType === "full"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow"
                        : "text-slate-600 dark:text-slate-400"
                        }`}
                    >
                      Đủ
                    </button>
                    <button
                      onClick={() => setPaymentType("partial")}
                      className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${paymentType === "partial"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow"
                        : "text-slate-600 dark:text-slate-400"
                        }`}
                    >
                      1 Phần
                    </button>
                    <button
                      onClick={() => {
                        setPaymentType("note");
                        setPartialAmount(0);
                      }}
                      className={`flex-1 py-2.5 rounded-lg font-medium transition-all ${paymentType === "note"
                        ? "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 shadow"
                        : "text-slate-600 dark:text-slate-400"
                        }`}
                    >
                      Nợ
                    </button>
                  </div>
                </div>

                {/* Partial Payment Input */}
                {paymentType === "partial" && (
                  <div className="p-3">
                    <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-300 dark:border-slate-600">
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
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
                        placeholder="Nhập số tiền"
                        className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg text-right text-lg font-bold bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      />
                      <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                        Còn nợ: {formatCurrency(totalAmount - partialAmount)}
                      </div>
                    </div>
                  </div>
                )}

                {/* Debt Info */}
                {paymentType === "note" && (
                  <div className="p-3">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                      <div className="text-sm text-red-700 dark:text-red-400 mb-1">
                        Số tiền nợ
                      </div>
                      <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 space-y-2 flex-shrink-0">
                <div className="flex gap-2">
                  <button
                    onClick={handleSaveDraft}
                    className="flex-1 py-3 border-2 border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 rounded-xl font-medium active:scale-98 transition-transform"
                  >
                    💾 Lưu Nháp
                  </button>
                  <button
                    onClick={onSave}
                    disabled={!selectedSupplier || receiptItems.length === 0 || isSubmitting}
                    className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-600 text-white rounded-xl font-bold active:scale-98 transition-transform disabled:cursor-not-allowed flex items-center justify-center gap-2"
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
                        <span>✅</span>
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
