import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../lib/repository/suppliersRepository";
import type { Supplier } from "../types";
import { showToast } from "../utils/toast";

export const useSuppliers = () =>
  useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const res = await fetchSuppliers();
      if (!res.ok) throw res.error;
      return res.data;
    },
  });

export const useCreateSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Supplier>) => {
      const res = await createSupplier(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      showToast.success("Đã thêm nhà cung cấp");
    },
    onError: (e: any) => showToast.error(e?.message || "Lỗi thêm nhà cung cấp"),
  });
};

export const useUpdateSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Supplier>;
    }) => {
      const res = await updateSupplier(id, updates);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      showToast.success("Đã cập nhật nhà cung cấp");
    },
  });
};

export const useDeleteSupplier = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await deleteSupplier(id);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["suppliers"] });
      showToast.success("Đã xóa nhà cung cấp");
    },
  });
};
