import type { Employee } from "../types";

const INACTIVE_STATUSES = new Set(["inactive", "terminated", "deleted", "disabled"]);

export function isActiveEmployee(employee: Partial<Employee> | any): boolean {
  const status = String(employee?.status || "active").trim().toLowerCase();
  return !INACTIVE_STATUSES.has(status);
}

export function matchesEmployeeBranch(
  employee: Partial<Employee> | any,
  branchId?: string
): boolean {
  const employeeBranchId = String(
    employee?.branchId || employee?.branch_id || employee?.branchid || ""
  ).trim();
  const currentBranchId = String(branchId || "").trim();

  return !currentBranchId || !employeeBranchId || employeeBranchId === currentBranchId;
}

export function getSelectableEmployees<T extends Partial<Employee> | any>(
  employees: T[] = [],
  branchId?: string
): T[] {
  const activeEmployees = employees.filter(isActiveEmployee);
  const branchEmployees = activeEmployees.filter((employee) =>
    matchesEmployeeBranch(employee, branchId)
  );

  return branchEmployees.length > 0 ? branchEmployees : activeEmployees;
}
