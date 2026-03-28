import { describe, it, expect, vi, beforeEach } from "vitest";
import * as client from "../../src/supabaseClient";
import { createSaleAtomic } from "../../src/lib/repository/salesRepository";

const mockRpc = vi.fn();
const mockAuth = {
  getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-test" } } }),
};

beforeEach(() => {
  mockRpc.mockReset();
  mockAuth.getUser.mockClear();
  // Monkey patch the actual supabase instance's rpc & auth to avoid real network
  (client.supabase as any).rpc = mockRpc;
  (client.supabase as any).auth = mockAuth;
});

describe("salesRepository.createSaleAtomic", () => {
  it("returns success when RPC returns sale json", async () => {
    const fakeSale: any = {
      id: "S1",
      date: new Date().toISOString(),
      items: [
        {
          partId: "p1",
          partName: "A",
          sku: "SKU1",
          quantity: 1,
          sellingPrice: 100000,
          stockSnapshot: 10,
        },
      ],
      subtotal: 100000,
      discount: 0,
      total: 100000,
      customer: { name: "KH Lẻ" },
      paymentMethod: "cash",
      userId: "u1",
      userName: "User 1",
      branchId: "CN1",
    };
    mockRpc.mockResolvedValue({
      data: { sale: fakeSale, cashTransactionId: "C1", inventoryTxCount: 1 },
      error: null,
    });

    const res = await createSaleAtomic(fakeSale as any);
    // Debug in case of failure
    if (!res.ok) {
      // eslint-disable-next-line no-console
      console.error("createSaleAtomic failed", res.error);
    }
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.id).toBe("S1");
      expect((res.data as any).cashTransactionId).toBe("C1");
    }
  });

  it("validates inputs", async () => {
    const res1 = await createSaleAtomic({} as any);
    expect(res1.ok).toBe(false);
    if (!res1.ok) expect(res1.error.code).toBe("validation");

    const res2 = await createSaleAtomic({
      id: "S2",
      items: [{ quantity: 1 } as any],
    } as any);
    expect(res2.ok).toBe(false);
  });

  it("handles rpc error", async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: "db error" } });
    const res = await createSaleAtomic({
      id: "S3",
      items: [
        {
          partId: "p",
          partName: "X",
          sku: "SKU",
          quantity: 1,
          sellingPrice: 1,
          stockSnapshot: 1,
        },
      ],
      customer: { name: "A" },
      paymentMethod: "cash",
      userId: "u",
      userName: "U",
      branchId: "CN1",
      subtotal: 1,
      discount: 0,
      total: 1,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("supabase");
  });

  it("maps insufficient stock error", async () => {
    mockRpc.mockResolvedValue({
      data: null,
      error: { message: "error", details: "INSUFFICIENT_STOCK" },
    });
    const res = await createSaleAtomic({
      id: "S4",
      items: [
        {
          partId: "p",
          partName: "X",
          sku: "SKU",
          quantity: 999,
          sellingPrice: 1,
          stockSnapshot: 1,
        },
      ],
      customer: { name: "A" },
      paymentMethod: "cash",
      userId: "u",
      userName: "U",
      branchId: "CN1",
      subtotal: 1,
      discount: 0,
      total: 1,
    } as any);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe("validation");
  });
});
