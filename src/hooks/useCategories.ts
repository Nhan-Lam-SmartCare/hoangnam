import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchCategories,
  createCategory,
  updateCategory,
  deleteCategoryRecord,
} from "../lib/repository/categoriesRepository";
import type { Category } from "../types";
import { showToast } from "../utils/toast";
import { getCategoryPricingRule, setCategoryPricingRule } from "../utils/categoryPricingRules";

export const useCategories = () => {
  return useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const res = await fetchCategories();
      if (!res.ok) throw res.error;

      // Đồng bộ quy tắc giá từ Supabase xuống localStorage
      const fetchedCategories = res.data;
      if (Array.isArray(fetchedCategories)) {
        fetchedCategories.forEach((cat) => {
          if (cat.name) {
            const currentRule = getCategoryPricingRule(cat.name);
            setCategoryPricingRule(cat.name, {
              markupPercent: cat.markup_percent !== undefined && cat.markup_percent !== null ? cat.markup_percent : currentRule.markupPercent,
              roundingRule: (cat.rounding_rule || currentRule.roundingRule) as any,
            });
          }
        });
      }

      // Khử trùng lặp danh mục không phân biệt hoa/thường (Case-insensitive deduplication)
      const seen = new Set<string>();
      const uniqueCategories: typeof fetchedCategories = [];
      if (Array.isArray(fetchedCategories)) {
        for (const cat of fetchedCategories) {
          if (!cat.name || !cat.name.trim()) continue;
          const key = cat.name.trim().toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueCategories.push({
              ...cat,
              name: cat.name.trim(),
            });
          }
        }
      }

      return uniqueCategories;
    },
  });
};

export const useCreateCategory = () => {
  const qc = useQueryClient();

  const refreshCategoryViews = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["parts"] }),
    ]);

    await Promise.all([
      qc.refetchQueries({ queryKey: ["categories"], type: "active" }),
      qc.refetchQueries({ queryKey: ["parts"], type: "active" }),
    ]);
  };

  return useMutation({
    mutationFn: async (input: Partial<Category>) => {
      const res = await createCategory(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: async () => {
      await refreshCategoryViews();
      showToast.success("Đã tạo danh mục");
    },
    onError: (err: any) => showToast.error(err?.message || "Lỗi tạo danh mục"),
  });
};

export const useUpdateCategory = () => {
  const qc = useQueryClient();

  const refreshCategoryViews = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["parts"] }),
    ]);

    await Promise.all([
      qc.refetchQueries({ queryKey: ["categories"], type: "active" }),
      qc.refetchQueries({ queryKey: ["parts"], type: "active" }),
    ]);
  };

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
    onSuccess: async () => {
      await refreshCategoryViews();
      showToast.success("Đã cập nhật danh mục");
    },
    onError: (err: any) =>
      showToast.error(err?.message || "Lỗi cập nhật danh mục"),
  });
};

export const useDeleteCategoryRecord = () => {
  const qc = useQueryClient();

  const refreshCategoryViews = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["categories"] }),
      qc.invalidateQueries({ queryKey: ["parts"] }),
    ]);

    await Promise.all([
      qc.refetchQueries({ queryKey: ["categories"], type: "active" }),
      qc.refetchQueries({ queryKey: ["parts"], type: "active" }),
    ]);
  };

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await deleteCategoryRecord(id);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: async () => {
      await refreshCategoryViews();
      showToast.success("Đã xóa danh mục");
    },
    onError: (err: any) => showToast.error(err?.message || "Lỗi xóa danh mục"),
  });
};
