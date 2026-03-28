/**
 * useRepairTemplatesRepository.ts
 * Hook quản lý mẫu sửa chữa từ Supabase
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../supabaseClient";
import { useAuth } from "../contexts/AuthContext";
import { showToast } from "../utils/toast";

// Types
export interface RepairTemplatePart {
  name: string;
  quantity: number;
  price: number;
  unit: string;
}

export interface RepairTemplate {
  id: string;
  branch_id: string | null;
  name: string;
  description: string | null;
  duration: number;
  labor_cost: number;
  parts: RepairTemplatePart[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface CreateRepairTemplateInput {
  name: string;
  description?: string;
  duration?: number;
  labor_cost?: number;
  parts?: RepairTemplatePart[];
  is_active?: boolean;
}

export interface UpdateRepairTemplateInput {
  name?: string;
  description?: string;
  duration?: number;
  labor_cost?: number;
  parts?: RepairTemplatePart[];
  is_active?: boolean;
}

const QUERY_KEY = "repair_templates";

/**
 * Hook lấy danh sách mẫu sửa chữa
 */
export function useRepairTemplates() {
  const { profile } = useAuth();
  const branchId = profile?.branch_id;

  return useQuery({
    queryKey: [QUERY_KEY, branchId],
    queryFn: async () => {
      // Only query with branch_id if it looks like a UUID (contains dashes)
      // Otherwise just get templates without branch_id filter
      const isUUID = branchId && branchId.includes("-");

      let query = supabase
        .from("repair_templates")
        .select("*")
        .eq("is_active", true)
        .order("name", { ascending: true });

      if (isUUID) {
        query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
      } else {
        // Non-UUID branch_id (like "CN1") - just get global templates
        query = query.is("branch_id", null);
      }

      const { data, error } = await query;

      if (error) {
        // Suppress missing table error
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn("Repair templates table missing, returning empty array.");
          return [] as RepairTemplate[];
        }
        console.error("Error fetching repair templates:", error);
        throw error;
      }

      return (data || []) as RepairTemplate[];
    },
    enabled: !!profile,
    staleTime: 5 * 60 * 1000, // 5 phút
  });
}

/**
 * Hook lấy tất cả mẫu (kể cả inactive) cho admin
 */
export function useAllRepairTemplates() {
  const { profile } = useAuth();
  const branchId = profile?.branch_id;

  return useQuery({
    queryKey: [QUERY_KEY, "all", branchId],
    queryFn: async () => {
      // Only query with branch_id if it looks like a UUID (contains dashes)
      const isUUID = branchId && branchId.includes("-");

      let query = supabase
        .from("repair_templates")
        .select("*")
        .order("name", { ascending: true });

      if (isUUID) {
        query = query.or(`branch_id.is.null,branch_id.eq.${branchId}`);
      } else {
        // Non-UUID branch_id (like "CN1") - just get global templates
        query = query.is("branch_id", null);
      }

      const { data, error } = await query;

      if (error) {
        // Suppress missing table error
        if (error.code === 'PGRST205' || error.message?.includes('does not exist')) {
          console.warn("Repair templates table missing, returning empty array.");
          return [] as RepairTemplate[];
        }
        console.error("Error fetching all repair templates:", error);
        throw error;
      }

      return (data || []) as RepairTemplate[];
    },
    enabled: !!profile,
  });
}

/**
 * Hook tạo mẫu sửa chữa mới
 */
export function useCreateRepairTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (input: CreateRepairTemplateInput) => {
      const { data, error } = await supabase
        .from("repair_templates")
        .insert({
          branch_id: profile?.branch_id,
          name: input.name,
          description: input.description || null,
          duration: input.duration || 30,
          labor_cost: input.labor_cost || 0,
          parts: input.parts || [],
          is_active: input.is_active !== false,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error creating repair template:", error);
        throw error;
      }

      return data as RepairTemplate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      showToast.success(`Đã tạo mẫu "${data.name}"`);
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi tạo mẫu: ${error.message}`);
    },
  });
}

/**
 * Hook cập nhật mẫu sửa chữa
 */
export function useUpdateRepairTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: UpdateRepairTemplateInput;
    }) => {
      const { data, error } = await supabase
        .from("repair_templates")
        .update({
          name: updates.name,
          description: updates.description,
          duration: updates.duration,
          labor_cost: updates.labor_cost,
          parts: updates.parts,
          is_active: updates.is_active,
        })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error updating repair template:", error);
        throw error;
      }

      return data as RepairTemplate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      showToast.success(`Đã cập nhật mẫu "${data.name}"`);
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi cập nhật: ${error.message}`);
    },
  });
}

/**
 * Hook xóa mẫu sửa chữa (soft delete - set is_active = false)
 */
export function useDeleteRepairTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // Soft delete
      const { error } = await supabase
        .from("repair_templates")
        .update({ is_active: false })
        .eq("id", id);

      if (error) {
        console.error("Error deleting repair template:", error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      showToast.success("Đã xóa mẫu sửa chữa");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi xóa mẫu: ${error.message}`);
    },
  });
}

/**
 * Hook xóa vĩnh viễn (hard delete) - chỉ dành cho admin
 */
export function useHardDeleteRepairTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("repair_templates")
        .delete()
        .eq("id", id);

      if (error) {
        console.error("Error hard deleting repair template:", error);
        throw error;
      }

      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      showToast.success("Đã xóa vĩnh viễn mẫu sửa chữa");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi xóa mẫu: ${error.message}`);
    },
  });
}

/**
 * Hook khôi phục mẫu đã xóa
 */
export function useRestoreRepairTemplate() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from("repair_templates")
        .update({ is_active: true })
        .eq("id", id)
        .select()
        .single();

      if (error) {
        console.error("Error restoring repair template:", error);
        throw error;
      }

      return data as RepairTemplate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      showToast.success(`Đã khôi phục mẫu "${data.name}"`);
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi khôi phục: ${error.message}`);
    },
  });
}

/**
 * Hook duplicate mẫu
 */
export function useDuplicateRepairTemplate() {
  const queryClient = useQueryClient();
  const { profile } = useAuth();

  return useMutation({
    mutationFn: async (template: RepairTemplate) => {
      const { data, error } = await supabase
        .from("repair_templates")
        .insert({
          branch_id: profile?.branch_id,
          name: `${template.name} (copy)`,
          description: template.description,
          duration: template.duration,
          labor_cost: template.labor_cost,
          parts: template.parts,
          is_active: true,
          created_by: profile?.id,
        })
        .select()
        .single();

      if (error) {
        console.error("Error duplicating repair template:", error);
        throw error;
      }

      return data as RepairTemplate;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      showToast.success(`Đã nhân bản mẫu "${data.name}"`);
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi nhân bản: ${error.message}`);
    },
  });
}
