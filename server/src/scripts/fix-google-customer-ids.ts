/**
 * Script de reparo — popula google_customer_ids sem precisar reconectar
 * Detecta quais contas são MCC (manager) e quais são leaf, atualiza o banco.
 *
 * Uso: npx tsx src/scripts/fix-google-customer-ids.ts
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

import axios, { isAxiosError } from 'axios';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN!;

// 1. Busca integração ativa
const { data: integrations } = await supabase
    .from('integrations')
    .select('id, profile_id, config_encrypted')
    .eq('platform', 'google')
    .eq('status', 'active')
    .limit(1);

if (!integrations?.length) { console.error('Nenhuma integração Google ativa encontrada.'); process.exit(1); }

const integration = integrations[0]!;
const { decrypt } = await import('../utils/encryption.js');
const raw = integration.config_encrypted;
const encryptedStr = typeof raw === 'object' && (raw as any).data ? (raw as any).data : raw;
const config = JSON.parse(decrypt(encryptedStr as string));
const token: string = config.access_token;

console.log('Token obtido. Verificando contas acessíveis...');

// 2. Lista contas acessíveis
const customersRes = await axios.get(
    'https://googleads.googleapis.com/v23/customers:listAccessibleCustomers',
    { headers: { Authorization: `Bearer ${token}`, 'developer-token': devToken }, timeout: 15000 }
);
const resourceNames: string[] = customersRes.data?.resourceNames || [];
const candidateIds = resourceNames.map((r: string) => r.replace('customers/', ''));
console.log(`Contas encontradas: ${candidateIds.join(', ')}`);

// 3. Classifica MCC vs leaf
const leafIds: string[] = [];
let mccId: string | null = null;

for (const cid of candidateIds) {
    try {
        const res = await axios.post(
            `https://googleads.googleapis.com/v23/customers/${cid}/googleAds:searchStream`,
            { query: 'SELECT customer.id, customer.manager, customer.descriptive_name FROM customer' },
            {
                headers: {
                    Authorization: `Bearer ${token}`,
                    'developer-token': devToken,
                    'Content-Type': 'application/json',
                },
                timeout: 15000,
            }
        );
        const batches: any[] = res.data || [];
        for (const batch of batches) {
            for (const r of batch.results || []) {
                const isManager = r.customer?.manager;
                console.log(`  ${cid}: manager=${isManager}, nome="${r.customer?.descriptiveName || '—'}"`);
                if (isManager) { mccId = cid; } else { leafIds.push(cid); }
            }
        }
    } catch (err: unknown) {
        const status = isAxiosError(err) ? err.response?.status : undefined;
        const msg = isAxiosError(err) ? (err.response?.data?.error?.message || err.message) : (err instanceof Error ? err.message : String(err));
        console.log(`  ${cid}: erro ${status} — ${msg} (assumindo leaf)`);
        leafIds.push(cid);
    }
}

console.log(`\nLeaf IDs: [${leafIds.join(', ')}]`);
console.log(`MCC ID: ${mccId ?? 'nenhum'}`);

// 4. Atualiza a integração no banco
const updatePayload: any = { google_customer_ids: leafIds };
if (mccId) updatePayload.google_login_customer_id = mccId;

const { error } = await supabase.from('integrations').update(updatePayload).eq('id', integration.id);

if (error) {
    console.error('\n❌ Erro ao atualizar:', error);
    process.exit(1);
}

console.log('\n✅ google_customer_ids atualizado com sucesso!');
console.log('   Próximo passo: execute o backfill para importar o histórico:');
console.log(`   npx tsx src/scripts/backfill-google.ts ${integration.profile_id} 365`);
