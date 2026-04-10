import { describe, it, expect } from "vitest";

function buildPagerView(meta: { page: number; totalPages: number; hasMore: boolean }) {
  return {
    prevDisabled: meta.page <= 1,
    nextDisabled: !meta.hasMore,
    indicator: `${meta.page}/${meta.totalPages}`,
  };
}

describe("sales history pagination UI compatibility", () => {
  it("disables prev on first page and next when no more pages", () => {
    const first = buildPagerView({ page: 1, totalPages: 5, hasMore: true });
    expect(first.prevDisabled).toBe(true);
    expect(first.nextDisabled).toBe(false);
    expect(first.indicator).toBe("1/5");

    const last = buildPagerView({ page: 5, totalPages: 5, hasMore: false });
    expect(last.prevDisabled).toBe(false);
    expect(last.nextDisabled).toBe(true);
    expect(last.indicator).toBe("5/5");
  });
});
