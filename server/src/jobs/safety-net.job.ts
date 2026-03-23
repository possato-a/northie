/**
 * @file jobs/safety-net.job.ts
 *
 * Reconciliação diária de integridade de dados.
 *
 * Roda uma vez por dia (3h da manhã, via setInterval após boot).
 * Para cada perfil com Hotmart ativo:
 *   1. Consulta o total de vendas aprovadas na API da Hotmart para os últimos 30 dias.
 *   2. Compara com o count de transactions no banco para o mesmo período.
 *   3. Se detectar gap (API > DB), dispara backfill forçado do período afetado.
 *   4. Registra o resultado em sync_logs para auditoria.
 *
 * Garante que falhas de webhook (timeout, deploy, network) não resultem em
 * dados perdidos permanentemente.
 */

import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { backfillHotmart } from './hotmart-sync.job.js';
import { backfillShopify } from './shopify-sync.job.js';
import { backfillStripe } from './stripe-sync.job.js';
import { IntegrationService } from '../services/integration.service.js';

const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';
const HOTMART_API_BASE = 'https://api-hot-connect.hotmart.com';

// ── Auth client credentials ────────────────────────────────────────────────

async function getClientCredentialsToken(): Promise<string> {
    const clientId = (process.env.HOTMART_CLIENT_ID || '').trim();
    const clientSecret = (process.env.HOTMART_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        throw new Error('[SafetyNet] HOTMART_CLIENT_ID ou HOTMART_CLIENT_SECRET não configurados');
    }
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await axios.post(
        HOTMART_AUTH_URL,
        new URLSearchParams({ grant_type: 'client_credentials' }),
        {
            headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000,
        }
    );
    const token: string | undefined = res.data?.access_token;
    if (!token) throw new Error('[SafetyNet] Hotmart não retornou access_token');
    return token;
}

// ── API count check (1 request, sem paginação) ────────────────────────────

async function getHotmartApiCount(
    accessToken: string,
    startMs: number,
    endMs: number
): Promise<number> {
    const res = await axios.get(`${HOTMART_API_BASE}/payments/api/v1/sales/history`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        params: {
            max_results: 1,
            start_date: startMs,
            end_date: endMs,
        },
        timeout: 20000,
    });
    // Hotmart retorna total_results no page_info
    return res.data?.page_info?.total_results ?? 0;
}

// ── DB count check ────────────────────────────────────────────────────────

async function getDbCount(profileId: string, startIso: string, endIso: string): Promise<number> {
    const { count } = await supabase
        .from('transactions')
        .select('id', { count: 'exact', head: true })
        .eq('profile_id', profileId)
        .eq('platform', 'hotmart')
        .eq('status', 'approved')
        .gte('created_at', startIso)
        .lte('created_at', endIso);
    return count ?? 0;
}

// ── Sync log ──────────────────────────────────────────────────────────────

async function logResult(
    profileId: string,
    apiCount: number,
    dbCount: number,
    backfillTriggered: boolean,
    gapFilled: number,
    error?: string
): Promise<void> {
    await supabase.from('sync_logs').insert({
        profile_id: profileId,
        platform: 'hotmart_safety_net',
        started_at: new Date().toISOString(),
        finished_at: new Date().toISOString(),
        status: error ? 'error' : 'success',
        rows_upserted: gapFilled,
        error_message: error ?? null,
        // Armazena detalhes no campo de metadados
        meta: JSON.stringify({ apiCount, dbCount, backfillTriggered, gap: apiCount - dbCount }),
    });
}

// ── Reconciliation for a single profile ──────────────────────────────────

