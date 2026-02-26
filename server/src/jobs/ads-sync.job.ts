/**
 * @file jobs/ads-sync.job.ts
 * Sincroniza métricas de anúncios do Meta Ads (e futuramente Google Ads)
 * nos níveis campanha, conjunto e anúncio para as tabelas ad_metrics e ad_campaigns.
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

// ── Meta Ads — campos e tipos ──────────────────────────────────────────────────

const META_INSIGHT_FIELDS =
    'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,' +
    'spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,date_start,' +
    'effective_status';

interface MetaInsightRow {
    campaign_id: string;
    campaign_name: string;
    adset_id?: string;
    adset_name?: string;
    ad_id?: string;
    ad_name?: string;
    spend: string;
    impressions: string;
    reach?: string;
    clicks: string;
    ctr?: string;
    cpc?: string;
    cpm?: string;
    frequency?: string;
    date_start: string;
    effective_status?: string;
}

interface AdCampaignPayload {
    profileId: string;
    platform: 'meta' | 'google';
    accountId: string;
    accountName: string;
    campaignId: string;
    campaignName: string;
    adsetId: string;
    adsetName: string;
    adId: string;
    adName: string;
    level: 'campaign' | 'adset' | 'ad';
    status: string;
    date: string;
    spendBrl: number;
    impressions: number;
    reach: number;
    clicks: number;
    ctr: number;
    cpcBrl: number;
    cpmBrl: number;
    frequency: number;
}

// ── Meta Ads — fetch de insights por nível ────────────────────────────────────

/**
 * Busca insights paginados de um ad account em um nível específico.
 * Retorna todos os registros (segue paginação automática).
 */
async function fetchMetaInsights(
    accountId: string,
    accessToken: string,
    level: 'campaign' | 'adset' | 'ad',
    dateRange: { since: string; until: string } | null,
): Promise<MetaInsightRow[]> {
    const params: Record<string, any> = {
        access_token: accessToken,
        fields: META_INSIGHT_FIELDS,
        time_increment: 1,
        level,
        limit: 500,
    };

    if (dateRange) {
        params.time_range = JSON.stringify(dateRange);
    } else {
        // Sem dateRange = histórico completo da conta
        params.date_preset = 'maximum';
    }

    const rows: MetaInsightRow[] = [];
    let url: string | null =
        `https://graph.facebook.com/v18.0/${accountId}/insights`;

    while (url) {
        const res = await axios.get(url, { params: url.includes('?') ? undefined : params });
        const data = res.data?.data || [];
        rows.push(...data);

        // Paginação via cursor
        const next = res.data?.paging?.next;
        url = next && next !== url ? next : null;
        // Limpar params após primeira request (URL já contém cursor)
        if (url) (params as any) = undefined;
    }

    return rows;
}

// ── Meta Ads — upsert helpers ─────────────────────────────────────────────────

async function upsertAdCampaign(p: AdCampaignPayload): Promise<void> {
    const { error } = await supabase.from('ad_campaigns').upsert(
        {
            profile_id: p.profileId,
            platform: p.platform,
            account_id: p.accountId,
            account_name: p.accountName,
            campaign_id: p.campaignId,
            campaign_name: p.campaignName,
            adset_id: p.adsetId,
            adset_name: p.adsetName,
            ad_id: p.adId,
            ad_name: p.adName,
            level: p.level,
            status: p.status,
            date: p.date,
            spend_brl: p.spendBrl,
            impressions: p.impressions,
            reach: p.reach,
            clicks: p.clicks,
            ctr: p.ctr,
            cpc_brl: p.cpcBrl,
            cpm_brl: p.cpmBrl,
            frequency: p.frequency,
            synced_at: new Date().toISOString(),
        },
        { onConflict: 'profile_id,platform,level,campaign_id,adset_id,ad_id,date' }
    );
    if (error) {
        console.error('[AdsSync] upsertAdCampaign error:', error);
        throw error;
    }
}

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
        console.error('[AdsSync] upsertAdMetric error:', error);
        throw error;
    }
}

// ── Meta Ads — sync principal ─────────────────────────────────────────────────

/**
 * Sincroniza todos os níveis (campaign, adset, ad) para um ad account.
 * Se dateRange for null, busca o histórico completo da conta (date_preset=maximum).
 */
