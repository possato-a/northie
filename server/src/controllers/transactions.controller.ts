import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

/**
 * Lists all transactions for the authenticated profile
 * @route GET /api/data/transactions
 */
export async function listTransactions(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('transactions')
            .select(`
                id,
                external_id,
                platform,
                status,
                amount_gross,
                amount_net,
                product_name,
                payment_method,
                created_at,
                customer_id,
                customers (
                    name,
                    email,
                    acquisition_channel
                )
            `)
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(200);

        if (error) throw error;

        res.status(200).json(data || []);
    } catch (error: any) {
        console.error('[TransactionsController] listTransactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
