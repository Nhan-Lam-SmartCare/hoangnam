// Utilities for revenue reporting (mapping and aggregation)
import type { Sale } from "../../types";

export type CsvSaleRow = {
  id: string;
  date: string;
  subtotal: number;
  discount: number;
  total: number;
  customerName: string;
  paymentMethod: string;
  branchId: string;
};

export function mapSalesToCsvRows(sales: Partial<Sale>[]): CsvSaleRow[] {
  return (sales || []).map((s: any) => ({
    id: s.id,
    date: s.date,
    subtotal: Number(s.subtotal ?? 0),
    discount: Number(s.discount ?? 0),
    total: Number(s.total ?? 0),
    customerName: s.customer?.name ?? "",
    paymentMethod: s.paymentMethod ?? "",
    branchId: s.branchId ?? s.branchid ?? "",
  }));
}

export type DailyAggregateRow = {
  date: string; // YYYY-MM-DD
  revenue: number;
  invoiceCount: number;
  avgInvoice: number;
  branchId?: string;
};

export function aggregateDaily(
  sales: Partial<Sale>[],
  opts?: { branchId?: string }
): DailyAggregateRow[] {
  const byDay: Record<string, { total: number; count: number }> = {};
  for (const s of sales || []) {
    const iso = (s as any).date as string;
    if (!iso) continue;
    const day = iso.slice(0, 10);
    if (!byDay[day]) byDay[day] = { total: 0, count: 0 };
    byDay[day].total += Number((s as any).total ?? 0);
    byDay[day].count += 1;
  }
  return Object.entries(byDay)
    .map(([date, v]) => ({
      date,
      revenue: v.total,
      invoiceCount: v.count,
      avgInvoice: v.count ? v.total / v.count : 0,
      branchId: opts?.branchId,
    }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}
