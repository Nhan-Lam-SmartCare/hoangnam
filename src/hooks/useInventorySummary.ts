import { useQuery } from "@tanstack/react-query";
import { fetchInventorySummary } from "../lib/repository/inventorySummaryRepository";

export const useInventorySummary = (branchId?: string) => {
  return useQuery({
    queryKey: ["inventorySummary", branchId || "all"],
    queryFn: async () => {
      const res = await fetchInventorySummary({ branchId });
      if (!res.ok) throw res.error;
      return res.data;
    },
    staleTime: 30_000,
  });
};
