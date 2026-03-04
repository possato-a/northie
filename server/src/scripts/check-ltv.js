import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });
import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const { data: customers } = await supabase.from('customers').select('id, email, total_ltv');
let ok = 0, wrong = 0;
for (const c of customers || []) {
    const { data: txs } = await supabase
        .from('transactions')
        .select('amount_net')
        .eq('customer_id', c.id)
        .eq('status', 'approved');
    const realLtv = parseFloat(((txs || []).reduce((sum, t) => sum + Number(t.amount_net), 0)).toFixed(2));
    const storedLtv = parseFloat(Number(c.total_ltv).toFixed(2));
    const diff = Math.abs(realLtv - storedLtv);
    if (diff > 0.01) {
        console.log(`❌ LTV desatualizado — ${c.email}: stored=${storedLtv} real=${realLtv}`);
        wrong++;
    }
    else {
        console.log(`✅ ${c.email}: LTV=${storedLtv}`);
        ok++;
    }
}
console.log(`\nTotal: ${ok} corretos | ${wrong} desatualizados`);
//# sourceMappingURL=check-ltv.js.map