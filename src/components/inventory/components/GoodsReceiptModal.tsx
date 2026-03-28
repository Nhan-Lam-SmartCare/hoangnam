import React, { useState, useMemo, useRef, useEffect } from "react";
import { Plus, Search, Trash2, X } from "lucide-react";
import { useSuppliers, useCreateSupplier } from "../../../hooks/useSuppliers";
import { useCreatePartRepo } from "../../../hooks/usePartsRepository";
import { showToast } from "../../../utils/toast";
import { formatCurrency } from "../../../utils/format";
import { getCategoryColor } from "../../../utils/categoryColors";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import { fetchPartBySku } from "../../../lib/repository/partsRepository";
import AddProductModal from "./AddProductModal";
import type { Part } from "../../../types";
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
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [step, setStep] = useState<1 | 2>(1); // 1: Ch�n h�ng, 2: Thanh to�n
  const { data: suppliers = [] } = useSuppliers();
  const createSupplier = useCreateSupplier();
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [newSupplier, setNewSupplier] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });
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
                `Phát hiện phiếu nhập chưa hoàn tất (${
                  draft.receiptItems?.length || 0
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
      "�x� Desktop Modal - parts:",
      parts?.length || 0,
      parts?.slice(0, 2)
    );
    console.log("�x� Desktop Modal - searchTerm:", searchTerm);

    if (!parts || parts.length === 0) {
      console.log("�a� parts is empty or undefined");
      return [];
    }

    if (!searchTerm || searchTerm.trim() === "") {
      console.log("�S& Showing all parts:", parts.length);
      return parts;
    }

    const q = searchTerm.toLowerCase().trim();
    const filtered = parts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
    console.log("�S& Filtered results:", filtered.length);
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
      showToast.success(`� tng s� l��ng ${part.name}`);
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
      showToast.success(`� th�m ${part.name} v�o phi�u nh�p`);
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
      showToast.error(`Kh�ng t�m th�y s�n ph�m c� m�: ${barcode}`);
      setBarcodeInput("");
    }
  };

  // Auto focus barcode input when modal opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => barcodeInputRef.current?.focus(), 300);
    }
  }, [isOpen]);

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
      showToast.error("B�n kh�ng c� quy�n c�p nh�t gi�");
      return;
    }
    if (receiptItems.length === 0) {
      showToast.warning("Vui l�ng ch�n s�n ph�m nh�p kho");
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
        showToast.success("� t�o ph� t�ng m�:i v� th�m v�o phi�u nh�p");
      } catch (e: any) {
        showToast.error(e?.message || "L�i t�o ph� t�ng m�:i");
      } finally {
        setShowAddProductModal(false);
      }
    })();
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-2 lg:p-4">
        <div className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 w-full max-w-6xl h-[95vh] lg:h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex">
          {/* Left Panel - Product Browser (45%) */}
          <div className="w-[45%] flex flex-col bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm border-r border-slate-200/50 dark:border-slate-700/50">
            {/* Modern Header */}
            <div className="flex items-center justify-between p-3 border-b border-slate-200/50 dark:border-slate-700/50 bg-gradient-to-r from-blue-50/50 to-indigo-50/50 dark:from-slate-800/50 dark:to-slate-800/50">
              <div className="flex items-center gap-2">
                <button
                  onClick={onClose}
                  className="w-8 h-8 flex items-center justify-center hover:bg-white/80 dark:hover:bg-slate-700/80 rounded-lg text-slate-600 dark:text-slate-400 transition-all hover:scale-105"
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
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                </button>
                <div>
                  <h2 className="text-base font-bold text-slate-900 dark:text-slate-100">
                    Danh m�c s�n ph�m
                  </h2>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Ch�n �� th�m v�o gi�
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
                <span>Th�m m�:i</span>
              </button>
            </div>

            {/* Search Bar with Icon */}
            <div className="p-3 bg-white/50 dark:bg-slate-800/50 space-y-2">
              {/* Barcode Scanner Input - Quick Entry */}
              <form onSubmit={handleBarcodeSubmit}>
                <div className="relative">
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
                    placeholder="Qu�t m� v�ch ho�c nh�p SKU �� th�m nhanh..."
                    value={barcodeInput}
                    onChange={(e) => setBarcodeInput(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border-2 border-blue-300 dark:border-blue-600 rounded-xl bg-blue-50/50 dark:bg-blue-900/20 text-slate-900 dark:text-slate-100 text-sm placeholder:text-blue-500/60 dark:placeholder:text-blue-400/60 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all font-mono"
                  />
                  {barcodeInput && (
                    <button
                      type="button"
                      onClick={() => setBarcodeInput("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
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
              </form>

              {/* Manual Search */}
              <div className="relative">
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
                  placeholder="Ho�c t�m ki�m th� c�ng..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
                />
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
                  <p className="text-sm font-medium">Kh�ng t�m th�y s�n ph�m</p>
                  <p className="text-xs mt-1">Th� t�m ki�m v�:i t� kh�a kh�c</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredParts.map((part) => (
                    <div
                      key={part.id}
                      onClick={() => addToReceipt(part)}
                      className="group p-2.5 bg-white dark:bg-slate-800 rounded-lg hover:shadow-md hover:shadow-blue-500/10 cursor-pointer border border-slate-200 dark:border-slate-700 hover:border-blue-400 dark:hover:border-blue-600 transition-all duration-200"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 dark:from-blue-900/30 dark:to-indigo-900/30 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                          <svg
                            className="w-4 h-4 text-blue-600 dark:text-blue-400"
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
                          <div className="font-medium text-[13px] text-slate-900 dark:text-slate-100 line-clamp-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                            {part.name}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-blue-600 dark:text-blue-400 font-mono bg-blue-50 dark:bg-blue-900/30 px-1.5 py-0.5 rounded">
                              {part.sku}
                            </span>
                            <span
                              className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                part.category
                                  ? `${getCategoryColor(part.category).bg} ${
                                      getCategoryColor(part.category).text
                                    }`
                                  : "bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
                              }`}
                            >
                              {part.category || "Chưa phân loại"}
                            </span>
                          </div>
                        </div>
                        <svg
                          className="w-4 h-4 text-slate-300 dark:text-slate-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors flex-shrink-0"
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

          {/* Right Panel - Cart & Checkout (55%) */}
          <div className="w-[55%] bg-white dark:bg-slate-800 flex flex-col">
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
                  Nh� cung c�p
                </label>
                <button
                  onClick={() => {
                    setNewSupplier({
                      name: "",
                      phone: "",
                      address: "",
                      note: "",
                    });
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
                  Th�m NCC
                </button>
              </div>
              <select
                value={selectedSupplier}
                onChange={(e) => setSelectedSupplier(e.target.value)}
                className="w-full px-4 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-sm font-medium focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              >
                <option value="">Ch�n nh� cung c�p...</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `" ${s.phone}` : ""}
                  </option>
                ))}
              </select>
            </div>

            {showSupplierModal && (
              <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
                <div className="bg-white dark:bg-slate-800 rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
                  <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                    Th�m nh� cung c�p
                  </h3>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        T�n *
                      </label>
                      <input
                        autoFocus
                        value={newSupplier.name}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            name: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                        placeholder="T�n nh� cung c�p"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        i�!n tho�i
                      </label>
                      <input
                        value={newSupplier.phone}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            phone: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm"
                        placeholder="ST"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        �9a ch�0
                      </label>
                      <textarea
                        rows={2}
                        value={newSupplier.address}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            address: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm resize-none"
                        placeholder="�9a ch�0 nh� cung c�p"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1 text-slate-600 dark:text-slate-400">
                        Ghi ch�
                      </label>
                      <textarea
                        rows={2}
                        value={newSupplier.note}
                        onChange={(e) =>
                          setNewSupplier((p) => ({
                            ...p,
                            note: e.target.value,
                          }))
                        }
                        className="w-full px-3 py-2 rounded border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-sm resize-none"
                        placeholder="Th�ng tin th�m (t�y ch�n)"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowSupplierModal(false)}
                      className="px-4 py-2 text-sm rounded border border-slate-300 dark:border-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      H�y
                    </button>
                    <button
                      onClick={async () => {
                        if (!newSupplier.name.trim()) {
                          showToast.warning("Nh�p t�n nh� cung c�p");
                          return;
                        }
                        try {
                          const res: any = await createSupplier.mutateAsync({
                            name: newSupplier.name.trim(),
                            phone: newSupplier.phone?.trim() || undefined,
                            address: newSupplier.address?.trim() || undefined,
                          });
                          setSelectedSupplier(res.id);
                          setShowSupplierModal(false);
                        } catch (e: any) {
                          // mutation hook �� show toast
                        }
                      }}
                      className="px-4 py-2 text-sm rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                      disabled={createSupplier.isPending}
                    >
                      {createSupplier.isPending ? "ang l�u..." : "L�u"}
                    </button>
                  </div>
                </div>
              </div>
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
                    Gi� h�ng nh�p
                  </h3>
                </div>
                <span className="text-xs text-white bg-gradient-to-r from-blue-600 to-indigo-600 px-3 py-1 rounded-full font-semibold shadow-lg">
                  {receiptItems.length} s�n ph�m
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
                    Gi� h�ng tr�ng
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Ch�n s�n ph�m b�n tr�i �� th�m v�o
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receiptItems.map((item, index) => (
                    <div
                      key={item.partId}
                      className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 hover:shadow-md transition-shadow"
                    >
                      {/* Compact Header: #, Name, SKU, Delete - All in one line */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-white">
                            #{index + 1}
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-xs text-slate-900 dark:text-slate-100 truncate">
                            {item.partName}
                          </div>
                          <div className="text-[9px] text-slate-500 dark:text-slate-400">
                            SKU: {item.sku}
                          </div>
                        </div>
                        <button
                          onClick={() => removeReceiptItem(item.partId)}
                          className="w-6 h-6 flex items-center justify-center bg-red-100 dark:bg-red-900/30 rounded text-red-600 dark:text-red-400 hover:bg-red-200 flex-shrink-0"
                          title="X�a"
                        >
                          �
                        </button>
                      </div>

                      {/* All inputs in ONE row: Quantity | Import Price | Selling Price | Total */}
                      <div className="flex items-center gap-2">
                        {/* Quantity controls */}
                        <div className="flex items-center gap-1">
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
                          className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-xs font-medium focus:border-blue-500"
                          placeholder="Gi� nh�p"
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
                          className="flex-1 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-xs font-medium focus:border-emerald-500"
                          placeholder="Gi� b�n"
                        />

                        {/* Total amount */}
                        <div className="w-20 text-right">
                          <div className="text-xs font-bold text-blue-600 dark:text-blue-400">
                            {formatCurrency(item.importPrice * item.quantity)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Payment Section - Compact */}
            <div className="p-3 border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800">
              {/* Total Display - Always visible */}
              <div className="mb-3 p-3 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg shadow">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white uppercase">
                    T�"ng thanh to�n
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
                  Ph��ng th�c thanh to�n <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setPaymentMethod("cash")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 rounded-lg text-xs font-bold transition-all ${
                      paymentMethod === "cash"
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400"
                        : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    �x� Ti�n m�t
                  </button>
                  <button
                    onClick={() => setPaymentMethod("bank")}
                    className={`flex items-center justify-center gap-1.5 px-3 py-2 border-2 rounded-lg text-xs font-bold transition-all ${
                      paymentMethod === "bank"
                        ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                        : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                    }`}
                  >
                    �x�� Chuy�n kho�n
                  </button>
                </div>
              </div>

              {/* Show details only when payment method is selected */}
              {paymentMethod && (
                <>
                  {/* Payment Type */}
                  <div className="mb-3">
                    <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                      H�nh th�c thanh to�n
                    </label>
                    <div className="grid grid-cols-3 gap-1.5">
                      <button
                        onClick={() => {
                          setPaymentType("full");
                          setPartialAmount(0);
                        }}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${
                          paymentType === "full"
                            ? "border-blue-500 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400"
                            : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        �
                      </button>
                      <button
                        onClick={() => setPaymentType("partial")}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${
                          paymentType === "partial"
                            ? "border-orange-500 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400"
                            : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        1 ph�n
                      </button>
                      <button
                        onClick={() => {
                          setPaymentType("note");
                          setPartialAmount(0);
                        }}
                        className={`px-2 py-1.5 border-2 rounded-lg text-[10px] font-bold transition-all ${
                          paymentType === "note"
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400"
                            : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300"
                        }`}
                      >
                        C�ng n�
                      </button>
                    </div>
                  </div>

                  {/* Partial Payment Input */}
                  {paymentType === "partial" && (
                    <div className="mb-3">
                      <label className="block text-[10px] font-bold text-slate-700 dark:text-slate-300 mb-1.5">
                        S� ti�n kh�ch tr�
                      </label>
                      <FormattedNumberInput
                        value={partialAmount}
                        onValue={(v) =>
                          setPartialAmount(Math.max(0, Math.round(v)))
                        }
                        className="w-full px-3 py-2 border-2 border-orange-300 dark:border-orange-700 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-right text-sm font-bold focus:border-orange-500"
                        placeholder="Nh�p s� ti�n..."
                      />
                      <div className="mt-1.5 flex items-center justify-between text-[10px]">
                        <span className="text-slate-500">C�n l�i:</span>
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
                        Lo�i h�ch to�n
                      </label>
                      <select className="w-full px-3 py-2 border-2 border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 text-xs font-semibold focus:border-blue-500">
                        <option>Mua h�ng/nh�p kho</option>
                        <option>Nh�p tr� h�ng</option>
                        <option>Kh�c</option>
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
                    L�U NH�P
                  </div>
                </button>
                <button
                  onClick={() => {
                    if (!paymentMethod) {
                      showToast.warning("Vui l�ng ch�n ph��ng th�c thanh to�n");
                      return;
                    }
                    if (!paymentType) {
                      showToast.warning("Vui l�ng ch�n h�nh th�c thanh to�n");
                      return;
                    }
                    if (paymentType === "partial" && partialAmount <= 0) {
                      showToast.warning("Vui l�ng nh�p s� ti�n kh�ch tr�");
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
                    NH�P KHO
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

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
