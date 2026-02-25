import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';

export async function listTransactions(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;

    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false });

        if (error) throw error;

        res.status(200).json(data);
    } catch (error: any) {
        console.error('List Transactions Error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
}
