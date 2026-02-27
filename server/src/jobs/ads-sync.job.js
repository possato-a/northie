/**
 * @file jobs/ads-sync.job.ts
 * Sincroniza métricas de anúncios do Meta Ads (e futuramente Google Ads)
 * nos níveis campanha, conjunto e anúncio para as tabelas ad_metrics e ad_campaigns.
 */
import axios from 'axios';
import { supabase } from '../lib/supabase.js';
import { IntegrationService } from '../services/integration.service.js';
// ── Helpers ───────────────────────────────────────────────────────────────────
/** Arredonda um valor monetário para 2 casas decimais (evita float bruto do Meta) */
function round2(n) {
    return Math.round(n * 100) / 100;
}
/**
 * Executa uma chamada HTTP com retry automático em caso de rate limit (429)
 * ou erros transitórios (5xx). Usa backoff exponencial com jitter.
 */
async function withRetry(fn, maxRetries = 4) {
    let lastError;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (err) {
            lastError = err;
            const status = err.response?.status;
            const fbCode = err.response?.data?.error?.code;
            if (status === 401 || status === 403 || fbCode === 190)
                throw err;
            const isRetryable = status === 429 || (status >= 500 && status < 600) || !status;
            if (!isRetryable || attempt === maxRetries)
                throw err;
            const baseDelay = Math.pow(2, attempt + 1) * 1000;
            const jitter = Math.random() * 1000;
            console.warn(`[AdsSync] Retry ${attempt + 1}/${maxRetries} após ${Math.round((baseDelay + jitter) / 1000)}s (status ${status ?? 'network error'})`);
            await new Promise(r => setTimeout(r, baseDelay + jitter));
        }
    }
    throw lastError;
}
// ── Sync log helpers ──────────────────────────────────────────────────────────
async function startSyncLog(profileId, platform) {
    const { data, error } = await supabase
        .from('sync_logs')
        .insert({ profile_id: profileId, platform, started_at: new Date().toISOString(), status: 'running' })
        .select('id')
        .single();
    if (error) {
        console.warn('[AdsSync] Failed to create sync_log entry:', error.message);
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
// ── Mutex helpers ─────────────────────────────────────────────────────────────
/**
 * Tenta adquirir o mutex de sync para uma integração.
 * Retorna true se adquiriu (pode prosseguir), false se já está em andamento.
 * Syncs travados há mais de 30 minutos são considerados mortos e liberados.
 */
async function acquireSyncMutex(profileId, platform) {
    const STALE_MINUTES = 30;
    const staleThreshold = new Date(Date.now() - STALE_MINUTES * 60 * 1000).toISOString();
    // Tenta atualizar apenas se is_syncing=false OU sync_started_at antigo (stale)
    const { data, error } = await supabase
        .from('integrations')
        .update({ is_syncing: true, sync_started_at: new Date().toISOString() })
        .eq('profile_id', profileId)
        .eq('platform', platform)
        .or(`is_syncing.eq.false,sync_started_at.lt.${staleThreshold}`)
        .select('id')
        .single();
    if (error || !data) {
        console.warn(`[AdsSync] ${platform}/${profileId}: já existe sync em andamento, pulando.`);
        return false;
    }
    return true;
}
async function releaseSyncMutex(profileId, platform) {
    await supabase
        .from('integrations')
        .update({ is_syncing: false, sync_started_at: null })
        .eq('profile_id', profileId)
        .eq('platform', platform);
}
function today() {
    return new Date().toISOString().split('T')[0];
}
function yesterday() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split('T')[0];
}
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().split('T')[0];
}
// ── Meta Ads — campos e tipos ──────────────────────────────────────────────────
// Note: effective_status is NOT a valid insights field — it belongs to the
// campaign/adset/ad objects, not the insights endpoint. Omit it here.
// actions and action_values return conversions breakdown (leads, purchases, etc.)
const META_INSIGHT_FIELDS = 'campaign_id,campaign_name,adset_id,adset_name,ad_id,ad_name,' +
    'spend,impressions,reach,clicks,ctr,cpc,cpm,frequency,date_start,' +
    'actions,action_values,video_p25_watched_actions';
