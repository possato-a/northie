import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data } = await supabase
    .from('integrations')
    .select('config_encrypted')
    .eq('platform', 'hotmart')
    .eq('status', 'active')
    .limit(1);

const raw = data?.[0]?.config_encrypted as any;
const encryptedStr = typeof raw === 'object' && raw.data ? raw.data : raw;
const { decrypt } = await import('../utils/encryption.js');
const config = JSON.parse(decrypt(encryptedStr));
const userToken: string = config.access_token;

console.log('User token format:', userToken.startsWith('eyJ') ? 'JWT padrão' : 'outro: ' + userToken.slice(0, 20));

const endMs = Date.now();
const startMs = endMs - 30 * 24 * 60 * 60 * 1000;

console.log('\n─ Connect API com token OAuth do usuário (authorization_code)');
try {
    const res = await axios.get('https://api-hot-connect.hotmart.com/payments/api/v1/sales/history', {
        headers: { Authorization: `Bearer ${userToken}` },
        params: { max_results: 5, start_date: startMs, end_date: endMs },
        timeout: 30000,
    });
    console.log('✅', res.status, '| items:', res.data?.items?.length, '| total:', res.data?.page_info?.total_results);
    if (res.data?.items?.[0]) {
        const s = res.data.items[0];
        console.log('Amostra:', s.buyer_name, '|', s.transaction_status, '| R$' + s.amount);
    }
} catch (e: any) {
    console.log('❌', e.response?.status, JSON.stringify(e.response?.data));
}
