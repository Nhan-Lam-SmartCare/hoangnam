import { useState } from "react";
import type { Part } from "../../../types";
import { showToast } from "../../../utils/toast";
import { getPartWarrantyText } from "../../../utils/partWarranty";
import type {
  useDeletePartRepo,
  useUpdatePartRepo,
} from "../../../hooks/usePartsRepository";

type ConfirmFn = (options: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "red" | "blue" | "green";
}) => Promise<boolean>;

export interface UsePartActionsParams {
  /** Danh sách sản phẩm ĐANG HIỂN THỊ (trang hiện tại) — phạm vi của "chọn tất cả". */
  displayedParts: Part[];
  /** Trang dữ liệu hiện tại từ repo (tra cứu tên khi xóa đơn lẻ). */
  repoParts: Part[];
  canUpdatePart: boolean;
  canDeletePart: boolean;
  confirm: ConfirmFn;
  deletePartMutation: ReturnType<typeof useDeletePartRepo>;
  updatePartMutation: ReturnType<typeof useUpdatePartRepo>;
  refetchAllParts: () => Promise<unknown>;
  /** Đóng các menu thao tác (desktop dropdown + mobile sheet) sau khi sửa bảo hành. */
  onCloseMenus: () => void;
}

/**
 * Chọn nhiều + các thao tác trên phụ tùng (xóa đơn lẻ, xóa hàng loạt tuần tự,
 * sửa nhanh bảo hành). Tách khỏi InventoryManager, hành vi giữ nguyên.
 */
export function usePartActions({
  displayedParts,
  repoParts,
  canUpdatePart,
  canDeletePart,
  confirm,
  deletePartMutation,
  updatePartMutation,
  refetchAllParts,
  onCloseMenus,
}: UsePartActionsParams) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);

  // Chọn tất cả — chỉ tác động trên các sản phẩm ĐANG HIỂN THỊ (trang hiện
  // tại), tránh vô tình chọn cả sản phẩm ở trang khác khi đang lọc client-side.
  const handleSelectAll = (checked: boolean) => {
    const pageIds = displayedParts.map((p) => p.id);
    if (checked) {
      // Gộp id trang hiện tại vào lựa chọn sẵn có (không xóa lựa chọn ở trang khác).
      setSelectedItems((prev) => Array.from(new Set([...prev, ...pageIds])));
    } else {
      // Bỏ chọn các id thuộc trang hiện tại, giữ nguyên lựa chọn ở trang khác.
      setSelectedItems((prev) => prev.filter((id) => !pageIds.includes(id)));
    }
  };

  const handleSelectItem = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedItems((prev) => [...prev, id]);
    } else {
      setSelectedItems((prev) => prev.filter((i) => i !== id));
    }
  };

  const handleDeleteItem = async (id: string) => {
    if (!canDeletePart) {
      showToast.error("Bạn không có quyền xóa sản phẩm");
      return;
    }
    const part = repoParts.find((p) => p.id === id);
    if (!part) return;

    const confirmed = await confirm({
      title: "Xác nhận xóa",
      message: `Bạn có chắc chắn muốn xóa sản phẩm "${part.name}"?`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    deletePartMutation.mutate(
      { id },
      {
        onSuccess: async () => {
          // Remove from selected items if it was selected
          setSelectedItems((prev) => prev.filter((i) => i !== id));
          // Force refetch to update duplicate detection immediately
          await refetchAllParts();
          showToast.success(`Đã xóa phụ tùng "${part.name}"`);
        },
        onError: (error) => {
          console.error("Delete error:", error);
          showToast.error(`Không thể xóa: ${error.message}`);
        },
      }
    );
  };

  const handleQuickWarrantyEdit = (part: Part) => {
    if (!canUpdatePart) {
      showToast.error("Bạn không có quyền cập nhật sản phẩm");
      return;
    }

    const currentWarranty = getPartWarrantyText(part);
    const input = window.prompt(
      `Nhập bảo hành cho "${part.name}"\nVí dụ: 12 tháng, 1 năm\nĐể trống để xóa bảo hành`,
      currentWarranty
    );

    if (input === null) return;

    const nextWarranty = input.trim();

    updatePartMutation.mutate(
      {
        id: part.id,
        updates: {
          warrantyPeriod: nextWarranty || undefined,
        } as Partial<Part>,
      },
      {
        onSuccess: () => {
          showToast.success(
            nextWarranty
              ? `Đã cập nhật bảo hành: ${nextWarranty}`
              : "Đã xóa thông tin bảo hành"
          );
          onCloseMenus();
        },
        onError: (error: any) => {
          showToast.error(
            error?.message || "Không thể cập nhật bảo hành cho sản phẩm"
          );
        },
      }
    );
  };

  const handleBulkDelete = async () => {
    if (!canDeletePart) {
      showToast.error("Bạn không có quyền xóa sản phẩm");
      return;
    }
    if (selectedItems.length === 0) {
      showToast.warning("Vui lòng chọn ít nhất một sản phẩm");
      return;
    }

    const confirmed = await confirm({
      title: "Xác nhận xóa",
      message: `Bạn có chắc chắn muốn xóa ${selectedItems.length} sản phẩm đã chọn? Hành động này không thể hoàn tác.`,
      confirmText: "Xóa",
      cancelText: "Hủy",
      confirmColor: "red",
    });

    if (!confirmed) return;

    // Track progress for bulk delete
    let successCount = 0;
    let errorCount = 0;
    const totalCount = selectedItems.length;

    // Delete all selected items sequentially
    for (const id of selectedItems) {
      try {
        await deletePartMutation.mutateAsync({ id });
        successCount++;
      } catch (error) {
        console.error(`Delete error for item ${id}:`, error);
        errorCount++;
      }
    }

    // Force refetch to update duplicate detection immediately
    await refetchAllParts();

    if (errorCount === 0) {
      showToast.success(`Đã xóa ${successCount} phụ tùng`);
    } else if (successCount === 0) {
      showToast.error(`Không thể xóa ${totalCount} phụ tùng`);
    } else {
      showToast.warning(
        `Đã xóa ${successCount}/${totalCount} phụ tùng (${errorCount} lỗi)`
      );
    }

    setSelectedItems([]);
  };

  return {
    selectedItems,
    setSelectedItems,
    handleSelectAll,
    handleSelectItem,
    handleDeleteItem,
    handleQuickWarrantyEdit,
    handleBulkDelete,
  };
}
