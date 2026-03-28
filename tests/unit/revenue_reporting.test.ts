import { describe, it, expect } from "vitest";
import {
  mapSalesToCsvRows,
  aggregateDaily,
} from "../../src/lib/reporting/revenue";

describe.skip("revenue reporting utils (đã vô hiệu hoá)", () => {
  it("mapSalesToCsvRows maps core fields and falls back to branchid", () => {
    const rows = mapSalesToCsvRows([
      {
        id: "S1",
        date: "2025-11-10T12:00:00.000Z",
        subtotal: 1200000,
        discount: 200000,
        total: 1000000,
        customer: { name: "Khách A" },
        paymentMethod: "cash",
        branchid: "CN1",
      } as any,
    ]);
    expect(rows[0]).toMatchObject({
      id: "S1",
      total: 1000000,
      customerName: "Khách A",
      branchId: "CN1",
    });
  });

  it("aggregateDaily groups by YYYY-MM-DD and computes sums/avg", () => {
    const sales: any[] = [
      { id: "S1", date: "2025-11-10T01:00:00.000Z", total: 100 },
      { id: "S2", date: "2025-11-10T12:00:00.000Z", total: 300 },
      { id: "S3", date: "2025-11-11T02:00:00.000Z", total: 600 },
    ];
    const agg = aggregateDaily(sales, { branchId: "CN1" });
    expect(agg).toEqual([
      {
        date: "2025-11-10",
        revenue: 400,
        invoiceCount: 2,
        avgInvoice: 200,
        branchId: "CN1",
      },
      {
        date: "2025-11-11",
        revenue: 600,
        invoiceCount: 1,
        avgInvoice: 600,
        branchId: "CN1",
      },
    ]);
  });
});
