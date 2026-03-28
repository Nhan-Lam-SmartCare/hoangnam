import React, { useState, useEffect } from "react";
import { showToast } from "../../../utils/toast";
import { useCreateSupplier, useUpdateSupplier } from "../../../hooks/useSuppliers";

interface SupplierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (supplier: any) => void;
    initialData?: {
        id?: string;
        name: string;
        phone: string;
        address: string;
        email: string;
    };
    mode: "add" | "edit";
}

const SupplierModal: React.FC<SupplierModalProps> = ({
    isOpen,
    onClose,
    onSave,
    initialData,
    mode,
}) => {
    const [name, setName] = useState("");
    const [phone, setPhone] = useState("");
    const [address, setAddress] = useState("");
    const [email, setEmail] = useState("");

    const createSupplierMutation = useCreateSupplier();
    const updateSupplierMutation = useUpdateSupplier();

    useEffect(() => {
        if (isOpen && initialData) {
            setName(initialData.name || "");
            setPhone(initialData.phone || "");
            setAddress(initialData.address || "");
            setEmail(initialData.email || "");
        } else if (isOpen && mode === "add") {
            setName("");
            setPhone("");
            setAddress("");
            setEmail("");
        }
    }, [isOpen, initialData, mode]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            showToast.warning("Vui lòng nhập tên nhà cung cấp");
            return;
        }

        try {
            if (mode === "add") {
                const newSupplier = await createSupplierMutation.mutateAsync({
                    name: name.trim(),
                    phone: phone.trim() || undefined,
                    address: address.trim() || undefined,
                    email: email.trim() || undefined,
                });

                onSave(newSupplier);
            } else if (mode === "edit" && initialData?.id) {
                const updatedSupplier = await updateSupplierMutation.mutateAsync({
                    id: initialData.id,
                    updates: {
                        name: name.trim(),
                        phone: phone.trim() || undefined,
                        address: address.trim() || undefined,
                        email: email.trim() || undefined,
                    },
                });

                onSave(updatedSupplier);
            } else {
                // Fallback
                onSave({
                    name: name.trim(),
                    phone: phone.trim(),
                    address: address.trim(),
                    email: email.trim(),
                });
            }

            onClose();
        } catch (error: any) {
            console.error("Error saving supplier:", error);
        }
    };

    if (!isOpen) return null;

    const isSubmitting = createSupplierMutation.isPending || updateSupplierMutation.isPending;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000] p-4">
            <div className="bg-white dark:bg-slate-800 rounded-lg w-full max-w-md shadow-xl">
                <form onSubmit={handleSubmit}>
                    {/* Header */}
                    <div className="flex justify-between items-center p-4 border-b border-slate-200 dark:border-slate-700">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                            {mode === "add" ? "Thêm nhà cung cấp" : "Cập nhật nhà cung cấp"}
                        </h3>
                        <button
                            type="button"
                            onClick={onClose}
                            className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-2xl"
                            disabled={isSubmitting}
                        >
                            ×
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Tên nhà cung cấp <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Nhập tên nhà cung cấp"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                required
                                autoFocus
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Số điện thoại
                            </label>
                            <input
                                type="tel"
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                placeholder="Nhập số điện thoại"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Email
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Nhập email"
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                disabled={isSubmitting}
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                                Địa chỉ
                            </label>
                            <textarea
                                value={address}
                                onChange={(e) => setAddress(e.target.value)}
                                placeholder="Nhập địa chỉ"
                                rows={3}
                                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end gap-3 p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 rounded-b-lg">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            disabled={isSubmitting}
                        >
                            Hủy
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center gap-2 transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                            disabled={isSubmitting}
                        >
                            {isSubmitting && (
                                <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                            )}
                            {mode === "add" ? "Thêm mới" : "Lưu thay đổi"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default SupplierModal;
