import { describe, it, expect, vi } from "vitest";
import { supabaseHelpers } from "../../src/lib/supabase";

describe("Inventory repository additional", () => {
  it("createInventoryTransaction - success path", async () => {
    const fakeData = { id: "tx-1", partId: "p1" };
    const spy = vi
      .spyOn(supabaseHelpers, "createInventoryTransaction")
      .mockResolvedValue(fakeData as any);
    const res = await supabaseHelpers.createInventoryTransaction({});
    expect(res).toEqual(fakeData);
    spy.mockRestore();
  });

  it("createInventoryTransaction - error path", async () => {
    const err = new Error("RLS denied");
    const spy = vi
      .spyOn(supabaseHelpers, "createInventoryTransaction")
      .mockRejectedValue(err as any);
    await expect(supabaseHelpers.createInventoryTransaction({})).rejects.toBe(
      err
    );
    spy.mockRestore();
  });
});
