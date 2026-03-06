/**
 * Script de testes de integração — Meta Ads
 *
 * Valida todos os pontos críticos da integração sem depender de framework externo.
 * Executa testes reais contra o banco e a API do Meta.
 *
 * Uso:
 *   npx tsx src/scripts/test-meta-integration.ts
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../../.env.local') });

import axios from 'axios';
import { createClient } from '@supabase/supabase-js';

// ── Setup ──────────────────────────────────────────────────────────────────────

const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

let passed = 0;
let failed = 0;

function ok(label: string, detail?: string) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ''}`);
    passed++;
}

function fail(label: string, detail?: string) {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ''}`);
    failed++;
}

function section(title: string) {
    console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`);
}

// ── Testes ────────────────────────────────────────────────────────────────────

section('1. Variáveis de ambiente');

const envVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'META_APP_ID', 'META_APP_SECRET', 'ENCRYPTION_KEY'];
for (const v of envVars) {
    process.env[v]
        ? ok(v)
        : fail(v, 'não definida no .env.local');
}

// ── Schema do banco ────────────────────────────────────────────────────────────

section('2. Schema do banco — tabela ad_campaigns');

const expectedColumns = [
    'id', 'profile_id', 'platform', 'campaign_id', 'campaign_name',
    'adset_id', 'adset_name', 'ad_id', 'ad_name', 'level', 'status',
    'objective', 'date', 'spend_brl', 'impressions', 'reach', 'clicks',
    'ctr', 'cpc_brl', 'cpm_brl', 'frequency',
    'purchases', 'purchase_value', 'leads', 'link_clicks',
    'landing_page_views', 'video_views', 'synced_at', 'created_at'
];

const { data: sampleRow, error: sampleError } = await supabase
    .from('ad_campaigns')
    .select('*')
    .limit(1);

if (sampleError && sampleError.code !== 'PGRST116') {
    fail('Conexão com ad_campaigns', sampleError.message);
} else {
    ok('Conexão com ad_campaigns');

    // Valida colunas críticas via tentativa de select explícito
    const conversionColumns = ['objective', 'purchases', 'purchase_value', 'leads', 'link_clicks', 'landing_page_views', 'video_views'];
    const { error: convColError } = await supabase
        .from('ad_campaigns')
        .select(conversionColumns.join(','))
        .limit(1);

    convColError
        ? fail('Colunas de conversão', convColError.message)
        : ok('Colunas de conversão presentes', conversionColumns.join(', '));
}

// ── Tabelas auxiliares ────────────────────────────────────────────────────────

section('3. Schema do banco — tabelas auxiliares');

const tables = ['sync_logs', 'integrations', 'ad_metrics', 'profiles'];
for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    error && error.code !== 'PGRST116'
        ? fail(`Tabela ${table}`, error.message)
        : ok(`Tabela ${table}`);
}

// ── Integração Meta ativa no banco ─────────────────────────────────────────────

section('4. Integração Meta Ads no banco');

const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('id, profile_id, status, last_sync_at')
    .eq('platform', 'meta');

if (intError) {
    fail('Query integrations', intError.message);
} else if (!integrations || integrations.length === 0) {
    fail('Nenhuma integração Meta encontrada', 'nenhuma conta conectada ainda');
} else {
    ok(`${integrations.length} integração(ões) Meta encontrada(s)`);

    for (const int of integrations) {
        const status = int.status === 'active' ? '✅' : '⚠️';
        const lastSync = int.last_sync_at
            ? new Date(int.last_sync_at).toLocaleString('pt-BR')
            : 'nunca';

        console.log(`     ${status} Profile ${int.profile_id.slice(0, 8)}... | status: ${int.status} | último sync: ${lastSync}`);

        int.status === 'active'
            ? ok(`Integração ${int.profile_id.slice(0, 8)}... está ativa`)
            : fail(`Integração ${int.profile_id.slice(0, 8)}... não está ativa`, `status: ${int.status}`);
    }
}

// ── Conectividade com a API do Meta ────────────────────────────────────────────

section('5. Conectividade com a API do Meta');

try {
    const appId = process.env.META_APP_ID;
    const appSecret = process.env.META_APP_SECRET;
    const appTokenResponse = await axios.get(
        `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`,
        { timeout: 10000 }
    );
    appTokenResponse.data?.access_token
        ? ok('Credenciais Meta App válidas', `App token obtido com sucesso`)
        : fail('Credenciais Meta App', 'token não retornado');
} catch (err: any) {
    const msg = err.response?.data?.error?.message || err.message;
    fail('Credenciais Meta App', msg);
}

// ── Token da conta Meta (se existir) ──────────────────────────────────────────

section('6. Token de acesso Meta Ads');

const { data: activeIntegrations } = await supabase
    .from('integrations')
    .select('config_encrypted, profile_id')
    .eq('platform', 'meta')
    .eq('status', 'active')
    .limit(1);

if (!activeIntegrations || activeIntegrations.length === 0) {
    console.log('  ⚠️  Nenhuma integração ativa para testar o token — conecte uma conta Meta no AppStore');
} else {
    try {
        const { decrypt } = await import('../utils/encryption.js');
        const raw = activeIntegrations[0]!.config_encrypted;
        // Supabase armazena como { data: "<string_encriptada>" }
        const encryptedStr = typeof raw === 'object' && raw.data ? raw.data : raw;
        const config = JSON.parse(decrypt(encryptedStr));
        const accessToken = config.access_token;

        if (!accessToken) {
            fail('Token de acesso', 'access_token não encontrado no config');
        } else {
            // Valida token via debug_token endpoint (funciona com user e system user tokens)
            const appId = process.env.META_APP_ID;
            const appSecret = process.env.META_APP_SECRET;
            const debugRes = await axios.get(
                `https://graph.facebook.com/debug_token?input_token=${accessToken}&access_token=${appId}|${appSecret}`,
                { timeout: 10000 }
            );
            const tokenData = debugRes.data?.data;
            if (tokenData?.is_valid) {
                const expiry = tokenData.expires_at
                    ? new Date(tokenData.expires_at * 1000).toLocaleDateString('pt-BR')
                    : 'nunca expira';
                ok('Token de acesso válido', `expira: ${expiry} | escopos: ${(tokenData.scopes || []).join(', ')}`);
            } else {
                fail('Token de acesso inválido', tokenData?.error?.message || 'token expirado ou revogado');
            }

            // Testa listagem de ad accounts
            const accountsRes = await axios.get(
                `https://graph.facebook.com/v25.0/me/adaccounts?access_token=${accessToken}&fields=id,name&limit=5`,
                { timeout: 10000 }
            ).catch(e => ({ data: { data: [] }, _error: e.response?.data?.error?.message }));

            const accounts = (accountsRes as any).data?.data || [];
            accounts.length > 0
                ? ok(`Ad accounts acessíveis`, accounts.map((a: any) => a.name).join(', '))
                : console.log(`  ⚠️  Ad accounts: não listados via /me/adaccounts (normal para system user tokens)`);
        }
    } catch (err: any) {
        const msg = err.response?.data?.error?.message || err.message;
        fail('Token de acesso Meta', msg);
    }
}

// ── Sync logs ─────────────────────────────────────────────────────────────────

section('7. Histórico de sync');

const { data: logs, error: logsError } = await supabase
    .from('sync_logs')
    .select('status, started_at, finished_at, rows_upserted, error_message')
    .eq('platform', 'meta')
    .order('started_at', { ascending: false })
    .limit(5);

if (logsError) {
    fail('Query sync_logs', logsError.message);
} else if (!logs || logs.length === 0) {
    console.log('  ⚠️  Nenhum sync executado ainda — normal se a conta ainda não foi conectada');
} else {
    ok(`${logs.length} registro(s) de sync encontrado(s)`);
    for (const log of logs) {
        const icon = log.status === 'success' ? '✅' : log.status === 'running' ? '🔄' : '❌';
        const date = new Date(log.started_at).toLocaleString('pt-BR');
        const rows = log.rows_upserted ?? 0;
        console.log(`     ${icon} ${date} | ${log.status} | ${rows} linhas | ${log.error_message ?? 'sem erros'}`);
    }
}

// ── Dados na tabela ad_campaigns ───────────────────────────────────────────────

section('8. Dados em ad_campaigns');

const { count, error: countError } = await supabase
    .from('ad_campaigns')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'meta');

if (countError) {
    fail('Count ad_campaigns', countError.message);
} else {
    count && count > 0
        ? ok(`${count} registro(s) Meta Ads na tabela ad_campaigns`)
        : console.log('  ⚠️  Tabela ad_campaigns sem dados Meta ainda — execute o backfill após conectar a conta');
}

// ── Resultado final ────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
console.log(`  Resultado: ${passed} passou | ${failed} falhou`);
console.log('═'.repeat(55));

if (failed > 0) process.exit(1);
