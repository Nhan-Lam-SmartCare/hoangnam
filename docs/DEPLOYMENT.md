# Motocare Deployment Guide

This guide walks through deploying Motocare to a static host (Vercel / Netlify) with Supabase as the backend.

## 1. Prerequisites

- Node.js 18+
- Supabase project created (Dashboard -> New Project)
- Tables & RLS scripts applied (see `supabase_setup.sql` + the `sql/2025-*` RLS scripts)
- Your profile rows updated with proper `role` and `branch_id`

## 2. Environment Variables

Copy `.env.example` to `.env` locally, then add the same variables in Vercel/Netlify UI:

```
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
VITE_APP_NAME=Motocare
```

Never expose the service_role key in client builds.

## 3. Install and Build

```bash
npm install
npm run build
```

The production build emits static assets to `dist/`.

## 4. Deploy on Vercel

1. Import GitHub repository.
2. Framework preset: `Vite` (or just leave auto-detect).
3. Build Command: `npm run build`
4. Output Directory: `dist`
5. Environment Variables: add the values above.
6. Deploy.

## 5. Deploy on Netlify

1. New Site from Git.
2. Build Command: `npm run build`
3. Publish Directory: `dist`
4. Add environment variables.
5. Deploy.

## 6. Post-Deployment Checks

- Open the site: should load login and then app UI.
- Verify network calls to Supabase succeed (no 401/403).
- Create a sample sale to confirm RLS allows inserts for your role.
- Open DevTools (Console) to ensure no uncaught repository errors; if present they appear in the Repo Error Panel (dev only).

## 7. Recommended Production Indexes

Apply these (adjust table/column names if different) to improve analytics/reporting queries:

```sql
-- Sales filtering by branch/date
CREATE INDEX IF NOT EXISTS sales_branch_date_idx ON sales (branchId, date);
-- Cash transactions by branch/date/category
CREATE INDEX IF NOT EXISTS cash_transactions_branch_date_cat_idx ON cash_transactions (branchId, date, category);
-- Inventory transactions by branch/date
CREATE INDEX IF NOT EXISTS inventory_transactions_branch_date_idx ON inventory_transactions (branchId, date);
-- Work orders by branch/status
CREATE INDEX IF NOT EXISTS work_orders_branch_status_idx ON work_orders (branchId, status);
```

## 8. Seeding Roles & Branch

Ensure at least one `owner` row exists in `profiles` (or `user_profiles`):

```sql
UPDATE profiles SET role = 'owner', branch_id = 'CN1' WHERE email = 'you@example.com';
```

(Repeat for manager/staff as needed.)

## 9. Purging Cache / Re-deploys

- Any schema changes: run SQL migrations first, then redeploy frontend.
- Vercel: Use "Redeploy" button.
- Netlify: Trigger new build via commit.

## 10. Monitoring & Logs

- Use Supabase dashboard -> Logs to inspect PostgREST or Auth events.
- Add client-side logging if needed using a service (Sentry) – omit until required.

## 11. Troubleshooting

| Issue                | Cause                 | Fix                                                            |
| -------------------- | --------------------- | -------------------------------------------------------------- |
| 403 on table         | RLS policy mismatch   | Verify mc\_\* helper functions and branch/role columns present |
| Infinite loading     | Query error swallowed | Check Repo Error Panel locally; inspect Network tab            |
| Missing assets       | Wrong output dir      | Ensure `dist` is selected                                      |
| Owner actions denied | role not seeded       | Update role/branch_id for your profile                         |

## 12. Future Enhancements

- Add Sentry for error tracking.
- CI pipeline with automated Vitest + lint before deploy.
- Separate admin panel for auditing RLS policies.

---

Production deployment should now be stable. Keep schemas and indexes versioned for repeatability.
