import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  fetchRepairOrderServices,
  fetchServiceConfigs,
  getWorkerMonthlySalary,
  recalculateRepairOrderLaborTotals,
  syncRepairOrderServices,
  type RepairOrderServiceInput,
} from "../lib/repository/repairLaborRepository";
import type { RepoResult } from "../lib/repository/types";

function unwrapRepoResult<T>(result: RepoResult<T>): T {
  if (result.ok) {
    return result.data;
  }

  throw (result as { error: unknown }).error;
}

export function useServiceConfigs() {
  return useQuery({
    queryKey: ["serviceConfigs"],
    queryFn: async () => {
      return unwrapRepoResult(await fetchServiceConfigs());
    },
    staleTime: 60_000,
  });
}

export function useRepairOrderServices(repairOrderId?: string) {
  return useQuery({
    queryKey: ["repairOrderServices", repairOrderId],
    enabled: Boolean(repairOrderId),
    queryFn: async () => {
      return unwrapRepoResult(await fetchRepairOrderServices(repairOrderId as string));
    },
  });
}

export function useSyncRepairOrderServices() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      repairOrderId,
      services,
    }: {
      repairOrderId: string;
      services: RepairOrderServiceInput[];
    }) => unwrapRepoResult(await syncRepairOrderServices(repairOrderId, services)),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["repairOrderServices", variables.repairOrderId] });
      queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      queryClient.invalidateQueries({ queryKey: ["workOrdersFiltered"] });
    },
  });
}

export function useRecalculateRepairOrderLaborTotals() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (repairOrderId: string) =>
      unwrapRepoResult(await recalculateRepairOrderLaborTotals(repairOrderId)),
    onSuccess: (_, repairOrderId) => {
      queryClient.invalidateQueries({ queryKey: ["repairOrderServices", repairOrderId] });
      queryClient.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      queryClient.invalidateQueries({ queryKey: ["workOrdersFiltered"] });
    },
  });
}

export function useWorkerMonthlySalary(workerId?: string, month?: number, year?: number) {
  return useQuery({
    queryKey: ["workerMonthlySalary", workerId, month, year],
    enabled: Boolean(workerId && month && year),
    queryFn: async () => {
      return unwrapRepoResult(
        await getWorkerMonthlySalary(workerId as string, month as number, year as number)
      );
    },
  });
}
