import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { canDo } from '../../../utils/permissions';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useCreatePartRepo } from '../../../hooks/usePartsRepository';
import { showToast } from '../../../utils/toast';
import { formatCurrency } from '../../../utils/format';
import { getCategoryColor } from '../../../utils/categoryColors';
import { validatePriceAndQty } from '../../../utils/validation';
import FormattedNumberInput from '../../common/FormattedNumberInput';
import BarcodeScannerModal from '../../common/BarcodeScannerModal';
import SupplierModal from '../../inventory/components/SupplierModal';
import AddProductModal from './AddProductModal';
import type { Part } from '../../../types';
import { 
  X, Plus, Save, Scan, Printer, ShoppingCart, Trash2, Search, 
  ChevronDown, ChevronUp, AlertCircle, CheckCircle, Package, ArrowRight,
  Camera, FileText 
} from 'lucide-react';

interface ReceiptItem {
  partId: string;
  partName: string;
  sku: string;
  quantity: number;
  unitPrice: number; // Giá nhập
  sellingPrice: number; // Giá bán lẻ (đề xuất)
  wholesalePrice: number; // Giá bán buôn (đề xuất)
  currentStock: number;
  newStock: number;
  category: string;
  unit: string;
  image?: string;
  notes?: string;
}

interface PaymentInfo {
  method: "cash" | "bank_transfer";
  paidAmount: number;
  notes?: string;
}

