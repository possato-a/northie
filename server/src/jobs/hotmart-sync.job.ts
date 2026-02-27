/**
 * @file jobs/hotmart-sync.job.ts
 * Sincroniza histórico de vendas da Hotmart via REST API.
 * Usa o mesmo pipeline de normalização do webhook (syncTransaction),
 * garantindo idempotência via external_id (transaction code).
 */

import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

const HOTMART_API_BASE = 'https://api-hot-connect.hotmart.com';

// Status que representam vendas confirmadas (equivalente a PURCHASE_APPROVED)
const APPROVED_STATUSES = new Set(['APPROVED', 'COMPLETE']);

// Status de reembolso
const REFUNDED_STATUSES = new Set(['REFUNDED', 'PARTIALLY_REFUNDED', 'CHARGEBACK', 'PROTESTED']);

// Status de cancelamento
const CANCELLED_STATUSES = new Set(['CANCELLED', 'EXPIRED', 'NO_FUNDS', 'BLOCKED']);

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
    currency_code?: string;
    commission_as?: string; // PRODUCER | COPRODUCER | AFFILIATE
}

interface HotmartSalesResponse {
    items: HotmartSale[];
    page_info: {
        total_results: number;
        results_per_page: number;
        next_page_token?: string;
        prev_page_token?: string;
    };
}

/**
 * Busca todas as vendas de uma conta Hotmart com paginação automática.
 * Filtra por intervalo de datas (Unix ms). Se não informado, busca tudo.
 */
async function fetchAllHotmartSales(
    accessToken: string,
    startDateMs?: number,
    endDateMs?: number,
): Promise<HotmartSale[]> {
    const all: HotmartSale[] = [];
    let pageToken: string | undefined = undefined;

    do {
        console.log(`[HotmartSync] Fetching page with token: ${pageToken ?? 'none'} (Period: ${new Date(startDateMs!).toISOString()} to ${new Date(endDateMs!).toISOString()})`);
        const params: Record<string, any> = {
            max_results: 50,
            ...(startDateMs !== undefined && { start_date: startDateMs }),
            ...(endDateMs !== undefined && { end_date: endDateMs }),
            ...(pageToken && { page_token: pageToken }),
        };

        try {
            const res = await axios.get<HotmartSalesResponse>(
                `${HOTMART_API_BASE}/payments/api/v1/sales/history`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                        'Content-Type': 'application/json',
                    },
                    params,
                }
            );

            const items = res.data?.items ?? [];
            all.push(...items);

            pageToken = res.data?.page_info?.next_page_token;
            console.log(`[HotmartSync] Page success: returned ${items.length} items. Total so far: ${all.length}`);
        } catch (err: any) {
            console.error(`[HotmartSync] API Request Failed:`, {
                status: err.response?.status,
                data: err.response?.data,
                message: err.message,
                url: err.config?.url,
                params: err.config?.params
            });
            throw err;
        }
    } while (pageToken);

    return all;
}

/**
 * Normaliza e persiste uma venda no banco (idempotente via external_id).
 * Reutiliza o mesmo pipeline do webhook para consistência.
 */
