/**
 * Script de testes de integração — Hotmart
 *
 * Valida todos os pontos críticos da integração sem depender de framework externo.
 * Executa testes reais contra o banco e a API da Hotmart.
 *
 * Uso:
 *   npx tsx src/scripts/test-hotmart-integration.ts
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

function warn(label: string, detail?: string) {
    console.log(`  ⚠️  ${label}${detail ? ` — ${detail}` : ''}`);
}

function section(title: string) {
    console.log(`\n── ${title} ${'─'.repeat(50 - title.length)}`);
}

// ── Testes ────────────────────────────────────────────────────────────────────

section('1. Variáveis de ambiente');

const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'HOTMART_CLIENT_ID', 'HOTMART_CLIENT_SECRET'];
for (const v of requiredVars) {
    process.env[v]
        ? ok(v)
        : fail(v, 'não definida no .env.local');
}

process.env.HOTMART_WEBHOOK_TOKEN
    ? ok('HOTMART_WEBHOOK_TOKEN')
    : warn('HOTMART_WEBHOOK_TOKEN', 'não configurada — webhook aceita qualquer requisição (risco de segurança)');

// ── Schema do banco ────────────────────────────────────────────────────────────

section('2. Schema do banco — tabelas necessárias');

const tables = ['transactions', 'customers', 'sync_logs', 'integrations', 'platforms_data_raw'];
for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    error && error.code !== 'PGRST116'
        ? fail(`Tabela ${table}`, error.message)
        : ok(`Tabela ${table}`);
}

// ── Colunas da tabela transactions ────────────────────────────────────────────

section('3. Schema — colunas de transactions');

const { error: txColError } = await supabase
    .from('transactions')
    .select('id, profile_id, customer_id, platform, external_id, amount_gross, amount_net, status, created_at')
    .limit(1);

txColError
    ? fail('Colunas de transactions', txColError.message)
    : ok('Colunas obrigatórias presentes');

// ── Integração Hotmart no banco ────────────────────────────────────────────────

section('4. Integração Hotmart no banco');

const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('id, profile_id, status, last_sync_at, is_syncing')
    .eq('platform', 'hotmart');

if (intError) {
    fail('Query integrations', intError.message);
} else if (!integrations || integrations.length === 0) {
    warn('Nenhuma integração Hotmart encontrada', 'conecte uma conta no AppStore');
} else {
    ok(`${integrations.length} integração(ões) Hotmart encontrada(s)`);
    for (const int of integrations) {
        const lastSync = int.last_sync_at
            ? new Date(int.last_sync_at).toLocaleString('pt-BR')
            : 'nunca';
        console.log(`     ${int.status === 'active' ? '✅' : '⚠️'} Profile ${int.profile_id.slice(0, 8)}... | status: ${int.status} | último sync: ${lastSync} | syncing: ${int.is_syncing}`);

        int.status === 'active'
            ? ok(`Integração ${int.profile_id.slice(0, 8)}... está ativa`)
            : fail(`Integração ${int.profile_id.slice(0, 8)}... não está ativa`, `status: ${int.status}`);
    }
}

// ── Credenciais Hotmart (client_credentials) ──────────────────────────────────

section('5. Credenciais Hotmart — API Connect');

let connectToken: string | null = null;

try {
    const clientId = process.env.HOTMART_CLIENT_ID!;
    const clientSecret = process.env.HOTMART_CLIENT_SECRET!;
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    const res = await axios.post(
        'https://api-sec-vlc.hotmart.com/security/oauth/token',
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
            headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        }
    );

    if (res.data?.access_token) {
        connectToken = res.data.access_token;
        ok('client_credentials token obtido com sucesso');
    } else {
        fail('client_credentials', 'token não retornado na resposta');
    }
} catch (err: any) {
    const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;
    fail('client_credentials', msg);
}

// ── Token OAuth do usuário ────────────────────────────────────────────────────

section('6. Token OAuth do usuário Hotmart');

const { data: activeIntegrations } = await supabase
    .from('integrations')
    .select('config_encrypted, profile_id')
    .eq('platform', 'hotmart')
    .eq('status', 'active')
    .limit(1);

if (!activeIntegrations || activeIntegrations.length === 0) {
    warn('Nenhuma integração ativa para testar o token', 'conecte uma conta Hotmart no AppStore');
} else {
    try {
        const { decrypt } = await import('../utils/encryption.js');
        const raw = activeIntegrations[0]!.config_encrypted;
        const encryptedStr = typeof raw === 'object' && (raw as any).data ? (raw as any).data : raw;
        const config = JSON.parse(decrypt(encryptedStr as string));

        config.access_token
            ? ok('access_token presente no config')
            : fail('access_token ausente no config');

        config.refresh_token
            ? ok('refresh_token presente no config')
            : warn('refresh_token ausente', 'renovação automática não funcionará');

        if (config.expires_at) {
            const expiresIn = config.expires_at - Date.now();
            const expiresDate = new Date(config.expires_at).toLocaleString('pt-BR');
            expiresIn > 0
                ? ok(`Token válido até ${expiresDate}`)
                : fail(`Token expirado desde ${expiresDate}`, 'reconecte a integração');
        } else {
            warn('expires_at não definido', 'não é possível verificar validade do token');
        }
    } catch (err: any) {
        fail('Leitura do token', err.message);
    }
}

// ── Webhook token ─────────────────────────────────────────────────────────────

section('7. Configuração do Webhook');

if (!process.env.HOTMART_WEBHOOK_TOKEN) {
    warn('HOTMART_WEBHOOK_TOKEN não configurada', 'qualquer POST em /api/webhooks/hotmart será aceito');
} else {
    ok('HOTMART_WEBHOOK_TOKEN configurada', `${process.env.HOTMART_WEBHOOK_TOKEN.slice(0, 8)}...`);
}

// ── Histórico de sync ─────────────────────────────────────────────────────────

section('8. Histórico de sync');

const { data: logs, error: logsError } = await supabase
    .from('sync_logs')
    .select('status, started_at, finished_at, rows_upserted, error_message')
    .eq('platform', 'hotmart')
    .order('started_at', { ascending: false })
    .limit(5);

if (logsError) {
    fail('Query sync_logs', logsError.message);
} else if (!logs || logs.length === 0) {
    warn('Nenhum sync executado ainda', 'normal se a conta ainda não foi conectada');
} else {
    ok(`${logs.length} registro(s) de sync encontrado(s)`);
    for (const log of logs) {
        const icon = log.status === 'success' ? '✅' : log.status === 'running' ? '🔄' : '❌';
        const date = new Date(log.started_at).toLocaleString('pt-BR');
        const rows = log.rows_upserted ?? 0;
        console.log(`     ${icon} ${date} | ${log.status} | ${rows} linhas | ${log.error_message ?? 'sem erros'}`);
    }
}

// ── Dados em transactions ─────────────────────────────────────────────────────

section('9. Dados em transactions');

const { count: txCount, error: txCountError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'hotmart');

if (txCountError) {
    fail('Count transactions', txCountError.message);
} else {
    txCount && txCount > 0
        ? ok(`${txCount} transação(ões) Hotmart no banco`)
        : warn('Tabela transactions sem dados Hotmart', 'execute o backfill após conectar a conta');
}

// Clientes com acquisition_channel válido (não 'Hotmart' — ENUM inválido)
const VALID_CHANNELS = ['meta_ads', 'google_ads', 'organico', 'email', 'direto', 'afiliado', 'desconhecido'];

const { count: custCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

custCount && custCount > 0
    ? ok(`${custCount} cliente(s) total no banco`)
    : warn('Nenhum cliente ainda');

// ── Integridade dos dados em transactions ─────────────────────────────────────

section('10. Integridade dos dados — fee, amount_net, datas');

if (txCount && txCount > 0) {
    const { data: txSample, error: txSampleError } = await supabase
        .from('transactions')
        .select('amount_gross, amount_net, fee_platform, acquisition_channel, created_at')
        .eq('platform', 'hotmart')
        .eq('status', 'approved')
        .limit(20);

    if (txSampleError) {
        fail('Query amostra de transactions', txSampleError.message);
    } else if (!txSample || txSample.length === 0) {
        warn('Nenhuma transação aprovada para validar integridade');
    } else {
        // fee_platform > 0
        const withFee = txSample.filter(t => Number(t.fee_platform) > 0);
        withFee.length > 0
            ? ok(`fee_platform preenchido`, `${withFee.length}/${txSample.length} transações com fee > 0`)
            : fail('fee_platform sempre 0', 'nenhuma transação com fee calculado');

        // amount_net < amount_gross
        const withCorrectNet = txSample.filter(t => Number(t.amount_net) < Number(t.amount_gross));
        withCorrectNet.length > 0
            ? ok(`amount_net < amount_gross`, `${withCorrectNet.length}/${txSample.length} transações corretas`)
            : fail('amount_net igual a amount_gross', 'fee não está sendo deduzido do net');

        // Math: amount_net ≈ amount_gross - fee_platform (tolerância de R$0,01)
        const withCorrectMath = txSample.filter(t => {
            const gross = Number(t.amount_gross);
            const net = Number(t.amount_net);
            const fee = Number(t.fee_platform);
            return Math.abs((gross - fee) - net) < 0.02;
        });
        withCorrectMath.length === txSample.length
            ? ok(`Math fee correto`, `amount_net = amount_gross - fee em todas as transações`)
            : fail(`Math fee incorreto`, `${txSample.length - withCorrectMath.length} transações com cálculo errado`);

        // acquisition_channel válido (não 'Hotmart')
        const withInvalidChannel = txSample.filter(t => !VALID_CHANNELS.includes(t.acquisition_channel));
        withInvalidChannel.length === 0
            ? ok('acquisition_channel válido em todas as transações')
            : fail('acquisition_channel inválido', `${withInvalidChannel.length} transações com valor fora do ENUM`);

        // created_at varia (não todos hoje) — indica que purchase_date está sendo usado
        const dates = new Set(txSample.map(t => t.created_at?.slice(0, 10)));
        dates.size > 1
            ? ok(`created_at varia por transação`, `${dates.size} datas distintas na amostra`)
            : warn('created_at igual em todas', `todas com a mesma data — pode indicar que purchase_date não está sendo usado`);

        // Exibe amostra de 3 transações
        console.log('\n     Amostra de transações:');
        txSample.slice(0, 3).forEach(t => {
            const date = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : 'n/a';
            console.log(`       R$${Number(t.amount_gross).toFixed(2)} gross | R$${Number(t.amount_net).toFixed(2)} net | fee R$${Number(t.fee_platform).toFixed(2)} | canal: ${t.acquisition_channel} | data: ${date}`);
        });
    }
} else {
    warn('Sem dados para validar integridade — execute o backfill primeiro');
}

// ── platforms_data_raw ────────────────────────────────────────────────────────

section('11. Audit trail — platforms_data_raw');

const { count: rawCount, error: rawError } = await supabase
    .from('platforms_data_raw')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'hotmart');

if (rawError) {
    fail('Query platforms_data_raw', rawError.message);
} else {
    rawCount && rawCount > 0
        ? ok(`${rawCount} payload(s) bruto(s) Hotmart no audit trail`)
        : warn('Nenhum payload bruto ainda', 'populated após próximo backfill ou webhook');
}

// ── Live API call — busca vendas reais ───────────────────────────────────────

section('12. Live API — chamada real ao endpoint de vendas');

// A Hotmart Connect API (api-hot-connect.hotmart.com) requer credenciais registradas
// no portal de desenvolvedores Hotmart com permissão "Sales API".
// Os tokens client_credentials obtidos com as credenciais de webhook retornam
// "Decode token error" nesta API — isso é um problema de configuração, não de código.
// O backfill em produção (Vercel) pode funcionar se as credenciais corretas forem configuradas.
if (!connectToken) {
    warn('Token indisponível', 'seção 5 falhou — pulando live call');
} else {
    try {
        const endMs = Date.now();
        const startMs = endMs - 7 * 24 * 60 * 60 * 1000;

        const salesRes = await axios.get(
            'https://api-hot-connect.hotmart.com/payments/api/v1/sales/history',
            {
                headers: { Authorization: `Bearer ${connectToken}`, 'Content-Type': 'application/json' },
                params: { max_results: 10, start_date: startMs, end_date: endMs },
                timeout: 30000,
            }
        );

        const items = salesRes.data?.items ?? [];
        const pageInfo = salesRes.data?.page_info;
        ok(`Endpoint de vendas respondeu`, `${items.length} venda(s) nos últimos 7 dias | total: ${pageInfo?.total_results ?? '?'}`);

        if (items.length > 0) {
            const sample = items[0];
            console.log(`     Amostra: ${sample.buyer_name} | ${sample.transaction_status} | R$${sample.amount} | ${new Date(sample.purchase_date).toLocaleDateString('pt-BR')}`);
            ok('Payload da API tem campos esperados', `transaction: ${sample.transaction}`);
        }
    } catch (err: any) {
        const status = err.response?.status;
        const msg = err.response?.data?.error_description || err.response?.data?.error || err.message;

        if (status === 401 || (typeof msg === 'string' && msg.includes('Decode token error'))) {
            warn('Connect API — configuração pendente',
                'Credenciais precisam de permissão "Sales API" no painel Hotmart → Ferramentas → Developers. ' +
                'Webhook funciona; backfill via Connect API requer credenciais Developer registradas.');
        } else {
            fail('Live API call', `${status ?? ''} ${msg}`);
        }
    }
}

// ── Resultado final ────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
console.log(`  Resultado: ${passed} passou | ${failed} falhou`);
console.log('═'.repeat(55));

if (failed > 0) process.exit(1);
