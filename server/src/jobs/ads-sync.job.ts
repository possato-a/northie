/**
 * @file jobs/ads-sync.job.ts
 * Background job que sincroniza métricas de anúncios (spend, impressions, clicks)
 * da API do Meta Ads e Google Ads para a tabela ad_metrics.
 * Roda a cada 6 horas.
 */

import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function today(): string {
    return new Date().toISOString().split('T')[0]!;
}

function yesterday(): string {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0]!;
}

function daysAgo(n: number): string {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0]!;
}

// ── Meta Ads Sync ─────────────────────────────────────────────────────────────

/**
 * Busca métricas diárias de todas as ad accounts vinculadas ao token do perfil.
 * @param since  Data inicial no formato YYYY-MM-DD (default: ontem)
 * @param until  Data final no formato YYYY-MM-DD (default: hoje)
 */
async function syncMetaAds(
    profileId: string,
    since = yesterday(),
    until = today(),
): Promise<void> {
    const tokens = await IntegrationService.getIntegration(profileId, 'meta');
    if (!tokens?.access_token) {
        console.log(`[AdsSync] Meta: no token for profile ${profileId}, skipping.`);
        return;
    }

    // Tenta renovar o token se estiver perto de expirar antes de fazer requests
    let accessToken = tokens.access_token;
    if (IntegrationService.isNearExpiry(tokens)) {
        try {
            const refreshed = await IntegrationService.refreshTokens(profileId, 'meta');
            accessToken = refreshed.access_token;
        } catch {
            // refreshTokens já marca como inactive — apenas loga e para
            console.error(`[AdsSync] Meta: token renewal failed for profile ${profileId}, aborting sync.`);
            return;
        }
    }

    const dateRange = { since, until };

    // 1. Listar ad accounts do usuário
    let accountsRes;
    try {
        accountsRes = await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
            params: { access_token: accessToken, fields: 'id,name', limit: 50 },
        });
    } catch (err: any) {
        const fbError = err.response?.data?.error;
        // Token inválido ou revogado
        if (fbError?.code === 190) {
            console.error(`[AdsSync] Meta: invalid/expired token for profile ${profileId} — marking inactive.`);
            await supabase
                .from('integrations')
                .update({ status: 'inactive' })
                .eq('profile_id', profileId)
                .eq('platform', 'meta');
        } else {
            console.error(`[AdsSync] Meta: failed to list ad accounts for profile ${profileId}:`, fbError ?? err.message);
        }
        return;
    }

    const accounts: Array<{ id: string; name: string }> = accountsRes.data?.data || [];
    if (accounts.length === 0) {
        console.log(`[AdsSync] Meta: no ad accounts found for profile ${profileId}`);
        return;
    }

    for (const account of accounts) {
        try {
            // 2. Buscar insights por dia
            const insightsRes = await axios.get(
                `https://graph.facebook.com/v18.0/${account.id}/insights`,
                {
                    params: {
                        access_token: accessToken,
                        fields: 'spend,impressions,clicks,date_start',
                        time_range: JSON.stringify(dateRange),
                        time_increment: 1, // 1 = por dia
                        level: 'account',
                    },
                }
            );

            const rows: Array<{ spend: string; impressions: string; clicks: string; date_start: string }> =
                insightsRes.data?.data || [];

            for (const row of rows) {
                await upsertAdMetric({
                    profileId,
                    platform: 'meta',
                    date: row.date_start,
                    spendBrl: parseFloat(row.spend || '0'),
                    impressions: parseInt(row.impressions || '0', 10),
                    clicks: parseInt(row.clicks || '0', 10),
                    accountId: account.id,
                    accountName: account.name,
                });
            }

            console.log(
                `[AdsSync] Meta: synced ${rows.length} day(s) for account ${account.name} (profile ${profileId})`
            );
        } catch (err: any) {
            console.error(
                `[AdsSync] Meta: error fetching insights for account ${account.id}:`,
                err.response?.data || err.message
            );
        }
    }
}

/**
 * Backfill inicial: puxar os últimos `days` dias ao conectar pela primeira vez.
 * Chamado pelo integration.controller após salvar os tokens com sucesso.
 */
export async function backfillMetaAds(profileId: string, days = 30): Promise<void> {
    console.log(`[AdsSync] Meta backfill: fetching last ${days} days for profile ${profileId}`);
    const since = daysAgo(days);
    const until = today();
    await syncMetaAds(profileId, since, until);
    console.log(`[AdsSync] Meta backfill complete for profile ${profileId}`);
}

// ── Google Ads Sync ───────────────────────────────────────────────────────────

/**
 * Busca métricas diárias via Google Ads API (REST v17).
 * Requer GOOGLE_ADS_DEVELOPER_TOKEN e o customer_id na tabela integrations.
 */
