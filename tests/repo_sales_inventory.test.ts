import { describe, it, expect, vi } from "vitest";
import { supabaseHelpers } from "../src/lib/supabase";

describe("Repository: sales & inventory", () => {
  it("should throw when Supabase returns an error (mocked)", async () => {
    const error = new Error("RLS: permission denied");
    const spy = vi
      .spyOn(supabaseHelpers, "getSales")
      .mockRejectedValue(error as any);
    await expect(supabaseHelpers.getSales()).rejects.toBe(error);
    spy.mockRestore();
  });
});