/** Extrai o valor numérico de um tipo de action nos arrays da Meta */
function getAction(arr, type) {
    return parseFloat(arr?.find(a => a.action_type === type)?.value || '0');
}
// ── Meta Ads — fetch de status dos objetos ────────────────────────────────────
/**
 * Busca o effective_status de todos os objetos de um nível (campaigns/adsets/ads)
 * para um ad account. Retorna um Map de id → effective_status.
 * effective_status é um campo dos objetos, não de insights — precisa de endpoint separado.
 */
async function fetchMetaObjectStatuses(accountId, accessToken, level) {
    const endpointMap = {
        campaign: 'campaigns',
        adset: 'adsets',
        ad: 'ads',
    };
    const idField = level === 'campaign' ? 'id' : level === 'adset' ? 'id' : 'id';
    const statusMap = new Map();
    let url = `https://graph.facebook.com/v18.0/${accountId}/${endpointMap[level]}`;
    const params = {
        access_token: accessToken,
        fields: 'id,effective_status',
        limit: 500,
    };
    while (url !== null) {
        const currentUrl = url;
        const reqParams = currentUrl.includes('?') ? undefined : params;
        const res = await axios.get(currentUrl, { params: reqParams });
        for (const obj of res.data?.data || []) {
            if (obj['id'] && obj['effective_status']) {
                statusMap.set(obj['id'], obj['effective_status']);
            }
        }
        const next = res.data?.paging?.next;
        url = (next && next !== currentUrl) ? next : null;
    }
    return statusMap;
}
// ── Meta Ads — fetch de insights por nível ────────────────────────────────────
/**
 * Busca insights paginados de um ad account em um nível específico.
 * Retorna todos os registros (segue paginação automática).
 */
async function fetchMetaInsights(accountId, accessToken, level, dateRange) {
    const params = {
        access_token: accessToken,
        fields: META_INSIGHT_FIELDS,
        time_increment: 1,
        level,
        limit: 500,
    };
    if (dateRange) {
        params.time_range = JSON.stringify(dateRange);
    }
    else {
        // Sem dateRange = histórico completo da conta
        params.date_preset = 'maximum';
    }
    const rows = [];
    let url = `https://graph.facebook.com/v18.0/${accountId}/insights`;
    while (url !== null) {
        const currentUrl = url;
        const reqParams = currentUrl.includes('?') ? undefined : params;
        const res = await axios.get(currentUrl, { params: reqParams });
        const data = res.data?.data || [];
        rows.push(...data);
        // Paginação via cursor
        const next = res.data?.paging?.next;
        url = (next && next !== currentUrl) ? next : null;
    }
    return rows;
}
// ── Meta Ads — upsert helpers ─────────────────────────────────────────────────
async function upsertAdCampaigns(rows) {
    if (rows.length === 0)
        return;
    const syncedAt = new Date().toISOString();
    const records = rows.map(p => ({
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
        objective: p.objective,
        date: p.date,
        spend_brl: p.spendBrl,
        impressions: p.impressions,
        reach: p.reach,
        clicks: p.clicks,
        ctr: p.ctr,
        cpc_brl: p.cpcBrl,
        cpm_brl: p.cpmBrl,
        frequency: p.frequency,
        purchases: p.purchases,
        purchase_value: p.purchaseValue,
        leads: p.leads,
        link_clicks: p.linkClicks,
        landing_page_views: p.landingPageViews,
        video_views: p.videoViews,
        synced_at: syncedAt,
    }));
    // Upsert in chunks of 500 to avoid Supabase request size limits
    const CHUNK = 500;
    for (let i = 0; i < records.length; i += CHUNK) {
        const chunk = records.slice(i, i + CHUNK);
        const { error } = await supabase
            .from('ad_campaigns')
            .upsert(chunk, { onConflict: 'profile_id,platform,level,campaign_id,adset_id,ad_id,date' });
        if (error) {
            console.error('[AdsSync] upsertAdCampaigns error:', error);
            throw error;
        }
    }
}
async function upsertAdMetrics(payloads) {
    if (payloads.length === 0)
        return;
    const syncedAt = new Date().toISOString();
    const records = payloads.map(p => ({
        profile_id: p.profileId,
        platform: p.platform,
        date: p.date,
        spend_brl: p.spendBrl,
        spend_original: p.spendBrl,
        impressions: p.impressions,
        clicks: p.clicks,
        account_id: p.accountId,
        account_name: p.accountName,
        synced_at: syncedAt,
    }));
    const { error } = await supabase
        .from('ad_metrics')
        .upsert(records, { onConflict: 'profile_id,platform,date,account_id' });
    if (error) {
        console.error('[AdsSync] upsertAdMetrics error:', error);
        throw error;
    }
}
// ── Meta Ads — sync principal ─────────────────────────────────────────────────
/**
 * Sincroniza todos os níveis (campaign, adset, ad) para um ad account.
 * Faz upsert em batch para minimizar latência — o número de requests ao Supabase
 * é proporcional ao número de níveis, não ao número de rows.
 */
