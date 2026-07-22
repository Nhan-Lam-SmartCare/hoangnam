import { describe, it, expect } from "vitest";
import type { WorkOrder } from "../../src/types";

// ──────────────────────────────────────────────────────────
// Pure function extracted from ServiceManager.tsx:537-634.
// Exact copy of the inline filter logic — quirks included.
// This is the "source of truth" for Phase 1 comparison.
// ──────────────────────────────────────────────────────────

interface FilterParams {
  activeTab: "all" | "pending" | "inProgress" | "done" | "delivered";
  debouncedSearchQuery: string;
  dateFilter: "all" | "today" | "week" | "month";
  technicianFilter: string;
  paymentFilter: "all" | "paid" | "unpaid" | "partial";
  /** Frozen "now" for deterministic date tests */
  now?: Date;
}

function filterWorkOrdersInline(
  workOrders: Partial<WorkOrder>[],
  params: FilterParams
): Partial<WorkOrder>[] {
  const {
    activeTab,
    debouncedSearchQuery,
    dateFilter,
    technicianFilter,
    paymentFilter,
    now = new Date(),
  } = params;

  // ① Base filter: exclude refunded AND "Đã hủy"
  let filtered = workOrders.filter(
    (o) => !o.refunded && o.status !== "Đã hủy"
  );

  const normalizedQuery = debouncedSearchQuery.toLowerCase().trim();
  const normalizedPhoneQuery = normalizedQuery.replace(/\D/g, "");

  // ② Tab filter — ONLY when NOT searching
  if (!debouncedSearchQuery) {
    if (activeTab === "delivered") {
      filtered = filtered.filter((o) => o.status === "Trả máy");
    } else {
      filtered = filtered.filter((o) => o.status !== "Trả máy");

      if (activeTab === "pending")
        filtered = filtered.filter((o) => o.status === "Tiếp nhận");
      else if (activeTab === "inProgress")
        filtered = filtered.filter((o) => o.status === "Đang sửa");
      else if (activeTab === "done")
        filtered = filtered.filter((o) => o.status === "Đã sửa xong");
    }
  }

  // ③ Search filter
  if (debouncedSearchQuery) {
    filtered = filtered.filter(
      (o) =>
        (o.customerName || "").toLowerCase().includes(normalizedQuery) ||
        (o.vehicleModel || "").toLowerCase().includes(normalizedQuery) ||
        (o.licensePlate || "").toLowerCase().includes(normalizedQuery) ||
        (o.id || "").toLowerCase().includes(normalizedQuery) ||
        (!!normalizedPhoneQuery &&
          (o.customerPhone || "").replace(/\D/g, "").includes(normalizedPhoneQuery))
    );
  }

  // ④ Date filter — ONLY for "Trả máy" orders; non-completed always show
  // Also skipped when searching
  if (dateFilter !== "all" && !debouncedSearchQuery) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    filtered = filtered.filter((o) => {
      if (o.status !== "Trả máy") {
        return true; // Non-completed always show
      }

      const orderDate = new Date(
        o.creationDate || (o as any).creationdate || ""
      );

      if (dateFilter === "today") {
        return orderDate >= today;
      } else if (dateFilter === "week") {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return orderDate >= weekAgo;
      } else if (dateFilter === "month") {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return orderDate >= monthAgo;
      }
      return true;
    });
  }

  // ⑤ Technician filter
  if (technicianFilter !== "all") {
    filtered = filtered.filter((o) => o.technicianName === technicianFilter);
  }

  // ⑥ Payment filter
  if (paymentFilter !== "all") {
    filtered = filtered.filter((o) => {
      const status = o.paymentStatus || (o as any).paymentstatus;
      if (paymentFilter === "paid") return status === "paid";
      if (paymentFilter === "unpaid") return status === "unpaid";
      if (paymentFilter === "partial") return status === "partial";
      return true;
    });
  }

  // ⑦ Sort descending by creationDate
  return filtered.sort((a, b) => {
    const dateA = a.creationDate || (a as any).creationdate;
    const dateB = b.creationDate || (b as any).creationdate;
    if (!dateA || !dateB) return 0;
    return new Date(dateB).getTime() - new Date(dateA).getTime();
  });
}

// ──────────────── Test fixtures ────────────────

const NOW = new Date("2026-07-16T06:00:00Z");

