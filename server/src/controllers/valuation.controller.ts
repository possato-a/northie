import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { calculateValuation } from '../services/valuation.service.js';

export async function getCurrentValuation(req: Request, res: Response): Promise<Response> {
    const profileId = req.headers['x-profile-id'] as string | undefined;
    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const result = await calculateValuation(profileId);
        return res.status(200).json({ data: result });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[valuation.controller] getCurrentValuation error:', message);
        return res.status(500).json({ error: 'Failed to calculate valuation' });
    }
}

export async function getValuationHistory(req: Request, res: Response): Promise<Response> {
    const profileId = req.headers['x-profile-id'] as string | undefined;
    if (!profileId) {
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    }

    try {
        const { data, error } = await supabase
            .from('capital_score_history')
            .select('snapshot_month, valuation_snapshot, created_at')
            .eq('profile_id', profileId)
            .not('valuation_snapshot', 'is', null)
            .order('created_at', { ascending: false })
            .limit(12);

        if (error) throw error;

        return res.status(200).json({ data: data ?? [] });
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[valuation.controller] getValuationHistory error:', message);
        return res.status(500).json({ error: 'Failed to fetch valuation history' });
    }
}
