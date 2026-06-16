# CLAUDE.md — MotoCare Pro

Hướng dẫn kiến trúc & quy ước cho người (và AI) làm việc trên repo này. Mục tiêu: thêm tính năng / sửa lỗi **đúng pattern** và **không phá luồng đang chạy**.

> Ứng dụng quản lý tiệm sửa xe máy: phiếu sửa chữa, kho phụ tùng, bán hàng, công nợ, nhân viên/lương, báo cáo, bảo hành — đa chi nhánh, phân quyền theo vai trò. Chạy web (Vite) và Android (Capacitor).

## Stack

- **React 19** + **TypeScript** (`strict: true`) + **Vite 6**
- **Supabase** (PostgreSQL + Auth + RLS) làm backend
- **@tanstack/react-query v5** cho server state
- **react-router-dom v7** (web: `BrowserRouter`; native Android: `HashRouter` — xem [App.tsx](src/App.tsx#L34))
- **Tailwind CSS 3**, **Capacitor 8** (Android)

## Lệnh thường dùng

```bash
npm run dev            # Vite dev server
npm run build          # Build production
npm run typecheck      # tsc --noEmit  (CHẠY TRƯỚC KHI commit thay đổi TS)
npm run lint           # ESLint
npm run test           # Vitest (jsdom)
npm run cap:sync       # build + cap sync (Android)
```

Test tích hợp DB/RLS bị **skip mặc định**; cần `RUN_DB_INTEGRATION=1` + `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` trong env (xem [tests/integration/rls_access.test.ts](tests/integration/rls_access.test.ts)).

## Luồng khởi động & Providers

`src/main.tsx` → [App.tsx](src/App.tsx). Thứ tự provider (ngoài→trong):
`QueryClientProvider → ThemeProvider → AuthProvider → AppProvider → Router → ErrorBoundary → Routes`.

Routing nằm trong `App.tsx`. Route công khai: `/login`, `/reset-password`. Mọi route khác bọc trong `<ProtectedRoute>` + `MainLayout`.

### Phân quyền route (nguồn sự thật: [App.tsx](src/App.tsx#L213))

| Route | Quyền |
|---|---|
| `/dashboard` | `owner`, `manager` |
| `/staff-dashboard` | `staff` |
| `/reports` | `canDo(profile, "reports.view")` |
| `/cash-book` | `cashbook.view` hoặc `finance.view` |
| `/sales` | `sale.create` |
| `/inventory` | `canAccessInventorySection(profile, user)` |
| `/service-history` | `work_order.history.view` |
| `/employees`, `/settings` | `owner`, `manager` |
| `/admin/migration` | `owner` |
| `/service`, `/warranty`, `/customers`, `/categories`, `/lookup` | đăng nhập là đủ |

Phân quyền chi tiết: [utils/permissions.ts](src/utils/permissions.ts) (`canDo`) và [utils/inventoryAccess.ts](src/utils/inventoryAccess.ts).

## Tầng dữ liệu (quan trọng — theo đúng pattern này)

```
Component
  → hook  src/hooks/use<Entity>Repository.ts   (React Query: useQuery/useMutation, cache, invalidate)
    → repository  src/lib/repository/<entity>Repository.ts   (gọi Supabase, trả RepoResult<T>)
      → src/supabaseClient.ts
```

- **`RepoResult<T>`** = `{ ok: true, data }` | `{ ok: false, error }` (helper `success()` / `failure()` ở [lib/repository/types.ts](src/lib/repository/types.ts)). Repository **không throw** cho lỗi nghiệp vụ — trả `failure(...)`.
- Mọi truy cập Supabase đi qua repository. **Không** gọi `supabase.from(...)` rải rác trong component (hiện còn vài chỗ vi phạm trong các "god component" — đừng nhân rộng).

## State toàn cục

- **AppContext** ([contexts/AppContext.tsx](src/contexts/AppContext.tsx)) — dữ liệu dùng chung (parts, customers, workOrders, cashTransactions, paymentSources, employees, ...). Được tách thành: [app/useAppState.ts](src/contexts/app/useAppState.ts) (load + getters), [app/useAppActions.ts](src/contexts/app/useAppActions.ts), `useCustomerActions.ts`, `useFinanceActions.ts`. `currentBranchId` sống ở đây.
- **AuthContext** — session, profile, role. **ThemeContext** — dark/light. **CartContext** — giỏ hàng module bán hàng.

## Backend / Database

- SQL ở thư mục [`sql/`](sql/), đặt tên `YYYY-MM-DD_<mô tả>.sql`. Áp dụng bằng `node scripts/setup/apply-sql.mjs <file.sql>` (xem script `migrate:*` trong [package.json](package.json)).
- **Chưa có** bảng tracking migration (`schema_migrations`). Migration được chạy thủ công → mỗi file phải **idempotent** (`CREATE ... IF NOT EXISTS`, `CREATE OR REPLACE`, `DROP POLICY IF EXISTS`, bọc trong `BEGIN; ... COMMIT;`).
- **RPC atomic** (logic tiền/kho phải atomic ở DB để chống race condition):
  - `sale_decrement_stock_atomic` — trừ kho khi bán ([sql/2026-06-15_...](sql/2026-06-15_sale_decrement_stock_atomic.sql))
  - `work_order_complete_payment` — thanh toán phiếu + trừ kho ([sql/work_order_complete_payment.sql](sql/work_order_complete_payment.sql))
  - `sale_create_atomic` — tạo đơn bán có guard branch

### Bảo mật / RLS — ĐỌC TRƯỚC KHI THÊM BẢNG

Helper trong DB: `public.current_user_role()` → `owner|manager|staff`; `public.current_user_branch_id()` → mã chi nhánh.

**Quy tắc khi tạo bảng mới:**
1. `ALTER TABLE ... ENABLE ROW LEVEL SECURITY;`
2. **KHÔNG** dùng `CREATE POLICY ... FOR ALL USING (true)` (đây chính là lỗ hổng đã phải đi vá — xem [sql/2026-06-16_tighten_rls_sensitive_tables.sql](sql/2026-06-16_tighten_rls_sensitive_tables.sql)).
3. Policy đặt `TO authenticated` (chặn `anon`), và `REVOKE ALL ... FROM anon`.
4. Đọc/sửa theo vai trò + chi nhánh: owner xem tất cả, manager/staff giới hạn theo `current_user_branch_id()`. Dữ liệu nhạy cảm (lương) → chỉ owner/manager.
5. Tên cột chi nhánh không nhất quán giữa các bảng (`branchId` / `branchid` / `branch_id`). Trong SQL dùng `to_jsonb(<table>) ->> 'branchId'` (an toàn kể cả khi cột không tồn tại) thay vì tham chiếu cột trực tiếp.

> **Nợ bảo mật còn lại:** vài bảng tài chính vẫn để quyền **ghi** rộng cho `authenticated` vì client cập nhật số dư trực tiếp ([paymentSourcesRepository.updatePaymentSourceBalance](src/lib/repository/paymentSourcesRepository.ts#L30)). Follow-up: chuyển các mutation số dư/sổ cái sang RPC `SECURITY DEFINER` rồi siết chặt quyền ghi.

## Quy trình thêm một module nghiệp vụ mới

1. **DB**: tạo `sql/YYYY-MM-DD_<tên>.sql` (bảng + RLS theo quy tắc trên). Apply qua `apply-sql.mjs`.
2. **Types**: thêm type vào [src/types.ts](src/types.ts).
3. **Repository**: `src/lib/repository/<entity>Repository.ts` trả `RepoResult<T>`.
4. **Hook**: `src/hooks/use<Entity>Repository.ts` bọc React Query (đặt `queryKey` rõ ràng, `invalidateQueries` sau mutation).
5. **(Nếu là state dùng chung)**: nối vào AppContext qua `app/useAppState.ts` + actions.
6. **UI**: component trong `src/components/<domain>/`. Lazy-load qua `lazyImport` nếu lớn.
7. **Route**: thêm `<Route>` trong [App.tsx](src/App.tsx), bọc `<ProtectedRoute>` với `requiredRoles` hoặc `allow={({profile}) => canDo(...)}`. Thêm quyền mới vào `utils/permissions.ts`.
8. **Nav**: thêm mục vào [components/layout/NavComponents.tsx](src/components/layout/NavComponents.tsx) (và BottomNav cho mobile).
9. **Test**: tối thiểu test repository + unit logic ở `tests/`.

## Quy ước chất lượng (ESLint — [eslint.config.js](eslint.config.js))

- `max-lines`: cảnh báo ở **800 dòng/file**; `complexity`: 20; `max-lines-per-function`: 200. (Thư mục `lib/repository/**` được nới các luật này.)
- `no-console`: cảnh báo, chỉ cho phép `console.warn` / `console.error`.
- `@typescript-eslint/no-explicit-any`: hiện **off** (nợ kỹ thuật ~1.020 chỗ dùng `any`). Khi viết code MỚI, **không** thêm `any` — gõ kiểu đầy đủ.
- Có lint baseline ở `reports/lint-baseline.json`.

## ⚠️ Điểm nóng nợ kỹ thuật (tránh làm phình thêm — nên tách nhỏ khi đụng vào)

| File | Dòng | Ghi chú |
|---|---|---|
| [components/service/components/WorkOrderModal.tsx](src/components/service/components/WorkOrderModal.tsx) | ~4.840 | "God component" lớn nhất; 100+ chỗ `any`. Khi sửa nên trích logic ra hook/sub-component, kèm test. |
| [components/service/ServiceManager.tsx](src/components/service/ServiceManager.tsx) | ~3.710 | |
| [components/inventory/InventoryManager.tsx](src/components/inventory/InventoryManager.tsx) | ~3.170 | |

- Thư mục `components/inventory/components/` và `components/inventory/modals/` đang lẫn lộn, có file **re-export shim** (vd `components/InventoryHistoryModal.tsx` chỉ `export { default } from "../modals/..."`). Khi import modal kho, kiểm tra file "thật" nằm ở đâu trước.
- `~254` `console.log` còn trong code production — khi đụng file, gỡ bớt hoặc đổi sang `console.warn/error`.