const makeOrder = (overrides: Partial<WorkOrder>): Partial<WorkOrder> => ({
  id: "WO-" + Math.random().toString(36).slice(2, 6),
  customerName: "Khách",
  customerPhone: "0909000000",
  vehicleModel: "iPhone",
  licensePlate: "IMEI-000",
  technicianName: "Thợ A",
  status: "Tiếp nhận",
  paymentStatus: "unpaid",
  creationDate: "2026-07-15T10:00:00Z",
  refunded: false,
  ...overrides,
});

const sampleOrders: Partial<WorkOrder>[] = [
  makeOrder({ id: "WO-001", status: "Tiếp nhận", customerName: "Nguyễn A", customerPhone: "0909111111" }),
  makeOrder({ id: "WO-002", status: "Đang sửa", customerName: "Trần B", technicianName: "Thợ B" }),
  makeOrder({ id: "WO-003", status: "Đã sửa xong", customerName: "Lê C", paymentStatus: "partial" }),
  makeOrder({ id: "WO-004", status: "Trả máy", customerName: "Phạm D", paymentStatus: "paid", creationDate: "2026-07-10T08:00:00Z" }),
  makeOrder({ id: "WO-005", status: "Trả máy", customerName: "Hoàng E", paymentStatus: "paid", creationDate: "2026-06-01T08:00:00Z" }),
  makeOrder({ id: "WO-006", status: "Đã hủy", customerName: "Hủy F", refunded: false }),
  makeOrder({ id: "WO-007", status: "Tiếp nhận", customerName: "Refund G", refunded: true }),
  makeOrder({ id: "WO-008", status: "Tiếp nhận", vehicleModel: "Galaxy S24", licensePlate: "IMEI-S24" }),
];

const defaultParams: FilterParams = {
  activeTab: "all",
  debouncedSearchQuery: "",
  dateFilter: "all",
  technicianFilter: "all",
  paymentFilter: "all",
  now: NOW,
};

// ──────────────── Tests ────────────────

