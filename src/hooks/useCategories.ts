import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategoryRecord,
} from "../lib/repository/categoriesRepository";
import type { Category } from "../types";
import { showToast } from "../utils/toast";

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetchCategories();
      if (!res.ok) throw res.error;
      return res.data;
    },
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Category>) => {
      const res = await createCategory(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      showToast.success("Đã tạo danh mục");
    },
    onError: (err: any) => showToast.error(err?.message || "Lỗi tạo danh mục"),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Category>;
    }) => {
      const res = await updateCategory(id, updates);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      showToast.success("Đã cập nhật danh mục");
    },
    onError: (err: any) =>
      showToast.error(err?.message || "Lỗi cập nhật danh mục"),
  });
};

export const useDeleteCategoryRecord = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await deleteCategoryRecord(id);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["categories"] });
      showToast.success("Đã xóa danh mục");
    },
    onError: (err: any) => showToast.error(err?.message || "Lỗi xóa danh mục"),
  });
};
