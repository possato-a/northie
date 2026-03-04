import { supabase } from '../lib/supabase.js';
/**
 * Lists all customers for the authenticated profile
 * @route GET /api/data/customers
 */
export async function listCustomers(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }
    try {
        const { data, error } = await supabase
            .from('customers')
            .select(`
                id,
                email,
                name,
                phone,
                total_ltv,
                acquisition_channel,
                rfm_score,
                churn_probability,
                last_purchase_at,
                cac,
                created_at
            `)
            .eq('profile_id', profileId)
            .order('total_ltv', { ascending: false })
            .limit(500);
        if (error)
            throw error;
        res.status(200).json(data || []);
    }
    catch (error) {
        console.error('[CustomersController] listCustomers error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
//# sourceMappingURL=customers.controller.js.map