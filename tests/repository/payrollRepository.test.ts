import { describe, it, expect, vi } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  fetchPayrollRecords,
  upsertPayrollRecord,
  isMissingPayrollTableError,
} from "../../src/lib/repository/payrollRepository";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpsert = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

mockFrom.mockImplementation((table: string) => ({
  select: () => mockSelect(table),
  upsert: (rows: any) => mockUpsert(table, rows),
}));

// Default success
mockSelect.mockImplementation(() => ({ data: [], error: null }));
mockUpsert.mockImplementation(() => ({ error: null }));

const sampleRecord: any = {
  id: "PR-1",
  employeeId: "EMP-1",
  employeeName: "Nguyen Van A",
  month: "2026-07",
  baseSalary: 8000000,
  netSalary: 7500000,
  branchId: "CN1",
};

describe("payrollRepository", () => {
  it("fetchPayrollRecords success maps rows to camelCase", async () => {
    mockSelect.mockImplementationOnce(() => ({
      data: [
        {
          id: "PR-1",
          employee_id: "EMP-1",
          employee_name: "Nguyen Van A",
          month: "2026-07",
          base_salary: 8000000,
          net_salary: 7500000,
          branch_id: "CN1",
        },
      ],
      error: null,
    }));
    const res = await fetchPayrollRecords();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(1);
      expect(res.data[0].employeeId).toBe("EMP-1");
      expect(res.data[0].netSalary).toBe(7500000);
      expect(res.data[0].branchId).toBe("CN1");
    }
  });

  it("fetchPayrollRecords maps missing-table error to code not_found", async () => {
    mockSelect.mockImplementationOnce(() => ({
      data: null,
      error: { code: "PGRST205", message: "Could not find the table" },
    }));
    const res = await fetchPayrollRecords();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("not_found");
  });

  it("fetchPayrollRecords maps real DB error to code supabase", async () => {
    mockSelect.mockImplementationOnce(() => ({
      data: null,
      error: { code: "42P01", message: "permission denied" },
    }));
    const res = await fetchPayrollRecords();
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("upsertPayrollRecord success returns the record", async () => {
    const res = await upsertPayrollRecord(sampleRecord);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.id).toBe("PR-1");
  });

  it("upsertPayrollRecord maps DB error to code supabase", async () => {
    mockUpsert.mockImplementationOnce(() => ({
      error: { message: "constraint violation" },
    }));
    const res = await upsertPayrollRecord(sampleRecord);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("upsertPayrollRecord writes snake_case payload to DB", async () => {
    let captured: any = null;
    mockUpsert.mockImplementationOnce((_t: string, rows: any) => {
      captured = rows;
      return { error: null };
    });
    await upsertPayrollRecord(sampleRecord);
    expect(captured.employee_id).toBe("EMP-1");
    expect(captured.base_salary).toBe(8000000);
    expect(captured.branch_id).toBe("CN1");
  });

  it("isMissingPayrollTableError detects known signatures", () => {
    expect(isMissingPayrollTableError({ code: "PGRST205" })).toBe(true);
    expect(isMissingPayrollTableError({ status: 404 })).toBe(true);
    expect(isMissingPayrollTableError({ message: "relation does not exist" })).toBe(true);
    expect(isMissingPayrollTableError({ code: "42501", message: "denied" })).toBe(false);
  });
});
