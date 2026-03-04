/**
 * @file jobs/shopify-sync.job.ts
 * Sincroniza histórico de pedidos e clientes da Shopify via REST Admin API.
 * Usa o mesmo pipeline de normalização do webhook (upsert transactions/customers),
 * garantindo idempotência via external_id (order ID).
 */
import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';
import { syncTransaction } from '../services/normalization.service.js';
const SHOPIFY_API_VERSION = '2024-01';
// ── Retry com backoff exponencial ─────────────────────────────────────────────
async function withRetry(fn, maxRetries = 4) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            const status = err.response?.status;
            if (status === 401 || status === 403)
                throw err;
            const isRetryable = status === 429 || (status >= 500 && status < 600) || !status;
            if (!isRetryable || attempt === maxRetries)
                throw err;
            const baseDelay = Math.pow(2, attempt + 1) * 1000;
            const jitter = Math.random() * 1000;
            console.warn(`[ShopifySync] Retry ${attempt + 1}/${maxRetries} após ${Math.round((baseDelay + jitter) / 1000)}s (status ${status ?? 'network error'})`);
            await new Promise(r => setTimeout(r, baseDelay + jitter));
        }
    }
    throw lastError;
}
// ── Sync log helpers ──────────────────────────────────────────────────────────
async function startSyncLog(profileId) {
    const { data, error } = await supabase
        .from('sync_logs')
        .insert({ profile_id: profileId, platform: 'shopify', started_at: new Date().toISOString(), status: 'running' })
        .select('id')
        .single();
    if (error) {
        console.warn('[ShopifySync] Failed to create sync_log entry:', error.message);
        return null;
    }
    return data?.id ?? null;
}
async function finishSyncLog(logId, rowsUpserted, errorMessage) {
    if (!logId)
        return;
    await supabase
        .from('sync_logs')
        .update({
        finished_at: new Date().toISOString(),
        status: errorMessage ? 'error' : 'success',
        rows_upserted: rowsUpserted,
        error_message: errorMessage ?? null,
    })
        .eq('id', logId);
}
// ── Mutex anti-paralelo ───────────────────────────────────────────────────────
async function acquireSyncMutex(profileId) {
    const STALE_MINUTES = 30;
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('integrations')
        .update({ is_syncing: true, sync_started_at: new Date().toISOString() })
        .eq('profile_id', profileId)
        .eq('platform', 'shopify')
        .or(`is_syncing.eq.false,sync_started_at.lt.${staleThreshold}`)
        .select('id')
        .single();
    if (error || !data) {
        console.log(`[ShopifySync] Sync already running for profile ${profileId} — skipping`);
        return false;
    }
    return true;
}
async function releaseSyncMutex(profileId) {
    await supabase
        .from('integrations')
        .update({ is_syncing: false, sync_started_at: null })
        .eq('profile_id', profileId)
        .eq('platform', 'shopify');
}
// ── Pagination helper ─────────────────────────────────────────────────────────
/**
 * Extrai a URL da próxima página do Link header da Shopify.
 * Formato: <https://...?page_info=xxx>; rel="next"
 */
function getNextPageUrl(linkHeader) {
    if (!linkHeader)
        return null;
    const match = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? (match[1] ?? null) : null;
}
// ── Fetch ─────────────────────────────────────────────────────────────────────
/**
 * Busca todos os pedidos de uma loja Shopify com paginação por cursor.
 * Itera enquanto houver Link header com rel="next".
 */