async function syncMetaAccount(
    profileId: string,
    account: { id: string; name: string },
    accessToken: string,
    dateRange: { since: string; until: string } | null,
): Promise<void> {
    const levels: Array<'campaign' | 'adset' | 'ad'> = ['campaign', 'adset', 'ad'];

    for (const level of levels) {
        try {
            const rows = await fetchMetaInsights(account.id, accessToken, level, dateRange);
            console.log(`[AdsSync] Meta: ${rows.length} rows at ${level} level for ${account.name}`);

            for (const row of rows) {
                await upsertAdCampaign({
                    profileId,
                    platform: 'meta',
                    accountId: account.id,
                    accountName: account.name,
                    campaignId: row.campaign_id,
                    campaignName: row.campaign_name,
                    adsetId: row.adset_id || '',
                    adsetName: row.adset_name || '',
                    adId: row.ad_id || '',
                    adName: row.ad_name || '',
                    level,
                    status: row.effective_status || '',
                    date: row.date_start,
                    spendBrl: parseFloat(row.spend || '0'),
                    impressions: parseInt(row.impressions || '0', 10),
                    reach: parseInt(row.reach || '0', 10),
                    clicks: parseInt(row.clicks || '0', 10),
                    ctr: parseFloat(row.ctr || '0'),
                    cpcBrl: parseFloat(row.cpc || '0'),
                    cpmBrl: parseFloat(row.cpm || '0'),
                    frequency: parseFloat(row.frequency || '0'),
                });
            }

            // Também manter ad_metrics com totais de conta (para séries temporais)
            if (level === 'campaign') {
                // Agregar por data para ad_metrics
                const byDate: Record<string, { spend: number; impressions: number; clicks: number }> = {};
                for (const row of rows) {
                    const d = row.date_start;
                    if (!byDate[d]) byDate[d] = { spend: 0, impressions: 0, clicks: 0 };
                    byDate[d]!.spend += parseFloat(row.spend || '0');
                    byDate[d]!.impressions += parseInt(row.impressions || '0', 10);
                    byDate[d]!.clicks += parseInt(row.clicks || '0', 10);
                }
                for (const [date, m] of Object.entries(byDate)) {
                    await upsertAdMetric({
                        profileId,
                        platform: 'meta',
                        date,
                        spendBrl: m.spend,
                        impressions: m.impressions,
                        clicks: m.clicks,
                        accountId: account.id,
                        accountName: account.name,
                    });
                }
            }
        } catch (err: any) {
            console.error(
                `[AdsSync] Meta: error at ${level} level for account ${account.id}:`,
                err.response?.data || err.message
            );
        }
    }
}

async function syncMetaAds(
    profileId: string,
    dateRange: { since: string; until: string } | null = { since: yesterday(), until: today() },
): Promise<void> {
    const tokens = await IntegrationService.getIntegration(profileId, 'meta');
    if (!tokens?.access_token) {
        console.log(`[AdsSync] Meta: no token for profile ${profileId}, skipping.`);
        return;
    }

    let accessToken = tokens.access_token;
    if (IntegrationService.isNearExpiry(tokens)) {
        try {
            const refreshed = await IntegrationService.refreshTokens(profileId, 'meta');
            accessToken = refreshed.access_token;
        } catch {
            console.error(`[AdsSync] Meta: token renewal failed for profile ${profileId}, aborting sync.`);
            return;
        }
    }

    // Listar ad accounts
    let accountsRes;
    try {
        accountsRes = await axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
            params: { access_token: accessToken, fields: 'id,name', limit: 50 },
        });
    } catch (err: any) {
        const fbError = err.response?.data?.error;
        if (fbError?.code === 190) {
            console.error(`[AdsSync] Meta: invalid/expired token for profile ${profileId} — marking inactive.`);
            await supabase
                .from('integrations')
                .update({ status: 'inactive' })
                .eq('profile_id', profileId)
                .eq('platform', 'meta');
        } else {
            console.error(`[AdsSync] Meta: failed to list ad accounts for ${profileId}:`, fbError ?? err.message);
        }
        return;
    }

    const accounts: Array<{ id: string; name: string }> = accountsRes.data?.data || [];
    if (accounts.length === 0) {
        console.log(`[AdsSync] Meta: no ad accounts found for profile ${profileId}`);
        return;
    }

    for (const account of accounts) {
        await syncMetaAccount(profileId, account, accessToken, dateRange);
    }

    console.log(`[AdsSync] Meta: sync complete for profile ${profileId}`);
}

// ── Exports públicos ──────────────────────────────────────────────────────────

/**
 * Backfill completo: puxar TODO o histórico da conta (date_preset=maximum).
 * Chamado manualmente via "Sincronizar agora".
 */
export async function backfillMetaAds(profileId: string, _days?: number): Promise<void> {
    console.log(`[AdsSync] Meta full backfill started for profile ${profileId}`);
    // dateRange = null → date_preset=maximum na API
    await syncMetaAds(profileId, null);
    console.log(`[AdsSync] Meta full backfill complete for profile ${profileId}`);
}

// ── Google Ads Sync ───────────────────────────────────────────────────────────

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

            const batches: any[] = reportRes.data || [];
            const daily: Record<string, { spend: number; impressions: number; clicks: number }> = {};

            for (const batch of batches) {
                for (const result of batch.results || []) {
                    const date: string = result.segments?.date;
                    const costMicros = parseInt(result.metrics?.costMicros || '0', 10);
                    const spendBrl = costMicros / 1_000_000;

                    if (!daily[date]) daily[date] = { spend: 0, impressions: 0, clicks: 0 };
                    daily[date]!.spend += spendBrl;
                    daily[date]!.impressions += parseInt(result.metrics?.impressions || '0', 10);
                    daily[date]!.clicks += parseInt(result.metrics?.clicks || '0', 10);
                }
            }

            for (const [date, m] of Object.entries(daily)) {
                await upsertAdMetric({
                    profileId,
                    platform: 'google',
                    date,
                    spendBrl: m.spend,
                    impressions: m.impressions,
                    clicks: m.clicks,
                    accountId: customerId,
                    accountName: `Google Ads #${customerId}`,
                });
            }

            console.log(`[AdsSync] Google: synced ${Object.keys(daily).length} day(s) for ${customerId}`);
        } catch (err: any) {
            console.error(`[AdsSync] Google: error for ${customerId}:`, err.response?.data || err.message);
        }
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
    runAdsSyncForAllProfiles();
    setInterval(runAdsSyncForAllProfiles, 6 * 60 * 60 * 1000);
}

export { runAdsSyncForAllProfiles };
