import { describe, it, expect } from "vitest";
import { formatWorkOrderId, formatAnyId } from "./format";

describe("formatWorkOrderId", () => {
  it("formats WO-<timestamp> using provided prefix", () => {
    const ts = 1700000000000; // known timestamp
    const formatted = formatWorkOrderId(`WO-${ts}`, "SC");
    expect(formatted).toMatch(/^SC-\d{8}-\d{6}$/);
  });

  it("formats numeric timestamp with prefix", () => {
    const ts = 1700000000000;
    const formatted = formatWorkOrderId(`${ts}`, "SC");
    expect(formatted).toMatch(/^SC-\d{8}-\d{6}$/);
  });

  it("returns unchanged if already formatted with human prefix and suffix", () => {
    const id = "SC-001";
    expect(formatWorkOrderId(id, "SC")).toBe(id);
  });
});

describe("formatAnyId", () => {
  it("preserves prefix and formats sale ID with prefix and timestamp", () => {
    const ts = 1633046400000; // 2021-10-01
    const formatted = formatAnyId(`SALE-${ts}`);
    expect(formatted).toBe("SALE-20211001-400000");
  });

  it("returns unchanged for short human-friendly IDs", () => {
    expect(formatAnyId("SC-001")).toBe("SC-001");
  });

  it("formats bare numeric timestamp using store prefix", () => {
    const ts = 1633046400000;
    const formatted = formatAnyId(`${ts}`, "SC");
    expect(formatted).toBe("SC-20211001-400000");
  });
});
