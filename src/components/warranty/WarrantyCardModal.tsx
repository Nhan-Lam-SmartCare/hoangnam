import React, { useState, useEffect } from "react";
import { X, Shield, Calendar, Package, Scan } from "lucide-react";
import { useCreateWarrantyCard } from "../../hooks/useWarrantyRepository";
import { showToast } from "../../utils/toast";
import { ScannerModal } from "../common/ScannerModal";
import { supabase } from "../../supabaseClient";

interface WarrantyCardModalProps {
    isOpen: boolean;
    onClose: () => void;
    customerName?: string;
    customerPhone?: string;
    deviceModel?: string;
    imeiSerial?: string;
    workOrderId?: string;
}

type WarrantyFormData = {
    customerId?: string;
    customerName: string;
    customerPhone: string;
    deviceModel: string;
    imeiSerial: string;
    warrantyPeriodMonths: number;
    warrantyType: "standard" | "extended" | "premium";
    coveredParts: string;
    coverageTerms: string;
    notes: string;
};

const CustomerInfoSection: React.FC<{
    formData: WarrantyFormData;
    setFormData: React.Dispatch<React.SetStateAction<WarrantyFormData>>;
    setShowCustomerSuggestions: React.Dispatch<React.SetStateAction<boolean>>;
    customerSuggestions: Array<{ id: string; name: string; phone?: string | null }>;
    showCustomerSuggestions: boolean;
    isSearchingCustomer: boolean;
    onSelectCustomer: (customer: { id: string; name: string; phone?: string | null }) => void;
}> = ({
    formData,
    setFormData,
    setShowCustomerSuggestions,
    customerSuggestions,
    showCustomerSuggestions,
    isSearchingCustomer,
    onSelectCustomer,
}) => (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
            Thông tin khách hàng
        </h4>
        <div className="space-y-2 relative">
            <input
                type="text"
                value={formData.customerName}
                onChange={(e) =>
                    setFormData({
                        ...formData,
                        customerId: undefined,
                        customerName: e.target.value,
                    })
                }
                onFocus={() => setShowCustomerSuggestions(true)}
                onBlur={() => {
                    setTimeout(() => setShowCustomerSuggestions(false), 150);
                }}
                placeholder="Tên khách hàng *"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
            <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) =>
                    setFormData({
                        ...formData,
                        customerId: undefined,
                        customerPhone: e.target.value,
                    })
                }
                onFocus={() => setShowCustomerSuggestions(true)}
                onBlur={() => {
                    setTimeout(() => setShowCustomerSuggestions(false), 150);
                }}
                placeholder="Số điện thoại *"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
            {showCustomerSuggestions && (formData.customerName.trim() || formData.customerPhone.trim()) && (
                <div className="absolute left-0 right-0 top-full mt-1 z-20 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl max-h-52 overflow-y-auto">
                    {isSearchingCustomer ? (
                        <div className="px-3 py-2 text-xs text-slate-500">Đang tìm khách hàng...</div>
                    ) : customerSuggestions.length > 0 ? (
                        customerSuggestions.map((customer) => (
                            <button
                                key={customer.id}
                                type="button"
                                onClick={() => onSelectCustomer(customer)}
                                className="w-full text-left px-3 py-2 hover:bg-slate-100 dark:hover:bg-slate-800 border-b last:border-b-0 border-slate-100 dark:border-slate-800"
                            >
                                <div className="text-sm font-semibold text-slate-800 dark:text-slate-100">{customer.name || "Khách hàng"}</div>
                                <div className="text-xs text-slate-500">{customer.phone || "Không có SĐT"}</div>
                            </button>
                        ))
                    ) : (
                        <div className="px-3 py-2 text-xs text-slate-500">Không thấy khách hàng có sẵn trong danh sách.</div>
                    )}
                </div>
            )}
        </div>
    </div>
);

const DeviceInfoSection: React.FC<{
    formData: WarrantyFormData;
    setFormData: React.Dispatch<React.SetStateAction<WarrantyFormData>>;
    onOpenScanner: () => void;
}> = ({ formData, setFormData, onOpenScanner }) => (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
            Thông tin thiết bị
        </h4>
        <div className="space-y-2">
            <input
                type="text"
                value={formData.deviceModel}
                onChange={(e) =>
                    setFormData({ ...formData, deviceModel: e.target.value })
                }
                placeholder="Tên thiết bị / Model *"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                required
            />
            <div className="flex gap-2">
                <input
                    type="text"
                    value={formData.imeiSerial}
                    onChange={(e) =>
                        setFormData({ ...formData, imeiSerial: e.target.value })
                    }
                    placeholder="IMEI / Serial Number"
                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm uppercase font-mono"
                />
                <button
                    type="button"
                    onClick={onOpenScanner}
                    className="p-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg active:scale-95 transition-all"
                    title="Quét mã vạch"
                >
                    <Scan className="w-5 h-5" />
                </button>
            </div>
        </div>
    </div>
);

