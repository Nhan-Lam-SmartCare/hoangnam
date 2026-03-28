import { supabase } from "../../supabaseClient";
import type { Employee } from "../../types";
import { RepoResult, success, failure } from "./types";

const EMPLOYEES_TABLE = "employees";

export async function fetchEmployees(): Promise<RepoResult<Employee[]>> {
  try {
    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .select("*")
      .order("created_at", { ascending: false });

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể tải danh sách nhân viên",
        cause: error,
      });

    // Convert snake_case to camelCase
    const employees = (data || []).map((row: any) => ({
      id: row.id,
      name: row.name,
      phone: row.phone,
      email: row.email,
      position: row.position,
      department: row.department,
      baseSalary: row.base_salary,
      allowances: row.allowances,
      startDate: row.start_date,
      status: row.status,
      bankAccount: row.bank_account,
      bankName: row.bank_name,
      taxCode: row.tax_code,
      branchId: row.branch_id,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));

    return success(employees as Employee[]);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối tới máy chủ",
      cause: e,
    });
  }
}

export async function createEmployee(
  employee: Omit<Employee, "id" | "created_at" | "updated_at">
): Promise<RepoResult<Employee>> {
  try {
    console.log("Creating employee with data:", employee);

    // Get current branch
    const { data: branchData, error: branchError } = await supabase.rpc(
      "mc_current_branch"
    );
    console.log("Branch data:", branchData, "Branch error:", branchError);

    const branchId = branchData || "CN1";

    const newEmployee = {
      id: `EMP-${Date.now()}`,
      name: employee.name,
      phone: employee.phone,
      email: employee.email,
      position: employee.position,
      department: employee.department,
      base_salary: employee.baseSalary,
      allowances: employee.allowances || 0,
      start_date: employee.startDate,
      status: employee.status || "active",
      bank_account: employee.bankAccount,
      bank_name: employee.bankName,
      tax_code: employee.taxCode,
      branch_id: branchId,
    };

    console.log("Inserting employee:", newEmployee);

    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .insert(newEmployee)
      .select()
      .single();

    console.log("Insert result - data:", data, "error:", error);

    if (error || !data) {
      console.error("Insert failed - error:", error, "data:", data);
      return failure({
        code: "supabase",
        message: error?.message || "Không thể thêm nhân viên",
        cause: error || new Error("No data returned from insert"),
      });
    }

    // Convert back to camelCase
    const result = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      position: data.position,
      department: data.department,
      baseSalary: data.base_salary,
      allowances: data.allowances,
      startDate: data.start_date,
      status: data.status,
      bankAccount: data.bank_account,
      bankName: data.bank_name,
      taxCode: data.tax_code,
      branchId: data.branch_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return success(result as Employee);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi thêm nhân viên",
      cause: e,
    });
  }
}

export async function updateEmployee(
  id: string,
  updates: Partial<Employee>
): Promise<RepoResult<Employee>> {
  try {
    const updateData: any = {};
    if (updates.name !== undefined) updateData.name = updates.name;
    if (updates.phone !== undefined) updateData.phone = updates.phone;
    if (updates.email !== undefined) updateData.email = updates.email;
    if (updates.position !== undefined) updateData.position = updates.position;
    if (updates.department !== undefined)
      updateData.department = updates.department;
    if (updates.baseSalary !== undefined)
      updateData.base_salary = updates.baseSalary;
    if (updates.allowances !== undefined)
      updateData.allowances = updates.allowances;
    if (updates.startDate !== undefined)
      updateData.start_date = updates.startDate;
    if (updates.status !== undefined) updateData.status = updates.status;
    if (updates.bankAccount !== undefined)
      updateData.bank_account = updates.bankAccount;
    if (updates.bankName !== undefined) updateData.bank_name = updates.bankName;
    if (updates.taxCode !== undefined) updateData.tax_code = updates.taxCode;

    updateData.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from(EMPLOYEES_TABLE)
      .update(updateData)
      .eq("id", id)
      .select()
      .single();

    if (error || !data)
      return failure({
        code: "supabase",
        message: "Không thể cập nhật nhân viên",
        cause: error,
      });

    const result = {
      id: data.id,
      name: data.name,
      phone: data.phone,
      email: data.email,
      position: data.position,
      department: data.department,
      baseSalary: data.base_salary,
      allowances: data.allowances,
      startDate: data.start_date,
      status: data.status,
      bankAccount: data.bank_account,
      bankName: data.bank_name,
      taxCode: data.tax_code,
      branchId: data.branch_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
    };

    return success(result as Employee);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi cập nhật nhân viên",
      cause: e,
    });
  }
}

export async function deleteEmployee(id: string): Promise<RepoResult<void>> {
  try {
    const { error } = await supabase
      .from(EMPLOYEES_TABLE)
      .delete()
      .eq("id", id);

    if (error)
      return failure({
        code: "supabase",
        message: "Không thể xóa nhân viên",
        cause: error,
      });

    return success(undefined);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi xóa nhân viên",
      cause: e,
    });
  }
}
