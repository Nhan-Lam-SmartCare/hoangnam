import { supabase } from "../../supabaseClient";
import type { PayrollRecord } from "../../types";
import { RepoResult, success, failure } from "./types";

const TABLE = "payroll_records";

/** Nhận diện lỗi "bảng chưa tồn tại" (schema chưa migrate) để caller tắt tính năng payroll. */
export function isMissingPayrollTableError(error: any): boolean {
  const details = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
  return (
    error?.status === 404 ||
    error?.code === "PGRST205" ||
    details.includes("does not exist") ||
    details.includes("could not find")
  );
}

/** Map row DB (snake_case) -> PayrollRecord (camelCase). */
function mapPayrollRow(r: any): PayrollRecord {
  return {
    id: r.id,
    employeeId: r.employee_id,
    employeeName: r.employee_name,
    month: r.month,
    baseSalary: r.base_salary,
    allowances: r.allowances,
    bonus: r.bonus,
    deduction: r.deduction,
    workDays: r.work_days,
    standardWorkDays: r.standard_work_days,
    socialInsurance: r.social_insurance,
    healthInsurance: r.health_insurance,
    unemploymentInsurance: r.unemployment_insurance,
    personalIncomeTax: r.personal_income_tax,
    netSalary: r.net_salary,
    paymentStatus: r.payment_status,
    paymentDate: r.payment_date,
    paymentMethod: r.payment_method,
    notes: r.notes,
    branchId: r.branch_id,
    created_at: r.created_at,
  } as PayrollRecord;
}

/** Map PayrollRecord (camelCase) -> row DB (snake_case). */
function mapPayrollToDb(record: PayrollRecord): Record<string, any> {
  return {
    id: record.id,
    employee_id: record.employeeId,
    employee_name: record.employeeName,
    month: record.month,
    base_salary: record.baseSalary,
    allowances: record.allowances,
    bonus: record.bonus,
    deduction: record.deduction,
    work_days: record.workDays,
    standard_work_days: record.standardWorkDays,
    social_insurance: record.socialInsurance,
    health_insurance: record.healthInsurance,
    unemployment_insurance: record.unemploymentInsurance,
    personal_income_tax: record.personalIncomeTax,
    net_salary: record.netSalary,
    payment_status: record.paymentStatus,
    payment_date: record.paymentDate,
    payment_method: record.paymentMethod,
    notes: record.notes,
    branch_id: record.branchId,
    created_at: record.created_at || new Date().toISOString(),
  };
}

/**
 * Tải toàn bộ bảng lương.
 * Nếu bảng chưa tồn tại (schema chưa migrate), trả failure code `not_found`
 * để caller tự tắt tính năng (thay vì coi như lỗi CSDL thật).
 */
export async function fetchPayrollRecords(): Promise<RepoResult<PayrollRecord[]>> {
  try {
    const { data, error } = await supabase.from(TABLE).select("*");
    if (error) {
      return failure({
        code: isMissingPayrollTableError(error) ? "not_found" : "supabase",
        message: "Không thể tải bảng lương",
        cause: error,
      });
    }
    return success((data || []).map(mapPayrollRow));
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi tải bảng lương",
      cause: e,
    });
  }
}

/** Thêm mới hoặc cập nhật một bản ghi lương. */
export async function upsertPayrollRecord(
  record: PayrollRecord
): Promise<RepoResult<PayrollRecord>> {
  try {
    const { error } = await supabase.from(TABLE).upsert(mapPayrollToDb(record));
    if (error) {
      return failure({
        code: "supabase",
        message: "Lỗi lưu bảng lương",
        cause: error,
      });
    }
    return success(record);
  } catch (e: any) {
    return failure({
      code: "network",
      message: "Lỗi kết nối khi lưu bảng lương",
      cause: e,
    });
  }
}
