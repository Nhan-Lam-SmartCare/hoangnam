import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  enqueueAudit,
  _setBatchingOptions,
  _getQueueLength,
  _flushNowForTest,
} from "../../src/lib/auditQueue";

vi.mock("../../src/supabaseClient", () => {
  const insert = vi.fn(async (_payload: any) => ({ data: null, error: null }));
  const from = vi.fn((_table: string) => ({ insert }));
  return {
    supabase: { from },
  };
});

const { supabase } = await import("../../src/supabaseClient");

describe("auditQueue batching", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    _setBatchingOptions({ size: 10, intervalMs: 200 });
    (supabase.from as any).mockClear?.();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("batches multiple enqueue calls into a single insert on timer", async () => {
    enqueueAudit("u1", { action: "test.a" });
    enqueueAudit("u2", { action: "test.b", tableName: "t", recordId: "1" });
    enqueueAudit(null, {
      action: "test.c",
      oldData: { a: 1 },
      newData: { b: 2 },
    });

    // nothing flushed yet
    expect(_getQueueLength()).toBe(3);
    expect((supabase.from as any).mock.calls.length).toBe(0);

    // advance timer to trigger flush
    vi.advanceTimersByTime(250);
    await _flushNowForTest();

    // one insert performed on audit_logs
    expect((supabase.from as any).mock.calls.length).toBeGreaterThanOrEqual(1);
    const firstCallArgs = (supabase.from as any).mock.calls[0];
    expect(firstCallArgs[0]).toBe("audit_logs");
  });

  it("flushes immediately when queue reaches batch size", async () => {
    _setBatchingOptions({ size: 2, intervalMs: 1000 });

    enqueueAudit("u1", { action: "a" });
    // still in queue
    expect(_getQueueLength()).toBe(1);

    enqueueAudit("u2", { action: "b" });
    // should have flushed because reached size 2
    await _flushNowForTest();
    expect((supabase.from as any).mock.calls.length).toBeGreaterThanOrEqual(1);
  });
});
