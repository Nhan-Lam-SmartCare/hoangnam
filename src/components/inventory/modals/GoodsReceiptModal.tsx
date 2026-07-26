import { X, Smartphone, Palette, Camera } from 'lucide-react';
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { canDo } from '../../../utils/permissions';
import { useSuppliers } from '../../../hooks/useSuppliers';
import { useCreatePartRepo } from '../../../hooks/usePartsRepository';
import { showToast } from '../../../utils/toast';
import { formatCurrency } from '../../../utils/format';
import { getCategoryColor } from '../../../utils/categoryColors';
import { validatePriceAndQty } from '../../../utils/validation';
import { generateSKU } from '../../../utils/sku';
import {
  calcSellingFromRule,
  getCategoryPricingRule,
  type RoundingRule,
} from '../../../utils/categoryPricingRules';
import FormattedNumberInput from '../../common/FormattedNumberInput';
import BarcodeScannerModal from '../../common/BarcodeScannerModal';
import SupplierModal from '../../inventory/components/SupplierModal';
import AddProductModal from './AddProductModal';
import { isPhoneBranch } from '../../../utils/branchUtils';
import { useBranchesRepo } from '../../../hooks/useBranchesRepository';
import { checkImeis } from '../../../lib/repository/partUnitsRepository';
import type { Part } from '../../../types';

const DEFAULT_MARKUP_PERCENT = 50;

/** Gom IMEI của một dòng về mảng sạch (bỏ ô trống, cắt khoảng trắng). */
const collectImeis = (item: { imeis?: string[]; imei?: string }): string[] => {
  const raw =
    item.imeis && item.imeis.length > 0 ? item.imeis : item.imei ? [item.imei] : [];
  return raw.map((s) => (s || "").trim()).filter((s) => s.length > 0);
};

type ImeiProblem = {
  message: string;
  severity: "warning" | "error";
  /** IMEI cần tô đỏ trên form (chữ HOA). */
  conflicts: Set<string>;
};

/**
 * Thẩm định IMEI trước khi lưu phiếu. Ba tầng, dừng ở tầng đầu tiên phát hiện lỗi:
 *   1. Đủ số lượng — nhập 5 máy phải có 5 IMEI.
 *   2. Không lặp trong cùng phiếu.
 *   3. Không trùng máy đã có trong hệ thống (hỏi DB, xuyên chi nhánh).
 *
 * Trả `null` khi hợp lệ. Đây là cảnh báo phía client cho thông báo dễ hiểu;
 * chốt chặn thật vẫn nằm ở RPC `receipt_create_atomic`.
 */
async function validateReceiptImeis(
  items: Array<{ partName: string; quantity: number; imeis?: string[]; imei?: string }>,
  allImeis: string[]
): Promise<ImeiProblem | null> {
  for (const item of items) {
    const imeis = collectImeis(item);
    if (imeis.length !== item.quantity) {
      return {
        message: `«${item.partName}» nhập ${item.quantity} máy nhưng mới có ${imeis.length} số IMEI. Vui lòng điền đủ.`,
        severity: "warning",
        conflicts: new Set(),
      };
    }
  }

  const seen = new Set<string>();
  for (const imei of allImeis) {
    const key = imei.toUpperCase();
    if (seen.has(key)) {
      return {
        message: `IMEI bị nhập lặp trong cùng phiếu: ${imei}`,
        severity: "error",
        conflicts: new Set([key]),
      };
    }
    seen.add(key);
  }

  // Hỏi lại DB ngay trước khi lưu: bảng tô đỏ có thể đã cũ 500ms, hoặc chi
  // nhánh khác vừa nhập đúng chiếc máy này trong lúc nhân viên đang gõ.
  const res = await checkImeis(allImeis);
  if (res.ok && res.data.length > 0) {
    return {
      message: `IMEI đã tồn tại trong hệ thống: ${res.data
        .map((c) => `${c.imei} (${c.partName})`)
        .join(", ")}`,
      severity: "error",
      conflicts: new Set(res.data.map((c) => c.imei.trim().toUpperCase())),
    };
  }

  return null;
}

const calcMarkupPercent = (importPrice: number, sellingPrice: number) => {
  if (importPrice <= 0 || sellingPrice <= 0) return DEFAULT_MARKUP_PERCENT;
  return Math.max(0, Math.round(((sellingPrice / importPrice) - 1) * 100));
};

