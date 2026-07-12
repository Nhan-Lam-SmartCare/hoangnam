import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../../src/supabaseClient";
import {
  findCustomerById,
  findDuplicateCustomerByPhone,
  updateCustomerWithFallback,
  insertCustomerWithFallback,
} from "../../src/lib/repository/customersRepository";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockInsert = vi.fn();

vi.spyOn(client, "supabase", "get").mockReturnValue({ from: mockFrom } as any);

mockFrom.mockImplementation(() => ({
  select: (...a: any[]) => mockSelect(...a),
  update: (payload: any) => mockUpdate(payload),
  insert: (rows: any[]) => mockInsert(rows),
}));

beforeEach(() => {
  mockSelect.mockReset();
  mockUpdate.mockReset();
  mockInsert.mockReset();
});

describe("customersRepository", () => {
  it("findCustomerById returns customer when found", async () => {
    mockSelect.mockImplementation(() => ({
      eq: () => ({ single: () => ({ data: { id: "CUS-1" }, error: null }) }),
    }));
    const res = await findCustomerById("CUS-1");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.id).toBe("CUS-1");
  });

  it("findCustomerById returns null (not error) when .single errors", async () => {
    mockSelect.mockImplementation(() => ({
      eq: () => ({
        single: () => ({ data: null, error: { message: "no rows" } }),
      }),
    }));
    const res = await findCustomerById("CUS-x");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toBeNull();
  });

  it("findDuplicateCustomerByPhone returns first match", async () => {
    mockSelect.mockImplementation(() => ({
      eq: () => ({
        limit: () => ({ data: [{ id: "CUS-9", name: "A" }], error: null }),
      }),
    }));
    const res = await findDuplicateCustomerByPhone("0900");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data?.id).toBe("CUS-9");
  });

  it("findDuplicateCustomerByPhone returns null when no match", async () => {
    mockSelect.mockImplementation(() => ({
      eq: () => ({ limit: () => ({ data: [], error: null }) }),
    }));
    const res = await findDuplicateCustomerByPhone("0900");
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toBeNull();
  });

  it("updateCustomerWithFallback succeeds on first payload", async () => {
    const calls: any[] = [];
    mockUpdate.mockImplementation((payload: any) => {
      calls.push(payload);
      return { eq: () => ({ error: null }) };
    });
    const res = await updateCustomerWithFallback("CUS-1", [{ a: 1 }, { b: 2 }]);
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1); // dừng ngay khi payload đầu thành công
  });

  it("updateCustomerWithFallback tries next payload on error, then succeeds", async () => {
    let n = 0;
    mockUpdate.mockImplementation(() => ({
      eq: () => ({ error: n++ === 0 ? { message: "col missing" } : null }),
    }));
    const res = await updateCustomerWithFallback("CUS-1", [{ a: 1 }, { b: 2 }]);
    expect(res.ok).toBe(true);
    expect(n).toBe(2); // đã thử 2 payload
  });

  it("updateCustomerWithFallback fails when all payloads error", async () => {
    mockUpdate.mockImplementation(() => ({
      eq: () => ({ error: { message: "always fail" } }),
    }));
    const res = await updateCustomerWithFallback("CUS-1", [{ a: 1 }, { b: 2 }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("insertCustomerWithFallback succeeds on first payload", async () => {
    const calls: any[] = [];
    mockInsert.mockImplementation((rows: any[]) => {
      calls.push(rows);
      return { error: null };
    });
    const res = await insertCustomerWithFallback([{ id: "1" }, { id: "1", less: true }]);
    expect(res.ok).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("insertCustomerWithFallback fails when all payloads error", async () => {
    mockInsert.mockImplementation(() => ({ error: { message: "fail" } }));
    const res = await insertCustomerWithFallback([{ id: "1" }, { id: "1" }]);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });
});