async function reconcileProfile(profileId: string, accessToken: string): Promise<void> {
    const DAYS = 30;
    const endMs = Date.now();
    const startMs = endMs - DAYS * 24 * 60 * 60 * 1000;
    const startIso = new Date(startMs).toISOString();
    const endIso = new Date(endMs).toISOString();

    let apiCount = 0;
    let dbCount = 0;

    try {
        [apiCount, dbCount] = await Promise.all([
            getHotmartApiCount(accessToken, startMs, endMs),
            getDbCount(profileId, startIso, endIso),
        ]);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SafetyNet] Failed to fetch counts for ${profileId}:`, msg);
        await logResult(profileId, 0, 0, false, 0, msg);
        return;
    }

    const gap = apiCount - dbCount;
    console.log(`[SafetyNet] Profile ${profileId}: API=${apiCount}, DB=${dbCount}, gap=${gap}`);

    if (gap <= 0) {
        // Tudo sincronizado
        await logResult(profileId, apiCount, dbCount, false, 0);
        return;
    }

    // Gap detectado — dispara backfill forçado dos últimos 30 dias
    console.warn(`[SafetyNet] Gap de ${gap} transação(ões) para ${profileId} — disparando backfill`);
    try {
        const result = await backfillHotmart(profileId, DAYS, true /* force */);
        const filled = result.synced ?? 0;
        console.log(`[SafetyNet] Backfill completo para ${profileId}: ${filled} transação(ões) recuperada(s)`);
        await logResult(profileId, apiCount, dbCount, true, filled);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SafetyNet] Backfill falhou para ${profileId}:`, msg);
        await logResult(profileId, apiCount, dbCount, true, 0, msg);
    }
}

// ── Shopify Safety Net ────────────────────────────────────────────────────

/**
 * Conta pedidos pagos na API da Shopify para um período.
 * Usa /orders/count.json que retorna { count: N } sem paginação.
 */
async function getShopifyApiCount(
    shop: string,
    token: string,
    createdAtMin: string,
    createdAtMax: string
): Promise<number> {
    const res = await axios.get(
        `https://${shop}/admin/api/2026-01/orders/count.json`,
        {
            headers: { 'X-Shopify-Access-Token': token },
            params: { financial_status: 'paid', created_at_min: createdAtMin, created_at_max: createdAtMax },
            timeout: 20000,
        }
    );
    return res.data?.count ?? 0;
}

async function reconcileShopifyProfile(profileId: string): Promise<void> {
    const DAYS = 30;
    const endIso = new Date().toISOString();
    const startIso = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

    const integration = await IntegrationService.getIntegration(profileId, 'shopify');
    if (!integration) return;

    const token = integration.access_token;
    const shop = (integration as unknown as { shop_domain?: string }).shop_domain;
    if (!token || !shop) return;

    let apiCount = 0;
    let dbCount = 0;

    try {
        const { count } = await supabase
            .from('transactions')
            .select('id', { count: 'exact', head: true })
            .eq('profile_id', profileId)
            .eq('platform', 'shopify')
            .eq('status', 'approved')
            .gte('created_at', startIso)
            .lte('created_at', endIso);

        dbCount = count ?? 0;
        apiCount = await getShopifyApiCount(shop, token, startIso, endIso);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SafetyNet/Shopify] Failed to fetch counts for ${profileId}:`, msg);
        await supabase.from('sync_logs').insert({
            profile_id: profileId, platform: 'shopify_safety_net',
            started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
            status: 'error', rows_upserted: 0, error_message: msg,
        });
        return;
    }

    const gap = apiCount - dbCount;
    console.log(`[SafetyNet/Shopify] Profile ${profileId}: API=${apiCount}, DB=${dbCount}, gap=${gap}`);

    if (gap <= 0) {
        await supabase.from('sync_logs').insert({
            profile_id: profileId, platform: 'shopify_safety_net',
            started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
            status: 'success', rows_upserted: 0,
            meta: JSON.stringify({ apiCount, dbCount, backfillTriggered: false, gap: 0 }),
        });
        return;
    }

    console.warn(`[SafetyNet/Shopify] Gap de ${gap} pedido(s) para ${profileId} — disparando backfill`);
    try {
        const result = await backfillShopify(profileId, DAYS);
        console.log(`[SafetyNet/Shopify] Backfill completo para ${profileId}: ${result.synced} recuperado(s)`);
        await supabase.from('sync_logs').insert({
            profile_id: profileId, platform: 'shopify_safety_net',
            started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
            status: 'success', rows_upserted: result.synced,
            meta: JSON.stringify({ apiCount, dbCount, backfillTriggered: true, gap }),
        });
    } catch (err: unknown) {
        console.error(`[SafetyNet/Shopify] Backfill falhou para ${profileId}:`, err instanceof Error ? err.message : String(err));
    }
}

// ── Stripe Safety Net ─────────────────────────────────────────────────────

/**
 * Stripe não tem endpoint de count — roda backfill forçado de 30 dias.
 * É idempotente: transações já existentes são ignoradas via external_id.
 */
async function reconcileStripeProfile(profileId: string): Promise<void> {
    const DAYS = 30;

    let synced = 0;
    try {
        const result = await backfillStripe(profileId, DAYS);
        synced = result.synced;
        console.log(`[SafetyNet/Stripe] Profile ${profileId}: ${synced} recuperado(s), ${result.skipped} já existiam`);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[SafetyNet/Stripe] Backfill falhou para ${profileId}:`, msg);
        await supabase.from('sync_logs').insert({
            profile_id: profileId, platform: 'stripe_safety_net',
            started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
            status: 'error', rows_upserted: 0, error_message: msg,
        });
        return;
    }

    await supabase.from('sync_logs').insert({
        profile_id: profileId, platform: 'stripe_safety_net',
        started_at: new Date().toISOString(), finished_at: new Date().toISOString(),
        status: 'success', rows_upserted: synced,
        meta: JSON.stringify({ backfillDays: DAYS, synced }),
    });
}

