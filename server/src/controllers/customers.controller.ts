import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export async function listCustomers(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .eq('profile_id', profileId)
            .order('last_purchase_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error: any) {
        console.error('List Customers Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
