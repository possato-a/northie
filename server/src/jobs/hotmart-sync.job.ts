/**
 * @file jobs/hotmart-sync.job.ts
 * Sincroniza histórico de vendas da Hotmart via REST API.
 * Usa o mesmo pipeline de normalização do webhook (syncTransaction),
 * garantindo idempotência via external_id (transaction code).
 */

import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

const HOTMART_API_BASE = 'https://developers.hotmart.com';
const HOTMART_AUTH_URL = 'https://api-sec-vlc.hotmart.com/security/oauth/token';

// Taxa padrão Hotmart para produtores (9,9%). Usada no backfill pois a API
// de histórico não retorna o breakdown de taxas — apenas o gross amount.
const HOTMART_FEE_RATE = 0.099;

// ── Retry com backoff exponencial ─────────────────────────────────────────────

/**
 * Executa uma chamada com retry automático em caso de rate limit (429)
 * ou erros transitórios (5xx). Usa backoff exponencial com jitter.
 */
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    let lastError: unknown = null;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        } catch (err: unknown) {
            lastError = err;
            const axiosErr = err as { response?: { status?: number } };
            const status = axiosErr.response?.status;
            if (status === 401 || status === 403) throw err;
            const isRetryable = status === 429 || (status !== undefined && status >= 500 && status < 600) || !status;
            if (!isRetryable || attempt === maxRetries) throw err;
            const baseDelay = Math.pow(2, attempt + 1) * 1000;
            const jitter = Math.random() * 1000;
            console.warn(`[HotmartSync] Retry ${attempt + 1}/${maxRetries} após ${Math.round((baseDelay + jitter) / 1000)}s (status ${status ?? 'network error'})`);
            await new Promise(r => setTimeout(r, baseDelay + jitter));
        }
    }
    throw lastError;
}

// ── Sync log helpers ──────────────────────────────────────────────────────────

async function startSyncLog(profileId: string): Promise<string | null> {
    const { data, error } = await supabase
        .from('sync_logs')
        .insert({ profile_id: profileId, platform: 'hotmart', started_at: new Date().toISOString(), status: 'running' })
        .select('id')
        .single();
    if (error) {
        console.warn('[HotmartSync] Failed to create sync_log entry:', error.message);
        return null;
    }
    return data?.id ?? null;
}

async function finishSyncLog(logId: string | null, rowsUpserted: number, errorMessage?: string): Promise<void> {
    if (!logId) return;
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

/**
 * Tenta adquirir o mutex de sync para a integração Hotmart.
 * Retorna true se adquiriu (pode prosseguir), false se já está em andamento.
 * Syncs travados há mais de 30 minutos são considerados mortos e liberados.
 */
async function acquireSyncMutex(profileId: string): Promise<boolean> {
    const STALE_MINUTES = 30;
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('integrations')
        .update({ is_syncing: true, sync_started_at: new Date().toISOString() })
        .eq('profile_id', profileId)
        .eq('platform', 'hotmart')
        .or(`is_syncing.eq.false,sync_started_at.lt.${staleThreshold}`)
        .select('id')
        .single();
    if (error || !data) {
        console.log(`[HotmartSync] Sync already running for profile ${profileId} — skipping`);
        return false;
    }
    return true;
}

async function releaseSyncMutex(profileId: string): Promise<void> {
    await supabase
        .from('integrations')
        .update({ is_syncing: false, sync_started_at: null })
        .eq('profile_id', profileId)
        .eq('platform', 'hotmart');
}

// ── Auth ──────────────────────────────────────────────────────────────────────

/**
 * Obtém um access token via client_credentials.
 * A Hotmart Connect API (vendas) exige este tipo de token —
 * o token do fluxo authorization_code não tem permissão para essa API.
 */
async function getClientCredentialsToken(): Promise<string> {
    const clientId = (process.env.HOTMART_CLIENT_ID || '').trim();
    const clientSecret = (process.env.HOTMART_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        throw new Error('[HotmartSync] HOTMART_CLIENT_ID ou HOTMART_CLIENT_SECRET não configurados');
    }
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
    const res = await withRetry(() =>
        axios.post(
            HOTMART_AUTH_URL,
            new URLSearchParams({ grant_type: 'client_credentials' }),
            {
                headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
                timeout: 15000,
            }
        )
    );
    const token = res.data?.access_token;
    if (!token) throw new Error('Hotmart não retornou access_token via client_credentials');
    console.log('[HotmartSync] client_credentials token obtained successfully');
    return token;
}

// ── Status sets ───────────────────────────────────────────────────────────────

const APPROVED_STATUSES = new Set(['APPROVED', 'COMPLETE']);
const REFUNDED_STATUSES = new Set(['REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK', 'PROTESTED']);
const CANCELLED_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'NO_FUNDS', 'BLOCKED']);

