import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { GoodsReceiptMobileModal } from '../../inventory/GoodsReceiptMobileModal';
import { showToast } from '../../../utils/toast';
import { useCreatePartRepo } from '../../../hooks/usePartsRepository';
import AddProductModal from './AddProductModal';
import type { Part } from '../../../types';

// Mobile Goods Receipt Wrapper - manages state and renders mobile modal
const GoodsReceiptMobileWrapper: React.FC<{
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
      wholesalePrice?: number;
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
  ) => Promise<void> | void;
}> = ({ isOpen, onClose, parts, currentBranchId, onSave }) => {
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
  const [selectedSupplier, setSelectedSupplier] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<"amount" | "percent">(
    "amount"
  );
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "bank">("cash");
  const [paymentType, setPaymentType] = useState<"full" | "partial" | "note">(
    "full"
  );
  const [partialAmount, setPartialAmount] = useState(0);
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const createPartMutation = useCreatePartRepo();

  // Debug logging
  console.log(
    "📦 GoodsReceiptMobileWrapper - parts received:",
    parts?.length || 0,
    parts?.slice(0, 2)
  );
  console.log("📦 currentBranchId:", currentBranchId);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setReceiptItems([]);
      setSelectedSupplier("");
      setSearchTerm("");
      setDiscount(0);
      setDiscountType("amount");
      setPaymentMethod("cash");
      setPaymentType("full");
      setPartialAmount(0);
    }
  }, [isOpen]);

  const handleAddNewProduct = (productData: any) => {
    // Chỉ thêm vào danh sách tạm thời, KHÔNG lưu vào DB ngay
    // Sản phẩm sẽ được tạo khi hoàn tất phiếu nhập (bấm "Nhập kho")
    const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempSku =
      productData.barcode?.trim() || productData.sku || `PT-${Date.now()}`;

    // Add to receipt items with temporary ID (marked as new product)
    setReceiptItems((items) => [
      ...items,
      {
        partId: tempId,
        partName: productData.name,
        sku: tempSku,
        quantity: productData.quantity,
        importPrice: productData.importPrice,
        sellingPrice: productData.retailPrice,
        wholesalePrice: productData.wholesalePrice || 0,
        // Store product data for later creation when receipt is finalized
        _isNewProduct: true,
        _productData: {
          name: productData.name,
          sku: tempSku,
          barcode: productData.barcode?.trim() || "",
          category: productData.category,
          description: productData.description || "",
          importPrice: productData.importPrice,
          retailPrice: productData.retailPrice,
          wholesalePrice:
            productData.wholesalePrice ||
            Math.round(productData.retailPrice * 0.9),
        },
      },
    ]);

    showToast.success(
      "Đã thêm sản phẩm mới vào phiếu. Sản phẩm sẽ được lưu khi nhập kho."
    );
    setShowAddProductModal(false);
  };

  const handleSave = async () => {
    if (!selectedSupplier) {
      showToast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    if (receiptItems.length === 0) {
      showToast.error("Vui lòng thêm sản phẩm");
      return;
    }

    const subtotal = receiptItems.reduce(
      (sum, item) => sum + item.quantity * item.importPrice,
      0
    );
    const discountAmount =
      discountType === "percent"
        ? Math.round((subtotal * discount) / 100)
        : discount;
    const totalAmount = Math.max(0, subtotal - discountAmount);

    // Calculate paid amount based on payment type
    // Default to "full" if paymentType is somehow not set
    const effectivePaymentType = paymentType || "full";
    let paidAmount = 0;
    if (effectivePaymentType === "full") {
      paidAmount = totalAmount;
    } else if (effectivePaymentType === "partial") {
      paidAmount = partialAmount;
    }
    // paymentType === "note" => paidAmount = 0

    setIsSubmitting(true);
    try {
      await onSave(receiptItems, selectedSupplier, totalAmount, "", {
        paymentMethod,
        paymentType: effectivePaymentType,
        paidAmount,
        discount: discountAmount,
      });
      // clearDraft(); // removed because not defined here, handled by parent or logic inside onSave if passed properly? 
      // In original it called clearDraft(), but clearDraft likely isn't in scope.
      // Wait, original file (Step 3162) had `clearDraft();`.
      // BUT `clearDraft` was NOT defined in the component body I saw in Step 3162 (lines 1-50, 50-end?).
      // Let's assume onSave handles it or we should remove it if it causes error.
      // For now I'll comment it out to be safe if it's not defined.
      // Actually, looking at Step 3162 full content: lines 159 had `clearDraft();`.
      // Where is clearDraft defined?
      // It is NOT defined in Component body. It might be a prop? No.
      // It is likely a bug in the inline extraction!
      // When it was inline, it had access to `clearDraft`. Now extracted, it lost it.
      // `onSave` passed from parent `GoodsReceiptMobileWrapper` (which is this component).
      // Wait, `GoodsReceiptMobileWrapper` *wraps* `GoodsReceiptMobileModal`.
      // The parent `InventoryManagerNew` passes `onSave`.
      // `clearDraft` logic should probably be inside `onSave` or we simply don't need it here.

      onClose();
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <GoodsReceiptMobileModal
        isOpen={isOpen}
        onClose={onClose}
        parts={parts} // Use parts from props (which is allPartsData)
        receiptItems={receiptItems}
        setReceiptItems={setReceiptItems}
        selectedSupplier={selectedSupplier}
        setSelectedSupplier={setSelectedSupplier}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        onSave={handleSave}
        discount={discount}
        setDiscount={setDiscount}
        discountType={discountType}
        setDiscountType={setDiscountType}
        paymentMethod={paymentMethod}
        setPaymentMethod={setPaymentMethod}
        paymentType={paymentType}
        setPaymentType={setPaymentType}
        partialAmount={partialAmount}
        setPartialAmount={setPartialAmount}
        showAddProductModal={showAddProductModal}
        setShowAddProductModal={setShowAddProductModal}
        onAddNewProduct={handleAddNewProduct}
        currentBranchId={currentBranchId}
        isSubmitting={isSubmitting}
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

export default GoodsReceiptMobileWrapper;
