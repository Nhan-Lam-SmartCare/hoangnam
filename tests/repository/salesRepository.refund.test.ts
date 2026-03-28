import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../../src/supabaseClient";
import { refundSale } from "../../src/lib/repository/salesRepository";

// We mock supabase.from chain methods used in refundSale: select().eq().single(), update().eq()
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockUpdate = vi.fn();
const mockAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-test" } } }),
};

beforeEach(() => {
  mockFrom.mockReset();
  mockSelect.mockReset();
  mockEq.mockReset();
  mockSingle.mockReset();
  mockUpdate.mockReset();
  mockAuth.getUser.mockClear();
  // Monkey patch supabase client instance methods
  (client.supabase as any).from = mockFrom;
  (client.supabase as any).auth = mockAuth;
  // Re-apply implementation after reset
  mockFrom.mockImplementation((table: string) => {
    if (table === "sales") {
      return {
        select: () => ({ eq: () => ({ single: () => mockSingle() }) }),
        update: () => ({ eq: () => mockEq() }),
      } as any;
    }
    if (table === "audit_logs") {
      return {
        insert: () => ({
          select: () => ({
            single: () => ({ data: { id: "AL1" }, error: null }),
          }),
        }),
      } as any;
    }
    if (table === "inventory_transactions") {
      return {
        insert: () => ({
          select: () => ({
            single: () => ({ data: { id: "IT1" }, error: null }),
          }),
        }),
      } as any;
    }
    if (table === "parts") {
      return {
        select: () => ({
          eq: () => ({
            single: () => ({ data: { id: "p1", sku: "SKU1" }, error: null }),
          }),
        }),
      } as any;
    }
    return {
      select: () => ({
        eq: () => ({
          single: () => ({ data: null, error: { message: "unknown" } }),
        }),
      }),
    } as any;
  });
});

// Ensure no lingering spies override our instance monkey patch
try {
  (vi as any).restoreAllMocks?.();
} catch {}

// Build minimal fluent interface for tables used: 'sales', 'audit_logs', 'inventory_transactions', 'parts'

describe("salesRepository.refundSale", () => {
  it("marks sale as refunded and returns success", async () => {
    // First select fetch
    mockSingle.mockResolvedValue({
      data: { id: "S1", items: [], branchId: "CN1" },
      error: null,
    });
    // Update patch
    mockEq.mockResolvedValue({ error: null });

    const res = await refundSale("S1", "Khách đổi ý");
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("refundSale failed", res.error);
    }
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data.refunded).toBe(true);
  });

  it("fails when sale not found", async () => {
    mockSingle.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });
    const res = await refundSale("S404");
    if (res.ok) {
      // eslint-disable-next-line no-console
      console.error("refundSale expected failure, got success", res.data);
    } else {
      // eslint-disable-next-line no-console
      console.error("refundSale error", res.error);
    }
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("not_found");
  });
});
