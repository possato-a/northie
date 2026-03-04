/**
 * Script de testes de integração — Google Ads
 *
 * Valida todos os pontos críticos da integração sem depender de framework externo.
 * Executa verificações reais contra o banco e a API do Google.
 *
 * Uso:
 *   npx tsx src/scripts/test-google-integration.ts
 */
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });
import axios from 'axios';
import { createClient } from '@supabase/supabase-js';
// ── Setup ──────────────────────────────────────────────────────────────────────
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
let passed = 0;
let failed = 0;
function ok(label, detail) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
}
function fail(label, detail) {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
}
function warn(label, detail) {
    console.log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ''}`);
}
function section(title) {
    console.log(`\n── ${title} ${'─'.repeat(Math.max(2, 50 - title.length))}`);
}
// ── Testes ────────────────────────────────────────────────────────────────────
section('1. Variáveis de ambiente');
const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_ADS_DEVELOPER_TOKEN'];
for (const v of requiredVars) {
    process.env[v]
        ? ok(v)
        : fail(v, 'não definida no .env.local');
}
// ── Schema do banco ────────────────────────────────────────────────────────────
section('2. Schema do banco — tabelas necessárias');
const tables = ['integrations', 'ad_metrics', 'ad_campaigns', 'sync_logs'];
for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    error && error.code !== 'PGRST116'
        ? fail(`Tabela ${table}`, error.message)
        : ok(`Tabela ${table}`);
}
// ── Coluna google_customer_ids ─────────────────────────────────────────────────
section('3. Schema — coluna google_customer_ids');
const { data: colTest, error: colError } = await supabase
    .from('integrations')
    .select('google_customer_ids')
    .eq('platform', 'google')
    .limit(1);
if (colError) {
    fail('Coluna google_customer_ids', colError.message + ' — execute a migration 20260303000002_google_customer_ids.sql');
}
else {
    ok('Coluna google_customer_ids existe');
}
// ── Integração Google no banco ─────────────────────────────────────────────────
section('4. Integração Google no banco');
const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('id, profile_id, status, last_sync_at, is_syncing, google_customer_ids')
    .eq('platform', 'google');
if (intError) {
    fail('Query integrations', intError.message);
}
else if (!integrations || integrations.length === 0) {
    warn('Nenhuma integração Google encontrada', 'conecte uma conta Google Ads no AppStore');
}
else {
    ok(`${integrations.length} integração(ões) Google encontrada(s)`);
    for (const int of integrations) {
        const lastSync = int.last_sync_at
            ? new Date(int.last_sync_at).toLocaleString('pt-BR')
            : 'nunca';
        const ids = int.google_customer_ids || [];
        console.log(`     ${int.status === 'active' ? '✅' : '⚠️'} Profile ${int.profile_id.slice(0, 8)}... | status: ${int.status} | customer_ids: [${ids.join(', ')}] | último sync: ${lastSync}`);
        int.status === 'active'
            ? ok(`Integração ${int.profile_id.slice(0, 8)}... está ativa`)
            : fail(`Integração ${int.profile_id.slice(0, 8)}... não está ativa`, `status: ${int.status}`);
        ids.length > 0
            ? ok(`google_customer_ids preenchido`, `${ids.length} conta(s): ${ids.join(', ')}`)
            : fail('google_customer_ids vazio', 'reconecte a integração para re-descobrir as contas');
    }
}
// ── Token OAuth do usuário ─────────────────────────────────────────────────────
section('5. Token OAuth do usuário Google');
let userAccessToken = null;
const { data: activeIntegrations } = await supabase
    .from('integrations')
    .select('config_encrypted, profile_id, google_customer_ids')
    .eq('platform', 'google')
    .eq('status', 'active')
    .limit(1);
if (!activeIntegrations || activeIntegrations.length === 0) {
    warn('Nenhuma integração ativa para testar o token', 'conecte uma conta Google Ads no AppStore');
}
else {
    try {
        const { decrypt } = await import('../utils/encryption.js');
        const raw = activeIntegrations[0].config_encrypted;
        const encryptedStr = typeof raw === 'object' && raw.data ? raw.data : raw;
        const config = JSON.parse(decrypt(encryptedStr));
        if (config.access_token) {
            userAccessToken = config.access_token;
            ok('access_token presente no config');
        }
        else {
            fail('access_token ausente no config');
        }
        config.refresh_token
            ? ok('refresh_token presente no config')
            : warn('refresh_token ausente', 'renovação automática não funcionará');
        if (config.expires_at) {
            const expiresIn = config.expires_at - Date.now();
            const expiresDate = new Date(config.expires_at).toLocaleString('pt-BR');
            expiresIn > 0
                ? ok(`Token válido até ${expiresDate}`)
                : fail(`Token expirado desde ${expiresDate}`, 'reconecte a integração');
        }
        else if (config.expires_in) {
            ok('expires_in presente (token provavelmente válido)', `${config.expires_in}s`);
        }
        else {
            warn('expires_at e expires_in não definidos', 'não é possível verificar validade');
        }
    }
    catch (err) {
        fail('Leitura do token', err.message);
    }
}
// ── Live API — listAccessibleCustomers ────────────────────────────────────────
section('6. Live API — listAccessibleCustomers');
const devToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
if (!userAccessToken) {
    warn('Token indisponível', 'seção 5 falhou — pulando live calls');
}
else if (!devToken) {
    fail('GOOGLE_ADS_DEVELOPER_TOKEN', 'não configurada');
}
else {
    try {
        const customersRes = await axios.get('https://googleads.googleapis.com/v17/customers:listAccessibleCustomers', {
            headers: {
                Authorization: `Bearer ${userAccessToken}`,
                'developer-token': devToken,
            },
            timeout: 15000,
        });
        const resourceNames = customersRes.data?.resourceNames || [];
        const customerIds = resourceNames.map((r) => r.replace('customers/', ''));
        ok(`listAccessibleCustomers respondeu`, `${customerIds.length} conta(s) acessível(is)`);
        if (customerIds.length > 0) {
            console.log(`     Contas: ${customerIds.join(', ')}`);
        }
    }
    catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        fail(`listAccessibleCustomers (HTTP ${status})`, msg);
    }
}
// ── Live API — searchStream (campanha) ────────────────────────────────────────
section('7. Live API — searchStream (3 níveis: campaign, ad_group, ad)');
const customerIds = activeIntegrations?.[0]?.google_customer_ids || [];
async function testGoogleLevel(customerId, token, dToken, levelName, query) {
    try {
        const res = await axios.post(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`, { query }, {
            headers: {
                Authorization: `Bearer ${token}`,
                'developer-token': dToken,
                'Content-Type': 'application/json',
            },
            timeout: 30000,
        });
        const batches = res.data || [];
        let count = 0;
        let spendMicros = 0;
        for (const batch of batches) {
            for (const r of batch.results || []) {
                count++;
                spendMicros += parseInt(String(r.metrics?.costMicros || '0'), 10);
            }
        }
        ok(`${levelName} — searchStream OK`, `${count} linha(s) | R$${(spendMicros / 1_000_000).toFixed(2)} gasto (últimos 7 dias)`);
    }
    catch (err) {
        const status = err.response?.status;
        const msg = err.response?.data?.error?.message || err.message;
        if (status === 401) {
            fail(`${levelName} — token expirado (401)`, 'reconecte a integração Google no AppStore');
        }
        else {
            fail(`${levelName} — searchStream (HTTP ${status})`, msg);
        }
    }
}
if (!userAccessToken || !devToken) {
    warn('Token ou devToken indisponível', 'pulando teste de searchStream');
}
else if (customerIds.length === 0) {
    warn('google_customer_ids vazio', 'reconecte a integração para popular as contas');
}
else {
    const customerId = customerIds[0];
    const dateToday = new Date().toISOString().split('T')[0];
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    await testGoogleLevel(customerId, userAccessToken, devToken, 'Campaign level', `
        SELECT campaign.id, campaign.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks
        FROM campaign
        WHERE segments.date BETWEEN '${sevenDaysAgo}' AND '${dateToday}'
          AND campaign.status != 'REMOVED'
    `);
    await testGoogleLevel(customerId, userAccessToken, devToken, 'Ad Group level (adset)', `
        SELECT campaign.id, ad_group.id, ad_group.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks
        FROM ad_group
        WHERE segments.date BETWEEN '${sevenDaysAgo}' AND '${dateToday}'
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
    `);
    await testGoogleLevel(customerId, userAccessToken, devToken, 'Ad level', `
        SELECT campaign.id, ad_group.id, ad_group_ad.ad.id, ad_group_ad.ad.name, segments.date, metrics.cost_micros, metrics.impressions, metrics.clicks
        FROM ad_group_ad
        WHERE segments.date BETWEEN '${sevenDaysAgo}' AND '${dateToday}'
          AND campaign.status != 'REMOVED'
          AND ad_group.status != 'REMOVED'
          AND ad_group_ad.status != 'REMOVED'
    `);
}
// ── Dados em ad_metrics ───────────────────────────────────────────────────────
section('8. Dados em ad_metrics');
const { count: metricsCount, error: metricsError } = await supabase
    .from('ad_metrics')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'google');
