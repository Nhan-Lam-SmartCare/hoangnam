/**
 * Service utility functions
 * Extracted from ServiceManager.tsx for reusability
 */

import { fetchStoreSettingsForBranch as fetchStoreSettingsForBranchRepo } from "../../../lib/repository/storeSettingsRepository";
import { showToast } from "../../../utils/toast";
import { formatCurrency } from "../../../utils/format";
import type { WorkOrder } from "../../../types";

/**
 * Tính thành tiền một dòng "Gia công / Đặt hàng ngoài".
 * Thành tiền = (đơn giá + tiền công) × số lượng.
 * Tương thích ngược: đơn cũ không có laborPrice => coi như 0.
 */
export function getServiceLineTotal(s: {
    price?: number;
    laborPrice?: number;
    quantity?: number;
}): number {
    return ((s?.price || 0) + (s?.laborPrice || 0)) * (s?.quantity || 1);
}

export interface PrintableStoreSettings {
    store_name?: string;
    address?: string;
    phone?: string;
    email?: string;
    logo_url?: string;
    bank_qr_url?: string;
    bank_name?: string;
    bank_account_number?: string;
    bank_account_holder?: string;
    bank_branch?: string;
    work_order_prefix?: string;
}

export const fetchStoreSettingsForBranch = async (
    branchId?: string
): Promise<PrintableStoreSettings | null> => {
    const res = await fetchStoreSettingsForBranchRepo(branchId);
    if (!res.ok) {
        console.warn("[service.utils] Failed to fetch store settings:", res.error);
        return null;
    }
    return res.data;
};

export const sanitizeIssueDescriptionForPrint = (issueDescription?: string): string => {
    const cleaned = String(issueDescription || "")
        .replace(/(?:\r?\n)*\[Mật khẩu\/Pattern\]:.*$/is, "")
        .trim();

    return cleaned || "Không có mô tả";
};

/**
 * Download a blob as an image file
 */
export const downloadImage = (blob: Blob, fileName: string): void => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast.success("Đã tải phiếu xuống!");
};

/**
 * Format phone number with mask for privacy
 * Shows only last 4 digits
 */
export const formatMaskedPhone = (phone?: string): string => {
    if (!phone) return "N/A";
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 4) return phone;
    return `*** *** ${digits.slice(-4)}`;
};

/**
 * Initiate a phone call
 */
export const handleCallCustomer = (phone: string): void => {
    if (phone) {
        window.location.href = `tel:${phone}`;
    }
};

/**
 * Sinh nội dung hóa đơn in nhiệt 80mm (dạng text thuần) cho phiếu sửa chữa.
 * Dùng chung cho in Bluetooth ở ServiceManager và ServiceHistory.
 */
