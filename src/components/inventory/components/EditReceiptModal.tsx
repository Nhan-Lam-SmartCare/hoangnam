import React, { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Search, Trash2 } from "lucide-react";


import { useSuppliers } from "../../../hooks/useSuppliers";
import { supabase } from "../../../supabaseClient";
import { showToast } from "../../../utils/toast";
import { formatCurrency } from "../../../utils/format";
import FormattedNumberInput from "../../common/FormattedNumberInput";
import type { Part, InventoryTransaction } from "../../../types";
import SupplierModal from "./SupplierModal";
import AddProductToReceiptModal from "./AddProductToReceiptModal";

const EditReceiptModal: React.FC<{
  receipt: {
    receiptCode: string;
    date: Date;
    supplier: string;
    items: InventoryTransaction[];
    total: number;
  };
  onClose: () => void;
  onSave: (data: any) => void;
  currentBranchId: string;
}> = ({ receipt, onClose, onSave, currentBranchId }) => {
  const [supplier, setSupplier] = useState(receipt.supplier);
  const [supplierPhone, setSupplierPhone] = useState("");
  const [supplierSearchTerm, setSupplierSearchTerm] = useState(
    receipt.supplier
  );
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierModalMode, setSupplierModalMode] = useState<"add" | "edit">(
    "add"
  );
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [editingItemIndex, setEditingItemIndex] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch suppliers from database
  const { data: allSuppliers = [] } = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("*")
        .order("name");
      if (error) throw error;
      return data || [];
    },
  });

  const filteredSuppliers = useMemo(() => {
    if (!supplierSearchTerm) return allSuppliers;
    const q = supplierSearchTerm.toLowerCase();
    return allSuppliers.filter((s: any) => s.name.toLowerCase().includes(q));
  }, [allSuppliers, supplierSearchTerm]);

  const [items, setItems] = useState(
    receipt.items.map((item) => ({
      id: item.id,
      partName: item.partName,
      quantity: item.quantity,
      unitPrice: item.unitPrice || 0,
      totalPrice: item.quantity * (item.unitPrice || 0),
      notes: item.notes || "",
      sku: (item as any).sku || "", // Assuming sku might be in item or we need to fetch it
    }))
  );

  const [payments, setPayments] = useState(() => {
    // Extract payer from notes if available
    let payerName = "Nhân viên";
    const firstItem = receipt.items[0];
    if (firstItem?.notes?.includes("NV:")) {
      const extracted = firstItem.notes.split("NV:")[1]?.split("NCC:")[0]?.trim();
      if (extracted) payerName = extracted;
    }

    const receiptDate = new Date(receipt.date);
    const timeStr = receiptDate.toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
    });

    return [
      {
        time: timeStr,
        date: receipt.date,
        payer: payerName,
        cashier: "(Tiền mặt)", // Default, will update if bank
        amount: receipt.total,
      },
    ];
  });
  const [isPaid, setIsPaid] = useState(true);

  // Fetch true payment method from cash_transactions
  useEffect(() => {
    const fetchPaymentInfo = async () => {
      try {
        // Find the transaction related to this receipt
        const { data } = await supabase
          .from("cash_transactions")
          .select("paymentsource") // Note: lowercase in DB
          .ilike("description", `%${receipt.receiptCode}%`)
          .maybeSingle();

        if (data && (data.paymentsource === "bank" || data.paymentsource === "transfer")) {
          setPayments(prev => prev.map(p => ({ ...p, cashier: "(Chuyển khoản)" })));
        } else if (!data) {
          // No transaction found -> Unpaid
          // Clear the "fake" payment that was initialized
          setPayments([]);
          setIsPaid(false);
        } else {
          // Transaction exists but is cash (or other)
          // Ensure it says Cash
          setPayments(prev => prev.map(p => ({ ...p, cashier: "(Tiền mặt)" })));
        }
      } catch (err) {
        console.error("Error fetching payment info:", err);
      }
    };

    fetchPaymentInfo();
  }, [receipt.receiptCode]);



  React.useEffect(() => {
    const firstItem = receipt.items[0];
    if (firstItem?.notes?.includes("Phone:")) {
      const phone = firstItem.notes.split("Phone:")[1]?.split("NV:")[0]?.trim();
      if (phone) setSupplierPhone(phone);
    }
  }, [receipt.items]);

  // Close dropdown when clicking outside
  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".supplier-dropdown-container")) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const totalAmount = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amount, 0);

  const updateItemQuantity = (index: number, quantity: number) => {
    const newItems = [...items];
    newItems[index].quantity = quantity;
    newItems[index].totalPrice = quantity * newItems[index].unitPrice;
    setItems(newItems);
  };

  const updateItemPrice = (index: number, unitPrice: number) => {
    const newItems = [...items];
    newItems[index].unitPrice = unitPrice;
    newItems[index].totalPrice = newItems[index].quantity * unitPrice;
    setItems(newItems);
  };

  const removeItem = (index: number) => {
    if (items.length === 1) {
      showToast.error("Phải có ít nhất 1 sản phẩm");
      return;
    }
    const newItems = items.filter((_, i) => i !== index);
    setItems(newItems);
    showToast.success("Đã xóa sản phẩm");
  };

  const handleAddProduct = (product: {
    partId: string;
    partName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
  }) => {
    const newItem = {
      id: `new-${Date.now()}`, // Temporary ID for new items
      partId: product.partId,
      partName: product.partName,
      quantity: product.quantity,
      unitPrice: product.unitPrice,
      totalPrice: product.quantity * product.unitPrice,
      notes: "",
      sku: product.sku,
    };
    setItems([...items, newItem]);
    setShowAddProductModal(false);
    showToast.success(`Đã thêm ${product.partName} (sẽ lưu khi bấm LƯU)`);
  };

  const handleSaveSupplier = (supplierData: {
    name: string;
    phone: string;
    address: string;
    email: string;
  }) => {
    setSupplier(supplierData.name);
    setSupplierPhone(supplierData.phone);
    setShowSupplierModal(false);
    showToast.success(
      supplierModalMode === "add"
        ? "Đã thêm nhà cung cấp"
        : "Đã cập nhật nhà cung cấp"
    );
  };

  const handleEditSupplier = () => {
    setSupplierModalMode("edit");
    setShowSupplierModal(true);
  };

  const handleAddSupplier = () => {
    setSupplierModalMode("add");
    setShowSupplierModal(true);
  };

  const handleEditItem = (index: number) => {
    setEditingItemIndex(index);
    showToast.info("Nhấn vào ô số lượng hoặc đơn giá để chỉnh sửa");
  };

  const handleItemMenu = (index: number) => {
    if (confirm("Bạn có muốn xóa sản phẩm này?")) {
      removeItem(index);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplier) {
      showToast.error("Vui lòng chọn nhà cung cấp");
      return;
    }
    if (items.some((item) => item.quantity <= 0)) {
      showToast.error("Số lượng phải lớn hơn 0");
      return;
    }

    setIsSubmitting(true);
    try {
      await onSave({ supplier, supplierPhone, items, payments, isPaid });
    } catch (error) {
      console.error("Error saving receipt:", error);
      // onSave usually handles the toast, but we ensure loading state is reset
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <form onSubmit={handleSubmit}>
          {/* Mobile Header V2 */}
          <div className="sm:hidden sticky top-0 bg-slate-50 dark:bg-slate-900 z-20 px-4 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-start">
            <div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">
                Chỉnh sửa phiếu
              </h3>
              <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-300 font-medium">
                  {receipt.receiptCode}
                </span>
                <span>•</span>
                <span>{new Date(receipt.date).toLocaleDateString("vi-VN")}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 bg-white dark:bg-slate-800 rounded-full shadow-sm text-slate-400 hover:text-slate-600 border border-slate-100 dark:border-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Desktop Header */}
          <div className="hidden sm:flex sticky top-0 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 p-4 justify-between items-center z-10">
            <div>
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  />
                </svg>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                  [Chỉnh sửa] Phiếu Nhập Kho {receipt.receiptCode}
                </h3>
              </div>
              <div className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                {new Date(receipt.date).toLocaleDateString("vi-VN", {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
                })}{" "}
                {new Date(receipt.date).toLocaleTimeString("vi-VN", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl w-8 h-8 flex items-center justify-center rounded hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ✕
            </button>
          </div>

          {/* Body */}
          <div className="p-4 sm:p-6 space-y-6 bg-slate-50 dark:bg-slate-900 sm:bg-white sm:dark:bg-slate-800 min-h-[calc(100vh-140px)] sm:min-h-0">

            {/* Mobile Supplier V3 - With Accent */}
            <div className="sm:hidden">
              <div className="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-md border-l-4 border-l-blue-500">
                <div className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/30">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <div>
                      <div className="text-xs text-slate-400 uppercase tracking-wider font-medium">Nhà cung cấp</div>
                      <div className="text-base font-bold text-slate-900 dark:text-slate-100 mt-0.5">
                        {supplier || "Chưa chọn"}
                      </div>
                      {supplierPhone && <div className="text-xs text-slate-400 mt-0.5">{supplierPhone}</div>}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSupplierModalMode("edit");
                      setShowSupplierModal(true);
                    }}
                    className="w-9 h-9 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Desktop Supplier Section */}
            <div className="hidden sm:block">
              <label className="block text-base font-medium text-teal-600 dark:text-teal-400 mb-2">
                Nhà cung cấp:
              </label>
              <div className="flex gap-2">
                <div className="flex-1 relative supplier-dropdown-container">
                  <input
                    type="text"
                    value={supplierSearchTerm}
                    onChange={(e) => {
                      setSupplierSearchTerm(e.target.value);
                      setShowSupplierDropdown(true);
                    }}
                    onFocus={() => setShowSupplierDropdown(true)}
                    placeholder="Tìm kiếm và chọn một nhà cung cấp"
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100"
                  />
                  {supplierSearchTerm && (
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierSearchTerm("");
                        setSupplier("");
                        setSupplierPhone("");
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      ✕
                    </button>
                  )}
                  {/* Supplier Dropdown */}
                  {showSupplierDropdown && filteredSuppliers.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                      {filteredSuppliers.map((sup: any) => (
                        <button
                          key={sup.id}
                          type="button"
                          onClick={() => {
                            setSupplier(sup.name);
                            setSupplierSearchTerm(sup.name);
                            setSupplierPhone(sup.phone || "");
                            setShowSupplierDropdown(false);
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-slate-100 dark:hover:bg-slate-700 border-b border-slate-200 dark:border-slate-700 last:border-0"
                        >
                          <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
                            {sup.name}
                          </div>
                          {sup.phone && (
                            <div className="text-xs text-slate-500">
                              Phone: {sup.phone}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={handleEditSupplier}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center gap-2"
                >
                  <svg
                    className="w-5 h-5 text-blue-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  Chỉnh sửa
                </button>
                <button
                  type="button"
                  onClick={handleAddSupplier}
                  className="px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg flex items-center gap-2"
                >
                  <span className="text-xl">+</span>
                  Thêm mới
                </button>
              </div>
            </div>

            {/* Products Section */}
            <div>
              {/* Mobile Header V3 */}
              <div className="sm:hidden flex justify-between items-center mb-4">
                <div className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                  Sản phẩm ({items.length})
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium rounded-full shadow-md shadow-emerald-500/30 transition-all active:scale-95"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Thêm
                </button>
              </div>

              {/* Desktop Header */}
              <div className="hidden sm:flex justify-between items-center mb-2">
                <label className="block text-base font-medium text-teal-600 dark:text-teal-400">
                  Chi tiết sản phẩm nhập kho:
                </label>
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(true)}
                  className="text-sm text-teal-600 hover:text-teal-700 dark:text-teal-400 flex items-center gap-1"
                >
                  <span className="text-lg">+</span>
                  Thêm sản phẩm
                </button>
              </div>

              {/* Desktop Table View */}
              <div className="hidden sm:block border border-slate-300 dark:border-slate-600 rounded-lg overflow-hidden">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        -
                      </th>
                      <th className="px-3 py-2 text-left text-sm font-medium text-slate-700 dark:text-slate-300">
                        Tên
                      </th>
                      <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300">
                        SL
                      </th>
                      <th className="px-3 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                        Đơn giá nhập
                      </th>
                      <th className="px-3 py-2 text-right text-sm font-medium text-slate-700 dark:text-slate-300">
                        Thành tiền
                      </th>
                      <th className="px-3 py-2 text-center text-sm font-medium text-slate-700 dark:text-slate-300 w-20"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                    {items.map((item, index) => (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${editingItemIndex === index
                          ? "bg-blue-50 dark:bg-blue-900/20"
                          : ""
                          }`}
                      >
                        <td className="px-3 py-3 text-sm text-slate-900 dark:text-slate-100">
                          {index + 1}
                        </td>
                        <td className="px-3 py-3">
                          <div className="text-sm text-slate-900 dark:text-slate-100">
                            {item.partName}
                          </div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            {item.sku ? `SKU: ${item.sku}` : ""}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-center">
                          <input
                            type="number"
                            value={item.quantity}
                            onChange={(e) =>
                              updateItemQuantity(index, Number(e.target.value))
                            }
                            onFocus={() => setEditingItemIndex(index)}
                            onBlur={() => setEditingItemIndex(null)}
                            min="1"
                            className="w-16 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-center bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-right">
                          <FormattedNumberInput
                            value={item.unitPrice}
                            onValue={(val) => updateItemPrice(index, val)}
                            className="w-28 px-2 py-1 border border-slate-300 dark:border-slate-600 rounded text-right bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-medium text-slate-900 dark:text-slate-100">
                          {formatCurrency(item.totalPrice)}
                        </td>
                        <td className="px-3 py-3 text-center">
                          <div className="flex justify-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleEditItem(index)}
                              className="p-1 text-blue-400 hover:bg-blue-500/20 rounded"
                              title="Chỉnh sửa"
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
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleItemMenu(index)}
                              className="p-1 text-slate-400 hover:bg-slate-500/20 rounded"
                              title="Xóa sản phẩm"
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
                                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                                />
                              </svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-700">
                    <tr>
                      <td
                        colSpan={4}
                        className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100"
                      >
                        TỔNG:
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-slate-100">
                        {formatCurrency(totalAmount)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Mobile Card View V3 - Floating & Modern */}
              <div className="sm:hidden space-y-3">
                {items.map((item, index) => (
                  <div
                    key={item.id}
                    className="bg-white dark:bg-slate-800 rounded-2xl p-4 shadow-lg shadow-slate-200/50 dark:shadow-none"
                  >
                    {/* Header: Name & Delete */}
                    <div className="flex justify-between items-start gap-3 mb-3">
                      <div className="flex-1">
                        <div className="text-[15px] font-bold text-slate-800 dark:text-slate-100 leading-snug">
                          {item.partName}
                        </div>
                        {item.sku && (
                          <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-1 font-mono bg-slate-50 dark:bg-slate-900/50 px-1.5 py-0.5 rounded inline-block">
                            {item.sku}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleItemMenu(index)}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20 text-red-400 hover:text-red-600 hover:bg-red-100 transition-all"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Body: Inputs Grid */}
                    <div className="grid grid-cols-12 gap-3 items-end">
                      {/* Quantity */}
                      <div className="col-span-4">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 block">
                          Số lượng
                        </label>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) =>
                            updateItemQuantity(index, Number(e.target.value))
                          }
                          min="1"
                          className="w-full bg-slate-100 dark:bg-slate-900/50 border-2 border-transparent rounded-xl py-2.5 px-3 text-center font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                        />
                      </div>

                      {/* Price */}
                      <div className="col-span-8">
                        <label className="text-[10px] uppercase tracking-wider text-slate-400 font-bold mb-1.5 block">
                          Đơn giá
                        </label>
                        <FormattedNumberInput
                          value={item.unitPrice}
                          onValue={(val) => updateItemPrice(index, val)}
                          className="w-full bg-slate-100 dark:bg-slate-900/50 border-2 border-transparent rounded-xl py-2.5 px-3 text-right font-bold text-slate-800 dark:text-slate-100 focus:border-blue-500 focus:bg-white dark:focus:bg-slate-800 transition-all"
                        />
                      </div>
                    </div>

                    {/* Footer: Total Badge */}
                    <div className="mt-4 flex justify-end">
                      <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/30 dark:to-indigo-900/30 px-4 py-2 rounded-full">
                        <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">Thành tiền</span>
                        <span className="text-base font-black text-blue-600 dark:text-blue-400">
                          {formatCurrency(item.totalPrice)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Summary Card V3 - Gradient */}
                <div className="bg-gradient-to-br from-white to-slate-100 dark:from-slate-700 dark:to-slate-800 rounded-2xl p-5 shadow-xl border border-slate-200 dark:border-slate-600">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-widest font-bold mb-1">
                        Tổng cộng
                      </div>
                      <div className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                        {formatCurrency(totalAmount)}
                      </div>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-xs font-bold ${isPaid ? 'bg-emerald-500 text-white' : 'bg-amber-500 text-white'}`}>
                      {isPaid ? "✓ Đã thanh toán" : "Chưa thanh toán"}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Payment Section (Desktop Only or Simplified Mobile) */}
            <div className="hidden sm:block border border-slate-300 dark:border-slate-600 rounded-lg p-4">
              <label className="block text-base font-medium text-teal-600 dark:text-teal-400 mb-3">
                Công nợ:
              </label>

              {/* Total Payment */}
              <div className="flex items-center justify-between mb-3 p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <span className="text-lg font-bold text-red-600 dark:text-red-400">
                  TỔNG PHẢI CHI: {formatCurrency(totalAmount)}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
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
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    Đã thanh toán đủ
                  </span>

                </div>
              </div>

              {/* Payment Notice */}
              <div className="text-xs text-slate-500 dark:text-slate-400 mb-3 flex items-start gap-1">
                <svg
                  className="w-4 h-4 mt-0.5 flex-shrink-0"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                Tổng phải chi là phí chưa phải trả cho đối tác sửa chữa
              </div>

              {/* Payment History Table */}
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                      -
                    </th>
                    <th className="px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                      Thời gian
                    </th>
                    <th className="px-2 py-2 text-left text-slate-700 dark:text-slate-300">
                      Người chi - Ghi chú
                    </th>
                    <th className="px-2 py-2 text-right text-slate-700 dark:text-slate-300">
                      Số tiền
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment, index) => (
                    <tr
                      key={index}
                      className="border-b border-slate-200 dark:border-slate-700"
                    >
                      <td className="px-2 py-2 text-slate-900 dark:text-slate-100">
                        {index + 1}
                      </td>
                      <td className="px-2 py-2 text-slate-900 dark:text-slate-100">
                        {payment.time}{" "}
                        {new Date(payment.date).toLocaleDateString("vi-VN", {
                          day: "2-digit",
                          month: "2-digit",
                          year: "numeric",
                        })}
                      </td>
                      <td className="px-2 py-2">
                        <div className="text-slate-900 dark:text-slate-100">
                          {payment.payer}
                        </div>
                        <div className="text-xs text-slate-500">
                          {payment.cashier}
                        </div>
                      </td>
                      <td className="px-2 py-2 text-right text-slate-900 dark:text-slate-100">
                        {formatCurrency(payment.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-slate-50 dark:bg-slate-700">
                  <tr>
                    <td
                      colSpan={3}
                      className="px-2 py-2 text-right font-bold text-slate-900 dark:text-slate-100"
                    >
                      Tổng đã chi
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-slate-900 dark:text-slate-100">
                      {formatCurrency(totalPaid)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div >

          {/* Mobile Footer V2 */}
          < div className="sm:hidden sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-100 dark:border-slate-800 p-4 pb-20 z-20" >
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 disabled:opacity-70 active:scale-[0.98] transition-all"
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
                <span>LƯU THAY ĐỔI</span>
              )}
            </button>
          </div >

          {/* Desktop Footer */}
          < div className="hidden sm:flex sticky bottom-0 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 p-4 justify-end gap-3" >
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"
            >
              ĐÓNG
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              disabled={isSubmitting}
            >
              {isSubmitting && (
                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
              )}
              LƯU
            </button>
          </div >
        </form >

        {/* Supplier Modal */}
        < SupplierModal
          isOpen={showSupplierModal}
          onClose={() => setShowSupplierModal(false)}
          onSave={handleSaveSupplier}
          initialData={
            supplierModalMode === "edit"
              ? { name: supplier, phone: supplierPhone, address: "", email: "" }
              : undefined
          }
          mode={supplierModalMode}
        />

        {/* Add Product Modal */}
        < AddProductToReceiptModal
          isOpen={showAddProductModal}
          onClose={() => setShowAddProductModal(false)}
          onAdd={handleAddProduct}
          currentBranchId={currentBranchId}
        />
      </div >

    </div >
  );
};


export default EditReceiptModal;