async function syncGoogleAds(profileId: string): Promise<void> {
    const tokens = await IntegrationService.getIntegration(profileId, 'google');
    if (!tokens?.access_token) {
        console.log(`[AdsSync] Google: no token for profile ${profileId}, skipping.`);
        return;
    }

    const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
    if (!developerToken) {
        console.warn('[AdsSync] Google: GOOGLE_ADS_DEVELOPER_TOKEN not set, skipping.');
        return;
    }

    // Buscar customer IDs salvos na integração (armazenamos no campo config_encrypted como array)
    const { data: integrationRow } = await supabase
        .from('integrations')
        .select('google_customer_ids')
        .eq('profile_id', profileId)
        .eq('platform', 'google')
        .single();

    const customerIds: string[] = (integrationRow as any)?.google_customer_ids || [];

    if (customerIds.length === 0) {
        console.log(`[AdsSync] Google: no customer_ids for profile ${profileId}, skipping.`);
        return;
    }

    for (const customerId of customerIds) {
        try {
            const query = `
                SELECT
                    segments.date,
                    metrics.cost_micros,
                    metrics.impressions,
                    metrics.clicks
                FROM campaign
                WHERE segments.date BETWEEN '${yesterday()}' AND '${today()}'
                  AND campaign.status = 'ENABLED'
            `;

            const reportRes = await axios.post(
                `https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`,
                { query },
                {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                    },
                }
            );

            // searchStream retorna array de batches
            const batches: any[] = reportRes.data || [];
            const daily: Record<string, { spend: number; impressions: number; clicks: number }> = {};

            for (const batch of batches) {
                for (const result of batch.results || []) {
                    const date: string = result.segments?.date;
                    const costMicros = parseInt(result.metrics?.costMicros || '0', 10);
                    const spendBrl = costMicros / 1_000_000; // micros → reais (assumindo BRL)

                    if (!daily[date]) daily[date] = { spend: 0, impressions: 0, clicks: 0 };
                    daily[date]!.spend += spendBrl;
                    daily[date]!.impressions += parseInt(result.metrics?.impressions || '0', 10);
                    daily[date]!.clicks += parseInt(result.metrics?.clicks || '0', 10);
                }
            }

            for (const [date, metrics] of Object.entries(daily)) {
                await upsertAdMetric({
                    profileId,
                    platform: 'google',
                    date,
                    spendBrl: metrics.spend,
                    impressions: metrics.impressions,
                    clicks: metrics.clicks,
                    accountId: customerId,
                    accountName: `Google Ads #${customerId}`,
                });
            }

            console.log(
                `[AdsSync] Google: synced ${Object.keys(daily).length} day(s) for customer ${customerId} (profile ${profileId})`
            );
        } catch (err: any) {
            console.error(
                `[AdsSync] Google: error for customer ${customerId}:`,
                err.response?.data || err.message
            );
        }
    }
}

// ── Upsert helper ─────────────────────────────────────────────────────────────

interface AdMetricPayload {
    profileId: string;
    platform: 'meta' | 'google';
    date: string;
    spendBrl: number;
    impressions: number;
    clicks: number;
    accountId: string;
    accountName: string;
}

async function upsertAdMetric(payload: AdMetricPayload): Promise<void> {
    const { error } = await supabase.from('ad_metrics').upsert(
        {
            profile_id: payload.profileId,
            platform: payload.platform,
            date: payload.date,
            spend_brl: payload.spendBrl,
            spend_original: payload.spendBrl,
            impressions: payload.impressions,
            clicks: payload.clicks,
            account_id: payload.accountId,
            account_name: payload.accountName,
            synced_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,platform,date,account_id' }
    );

    if (error) {
        console.error('[AdsSync] upsert error:', error);
        throw error;
    }
}

// ── Main runner ───────────────────────────────────────────────────────────────

async function runAdsSyncForAllProfiles(): Promise<void> {
    console.log('[AdsSync] Starting full sync cycle...');

    const { data: integrations, error } = await supabase
        .from('integrations')
        .select('profile_id, platform')
        .eq('status', 'active')
        .in('platform', ['meta', 'google']);

    if (error) {
        console.error('[AdsSync] Failed to fetch integrations:', error);
        return;
    }

    for (const integration of integrations || []) {
        try {
            if (integration.platform === 'meta') {
                await syncMetaAds(integration.profile_id);
            } else if (integration.platform === 'google') {
                await syncGoogleAds(integration.profile_id);
            }
        } catch (err: any) {
            console.error(
                `[AdsSync] Unhandled error for ${integration.platform} / ${integration.profile_id}:`,
                err.message
            );
        }
    }

    console.log('[AdsSync] Sync cycle complete.');
}

// ── Job starter ───────────────────────────────────────────────────────────────

export function startAdsSyncJob(): void {
    console.log('[AdsSync] Job registered — will run every 6 hours.');

    // Rodar imediatamente ao iniciar
    runAdsSyncForAllProfiles();

    // E a cada 6 horas
    setInterval(runAdsSyncForAllProfiles, 6 * 60 * 60 * 1000);
}

// Permite chamada manual via endpoint de admin
export { runAdsSyncForAllProfiles };
