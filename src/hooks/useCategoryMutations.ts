import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  renameCategory,
  deleteCategory,
} from "../lib/repository/partsRepository";
import { showToast } from "../utils/toast";

export const useRenameCategory = () => {
  const qc = useQueryClient();

  const refreshCategoryViews = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["parts"] }),
      qc.invalidateQueries({ queryKey: ["categories"] }),
    ]);

    await Promise.all([
      qc.refetchQueries({ queryKey: ["parts"], type: "active" }),
      qc.refetchQueries({ queryKey: ["categories"], type: "active" }),
    ]);
  };

  return useMutation({
    mutationFn: async ({
      oldName,
      newName,
    }: {
      oldName: string;
      newName: string;
    }) => {
      const result = await renameCategory(oldName, newName);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      showToast.success("Đã đổi tên danh mục");
      await refreshCategoryViews();
    },
    onError: (err: any) => {
      showToast.error(err?.message || "Lỗi đổi tên danh mục");
    },
  });
};

export const useDeleteCategory = () => {
  const qc = useQueryClient();

  const refreshCategoryViews = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["parts"] }),
      qc.invalidateQueries({ queryKey: ["categories"] }),
    ]);

    await Promise.all([
      qc.refetchQueries({ queryKey: ["parts"], type: "active" }),
      qc.refetchQueries({ queryKey: ["categories"], type: "active" }),
    ]);
  };

  return useMutation({
    mutationFn: async ({ name }: { name: string }) => {
      const result = await deleteCategory(name);
      if (!result.ok) throw result.error;
      return result.data;
    },
    onSuccess: async () => {
      showToast.success("Đã xóa danh mục");
      await refreshCategoryViews();
    },
    onError: (err: any) => {
      showToast.error(err?.message || "Lỗi xóa danh mục");
    },
  });
};