async function syncMetaAccount(profileId, account, accessToken, dateRange) {
    const levels = ['campaign', 'adset', 'ad'];
    // Busca objetivos das campanhas uma única vez (só existe no nível campaign)
    const objectiveMap = new Map();
    try {
        let url = `https://graph.facebook.com/v18.0/${account.id}/campaigns`;
        const objParams = { access_token: accessToken, fields: 'id,objective', limit: 500 };
        while (url !== null) {
            const currentUrl = url;
            const reqParams = currentUrl.includes('?') ? undefined : objParams;
            const res = await axios.get(currentUrl, { params: reqParams });
            for (const c of res.data?.data || []) {
                if (c['id'] && c['objective'])
                    objectiveMap.set(c['id'], c['objective']);
            }
            const next = res.data?.paging?.next;
            url = (next && next !== currentUrl) ? next : null;
        }
    }
    catch (e) {
        console.error('[AdsSync] Meta: failed to fetch campaign objectives:', e.message);
    }
    for (const level of levels) {
        try {
            // Busca status dos objetos e insights em paralelo
            const [rows, statusMap] = await Promise.all([
                fetchMetaInsights(account.id, accessToken, level, dateRange),
                fetchMetaObjectStatuses(account.id, accessToken, level),
            ]);
            console.log(`[AdsSync] Meta: ${rows.length} rows at ${level} level for ${account.name} (${statusMap.size} statuses)`);
            const getObjectId = (row) => {
                if (level === 'campaign')
                    return row.campaign_id;
                if (level === 'adset')
                    return row.adset_id || '';
                return row.ad_id || '';
            };
            // Build batch payload
            const batch = rows.map(row => ({
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
                status: statusMap.get(getObjectId(row)) || '',
                ...(objectiveMap.has(row.campaign_id) ? { objective: objectiveMap.get(row.campaign_id) } : {}),
                date: row.date_start,
                spendBrl: round2(parseFloat(row.spend || '0')),
                impressions: parseInt(row.impressions || '0', 10),
                reach: parseInt(row.reach || '0', 10),
                clicks: parseInt(row.clicks || '0', 10),
                ctr: round2(parseFloat(row.ctr || '0')),
                cpcBrl: round2(parseFloat(row.cpc || '0')),
                cpmBrl: round2(parseFloat(row.cpm || '0')),
                frequency: round2(parseFloat(row.frequency || '0')),
                // Conversões: extraídas do array actions/action_values
                purchases: Math.round(getAction(row.actions, 'offsite_conversion.fb_pixel_purchase')),
                purchaseValue: round2(getAction(row.action_values, 'offsite_conversion.fb_pixel_purchase')),
                leads: Math.round(getAction(row.actions, 'offsite_conversion.fb_pixel_lead')),
                linkClicks: Math.round(getAction(row.actions, 'link_click')),
                landingPageViews: Math.round(getAction(row.actions, 'landing_page_view')),
                videoViews: Math.round(getAction(row.video_p25_watched_actions, 'video_view')),
            }));
            // Single batch upsert — much faster than N sequential upserts
            await upsertAdCampaigns(batch);
            // Maintain ad_metrics time-series totals (backward compat)
            if (level === 'campaign') {
                const byDate = {};
                for (const row of rows) {
                    const d = row.date_start;
                    if (!byDate[d])
                        byDate[d] = { spend: 0, impressions: 0, clicks: 0 };
                    byDate[d].spend += parseFloat(row.spend || '0');
                    byDate[d].impressions += parseInt(row.impressions || '0', 10);
                    byDate[d].clicks += parseInt(row.clicks || '0', 10);
                }
                const metricsBatch = Object.entries(byDate).map(([date, m]) => ({
                    profileId,
                    platform: 'meta',
                    date,
                    spendBrl: m.spend,
                    impressions: m.impressions,
                    clicks: m.clicks,
                    accountId: account.id,
                    accountName: account.name,
                }));
                await upsertAdMetrics(metricsBatch);
            }
        }
        catch (err) {
            console.error(`[AdsSync] Meta: error at ${level} level for account ${account.id}:`, err.response?.data || err.message);
        }
    }
}
async function syncMetaAds(profileId, dateRange = { since: yesterday(), until: today() }) {
    // Mutex: evita execuções paralelas
    const acquired = await acquireSyncMutex(profileId, 'meta');
    if (!acquired)
        return;
    const logId = await startSyncLog(profileId, 'meta');
    let totalRows = 0;
    try {
        const tokens = await IntegrationService.getIntegration(profileId, 'meta');
        if (!tokens?.access_token) {
            console.log(`[AdsSync] Meta: no token for profile ${profileId}, skipping.`);
            await finishSyncLog(logId, 0, 'No access token');
            return;
        }
        let accessToken = tokens.access_token;
        if (IntegrationService.isNearExpiry(tokens)) {
            try {
                const refreshed = await IntegrationService.refreshTokens(profileId, 'meta');
                accessToken = refreshed.access_token;
            }
            catch {
                const msg = `Token renewal failed for profile ${profileId}`;
                console.error(`[AdsSync] Meta: ${msg}`);
                await finishSyncLog(logId, 0, msg);
                return;
            }
        }
        // Listar ad accounts
        let accountsRes;
        try {
            accountsRes = await withRetry(() => axios.get('https://graph.facebook.com/v18.0/me/adaccounts', {
                params: { access_token: accessToken, fields: 'id,name', limit: 50 },
            }));
        }
        catch (err) {
            const fbError = err.response?.data?.error;
            if (fbError?.code === 190) {
                console.error(`[AdsSync] Meta: invalid/expired token for profile ${profileId} — marking inactive.`);
                await supabase
                    .from('integrations')
                    .update({ status: 'inactive' })
                    .eq('profile_id', profileId)
                    .eq('platform', 'meta');
                await finishSyncLog(logId, 0, 'Token expired (code 190)');
            }
            else {
                const msg = fbError?.message ?? err.message;
                console.error(`[AdsSync] Meta: failed to list ad accounts for ${profileId}:`, msg);
                await finishSyncLog(logId, 0, msg);
            }
            return;
        }
        const accounts = accountsRes.data?.data || [];
        if (accounts.length === 0) {
            console.log(`[AdsSync] Meta: no ad accounts found for profile ${profileId}`);
            await finishSyncLog(logId, 0);
            return;
        }
        for (const account of accounts) {
            await syncMetaAccount(profileId, account, accessToken, dateRange);
            // Conta rows como referência; o número exato vem do upsert interno
            totalRows += 1;
        }
        console.log(`[AdsSync] Meta: sync complete for profile ${profileId}`);
        await finishSyncLog(logId, totalRows);
    }
    catch (err) {
        console.error(`[AdsSync] Meta: unhandled error for ${profileId}:`, err.message);
        await finishSyncLog(logId, totalRows, err.message);
    }
    finally {
        await releaseSyncMutex(profileId, 'meta');
    }
}
// ── Exports públicos ──────────────────────────────────────────────────────────
/**
 * Backfill Meta Ads.
 * - days=0 ou undefined: busca últimos 365 dias (1 ano de histórico)
 * - days=N: busca apenas os últimos N dias
 */
