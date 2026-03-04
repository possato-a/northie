import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { calculateValuation } from '../services/valuation.service.js';

export async function getCurrentValuation(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data, error } = await supabase
            .from('valuation_snapshots')
            .select('*')
            .eq('profile_id', profileId)
            .order('snapshot_month', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            // No snapshot yet — calculate inline
            const result = await calculateValuation(profileId);
            return res.status(200).json(result);
        }

        return res.status(200).json(data);
    } catch (err: any) {
        console.error('[valuation.controller] getCurrentValuation error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch valuation' });
    }
}

export async function getValuationHistory(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data, error } = await supabase
            .from('valuation_snapshots')
            .select('snapshot_month, valuation_brl, multiple, arr_brl, mrr_brl, ltv_cac_ratio, churn_rate, benchmark_percentile, methodology')
            .eq('profile_id', profileId)
            .order('snapshot_month', { ascending: true });

        if (error) throw error;

        return res.status(200).json(data ?? []);
    } catch (err: any) {
        console.error('[valuation.controller] getValuationHistory error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch valuation history' });
    }
}