describe("workOrderFilters (inline logic from ServiceManager.tsx:537-634)", () => {
  describe("base filter — refunded and cancelled exclusion", () => {
    it("excludes refunded orders", () => {
      const result = filterWorkOrdersInline(sampleOrders, defaultParams);
      expect(result.find((o) => o.id === "WO-007")).toBeUndefined();
    });

    it('excludes orders with status "Đã hủy" even if refunded=false', () => {
      const result = filterWorkOrdersInline(sampleOrders, defaultParams);
      expect(result.find((o) => o.id === "WO-006")).toBeUndefined();
    });
  });

  describe("tab filter", () => {
    it('activeTab="all" shows everything except "Trả máy" (and filtered base)', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "all",
      });
      // Should show WO-001, WO-002, WO-003, WO-008 (not Trả máy, not Đã hủy, not refunded)
      expect(result.map((o) => o.id)).not.toContain("WO-004");
      expect(result.map((o) => o.id)).not.toContain("WO-005");
      expect(result.length).toBe(4);
    });

    it('activeTab="pending" shows only "Tiếp nhận"', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "pending",
      });
      result.forEach((o) => expect(o.status).toBe("Tiếp nhận"));
    });

    it('activeTab="inProgress" shows only "Đang sửa"', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "inProgress",
      });
      result.forEach((o) => expect(o.status).toBe("Đang sửa"));
      expect(result.length).toBe(1);
    });

    it('activeTab="done" shows only "Đã sửa xong"', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "done",
      });
      result.forEach((o) => expect(o.status).toBe("Đã sửa xong"));
      expect(result.length).toBe(1);
    });

    it('activeTab="delivered" shows only "Trả máy"', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "delivered",
      });
      result.forEach((o) => expect(o.status).toBe("Trả máy"));
      expect(result.length).toBe(2);
    });
  });

  describe("search filter", () => {
    it("matches customerName", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        debouncedSearchQuery: "Nguyễn A",
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("WO-001");
    });

    it("matches vehicleModel", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        debouncedSearchQuery: "Galaxy",
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("WO-008");
    });

    it("matches licensePlate", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        debouncedSearchQuery: "IMEI-S24",
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("WO-008");
    });

    it("matches order id", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        debouncedSearchQuery: "WO-002",
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("WO-002");
    });

    it("matches customerPhone by digits only", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        debouncedSearchQuery: "0909111111",
      });
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("WO-001");
    });

    it("search bypasses tab filter (global search)", () => {
      // Even with activeTab="pending", search finds "Trả máy" orders
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "pending",
        debouncedSearchQuery: "Phạm D",
      });
      expect(result.length).toBe(1);
      expect(result[0].status).toBe("Trả máy");
    });
  });

  describe("date filter — QUIRK: only applies to Trả máy", () => {
    it("non-completed orders always show regardless of date filter", () => {
      const oldPendingOrder = makeOrder({
        id: "WO-OLD",
        status: "Tiếp nhận",
        creationDate: "2025-01-01T00:00:00Z",
      });
      const result = filterWorkOrdersInline([oldPendingOrder], {
        ...defaultParams,
        dateFilter: "today",
      });
      expect(result.length).toBe(1);
    });

    it('dateFilter="week" excludes old "Trả máy" orders', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "delivered",
        dateFilter: "week",
      });
      // WO-004 (Jul 10) is within 7 days of Jul 16 → show
      // WO-005 (Jun 01) is NOT within 7 days → hide
      expect(result.map((o) => o.id)).toContain("WO-004");
      expect(result.map((o) => o.id)).not.toContain("WO-005");
    });

    it("date filter is bypassed when searching", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        dateFilter: "today",
        debouncedSearchQuery: "Hoàng E",
      });
      // WO-005 is from Jun 01 — would be excluded by "today" filter
      // But search bypasses date filter
      expect(result.length).toBe(1);
      expect(result[0].id).toBe("WO-005");
    });
  });

  describe("technician filter", () => {
    it("filters by exact technician name", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        technicianFilter: "Thợ B",
      });
      result.forEach((o) => expect(o.technicianName).toBe("Thợ B"));
      expect(result.length).toBe(1);
    });
  });

  describe("payment filter", () => {
    it('paymentFilter="paid" shows only paid orders', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "delivered",
        paymentFilter: "paid",
      });
      result.forEach((o) =>
        expect(o.paymentStatus || (o as any).paymentstatus).toBe("paid")
      );
    });

    it('paymentFilter="partial" shows only partial orders', () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        paymentFilter: "partial",
      });
      result.forEach((o) =>
        expect(o.paymentStatus || (o as any).paymentstatus).toBe("partial")
      );
      expect(result.length).toBe(1);
    });
  });

  describe("sort order", () => {
    it("sorts descending by creationDate", () => {
      const result = filterWorkOrdersInline(sampleOrders, {
        ...defaultParams,
        activeTab: "delivered",
      });
      // WO-004 is Jul 10, WO-005 is Jun 01 → WO-004 should come first
      expect(result[0].id).toBe("WO-004");
      expect(result[1].id).toBe("WO-005");
    });
  });

  describe("DOCUMENTED: differences with useServiceFilters hook", () => {
    it('[DIFF] inline excludes status="Đã hủy" in base filter, hook does NOT', () => {
      // This documents the difference: the inline logic filters out "Đã hủy"
      // explicitly in addition to refunded. useServiceFilters only checks refunded.
      const canceledNotRefunded = makeOrder({
        id: "WO-CANCELED",
        status: "Đã hủy",
        refunded: false,
      });
      const inlineResult = filterWorkOrdersInline([canceledNotRefunded], defaultParams);
      expect(inlineResult.length).toBe(0); // inline: excluded

      // Hook would include it (documented, not tested here)
    });

    it("[DIFF] inline search matches id and customerPhone, hook does NOT", () => {
      // This documents that inline search is broader
      const orderWithId = makeOrder({ id: "WO-UNIQUE-ID" });
      const byId = filterWorkOrdersInline([orderWithId], {
        ...defaultParams,
        debouncedSearchQuery: "WO-UNIQUE-ID",
      });
      expect(byId.length).toBe(1); // inline: matches id

      // Hook would NOT find it by id (documented)
    });

    it("[DIFF] inline date filter only affects Trả máy, hook affects ALL", () => {
      // This documents the key behavioral difference
      const oldPending = makeOrder({
        id: "WO-OLD-PENDING",
        status: "Tiếp nhận",
        creationDate: "2025-01-01T00:00:00Z",
      });
      const inlineResult = filterWorkOrdersInline([oldPending], {
        ...defaultParams,
        dateFilter: "week",
      });
      expect(inlineResult.length).toBe(1); // inline: non-completed always show

      // Hook would hide it (documented)
    });
  });
});