// ── Types ─────────────────────────────────────────────────────────────────────

// ── Tipo real da API Hotmart (v1 — objetos aninhados) ─────────────────────────

interface HotmartSaleRaw {
    product: { id: number; name: string };
    producer: { ucode: string; name: string };
    buyer: { name: string; email: string; ucode: string };
    purchase: {
        status: string;
        transaction: string;
        order_date: number;        // Unix ms
        approved_date?: number;    // Unix ms
        price: { value: number; currency_code: string };
        is_subscription: boolean;
        hotmart_fee?: { total: number; percentage: number; base: number; fixed: number; currency_code: string };
        payment?: { type: string; method: string; installments_number: number };
        offer?: { code: string; payment_mode: string };
        commission_as?: string;
    };
}

// Flat interface for processSale (mapped from raw)
interface HotmartSale {
    buyer_name: string;
    buyer_email: string;
    buyer_ucode: string;
    product_id: number;
    product_name: string;
    transaction: string;
    transaction_status: string;
    purchase_date: number; // Unix ms
    amount: number;
    fee: number;
    currency_code?: string;
    commission_as?: string | undefined;
    payment_type?: string | undefined;
}

function mapRawToSale(raw: HotmartSaleRaw): HotmartSale {
    return {
        buyer_name: raw.buyer?.name ?? '',
        buyer_email: raw.buyer?.email ?? '',
        buyer_ucode: raw.buyer?.ucode ?? '',
        product_id: raw.product?.id ?? 0,
        product_name: raw.product?.name ?? '',
        transaction: raw.purchase?.transaction ?? '',
        transaction_status: raw.purchase?.status ?? '',
        purchase_date: raw.purchase?.order_date ?? raw.purchase?.approved_date ?? 0,
        amount: raw.purchase?.price?.value ?? 0,
        fee: raw.purchase?.hotmart_fee?.total ?? 0,
        currency_code: raw.purchase?.price?.currency_code ?? 'BRL',
        commission_as: raw.purchase?.commission_as,
        payment_type: raw.purchase?.payment?.type,
    };
}

interface HotmartSalesResponse {
    items: HotmartSaleRaw[];
    page_info: {
        total_results: number;
        results_per_page: number;
        next_page_token?: string;
        prev_page_token?: string;
    };
}

// ── Fetch ─────────────────────────────────────────────────────────────────────

/**
 * Busca todas as vendas de uma conta Hotmart com paginação automática e retry.
 * Filtra por intervalo de datas (Unix ms). Se não informado, busca tudo.
 */
interface FetchResult {
    sales: HotmartSale[];
    rawFirstPage: Record<string, unknown> | null;
    httpStatus: number;
}

