import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabaseHelpers } from "../lib/supabase";
// Note: supabaseHelpers internally used its own supabase client. To avoid multiple GoTrue instances,
// we refactor supabaseHelpers to consume the unified client from supabaseClient.
import type { Customer, Part, WorkOrder, Sale, PaymentSource } from "../types";

// Customers hooks
export const useCustomers = () => {
  return useQuery({
    queryKey: ["customers"],
    queryFn: supabaseHelpers.getCustomers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createCustomer,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const useCreateCustomersBulk = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createCustomersBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const useUpdateCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Customer> }) =>
      supabaseHelpers.updateCustomer(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

export const useDeleteCustomer = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => supabaseHelpers.deleteCustomer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["customers"] });
    },
  });
};

// Suppliers hooks
export const useSuppliers = () => {
  return useQuery({
    queryKey: ["suppliers"],
    queryFn: supabaseHelpers.getSuppliers,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createSupplier,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
};

export const useCreateSuppliersBulk = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createSuppliersBulk,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
};

export const useUpdateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Customer> }) =>
      supabaseHelpers.updateSupplier(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
    },
  });
};

// Parts hooks
export const useParts = () => {
  return useQuery({
    queryKey: ["parts"],
    queryFn: supabaseHelpers.getParts,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
  });
};

export const useCreatePart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createPart,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
  });
};

export const useUpdatePart = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, updates }: { id: string; updates: Partial<Part> }) =>
      supabaseHelpers.updatePart(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
  });
};

// Work Orders hooks
export const useWorkOrders = () => {
  return useQuery({
    queryKey: ["workOrders"],
    queryFn: supabaseHelpers.getWorkOrders,
    staleTime: 2 * 60 * 1000, // 2 minutes (fresher for work orders)
    gcTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useCreateWorkOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createWorkOrder,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
    },
  });
};

export const useUpdateWorkOrder = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<WorkOrder>;
    }) => supabaseHelpers.updateWorkOrder(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workOrders"] });
      queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
    },
  });
};

// Sales hooks
export const useSales = () => {
  return useQuery({
    queryKey: ["sales"],
    queryFn: supabaseHelpers.getSales,
    staleTime: 3 * 60 * 1000, // 3 minutes
    gcTime: 8 * 60 * 1000, // 8 minutes
  });
};

export const useCreateSale = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createSale,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
      queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
    },
  });
};

// Cash Transactions hooks
export const useCashTransactions = () => {
  return useQuery({
    queryKey: ["cashTransactions"],
    queryFn: supabaseHelpers.getCashTransactions,
  });
};

export const useCreateCashTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createCashTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cashTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
    },
  });
};

// Payment Sources hooks
export const usePaymentSources = () => {
  return useQuery({
    queryKey: ["paymentSources"],
    queryFn: supabaseHelpers.getPaymentSources,
  });
};

export const useUpdatePaymentSource = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<PaymentSource>;
    }) => supabaseHelpers.updatePaymentSource(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["paymentSources"] });
    },
  });
};

// Inventory Transactions hooks
export const useInventoryTransactions = () => {
  return useQuery({
    queryKey: ["inventoryTransactions"],
    queryFn: supabaseHelpers.getInventoryTransactions,
  });
};

export const useCreateInventoryTransaction = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: supabaseHelpers.createInventoryTransaction,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["inventoryTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["parts"] });
    },
  });
};
