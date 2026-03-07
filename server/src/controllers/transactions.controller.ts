import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * Lists all transactions for the authenticated profile
 * @route GET /api/data/transactions
 */
export async function listTransactions(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const days = Number(req.query.days ?? 30);

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        let query = supabase
            .from('transactions')
            .select(`id, customer_id, platform, external_id, amount_gross, amount_net, fee_platform, status, product_name, payment_method, created_at, customers (name, email, acquisition_channel)`)
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(500);

        if (days > 0) {
            const since = new Date();
            since.setDate(since.getDate() - days);
            query = query.gte('created_at', since.toISOString());
        }

        const { data, error } = await query;
        if (error) throw error;

        res.status(200).json(data || []);
    } catch (error: any) {
        console.error('[TransactionsController] listTransactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
