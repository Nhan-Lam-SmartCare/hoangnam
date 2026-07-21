import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
  console.error("Missing credentials in env");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

async function test() {
  const { data, error } = await supabase.from('customers').select('*').limit(1);
  if (error) {
    console.error("Error fetching customers:", error);
  } else {
    console.log("Customer row keys:", data.length > 0 ? Object.keys(data[0]) : "No rows");
  }
}

test();