export async function backfillMetaAds(profileId, days) {
    const effectiveDays = (!days || days <= 0) ? 365 : days;
    const dateRange = { since: daysAgo(effectiveDays), until: today() };
    console.log(`[AdsSync] Meta backfill started for profile ${profileId} — last ${effectiveDays} days`);
    await syncMetaAds(profileId, dateRange);
    console.log(`[AdsSync] Meta backfill complete for profile ${profileId}`);
}
// ── Google Ads Sync ───────────────────────────────────────────────────────────
async function syncGoogleAds(profileId) {
    // Mutex: evita execuções paralelas
    const acquired = await acquireSyncMutex(profileId, 'google');
    if (!acquired)
        return;
    const logId = await startSyncLog(profileId, 'google');
    let totalRows = 0;
    try {
        const tokens = await IntegrationService.getIntegration(profileId, 'google');
        if (!tokens?.access_token) {
            console.log(`[AdsSync] Google: no token for profile ${profileId}, skipping.`);
            await finishSyncLog(logId, 0, 'No access token');
            return;
        }
        const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
        if (!developerToken) {
            console.warn('[AdsSync] Google: GOOGLE_ADS_DEVELOPER_TOKEN not set, skipping.');
            await finishSyncLog(logId, 0, 'GOOGLE_ADS_DEVELOPER_TOKEN not set');
            return;
        }
        const { data: integrationRow } = await supabase
            .from('integrations')
            .select('google_customer_ids')
            .eq('profile_id', profileId)
            .eq('platform', 'google')
            .single();
        const customerIds = integrationRow?.google_customer_ids || [];
        if (customerIds.length === 0) {
            console.log(`[AdsSync] Google: no customer_ids for profile ${profileId}, skipping.`);
            await finishSyncLog(logId, 0, 'No customer IDs configured');
            return;
        }
        for (const customerId of customerIds) {
            try {
                const query = `
                SELECT
                    campaign.id,
                    campaign.name,
                    segments.date,
                    metrics.cost_micros,
                    metrics.impressions,
                    metrics.clicks,
                    metrics.conversions,
                    metrics.conversions_value
                FROM campaign
                WHERE segments.date BETWEEN '${yesterday()}' AND '${today()}'
                  AND campaign.status = 'ENABLED'
            `;
                const reportRes = await axios.post(`https://googleads.googleapis.com/v17/customers/${customerId}/googleAds:searchStream`, { query }, {
                    headers: {
                        Authorization: `Bearer ${tokens.access_token}`,
                        'developer-token': developerToken,
                        'Content-Type': 'application/json',
                    },
                });
                const batches = reportRes.data || [];
                const daily = {};
                for (const batch of batches) {
                    for (const result of batch.results || []) {
                        const date = result.segments?.date;
                        const costMicros = parseInt(result.metrics?.costMicros || '0', 10);
                        const spendBrl = Math.round((costMicros / 1_000_000) * 100) / 100;
                        if (!daily[date])
                            daily[date] = { spend: 0, impressions: 0, clicks: 0, purchases: 0, purchaseValue: 0 };
                        daily[date].spend += spendBrl;
                        daily[date].impressions += parseInt(result.metrics?.impressions || '0', 10);
                        daily[date].clicks += parseInt(result.metrics?.clicks || '0', 10);
                        daily[date].purchases += Math.round(parseFloat(result.metrics?.conversions || '0'));
                        daily[date].purchaseValue += Math.round(parseFloat(result.metrics?.conversionsValue || '0') * 100) / 100;
                    }
                }
                await upsertAdMetrics(Object.entries(daily).map(([date, m]) => ({
                    profileId,
                    platform: 'google',
                    date,
                    spendBrl: m.spend,
                    impressions: m.impressions,
                    clicks: m.clicks,
                    accountId: customerId,
                    accountName: `Google Ads #${customerId}`,
                })));
                totalRows += Object.keys(daily).length;
                console.log(`[AdsSync] Google: synced ${Object.keys(daily).length} day(s) for ${customerId}`);
            }
            catch (err) {
                console.error(`[AdsSync] Google: error for ${customerId}:`, err.response?.data || err.message);
            }
        }
        console.log(`[AdsSync] Google: sync complete for profile ${profileId}`);
        await finishSyncLog(logId, totalRows);
    }
    catch (err) {
        console.error(`[AdsSync] Google: unhandled error for ${profileId}:`, err.message);
        await finishSyncLog(logId, totalRows, err.message);
    }
    finally {
        await releaseSyncMutex(profileId, 'google');
    }
}
// ── Main runner ───────────────────────────────────────────────────────────────
async function runAdsSyncForAllProfiles() {
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
            }
            else if (integration.platform === 'google') {
                await syncGoogleAds(integration.profile_id);
            }
        }
        catch (err) {
            console.error(`[AdsSync] Unhandled error for ${integration.platform} / ${integration.profile_id}:`, err.message);
        }
    }
    console.log('[AdsSync] Sync cycle complete.');
}
// ── Job starter ───────────────────────────────────────────────────────────────
export function startAdsSyncJob() {
    console.log('[AdsSync] Job registered — will run every 6 hours.');
    runAdsSyncForAllProfiles();
    setInterval(runAdsSyncForAllProfiles, 6 * 60 * 60 * 1000);
}
export { runAdsSyncForAllProfiles };
//# sourceMappingURL=ads-sync.job.js.map