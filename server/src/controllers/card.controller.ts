import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { calculateCapitalScore } from '../services/capital.service.js';

export async function getCapitalScore(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        // Try to fetch latest snapshot first
        const { data, error } = await supabase
            .from('capital_score_history')
            .select('*')
            .eq('profile_id', profileId)
            .order('snapshot_month', { ascending: false })
            .limit(1)
            .single();

        if (error || !data) {
            // No snapshot yet — calculate inline
            const result = await calculateCapitalScore(profileId);
            return res.status(200).json(result);
        }

        return res.status(200).json(data);
    } catch (err: any) {
        console.error('[card.controller] getCapitalScore error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch capital score' });
    }
}

export async function getScoreHistory(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        const { data, error } = await supabase
            .from('capital_score_history')
            .select('snapshot_month, score, credit_limit_brl, dimensions, metrics')
            .eq('profile_id', profileId)
            .order('snapshot_month', { ascending: false })
            .limit(12);

        if (error) throw error;

        return res.status(200).json(data ?? []);
    } catch (err: any) {
        console.error('[card.controller] getScoreHistory error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch score history' });
    }
}