async function runStripeReconciliation(): Promise<void> {
    const { data: integrations } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'stripe')
        .eq('status', 'active');

    if (!integrations?.length) return;

    console.log(`[SafetyNet/Stripe] Reconciling ${integrations.length} profile(s)...`);
    for (const { profile_id } of integrations) {
        try {
            await reconcileStripeProfile(profile_id);
        } catch (err: unknown) {
            console.error(`[SafetyNet/Stripe] Unhandled error for profile ${profile_id}:`, err instanceof Error ? err.message : String(err));
        }
    }
}

// ── Shopify reconciliation ─────────────────────────────────────────────────

async function runShopifyReconciliation(): Promise<void> {
    const { data: integrations } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'shopify')
        .eq('status', 'active');

    if (!integrations?.length) return;

    console.log(`[SafetyNet/Shopify] Reconciling ${integrations.length} profile(s)...`);
    for (const { profile_id } of integrations) {
        try {
            await reconcileShopifyProfile(profile_id);
        } catch (err: unknown) {
            console.error(`[SafetyNet/Shopify] Unhandled error for profile ${profile_id}:`, err instanceof Error ? err.message : String(err));
        }
    }
}

// ── Main runner ───────────────────────────────────────────────────────────

async function runSafetyNet(): Promise<void> {
    console.log('[SafetyNet] Starting daily reconciliation...');

    // Busca todos os perfis com Hotmart ativo
    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'hotmart')
        .eq('status', 'active');

    if (error || !integrations?.length) {
        console.log('[SafetyNet] No active Hotmart integrations — skipping.');
        return;
    }

    // Obtém token uma única vez para todas as contas
    let accessToken: string;
    try {
        accessToken = await getClientCredentialsToken();
    } catch (err: unknown) {
        console.error('[SafetyNet] Could not obtain Hotmart token:', err instanceof Error ? err.message : String(err));
        return;
    }

    for (const { profile_id } of integrations) {
        try {
            await reconcileProfile(profile_id, accessToken);
        } catch (err: unknown) {
            console.error(`[SafetyNet] Unhandled error for profile ${profile_id}:`, err instanceof Error ? err.message : String(err));
        }
    }

    await runShopifyReconciliation();
    await runStripeReconciliation();

    console.log('[SafetyNet] Reconciliation complete.');
}

// ── Job starter ───────────────────────────────────────────────────────────

export function startSafetyNetJob(): void {
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    // Aguarda 3 horas após boot para não competir com outros jobs no startup,
    // depois roda uma vez por dia.
    const INITIAL_DELAY_MS = 3 * 60 * 60 * 1000;

    console.log('[SafetyNet] Job registered — will run 3h after boot, then every 24h.');

    setTimeout(() => {
        runSafetyNet();
        setInterval(runSafetyNet, MS_PER_DAY);
    }, INITIAL_DELAY_MS);
}

export { runSafetyNet };
