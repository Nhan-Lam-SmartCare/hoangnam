import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPawnRecords,
  createPawnRecord,
  updatePawnRecord,
  deletePawnRecord,
} from "../lib/repository/pawnRepository";
import type { PawnRecord } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export function usePawnRecordsRepo(branchId?: string) {
  return useQuery({
    queryKey: ["pawnRecords", branchId],
    queryFn: async () => {
      const result = await fetchPawnRecords(branchId);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
  });
}

export function useCreatePawnRecordRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (record: Omit<PawnRecord, "created_at" | "updated_at">) => {
      const result = await createPawnRecord(record);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pawnRecords"] });
      showToast.success("Tạo hợp đồng cầm đồ thành công!");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi: ${error.message}`);
    },
  });
}

export function useUpdatePawnRecordRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<PawnRecord> }) => {
      const result = await updatePawnRecord(id, updates);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pawnRecords"] });
      showToast.success("Cập nhật hợp đồng cầm đồ thành công!");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi: ${error.message}`);
    },
  });
}

export function useDeletePawnRecordRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deletePawnRecord(id);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pawnRecords"] });
      showToast.success("Xóa hợp đồng cầm đồ thành công!");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi: ${error.message}`);
    },
  });
}
