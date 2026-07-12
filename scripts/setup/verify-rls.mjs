import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";

config();

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function run(label, sql) {
  const { data, error } = await supabase.rpc("exec_sql", { sql_query: sql });
  console.log("\n=== " + label + " ===");
  if (error) {
    console.log("ERROR:", error.message || error);
    return;
  }
  console.log(JSON.stringify(data, null, 2));
}

// 1) Policy mở con sot (ky vong: rong)
await run(
  "1. Open public policies (expect: empty)",
  `SELECT tablename, policyname, roles::text
   FROM pg_policies
   WHERE schemaname='public' AND policyname='Enable all access for all users'
   ORDER BY tablename;`
);

// 2) anon grants (ky vong: rong)
await run(
  "2. anon grants on public (expect: empty)",
  `SELECT table_name, string_agg(privilege_type, ',') AS privs
   FROM information_schema.role_table_grants
   WHERE grantee='anon' AND table_schema='public'
   GROUP BY table_name ORDER BY table_name;`
);

// 3) RLS status cac bang trong yeu
await run(
  "3. RLS status (expect all rls_enabled=true, policy_count>=1)",
  `SELECT c.relname AS table_name, c.relrowsecurity AS rls_enabled,
          (SELECT count(*) FROM pg_policies p
           WHERE p.schemaname='public' AND p.tablename=c.relname) AS policy_count
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r'
     AND c.relname IN ('notifications','repair_templates','categories','suppliers',
                       'cash_transactions','payment_sources','inventory_transactions',
                       'payroll_records','sales','work_orders','audit_logs',
                       'services','repair_order_services','repair_order_service_workers',
                       'repair_order_service_items','customers','warranty_cards','warranty_claims')
   ORDER BY c.relname;`
);

// 4) Tables in public with RLS OFF (ky vong: chi con view/bang tham chieu co y)
await run(
  "4. Tables with RLS OFF (review each)",
  `SELECT c.relname AS table_name
   FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity=false
   ORDER BY c.relname;`
);

// 5) Cac RPC atomic (ky vong: du bo)
await run(
  "5. Atomic RPCs present",
  `SELECT proname, prosecdef AS security_definer
   FROM pg_proc
   WHERE proname IN ('sale_create_atomic','sale_decrement_stock_atomic',
                     'sale_increment_stock_atomic','work_order_complete_payment',
                     'adjust_payment_source_balance_atomic','create_customer_metrics_atomic',
                     'upsert_repair_order_labor_bundle','recalculate_repair_order_labor_totals')
   ORDER BY proname;`
);

console.log("\nDONE.");