export const generateWorkOrderTextReceipt = (
    order: WorkOrder,
    settings: PrintableStoreSettings | null
): string => {
    const line = "--------------------------------";
    const doubleLine = "================================";
    const now = new Date(order.creationDate).toLocaleString("vi-VN");
    const prefix = settings?.work_order_prefix || "SC";
    const formattedId = `${prefix}-${String(order.id).padStart(5, "0")}`;

    let partLines = "";
    if (order.partsUsed && order.partsUsed.length > 0) {
        partLines += `Phu tung:\n`;
        order.partsUsed.forEach((p) => {
            partLines += `- ${p.partName}\n`;
            const qtyPrice = `  ${p.quantity} x ${formatCurrency(p.price)}`;
            const totalP = formatCurrency(p.quantity * p.price);
            const spacesCount = 32 - qtyPrice.length - totalP.length;
            const spaces = spacesCount > 0 ? " ".repeat(spacesCount) : " ";
            partLines += `${qtyPrice}${spaces}${totalP}\n`;
        });
    }

    let serviceLines = "";
    if (order.additionalServices && order.additionalServices.length > 0) {
        serviceLines += `Dich vu:\n`;
        order.additionalServices.forEach((s) => {
            serviceLines += `- ${s.description || ""}\n`;
            const unitPrice = (s.price || 0) + ((s as { laborPrice?: number }).laborPrice || 0);
            const qtyPrice = `  ${s.quantity || 1} x ${formatCurrency(unitPrice)}`;
            const totalS = formatCurrency(getServiceLineTotal(s));
            const spacesCount = 32 - qtyPrice.length - totalS.length;
            const spaces = spacesCount > 0 ? " ".repeat(spacesCount) : " ";
            serviceLines += `${qtyPrice}${spaces}${totalS}\n`;
        });
    }

    const partsTotal = order.partsUsed?.reduce((sum, p) => sum + p.quantity * p.price, 0) || 0;
    const servicesTotal = order.additionalServices?.reduce((sum, s) => sum + getServiceLineTotal(s), 0) || 0;
    const laborCost = order.laborCost || 0;
    const grandTotal = order.total || (partsTotal + servicesTotal + laborCost);

    const partsStr = formatCurrency(partsTotal);
    const servicesStr = formatCurrency(servicesTotal);
    const laborStr = formatCurrency(laborCost);
    const grandTotalStr = formatCurrency(grandTotal);

    const partsLine = `Tien phu tung:${" ".repeat(Math.max(1, 32 - 14 - partsStr.length))}${partsStr}`;
    const servicesLine = `Tien dich vu:${" ".repeat(Math.max(1, 32 - 13 - servicesStr.length))}${servicesStr}`;
    const laborLine = `Tien cong:${" ".repeat(Math.max(1, 32 - 10 - laborStr.length))}${laborStr}`;
    const totalLine = `Tong cong:${" ".repeat(Math.max(1, 32 - 10 - grandTotalStr.length))}${grandTotalStr}`;

    const storeName = (settings?.store_name || "MOTOCARE PRO").toUpperCase();
    const padTotal = 32 - storeName.length;
    const padLeft = padTotal > 0 ? Math.floor(padTotal / 2) : 0;
    const centeredStoreName = " ".repeat(padLeft) + storeName;

    return `
================================
${centeredStoreName}
================================
PHIEU DICH VU SUA CHUA
Ngay: ${now}
Ma phieu: ${formattedId}
${doubleLine}
Khach hang: ${order.customerName}
SDT: ${order.customerPhone}
Thiet bi: ${order.vehicleModel}
Serial/IMEI: ${order.licensePlate}
${doubleLine}
Noi dung: ${order.issueDescription || "Sua chua thiet bi"}
${line}
${partLines}${serviceLines}${line}
${partsLine}
${servicesLine}
${laborLine}
${totalLine}
${doubleLine}
KTV: ${order.technicianName || "Chua phan cong"}
Trang thai: ${order.status}
${doubleLine}
Cam on quy khach da tin tuong!
================================
\n\n\n\n`;
};

/**
 * Share invoice as image using Web Share API or download
 */
export const shareInvoiceAsImage = async (
    element: HTMLElement,
    orderId: string,
    _orderPrefix?: string
): Promise<boolean> => {
    try {
        const html2canvas = (await import("html2canvas")).default;
        const canvas = await html2canvas(element, {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
        });

        const blob = await new Promise<Blob>((resolve) => {
            canvas.toBlob((b) => resolve(b!), "image/png", 1.0);
        });

        const fileName = `phieu-sua-chua-${orderId}.png`;

        if (navigator.share && navigator.canShare) {
            const file = new File([blob], fileName, { type: "image/png" });
            if (navigator.canShare({ files: [file] })) {
                await navigator.share({
                    files: [file],
                    title: `Phiếu sửa chữa ${orderId}`,
                });
                showToast.success("Đã chia sẻ phiếu thành công!");
                return true;
            }
        }

        // Fallback to download
        downloadImage(blob, fileName);
        return true;
    } catch (error) {
        if ((error as Error).name !== "AbortError") {
            console.error("Error sharing invoice:", error);
            showToast.error("Không thể chia sẻ phiếu");
        }
        return false;
    }
};

