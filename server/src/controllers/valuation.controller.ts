import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { calculateValuation } from '../services/valuation.service.js';

export async function getCurrentValuation(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id header' });

    try {
        // Buscar tudo em paralelo (2 queries → 1 round-trip)
        const [{ data, error }, { data: allSnapshots }] = await Promise.all([
            supabase.from('valuation_snapshots')
                .select('snapshot_month, valuation_brl, multiple, arr_brl, mrr_brl, ltv_cac_ratio, churn_rate, benchmark_percentile, methodology')
                .eq('profile_id', profileId)
                .order('snapshot_month', { ascending: false })
                .limit(1)
                .single(),
            supabase.from('valuation_snapshots')
                .select('valuation_brl, profile_id')
                .order('snapshot_month', { ascending: false }),
        ]);

        // Get most recent snapshot per profile
        const latestByProfile = new Map<string, number>();
        for (const s of allSnapshots || []) {
            if (!latestByProfile.has(s.profile_id)) {
                latestByProfile.set(s.profile_id, Number(s.valuation_brl));
            }
        }
        const allValues = Array.from(latestByProfile.values()).sort((a, b) => a - b);
        const segmentSampleSize = allValues.length;
        const mid = Math.floor(allValues.length / 2);
        const segmentMedianBrl = allValues.length === 0 ? 0
            : allValues.length % 2 === 0
                ? ((allValues[mid - 1]! + allValues[mid]!) / 2)
                : allValues[mid]!;

        if (error || !data) {
            // No snapshot yet — calculate inline
            const result = await calculateValuation(profileId);
            return res.status(200).json({ ...result, segment_median_brl: segmentMedianBrl, segment_sample_size: segmentSampleSize });
        }

        return res.status(200).json({ ...data, segment_median_brl: segmentMedianBrl, segment_sample_size: segmentSampleSize });
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