if (metricsError) {
    fail('Count ad_metrics', metricsError.message);
}
else {
    metricsCount && metricsCount > 0
        ? ok(`${metricsCount} registro(s) Google em ad_metrics`)
        : warn('Nenhum dado Google em ad_metrics', 'execute o backfill: npx tsx src/scripts/backfill-google.ts <profileId>');
}
// ── Histórico de sync ─────────────────────────────────────────────────────────
section('9. Histórico de sync');
const { data: logs, error: logsError } = await supabase
    .from('sync_logs')
    .select('status, started_at, finished_at, rows_upserted, error_message')
    .eq('platform', 'google')
    .order('started_at', { ascending: false })
    .limit(5);
if (logsError) {
    fail('Query sync_logs', logsError.message);
}
else if (!logs || logs.length === 0) {
    warn('Nenhum sync executado ainda', 'normal se a conta ainda não foi conectada');
}
else {
    ok(`${logs.length} registro(s) de sync encontrado(s)`);
    for (const log of logs) {
        const icon = log.status === 'success' ? '✅' : log.status === 'running' ? '🔄' : '❌';
        const date = new Date(log.started_at).toLocaleString('pt-BR');
        const rows = log.rows_upserted ?? 0;
        console.log(`     ${icon} ${date} | ${log.status} | ${rows} linhas | ${log.error_message ?? 'sem erros'}`);
    }
}
// ── Resultado final ────────────────────────────────────────────────────────────
console.log(`\n${'═'.repeat(55)}`);
console.log(`  Resultado: ${passed} passou | ${failed} falhou`);
console.log('═'.repeat(55));
if (failed > 0)
    process.exit(1);
//# sourceMappingURL=test-google-integration.js.map