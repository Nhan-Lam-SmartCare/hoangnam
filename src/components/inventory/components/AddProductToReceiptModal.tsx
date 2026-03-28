import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../../supabaseClient";
import { showToast } from "../../../utils/toast";
import { formatCurrency } from "../../../utils/format";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import type { Part } from "../../../types";

// Add Product to Receipt Modal Component
const AddProductToReceiptModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    onAdd: (product: {
        partId: string;
        partName: string;
        sku: string;
        quantity: number;
        unitPrice: number;
    }) => void;
    currentBranchId: string;
}> = ({ isOpen, onClose, onAdd, currentBranchId }) => {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedProduct, setSelectedProduct] = useState<Part | null>(null);
    const [quantity, setQuantity] = useState(1);
    const [unitPrice, setUnitPrice] = useState(0);

    const { data: allParts = [] } = useQuery<Part[]>({
        queryKey: ["allPartsForReceipt"],
        queryFn: async () => {
            const { data, error } = await supabase
                .from("parts")
                .select("*")
                .order("name");
            if (error) throw error;
            return data || [];
        },
    });

    const filteredParts = useMemo(() => {
        if (!searchTerm) return [];
        const q = searchTerm.toLowerCase();
        return allParts.filter(
            (p) =>
                p.name.toLowerCase().includes(q) ||
                p.sku?.toLowerCase().includes(q) ||
                p.description?.toLowerCase().includes(q)
        );
    }, [allParts, searchTerm]);

    const handleSelectProduct = (part: Part) => {
        setSelectedProduct(part);
        setUnitPrice(part.costPrice?.[currentBranchId] || 0);
        setSearchTerm(part.name);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedProduct) {
            showToast.error("Vui lòng chọn sản phẩm");
            return;
        }
        if (quantity <= 0) {
            showToast.error("Số lượng phải lớn hơn 0");
            return;
        }
        if (unitPrice < 0) {
            showToast.error("Đơn giá không được âm");
            return;
        }

        onAdd({
            partId: selectedProduct.id,
            partName: selectedProduct.name,
            sku: selectedProduct.sku || "",
            quantity,
            unitPrice,
        });

        // Reset form
        setSearchTerm("");
        setSelectedProduct(null);
        setQuantity(1);
        setUnitPrice(0);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-lg">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            Thêm sản phẩm vào phiếu
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
                        >
                            ×
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-4">
                        {/* Product Search */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Tìm kiếm sản phẩm *
                            </label>
                            <div className="relative">
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setSelectedProduct(null);
                                    }}
                                    placeholder="Nhập tên hoặc SKU sản phẩm..."
                                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                    autoFocus
                                />
                                {searchTerm && !selectedProduct && filteredParts.length > 0 && (
                                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                                        {filteredParts.map((part) => (
                                            <button
                                                key={part.id}
                                                type="button"
                                                onClick={() => handleSelectProduct(part)}
                                                className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700 last:border-0"
                                            >
                                                <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                                                    {part.name}
                                                </div>
                                                <div className="text-xs text-slate-500">
                                                    SKU: {part.sku || "N/A"} | Giá nhập:{" "}
                                                    {formatCurrency(
                                                        part.costPrice?.[currentBranchId] || 0
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                            {selectedProduct && (
                                <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded text-sm text-green-800 dark:text-green-200">
                                    ✓ Đã chọn: {selectedProduct.name} ({selectedProduct.sku})
                                </div>
                            )}
                        </div>

                        {/* Quantity */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Số lượng *
                            </label>
                            <input
                                type="number"
                                value={quantity}
                                onChange={(e) => setQuantity(Number(e.target.value))}
                                min="1"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                required
                            />
                        </div>

                        {/* Unit Price */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Đơn giá nhập *
                            </label>
                            <FormattedNumberInput
                                value={unitPrice}
                                onValue={setUnitPrice}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                                placeholder="0"
                            />
                        </div>

                        {/* Total */}
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Thành tiền
                            </label>
                            <input
                                type="text"
                                value={formatCurrency(quantity * unitPrice)}
                                readOnly
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-slate-100 font-bold"
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium"
                        >
                            Thêm sản phẩm
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default AddProductToReceiptModal;