async function fetchAllOrders(shop, token, createdAtMin) {
    const all = [];
    let url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`
        + `?status=any&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`;
    while (url) {
        const res = await withRetry(() => axios.get(url, {
            headers: { 'X-Shopify-Access-Token': token },
            timeout: 30000,
        }));
        const orders = res.data?.orders ?? [];
        all.push(...orders);
        url = getNextPageUrl(res.headers['link']);
        console.log(`[ShopifySync] Page fetched: ${orders.length} orders. Total: ${all.length}`);
    }
    return all;
}
// ── Process order ─────────────────────────────────────────────────────────────
async function processOrder(profileId, order) {
    if (order.financial_status !== 'paid')
        return 'skipped';
    const email = order.email || order.customer?.email;
    if (!email) {
        console.warn(`[ShopifySync] Order ${order.id} sem email — ignorando`);
        return 'skipped';
    }
    const externalId = String(order.id);
    // Idempotência: evita reprocessar ordens já existentes
    const { data: existing } = await supabase
        .from('transactions')
        .select('id')
        .eq('profile_id', profileId)
        .eq('external_id', externalId)
        .single();
    if (existing)
        return 'skipped';
    const amountGross = parseFloat(order.total_price);
    const tax = parseFloat(order.total_tax || '0');
    const noteAttrs = order.note_attributes ?? [];
    const visitorId = noteAttrs.find(a => a.name === 'northie_vid')?.value;
    const productName = order.line_items?.[0]
        ? [order.line_items[0].title, order.line_items[0].variant_title].filter(Boolean).join(' — ')
        : undefined;
    const customerName = [order.customer?.first_name, order.customer?.last_name].filter(Boolean).join(' ') || undefined;
    const phone = order.customer?.phone || undefined;
    await syncTransaction(profileId, email, 'shopify', externalId, amountGross, visitorId, tax, {
        productName,
        customerName,
        phone,
        createdAt: order.created_at,
    });
    return 'synced';
}
// ── Process refund ────────────────────────────────────────────────────────────
async function processRefundedOrder(profileId, order) {
    const email = order.email || order.customer?.email;
    const externalId = String(order.id);
    const { data: tx } = await supabase
        .from('transactions')
        .select('id, customer_id, amount_net, status')
        .eq('profile_id', profileId)
        .eq('external_id', externalId)
        .single();
    if (!tx || tx.status === 'refunded')
        return 'skipped';
    await supabase.from('transactions').update({ status: 'refunded' }).eq('id', tx.id);
    if (tx.customer_id) {
        const { data: cust } = await supabase.from('customers').select('total_ltv').eq('id', tx.customer_id).single();
        if (cust) {
            const newLtv = Math.max(0, (Number(cust.total_ltv) || 0) - Number(tx.amount_net));
            await supabase.from('customers').update({ total_ltv: newLtv }).eq('id', tx.customer_id);
        }
    }
    console.log(`[ShopifySync] Refund applied for order ${externalId} (${email})`);
    return 'refunded';
}
async function fetchRefundedOrders(shop, token, createdAtMin) {
    const all = [];
    let url = `https://${shop}/admin/api/${SHOPIFY_API_VERSION}/orders.json`
        + `?status=any&financial_status=refunded&limit=250&created_at_min=${encodeURIComponent(createdAtMin)}`;
    while (url) {
        const res = await withRetry(() => axios.get(url, { headers: { 'X-Shopify-Access-Token': token }, timeout: 30000 }));
        const orders = res.data?.orders ?? [];
        all.push(...orders);
        url = getNextPageUrl(res.headers['link']);
    }
    return all;
}
// ── Backfill ──────────────────────────────────────────────────────────────────
/**
 * Backfill de pedidos Shopify para um perfil.
 * - days=0 ou undefined: busca os últimos 365 dias
 * - days=N: busca os últimos N dias
 */
