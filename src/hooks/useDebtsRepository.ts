import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
    fetchCustomerDebts,
    createCustomerDebt,
    updateCustomerDebt,
    deleteCustomerDebt,
    fetchSupplierDebts,
    createSupplierDebt,
    updateSupplierDebt,
    deleteSupplierDebt,
} from "../lib/repository/debtsRepository";
import type { CustomerDebt, SupplierDebt } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

// CUSTOMER DEBTS

export const useCustomerDebtsRepo = () => {
    return useQuery({
        queryKey: ["customerDebts"],
        queryFn: async () => {
            const res = await fetchCustomerDebts();
            if (!res.ok) throw res.error;
            return res.data;
        },
    });
};

export const useCreateCustomerDebtRepo = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (
            debt: Omit<CustomerDebt, "id"> & { workOrderId?: string; saleId?: string }
        ) => {
            const res = await createCustomerDebt(debt);
            if (!res.ok) throw res.error;
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["customerDebts"] });
            // Invalidate dashboard or analytics if needed
        },
        onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
    });
};

export const useUpdateCustomerDebtRepo = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            updates,
        }: {
            id: string;
            updates: Partial<CustomerDebt>;
        }) => {
            const res = await updateCustomerDebt(id, updates);
            if (!res.ok) throw res.error;
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["customerDebts"] });
            showToast.success("Đã cập nhật công nợ khách hàng");
        },
        onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
    });
};

export const useDeleteCustomerDebtRepo = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await deleteCustomerDebt(id);
            if (!res.ok) throw res.error;
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["customerDebts"] });
            showToast.success("Đã xóa công nợ khách hàng");
        },
        onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
    });
};

// SUPPLIER DEBTS

export const useSupplierDebtsRepo = () => {
    return useQuery({
        queryKey: ["supplierDebts"],
        queryFn: async () => {
            const res = await fetchSupplierDebts();
            if (!res.ok) throw res.error;
            return res.data;
        },
    });
};

export const useCreateSupplierDebtRepo = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (debt: Omit<SupplierDebt, "id">) => {
            const res = await createSupplierDebt(debt);
            if (!res.ok) throw res.error;
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["supplierDebts"] });
        },
        onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
    });
};

export const useUpdateSupplierDebtRepo = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({
            id,
            updates,
        }: {
            id: string;
            updates: Partial<SupplierDebt>;
        }) => {
            const res = await updateSupplierDebt(id, updates);
            if (!res.ok) throw res.error;
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["supplierDebts"] });
            showToast.success("Đã cập nhật công nợ nhà cung cấp");
        },
        onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
    });
};

export const useDeleteSupplierDebtRepo = () => {
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async (id: string) => {
            const res = await deleteSupplierDebt(id);
            if (!res.ok) throw res.error;
            return res.data;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ["supplierDebts"] });
            showToast.success("Đã xóa công nợ nhà cung cấp");
        },
        onError: (err: any) => showToast.error(mapRepoErrorForUser(err)),
    });
};