// Goods Receipt Modal Component (Ảnh 2)
const GoodsReceiptModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  parts: Part[];
  currentBranchId: string;
  canViewImportPrice?: boolean;
  onSave: (
    items: Array<{
      partId: string;
      partName: string;
      quantity: number;
      importPrice: number;
      laborCost?: number;
      sellingPrice: number;
      /** IMEI từng máy — độ dài phải bằng `quantity` với hàng quản lý theo máy. */
      imeis?: string[];
      imei?: string;
      color?: string;
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
}> = ({ isOpen, onClose, parts, currentBranchId, canViewImportPrice = true, onSave }) => {
  const { profile } = useAuth();
  const canCreatePart = canDo(profile, "part.create");
  const { data: branchesRepo = [] } = useBranchesRepo();
  const hideLaborCost = isPhoneBranch(currentBranchId, branchesRepo);
  const [searchTerm, setSearchTerm] = useState("");
  const [barcodeInput, setBarcodeInput] = useState("");
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const [showCameraScanner, setShowCameraScanner] = useState(false);
  const [showBarcodeInput, setShowBarcodeInput] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState("");
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
      laborCost?: number;
      sellingPrice: number;
      wholesalePrice: number;
      markupPercent: number;
      roundingRule: RoundingRule;
      imei?: string;
      imeis?: string[];
      color?: string;
      colors?: string[];
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
  const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
  /**
   * IMEI đã tồn tại trong hệ thống (chữ HOA để so sánh). Dùng tô đỏ ô nhập ngay
   * lúc gõ, thay vì để nhân viên điền xong cả phiếu mới báo lỗi. Đây chỉ là
   * cảnh báo sớm — chốt chặn thật nằm ở RPC receipt_create_atomic.
   */
  const [conflictImeis, setConflictImeis] = useState<Set<string>>(new Set());

  // Auto-save key cho localStorage
  const DRAFT_KEY = `goods_receipt_draft_${currentBranchId}`;

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

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
                setReceiptItems(
                  (draft.receiptItems || []).map((item: any) => {
                    const importPrice = Number(item.importPrice || 0);
                    const sellingPrice = Number(item.sellingPrice || 0);
                    return {
                      ...item,
                      markupPercent:
                        typeof item.markupPercent === "number"
                          ? item.markupPercent
                          : calcMarkupPercent(importPrice, sellingPrice),
                      roundingRule:
                        item.roundingRule === "hundred" ||
                        item.roundingRule === "thousand"
                          ? item.roundingRule
                          : "integer",
                    };
                  })
                );
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
    if (!parts || parts.length === 0) {
      return [];
    }

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

    if (!searchTerm || searchTerm.trim() === "") {
      return branchParts;
    }

    const q = searchTerm.toLowerCase().trim();
    const filtered = branchParts.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) || p.sku?.toLowerCase().includes(q)
    );
    return filtered;
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
      // Không hiện toast khi tăng số lượng để tránh spam
    } else {
      const rule = getCategoryPricingRule(part.category || "");
      const importPrice =
        canViewImportPrice ? part.costPrice?.[currentBranchId] || 0 : 0;
      const existingRetail = part.retailPrice?.[currentBranchId] || 0;
      setReceiptItems([
        ...receiptItems,
        {
          partId: part.id,
          partName: part.name,
          sku: part.sku,
          quantity: 1,
          importPrice,
          laborCost: Number((part as any).laborCost?.[currentBranchId] || 0),
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
        const rule = getCategoryPricingRule(foundPart.category || "");
        const importPrice =
          canViewImportPrice ? foundPart.costPrice?.[currentBranchId] || 0 : 0;
        const existingRetail = foundPart.retailPrice?.[currentBranchId] || 0;
        setReceiptItems((items) => [
          ...items,
          {
            partId: foundPart.id,
            partName: foundPart.name,
            sku: foundPart.sku,
            quantity: 1,
            importPrice,
            laborCost: Number((foundPart as any).laborCost?.[currentBranchId] || 0),
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
    field:
      | "quantity"
      | "importPrice"
      | "sellingPrice"
      | "wholesalePrice"
      | "markupPercent"
      | "imei"
      | "color",
    value: any
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

  /** Mọi IMEI đang có trong phiếu, đã làm sạch. */
  const allImeisInReceipt = useMemo(
    () => receiptItems.flatMap((item) => collectImeis(item)),
    [receiptItems]
  );

  /**
   * Hỏi DB xem IMEI nào đã tồn tại. Chờ 500ms sau lần gõ cuối để không bắn một
   * request mỗi ký tự. `cancelled` chặn phản hồi cũ ghi đè kết quả mới khi
   * người dùng gõ nhanh hơn tốc độ mạng.
   */
  useEffect(() => {
    if (!isOpen || allImeisInReceipt.length === 0) {
      setConflictImeis(new Set());
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      const res = await checkImeis(allImeisInReceipt);
      if (cancelled) return;
      setConflictImeis(
        res.ok
          ? new Set(res.data.map((c) => c.imei.trim().toUpperCase()))
          : new Set()
      );
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, allImeisInReceipt]);

  const subtotal = useMemo(() => {
    // Payment amount for goods receipt must follow import value only.
    return receiptItems.reduce(
      (sum, item) => sum + item.importPrice * item.quantity,
      0
    );
  }, [receiptItems]);

  const handleSave = async () => {
    if (!canDo(profile, "part.update_price")) {
      showToast.error("Bạn không có quyền cập nhật giá");
      return;
    }
    if (receiptItems.length === 0) {
      showToast.warning("Vui lòng chọn sản phẩm nhập kho");
      return;
    }

    if (totalAmount < 0) {
      showToast.warning("Tổng tiền nhập kho không được âm. Vui lòng kiểm tra lại!");
      return;
    }

    // ── Kiểm tra IMEI cho chi nhánh điện thoại ────────────────────────────
    // Không có IMEI thì máy vào kho là một con số vô danh: không biết máy nào
    // còn, không tra được bảo hành, không tính được lãi thực từng chiếc.
    if (hideLaborCost) {
      const problem = await validateReceiptImeis(receiptItems, allImeisInReceipt);
      if (problem) {
        if (problem.conflicts.size > 0) setConflictImeis(problem.conflicts);
        showToast[problem.severity](problem.message);
        return;
      }
    }

    if (!selectedSupplier) {
      showToast.warning("⚠️ Vui lòng chọn Nhà cung cấp trước khi thực hiện nhập kho!");
      return;
    }

    const effectivePaymentType = paymentType || "full";
    if (!paymentMethod) {
      showToast.warning("Vui lòng chọn phương thức thanh toán (Tiền mặt hoặc Chuyển khoản)");
      return;
    }

    if (effectivePaymentType === "partial" && partialAmount <= 0) {
      showToast.warning("Vui lòng nhập số tiền thanh toán!");
      return;
    }

    const calculatedPaidAmount =
      effectivePaymentType === "full"
        ? totalAmount
        : effectivePaymentType === "partial"
          ? partialAmount
          : 0;

    onSave(receiptItems, selectedSupplier, totalAmount, "", {
      paymentMethod: paymentMethod || "cash",
      paymentType: effectivePaymentType,
      paidAmount: calculatedPaidAmount,
      discount: discountAmount,
    });
    clearDraft();
    setReceiptItems([]);
    setSelectedSupplier("");
    setSearchTerm("");
    setDiscount(0);
    setDiscountPercent(0);
    setDiscountType("amount");
    setConflictImeis(new Set());
    // Cố ý KHÔNG báo "Nhập kho thành công" ở đây: onSave chạy bất đồng bộ và
    // RPC vẫn có thể từ chối (IMEI trùng, không đủ quyền...). Kết quả thật do
    // useGoodsReceiptActions thông báo, kèm mã phiếu.
  };

  const handleCancelReceipt = () => {
    if (receiptItems.length > 0 || selectedSupplier) {
      if (window.confirm("Bạn có chắc chắn muốn HỦY phiếu nhập này và XÓA bản nháp không?")) {
        clearDraft();
        setReceiptItems([]);
        setSelectedSupplier("");
        setSearchTerm("");
        setDiscount(0);
        setDiscountPercent(0);
        setLastSavedTime(null);
        onClose();
      }
    } else {
      onClose();
    }
  };

  const handleAddNewProduct = (productData: any) => {
    if (!canCreatePart) {
      showToast.error("Bạn không có quyền tạo sản phẩm mới");
      return;
    }

    (async () => {
      try {
        const productSku = productData.barcode || generateSKU();
        const result = await createPartMutation.mutateAsync({
          name: productData.name,
          sku: productSku,
          barcode: productData.barcode || productSku,
          category: productData.category || "Chưa phân loại",
          description: productData.description || "",
          warrantyPeriod: productData.warranty
            ? `${productData.warranty} ${productData.warrantyUnit}`
            : undefined,
          stock: { [currentBranchId]: productData.quantity || 0 },
          costPrice: { [currentBranchId]: productData.importPrice || 0 },
          retailPrice: { [currentBranchId]: productData.retailPrice || 0 },
          wholesalePrice: { [currentBranchId]: productData.retailPrice || 0 },
          laborCost: { [currentBranchId]: productData.laborCost || 0 },
        });

        const partData = (result as any)?.data || result;
        const partId =
          partData?.id ||
          `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const partSku = partData?.sku || productSku;

        setReceiptItems((prev) => [
          ...prev,
          {
            partId: partId,
            partName: productData.name,
            sku: partSku,
            quantity: productData.quantity,
            importPrice: productData.importPrice,
            laborCost: productData.laborCost || 0,
            sellingPrice: productData.retailPrice,
            wholesalePrice: productData.wholesalePrice || 0,
            imei: productData.imei || "",
            color: productData.color || "",
            markupPercent: calcMarkupPercent(
              Number(productData.importPrice || 0),
              Number(productData.retailPrice || 0)
            ),
            roundingRule: getCategoryPricingRule(
              String(productData.category || "")
            ).roundingRule,
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

  const totalQuantity = useMemo(() => {
    return receiptItems.reduce((sum, item) => sum + item.quantity, 0);
  }, [receiptItems]);

  const totalRetailSelling = useMemo(() => {
    return receiptItems.reduce((sum, item) => sum + item.sellingPrice * item.quantity, 0);
  }, [receiptItems]);

  const estimatedProfitRate = useMemo(() => {
    if (subtotal <= 0) return 0;
    return Math.round(((totalRetailSelling - subtotal) / subtotal) * 100);
  }, [subtotal, totalRetailSelling]);

  const discountAmount = useMemo(() => {
    if (discountType === "percent") {
      return Math.round((subtotal * discountPercent) / 100);
    }
    return discount;
  }, [subtotal, discount, discountType, discountPercent]);

  const totalAmount = useMemo(() => {
    return Math.max(0, subtotal - discountAmount);
  }, [subtotal, discountAmount]);

  const currentBranchName = branchesRepo.find((b) => b.id === currentBranchId)?.name || "hiện tại";

  const { currentBranchSuppliers, otherSuppliers } = useMemo(() => {
    const branchSupps = suppliers.filter((s: any) => {
      const bId = s.branch_id || s.branchId;
      return bId === currentBranchId;
    });
    const otherSupps = suppliers.filter((s: any) => {
      const bId = s.branch_id || s.branchId;
      return !bId || bId !== currentBranchId;
    });
    return { currentBranchSuppliers: branchSupps, otherSuppliers: otherSupps };
  }, [suppliers, currentBranchId]);

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3"
        role="dialog"
        aria-modal="true"
        aria-labelledby="goods-receipt-title"
      >
        <div className="bg-white dark:bg-slate-900 w-full max-w-7xl h-[94vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col border border-slate-200 dark:border-slate-800">
          {/* Top Unified Header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-900 text-white select-none">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-600/30 text-blue-400 border border-blue-500/30 flex items-center justify-center font-bold">
                📥
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 id="goods-receipt-title" className="text-base font-bold text-white tracking-wide">
                    PHIẾU NHẬP KHO
                  </h2>
                  <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
                    {branchesRepo.find((b) => b.id === currentBranchId)?.name || "Chi nhánh"} • {new Date().toLocaleDateString("vi-VN")}
                  </span>
                </div>
                {lastSavedTime && (
                  <p className="text-[11px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                    <span>✓ Đã tự động lưu nháp lúc {lastSavedTime}</span>
                  </p>
                )}
              </div>
            </div>

            {/* Top Right Header Controls: Supplier & Close */}
            <div className="flex items-center gap-3">
              {/* Supplier Selector */}
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
                !selectedSupplier
                  ? "bg-amber-500/10 border-amber-500/80 ring-2 ring-amber-500/30"
                  : "bg-slate-800/80 border-slate-700"
              }`}>
                <span className="text-xs font-bold whitespace-nowrap flex items-center gap-1 text-slate-300">
                  {!selectedSupplier && <span className="animate-pulse text-amber-400">⚠️</span>}
                  Nhà cung cấp <span className="text-red-400 font-bold">*</span>:
                </span>
                <select
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className={`text-xs font-semibold px-2.5 py-1 rounded-lg border outline-none max-w-[220px] transition-colors ${
                    !selectedSupplier
                      ? "bg-slate-900 border-amber-500/80 text-amber-300 font-bold"
                      : "bg-slate-900 text-white border-slate-700"
                  }`}
                >
                  <option value="">-- BẮT BUỘC CHỌN NCC --</option>
                  {currentBranchSuppliers.length > 0 && (
                    <optgroup label={`📍 Chi nhánh ${currentBranchName}`}>
                      {currentBranchSuppliers.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.phone ? `• ${s.phone}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {otherSuppliers.length > 0 && (
                    <optgroup label={currentBranchSuppliers.length > 0 ? "🌐 Nhà cung cấp chung / Chi nhánh khác" : "Danh sách nhà cung cấp"}>
                      {otherSuppliers.map((s: any) => (
                        <option key={s.id} value={s.id}>
                          {s.name} {s.phone ? `• ${s.phone}` : ""}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  type="button"
                  onClick={() => setShowSupplierModal(true)}
                  className="text-xs px-2 py-1 bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 rounded-lg border border-emerald-500/30 font-semibold transition"
                >
                  + Thêm
                </button>
              </div>

              {/* Close Button */}
              <button
                onClick={handleCancelReceipt}
                className="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition"
                title="Đóng phiếu (Esc)"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Main Content Body */}
          <div className="flex-1 flex overflow-hidden">
            {/* Left Panel - Product Browser (36%) */}
            <div className="w-[36%] flex flex-col bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800">
              {/* Search Bar & Quick Tools */}
              <div className="p-3 border-b border-slate-200 dark:border-slate-800 space-y-2">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Tìm tên, SKU, mã vạch... (Enter để chọn)"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-xl bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100 text-xs outline-none focus:border-blue-500"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCameraScanner(true)}
                    className="px-2.5 py-2 rounded-xl bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/20 font-bold text-xs"
                    title="Quét camera"
                  >
                    <Camera className="w-4 h-4" />
                  </button>
                </div>

                {canCreatePart && (
                  <button
                    onClick={() => setShowAddProductModal(true)}
                    className="w-full py-1.5 border border-dashed border-blue-400/50 hover:border-blue-500 text-blue-600 dark:text-blue-400 bg-blue-50/30 dark:bg-blue-500/10 rounded-xl font-bold text-xs flex items-center justify-center gap-1 transition"
                  >
                    <span>+ Tạo sản phẩm mới</span>
                  </button>
                )}
              </div>

              {/* Product List */}
              <div className="flex-1 overflow-y-auto p-2.5 space-y-1.5 custom-scrollbar bg-slate-900/50">
                {filteredParts.map((part) => {
                  const stock = part.stock?.[currentBranchId] ?? 0;
                  const isZeroStock = stock <= 0;
                  const retailPrice = part.retailPrice?.[currentBranchId] ?? 0;

                  return (
                    <div
                      key={part.id}
                      onClick={() => addToReceipt(part)}
                      className="p-2.5 rounded-xl border border-slate-700/80 bg-slate-800/90 hover:bg-slate-800 hover:border-blue-500 cursor-pointer transition flex items-center justify-between group shadow-sm"
                    >
                      <div className="min-w-0 flex-1 pr-2">
                        <div className="font-bold text-xs text-slate-100 break-words whitespace-normal leading-tight group-hover:text-blue-400">
                          {part.name}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="font-mono text-[10px] text-blue-400 bg-blue-500/20 px-1.5 py-0.5 rounded border border-blue-500/30">
                            {part.sku}
                          </span>
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isZeroStock ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-slate-900 text-slate-200 border border-slate-700'}`}>
                            {isZeroStock ? 'Tồn: 0 ⚠️' : `Tồn: ${stock}`}
                          </span>
                          <span className="text-[10px] text-emerald-400 font-semibold ml-auto">
                            Bán: {formatCurrency(retailPrice)}
                          </span>
                        </div>
                      </div>
                      <button
                        type="button"
                        className="w-7 h-7 rounded-lg bg-blue-500/20 group-hover:bg-blue-600 text-blue-400 group-hover:text-white flex items-center justify-center font-bold text-xs transition shrink-0"
                      >
                        +
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Panel - Cart & Calculation (64%) */}
            <div className="w-[64%] flex flex-col bg-slate-50 dark:bg-slate-900">
              {/* Cart Header */}
              <div className="px-4 py-2.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white dark:bg-slate-900">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100">
                    GIỎ HÀNG NHẬP
                  </h3>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-500 border border-blue-500/20">
                    {receiptItems.length} SP • {totalQuantity} cái
                  </span>
                </div>
              </div>

              {/* Data Table Area */}
              <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
                {receiptItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                    <div className="w-16 h-16 rounded-2xl bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-3 text-2xl">
                      📦
                    </div>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Giỏ hàng nhập kho đang trống</p>
                    <p className="text-[11px] text-slate-400 mt-1">Chọn sản phẩm bên danh sách trái hoặc dùng máy quét barcode</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold uppercase text-[10px] border-b border-slate-200 dark:border-slate-700">
                          <th className="py-2 px-2 text-center w-7">#</th>
                          <th className="py-2 px-2 min-w-[140px]">Sản phẩm & SKU</th>
                          <th className="py-2 px-2 text-center w-24">Số lượng</th>
                          <th className="py-2 px-2 text-right min-w-[105px] text-orange-500">Giá nhập (đ)</th>
                          <th className="py-2 px-2 text-right min-w-[105px] text-emerald-500">Giá bán (đ)</th>
                          <th className="py-2 px-2 text-right min-w-[105px] text-blue-500">Thành tiền</th>
                          <th className="py-2 px-2 text-center w-7"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
                        {receiptItems.map((item, index) => {
                          return (
                            <React.Fragment key={item.partId}>
                              <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                                <td className="py-2 px-2 text-center font-bold text-slate-400">{index + 1}</td>
                                <td className="py-2 px-2">
                                  <div className="font-bold text-slate-800 dark:text-slate-100 text-xs break-words whitespace-normal leading-tight max-w-[220px]">
                                    {item.partName}
                                  </div>
                                  <span className="font-mono text-[10px] text-blue-500">{item.sku}</span>
                                </td>
                                <td className="py-2 px-2">
                                  <div className="flex items-center justify-center gap-0.5">
                                    <button
                                      type="button"
                                      onClick={() => updateReceiptItem(item.partId, "quantity", Math.max(1, item.quantity - 1))}
                                      className="w-6 h-6 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded font-bold text-xs"
                                    >
                                      -
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => updateReceiptItem(item.partId, "quantity", Math.max(1, parseInt(e.target.value) || 1))}
                                      className="w-8 h-6 text-center border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-xs font-bold"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => updateReceiptItem(item.partId, "quantity", item.quantity + 1)}
                                      className="w-6 h-6 flex items-center justify-center bg-slate-200 dark:bg-slate-800 rounded font-bold text-xs"
                                    >
                                      +
                                    </button>
                                  </div>
                                </td>
                                <td className="py-2 px-2">
                                  <FormattedNumberInput
                                    value={item.importPrice}
                                    onValue={(val) => {
                                      const newImport = Math.max(0, Math.round(val));
                                      setReceiptItems((items) =>
                                        items.map((it) => {
                                          if (it.partId !== item.partId) return it;
                                          if (it.sellingPrice > 0) {
                                            const newMarkup = calcMarkupPercent(newImport, it.sellingPrice);
                                            return { ...it, importPrice: newImport, markupPercent: newMarkup };
                                          } else {
                                            const autoPrice = calcSellingFromRule(
                                              newImport,
                                              Number(it.markupPercent || DEFAULT_MARKUP_PERCENT),
                                              it.roundingRule || "integer"
                                            );
                                            return { ...it, importPrice: newImport, sellingPrice: autoPrice };
                                          }
                                        })
                                      );
                                    }}
                                    className="w-full px-1.5 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-orange-600 dark:text-orange-400 text-right text-xs font-bold"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="py-2 px-2">
                                  <FormattedNumberInput
                                    value={item.sellingPrice}
                                    onValue={(val) => {
                                      const sellingPrice = Math.max(0, Math.round(val));
                                      const markupPercent = calcMarkupPercent(Number(item.importPrice || 0), sellingPrice);
                                      setReceiptItems((items) =>
                                        items.map((it) =>
                                          it.partId === item.partId ? { ...it, sellingPrice, markupPercent } : it
                                        )
                                      );
                                    }}
                                    className="w-full px-1.5 py-1 border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-950 text-emerald-600 dark:text-emerald-400 text-right text-xs font-bold"
                                    placeholder="0"
                                  />
                                </td>
                                <td className="py-2 px-2 text-right font-black text-blue-600 dark:text-blue-400 text-xs">
                                  {formatCurrency(item.importPrice * item.quantity)}
                                </td>
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => removeReceiptItem(item.partId)}
                                    className="text-slate-400 hover:text-red-500 p-1"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>

                              {/* Phone Branch Sub-row for N IMEIs & Color */}
                              {hideLaborCost && (
                                <tr className="bg-slate-100/50 dark:bg-slate-950/60">
                                  <td colSpan={7} className="py-2 px-3 border-b border-slate-200 dark:border-slate-800">
                                    <div className="space-y-1.5">
                                      <div className="flex items-center justify-between">
                                        <span className="text-[11px] font-bold text-blue-500 flex items-center gap-1">
                                          <Smartphone className="w-3.5 h-3.5" />
                                          <span>Danh sách IMEI & Màu sắc ({item.quantity} máy):</span>
                                        </span>
                                        <div className="flex items-center gap-1 text-[11px]">
                                          <span className="font-bold text-purple-500 flex items-center gap-1 whitespace-nowrap">
                                            <Palette className="w-3 h-3" />
                                            <span>Màu chung:</span>
                                          </span>
                                          <input
                                            type="text"
                                            value={item.color || ""}
                                            onChange={(e) => {
                                              const globalColor = e.target.value;
                                              const newColors = Array(item.quantity).fill(globalColor);
                                              setReceiptItems((items) =>
                                                items.map((it) =>
                                                  it.partId === item.partId
                                                    ? { ...it, color: globalColor, colors: newColors }
                                                    : it
                                                )
                                              );
                                            }}
                                            placeholder="Gán màu cho tất cả..."
                                            className="w-32 px-2 py-0.5 text-xs border border-purple-300 dark:border-purple-800 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 outline-none focus:ring-1 focus:ring-purple-500"
                                            title="Nhập màu ở đây để áp dụng màu này cho toàn bộ máy bên dưới"
                                          />
                                        </div>
                                      </div>

                                      <div className="flex flex-wrap items-center gap-2">
                                        {Array.from({ length: item.quantity }).map((_, imeiIndex) => {
                                          const currentImeis = item.imeis || (item.imei ? [item.imei] : []);
                                          const imeiVal = currentImeis[imeiIndex] || "";
                                          const isConflict = conflictImeis.has(imeiVal.trim().toUpperCase());

                                          const currentColors = item.colors || (item.color ? Array(item.quantity).fill(item.color) : []);
                                          const colorVal = currentColors[imeiIndex] || "";

                                          return (
                                            <div
                                              key={imeiIndex}
                                              className="flex items-center gap-1.5 bg-white dark:bg-slate-900 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm"
                                            >
                                              <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 font-mono shrink-0">
                                                #{imeiIndex + 1}:
                                              </span>
                                              <input
                                                type="text"
                                                value={imeiVal}
                                                onChange={(e) => {
                                                  const newImeis = [...currentImeis];
                                                  newImeis[imeiIndex] = e.target.value;
                                                  setReceiptItems((items) =>
                                                    items.map((it) =>
                                                      it.partId === item.partId
                                                        ? { ...it, imeis: newImeis, imei: newImeis[0] || "" }
                                                        : it
                                                    )
                                                  );
                                                }}
                                                placeholder={`IMEI ${imeiIndex + 1}...`}
                                                title={isConflict ? "IMEI này đã tồn tại trong hệ thống" : undefined}
                                                className={`w-28 px-2 py-0.5 text-xs font-mono border rounded bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 outline-none ${
                                                  isConflict
                                                    ? "border-red-500 ring-1 ring-red-500/40"
                                                    : "border-slate-300 dark:border-slate-700"
                                                }`}
                                              />
                                              <div className="flex items-center gap-1">
                                                <Palette className="w-3 h-3 text-purple-400 shrink-0" />
                                                <input
                                                  type="text"
                                                  value={colorVal}
                                                  onChange={(e) => {
                                                    const newColors = [...currentColors];
                                                    newColors[imeiIndex] = e.target.value;
                                                    setReceiptItems((items) =>
                                                      items.map((it) =>
                                                        it.partId === item.partId
                                                          ? { ...it, colors: newColors, color: newColors[0] || e.target.value }
                                                          : it
                                                      )
                                                    );
                                                  }}
                                                  placeholder="Màu sắc..."
                                                  className="w-20 px-1.5 py-0.5 text-xs border border-purple-200 dark:border-purple-900/50 rounded bg-purple-50/50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 outline-none focus:border-purple-500"
                                                />
                                              </div>
                                            </div>
                                          );
                                        })}
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Bottom Calculation & Checkout Section */}
              <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-2.5">
                {/* Summary Calculations */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div className="flex items-center justify-between text-slate-600 dark:text-slate-400">
                    <span>Tạm tính:</span>
                    <span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Chiết khấu:</span>
                    <div className="flex items-center gap-1">
                      {discountType === "amount" ? (
                        <FormattedNumberInput
                          value={discount}
                          onValue={(v) => setDiscount(Math.max(0, Math.round(v)))}
                          className="w-24 px-2 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-right text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          placeholder="0"
                        />
                      ) : (
                        <FormattedNumberInput
                          value={discountPercent}
                          onValue={(v) => setDiscountPercent(Math.max(0, Math.min(100, Math.round(v))))}
                          className="w-16 px-2 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-right text-xs font-bold bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-slate-100"
                          placeholder="%"
                        />
                      )}
                      <button
                        type="button"
                        onClick={() => setDiscountType(discountType === "amount" ? "percent" : "amount")}
                        className="px-1.5 py-0.5 border border-slate-300 dark:border-slate-700 rounded text-xs font-bold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
                      >
                        {discountType === "amount" ? "₫" : "%"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Total Amount & Estimated Profit Banner */}
                <div className="p-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between shadow-md">
                  <div>
                    <div className="text-[10px] uppercase font-extrabold tracking-wider opacity-80">
                      TỔNG THANH TOÁN
                    </div>
                    <div className="text-xl font-black">{formatCurrency(totalAmount)}</div>
                  </div>
                  {subtotal > 0 && (
                    <div className="text-right">
                      <div className="text-[10px] opacity-80 uppercase font-bold">Lãi dự kiến</div>
                      <div className="text-sm font-black text-emerald-300">+{estimatedProfitRate}%</div>
                    </div>
                  )}
                </div>

                {/* Payment Method & Type Controls */}
                <div className="grid grid-cols-2 gap-2">
                  {/* Payment Method */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("cash")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${paymentMethod === "cash" ? "bg-emerald-600 text-white border-emerald-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}
                    >
                      💵 Tiền mặt
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod("bank")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${paymentMethod === "bank" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}
                    >
                      🏦 CK
                    </button>
                  </div>

                  {/* Payment Type */}
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => { setPaymentType("full"); setPartialAmount(0); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${paymentType === "full" ? "bg-blue-600 text-white border-blue-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}
                    >
                      Đủ
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType("partial")}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${paymentType === "partial" ? "bg-orange-600 text-white border-orange-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}
                    >
                      1 phần
                    </button>
                    <button
                      type="button"
                      onClick={() => { setPaymentType("note"); setPartialAmount(0); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${paymentType === "note" ? "bg-purple-600 text-white border-purple-600" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700"}`}
                    >
                      Công nợ
                    </button>
                  </div>
                </div>

                {/* Partial Amount Input */}
                {paymentType === "partial" && (
                  <div className="flex items-center justify-between bg-orange-50 dark:bg-orange-950/20 p-2 rounded-lg border border-orange-200 dark:border-orange-900/40">
                    <span className="text-xs font-bold text-orange-700 dark:text-orange-400">Số tiền trả:</span>
                    <FormattedNumberInput
                      value={partialAmount}
                      onValue={(v) => setPartialAmount(Math.max(0, Math.round(v)))}
                      className="w-32 px-2 py-1 text-right text-xs font-bold border border-orange-300 dark:border-orange-700 rounded bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100"
                      placeholder="Nhập..."
                    />
                  </div>
                )}

                {/* Footer Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelReceipt}
                    className="flex-1 py-2 px-3 bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-xl font-bold text-xs transition"
                  >
                    🗑️ Hủy phiếu
                  </button>
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex-1 py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-xl font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                  >
                    <span>✓ NHẬP KHO (F9)</span>
                  </button>
                </div>
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

      {/* Supplier Modal */}
      {showSupplierModal && (
        <SupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          currentBranchId={currentBranchId}
          onSave={(supplier) => {
            if (supplier?.id) {
              setSelectedSupplier(supplier.id);
            }
            setShowSupplierModal(false);
          }}
          mode="add"
        />
      )}
    </>
  );
};

export default GoodsReceiptModal;
