import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchPaymentSources,
  updatePaymentSourceBalance,
} from "../lib/repository/paymentSourcesRepository";
import type { PaymentSource } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export const usePaymentSourcesRepo = () => {
  return useQuery({
    queryKey: ["paymentSourcesRepo"],
    queryFn: async () => {
      const res = await fetchPaymentSources();
      if (!res.ok) throw res.error;
      return res.data as PaymentSource[];
    },
  });
};

export const useUpdatePaymentSourceBalanceRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      branchId,
      delta,
    }: {
      id: string;
      branchId: string;
      delta: number;
    }) => updatePaymentSourceBalance(id, branchId, delta),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["paymentSourcesRepo"] });
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};