export async function backfillShopify(profileId, days) {
    const effectiveDays = (!days || days <= 0) ? 365 : days;
    const createdAtMin = new Date(Date.now() - effectiveDays * 24 * 60 * 60 * 1000).toISOString();
    const integration = await IntegrationService.getIntegration(profileId, 'shopify');
    if (!integration) {
        throw new Error(`[ShopifySync] No Shopify integration for profile ${profileId}`);
    }
    const token = integration.access_token;
    const shop = integration.shop_domain;
    if (!token || !shop) {
        throw new Error(`[ShopifySync] Missing access_token or shop_domain for profile ${profileId}`);
    }
    const acquired = await acquireSyncMutex(profileId);
    if (!acquired)
        return { synced: 0, skipped: 0, errors: 0 };
    const logId = await startSyncLog(profileId);
    console.log(`[ShopifySync] Starting backfill for profile ${profileId} — last ${effectiveDays} days (shop: ${shop})`);
    let synced = 0;
    let skipped = 0;
    let errors = 0;
    try {
        // 1. Pedidos pagos
        const orders = await fetchAllOrders(shop, token, createdAtMin);
        console.log(`[ShopifySync] Fetched ${orders.length} orders for profile ${profileId}`);
        for (const order of orders) {
            try {
                const result = await processOrder(profileId, order);
                result === 'synced' ? synced++ : skipped++;
                // Audit trail (best-effort)
                supabase
                    .from('platforms_data_raw')
                    .insert({ profile_id: profileId, platform: 'shopify', payload: order, processed: true })
                    .then(({ error }) => {
                    if (error)
                        console.warn(`[ShopifySync] platforms_data_raw insert failed for order ${order.id}:`, error.message);
                });
            }
            catch (e) {
                console.error(`[ShopifySync] Error processing order ${order.id}:`, e.message);
                errors++;
            }
        }
        // 2. Pedidos reembolsados — garante que reembolsos históricos são refletidos no LTV
        const refundedOrders = await fetchRefundedOrders(shop, token, createdAtMin);
        console.log(`[ShopifySync] Fetched ${refundedOrders.length} refunded orders for profile ${profileId}`);
        for (const order of refundedOrders) {
            try {
                await processRefundedOrder(profileId, order);
            }
            catch (e) {
                console.error(`[ShopifySync] Error processing refund for order ${order.id}:`, e.message);
                errors++;
            }
        }
        console.log(`[ShopifySync] Done for ${profileId}: ${synced} synced, ${skipped} skipped, ${errors} errors`);
        await finishSyncLog(logId, synced);
    }
    catch (e) {
        console.error(`[ShopifySync] Backfill failed for ${profileId}:`, e.response?.data ?? e.message);
        await finishSyncLog(logId, synced, e.message);
        throw e;
    }
    finally {
        await releaseSyncMutex(profileId);
    }
    return { synced, skipped, errors };
}
// ── Cron job ──────────────────────────────────────────────────────────────────
/**
 * Roda o backfill dos últimos 7 dias para todos os perfis com integração
 * Shopify ativa. Chamado pelo cron diário.
 */
export async function runShopifySyncForAllProfiles() {
    console.log('[ShopifySync] Running incremental sync for all profiles...');
    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'shopify')
        .eq('status', 'active');
    if (error || !integrations?.length) {
        console.log('[ShopifySync] No active Shopify integrations to sync.');
        return;
    }
    console.log(`[ShopifySync] Starting scheduled sync for ${integrations.length} profile(s)`);
    for (const { profile_id } of integrations) {
        try {
            await backfillShopify(profile_id, 7);
        }
        catch (e) {
            console.error(`[ShopifySync] Cron sync failed for profile ${profile_id}:`, e.message);
        }
    }
    console.log('[ShopifySync] Incremental sync complete.');
}
// ── Cron job scheduler ────────────────────────────────────────────────────────
/**
 * Inicia o cron diário de sync Shopify (roda às 04:30).
 * Chamado uma vez no startup do servidor local.
 */
export function startShopifySyncJob() {
    const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24h
    const now = new Date();
    const nextRun = new Date();
    nextRun.setHours(4, 30, 0, 0);
    if (nextRun <= now)
        nextRun.setDate(nextRun.getDate() + 1);
    const delay = nextRun.getTime() - now.getTime();
    console.log(`[ShopifySync] Cron job scheduled — next run at ${nextRun.toISOString()}`);
    setTimeout(() => {
        runShopifySyncForAllProfiles();
        setInterval(runShopifySyncForAllProfiles, INTERVAL_MS);
    }, delay);
}
//# sourceMappingURL=shopify-sync.job.js.map