// Goods Receipt Modal Component (Ảnh 2)
const GoodsReceiptModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  parts: Part[];
  currentBranchId: string;
  onSave: (
    items: Array<{
      partId: string;
      partName: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
    }>,
    supplierId: string,
    totalAmount: number,
    note: string,
    paymentInfo?: {
      paymentMethod: "cash" | "bank";
      paymentType: "full" | "partial" | "note";
      paidAmount: number;
      discount: number;
    }
  ) => void;
}> = ({ isOpen, onClose, parts, currentBranchId, onSave }) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [step, setStep] = useState<1 | 2>(1); // 1: Chọn hàng, 2: Thanh toán
  const { data: suppliers = [] } = useSuppliers();
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const createPartMutation = useCreatePartRepo();
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [receiptItems, setReceiptItems] = useState<
    Array<{
      partId: string;
      partName: string;
      sku: string;
      quantity: number;
      importPrice: number;
      sellingPrice: number;
      wholesalePrice: number;
    }>
  >([]);

  // Payment states
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank" | null>(
    null
  );
  const [paymentType, setPaymentType] = useState<
    "full" | "partial" | "note" | null
  >(null);
  const [partialAmount, setPartialAmount] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [discountPercent, setDiscountPercent] = useState(0);

  // Auto-save key cho localStorage
  const DRAFT_KEY = `goods_receipt_draft_${currentBranchId}`;

  // Khôi phục dữ liệu từ localStorage khi mở modal
  useEffect(() => {
    if (isOpen) {
      try {
        const savedDraft = localStorage.getItem(DRAFT_KEY);
        if (savedDraft) {
          const draft = JSON.parse(savedDraft);
          // Kiểm tra draft không quá 24h
          if (
            draft.timestamp &&
            Date.now() - draft.timestamp < 24 * 60 * 60 * 1000
          ) {
            if (draft.receiptItems?.length > 0 || draft.selectedSupplier) {
              const shouldRestore = window.confirm(
                `Phát hiện phiếu nhập chưa hoàn tất (${draft.receiptItems?.length || 0
                } sản phẩm).\n\nBạn có muốn khôi phục không?`
              );
              if (shouldRestore) {
                setReceiptItems(draft.receiptItems || []);
                setSelectedSupplier(draft.selectedSupplier || "");
                setDiscount(draft.discount || 0);
                setDiscountType(draft.discountType || "amount");
                setDiscountPercent(draft.discountPercent || 0);
                showToast.success("Đã khôi phục phiếu nhập từ bản nháp");
              } else {
                localStorage.removeItem(DRAFT_KEY);
              }
            }
          } else {
            // Draft quá cũ, xóa đi
            localStorage.removeItem(DRAFT_KEY);
          }
        }
      } catch (e) {
        console.error("Lỗi khôi phục draft:", e);
      }
    }
  }, [isOpen, DRAFT_KEY]);

  // Auto-save vào localStorage mỗi khi có thay đổi
  useEffect(() => {
    if (isOpen && (receiptItems.length > 0 || selectedSupplier)) {
      const draft = {
        receiptItems,
        selectedSupplier,
        discount,
        discountType,
        discountPercent,
        timestamp: Date.now(),
      };
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    }
  }, [
    isOpen,
    receiptItems,
    selectedSupplier,
    discount,
    discountType,
    discountPercent,
    DRAFT_KEY,
  ]);

  // Xóa draft khi hoàn tất phiếu nhập thành công
  const clearDraft = () => {
    localStorage.removeItem(DRAFT_KEY);
  };

  const filteredParts = useMemo(() => {
    console.log(
      "🔍 Desktop Modal - parts:",
      parts?.length || 0,
      parts?.slice(0, 2)
    );
    console.log("🔍 Desktop Modal - searchTerm:", searchTerm);

    if (!parts || parts.length === 0) {
      console.log("⚠️ parts is empty or undefined");
      return [];
    }

    if (!searchTerm || searchTerm.trim() === "") {
      console.log("✅ Showing all parts:", parts.length);
      return parts;
    }

    const q = searchTerm.toLowerCase().trim();
    const filtered = parts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
    console.log("✅ Filtered results:", filtered.length);
    return filtered;
  }, [parts, searchTerm]);

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
      // Không hiện toast khi tăng số lượng để tránh spam
    } else {
      setReceiptItems([
        ...receiptItems,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          importPrice: part.costPrice?.[currentBranchId] || 0,
          sellingPrice: part.retailPrice[currentBranchId] || 0,
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
    // Normalize: loại bỏ ký tự đặc biệt để so sánh
    const normalizeCode = (code: string): string =>
      code.toLowerCase().replace(/[-\s./\\]/g, "");
    const normalizedBarcode = normalizeCode(barcode);

    // Tìm part với logic ưu tiên: barcode > SKU > tên
    const foundPart = parts.find(
      (p) =>
        // 1. Khớp barcode (field mới)
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        // 2. Khớp SKU
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase() ||
        // 3. Tìm trong tên
        p.name?.toLowerCase().includes(barcode.toLowerCase())
    );

    if (foundPart) {
      addToReceipt(foundPart);
      setBarcodeInput("");
    } else {
      showToast.error(`Không tìm thấy sản phẩm có mã: ${barcode}`);
      setBarcodeInput("");
    }
  };

  // Handle camera barcode scan - Modal tự đóng sau khi quét
  const handleCameraScan = (barcode: string) => {
    console.log("📷 Camera scanned:", barcode);

    const normalizeCode = (code: string): string =>
      code.toLowerCase().replace(/[-\s./\\]/g, "");
    const normalizedBarcode = normalizeCode(barcode);

    const foundPart = parts.find(
      (p) =>
        normalizeCode(p.barcode || "") === normalizedBarcode ||
        p.barcode?.toLowerCase() === barcode.toLowerCase() ||
        normalizeCode(p.sku || "") === normalizedBarcode ||
        p.sku?.toLowerCase() === barcode.toLowerCase()
    );

    // KHÔNG cần đóng scanner - BarcodeScannerModal tự đóng

    if (foundPart) {
      // Kiểm tra đã có trong phiếu chưa
      const existingItem = receiptItems.find(
        (item) => item.partId === foundPart.id
      );
      if (existingItem) {
        // Chỉ tăng số lượng, KHÔNG hiện toast để tránh spam
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
            sellingPrice: foundPart.retailPrice[currentBranchId] || 0,
            wholesalePrice: foundPart.wholesalePrice?.[currentBranchId] || 0,
          },
        ]);
        showToast.success(`Đã thêm ${foundPart.name}`);
      }
      setSearchTerm("");
    } else {
      showToast.error(`Không tìm thấy: ${barcode}`);
    }
  };

  // Auto focus barcode input when showBarcodeInput is enabled
  useEffect(() => {
    if (showBarcodeInput) {
      setTimeout(() => barcodeInputRef.current?.focus(), 100);
    }
  }, [showBarcodeInput]);

  const updateReceiptItem = (
    partId: string,
    field: "quantity" | "importPrice" | "sellingPrice" | "wholesalePrice",
    value: number
  ) => {
    setReceiptItems((items) =>
      items.map((item) =>
        item.partId === partId ? { ...item, [field]: value } : item
      )
    );
  };

  const removeReceiptItem = (partId: string) => {
    setReceiptItems((items) => items.filter((item) => item.partId !== partId));
  };

  const subtotal = useMemo(() => {
    return receiptItems.reduce(
      (sum, item) => sum + item.importPrice * item.quantity,
      0
    );
  }, [receiptItems]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  const { profile } = useAuth();
  const handleSave = () => {
    if (!canDo(profile?.role, "part.update_price")) {
      showToast.error("Bạn không có quyền cập nhật giá");
      return;
    }
    if (receiptItems.length === 0) {
      showToast.warning("Vui lòng chọn sản phẩm nhập kho");
      return;
    }
    const supplierName =
      suppliers.find((s: any) => s.id === selectedSupplier)?.name || "";

    // Calculate paidAmount based on paymentType
    // Default to "full" if paymentType is null (user selected payment method but didn't explicitly click payment type)
    const effectivePaymentType = paymentType || "full";
    const calculatedPaidAmount =
      effectivePaymentType === "full"
        ? totalAmount
        : effectivePaymentType === "partial"
          ? partialAmount
          : 0;

    onSave(receiptItems, selectedSupplier, totalAmount, "", {
      paymentMethod: paymentMethod || "cash",
      paymentType: paymentType || "full",
      paidAmount: calculatedPaidAmount,
      discount,
    });
    clearDraft(); // Xóa draft sau khi hoàn tất
    setReceiptItems([]);
    setSelectedSupplier("");
    setSearchTerm("");
    setDiscount(0);
    setDiscountPercent(0);
    setDiscountType("amount");
  };

  const handleAddNewProduct = (productData: any) => {
    // Tạo sản phẩm mới với stock = 0, stock sẽ được cập nhật khi hoàn tất phiếu nhập
    (async () => {
      try {
        // Nếu người dùng nhập mã (Honda/Yamaha) thì dùng, không thì tự sinh PT-xxx
        const productSku = productData.barcode?.trim() || `PT-${Date.now()}`;
        const createRes = await createPartMutation.mutateAsync({
          name: productData.name,
          sku: productSku,
          barcode: productData.barcode?.trim() || "", // Lưu lại để tìm kiếm
          category: productData.category,
          description: productData.description,
          stock: { [currentBranchId]: 0 }, // Stock = 0, sẽ cập nhật khi hoàn tất phiếu nhập
          costPrice: { [currentBranchId]: productData.importPrice },
          retailPrice: { [currentBranchId]: productData.retailPrice },
          wholesalePrice: {
            [currentBranchId]: Math.round(productData.retailPrice * 0.9),
          },
        });

        // Xử lý response - có thể là { ok, data } hoặc trực tiếp Part object
        const partData = (createRes as any)?.data || createRes;
        const partId =
          partData?.id ||
          `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const partSku = partData?.sku || productSku;

        // Add to receipt items from persisted part
        setReceiptItems((prev) => [
          ...prev,
          {
            partId: partId,
            partName: productData.name,
            sku: partSku,
            quantity: productData.quantity,
            importPrice: productData.importPrice,
            sellingPrice: productData.retailPrice,
            wholesalePrice: productData.wholesalePrice || 0,
          },
        ]);
        showToast.success("Đã tạo phụ tùng mới và thêm vào phiếu nhập");
      } catch (e: any) {
        showToast.error(e?.message || "Lỗi tạo phụ tùng mới");
      } finally {
        setShowAddProductModal(false);
      }
    })();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 w-full max-w-7xl h-[92vh] rounded-2xl shadow-2xl overflow-hidden flex">
          {/* Left Panel - Product Browser (50%) */}
          <div className="w-1/2 flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200/50 dark:border-slate-700/50">
            {/* Modern Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/50 dark:to-slate-800/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={onClose}
                  className="w-9 h-9 flex items-center justify-center hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-400 transition-all hover:scale-105"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Danh mục sản phẩm
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Chọn để thêm vào giỏ
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAddProductModal(true)}
                className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-lg shadow-blue-500/30 transition-all hover:scale-105"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Thêm mới</span>
              </button>
            </div>

            {/* Search Bar with Icon */}
            <div className="p-3 bg-white/50 dark:bg-slate-800/50 space-y-2">
              {/* Barcode Scanner Input - Toggle visibility */}
              {showBarcodeInput && (
                <form onSubmit={handleBarcodeSubmit}>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <svg
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-500"
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
                        placeholder="Quét mã vạch hoặc nhập SKU..."
                        value={barcodeInput}
                        onChange={(e) => setBarcodeInput(e.target.value)}
                        className="w-full pl-10 pr-8 py-2.5 border-2 border-blue-300 dark:border-blue-600 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-slate-900 dark:text-slate-100 text-sm placeholder:text-blue-500/60 dark:placeholder:text-blue-400/60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                      />
                      {barcodeInput && (
                        <button
                          type="button"
                          onClick={() => setBarcodeInput("")}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                        >
                          <svg
                            className="w-4 h-4"
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
                      className="px-3 py-2.5 rounded-xl border-2 border-slate-300 dark:border-slate-600 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all"
                      title="Đóng"
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
                  </div>
                </form>
              )}

              {/* Manual Search with barcode toggle */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <svg
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
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
                  <input
                    type="text"
                    placeholder="Hoặc tìm kiếm thủ công..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                  />
                </div>

                {/* Barcode Toggle Button */}
                {!showBarcodeInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setShowBarcodeInput(true);
                      setTimeout(() => barcodeInputRef.current?.focus(), 100);
                    }}
                    className="px-3 py-2.5 rounded-xl border-2 border-blue-400 text-blue-600 bg-blue-50 dark:bg-blue-900/20 dark:border-blue-600 dark:text-blue-400 font-semibold text-sm flex items-center gap-1.5 transition-all hover:bg-blue-100 dark:hover:bg-blue-900/40"
                    title="Quét mã vạch"
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
                        d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z"
                      />
                    </svg>
                  </button>
                )}

                {/* Camera Scanner Button */}
                <button
                  type="button"
                  onClick={() => setShowCameraScanner(true)}
                  className="px-3 py-2.5 rounded-xl border-2 border-green-500 text-green-600 bg-green-50 dark:bg-green-900/20 font-semibold text-sm flex items-center gap-1.5 transition-all hover:bg-green-100"
                  title="Quét bằng camera"
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

            {/* Products Grid */}
            <div className="flex-1 overflow-y-auto p-3">
              {filteredParts.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <svg
                    className="w-16 h-16 mb-3 opacity-30"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
                    />
                  </svg>
                  <p className="text-sm font-medium">Không tìm thấy sản phẩm</p>
                  <p className="text-xs mt-1">Thử tìm kiếm với từ khóa khác</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredParts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => addToReceipt(part)}
                      className="group p-3 bg-white dark:bg-slate-800 rounded-xl hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200 hover:scale-[1.02]"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <svg
                            className="w-5 h-5 text-blue-600 dark:text-blue-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                            />
                          </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {part.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                              {part.sku}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${part.category
                                ? `${getCategoryColor(part.category).bg} ${getCategoryColor(part.category).text
                                }`
                                : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                                }`}
                            >
                              {part.category || "Chưa phân loại"}
                            </span>
                          </div>
                          {/* Price Information */}
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Nhập:</span>
                              <span className="text-[10px] font-semibold text-orange-600 dark:text-orange-400">
                                {formatCurrency(part.costPrice?.[currentBranchId] || 0)}
                              </span>
                            </div>
                            <span className="text-slate-300 dark:text-slate-600">•</span>
                            <div className="flex items-center gap-1">
                              <span className="text-[9px] text-slate-500 dark:text-slate-400 font-medium">Bán:</span>
                              <span className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(part.retailPrice?.[currentBranchId] || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <svg
                          className="w-5 h-5 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors"
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
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Panel - Cart & Checkout (50%) */}
          <div className="w-1/2 bg-white dark:bg-slate-800 flex flex-col">
            {/* Supplier Selection - Modern */}
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-emerald-50/30 to-teal-50/30 dark:from-slate-800/50 dark:to-slate-800/50">
              <div className="flex items-center gap-2 mb-2">
                <svg
                  className="w-4 h-4 text-emerald-600 dark:text-emerald-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
                <label className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                  Nhà cung cấp
                </label>
                <button
                  onClick={() => {
                    setShowSupplierModal(true);
                  }}
                  className="ml-auto flex items-center gap-1 text-xs px-2 py-1 rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:hover:bg-emerald-900/50 font-medium transition-all"
                >
                  <svg
                    className="w-3.5 h-3.5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  Thêm NCC
                </button>
              </div>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              >
                <option value="">Chọn nhà cung cấp...</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `• ${s.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {showSupplierModal && (
              <SupplierModal
                isOpen={showSupplierModal}
                onClose={() => setShowSupplierModal(false)}
                onSave={(supplier) => {
                  if (supplier?.id) {
                    setSelectedSupplier(supplier.id);
                    // Refresh suppliers list if needed, but react-query should handle it if we invalidate queries
                    // The SupplierModal already invalidates 'suppliers' query
                  }
                  setShowSupplierModal(false);
                }}
                mode="add"
              />
            )}

            {/* Cart Items - Modern Cards */}
            <div className="flex-1 overflow-y-auto p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <svg
                    className="w-5 h-5 text-blue-600 dark:text-blue-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                    />
                  </svg>
                  <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Giỏ hàng nhập
                  </h3>
                </div>
                <span className="text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 rounded-full font-semibold shadow-lg">
                  {receiptItems.length} sản phẩm
                </span>
              </div>

              {receiptItems.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-slate-400">
                  <div className="w-24 h-24 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 rounded-2xl flex items-center justify-center mb-4">
                    <svg
                      className="w-12 h-12 text-slate-300 dark:text-slate-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={1.5}
                        d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                      />
                    </svg>
                  </div>
                  <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">
                    Giỏ hàng trống
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Chọn sản phẩm bên trái để thêm vào
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {receiptItems.map((item, index) => {
                    // Tìm part gốc để lấy category
                    const originalPart = parts.find(
                      (p) => p.id === item.partId
                    );
                    return (
                      <div
                        key={item.partId}
                        className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 hover:shadow-md transition-shadow"
                      >
                        {/* Header: #, Name, SKU, Category, Delete */}
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-5 h-5 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                            <span className="text-[10px] font-bold text-white">
                              #{index + 1}
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">
                              {item.partName}
                            </div>
                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                              <span className="text-[9px] text-blue-600 dark:text-blue-400 font-mono">
                                {item.sku}
                              </span>
                              {originalPart?.category && (
                                <span
                                  className={`inline-flex items-center px-1 py-0 rounded text-[8px] font-medium ${getCategoryColor(originalPart.category).bg
                                    } ${getCategoryColor(originalPart.category).text
                                    }`}
                                >
                                  {originalPart.category}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => removeReceiptItem(item.partId)}
                            className="w-5 h-5 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400 hover:bg-red-200 flex-shrink-0 text-sm"
                            title="Xóa"
                          >
                            ×
                          </button>
                        </div>

                        {/* All inputs in ONE row: Quantity | Import Price | Selling Price | Total */}
                        <div className="flex items-center gap-1.5">
                          {/* Quantity controls */}
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={() =>
                                updateReceiptItem(
                                  item.partId,
                                  "quantity",
                                  Math.max(1, item.quantity - 1)
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-blue-50 text-sm"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                updateReceiptItem(
                                  item.partId,
                                  "quantity",
                                  Math.max(1, val)
                                );
                              }}
                              className="w-10 px-1 py-1 text-center border border-blue-300 dark:border-blue-700 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold"
                              min="1"
                            />
                            <button
                              onClick={() =>
                                updateReceiptItem(
                                  item.partId,
                                  "quantity",
                                  item.quantity + 1
                                )
                              }
                              className="w-6 h-6 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded text-slate-600 dark:text-slate-300 hover:bg-blue-50 text-sm"
                            >
                              +
                            </button>
                          </div>

                          {/* Import price */}
                          <FormattedNumberInput
                            value={item.importPrice}
                            onValue={(val) => {
                              const { clean } = validatePriceAndQty(
                                val,
                                item.quantity
                              );
                              const newImport = clean.importPrice;
                              const autoPrice = Math.round(newImport * 1.5);
                              setReceiptItems((items) =>
                                items.map((it) =>
                                  it.partId === item.partId
                                    ? {
                                      ...it,
                                      importPrice: newImport,
                                      sellingPrice:
                                        it.sellingPrice === 0 ||
                                          it.sellingPrice ===
                                          Math.round(
                                            (it.importPrice || 0) * 1.5
                                          )
                                          ? autoPrice
                                          : it.sellingPrice,
                                    }
                                    : it
                                )
                              );
                            }}
                            className="min-w-[70px] max-w-[110px] flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-xs font-medium focus:border-blue-500"
                            placeholder="Giá nhập"
                          />

                          {/* Selling price */}
                          <FormattedNumberInput
                            value={item.sellingPrice}
                            onValue={(val) =>
                              updateReceiptItem(
                                item.partId,
                                "sellingPrice",
                                Math.max(0, Math.round(val))
                              )
                            }
                            className="min-w-[70px] max-w-[110px] flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-xs font-medium focus:border-emerald-500"
                            placeholder="Giá bán"
                          />

                          {/* Total amount */}
                          <div className="min-w-[70px] text-right flex-shrink-0">
                            <div className="text-xs font-bold text-blue-600 dark:text-blue-400 whitespace-nowrap">
                              {formatCurrency(item.importPrice * item.quantity)}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Payment Section - Compact */}
            <div className="p-3 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {/* Total Display - Always visible */}
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase">
                    Tổng thanh toán
                  </span>
                  <div className="text-right">
                    <div className="text-xl font-black text-white">
                      {formatCurrency(totalAmount)}
                    </div>
                    <div className="text-[10px] text-white/70">
                      {receiptItems.length} SP
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Method - Compact buttons */}
              <div className="mb-3">
                <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                  Phương thức thanh toán <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === "cash"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                      : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                      }`}
                  >
                    💵 Tiền mặt
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === "bank"
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                      : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                      }`}
                  >
                    🏦 Chuyển khoản
                  </button>
                </div>
              </div>

              {/* Show details only when payment method is selected */}
              {paymentMethod && (
                <>
                  {/* Payment Type */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      Hình thức thanh toán
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          setPaymentType("full");
                          setPartialAmount(0);
                        }}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${paymentType === "full"
                          ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                          : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        Đủ
                      </button>
                      <button
                        onClick={() => setPaymentType("partial")}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${paymentType === "partial"
                          ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                          : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        1 phần
                      </button>
                      <button
                        onClick={() => {
                          setPaymentType("note");
                          setPartialAmount(0);
                        }}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${paymentType === "note"
                          ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                          : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                          }`}
                      >
                        Công nợ
                      </button>
                    </div>
                  </div>

                  {/* Partial Payment Input */}
                  {paymentType === "partial" && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Số tiền khách trả
                      </label>
                      <FormattedNumberInput
                        value={partialAmount}
                        onValue={(v) =>
                          setPartialAmount(Math.max(0, Math.round(v)))
                        }
                        className="w-full px-3 py-2 border-2 border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-sm font-bold focus:border-orange-500"
                        placeholder="Nhập số tiền..."
                      />
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">Còn lại:</span>
                        <span className="font-bold text-red-600 dark:text-red-400">
                          {formatCurrency(
                            Math.max(0, totalAmount - partialAmount)
                          )}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Transaction Type */}
                  {paymentType && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        Loại hạch toán
                      </label>
                      <select className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:border-blue-500">
                        <option>Mua hàng/nhập kho</option>
                        <option>Nhập trả hàng</option>
                        <option>Khác</option>
                      </select>
                    </div>
                  )}
                </>
              )}

              {/* Action Buttons - Always visible */}
              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-900 dark:text-slate-100 px-3 py-2.5 rounded-lg font-bold text-xs transition-all"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                      />
                    </svg>
                    LƯU NHÁP
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (!paymentMethod) {
                      showToast.warning("Vui lòng chọn phương thức thanh toán");
                      return;
                    }
                    if (!paymentType) {
                      showToast.warning("Vui lòng chọn hình thức thanh toán");
                      return;
                    }
                    if (paymentType === "partial" && partialAmount <= 0) {
                      showToast.warning("Vui lòng nhập số tiền khách trả");
                      return;
                    }
                    handleSave();
                  }}
                  disabled={
                    !paymentMethod ||
                    !paymentType ||
                    (paymentType === "partial" && partialAmount <= 0)
                  }
                  className="flex-1 bg-orange-500 hover:bg-orange-600 text-white px-3 py-2.5 rounded-lg font-bold text-xs transition-all disabled:bg-slate-300 disabled:text-slate-500 disabled:cursor-not-allowed dark:disabled:bg-slate-600 dark:disabled:text-slate-400"
                >
                  <div className="flex items-center justify-center gap-2">
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
                      />
                    </svg>
                    NHẬP KHO
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Camera Barcode Scanner Modal */}
      <BarcodeScannerModal
        isOpen={showCameraScanner}
        onClose={() => setShowCameraScanner(false)}
        onScan={handleCameraScan}
      />

      {/* Add Product Modal */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSave={handleAddNewProduct}
      />
    </>
  );
};

export default GoodsReceiptModal;
