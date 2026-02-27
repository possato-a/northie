import { supabase } from '../lib/supabase.js';
/**
 * Returns general high-level stats for the Northie Dashboard
 */
export async function getGeneralStats(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }
    try {
        // 1. Total Revenue & LTV (from approved transactions)
        const { data: transactions, error: tError } = await supabase
            .from('transactions')
            .select('amount_net')
            .eq('profile_id', profileId)
            .eq('status', 'approved');
        if (tError)
            throw tError;
        const totalRevenue = transactions?.reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;
        // 2. Customer Count
        const { count: customerCount, error: cError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId);
        if (cError)
            throw cError;
        // 3. Average Ticket (AOV)
        const averageTicket = customerCount && customerCount > 0 ? totalRevenue / customerCount : 0;
        res.status(200).json({
            total_revenue: totalRevenue,
            total_customers: customerCount || 0,
            average_ticket: Number(averageTicket.toFixed(2)),
            currency: 'BRL'
        });
    }
    catch (error) {
        console.error('Dashboard Stats Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns revenue broken down by acquisition channel
 */
export async function getAttributionStats(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }
    try {
        // Query customers grouped by acquisition_channel
        // Since Supabase doesn't support easy GROUP BY in JS yet for sums, we do it in memory or via RPC
        // For MVP, we'll fetch and reduce
        const { data: sales, error: sError } = await supabase
            .from('customers')
            .select('acquisition_channel, total_ltv')
            .eq('profile_id', profileId);
        if (sError)
            throw sError;
        // Fetch ad metrics for spend
        const { data: metrics, error: mError } = await supabase
            .from('ad_metrics')
            .select('platform, spend_brl')
            .eq('profile_id', profileId);
        if (mError)
            throw mError;
        const channelStats = {};
        // Process revenue
        sales.forEach(sale => {
            const channel = sale.acquisition_channel || 'desconhecido';
            const revenue = Number(sale.total_ltv) || 0;
            if (!channelStats[channel]) {
                channelStats[channel] = { revenue: 0, count: 0, spend: 0 };
            }
            channelStats[channel].revenue += revenue;
            channelStats[channel].count += 1;
        });
        // Process spend
        metrics?.forEach(m => {
            // Map table 'platform' name to acquisition_channel enum if needed
            // Table uses 'meta', 'google', but enum uses 'meta_ads', 'google_ads'
            let channel = m.platform;
            if (channel === 'meta')
                channel = 'meta_ads';
            if (channel === 'google')
                channel = 'google_ads';
            if (!channelStats[channel]) {
                channelStats[channel] = { revenue: 0, count: 0, spend: 0 };
            }
            channelStats[channel].spend += Number(m.spend_brl);
        });
        // Format for charts
        const formattedData = Object.entries(channelStats).map(([name, stats]) => {
            const roas = stats.spend > 0 ? stats.revenue / stats.spend : 0;
            const cac = stats.count > 0 ? stats.spend / stats.count : 0;
            const ltv = stats.count > 0 ? stats.revenue / stats.count : 0;
            return {
                channel: name,
                revenue: Number(stats.revenue.toFixed(2)),
                spend: Number(stats.spend.toFixed(2)),
                customers: stats.count,
                roas: Number(roas.toFixed(2)),
                cac: Number(cac.toFixed(2)),
                ltv: Number(ltv.toFixed(2))
            };
        });
        res.status(200).json(formattedData);
    }
    catch (error) {
        console.error('Attribution Stats Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns growth metrics (Current 30 days vs Previous 30 days)
 */
export async function getGrowthMetrics(req, res) {
    const profileId = req.headers['x-profile-id'];
    try {
        const now = new Date();
        const thirtyDaysAgo = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
        const sixtyDaysAgo = new Date(now.getTime() - (60 * 24 * 60 * 60 * 1000));
        // Current Period
        const { data: currentSales } = await supabase
            .from('transactions')
            .select('amount_net')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', thirtyDaysAgo.toISOString());
        // Previous Period
        const { data: previousSales } = await supabase
            .from('transactions')
            .select('amount_net')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', sixtyDaysAgo.toISOString())
            .lt('created_at', thirtyDaysAgo.toISOString());
        const currentTotal = (currentSales || []).reduce((sum, t) => sum + Number(t.amount_net), 0);
        const previousTotal = (previousSales || []).reduce((sum, t) => sum + Number(t.amount_net), 0);
        const growthPercent = previousTotal > 0
            ? ((currentTotal - previousTotal) / previousTotal) * 100
            : 100; // If it was zero, growth is 100% or we can return null
        res.status(200).json({
            current_revenue: currentTotal,
            previous_revenue: previousTotal,
            growth_percentage: Number(growthPercent.toFixed(2))
        });
    }
    catch (error) {
        console.error('Growth Metrics Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns daily revenue for the last 15 days
 */
export async function getRevenueChart(req, res) {
    const profileId = req.headers['x-profile-id'];
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
        const dailyMap = {};
        // Initialize last 15 days with 0
        for (let i = 0; i < 15; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
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
    }
    catch (error) {
        console.error('Revenue Chart Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns sales intensity for the current year (heatmap data)
 */
export async function getSalesHeatmap(req, res) {
    const profileId = req.headers['x-profile-id'];
    try {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1);
        const { data: transactions } = await supabase
            .from('transactions')
            .select('created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', startOfYear.toISOString());
        // Count occurrences per day
        const dayCounts = {};
        transactions?.forEach(t => {
            const dateStr = t.created_at.split('T')[0];
            dayCounts[dateStr] = (dayCounts[dateStr] || 0) + 1;
        });
        res.status(200).json(dayCounts);
    }
    catch (error) {
        console.error('Sales Heatmap Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns retention cohort data
 */
export async function getRetentionCohort(req, res) {
    const profileId = req.headers['x-profile-id'];
    try {
        // Fetch all customers and their first purchase date
        const { data: customers } = await supabase
            .from('customers')
            .select('id, created_at')
            .eq('profile_id', profileId);
        if (!customers)
            return res.status(200).json([]);
        // Fetch all approved transactions to check for repurchases
        const { data: transactions } = await supabase
            .from('transactions')
            .select('customer_id, created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved');
        const cohortData = {};
        customers.forEach(cust => {
            const birth = new Date(cust.created_at);
            const cohortMonth = `${birth.getFullYear()}-${String(birth.getMonth() + 1).padStart(2, '0')}`;
            if (!cohortData[cohortMonth]) {
                cohortData[cohortMonth] = { n: 0, retentions: { 30: 0, 60: 0, 90: 0, 180: 0 } };
            }
            cohortData[cohortMonth].n += 1;
            // Check if this customer has transactions in subsequent months
            const custTransactions = transactions?.filter(t => t.customer_id === cust.id) || [];
            [30, 60, 90, 180].forEach(days => {
                const threshold = new Date(birth.getTime() + (days * 24 * 60 * 60 * 1000));
                const hasPurchaseAfter = custTransactions.some(t => new Date(t.created_at) >= threshold);
                const cohort = cohortData[cohortMonth];
                if (hasPurchaseAfter && cohort) {
                    cohort.retentions[days] = (cohort.retentions[days] || 0) + 1;
                }
            });
        });
        // Format for UI
        const formatted = Object.entries(cohortData).map(([month, data]) => ({
            month,
            n: data.n,
            retentions: {
                '30d': Math.round((data.retentions[30] || 0) / data.n * 100),
                '60d': Math.round((data.retentions[60] || 0) / data.n * 100),
                '90d': Math.round((data.retentions[90] || 0) / data.n * 100),
                '180d': Math.round((data.retentions[180] || 0) / data.n * 100)
            }
        })).sort((a, b) => b.month.localeCompare(a.month));
        res.status(200).json(formatted);
    }
    catch (error) {
        console.error('Retention Cohort Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns top customers by LTV
 */
export async function getTopCustomers(req, res) {
    const profileId = req.headers['x-profile-id'];
    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('name, email, total_ltv, cac')
            .eq('profile_id', profileId)
            .order('total_ltv', { ascending: false })
            .limit(10);
        if (error)
            throw error;
        res.status(200).json(customers);
    }
    catch (error) {
        console.error('Top Customers Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns daily ROAS/CAC trends for the last 15 days per platform
 */
export async function getChannelTrends(req, res) {
    const profileId = req.headers['x-profile-id'];
    try {
        const fifteenDaysAgo = new Date();
        fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);
        // Get spend metrics
        const { data: metrics } = await supabase
            .from('ad_metrics')
            .select('platform, spend_brl, date')
            .eq('profile_id', profileId)
            .gte('date', fifteenDaysAgo.toISOString().split('T')[0]);
        // Get revenue from transactions (attributed)
        const { data: txs } = await supabase
            .from('transactions')
            .select('platform, amount_net, created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', fifteenDaysAgo.toISOString());
        const trends = {};
        // Initialize last 15 days for each platform
        ['meta', 'google'].forEach(p => {
            trends[p] = { roas: [], cac: [] };
            for (let i = 0; i < 15; i++) {
                const d = new Date();
                d.setDate(d.getDate() - (14 - i));
                const dateStr = d.toISOString().split('T')[0];
                // Calculate ROAS/CAC for this day/platform
                const daySpend = metrics?.filter(m => m.platform === p && m.date === dateStr)
                    .reduce((sum, m) => sum + Number(m.spend_brl), 0) || 0;
                const dayRev = txs?.filter(t => t.platform === p && t.created_at.startsWith(dateStr))
                    .reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;
                const daySales = txs?.filter(t => t.platform === p && t.created_at.startsWith(dateStr)).length || 0;
                const roas = daySpend > 0 ? dayRev / daySpend : 0;
                const cac = daySales > 0 ? daySpend / daySales : 0;
                trends[p].roas.push(Number(roas.toFixed(2)));
                trends[p].cac.push(Number(cac.toFixed(2)));
            }
        });
        res.status(200).json(trends);
    }
    catch (error) {
        console.error('Channel Trends Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns campaigns aggregated by campaign_id for a given period.
 * Query param: days (default 30). Use days=0 for all-time.
 */
export async function getAdCampaigns(req, res) {
    const profileId = req.headers['x-profile-id'];
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
        if (error)
            throw error;
        // Aggregate by campaign_id
        const map = {};
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
            const c = map[row.campaign_id];
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
            if (row.status)
                c.status = row.status;
            if (row.objective)
                c.objective = row.objective;
        }
        // Recalculate derived metrics
        const result = Object.values(map).map((c) => {
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
    }
    catch (error) {
        console.error('Ad Campaigns Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * Returns adsets and ads for a specific campaign.
 * GET /dashboard/ad-campaigns/:campaignId?days=30
 */
export async function getAdCampaignDetail(req, res) {
    const profileId = req.headers['x-profile-id'];
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
        if (error)
            throw error;
        const adsets = {};
        const ads = {};
        const initItem = (base) => ({ ...base, spend_brl: 0, impressions: 0, reach: 0, clicks: 0, freq_impressions_sum: 0, purchases: 0, purchase_value: 0, leads: 0, link_clicks: 0, landing_page_views: 0, video_views: 0 });
        const accumulate = (a, row) => {
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
            if (row.status)
                a.status = row.status;
        };
        for (const row of data || []) {
            if (row.level === 'adset' && row.adset_id) {
                if (!adsets[row.adset_id])
                    adsets[row.adset_id] = initItem({ adset_id: row.adset_id, adset_name: row.adset_name, campaign_id: row.campaign_id, status: row.status });
                accumulate(adsets[row.adset_id], row);
            }
            if (row.level === 'ad' && row.ad_id) {
                if (!ads[row.ad_id])
                    ads[row.ad_id] = initItem({ ad_id: row.ad_id, ad_name: row.ad_name, adset_id: row.adset_id, campaign_id: row.campaign_id, status: row.status });
                accumulate(ads[row.ad_id], row);
            }
        }
        const finalize = (item) => {
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
    }
    catch (error) {
        console.error('Ad Campaign Detail Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=dashboard.controller.js.map