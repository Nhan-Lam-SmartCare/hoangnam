import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchParts,
  fetchPartsPaged,
  createPart,
  updatePart,
  deletePartById,
} from "../lib/repository/partsRepository";
import type { Part } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export const usePartsRepo = () => {
  return useQuery({
    queryKey: ["partsRepo"],
    queryFn: async () => {
      const res = await fetchParts();
      if (!res.ok) throw res.error;
      return res.data;
    },
  });
};

// New: paged repo hook with filters
export const usePartsRepoPaged = (params: {
  page: number;
  pageSize: number;
  search?: string;
  category?: string;
}) => {
  return useQuery({
    queryKey: [
      "partsRepoPaged",
      params.page,
      params.pageSize,
      params.search || "",
      params.category || "all",
    ],
    queryFn: async () => {
      const res = await fetchPartsPaged(params);
      if (!res.ok) throw res.error;
      return res;
    },
    staleTime: 30_000,
  });
};

export const useCreatePartRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Part>) => {
      const result = await createPart(input);
      if (!result.ok) {
        throw result.error;
      }
      return result.data; // Return unwrapped data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partsRepo"] });
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] });
      qc.invalidateQueries({ queryKey: ["allPartsForTotals"] });
      // Toast is handled by component to avoid spam during bulk operations
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useUpdatePartRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Part> }) =>
      updatePart(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partsRepo"] });
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] });
      qc.invalidateQueries({ queryKey: ["allPartsForTotals"] });
      // Toast is handled by component
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useDeletePartRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => deletePartById(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["partsRepo"] });
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] });
      qc.invalidateQueries({ queryKey: ["allPartsForTotals"] });
      // Toast is handled by component
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};
