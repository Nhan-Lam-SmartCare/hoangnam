import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchWorkOrders,
  fetchWorkOrdersFiltered,
  createWorkOrderAtomic,
  updateWorkOrderAtomic,
  updateWorkOrder,
  deleteWorkOrder,
  refundWorkOrder,
} from "../lib/repository/workOrdersRepository";
import type { WorkOrder } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export const useWorkOrdersRepo = () => {
  return useQuery({
    queryKey: ["workOrdersRepo"],
    queryFn: async () => {
      const res = await fetchWorkOrders();
      if (!res.ok) throw res.error;
      return res.data;
    },
    staleTime: 30000, // Cache for 30 seconds
    gcTime: 5 * 60 * 1000, // Keep in cache for 5 minutes
  });
};

// New hook with pagination and filtering
export const useWorkOrdersFilteredRepo = (options?: {
  limit?: number;
  daysBack?: number;
  status?: string;
  branchId?: string;
}) => {
  return useQuery({
    queryKey: ["workOrdersFiltered", options],
    queryFn: async () => {
      const res = await fetchWorkOrdersFiltered(options);
      if (!res.ok) throw res.error;
      return res.data;
    },
    staleTime: 30000, // Cache for 30 seconds
  });
};

export const useCreateWorkOrderAtomicRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkOrder>) => {
      const res = await createWorkOrderAtomic(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] }); // Invalidate filtered queries
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Refresh parts for stock update
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Refresh parts for stock update
      qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Update inventory history
      qc.invalidateQueries({ queryKey: ["cashTransactions"] });
      qc.invalidateQueries({ queryKey: ["paymentSources"] });
      showToast.success("Đã tạo phiếu sửa chữa (atomic)");
      if (data?.inventoryTxCount) {
        showToast.info(`Xuất kho: ${data.inventoryTxCount} phụ tùng`);
      }
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useUpdateWorkOrderAtomicRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<WorkOrder>) => {
      const res = await updateWorkOrderAtomic(input);
      if (!res.ok) throw res.error;
      return res.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] }); // Invalidate filtered queries
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Refresh parts for stock update
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Refresh parts for stock update
      qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Update inventory history
      qc.invalidateQueries({ queryKey: ["cashTransactions"] });
      qc.invalidateQueries({ queryKey: ["paymentSources"] });
      showToast.success("Đã cập nhật lệnh sửa chữa");
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useUpdateWorkOrderRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<WorkOrder>;
    }) => updateWorkOrder(id, updates),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] }); // Invalidate filtered queries
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Update stock if needed
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Update stock if needed
      showToast.success("Đã cập nhật phiếu sửa chữa");
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useDeleteWorkOrderRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id }: { id: string }) => deleteWorkOrder(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] }); // Invalidate filtered queries
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Update stock if needed
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Update stock if needed
      qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Update inventory history
      qc.invalidateQueries({ queryKey: ["cashTransactions"] });
      qc.invalidateQueries({ queryKey: ["paymentSources"] });
      showToast.success("Đã hủy lệnh sửa chữa");
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};

export const useRefundWorkOrderRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      orderId,
      refundReason,
    }: {
      orderId: string;
      refundReason: string;
    }) => refundWorkOrder(orderId, refundReason),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["workOrdersRepo"] });
      qc.invalidateQueries({ queryKey: ["workOrdersFiltered"] }); // Invalidate filtered queries
      qc.invalidateQueries({ queryKey: ["partsRepo"] }); // Refresh for restored stock
      qc.invalidateQueries({ queryKey: ["partsRepoPaged"] }); // Refresh for restored stock
      qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] }); // Update inventory history
      qc.invalidateQueries({ queryKey: ["cashTransactions"] });
      qc.invalidateQueries({ queryKey: ["paymentSources"] });
      showToast.success("Đã hoàn tiền phiếu sửa chữa");
      if (result.ok && (result.data as any).refundAmount) {
        showToast.info(
          `Hoàn tiền: ${new Intl.NumberFormat("vi-VN").format(
            (result.data as any).refundAmount
          )}đ`
        );
      }
    },
    onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
  });
};
