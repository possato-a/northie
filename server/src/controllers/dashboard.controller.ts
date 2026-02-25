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

        const channelStats: Record<string, { revenue: number, count: number }> = {};

        sales.forEach(sale => {
            const channel = sale.acquisition_channel || 'desconhecido';
            const revenue = Number(sale.total_ltv) || 0;

            if (!channelStats[channel]) {
                channelStats[channel] = { revenue: 0, count: 0 };
            }
            channelStats[channel].revenue += revenue;
            channelStats[channel].count += 1;
        });

        // Format for charts
        const formattedData = Object.entries(channelStats).map(([name, stats]) => ({
            channel: name,
            revenue: Number(stats.revenue.toFixed(2)),
            customers: stats.count
        }));

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

        const currentTotal = currentSales?.reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;
        const previousTotal = previousSales?.reduce((sum, t) => sum + Number(t.amount_net), 0) || 0;

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