async function processSale(profileId: string, sale: HotmartSale): Promise<void> {
    const { transaction, buyer_email, buyer_name, amount, transaction_status } = sale;

    // ── Venda aprovada ────────────────────────────────────────────────────────
    if (APPROVED_STATUSES.has(transaction_status)) {
        // Verifica se já existe (idempotência) — upsert via external_id unique constraint
        const { data: existing } = await supabase
            .from('transactions')
            .select('id')
            .eq('profile_id', profileId)
            .eq('external_id', transaction)
            .single();

        if (existing) return; // Já importado

        // Upsert customer
        const { data: customer, error: custError } = await supabase
            .from('customers')
            .upsert(
                {
                    profile_id: profileId,
                    email: buyer_email,
                    name: buyer_name,
                    acquisition_channel: 'Hotmart'
                },
                { onConflict: 'profile_id, email' }
            )
            .select('id, total_ltv')
            .single();

        if (custError || !customer) {
            console.error(`[HotmartSync] Customer upsert failed for ${buyer_email}:`, custError?.message);
            return;
        }

        // Insert transaction
        const { error: txError } = await supabase.from('transactions').insert({
            profile_id: profileId,
            customer_id: customer.id,
            platform: 'hotmart',
            external_id: transaction,
            amount_gross: amount,
            amount_net: amount,
            status: 'approved',
            acquisition_channel: 'Hotmart'
        });

        if (txError) {
            if (txError.code === '23505') return;
            console.error(`[HotmartSync] Transaction insert failed for ${transaction}:`, txError.message);
            return;
        }

        // Atualiza LTV
        const newLtv = (Number(customer.total_ltv) || 0) + amount;
        await supabase
            .from('customers')
            .update({ total_ltv: newLtv, last_purchase_at: new Date(sale.purchase_date).toISOString() })
            .eq('id', customer.id);

        return;
    }

    // ── Reembolso — atualiza se já existir ───────────────────────────────────
    if (REFUNDED_STATUSES.has(transaction_status)) {
        const { data: tx } = await supabase
            .from('transactions')
            .select('id, customer_id, amount_gross, status')
            .eq('profile_id', profileId)
            .eq('external_id', transaction)
            .single();

        if (!tx || tx.status === 'refunded') return; // Não existe ou já marcado

        await supabase.from('transactions').update({ status: 'refunded' }).eq('id', tx.id);

        const { data: customer } = await supabase
            .from('customers')
            .select('total_ltv')
            .eq('id', tx.customer_id)
            .single();

        if (customer) {
            const newLtv = Math.max(0, (Number(customer.total_ltv) || 0) - Number(tx.amount_gross));
            await supabase.from('customers').update({ total_ltv: newLtv }).eq('id', tx.customer_id);
        }

        await supabase
            .from('commissions')
            .update({ status: 'cancelled' })
            .eq('transaction_id', tx.id)
            .eq('status', 'pending');

        return;
    }

    // ── Cancelamento ──────────────────────────────────────────────────────────
    if (CANCELLED_STATUSES.has(transaction_status)) {
        await supabase
            .from('transactions')
            .update({ status: 'cancelled' })
            .eq('profile_id', profileId)
            .eq('external_id', transaction)
            .neq('status', 'cancelled'); // Evita update desnecessário
    }
}

/**
 * Backfill de vendas Hotmart para um perfil.
 * - days=0 ou undefined: busca os últimos 365 dias
 * - days=N: busca os últimos N dias
 */
export async function backfillHotmart(profileId: string, days?: number): Promise<{ synced: number; skipped: number; errors: number }> {
    const effectiveDays = (!days || days <= 0) ? 365 : days;
    const endMs = Date.now();
    const startMs = endMs - effectiveDays * 24 * 60 * 60 * 1000;

    console.log(`[HotmartSync] Starting backfill for profile ${profileId} — last ${effectiveDays} days`);

    // Busca e valida token
    const tokens = await IntegrationService.getIntegration(profileId, 'hotmart');
    if (!tokens?.access_token) {
        throw new Error(`[HotmartSync] No Hotmart tokens for profile ${profileId}`);
    }

    // Renova token se necessário (10min buffer — Hotmart usa tokens de ~1h)
    let accessToken = tokens.access_token;
    if (IntegrationService.isNearExpiry(tokens, 10 * 60 * 1000)) {
        try {
            const refreshed = await IntegrationService.refreshTokens(profileId, 'hotmart');
            accessToken = refreshed.access_token;
        } catch (e: any) {
            console.error(`[HotmartSync] Token refresh failed for ${profileId}:`, e.message);
            throw e;
        }
    }

    // Busca todas as vendas no período
    let sales: HotmartSale[];
    try {
        sales = await fetchAllHotmartSales(accessToken, startMs, endMs);
    } catch (e: any) {
        console.error(`[HotmartSync] Failed to fetch sales for ${profileId}:`, e.response?.data ?? e.message);
        throw e;
    }

    console.log(`[HotmartSync] Fetched ${sales.length} sales for profile ${profileId}`);

    let synced = 0;
    let skipped = 0;
    let errors = 0;

    for (const sale of sales) {
        try {
            // Conta antes e depois para detectar se foi inserido
            const before = await supabase
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('profile_id', profileId)
                .eq('external_id', sale.transaction);

            await processSale(profileId, sale);

            const after = await supabase
                .from('transactions')
                .select('id', { count: 'exact', head: true })
                .eq('profile_id', profileId)
                .eq('external_id', sale.transaction);

            if ((after.count ?? 0) > (before.count ?? 0)) {
                synced++;
            } else {
                skipped++;
            }
        } catch (e: any) {
            console.error(`[HotmartSync] Error processing sale ${sale.transaction}:`, e.message);
            errors++;
        }
    }

    console.log(`[HotmartSync] Done for ${profileId}: ${synced} synced, ${skipped} skipped, ${errors} errors`);
    return { synced, skipped, errors };
}
