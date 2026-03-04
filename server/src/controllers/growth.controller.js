import { supabase } from '../lib/supabase.js';
import { executeRecommendation } from '../services/growth.service.js';
/**
 * GET /api/growth/recommendations
 * Lista recomendações pending + recentes (approved/executing/completed/failed) para o profile.
 */
export async function listRecommendations(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabase
        .from('growth_recommendations')
        .select('id, type, status, title, narrative, impact_estimate, sources, execution_log, meta, created_at, updated_at')
        .eq('profile_id', profileId)
        .or(`status.in.(pending,approved,executing),and(status.in.(completed,failed,dismissed),created_at.gte.${sevenDaysAgo})`)
        .order('created_at', { ascending: false })
        .limit(20);
    if (error)
        return res.status(500).json({ error: 'Failed to fetch recommendations' });
    res.json(data);
}
/**
 * POST /api/growth/recommendations/:id/approve
 * Aprova e dispara a execução em background. Responde 202 imediatamente.
 */
export async function approveRecommendation(req, res) {
    const profileId = req.headers['x-profile-id'];
    const id = req.params.id;
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const { data: rec, error } = await supabase
        .from('growth_recommendations')
        .select('id, status, profile_id')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();
    if (error || !rec)
        return res.status(404).json({ error: 'Recommendation not found' });
    if (rec.status !== 'pending')
        return res.status(409).json({ error: 'Recommendation is not in pending status' });
    await supabase
        .from('growth_recommendations')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);
    // Execução não-bloqueante em background
    executeRecommendation(profileId, id).catch(err => console.error(`[Growth] Background execution error for ${id}:`, err));
    res.status(202).json({ message: 'Recommendation approved. Execution started in background.', id });
}
/**
 * POST /api/growth/recommendations/:id/dismiss
 * Descarta uma recomendação.
 */
export async function dismissRecommendation(req, res) {
    const profileId = req.headers['x-profile-id'];
    const { id } = req.params;
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const { error } = await supabase
        .from('growth_recommendations')
        .update({ status: 'dismissed', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', profileId);
    if (error)
        return res.status(500).json({ error: 'Failed to dismiss recommendation' });
    res.json({ message: 'Recommendation dismissed', id });
}
/**
 * GET /api/growth/recommendations/:id/status
 * Retorna status atual + execution_log (usado no polling do frontend a cada 2s).
 */
export async function getRecommendationStatus(req, res) {
    const profileId = req.headers['x-profile-id'];
    const { id } = req.params;
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const { data, error } = await supabase
        .from('growth_recommendations')
        .select('id, status, execution_log, updated_at')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();
    if (error || !data)
        return res.status(404).json({ error: 'Recommendation not found' });
    res.json(data);
}
//# sourceMappingURL=growth.controller.js.map