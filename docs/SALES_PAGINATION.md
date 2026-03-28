# Sales Pagination & Filtering

Date: 2025-11-11
Status: Implemented (repository + React Query hook) – UI integrated in `SalesManager` footer. Debounced search + extended date presets (MTD/QTD) added on 2025-11-11. Keyset pagination mode + status/paymentMethod filters added (2025-11-11, later in day).

## Overview

Server-side pagination avoids loading all sales rows and leverages an index `idx_sales_branch_date` for efficient branch/date queries. Client date presets (Today, Yesterday, 7/30 days, Month-to-date, Quarter-to-date, Custom) compute ISO boundaries passed as `fromDate`/`toDate` for server filtering.

## API: fetchSalesPaged

Location: `src/lib/repository/salesRepository.ts`

Parameters (object `SalesQuery` – offset mode):

- `branchId?: string` Filter by branch.
- `fromDate?: string` ISO date/time (inclusive) for lower bound on `date`.
- `toDate?: string` ISO date/time (inclusive) for upper bound.
- `page?: number` 1-based page number (default 1).
- `pageSize?: number` Items per page (default 20).
- `search?: string` Performs `ilike` match on `id` or `customer.name` (debounced 300ms in UI to reduce chatter).
- `status?: "completed" | "cancelled" | "refunded"` Server mapping to refunded boolean logic.
- `paymentMethod?: "cash" | "bank"` Direct equality filter.
- `mode?: "offset" | "keyset"` Defaults to `offset`.
- `afterDate?: string` (keyset) Cursor: last row's `date` from previous page.
- `afterId?: string` (keyset) Tie-breaker cursor when multiple rows share same `date`.

Return (RepoResult<Sale[]>):

- `data: Sale[]` current page / slice.
- `meta` (offset mode):
  - `mode: "offset"`
  - `page`, `pageSize`, `total`, `totalPages`, `hasMore`.
- `meta` (keyset mode):
  - `mode: "keyset"`
  - `pageSize`
  - `hasMore` (true if returned length == pageSize)
  - `nextAfterDate`, `nextAfterId` for subsequent request.

## React Hook: useSalesPagedRepo

Location: `src/hooks/useSalesRepository.ts`

Usage:

```tsx
const { data, isLoading } = useSalesPagedRepo({
  branchId,
  page,
  pageSize,
  search,
});
const sales = data?.data || [];
const meta = data?.meta; // pagination info
```

React Query options include `placeholderData` to preserve previous page while loading the next (offset mode). For keyset infinite-style loading, a dedicated hook (future) can append using cursors.

## UI Integration

Footer + Modal controls added to `src/components/sales/SalesManager.tsx`:

- Previous / Next buttons
- Page indicator
- Page size selector (10, 20, 50)
- Search input (now debounced 300ms; separate raw input state vs. applied query state)
- Time range preset buttons (today, yesterday, 7 ngày, 30 ngày, tháng này (MTD), quý này (QTD), tùy chỉnh)

Temporary bridging via `window.setSalesPage` etc. (to be refactored into proper props) – this keeps patch minimal. Future improvement: lift pagination state up and pass handlers into `SalesHistoryModal`.

## Error Mapping

Errors propagate through existing RepoResult mechanism. Typical messages:

- Network: `Lỗi kết nối khi tải hóa đơn (phân trang)`
- Supabase: `Không thể tải danh sách hóa đơn (phân trang)`
- Validation: not used directly here (handled by RPC / creation functions).

## Performance Considerations

- Composite index `idx_sales_branch_date` accelerates typical branch/date scans.
- Keyset queries avoid COUNT(\*) overhead and large OFFSET skips on deep pages.
- Additional partial / composite index may be warranted for heavy `paymentMethod` + `refunded` filtering (e.g., `(branchId, refunded, date DESC)` after workload observation).
- Keyset cursor condition uses `(date < afterDate) OR (date = afterDate AND id < afterId)` relying on ordering by `date DESC, id DESC` semantic (implicit tie-break by id). Ensure `id` is monotonic (UUID randomness is acceptable; ordering remains deterministic though not strictly sequential).

## Future Enhancements

1. (DONE) Debounced search (300ms) + state separation.
2. (DONE) Date range presets compute server `fromDate`/`toDate`.
3. (DONE) Status + paymentMethod filters.
4. (DONE) Keyset pagination base implementation (forward only).
5. Export current filtered page or entire filtered dataset (async streaming).
6. Add reverse (previous page) keyset navigation (requires storing head cursors stack).
7. Integrate RLS branchId checks (already enforced) into automated integration tests.
8. Evaluate partial indexes after capturing real query plans.

## Example End-to-End

```tsx
const [page, setPage] = useState(1);
const [pageSize, setPageSize] = useState(20);
const [search, setSearch] = useState("");
const { data } = useSalesPagedRepo({
  branchId: currentBranchId,
  page,
  pageSize,
  search,
});
const rows = data?.data || [];
const meta = data?.meta;

return (
  <div>
    <ul>
      {rows.map((r) => (
        <li key={r.id}>
          {r.id} – {r.customer.name}
        </li>
      ))}
    </ul>
    <button disabled={meta?.page === 1} onClick={() => setPage((p) => p - 1)}>
      Prev
    </button>
    <span>
      {meta?.page}/{meta?.totalPages}
    </span>
    <button disabled={!meta?.hasMore} onClick={() => setPage((p) => p + 1)}>
      Next
    </button>
  </div>
);
```

## Testing Strategy

Current tests: `tests/repository/salesRepository.paged.test.ts` validates meta calculation & error mapping.
Planned UI test will mock hook return values to verify button disabled state changes (search debounce can be simulated via fake timers).

---

Document maintained; update when adding new filter fields (e.g., status, paymentMethod). Ensure any new server filters are expressed in `SalesQuery` and backed by indexes.
