import React, { useState, useEffect } from "react";
import { X, Shield, Calendar, Package, Scan } from "lucide-react";
import { useCreateWarrantyCard } from "../../hooks/useWarrantyRepository";
import { showToast } from "../../utils/toast";
import { ScannerModal } from "../common/ScannerModal";

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
}> = ({ formData, setFormData }) => (
    <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
        <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">
            Thông tin khách hàng
        </h4>
        <div className="space-y-2">
            <input
                type="text"
                value={formData.customerName}
                onChange={(e) =>
                    setFormData({ ...formData, customerName: e.target.value })
                }
                placeholder="Tên khách hàng"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
            <input
                type="tel"
                value={formData.customerPhone}
                onChange={(e) =>
                    setFormData({ ...formData, customerPhone: e.target.value })
                }
                placeholder="Số điện thoại"
                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-sm"
            />
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

    // Update state when props change
    useEffect(() => {
        setFormData(prev => ({
            ...prev,
            customerName,
            customerPhone,
            deviceModel,
            imeiSerial,
        }));
    }, [customerName, customerPhone, deviceModel, imeiSerial]);

    const createWarrantyMutation = useCreateWarrantyCard();

    const handleSubmit = async () => {
        if (!formData.deviceModel) {
            showToast.error("Vui lòng nhập tên thiết bị");
            return;
        }

        try {
            await createWarrantyMutation.mutateAsync({
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
            showToast.error("Lỗi khi tạo phiếu bảo hành");
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/70 z-[120] flex items-end md:items-center md:justify-center">
            <div className="w-full md:max-w-2xl bg-white dark:bg-[#1e1e2d] rounded-t-2xl md:rounded-xl overflow-hidden transition-colors max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex-shrink-0 flex items-center justify-between p-4 border-b border-slate-200 dark:border-slate-700 bg-gradient-to-r from-blue-600 to-purple-600">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-white" />
                        </div>
                        <h3 className="text-white font-bold text-base">CẤP PHIẾU BẢO HÀNH</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 text-white/80 hover:text-white"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    <CustomerInfoSection
                        formData={formData}
                        setFormData={setFormData}
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
                        <div className="grid grid-cols-3 gap-2">
                            {[3, 6, 12].map((months) => (
                                <button
                                    key={months}
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
                            rows={3}
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
                            rows={3}
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
                <div className="flex-shrink-0 p-4 border-t border-slate-200 dark:border-slate-700 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-300 rounded-xl font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!formData.deviceModel || createWarrantyMutation.isPending}
                        className="flex-1 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-blue-500/20"
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
