import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = path.join(__dirname, '../phatthinh_parts.json');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing Supabase credentials in .env file');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function importData() {
    console.log('🚀 Starting import for Phat Thinh parts...');

    if (!fs.existsSync(INPUT_FILE)) {
        console.error('❌ Input file not found:', INPUT_FILE);
        return;
    }

    const rawData = fs.readFileSync(INPUT_FILE, 'utf8');
    const products = JSON.parse(rawData);
    console.log(`📂 Loaded ${products.length} products from JSON.`);

    // 1. Get existing URLs to avoid duplicates
    const { data: existingItems, error: fetchError } = await supabase
        .from('external_parts')
        .select('source_url');

    if (fetchError) {
        console.error('❌ Error fetching existing items:', fetchError);
        return;
    }

    const existingUrls = new Set(existingItems.map(item => item.source_url));
    console.log(`ℹ️ Found ${existingUrls.size} existing items in database.`);

    // 2. Filter new items
    const newItems = products.filter(p => p.source_url && !existingUrls.has(p.source_url));
    console.log(`✨ Found ${newItems.length} new items to insert.`);

    if (newItems.length === 0) {
        console.log('✅ No new items to insert.');
        return;
    }

    // 3. Insert in batches
    const BATCH_SIZE = 100;
    for (let i = 0; i < newItems.length; i += BATCH_SIZE) {
        const batch = newItems.slice(i, i + BATCH_SIZE);
        const { error: insertError } = await supabase
            .from('external_parts')
            .insert(batch);

        if (insertError) {
            console.error(`❌ Error inserting batch ${i}-${i + BATCH_SIZE}:`, insertError);
        } else {
            console.log(`   ✅ Inserted batch ${i / BATCH_SIZE + 1}/${Math.ceil(newItems.length / BATCH_SIZE)}`);
        }
    }

    console.log('🎉 Import completed!');
}

importData();
