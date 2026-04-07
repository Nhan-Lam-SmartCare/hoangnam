import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";

export interface QuickService {
  id: string;
  name: string;
  price: number;
  category: string;
  description?: string;
  icon: string;
  color: string;
  sort_order: number;
  is_active: boolean;
  branch_id?: string;
  created_at?: string;
  updated_at?: string;
}

// Fetch all active quick services
export function useQuickServices(branchId?: string) {
  return useQuery({
    queryKey: ["quickServices", branchId],
    queryFn: async () => {
      let query = supabase
        .from("quick_services")
        .select("*")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (branchId) {
        query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as QuickService[];
    },
  });
}

// Fetch all quick services (including inactive) for management
export function useAllQuickServices() {
  return useQuery({
    queryKey: ["quickServicesAll"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quick_services")
        .select("*")
        .order("sort_order", { ascending: true });

      if (error) throw error;
      return (data || []) as QuickService[];
    },
  });
}

// Create quick service
export function useCreateQuickService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (
      service: Omit<QuickService, "id" | "created_at" | "updated_at">
    ) => {
      const { data, error } = await supabase
        .from("quick_services")
        .insert(service)
        .select()
        .single();

      if (error) throw error;
      return data as QuickService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickServices"] });
      queryClient.invalidateQueries({ queryKey: ["quickServicesAll"] });
    },
  });
}

// Update quick service
export function useUpdateQuickService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      ...updates
    }: Partial<QuickService> & { id: string }) => {
      const { data, error } = await supabase
        .from("quick_services")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as QuickService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickServices"] });
      queryClient.invalidateQueries({ queryKey: ["quickServicesAll"] });
    },
  });
}

// Delete quick service
export function useDeleteQuickService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("quick_services")
        .delete()
        .eq("id", id);

      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickServices"] });
      queryClient.invalidateQueries({ queryKey: ["quickServicesAll"] });
    },
  });
}

// Toggle active status
export function useToggleQuickService() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      is_active,
    }: {
      id: string;
      is_active: boolean;
    }) => {
      const { data, error } = await supabase
        .from("quick_services")
        .update({ is_active, updated_at: new Date().toISOString() })
        .eq("id", id)
        .select()
        .single();

      if (error) throw error;
      return data as QuickService;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["quickServices"] });
      queryClient.invalidateQueries({ queryKey: ["quickServicesAll"] });
    },
  });
}
