import { supabase } from '../lib/supabase.js';
import { executeRecommendation } from '../services/growth.service.js';
import { runDiagnostic, getLatestDiagnostic } from '../services/growth-intelligence.service.js';
/**
 * GET /api/growth/recommendations
 * Lista recomendações pending + recentes (approved/executing/completed/failed) para o profile.
 */
export async function listRecommendations(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
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
    catch (err) {
        console.error('[Growth] listRecommendations error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
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
 * GET /api/growth/metrics
 * Retorna snapshot de métricas de correlação para exibir no painel Growth.
 * Lê de: mv_campaign_ltv_performance, customers (segmentos RFM, CAC vs LTV, churn)
 */
export async function getGrowthMetrics(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    try {
        // 1. Performance por canal (materialized view)
        const { data: channelPerf } = await supabase
            .from('mv_campaign_ltv_performance')
            .select('channel, customers_acquired, total_ltv_brl, avg_ltv_brl, total_spend_brl, true_roi, high_churn_count, avg_churn_probability')
            .eq('profile_id', profileId)
            .gt('customers_acquired', 0);
        // 2. Dados de customers para segmentos e métricas
        const { data: customers } = await supabase
            .from('customers')
            .select('rfm_score, total_ltv, cac, churn_probability, acquisition_channel')
            .eq('profile_id', profileId);
        if (!customers)
            return res.json({ channel_performance: [], segments: {}, summary: {} });
        // Segmentos RFM
        const segments = { Champions: 0, 'Em Risco': 0, 'Novos Promissores': 0, Inativos: 0 };
        let totalLtv = 0;
        let totalCac = 0;
        let cacCount = 0;
        let cacDeficitCount = 0;
        let highChurnCount = 0;
        for (const c of customers) {
            totalLtv += Number(c.total_ltv) || 0;
            if (Number(c.cac) > 0) {
                totalCac += Number(c.cac);
                cacCount++;
                if (Number(c.total_ltv) < Number(c.cac))
                    cacDeficitCount++;
            }
            if (Number(c.churn_probability) >= 60)
                highChurnCount++;
            const rfm = c.rfm_score;
            if (rfm && rfm.length === 3) {
                const r = parseInt(rfm[0]);
                const f = parseInt(rfm[1]);
                const m = parseInt(rfm[2]);
                const avg = (r + f + m) / 3;
                if (r >= 4 && f >= 3 && m >= 3)
                    segments['Champions']++;
                else if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3))
                    segments['Em Risco']++;
                else if (avg <= 2)
                    segments['Inativos']++;
                else
                    segments['Novos Promissores']++;
            }
        }
        const avgLtv = customers.length > 0 ? totalLtv / customers.length : 0;
        const avgCac = cacCount > 0 ? totalCac / cacCount : 0;
        // ROI global da view
        const globalRoi = (channelPerf || []).reduce((best, row) => {
            const roi = Number(row.true_roi);
            return roi > best ? roi : best;
        }, 0);
        res.json({
            channel_performance: channelPerf || [],
            segments,
            summary: {
                total_customers: customers.length,
                avg_ltv_brl: Math.round(avgLtv * 100) / 100,
                avg_cac_brl: Math.round(avgCac * 100) / 100,
                cac_deficit_count: cacDeficitCount,
                high_churn_count: highChurnCount,
                best_roi: Math.round(globalRoi * 100) / 100,
            },
        });
    }
    catch (err) {
        console.error('[Growth] getGrowthMetrics error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}
/**
 * POST /api/growth/diagnostic
 * Executa o pipeline multi-agente de diagnóstico de growth para o período informado.
 * Body: { days?: number }  — default 30 dias. Retorna o JSON do diagnóstico estratégico.
 */
export async function runGrowthDiagnostic(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    const days = Math.min(Number(req.body?.days ?? 30), 90);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
    try {
        const diagnostic = await runDiagnostic(profileId, { start, end });
        res.json(diagnostic);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[Growth] runGrowthDiagnostic error:', msg);
        res.status(500).json({ error: msg });
    }
}
/**
 * GET /api/growth/diagnostic/latest
 * Retorna o diagnóstico mais recente salvo para o profile (sem re-rodar os agentes).
 */
export async function getGrowthDiagnosticLatest(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id' });
    try {
        const diagnostic = await getLatestDiagnostic(profileId);
        if (!diagnostic)
            return res.status(404).json({ error: 'Nenhum diagnóstico encontrado para este perfil' });
        res.json(diagnostic);
    }
    catch (err) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[Growth] getGrowthDiagnosticLatest error:', msg);
        res.status(500).json({ error: msg });
    }
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