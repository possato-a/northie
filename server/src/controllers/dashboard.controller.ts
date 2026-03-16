import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

// ── Interfaces for aggregation maps ────────────────────────────────────────

interface ChannelStatsEntry {
    spend: number;
    revenue: number;
    purchases: number;
    ltv_sum: number;
    customers: number;
}

interface CampaignAggregation {
    campaign_id: string;
    campaign_name: string;
    platform: string;
    account_name: string | null;
    objective: string | null;
    status: string | null;
    spend_brl: number;
    impressions: number;
    reach: number;
    clicks: number;
    freq_impressions_sum: number;
    purchases: number;
    purchase_value: number;
    leads: number;
    link_clicks: number;
    landing_page_views: number;
    video_views: number;
}

interface AdsetAggregation {
    adset_id: string;
    adset_name: string | null;
    campaign_id: string;
    status: string | null;
    spend_brl: number;
    impressions: number;
    reach: number;
    clicks: number;
    freq_impressions_sum: number;
    purchases: number;
    purchase_value: number;
    leads: number;
    link_clicks: number;
    landing_page_views: number;
    video_views: number;
}

interface AdAggregation {
    ad_id: string;
    ad_name: string | null;
    adset_id: string | null;
    campaign_id: string;
    status: string | null;
    spend_brl: number;
    impressions: number;
    reach: number;
    clicks: number;
    freq_impressions_sum: number;
    purchases: number;
    purchase_value: number;
    leads: number;
    link_clicks: number;
    landing_page_views: number;
    video_views: number;
}

interface ChannelTrendData {
    roas: number[];
    cac: number[];
}

interface TransactionWithCustomerJoin {
    amount_net: number;
    created_at: string;
    customers: { acquisition_channel: string | null } | null;
}

interface AdCampaignRow {
    campaign_id: string;
    campaign_name: string;
    adset_id: string | null;
    adset_name: string | null;
    ad_id: string | null;
    ad_name: string | null;
    platform: string;
    level: string;
    status: string | null;
    date: string;
    spend_brl: number;
    impressions: number;
    reach: number;
    clicks: number;
    frequency: number;
    purchases: number | null;
    purchase_value: number | null;
    leads: number | null;
    link_clicks: number | null;
    landing_page_views: number | null;
    video_views: number | null;
    account_name: string | null;
    objective: string | null;
}

/**
 * Returns general high-level stats for the Northie Dashboard
 */
export async function getGeneralStats(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        // Single RPC call replaces 3 parallel queries
        const { data: stats, error: statsError } = await supabase.rpc('get_dashboard_stats', {
            p_profile_id: profileId,
            p_days: 30,
        });

        if (statsError) throw statsError;

        const totalRevenue = stats?.total_revenue || 0;
        const customerCount = stats?.total_customers || 0;
        const transactionCount = stats?.total_transactions || 0;

        // Average Ticket (AOV) — revenue / number of transactions
        const averageTicket = transactionCount > 0 ? totalRevenue / transactionCount : 0;

        // Active customers (purchased in last 90 days) + average churn rate
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const [activeResult, churnResult] = await Promise.all([
            supabase.from('customers').select('id', { count: 'exact', head: true })
                .eq('profile_id', profileId).gte('last_purchase_at', ninetyDaysAgo),
            supabase.from('customers').select('churn_probability')
                .eq('profile_id', profileId),
        ]);

        const activeCustomers = activeResult.count ?? 0;
        const churnData = churnResult.data ?? [];
        const churnRate = churnData.length > 0
            ? churnData.reduce((sum, c) => sum + (Number(c.churn_probability) || 0), 0) / churnData.length
            : 0;

        res.status(200).json({
            total_revenue: totalRevenue,
            total_customers: customerCount,
            total_transactions: transactionCount,
            average_ticket: Number(averageTicket.toFixed(2)),
            active_customers: activeCustomers,
            churn_rate: Number(churnRate.toFixed(2)),
            currency: 'BRL'
        });
    } catch (error: unknown) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns revenue broken down by acquisition channel
 */