/**
 * Lấy mã ngân hàng ngắn gọn chuẩn VietQR
 */
export const getBankShortCode = (bankName: string): string => {
    const normalized = bankName.toLowerCase().trim();
    if (normalized.includes("vietcombank") || normalized.includes("vcb")) return "VCB";
    if (normalized.includes("mbbank") || normalized.includes("mb bank") || normalized.includes("mb")) return "MB";
    if (normalized.includes("techcombank") || normalized.includes("tcb") || normalized.includes("kỹ thương")) return "TCB";
    if (normalized.includes("vietinbank") || normalized.includes("ctg") || normalized.includes("vietin")) return "ICB";
    if (normalized.includes("bidv") || normalized.includes("đầu tư")) return "BIDV";
    if (normalized.includes("acb") || normalized.includes("á châu")) return "ACB";
    if (normalized.includes("sacombank") || normalized.includes("stb")) return "STB";
    if (normalized.includes("agribank") || normalized.includes("vba") || normalized.includes("nông nghiệp")) return "VBA";
    if (normalized.includes("tpbank") || normalized.includes("tpb") || normalized.includes("tiên phong")) return "TPB";
    if (normalized.includes("vpbank") || normalized.includes("vpb") || normalized.includes("việt nam thịnh vượng")) return "VPB";
    if (normalized.includes("hdbank") || normalized.includes("hdb")) return "HDB";
    if (normalized.includes("shb")) return "SHB";
    if (normalized.includes("vib")) return "VIB";
    if (normalized.includes("msb") || normalized.includes("hàng hải")) return "MSB";
    if (normalized.includes("ocb") || normalized.includes("phương đông")) return "OCB";
    if (normalized.includes("seabank") || normalized.includes("seab")) return "SEAB";
    if (normalized.includes("eximbank") || normalized.includes("eib")) return "EIB";
    if (normalized.includes("lienvietpostbank") || normalized.includes("lpbank") || normalized.includes("lpb")) return "LPB";
    
    return bankName.replace(/[^a-zA-Z0-9]/g, "");
};

/**
 * Tạo link QR thanh toán động VietQR cho phiếu sửa chữa hoặc hóa đơn bán hàng
 */
export const getDynamicQrUrl = (
    order: any,
    storeSettings: PrintableStoreSettings | null
): string => {
    if (!order) return "";
    if (storeSettings?.bank_name && storeSettings?.bank_account_number) {
        const bankId = getBankShortCode(storeSettings.bank_name);
        const accountNo = storeSettings.bank_account_number;
        
        // remainingAmount có thể là 0 nên check khác undefined
        const amount = order.remainingAmount !== undefined ? order.remainingAmount : (order.total || 0);
        
        let orderIdFormatted = "";
        if (order.isSale) {
            orderIdFormatted = order.code || String(order.id);
        } else {
            const idStr = String(order.id);
            const prefix = storeSettings.work_order_prefix || "SC";
            if (idStr.startsWith(prefix)) {
                orderIdFormatted = idStr;
            } else {
                const numericPart = idStr.replace(/[^0-9]/g, "");
                if (numericPart && numericPart === idStr) {
                    orderIdFormatted = `${prefix}-${idStr.padStart(5, "0")}`;
                } else {
                    orderIdFormatted = idStr;
                }
            }
        }
        
        const addInfo = encodeURIComponent(`Thanh toan phieu ${orderIdFormatted}`);
        const accountName = storeSettings.bank_account_holder
            ? encodeURIComponent(storeSettings.bank_account_holder)
            : "";

        return `https://img.vietqr.io/image/${bankId}-${accountNo}-compact.png?amount=${amount}&addInfo=${addInfo}&accountName=${accountName}`;
    }
    
    return storeSettings?.bank_qr_url || "";
};

