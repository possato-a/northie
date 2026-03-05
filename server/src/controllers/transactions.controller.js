import { supabase } from '../lib/supabase.js';
/**
 * Lists all transactions for the authenticated profile
 * @route GET /api/data/transactions
 */
export async function listTransactions(req, res) {
    const profileId = req.headers['x-profile-id'];
    const days = Number(req.query.days ?? 30);
    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }
    try {
        let query = supabase
            .from('transactions')
            .select(`*, customers (name, email, acquisition_channel)`)
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(500);
        if (days > 0) {
            const since = new Date();
            since.setDate(since.getDate() - days);
            query = query.gte('created_at', since.toISOString());
        }
        const { data, error } = await query;
        if (error)
            throw error;
        res.status(200).json(data || []);
    }
    catch (error) {
        console.error('[TransactionsController] listTransactions error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=transactions.controller.js.map