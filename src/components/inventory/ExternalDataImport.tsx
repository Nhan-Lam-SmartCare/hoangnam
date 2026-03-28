import React, { useState } from "react";
import { Upload, Save, X, Search, CheckCircle, AlertCircle, RefreshCw } from "lucide-react";
import { supabase } from "../../supabaseClient";
import { showToast } from "../../utils/toast";
import { formatCurrency } from "../../utils/format";
import type { ExternalPart } from "../../types";

interface ExternalDataImportProps {
    onClose: () => void;
    onImported?: () => void;
}

export const ExternalDataImport: React.FC<ExternalDataImportProps> = ({
    onClose,
    onImported,
}) => {
    const [file, setFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [importing, setImporting] = useState(false);
    const [step, setStep] = useState<"upload" | "preview">("upload");

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setFile(e.target.files[0]);
        }
    };

    const handlePreview = async () => {
        if (!file) return;

        setLoading(true);
        try {
            const text = await file.text();
            let data = [];

            if (file.name.endsWith(".json")) {
                data = JSON.parse(text);
            } else if (file.name.endsWith(".csv")) {
                // Simple CSV parser
                const rows = text.split("\n");
                const headers = rows[0].split(",").map((h) => h.trim().replace(/"/g, ""));
                data = rows.slice(1).map((row) => {
                    const values = row.split(",").map((v) => v.trim().replace(/"/g, ""));
                    const obj: any = {};
                    headers.forEach((h, i) => {
                        obj[h] = values[i];
                    });
                    return obj;
                });
            } else {
                showToast.error("Chỉ hỗ trợ file JSON hoặc CSV");
                setLoading(false);
                return;
            }

            // Validate and map data
            const mappedData = data
                .filter((item: Record<string, any>) => item.name) // Must have name
                .map((item: Record<string, any>) => ({
                    name: item.name,
                    sku: item.sku || "",
                    price: Number(item.price) || 0,
                    category: item.category || "Phụ tùng",
                    image_url: item.image_url || "",
                    source_url: item.source_url || "",
                }));

            setPreviewData(mappedData);
            setStep("preview");
        } catch (error) {
            console.error("Error parsing file:", error);
            showToast.error("Lỗi đọc file. Vui lòng kiểm tra định dạng.");
        } finally {
            setLoading(false);
        }
    };

    const handleImport = async () => {
        if (previewData.length === 0) return;

        setImporting(true);
        try {
            // Insert into external_parts table
            const { error } = await supabase.from("external_parts").insert(previewData);

            if (error) throw error;

            showToast.success(`Đã nhập thành công ${previewData.length} sản phẩm!`);
            onImported?.();
            onClose();
        } catch (error) {
            console.error("Error importing data:", error);
            showToast.error("Lỗi khi lưu dữ liệu vào hệ thống.");
        } finally {
            setImporting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-slate-200 dark:border-slate-700">
                <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50">
                    <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <Upload className="w-6 h-6 text-blue-600" />
                        Nhập dữ liệu từ bên ngoài
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {step === "upload" ? (
                        <div className="flex flex-col items-center justify-center h-full space-y-6 py-12">
                            <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center">
                                <Upload className="w-10 h-10 text-blue-600 dark:text-blue-400" />
                            </div>
                            <div className="text-center space-y-2">
                                <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
                                    Chọn file dữ liệu (JSON hoặc CSV)
                                </h3>
                                <p className="text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
                                    File được tạo từ công cụ quét dữ liệu (scrape-xemay.js).
                                </p>
                            </div>

                            <div className="w-full max-w-md">
                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-slate-300 dark:border-slate-600 border-dashed rounded-xl cursor-pointer bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                        <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">
                                            <span className="font-semibold">Nhấn để chọn tệp</span>
                                        </p>
                                        <p className="text-xs text-slate-500 dark:text-slate-400">
                                            JSON, CSV
                                        </p>
                                    </div>
                                    <input type="file" className="hidden" accept=".json,.csv" onChange={handleFileChange} />
                                </label>
                            </div>

                            {file && (
                                <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-900/20 px-4 py-3 rounded-lg border border-blue-100 dark:border-blue-800">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-md shadow-sm">
                                        <span className="text-xs font-bold text-blue-600">TẬP TIN</span>
                                    </div>
                                    <div className="text-sm font-medium text-slate-700 dark:text-slate-200">
                                        {file.name}
                                    </div>
                                    <div className="text-xs text-slate-500">
                                        ({(file.size / 1024).toFixed(1)} KB)
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={handlePreview}
                                disabled={!file || loading}
                                className="px-8 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold shadow-lg shadow-blue-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-all active:scale-95"
                            >
                                {loading ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Đang xử lý...
                                    </>
                                ) : (
                                    <>
                                        Tiếp tục
                                        <CheckCircle className="w-5 h-5" />
                                    </>
                                )}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                                    Xem trước dữ liệu ({previewData.length} sản phẩm)
                                </h3>
                                <button
                                    onClick={() => setStep("upload")}
                                    className="text-sm text-blue-600 hover:underline"
                                >
                                    Chọn file khác
                                </button>
                            </div>

                            <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden max-h-[500px] overflow-y-auto">
                                <table className="w-full text-sm text-left">
                                    <thead className="text-xs text-slate-500 uppercase bg-slate-50 dark:bg-slate-800 sticky top-0 z-10">
                                        <tr>
                                            <th className="px-6 py-3">Tên sản phẩm</th>
                                            <th className="px-6 py-3 text-right">Giá bán</th>
                                            <th className="px-6 py-3">Danh mục</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                                        {previewData.slice(0, 100).map((item, index) => (
                                            <tr key={index} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                                                <td className="px-6 py-3 font-medium text-slate-900 dark:text-slate-100">
                                                    {item.name}
                                                </td>
                                                <td className="px-6 py-3 text-right text-slate-600 dark:text-slate-300">
                                                    {formatCurrency(item.price)}
                                                </td>
                                                <td className="px-6 py-3 text-slate-500 dark:text-slate-400">
                                                    {item.category}
                                                </td>
                                            </tr>
                                        ))}
                                        {previewData.length > 100 && (
                                            <tr>
                                                <td colSpan={3} className="px-6 py-3 text-center text-slate-500 italic bg-slate-50 dark:bg-slate-800/50">
                                                    ... và {previewData.length - 100} sản phẩm khác
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                                <button
                                    onClick={onClose}
                                    className="px-6 py-2.5 border border-slate-300 dark:border-slate-600 rounded-xl text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium"
                                >
                                    Hủy
                                </button>
                                <button
                                    onClick={handleImport}
                                    disabled={importing}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold shadow-lg shadow-green-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                >
                                    {importing ? (
                                        <>
                                            <RefreshCw className="w-5 h-5 animate-spin" />
                                            Đang nhập...
                                        </>
                                    ) : (
                                        <>
                                            <Save className="w-5 h-5" />
                                            Xác nhận nhập
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
