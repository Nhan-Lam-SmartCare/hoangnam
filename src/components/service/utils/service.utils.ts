/**
 * Service utility functions
 * Extracted from ServiceManager.tsx for reusability
 */

import { showToast } from "../../../utils/toast";

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
 * Share invoice as image using Web Share API or download
 */
export const shareInvoiceAsImage = async (
    element: HTMLElement,
    orderId: string,
    orderPrefix?: string
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
