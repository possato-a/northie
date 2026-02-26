import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * Returns general high-level stats for the Northie Dashboard
 */
export async function getGeneralStats(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

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

        if (tError) throw tError;

        const totalRevenue = transactions?.reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;

        // 2. Customer Count
        const { count: customerCount, error: cError } = await supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId);

        if (cError) throw cError;

        // 3. Average Ticket (AOV)
        const averageTicket = customerCount && customerCount > 0 ? totalRevenue / customerCount : 0;

        res.status(200).json({
            total_revenue: totalRevenue,
            total_customers: customerCount || 0,
            average_ticket: Number(averageTicket.toFixed(2)),
            currency: 'BRL'
        });
    } catch (error: any) {
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
        // Query customers grouped by acquisition_channel
        // Since Supabase doesn't support easy GROUP BY in JS yet for sums, we do it in memory or via RPC
        // For MVP, we'll fetch and reduce
        const { data: sales, error: sError } = await supabase
            .from('customers')
            .select('acquisition_channel, total_ltv')
            .eq('profile_id', profileId);

        if (sError) throw sError;

        // Fetch ad metrics for spend
        const { data: metrics, error: mError } = await supabase
            .from('ad_metrics')
            .select('platform, spend_brl')
            .eq('profile_id', profileId);

        if (mError) throw mError;

        const channelStats: Record<string, { revenue: number, count: number, spend: number }> = {};

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
            if (channel === 'meta') channel = 'meta_ads';
            if (channel === 'google') channel = 'google_ads';

            if (!channelStats[channel]) {
                channelStats[channel] = { revenue: 0, count: 0, spend: 0 };
            }
            channelStats[channel]!.spend += Number(m.spend_brl);
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
    } catch (error: any) {
        console.error('Attribution Stats Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns growth metrics (Current 30 days vs Previous 30 days)
 */
export async function getGrowthMetrics(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

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
    } catch (error: any) {
        console.error('Growth Metrics Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns daily revenue for the last 15 days
 */
export async function getRevenueChart(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

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
    } catch (error: any) {
        console.error('Revenue Chart Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns sales intensity for the current year (heatmap data)
 */
export async function getSalesHeatmap(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

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
    } catch (error: any) {
        console.error('Sales Heatmap Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns retention cohort data
 */
export async function getRetentionCohort(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    try {
        // Fetch all customers and their first purchase date
        const { data: customers } = await supabase
            .from('customers')
            .select('id, created_at')
            .eq('profile_id', profileId);

        if (!customers) return res.status(200).json([]);

        // Fetch all approved transactions to check for repurchases
        const { data: transactions } = await supabase
            .from('transactions')
            .select('customer_id, created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved');

        const cohortData: Record<string, { n: number, retentions: Record<number, number> }> = {};

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
    } catch (error: any) {
        console.error('Retention Cohort Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns top customers by LTV
 */
export async function getTopCustomers(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    try {
        const { data: customers, error } = await supabase
            .from('customers')
            .select('name, email, total_ltv, cac')
            .eq('profile_id', profileId)
            .order('total_ltv', { ascending: false })
            .limit(10);

        if (error) throw error;

        res.status(200).json(customers);
    } catch (error: any) {
        console.error('Top Customers Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns daily ROAS/CAC trends for the last 15 days per platform
 */
export async function getChannelTrends(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

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

        const trends: Record<string, any> = {};

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
    } catch (error: any) {
        console.error('Channel Trends Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * Returns latest ad campaigns from ad_metrics
 */
export async function getAdCampaigns(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    try {
        // Since we don't have a lookup table for ad names yet (MVP),
        // we show the platforms aggregate spend today.
        // In a real scenario, we'd fetch from Meta/Google API or normalized cache.
        const today = new Date().toISOString().split('T')[0];

        const { data: metrics } = await supabase
            .from('ad_metrics')
            .select('platform, spend_brl, impressions, clicks')
            .eq('profile_id', profileId)
            .eq('date', today);

        // Attributed sales today per platform
        const { data: txs } = await supabase
            .from('transactions')
            .select('platform, amount_net')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', today + 'T00:00:00Z');

        const campaigns = ['meta', 'google'].map(p => {
            const m = metrics?.find(m => m.platform === p);
            const pTxs = txs?.filter(t => t.platform === p) || [];
            const revenue = pTxs.reduce((sum, t) => sum + Number(t.amount_net), 0);
            const spend = Number(m?.spend_brl || 0);

            return {
                id: p,
                name: p === 'meta' ? 'Meta Ads Portfolio' : 'Google Ads Portfolio',
                platform: p === 'meta' ? 'Meta' : 'Google',
                spendToday: spend,
                roasToday: spend > 0 ? Number((revenue / spend).toFixed(2)) : 0,
                status: 'Ativo'
            };
        });

        res.status(200).json(campaigns);
    } catch (error: any) {
        console.error('Ad Campaigns Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