export const WarrantyCardModal: React.FC<WarrantyCardModalProps> = ({
    isOpen,
    onClose,
    customerName = "",
    customerPhone = "",
    deviceModel = "",
    imeiSerial = "",
    workOrderId,
}) => {
    const [formData, setFormData] = useState<WarrantyFormData>({
        customerId: undefined,
        customerName,
        customerPhone,
        deviceModel,
        imeiSerial,
        warrantyPeriodMonths: 3,
        warrantyType: "standard" as "standard" | "extended" | "premium",
        coveredParts: "Toàn bộ sản phẩm, bao gồm lỗi do nhà sản xuất",
        coverageTerms: "Bảo hành không áp dụng với hư hỏng do rơi vỡ, ngấm nước, hoặc can thiệp bên ngoài",
        notes: "",
    });

    const [showScanner, setShowScanner] = useState(false);
    const [customerSuggestions, setCustomerSuggestions] = useState<Array<{ id: string; name: string; phone?: string | null }>>([]);
    const [showCustomerSuggestions, setShowCustomerSuggestions] = useState(false);
    const [isSearchingCustomer, setIsSearchingCustomer] = useState(false);

    // Update state when props change
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            customerId: undefined,
            customerName,
            customerPhone,
            deviceModel,
            imeiSerial,
        }));
    }, [customerName, customerPhone, deviceModel, imeiSerial]);

    useEffect(() => {
        const keyword = formData.customerPhone.trim() || formData.customerName.trim();
        if (!keyword || formData.customerId) {
            setCustomerSuggestions([]);
            return;
        }

        let active = true;
        const timer = setTimeout(async () => {
            setIsSearchingCustomer(true);
            const { data, error } = await supabase
                .from("customers")
                .select("id, name, phone")
                .or(`phone.ilike.%${keyword}%,name.ilike.%${keyword}%`)
                .limit(8);

            if (!active) return;
            if (error || !data) {
                setCustomerSuggestions([]);
            } else {
                setCustomerSuggestions(data as Array<{ id: string; name: string; phone?: string | null }>);
            }
            setIsSearchingCustomer(false);
        }, 250);

        return () => {
            active = false;
            clearTimeout(timer);
        };
    }, [formData.customerName, formData.customerPhone, formData.customerId]);

    useEffect(() => {
        if (!isOpen) {
            setShowCustomerSuggestions(false);
            setCustomerSuggestions([]);
        }
    }, [isOpen]);

    const createWarrantyMutation = useCreateWarrantyCard();

    const handleSubmit = async () => {
        if (!formData.deviceModel) {
            showToast.error("Vui lòng nhập tên thiết bị");
            return;
        }

        try {
            await createWarrantyMutation.mutateAsync({
                customer_id: formData.customerId,
                customer_name: formData.customerName,
                customer_phone: formData.customerPhone,
                device_model: formData.deviceModel,
                imei_serial: formData.imeiSerial,
                warranty_period_months: formData.warrantyPeriodMonths,
                warranty_type: formData.warrantyType,
                covered_parts: [formData.coveredParts],
                coverage_terms: formData.coverageTerms,
                work_order_id: workOrderId,
                notes: formData.notes,
            });

            showToast.success("Đã cấp phiếu bảo hành thành công!");
            onClose();
        } catch (error) {
            console.error("Error creating warranty:", error);
            const rawError = error as any;
            const errorMessage =
                (error instanceof Error && error.message) ||
                rawError?.message ||
                rawError?.details ||
                rawError?.hint ||
                "Lỗi khi tạo phiếu bảo hành";
            showToast.error(errorMessage);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-end md:items-center md:justify-center">
            <div className="w-full md:max-w-2xl bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden transition-colors max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between py-2.5 px-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-purple-600">
                    <div className="flex items-center gap-2">
                        <div className="hidden sm:flex w-8 h-8 rounded-lg bg-white/20 items-center justify-center">
                            <Shield className="w-4 h-4 text-white" />
                        </div>
                        <h3 className="text-white font-bold text-sm sm:text-base uppercase tracking-wider">Cấp phiếu bảo hành</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-white/80 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 sm:space-y-4">
                    <CustomerInfoSection
                        formData={formData}
                        setFormData={setFormData}
                        setShowCustomerSuggestions={setShowCustomerSuggestions}
                        customerSuggestions={customerSuggestions}
                        showCustomerSuggestions={showCustomerSuggestions}
                        isSearchingCustomer={isSearchingCustomer}
                        onSelectCustomer={(customer) => {
                            setFormData((prev) => ({
                                ...prev,
                                customerId: customer.id,
                                customerName: customer.name || prev.customerName,
                                customerPhone: customer.phone || prev.customerPhone,
                            }));
                            setShowCustomerSuggestions(false);
                        }}
                    />

                    <DeviceInfoSection
                        formData={formData}
                        setFormData={setFormData}
                        onOpenScanner={() => setShowScanner(true)}
                    />

                    {/* Warranty Period */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                            <Calendar className="w-4 h-4" />
                            Thời hạn bảo hành
                        </label>
                        <div className="grid grid-cols-4 gap-2">
                            {[3, 6, 12].map((months) => (
                                <button
                                    key={months}
                                    type="button"
                                    onClick={() =>
                                        setFormData({ ...formData, warrantyPeriodMonths: months })
                                    }
                                    className={`py-2.5 rounded-lg text-sm font-bold transition-all ${formData.warrantyPeriodMonths === months
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/30"
                                        : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
                                        }`}
                                >
                                    {months} tháng
                                </button>
                            ))}
                            <div className="relative">
                                <input
                                    type="number"
                                    placeholder="Khác..."
                                    value={![3, 6, 12].includes(formData.warrantyPeriodMonths) && formData.warrantyPeriodMonths > 0 ? formData.warrantyPeriodMonths : ""}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value, 10);
                                        setFormData({ ...formData, warrantyPeriodMonths: isNaN(val) ? 0 : val });
                                    }}
                                    className={`w-full py-2.5 px-2 rounded-lg text-sm font-bold text-center border transition-all focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                                        ![3, 6, 12].includes(formData.warrantyPeriodMonths) && formData.warrantyPeriodMonths > 0
                                            ? "bg-blue-600 text-white border-blue-650 shadow-lg shadow-blue-500/30 placeholder-white/70"
                                            : "bg-slate-100 border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-900 dark:text-white placeholder-slate-400"
                                    }`}
                                />
                                {![3, 6, 12].includes(formData.warrantyPeriodMonths) && formData.warrantyPeriodMonths > 0 && (
                                    <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[9px] font-black text-white pointer-events-none pr-1">
                                        tháng
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Covered Content */}
                    <div>
                        <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase mb-2">
                            <Package className="w-4 h-4" />
                            Nội dung bảo hành
                        </label>
                        <textarea
                            value={formData.coveredParts}
                            onChange={(e) =>
                                setFormData({ ...formData, coveredParts: e.target.value })
                            }
                            rows={2}
                            placeholder="VD: Toàn bộ sản phẩm (trừ phụ kiện), Động cơ + pin xe điện, Lỗi phần cứng do nhà sản xuất..."
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                        />
                        <p className="text-xs text-slate-400 mt-1">
                            💡 Ghi rõ những gì được bảo hành (linh kiện, bộ phận, toàn bộ sản phẩm...)
                        </p>
                    </div>

                    {/* Coverage Terms */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            Điều kiện bảo hành
                        </label>
                        <textarea
                            value={formData.coverageTerms}
                            onChange={(e) =>
                                setFormData({ ...formData, coverageTerms: e.target.value })
                            }
                            rows={2}
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                        />
                    </div>

                    {/* Notes */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
                            Ghi chú
                        </label>
                        <textarea
                            value={formData.notes}
                            onChange={(e) =>
                                setFormData({ ...formData, notes: e.target.value })
                            }
                            rows={2}
                            placeholder="Ghi chú thêm (nếu có)"
                            className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex-shrink-0 p-3 sm:p-4 border-t border-slate-200 dark:border-slate-700 flex gap-2.5 sm:gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2.5 sm:py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={
                            !formData.deviceModel ||
                            (!formData.customerName.trim() && !formData.customerPhone.trim()) ||
                            createWarrantyMutation.isPending
                        }
                        className="flex-1 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20 text-sm"
                    >
                        {createWarrantyMutation.isPending ? "Đang tạo..." : "✓ Cấp Phiếu BH"}
                    </button>
                </div>
            </div>

            <ScannerModal
                isOpen={showScanner}
                onClose={() => setShowScanner(false)}
                onScan={(result) => {
                    setFormData(prev => ({ ...prev, imeiSerial: result }));
                    if (navigator.vibrate) navigator.vibrate(200);
                }}
            />
        </div>
    );
};
