// Script to check database data for "Bộ heo dầu xe đạp"
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || '';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkInventoryData() {
    console.log('🔍 Checking inventory data for "Bộ heo dầu xe đạp"...\n');

    // 1. Check parts table
    const { data: parts, error: partsError } = await supabase
        .from('parts')
        .select('id, name, sku, stock, reserved')
        .ilike('name', '%Bộ heo dầu xe đạp%')
        .order('name');

    if (partsError) {
        console.error('❌ Error fetching parts:', partsError);
        return;
    }

    console.log('📦 PARTS TABLE:');
    console.log('================');
    parts?.forEach(part => {
        const branchId = 'CN1'; // Adjust if needed
        const stock = part.stock?.[branchId] || 0;
        const reserved = part.reserved?.[branchId] || 0;
        const available = stock - reserved;

        console.log(`\n${part.name}`);
        console.log(`  SKU: ${part.sku}`);
        console.log(`  Stock: ${stock}`);
        console.log(`  Reserved: ${reserved}`);
        console.log(`  Available: ${available} ✅`);
    });

    // 2. Check work order SC-20251220-619602
    console.log('\n\n📋 WORK ORDER SC-20251220-619602:');
    console.log('===================================');

    const { data: workOrder, error: woError } = await supabase
        .from('work_orders')
        .select('id, customerName, partsUsed, status, paymentStatus, creationDate')
        .eq('id', 'SC-20251220-619602')
        .single();

    if (woError) {
        console.error('❌ Error fetching work order:', woError);
    } else if (workOrder) {
        console.log(`Customer: ${workOrder.customerName}`);
        console.log(`Status: ${workOrder.status}`);
        console.log(`Payment Status: ${workOrder.paymentStatus}`);
        console.log(`Created: ${workOrder.creationDate}`);
        console.log('\nParts Used:');
        workOrder.partsUsed?.forEach((part: any) => {
            console.log(`  - ${part.partName}: ${part.quantity} cái`);
        });
    }

    // 3. Check inventory transactions for receipt NH-20251216-033
    console.log('\n\n📥 INVENTORY RECEIPT NH-20251216-033:');
    console.log('======================================');

    const { data: transactions, error: txError } = await supabase
        .from('inventory_transactions')
        .select('receiptCode, partName, quantity, unitPrice, date')
        .eq('receiptCode', 'NH-20251216-033')
        .order('partName');

    if (txError) {
        console.error('❌ Error fetching transactions:', txError);
    } else {
        transactions?.forEach(tx => {
            console.log(`\n${tx.partName}`);
            console.log(`  Quantity: ${tx.quantity}`);
            console.log(`  Unit Price: ${tx.unitPrice?.toLocaleString()} đ`);
            console.log(`  Date: ${tx.date}`);
        });
    }

    console.log('\n\n✅ Data check complete!');
}

checkInventoryData().catch(console.error);