async function fetchAllHotmartSales(
    accessToken: string,
    startDateMs?: number,
    endDateMs?: number,
): Promise<FetchResult> {
    const all: HotmartSale[] = [];
    let pageToken: string | undefined = undefined;
    let rawFirstPage: Record<string, unknown> | null = null;
    let httpStatus = 0;

    do {
        console.log(`[HotmartSync] Fetching page with token: ${pageToken ?? 'none'}`);
        const params: Record<string, unknown> = {
            max_results: 50,
            ...(startDateMs !== undefined && { start_date: startDateMs }),
            ...(endDateMs !== undefined && { end_date: endDateMs }),
            ...(pageToken && { page_token: pageToken }),
        };

        const res = await withRetry(() =>
            axios.get<HotmartSalesResponse>(
                `${HOTMART_API_BASE}/payments/api/v1/sales/history`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    params,
                    timeout: 30000,
                }
            )
        );

        // Capture first page raw response for diagnostics
        if (!rawFirstPage) {
            httpStatus = res.status;
            rawFirstPage = {
                status: res.status,
                keys: Object.keys(res.data || {}),
                page_info: res.data?.page_info,
                items_count: res.data?.items?.length ?? 0,
                // First item: all keys + raw object (redact email)
                sample_item_keys: res.data?.items?.[0] ? Object.keys(res.data.items[0]) : [],
                sample_item_raw: res.data?.items?.[0] ? (() => { const s = { ...res.data.items[0] } as Record<string, unknown>; const buyer = s.buyer as Record<string, unknown> | undefined; if (buyer?.email) { s.buyer = { ...buyer, email: '***' }; } return s; })() : null,
            };
        }

        const rawItems = res.data?.items ?? [];
        const items = rawItems.map(mapRawToSale);
        all.push(...items);
        pageToken = res.data?.page_info?.next_page_token;
        console.log(`[HotmartSync] Page success: ${items.length} items. Total: ${all.length}`);
    } while (pageToken);

    return { sales: all, rawFirstPage, httpStatus };
}

// ── Payment type mapping ──────────────────────────────────────────────────

function mapPaymentType(type?: string): string | null {
    if (!type) return null;
    const t = type.toUpperCase();
    if (t.includes('PIX')) return 'Pix';
    if (t.includes('BILLET') || t.includes('BOLETO')) return 'Boleto';
    if (t.includes('CREDIT') || t.includes('DEBIT') || t.includes('CARD')) return 'Cartão';
    return type;
}

// ── Process sale ──────────────────────────────────────────────────────────────

/**
 * Normaliza e persiste uma venda no banco (idempotente via external_id).
 */
async function processSale(profileId: string, sale: HotmartSale): Promise<void> {
    const { transaction, buyer_email, buyer_name, amount, transaction_status } = sale;

    // ── Venda aprovada ────────────────────────────────────────────────────────
    if (APPROVED_STATUSES.has(transaction_status)) {
        const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('profile_id', profileId)
            .eq('external_id', transaction)
            .single();

        if (existing) return;

        const { data: customer, error: custError } = await supabase
            .from('customers')
            .upsert(
                {
                    profile_id: profileId,
                    email: buyer_email,
                    name: buyer_name,
                    // acquisition_channel omitido: novos clientes ficam com 'desconhecido'
                    // (default do banco), clientes existentes preservam o canal original
                },
                { onConflict: 'profile_id,email', ignoreDuplicates: false }
            )
            .select('id, total_ltv')
            .single();

        if (custError || !customer) {
            console.error(`[HotmartSync] Customer upsert failed for ${buyer_email}:`, custError?.message);
            return;
        }

        // Usa fee real da API quando disponível, senão calcula com taxa padrão
        const fee = sale.fee > 0 ? sale.fee : parseFloat((amount * HOTMART_FEE_RATE).toFixed(2));
        const amountNet = parseFloat((amount - fee).toFixed(2));

        const { error: txError } = await supabase.from('transactions').insert({
            profile_id: profileId,
            customer_id: customer.id,
            platform: 'hotmart',
            external_id: transaction,
            amount_gross: amount,
            amount_net: amountNet,
            fee_platform: fee,
            status: 'approved',
            created_at: new Date(sale.purchase_date).toISOString(),
            product_name: sale.product_name || null,
            payment_method: mapPaymentType(sale.payment_type),
        });

        if (txError) {
            if (txError.code === '23505') return; // Duplicate — idempotência
            console.error(`[HotmartSync] Transaction insert failed for ${transaction}:`, txError.message);
            return;
        }

        const newLtv = (Number(customer.total_ltv) || 0) + amountNet;
        await supabase
            .from('customers')
            .update({ total_ltv: newLtv, last_purchase_at: new Date(sale.purchase_date).toISOString() })
            .eq('id', customer.id);

        return;
    }

    // ── Reembolso ────────────────────────────────────────────────────────────
    if (REFUNDED_STATUSES.has(transaction_status)) {
        const { data: tx } = await supabase
            .from('transactions')
            .select('id, customer_id, amount_net, status')
            .eq('profile_id', profileId)
            .eq('external_id', transaction)
            .single();

        if (!tx || tx.status === 'refunded') return;

        await supabase.from('transactions').update({ status: 'refunded' }).eq('id', tx.id);

        const { data: customer } = await supabase
            .from('customers')
            .select('total_ltv')
            .eq('id', tx.customer_id)
            .single();

        if (customer) {
            // Usa amount_net — mesmo valor que foi somado ao LTV na venda
            const newLtv = Math.max(0, (Number(customer.total_ltv) || 0) - Number(tx.amount_net));
            await supabase.from('customers').update({ total_ltv: newLtv }).eq('id', tx.customer_id);
        }

        await supabase
            .from('commissions')
            .update({ status: 'cancelled' })
            .eq('transaction_id', tx.id)
            .eq('status', 'pending');

        return;
    }

    // ── Cancelamento ─────────────────────────────────────────────────────────
    if (CANCELLED_STATUSES.has(transaction_status)) {
        await supabase
            .from('transactions')
            .update({ status: 'cancelled' })
            .eq('profile_id', profileId)
            .eq('external_id', transaction)
            .neq('status', 'cancelled');
    }
}

