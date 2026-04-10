/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());
const mockInsert = vi.hoisted(() => vi.fn());

vi.mock("../../src/supabaseClient", () => ({
  supabase: {
    from: mockFrom,
  },
}));

import { safeAudit, flushQueue } from "../../src/lib/repository/auditLogsRepository";

describe("audit queue batching compatibility", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem("motocare_audit_queue");
    localStorage.removeItem("motocare_audit_table_missing");

    mockInsert.mockResolvedValue({ error: null });
    mockFrom.mockReturnValue({ insert: mockInsert });
  });

  it("flushQueue persists queued entries to audit_logs", async () => {
    safeAudit("user-1", {
      action: "work_order.create",
      entityType: "work_order",
      entityId: "WO-001",
      details: { total: 100000 },
      branchId: "CN2",
    });

    const flushed = await flushQueue();

    expect(flushed).toBe(1);
    expect(mockFrom).toHaveBeenCalledWith("audit_logs");
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockInsert.mock.calls[0][0][0]).toMatchObject({
      user_id: "user-1",
      action: "work_order.create",
      entity_type: "work_order",
      entity_id: "WO-001",
      branch_id: "CN2",
      details: { total: 100000 },
    });
  });

  it("stores to localStorage when audit_logs table is missing", async () => {
    mockInsert.mockResolvedValue({
      error: {
        message: "Could not find the table 'audit_logs' in the schema cache",
        code: "PGRST205",
      },
    });

    safeAudit("user-2", {
      action: "auth.login",
      details: { source: "mfa" },
    });

    const flushed = await flushQueue();
    const raw = localStorage.getItem("motocare_audit_queue");
    const rows = raw ? JSON.parse(raw) : [];

    expect(flushed).toBe(0);
    expect(localStorage.getItem("motocare_audit_table_missing")).toBe("1");
    expect(Array.isArray(rows)).toBe(true);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: "user-2",
      action: "auth.login",
    });
  });
});
