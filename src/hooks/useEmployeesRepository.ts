import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  fetchEmployees,
  createEmployee,
  updateEmployee,
  deleteEmployee,
} from "../lib/repository/employeesRepository";
import type { Employee } from "../types";
import { showToast } from "../utils/toast";
import { mapRepoErrorForUser } from "../utils/errorMapping";

export function useEmployeesRepo() {
  return useQuery({
    queryKey: ["employees"],
    queryFn: async () => {
      const result = await fetchEmployees();
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
  });
}

export function useCreateEmployeeRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      employee: Omit<Employee, "id" | "created_at" | "updated_at">
    ) => {
      console.log("Mutation called with employee:", employee);
      const result = await createEmployee(employee);
      console.log("Repository result:", result);

      if (!result.ok) {
        console.error("Repository failed:", result.error);
        const errorMsg = result.error
          ? mapRepoErrorForUser(result.error)
          : "Không thể thêm nhân viên. Vui lòng thử lại.";
        throw new Error(errorMsg);
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast.success("Thêm nhân viên thành công!");
    },
    onError: (error: any) => {
      const message = error?.message || "Có lỗi xảy ra khi thêm nhân viên";
      showToast.error(message);
      console.error("Create employee error:", error);
    },
  });
}

export function useUpdateEmployeeRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      updates,
    }: {
      id: string;
      updates: Partial<Employee>;
    }) => {
      const result = await updateEmployee(id, updates);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast.success("Cập nhật nhân viên thành công!");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi: ${error.message}`);
    },
  });
}

export function useDeleteEmployeeRepo() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const result = await deleteEmployee(id);
      if (!result.ok) {
        throw new Error(mapRepoErrorForUser(result.error));
      }
      return result.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      showToast.success("Xóa nhân viên thành công!");
    },
    onError: (error: Error) => {
      showToast.error(`Lỗi: ${error.message}`);
    },
  });
}