// ── Backfill ──────────────────────────────────────────────────────────────────

/**
 * Backfill de vendas Hotmart para um perfil.
 * - days=0 ou undefined: busca os últimos 365 dias
 * - days=N: busca os últimos N dias
 */
export async function backfillHotmart(profileId: string, days?: number, force = false): Promise<{ synced: number; skipped: number; errors: number; debug?: Record<string, unknown> }> {
    const effectiveDays = (!days || days <= 0) ? 365 : days;
    const endMs = Date.now();
    const startMs = endMs - effectiveDays * 24 * 60 * 60 * 1000;

    // Verifica se a integração existe
    const integration = await IntegrationService.getIntegration(profileId, 'hotmart');
    if (!integration) {
        throw new Error(`[HotmartSync] No Hotmart integration for profile ${profileId}`);
    }

    // Renova token OAuth do usuário se próximo do vencimento.
    // Usamos o token OAuth do usuário para buscar vendas — cada founder
    // conecta sua própria conta Hotmart e o token dá acesso aos dados dela.
    // Se o refresh falhar, o IntegrationService marca como inactive e lança erro.
    let userTokens = integration;
    let _tokenRefreshed = false;
    if (IntegrationService.isNearExpiry(integration)) {
        console.log(`[HotmartSync] OAuth token near expiry for profile ${profileId} — refreshing before sync`);
        userTokens = await IntegrationService.refreshTokens(profileId, 'hotmart');
        _tokenRefreshed = true;
    }

    // Mutex: evita execuções paralelas (skip when force=true)
    if (!force) {
        const acquired = await acquireSyncMutex(profileId);
        if (!acquired) return { synced: 0, skipped: 0, errors: 0, debug: { blocked: 'mutex_locked' } };
    } else {
        console.log(`[HotmartSync] Force flag — skipping mutex for profile ${profileId}`);
    }

    // Logging estruturado
    const logId = await startSyncLog(profileId);

    console.log(`[HotmartSync] Starting backfill for profile ${profileId} — last ${effectiveDays} days`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;
    let tokenSource = 'unknown';
    let tokenRefreshed = _tokenRefreshed;
    let totalFetched = 0;
    let tokenExpiresAt = userTokens?.expires_at ? new Date(userTokens.expires_at).toISOString() : 'unknown';
    const debugExtra: Record<string, unknown> = {};

    try {
        // A API de sales history da Hotmart exige client_credentials (app-level token).
        // O token OAuth do usuário (authorization_code) não tem permissão para esse endpoint.
        const accessToken = await getClientCredentialsToken();
        tokenSource = 'client_credentials';

        // Busca todas as vendas com retry e timeout
        const fetchResult = await fetchAllHotmartSales(accessToken, startMs, endMs);
        const sales = fetchResult.sales;
        totalFetched = sales.length;
        console.log(`[HotmartSync] Fetched ${sales.length} sales for profile ${profileId}`);

        // Store raw API response in debug
        Object.assign(debugExtra, { api_response: fetchResult.rawFirstPage, http_status: fetchResult.httpStatus });

        // Pre-fetch existing external_ids para evitar 2 count queries por venda
        const { data: existingTxs } = await supabase
            .from('transactions')
            .select('external_id')
            .eq('profile_id', profileId)
            .in('external_id', sales.map(s => s.transaction));

        const existingIds = new Set((existingTxs ?? []).map(t => t.external_id));

        for (const sale of sales) {
            try {
                await processSale(profileId, sale);

                // Se não existia antes, foi synced; senão, skipped (upsert)
                existingIds.has(sale.transaction) ? skipped++ : synced++;

                // Audit trail (fire-and-forget)
                void supabase
                    .from('platforms_data_raw')
                    .insert({ profile_id: profileId, platform: 'hotmart', payload: sale, processed: true })
                    .then(({ error }) => {
                        if (error) console.warn(`[HotmartSync] platforms_data_raw insert failed for ${sale.transaction}:`, error.message);
                    });
            } catch (e: unknown) {
                console.error(`[HotmartSync] Error processing sale ${sale.transaction}:`, e instanceof Error ? e.message : String(e));
                errors++;
            }
        }

        console.log(`[HotmartSync] Done for ${profileId}: ${synced} synced, ${skipped} skipped, ${errors} errors`);
        await finishSyncLog(logId, synced);
    } catch (e: unknown) {
        const axiosErr = e as { response?: { data?: unknown } };
        const errMsg = e instanceof Error ? e.message : String(e);
        const msg = JSON.stringify(axiosErr.response?.data ?? errMsg);
        console.error(`[HotmartSync] Backfill failed for ${profileId}:`, msg);
        await finishSyncLog(logId, synced, errMsg);
        throw e;
    } finally {
        if (!force) await releaseSyncMutex(profileId);
    }

    return {
        synced, skipped, errors,
        debug: {
            token_source: tokenSource,
            token_refreshed: tokenRefreshed,
            token_expires_at: tokenExpiresAt,
            total_fetched_from_api: totalFetched,
            date_range: { start: new Date(startMs).toISOString(), end: new Date(endMs).toISOString() },
            ...debugExtra,
        },
    };
}

// ── Cron job ──────────────────────────────────────────────────────────────────

/**
 * Roda o backfill dos últimos 7 dias para todos os perfis com integração
 * Hotmart ativa. Executado a cada 6 horas pelo servidor.
 */
export async function runHotmartSyncForAllProfiles(): Promise<void> {
    console.log('[HotmartSync] Running incremental sync for all profiles...');

    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('profile_id')
        .eq('platform', 'hotmart')
        .eq('status', 'active');

    if (error || !integrations?.length) {
        console.log('[HotmartSync] No active Hotmart integrations to sync.');
        return;
    }

    console.log(`[HotmartSync] Starting scheduled sync for ${integrations.length} profile(s)`);

    for (const { profile_id } of integrations) {
        try {
            await backfillHotmart(profile_id, 7);
        } catch (e: unknown) {
            console.error(`[HotmartSync] Cron sync failed for profile ${profile_id}:`, e instanceof Error ? e.message : String(e));
        }
    }

    console.log('[HotmartSync] Incremental sync complete.');
}

/**
 * Registra o cron job de sync da Hotmart (a cada 6 horas).
 * Chamado em server/src/index.ts no boot do servidor.
 */
export function startHotmartSyncJob(): void {
    console.log('[HotmartSync] Job registered — will run every 6 hours.');
    // Não roda imediato no boot — espera o primeiro intervalo para evitar sobrecarga
    setInterval(runHotmartSyncForAllProfiles, 6 * 60 * 60 * 1000);
}
