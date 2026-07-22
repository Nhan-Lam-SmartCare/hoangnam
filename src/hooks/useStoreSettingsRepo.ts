import { useQuery } from "@tanstack/react-query";
import { fetchStoreSettingsForBranch } from "../lib/repository/storeSettingsRepository";

export function useStoreSettingsRepo(branchId?: string) {
  return useQuery({
    queryKey: ["storeSettingsRepo", branchId],
    queryFn: async () => {
      const res = await fetchStoreSettingsForBranch(branchId);
      if (!res.ok) throw res.error;
      return res.data;
    },
  });
}
