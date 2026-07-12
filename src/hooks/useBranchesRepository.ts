import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchBranches,
  upsertBranch,
  type BranchRecord,
} from "../lib/repository/branchesRepository";
import { mapRepoErrorForUser } from "../utils/errorMapping";
import { showToast } from "../utils/toast";

export function useBranchesRepo() {
  return useQuery({
    queryKey: ["branches"],
    queryFn: async () => {
      const result = await fetchBranches();
      if (!result.ok) throw new Error(mapRepoErrorForUser(result.error));
      return result.data;
    },
  });
}

export function useUpsertBranchRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (branch: Pick<BranchRecord, "id" | "name"> & Partial<BranchRecord>) => {
      const result = await upsertBranch(branch);
      if (!result.ok) throw new Error(mapRepoErrorForUser(result.error));
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["branches"] });
      showToast.success("Đã lưu chi nhánh");
    },
    onError: (error: Error) => {
      showToast.error(error.message || "Không thể lưu chi nhánh");
    },
  });
}
