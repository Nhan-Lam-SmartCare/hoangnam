import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../../src/supabaseClient";
import { createNotification } from "../../src/lib/repository/notificationsRepository";

const mockFrom = vi.fn();
const mockInsert = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

mockFrom.mockImplementation(() => ({
  insert: (row: any) => mockInsert(row),
}));

// crypto.randomUUID may be missing in jsdom
if (!globalThis.crypto) (globalThis as any).crypto = {};
if (!globalThis.crypto.randomUUID) {
  (globalThis.crypto as any).randomUUID = () => "uuid-fixed";
}

beforeEach(() => {
  mockInsert.mockReset();
  mockInsert.mockImplementation(() => ({ error: null }));
});

describe("notificationsRepository", () => {
  it("createNotification success", async () => {
    const res = await createNotification({
      type: "work_order",
      title: "Phieu moi",
      message: "noi dung",
    });
    expect(res.ok).toBe(true);
  });

  it("maps input to DB columns with defaults", async () => {
    let captured: any = null;
    mockInsert.mockImplementationOnce((row: any) => {
      captured = row;
      return { error: null };
    });
    await createNotification({
      type: "work_order",
      title: "Phieu moi",
      message: "noi dung",
      createdBy: "user-1",
      branchId: "CN2",
    });
    expect(captured.type).toBe("work_order");
    expect(captured.created_by).toBe("user-1");
    expect(captured.branch_id).toBe("CN2");
    expect(captured.recipient_role).toBe("owner"); // default
    expect(captured.is_read).toBe(false);
    expect(captured.data).toEqual({});
  });

  it("createNotification maps DB error to code supabase", async () => {
    mockInsert.mockImplementationOnce(() => ({
      error: { message: "insert failed" },
    }));
    const res = await createNotification({
      type: "x",
      title: "t",
      message: "m",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });
});
