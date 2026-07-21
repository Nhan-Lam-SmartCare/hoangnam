import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function test() {
  console.log("Fetching one row from sales table with service role...");
  const { data, error } = await supabase.from('sales').select('*').limit(1);
  if (error) {
    console.error("Error fetching from sales:", error);
  } else {
    console.log("Sales row data keys:", data.length > 0 ? Object.keys(data[0]) : "No rows found in sales table");
    if (data.length > 0) {
      console.log("Example row:", data[0]);
    }
  }

  console.log("\nFetching columns of sales table from information_schema...");
  const { data: cols, error: colsError } = await supabase.rpc('get_table_columns_not_exists_fallback', {}, { count: 'exact' }).limit(1);
  // Let's do a direct select on information_schema using a simple postgrest RPC if exists, or just query it:
  const { data: schemaCols, error: schemaError } = await supabase
    .from('sales')
    .select('*')
    .limit(1);
  
  // Since postgrest doesn't let us query information_schema directly easily without custom RPC,
  // let's try to select some columns and see if it fails:
  const checkFields = ['delivery_method', 'delivery_address', 'shipping_fee', 'cod_amount'];
  for (const f of checkFields) {
    const { error: fieldError } = await supabase.from('sales').select(f).limit(1);
    if (fieldError) {
      console.log(`Column ${f} does NOT exist:`, fieldError.message);
    } else {
      console.log(`Column ${f} EXISTS!`);
    }
  }
}

test();
