import { useCallback } from "react";
import type { Part } from "../../../types";
import {
  exportPartsToExcel,
  exportInventoryTemplate,
} from "../../../utils/excel";
import { showToast } from "../../../utils/toast";

export interface UseInventoryExcelActionsParams {
  canExportInventoryExcel: boolean;
  repoParts: Part[];
  currentBranchId: string;
}

/**
 * Các thao tác Excel của trang kho (xuất tồn kho + tải template).
 * Tách khỏi InventoryManager để component mỏng hơn; hành vi giữ nguyên.
 */
export function useInventoryExcelActions({
  canExportInventoryExcel,
  repoParts,
  currentBranchId,
}: UseInventoryExcelActionsParams) {
  const handleExportExcel = useCallback(() => {
    if (!canExportInventoryExcel) {
      showToast.error("Bạn không có quyền xuất Excel kho");
      return;
    }

    try {
      const now = new Date();
      const filename = `ton-kho-${now.getDate()}-${now.getMonth() + 1
        }-${now.getFullYear()}.xlsx`;
      exportPartsToExcel(repoParts, currentBranchId, filename);
      showToast.success("Xuất file Excel thành công!");
    } catch (error) {
      console.error("Export error:", error);
      showToast.error("Có lỗi khi xuất file Excel");
    }
  }, [canExportInventoryExcel, repoParts, currentBranchId]);

  const handleDownloadTemplate = useCallback(() => {
    try {
      exportInventoryTemplate();
      showToast.success(
        "Tải template thành công! Vui lòng điền thông tin và import lại."
      );
    } catch (error) {
      console.error("Template download error:", error);
      showToast.error("Có lỗi khi tải template");
    }
  }, []);

  return { handleExportExcel, handleDownloadTemplate };
}
