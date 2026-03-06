/**
 * Script de testes de integração — Shopify
 *
 * Valida todos os pontos críticos da integração sem depender de framework externo.
 * Executa testes reais contra o banco e a API da Shopify.
 *
 * Uso:
 *   npx tsx src/scripts/test-shopify-integration.ts
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
    console.log(`\n── ${title} ${'─'.repeat(Math.max(0, 50 - title.length))}`);
}

// ── 1. Variáveis de ambiente ───────────────────────────────────────────────────

section('1. Variáveis de ambiente');

const requiredVars = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SHOPIFY_API_KEY', 'SHOPIFY_API_SECRET', 'SHOPIFY_WEBHOOK_SECRET', 'ENCRYPTION_KEY', 'BACKEND_URL'];
for (const v of requiredVars) {
    process.env[v]
        ? ok(v)
        : fail(v, 'não definida no .env.local');
}

// ── 2. Schema do banco — tabelas necessárias ───────────────────────────────────

section('2. Schema do banco — tabelas necessárias');

const tables = ['transactions', 'customers', 'sync_logs', 'integrations', 'platforms_data_raw'];
for (const table of tables) {
    const { error } = await supabase.from(table).select('id').limit(1);
    error && error.code !== 'PGRST116'
        ? fail(`Tabela ${table}`, error.message)
        : ok(`Tabela ${table}`);
}

// ── 3. Schema — colunas críticas de transactions ───────────────────────────────

section('3. Schema — colunas de transactions');

const { error: txColError } = await supabase
    .from('transactions')
    .select('id, profile_id, customer_id, platform, external_id, amount_gross, amount_net, fee_platform, status, created_at, northie_attribution_id, product_name')
    .limit(1);

txColError
    ? fail('Colunas de transactions', txColError.message)
    : ok('Colunas obrigatórias presentes (incl. product_name)');

// ── 4. Schema — shopify_shop_domain na tabela integrations ─────────────────────

section('4. Schema — shopify_shop_domain em integrations');

const { error: shopDomainError } = await supabase
    .from('integrations')
    .select('shopify_shop_domain')
    .limit(1);

shopDomainError
    ? fail('Coluna shopify_shop_domain ausente', shopDomainError.message + ' — aplique a migration 20260305000002_shopify_shop_domain.sql')
    : ok('Coluna shopify_shop_domain presente');

// ── 5. Schema — phone em customers ────────────────────────────────────────────

section('5. Schema — coluna phone em customers');

const { error: phoneError } = await supabase
    .from('customers')
    .select('phone')
    .limit(1);

phoneError
    ? warn('Coluna phone ausente', 'customer phone não será salvo')
    : ok('Coluna phone presente em customers');

// ── 6. Integração Shopify no banco ─────────────────────────────────────────────

section('6. Integração Shopify no banco');

const { data: integrations, error: intError } = await supabase
    .from('integrations')
    .select('id, profile_id, status, last_sync_at, is_syncing, shopify_shop_domain')
    .eq('platform', 'shopify');

if (intError) {
    fail('Query integrations', intError.message);
} else if (!integrations || integrations.length === 0) {
    warn('Nenhuma integração Shopify encontrada', 'conecte uma loja no AppStore para testar o pipeline completo');
} else {
    ok(`${integrations.length} integração(ões) Shopify encontrada(s)`);
    for (const int of integrations) {
        const lastSync = int.last_sync_at
            ? new Date(int.last_sync_at).toLocaleString('pt-BR')
            : 'nunca';
        const shopDomain = (int as any).shopify_shop_domain || 'não definido';
        console.log(`     ${int.status === 'active' ? '✅' : '⚠️'} Profile ${int.profile_id.slice(0, 8)}... | status: ${int.status} | shop: ${shopDomain} | último sync: ${lastSync} | syncing: ${int.is_syncing}`);

        int.status === 'active'
            ? ok(`Integração ${int.profile_id.slice(0, 8)}... ativa`)
            : fail(`Integração ${int.profile_id.slice(0, 8)}... não ativa`, `status: ${int.status}`);

        (int as any).shopify_shop_domain
            ? ok(`shop_domain salvo`, (int as any).shopify_shop_domain)
            : fail(`shop_domain ausente`, 'integração não funcionará sem o shop_domain');
    }
}

// ── 7. Token OAuth + conectividade com API Shopify ────────────────────────────

section('7. Token OAuth + API Shopify');

const { data: activeIntegrations } = await supabase
    .from('integrations')
    .select('config_encrypted, profile_id, shopify_shop_domain')
    .eq('platform', 'shopify')
    .eq('status', 'active')
    .limit(1);

let shopToken: string | null = null;
let shopDomain: string | null = null;
let activeProfileId: string | null = null;

if (!activeIntegrations || activeIntegrations.length === 0) {
    warn('Nenhuma integração ativa para testar o token', 'conecte uma loja Shopify no AppStore');
} else {
    try {
        const { decrypt } = await import('../utils/encryption.js');
        const raw = activeIntegrations[0]!.config_encrypted;
        const encryptedStr = typeof raw === 'object' && (raw as any).data ? (raw as any).data : raw;
        const config = JSON.parse(decrypt(encryptedStr as string));

        shopToken = config.access_token ?? null;
        shopDomain = (activeIntegrations[0] as any).shopify_shop_domain ?? null;
        activeProfileId = activeIntegrations[0]!.profile_id;

        shopToken
            ? ok('access_token presente no config')
            : fail('access_token ausente no config', 'reconecte a integração');

        shopDomain
            ? ok('shop_domain presente', shopDomain)
            : fail('shop_domain ausente no config');

        // Testa conectividade real com a API da loja
        if (shopToken && shopDomain) {
            try {
                const shopRes = await axios.get(
                    `https://${shopDomain}/admin/api/2026-01/shop.json`,
                    { headers: { 'X-Shopify-Access-Token': shopToken }, timeout: 10000 }
                );
                const shop = shopRes.data?.shop;
                shop
                    ? ok('API Shopify respondeu', `Loja: ${shop.name} | Moeda: ${shop.currency} | País: ${shop.country_name}`)
                    : fail('API Shopify', 'resposta vazia');
            } catch (err: any) {
                const status = err.response?.status;
                const msg = err.response?.data?.errors ?? err.message;
                status === 401
                    ? fail('Token inválido ou expirado', 'reconecte a integração no AppStore')
                    : fail(`API Shopify erro ${status}`, String(msg));
            }
        }
    } catch (err: any) {
        fail('Leitura do token', err.message);
    }
}

// ── 8. Webhooks registrados na loja ───────────────────────────────────────────

section('8. Webhooks registrados automaticamente');

const EXPECTED_TOPICS = ['orders/paid', 'orders/refunded', 'orders/cancelled', 'customers/create', 'customers/update'];

if (!shopToken || !shopDomain) {
    warn('Sem integração ativa — pulando verificação de webhooks');
} else {
    try {
        const whRes = await axios.get(
            `https://${shopDomain}/admin/api/2026-01/webhooks.json`,
            { headers: { 'X-Shopify-Access-Token': shopToken }, timeout: 10000 }
        );
        const webhooks: any[] = whRes.data?.webhooks ?? [];
        const registeredTopics = webhooks.map((w: any) => w.topic);

        ok(`${webhooks.length} webhook(s) registrado(s) na loja`);

        for (const topic of EXPECTED_TOPICS) {
            registeredTopics.includes(topic)
                ? ok(`Webhook ${topic}`)
                : fail(`Webhook ${topic} não registrado`, 'reconecte a integração para auto-registrar');
        }

        // Valida que o endpoint aponta para o backend correto
        const backendUrl = process.env.BACKEND_URL || 'https://northie.vercel.app';
        const wrongEndpoint = webhooks.filter((w: any) => !w.address.includes(backendUrl));
        wrongEndpoint.length === 0
            ? ok('Todos os webhooks apontam para o backend correto')
            : warn(`${wrongEndpoint.length} webhook(s) com endpoint desatualizado`, wrongEndpoint.map((w: any) => w.address).join(', '));
    } catch (err: any) {
        fail('Query webhooks Shopify', err.response?.data?.errors ?? err.message);
    }
}

// ── 9. Live API — pedidos reais ───────────────────────────────────────────────

section('9. Live API — pedidos reais (últimos 7 dias)');

if (!shopToken || !shopDomain) {
    warn('Sem integração ativa — pulando live API call');
} else {
    try {
        const createdAtMin = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const ordersRes = await axios.get(
            `https://${shopDomain}/admin/api/2026-01/orders.json`,
            {
                headers: { 'X-Shopify-Access-Token': shopToken },
                params: { status: 'any', limit: 5, created_at_min: createdAtMin },
                timeout: 15000,
            }
        );
        const orders: any[] = ordersRes.data?.orders ?? [];
        ok(`API de pedidos respondeu`, `${orders.length} pedido(s) nos últimos 7 dias`);

        if (orders.length > 0) {
            const sample = orders[0];
            const email = sample.email || sample.customer?.email || 'sem email';
            const productName = sample.line_items?.[0]?.title ?? 'sem produto';
            console.log(`     Amostra: #${sample.order_number} | ${email} | R$${sample.total_price} | ${sample.financial_status} | produto: ${productName}`);

            // Verifica campos que o pipeline usa
            sample.total_price ? ok('total_price presente') : fail('total_price ausente');
            sample.total_tax !== undefined ? ok('total_tax presente') : warn('total_tax ausente', 'fee_platform será 0');
            sample.line_items?.length > 0 ? ok('line_items presentes', `${sample.line_items.length} item(s)`) : warn('line_items vazio');
        }

        // Testa endpoint de contagem
        const countRes = await axios.get(
            `https://${shopDomain}/admin/api/2026-01/orders/count.json`,
            {
                headers: { 'X-Shopify-Access-Token': shopToken },
                params: { financial_status: 'paid' },
                timeout: 10000,
            }
        );
        const totalPaid = countRes.data?.count ?? 0;
        ok('Endpoint /orders/count.json funciona', `${totalPaid} pedido(s) pagos no total`);
    } catch (err: any) {
        fail('Live API pedidos', err.response?.data?.errors ?? err.message);
    }
}

// ── 10. Dados em transactions ─────────────────────────────────────────────────

section('10. Dados em transactions (Shopify)');

const { count: txCount, error: txCountError } = await supabase
    .from('transactions')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'shopify');

if (txCountError) {
    fail('Count transactions Shopify', txCountError.message);
} else {
    txCount && txCount > 0
        ? ok(`${txCount} transação(ões) Shopify no banco`)
        : warn('Nenhuma transação Shopify ainda', 'execute o backfill após conectar a conta');
}

// ── 11. Integridade dos dados ──────────────────────────────────────────────────

section('11. Integridade dos dados — amount_net, fee, created_at, product_name');

if (txCount && txCount > 0) {
    const { data: txSample, error: txSampleError } = await supabase
        .from('transactions')
        .select('amount_gross, amount_net, fee_platform, created_at, product_name, northie_attribution_id')
        .eq('platform', 'shopify')
        .eq('status', 'approved')
        .limit(20);

    if (txSampleError) {
        fail('Query amostra transactions', txSampleError.message);
    } else if (txSample && txSample.length > 0) {
        // amount_net <= amount_gross
        const correctNet = txSample.filter(t => Number(t.amount_net) <= Number(t.amount_gross));
        correctNet.length === txSample.length
            ? ok('amount_net ≤ amount_gross em todas', `${txSample.length}/${txSample.length}`)
            : fail('amount_net > amount_gross', `${txSample.length - correctNet.length} transações com valor incorreto`);

        // Math: amount_net = amount_gross - fee_platform (tolerância R$0,02)
        const correctMath = txSample.filter(t => {
            const gross = Number(t.amount_gross);
            const net = Number(t.amount_net);
            const fee = Number(t.fee_platform);
            return Math.abs((gross - fee) - net) < 0.02;
        });
        correctMath.length === txSample.length
            ? ok('Cálculo amount_net correto', 'amount_net = amount_gross − fee_platform')
            : fail('Cálculo amount_net incorreto', `${txSample.length - correctMath.length} transações com math errado`);

        // created_at varia (não todos hoje) — indica datas históricas preservadas
        const dates = new Set(txSample.map(t => t.created_at?.slice(0, 10)));
        dates.size > 1
            ? ok(`created_at histórico preservado`, `${dates.size} datas distintas na amostra`)
            : warn('Todas as transações com a mesma data', 'pode indicar que created_at histórico não está sendo usado');

        // product_name preenchido
        const withProduct = txSample.filter(t => t.product_name);
        withProduct.length > 0
            ? ok(`product_name preenchido`, `${withProduct.length}/${txSample.length} transações`)
            : warn('product_name vazio em todas', 'line_items pode estar ausente nos pedidos');

        // attribution (visitorId) — opcional mas desejável
        const withAttribution = txSample.filter(t => t.northie_attribution_id);
        console.log(`     ℹ️  Atribuição: ${withAttribution.length}/${txSample.length} transações com northie_attribution_id`);

        // Exibe amostra
        console.log('\n     Amostra de transações:');
        txSample.slice(0, 3).forEach(t => {
            const date = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : 'n/a';
            console.log(`       R$${Number(t.amount_gross).toFixed(2)} gross | R$${Number(t.amount_net).toFixed(2)} net | fee R$${Number(t.fee_platform).toFixed(2)} | produto: ${t.product_name ?? 'n/a'} | data: ${date}`);
        });
    }
} else {
    warn('Sem dados para validar integridade — execute o backfill primeiro');
}

// ── 12. Clientes Shopify ───────────────────────────────────────────────────────

section('12. Clientes sincronizados');

const { count: custCount } = await supabase
    .from('customers')
    .select('*', { count: 'exact', head: true });

custCount && custCount > 0
    ? ok(`${custCount} cliente(s) total no banco`)
    : warn('Nenhum cliente ainda');

// Verifica se clientes Shopify têm acquisition_channel definido
if (txCount && txCount > 0) {
    const { data: shopifyCustomers } = await supabase
        .from('customers')
        .select('acquisition_channel')
        .not('acquisition_channel', 'is', null)
        .limit(20);

    shopifyCustomers && shopifyCustomers.length > 0
        ? ok('Clientes com acquisition_channel definido', `${shopifyCustomers.length} amostra`)
        : warn('Nenhum cliente com acquisition_channel', 'attribution pode não estar funcionando');
}

// ── 13. Histórico de sync ──────────────────────────────────────────────────────

section('13. Histórico de sync');

const { data: logs, error: logsError } = await supabase
    .from('sync_logs')
    .select('status, started_at, finished_at, rows_upserted, error_message')
    .eq('platform', 'shopify')
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

    const lastSuccess = logs.find(l => l.status === 'success');
    lastSuccess
        ? ok('Último sync bem-sucedido', new Date(lastSuccess.started_at).toLocaleString('pt-BR'))
        : fail('Nenhum sync com status success', 'verifique os logs de erro');
}

// ── 14. Safety Net ─────────────────────────────────────────────────────────────

section('14. Safety Net');

const { data: safetyLogs } = await supabase
    .from('sync_logs')
    .select('status, started_at, rows_upserted, meta')
    .eq('platform', 'shopify_safety_net')
    .order('started_at', { ascending: false })
    .limit(3);

safetyLogs && safetyLogs.length > 0
    ? ok(`${safetyLogs.length} execução(ões) do Safety Net`, `último: ${new Date(safetyLogs[0]!.started_at).toLocaleString('pt-BR')}`)
    : warn('Safety Net ainda não executou', 'roda automaticamente 3h após o boot do servidor');

// ── 15. Audit trail ─────────────────────────────────────────────────────────────

section('15. Audit trail — platforms_data_raw');

const { count: rawCount, error: rawError } = await supabase
    .from('platforms_data_raw')
    .select('*', { count: 'exact', head: true })
    .eq('platform', 'shopify');

if (rawError) {
    fail('Query platforms_data_raw', rawError.message);
} else {
    rawCount && rawCount > 0
        ? ok(`${rawCount} payload(s) bruto(s) Shopify no audit trail`)
        : warn('Nenhum payload bruto ainda', 'populado após próximo backfill ou webhook');
}

// ── Resultado final ────────────────────────────────────────────────────────────

console.log(`\n${'═'.repeat(55)}`);
console.log(`  Resultado: ${passed} passou | ${failed} falhou`);
console.log('═'.repeat(55));

if (failed > 0) process.exit(1);
