import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchInventoryTransactions,
  createInventoryTransaction,
  useCreateReceiptAtomicRepo,
  type CreateInventoryTxInput,
} from "../lib/repository/inventoryTransactionsRepository";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export const useInventoryTxRepo = (params?: {
  branchId?: string;
  limit?: number;
  startDate?: string;
  endDate?: string;
}) => {
  return useQuery({
    queryKey: ["inventoryTxRepo", params],
    retry: false,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      const res = await fetchInventoryTransactions(params);
      if (!res.ok) throw res.error;
      return res.data;
    },
  });
};

export const useCreateInventoryTxRepo = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CreateInventoryTxInput) => {
      console.log("🔥 Đang gọi createInventoryTransaction với input:", input);
      const result = await createInventoryTransaction(input);
      console.log("🔥 Kết quả createInventoryTransaction:", result);
      if (!result.ok) {
        throw result.error || new Error("Lỗi không xác định");
      }
      return result.data;
    },
    onSuccess: () => {
      console.log("✅ Lưu lịch sử thành công!");
      qc.invalidateQueries({ queryKey: ["inventoryTxRepo"] });
      showToast.success("Đã ghi lịch sử kho");
    },
    onError: (err: any) => {
      console.error("❌ Lỗi lưu lịch sử:", err);
      showToast.error(mapRepoErrorForUser(err));
    },
  });
};

// Re-export the atomic receipt hook
export { useCreateReceiptAtomicRepo };