export async function getAttributionStats(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        // Primary source: ad_campaigns aggregated by platform (has real spend + conversions from Meta/Google APIs)
        const { data: campaigns, error: cError } = await supabase
            .from('ad_campaigns')
            .select('platform, spend_brl, purchase_value, purchases, leads')
            .eq('profile_id', profileId)
            .eq('level', 'campaign');

        if (cError) throw cError;

        // Secondary source: customers attributed via pixel/webhook (populated once Northie pixel is active)
        const { data: customers, error: sError } = await supabase
            .from('customers')
            .select('acquisition_channel, total_ltv')
            .eq('profile_id', profileId);

        if (sError) throw sError;

        // channelStats keyed by display channel name
        const channelStats: Record<string, { spend: number; revenue: number; purchases: number; ltv_sum: number; customers: number }> = {};

        const ensureChannel = (ch: string) => {
            if (!channelStats[ch]) channelStats[ch] = { spend: 0, revenue: 0, purchases: 0, ltv_sum: 0, customers: 0 };
        };

        // Aggregate ad_campaigns by platform → canonical channel name
        for (const row of campaigns || []) {
            const ch = row.platform === 'meta' ? 'Meta Ads' : row.platform === 'google' ? 'Google Ads' : row.platform;
            ensureChannel(ch);
            const entry = channelStats[ch]!;
            entry.spend += Number(row.spend_brl || 0);
            entry.revenue += Number(row.purchase_value || 0);
            entry.purchases += Number(row.purchases || 0);
        }

        // Merge pixel/webhook attribution (secondary — enriches customers & LTV once pixel is active)
        for (const c of customers || []) {
            const raw = (c.acquisition_channel || 'desconhecido').toLowerCase();
            // Normalize to same channel names used above
            const ch = raw.includes('meta') ? 'Meta Ads'
                : raw.includes('google') ? 'Google Ads'
                    : raw.includes('hotmart') ? 'Hotmart'
                        : raw === 'desconhecido' ? 'Direto / Outros'
                            : (c.acquisition_channel || 'Direto / Outros');
            ensureChannel(ch);
            const entry = channelStats[ch]!;
            entry.ltv_sum += Number(c.total_ltv || 0);
            entry.customers += 1;
            // Revenue from ad_campaigns (purchase_value) is the primary signal; customer LTV is used for LTV metric only
        }

        const formattedData = Object.entries(channelStats).map(([name, stats]) => {
            const roas = stats.spend > 0 ? stats.revenue / stats.spend : 0;
            const cac = stats.purchases > 0 ? stats.spend / stats.purchases : 0;
            const ltv = stats.customers > 0 ? stats.ltv_sum / stats.customers : 0;

            return {
                channel: name,
                revenue: Number(stats.revenue.toFixed(2)),
                spend: Number(stats.spend.toFixed(2)),
                purchases: stats.purchases,
                customers: stats.customers,
                roas: Number(roas.toFixed(2)),
                cac: Number(cac.toFixed(2)),
                ltv: Number(ltv.toFixed(2)),
            };
        }).filter(d => d.spend > 0 || d.revenue > 0 || d.customers > 0)
            .sort((a, b) => b.spend - a.spend);

        res.status(200).json(formattedData);
    } catch (error: unknown) {
        console.error('Attribution Stats Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns growth metrics (Current 30 days vs Previous 30 days)
 */
export async function getGrowthMetrics(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data: stats, error } = await supabase.rpc('get_dashboard_stats', {
            p_profile_id: profileId,
            p_days: 30,
        });

        if (error) throw error;

        res.status(200).json({
            current_revenue: stats?.current_revenue || 0,
            previous_revenue: stats?.previous_revenue || 0,
            growth_percentage: stats?.growth_percentage ?? null,
        });
    } catch (error: unknown) {
        console.error('Growth Metrics Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns daily revenue for the last 15 days
 */
export async function getRevenueChart(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

        const { data: transactions } = await supabase
            .from('transactions')
            .select('amount_net, created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', fifteenDaysAgo.toISOString())
            .order('created_at', { ascending: true });

        const dailyMap: Record<string, number> = {};

        // Initialize last 15 days with 0
        for (let i = 0; i < 15; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0]!;
            dailyMap[dateStr] = 0;
        }

        transactions?.forEach(t => {
            const dateStr = t.created_at.split('T')[0];
            if (dailyMap[dateStr] !== undefined) {
                dailyMap[dateStr] += Number(t.amount_net);
            }
        });

        const chartData = Object.entries(dailyMap)
            .map(([date, amount]) => ({ date, amount }))
            .sort((a, b) => a.date.localeCompare(b.date));

        res.status(200).json(chartData);
    } catch (error: unknown) {
        console.error('Revenue Chart Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns sales intensity for the current year (heatmap data)
 */
export async function getSalesHeatmap(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);

        const { data: transactions } = await supabase
            .from('transactions')
            .select('created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', startOfYear.toISOString());

        // Count occurrences per day
        const dayCounts: Record<string, number> = {};
        transactions?.forEach(t => {
            const dateStr = t.created_at.split('T')[0];
            dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
        });

        res.status(200).json(dayCounts);
    } catch (error: unknown) {
        console.error('Sales Heatmap Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns retention cohort data
 */
export async function getRetentionCohort(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data: cohorts, error } = await supabase
            .from('mv_cohort_retention')
            .select('cohort_month, cohort_size, retention_rate_30d, retention_rate_60d, retention_rate_90d')
            .eq('profile_id', profileId)
            .gt('cohort_size', 0)
            .order('cohort_month', { ascending: false })
            .limit(12);

        if (error) throw error;

        const formatted = (cohorts || []).map(c => ({
            month: c.cohort_month,
            n: Number(c.cohort_size),
            retentions: {
                '30d': Math.round(Number(c.retention_rate_30d || 0)),
                '60d': Math.round(Number(c.retention_rate_60d || 0)),
                '90d': Math.round(Number(c.retention_rate_90d || 0)),
                '180d': 0,
            }
        }));

        res.status(200).json(formatted);
    } catch (error: unknown) {
        console.error('Retention Cohort Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns top customers by LTV
 */
export async function getTopCustomers(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('name, email, total_ltv, acquisition_channel')
            .eq('profile_id', profileId)
            .order('total_ltv', { ascending: false })
            .limit(10);

        if (error) throw error;

        res.status(200).json(customers);
    } catch (error: unknown) {
        console.error('Top Customers Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns daily ROAS/CAC trends for the last 15 days per platform
 */
export async function getChannelTrends(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        const since = fifteenDaysAgo.toISOString().split('T')[0]!;

        // Primary source: ad_campaigns has daily spend + purchase_value + purchases per platform
        const { data: campaigns } = await supabase
            .from('ad_campaigns')
            .select('platform, spend_brl, purchase_value, purchases, date')
            .eq('profile_id', profileId)
            .eq('level', 'campaign')
            .gte('date', since);

        // Secondary source: transactions with customer acquisition_channel (enriches when pixel is active)
        const { data: txs } = await supabase
            .from('transactions')
            .select('amount_net, created_at, customers!inner(acquisition_channel)')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', fifteenDaysAgo.toISOString());

        // Pre-index campaigns by platform+date and txs by channel+date (O(N) once vs O(30*N) with filter)
        type CampAgg = { spend: number; revenue: number; purchases: number };
        const campIndex = new Map<string, CampAgg>();
        for (const r of campaigns || []) {
            const key = `${r.platform}|${r.date}`;
            const existing = campIndex.get(key) || { spend: 0, revenue: 0, purchases: 0 };
            existing.spend += Number(r.spend_brl || 0);
            existing.revenue += Number(r.purchase_value || 0);
            existing.purchases += Number(r.purchases || 0);
            campIndex.set(key, existing);
        }

        type TxAgg = { revenue: number; count: number };
        const txIndex = new Map<string, TxAgg>();
        for (const t of txs || []) {
            const ch = (t as unknown as TransactionWithCustomerJoin).customers?.acquisition_channel;
            if (!ch) continue;
            const dateKey = t.created_at.split('T')[0];
            const key = `${ch}|${dateKey}`;
            const existing = txIndex.get(key) || { revenue: 0, count: 0 };
            existing.revenue += Number(t.amount_net);
            existing.count += 1;
            txIndex.set(key, existing);
        }

        const channelMap: Record<string, string> = { meta: 'meta_ads', google: 'google_ads' };
        const trends: Record<string, ChannelTrendData> = {};

        ['meta', 'google'].forEach(p => {
            trends[p] = { roas: [], cac: [] };
            const channelKey = channelMap[p] || p;
            for (let i = 0; i < 15; i++) {
                const d = new Date();
                d.setDate(d.getDate() - (14 - i));
                const dateStr = d.toISOString().split('T')[0]!;

                const camp = campIndex.get(`${p}|${dateStr}`);
                const daySpend = camp?.spend || 0;
                const dayAdRevenue = camp?.revenue || 0;
                const dayAdPurchases = camp?.purchases || 0;

                const tx = txIndex.get(`${channelKey}|${dateStr}`);
                const dayTxRevenue = tx?.revenue || 0;
                const dayTxCount = tx?.count || 0;

                const dayRevenue = dayAdRevenue > 0 ? dayAdRevenue : dayTxRevenue;
                const dayPurchases = dayAdPurchases > 0 ? dayAdPurchases : dayTxCount;

                const roas = daySpend > 0 ? dayRevenue / daySpend : 0;
                const cac = dayPurchases > 0 ? daySpend / dayPurchases : 0;

                trends[p].roas.push(Number(roas.toFixed(2)));
                trends[p].cac.push(Number(cac.toFixed(2)));
            }
        });

        res.status(200).json(trends);
    } catch (error: unknown) {
        console.error('Channel Trends Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns campaigns aggregated by campaign_id for a given period.
 * Query param: days (default 30). Use days=0 for all-time.
 */
export async function getAdCampaigns(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });
    const days = Number(req.query.days ?? 365);

    try {
        let query = supabase
            .from('ad_campaigns')
            .select('campaign_id, campaign_name, platform, account_name, objective, status, date, spend_brl, impressions, reach, clicks, frequency, purchases, purchase_value, leads, link_clicks, landing_page_views, video_views')
            .eq('profile_id', profileId)
            .eq('level', 'campaign')
            .order('date', { ascending: false });

        if (days > 0) {
            const since = new Date();
            since.setDate(since.getDate() - days);
            query = query.gte('date', since.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;

        // Aggregate by campaign_id
        const map: Record<string, CampaignAggregation> = {};
        for (const row of data || []) {
            if (!map[row.campaign_id]) {
                map[row.campaign_id] = {
                    campaign_id: row.campaign_id,
                    campaign_name: row.campaign_name,
                    platform: row.platform,
                    account_name: row.account_name,
                    objective: row.objective,
                    status: row.status,
                    spend_brl: 0, impressions: 0, reach: 0, clicks: 0,
                    // frequency: weighted average (sum impressions*freq / total impressions)
                    freq_impressions_sum: 0,
                    purchases: 0, purchase_value: 0, leads: 0,
                    link_clicks: 0, landing_page_views: 0, video_views: 0,
                };
            }
            const c = map[row.campaign_id]!;
            c.spend_brl += Number(row.spend_brl);
            c.impressions += Number(row.impressions);
            c.reach += Number(row.reach);
            c.clicks += Number(row.clicks);
            c.freq_impressions_sum += Number(row.frequency) * Number(row.impressions);
            c.purchases += Number(row.purchases || 0);
            c.purchase_value += Number(row.purchase_value || 0);
            c.leads += Number(row.leads || 0);
            c.link_clicks += Number(row.link_clicks || 0);
            c.landing_page_views += Number(row.landing_page_views || 0);
            c.video_views += Number(row.video_views || 0);
            if (row.status) c.status = row.status;
            if (row.objective) c.objective = row.objective;
        }

        // Recalculate derived metrics
        const result = Object.values(map).map((c: CampaignAggregation) => {
            const frequency = c.impressions > 0 ? Number((c.freq_impressions_sum / c.impressions).toFixed(2)) : 0;
            const results = c.purchases > 0 ? c.purchases : c.leads > 0 ? c.leads : c.link_clicks;
            const result_type = c.purchases > 0 ? 'purchase' : c.leads > 0 ? 'lead' : 'link_click';
            const cost_per_result = results > 0 ? Number((c.spend_brl / results).toFixed(2)) : 0;
            const roas = c.purchase_value > 0 && c.spend_brl > 0 ? Number((c.purchase_value / c.spend_brl).toFixed(2)) : 0;
            return {
                campaign_id: c.campaign_id,
                campaign_name: c.campaign_name,
                platform: c.platform,
                account_name: c.account_name,
                objective: c.objective,
                status: c.status,
                spend_brl: Number(c.spend_brl.toFixed(2)),
                impressions: c.impressions,
                reach: c.reach,
                clicks: c.clicks,
                ctr: c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0,
                cpc_brl: c.clicks > 0 ? Number((c.spend_brl / c.clicks).toFixed(2)) : 0,
                cpm_brl: c.impressions > 0 ? Number((c.spend_brl / c.impressions * 1000).toFixed(2)) : 0,
                frequency,
                purchases: c.purchases,
                purchase_value: Number(c.purchase_value.toFixed(2)),
                leads: c.leads,
                link_clicks: c.link_clicks,
                landing_page_views: c.landing_page_views,
                video_views: c.video_views,
                results,
                result_type,
                cost_per_result,
                roas,
            };
        }).sort((a, b) => b.spend_brl - a.spend_brl);

        res.status(200).json(result);
    } catch (error: unknown) {
        console.error('Ad Campaigns Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns all dashboard data in a single request.
 * Runs all queries in parallel — a failure in one returns null for that field.
 * Replaces 8 separate requests with 1 cold start on the Vercel serverless edge.
 */
export async function getFullDashboard(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    const days = Number(req.query.days ?? 30);
    const now = new Date();

    const [statsR, growthR, chartR, attributionR, heatmapR, topCustomersR, adCampaignsR] = await Promise.allSettled([

        // ── Stats + Growth (single RPC) ──────────────────────────────────────
        (async () => {
            const { data: stats, error } = await supabase.rpc('get_dashboard_stats', {
                p_profile_id: profileId,
                p_days: days,
            });
            if (error) throw error;
            return stats;
        })(),

        // Growth is included in stats RPC — resolved below
        Promise.resolve(null),

        // ── Revenue Chart ─────────────────────────────────────────────────────
        (async () => {
            const fifteenDaysAgo = new Date();
            fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
            const { data: txs } = await supabase.from('transactions').select('amount_net, created_at').eq('profile_id', profileId).eq('status', 'approved').gte('created_at', fifteenDaysAgo.toISOString()).order('created_at', { ascending: true });
            const dailyMap: Record<string, number> = {};
            for (let i = 0; i < 15; i++) {
                const d = new Date();
                d.setDate(d.getDate() - i);
                dailyMap[d.toISOString().split('T')[0]!] = 0;
            }
            txs?.forEach(t => {
                const k = t.created_at.split('T')[0];
                if (dailyMap[k] !== undefined) dailyMap[k] += Number(t.amount_net);
            });
            return Object.entries(dailyMap).map(([date, amount]) => ({ date, amount })).sort((a, b) => a.date.localeCompare(b.date));
        })(),

        // ── Attribution ───────────────────────────────────────────────────────
        (async () => {
            const [campR, custR] = await Promise.all([
                supabase.from('ad_campaigns').select('platform, spend_brl, purchase_value, purchases, leads').eq('profile_id', profileId).eq('level', 'campaign'),
                supabase.from('customers').select('acquisition_channel, total_ltv').eq('profile_id', profileId),
            ]);
            if (campR.error) throw campR.error;
            const channelStats: Record<string, { spend: number; revenue: number; purchases: number; ltv_sum: number; customers: number }> = {};
            const ensure = (ch: string) => { if (!channelStats[ch]) channelStats[ch] = { spend: 0, revenue: 0, purchases: 0, ltv_sum: 0, customers: 0 }; };
            for (const row of campR.data || []) {
                const ch = row.platform === 'meta' ? 'Meta Ads' : row.platform === 'google' ? 'Google Ads' : row.platform;
                ensure(ch);
                channelStats[ch]!.spend += Number(row.spend_brl || 0);
                channelStats[ch]!.revenue += Number(row.purchase_value || 0);
                channelStats[ch]!.purchases += Number(row.purchases || 0);
            }
            for (const c of custR.data || []) {
                const raw = (c.acquisition_channel || 'desconhecido').toLowerCase();
                const ch = raw.includes('meta') ? 'Meta Ads' : raw.includes('google') ? 'Google Ads' : raw.includes('hotmart') ? 'Hotmart' : raw === 'desconhecido' ? 'Direto / Outros' : (c.acquisition_channel || 'Direto / Outros');
                ensure(ch);
                channelStats[ch]!.ltv_sum += Number(c.total_ltv || 0);
                channelStats[ch]!.customers += 1;
            }
            return Object.entries(channelStats).map(([name, s]) => ({
                channel: name,
                revenue: Number(s.revenue.toFixed(2)),
                spend: Number(s.spend.toFixed(2)),
                purchases: s.purchases,
                customers: s.customers,
                roas: Number((s.spend > 0 ? s.revenue / s.spend : 0).toFixed(2)),
                cac: Number((s.purchases > 0 ? s.spend / s.purchases : 0).toFixed(2)),
                ltv: Number((s.customers > 0 ? s.ltv_sum / s.customers : 0).toFixed(2)),
            })).filter(d => d.spend > 0 || d.revenue > 0 || d.customers > 0).sort((a, b) => b.spend - a.spend);
        })(),

        // ── Heatmap ───────────────────────────────────────────────────────────
        (async () => {
            const startOfYear = new Date(now.getFullYear(), 0, 1);
            const { data: txs } = await supabase.from('transactions').select('created_at').eq('profile_id', profileId).eq('status', 'approved').gte('created_at', startOfYear.toISOString());
            const dayCounts: Record<string, number> = {};
            txs?.forEach(t => { const k = t.created_at.split('T')[0]; dayCounts[k] = (dayCounts[k] || 0) + 1; });
            return dayCounts;
        })(),

        // ── Top Customers ─────────────────────────────────────────────────────
        (async () => {
            const { data, error } = await supabase.from('customers').select('name, email, total_ltv, acquisition_channel').eq('profile_id', profileId).order('total_ltv', { ascending: false }).limit(10);
            if (error) throw error;
            return data;
        })(),

        // ── Ad Campaigns ──────────────────────────────────────────────────────
        (async () => {
            let query = supabase.from('ad_campaigns').select('campaign_id, campaign_name, platform, account_name, objective, status, date, spend_brl, impressions, reach, clicks, frequency, purchases, purchase_value, leads, link_clicks, landing_page_views, video_views').eq('profile_id', profileId).eq('level', 'campaign').order('date', { ascending: false });
            if (days > 0) {
                const since = new Date();
                since.setDate(since.getDate() - days);
                query = query.gte('date', since.toISOString().split('T')[0]);
            }
            const { data, error } = await query;
            if (error) throw error;
            const map: Record<string, CampaignAggregation> = {};
            for (const row of data || []) {
                if (!map[row.campaign_id]) {
                    map[row.campaign_id] = { campaign_id: row.campaign_id, campaign_name: row.campaign_name, platform: row.platform, account_name: row.account_name, objective: row.objective, status: row.status, spend_brl: 0, impressions: 0, reach: 0, clicks: 0, freq_impressions_sum: 0, purchases: 0, purchase_value: 0, leads: 0, link_clicks: 0, landing_page_views: 0, video_views: 0 };
                }
                const c = map[row.campaign_id]!;
                c.spend_brl += Number(row.spend_brl); c.impressions += Number(row.impressions); c.reach += Number(row.reach); c.clicks += Number(row.clicks);
                c.freq_impressions_sum += Number(row.frequency) * Number(row.impressions);
                c.purchases += Number(row.purchases || 0); c.purchase_value += Number(row.purchase_value || 0); c.leads += Number(row.leads || 0);
                c.link_clicks += Number(row.link_clicks || 0); c.landing_page_views += Number(row.landing_page_views || 0); c.video_views += Number(row.video_views || 0);
                if (row.status) c.status = row.status;
                if (row.objective) c.objective = row.objective;
            }
            return Object.values(map).map((c: CampaignAggregation) => {
                const frequency = c.impressions > 0 ? Number((c.freq_impressions_sum / c.impressions).toFixed(2)) : 0;
                const results = c.purchases > 0 ? c.purchases : c.leads > 0 ? c.leads : c.link_clicks;
                const result_type = c.purchases > 0 ? 'purchase' : c.leads > 0 ? 'lead' : 'link_click';
                const cost_per_result = results > 0 ? Number((c.spend_brl / results).toFixed(2)) : 0;
                const roas = c.purchase_value > 0 && c.spend_brl > 0 ? Number((c.purchase_value / c.spend_brl).toFixed(2)) : 0;
                return { campaign_id: c.campaign_id, campaign_name: c.campaign_name, platform: c.platform, account_name: c.account_name, objective: c.objective, status: c.status, spend_brl: Number(c.spend_brl.toFixed(2)), impressions: c.impressions, reach: c.reach, clicks: c.clicks, ctr: c.impressions > 0 ? Number(((c.clicks / c.impressions) * 100).toFixed(2)) : 0, cpc_brl: c.clicks > 0 ? Number((c.spend_brl / c.clicks).toFixed(2)) : 0, cpm_brl: c.impressions > 0 ? Number((c.spend_brl / c.impressions * 1000).toFixed(2)) : 0, frequency, purchases: c.purchases, purchase_value: Number(c.purchase_value.toFixed(2)), leads: c.leads, link_clicks: c.link_clicks, landing_page_views: c.landing_page_views, video_views: c.video_views, results, result_type, cost_per_result, roas };
            }).sort((a, b) => b.spend_brl - a.spend_brl);
        })(),
    ]);

    const ok = <T>(r: PromiseSettledResult<T>): T | null => r.status === 'fulfilled' ? r.value : null;

    const dashStats = ok(statsR);

    // Active customers + churn rate (parallel)
    let activeCustomers = 0;
    let churnRate = 0;
    if (dashStats) {
        const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
        const [activeR, churnR] = await Promise.all([
            supabase.from('customers').select('id', { count: 'exact', head: true })
                .eq('profile_id', profileId).gte('last_purchase_at', ninetyDaysAgo),
            supabase.from('customers').select('churn_probability')
                .eq('profile_id', profileId),
        ]);
        activeCustomers = activeR.count ?? 0;
        const churnData = churnR.data ?? [];
        churnRate = churnData.length > 0
            ? Number((churnData.reduce((s, c) => s + (Number(c.churn_probability) || 0), 0) / churnData.length).toFixed(2))
            : 0;
    }

    res.status(200).json({
        stats: dashStats ? {
            total_revenue: dashStats.total_revenue,
            total_customers: dashStats.total_customers,
            total_transactions: dashStats.total_transactions,
            average_ticket: dashStats.average_ticket,
            active_customers: activeCustomers,
            churn_rate: churnRate,
            currency: 'BRL',
        } : null,
        growth: dashStats ? {
            current_revenue: dashStats.current_revenue,
            previous_revenue: dashStats.previous_revenue,
            growth_percentage: dashStats.growth_percentage,
        } : null,
        chart: ok(chartR),
        attribution: ok(attributionR),
        heatmap: ok(heatmapR),
        topCustomers: ok(topCustomersR),
        adCampaigns: ok(adCampaignsR),
    });
}

/**
 * Returns adsets and ads for a specific campaign.
 * GET /dashboard/ad-campaigns/:campaignId?days=30
 */
export async function getAdCampaignDetail(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { campaignId } = req.params;
    const days = Number(req.query.days ?? 365);

    try {
        let query = supabase
            .from('ad_campaigns')
            .select('campaign_id, adset_id, adset_name, ad_id, ad_name, platform, level, status, date, spend_brl, impressions, reach, clicks, frequency, purchases, purchase_value, leads, link_clicks, landing_page_views, video_views')
            .eq('profile_id', profileId)
            .eq('campaign_id', campaignId)
            .in('level', ['adset', 'ad'])
            .order('date', { ascending: false });

        if (days > 0) {
            const since = new Date();
            since.setDate(since.getDate() - days);
            query = query.gte('date', since.toISOString().split('T')[0]);
        }

        const { data, error } = await query;
        if (error) throw error;

        const adsets: Record<string, AdsetAggregation> = {};
        const ads: Record<string, AdAggregation> = {};

        const initAdset = (base: Pick<AdsetAggregation, 'adset_id' | 'adset_name' | 'campaign_id' | 'status'>): AdsetAggregation => ({ ...base, spend_brl: 0, impressions: 0, reach: 0, clicks: 0, freq_impressions_sum: 0, purchases: 0, purchase_value: 0, leads: 0, link_clicks: 0, landing_page_views: 0, video_views: 0 });
        const initAd = (base: Pick<AdAggregation, 'ad_id' | 'ad_name' | 'adset_id' | 'campaign_id' | 'status'>): AdAggregation => ({ ...base, spend_brl: 0, impressions: 0, reach: 0, clicks: 0, freq_impressions_sum: 0, purchases: 0, purchase_value: 0, leads: 0, link_clicks: 0, landing_page_views: 0, video_views: 0 });
        const accumulate = (a: AdsetAggregation | AdAggregation, row: AdCampaignRow) => {
            a.spend_brl += Number(row.spend_brl);
            a.impressions += Number(row.impressions);
            a.reach += Number(row.reach);
            a.clicks += Number(row.clicks);
            a.freq_impressions_sum += Number(row.frequency) * Number(row.impressions);
            a.purchases += Number(row.purchases || 0);
            a.purchase_value += Number(row.purchase_value || 0);
            a.leads += Number(row.leads || 0);
            a.link_clicks += Number(row.link_clicks || 0);
            a.landing_page_views += Number(row.landing_page_views || 0);
            a.video_views += Number(row.video_views || 0);
            if (row.status) a.status = row.status;
        };

        for (const row of (data || []) as AdCampaignRow[]) {
            if (row.level === 'adset' && row.adset_id) {
                if (!adsets[row.adset_id]) adsets[row.adset_id] = initAdset({ adset_id: row.adset_id, adset_name: row.adset_name, campaign_id: row.campaign_id, status: row.status });
                accumulate(adsets[row.adset_id]!, row);
            }
            if (row.level === 'ad' && row.ad_id) {
                if (!ads[row.ad_id]) ads[row.ad_id] = initAd({ ad_id: row.ad_id, ad_name: row.ad_name, adset_id: row.adset_id, campaign_id: row.campaign_id, status: row.status });
                accumulate(ads[row.ad_id]!, row);
            }
        }

        const finalize = (item: AdsetAggregation | AdAggregation) => {
            const frequency = item.impressions > 0 ? Number((item.freq_impressions_sum / item.impressions).toFixed(2)) : 0;
            const results = item.purchases > 0 ? item.purchases : item.leads > 0 ? item.leads : item.link_clicks;
            const cost_per_result = results > 0 ? Number((item.spend_brl / results).toFixed(2)) : 0;
            const roas = item.purchase_value > 0 && item.spend_brl > 0 ? Number((item.purchase_value / item.spend_brl).toFixed(2)) : 0;
            return {
                ...item,
                spend_brl: Number(item.spend_brl.toFixed(2)),
                purchase_value: Number(item.purchase_value.toFixed(2)),
                ctr: item.impressions > 0 ? Number(((item.clicks / item.impressions) * 100).toFixed(2)) : 0,
                cpc_brl: item.clicks > 0 ? Number((item.spend_brl / item.clicks).toFixed(2)) : 0,
                cpm_brl: item.impressions > 0 ? Number((item.spend_brl / item.impressions * 1000).toFixed(2)) : 0,
                frequency, results, cost_per_result, roas,
                freq_impressions_sum: undefined,
            };
        };

        res.status(200).json({
            adsets: Object.values(adsets).map(finalize).sort((a, b) => b.spend_brl - a.spend_brl),
            ads: Object.values(ads).map(finalize).sort((a, b) => b.spend_brl - a.spend_brl),
        });
    } catch (error: unknown) {
        console.error('Ad Campaign Detail Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
