import type { Request, Response } from 'express';
import { supabase } from '../lib/supabase.js';
import { executeRecommendation } from '../services/growth.service.js';
import { runDiagnostic, getLatestDiagnostic } from '../services/growth-intelligence.service.js';
import { requiresCollaboration } from '../services/execution-agents/index.js';
import { runAIAlertAnalyst } from '../services/ai-alert-analyst.service.js';

/**
 * GET /api/growth/recommendations
 * Lista recomendações pending + recentes (approved/executing/completed/failed) para o profile.
 */
export async function listRecommendations(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    try {
        const { data, error } = await supabase
            .from('growth_recommendations')
            .select('id, type, status, title, narrative, impact_estimate, sources, execution_log, meta, created_at, updated_at')
            .eq('profile_id', profileId)
            .or(`status.in.(pending,approved,executing),and(status.in.(completed,failed,dismissed,rejected,cancelled),created_at.gte.${sevenDaysAgo})`)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) return res.status(500).json({ error: 'Failed to fetch recommendations' });
        res.json(data);
    } catch (err: unknown) {
        console.error('[Growth] listRecommendations error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/growth/recommendations/:id/approve
 * Aprova e dispara a execução em background. Responde 202 imediatamente.
 */
export async function approveRecommendation(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const id = req.params.id as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data: rec, error } = await supabase
        .from('growth_recommendations')
        .select('id, type, status, profile_id')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (error || !rec) return res.status(404).json({ error: 'Recommendation not found' });
    if (rec.status !== 'pending') return res.status(409).json({ error: 'Recommendation is not in pending status' });

    // Recomendações que exigem colaboração interativa não podem ser aprovadas diretamente
    if (requiresCollaboration(rec.type as string)) {
        return res.status(200).json({
            requires_collaboration: true,
            message: 'Esta ação requer configuração colaborativa com a IA antes da execução.',
            collaborate_url: `/api/growth/recommendations/${id}/collaborate`,
        });
    }

    await supabase
        .from('growth_recommendations')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
        .eq('id', id);

    // Registrar decisão de aprovação
    const { data: recDetail } = await supabase
        .from('growth_recommendations')
        .select('type, title')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (recDetail) {
        await supabase.from('growth_decisions').insert({
            profile_id: profileId,
            decision_type: 'approved',
            context: `Aprovou: "${recDetail.title}"`,
            action_type: recDetail.type,
        });
    }

    // Execução não-bloqueante em background
    executeRecommendation(profileId, id).catch(err =>
        console.error(`[Growth] Background execution error for ${id}:`, err)
    );

    res.status(202).json({ message: 'Recommendation approved. Execution started in background.', id });
}

/**
 * POST /api/growth/recommendations/:id/dismiss
 * Descarta uma recomendação.
 */
export async function dismissRecommendation(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const reason = req.body?.reason as string | undefined;

    const { data: rec } = await supabase
        .from('growth_recommendations')
        .select('type, title')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    const { error } = await supabase
        .from('growth_recommendations')
        .update({
            status: 'dismissed',
            dismissed_reason: reason ?? null,
            dismissed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', profileId);

    if (error) return res.status(500).json({ error: 'Failed to dismiss recommendation' });

    // Registrar decisão
    if (rec) {
        await supabase.from('growth_decisions').insert({
            profile_id: profileId,
            decision_type: 'rejected',
            context: `Descartou: "${rec.title}"${reason ? ` — motivo: "${reason}"` : ''}`,
            action_type: rec.type,
        });
    }

    res.json({ message: 'Recommendation dismissed', id });
}

/**
 * POST /api/growth/recommendations/:id/reject
 * Rejeição definitiva — o founder não quer essa ação. Diferente de dismiss ("agora não").
 */
export async function rejectRecommendation(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data: rec, error: fetchErr } = await supabase
        .from('growth_recommendations')
        .select('id, status')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (fetchErr || !rec) return res.status(404).json({ error: 'Recommendation not found' });
    if (rec.status !== 'pending') return res.status(409).json({ error: 'Only pending recommendations can be rejected' });

    const reason = req.body?.reason as string | undefined;

    const { data: recDetail } = await supabase
        .from('growth_recommendations')
        .select('type, title')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    const { error } = await supabase
        .from('growth_recommendations')
        .update({
            status: 'rejected',
            dismissed_reason: reason ?? null,
            dismissed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        })
        .eq('id', id)
        .eq('profile_id', profileId);

    if (error) return res.status(500).json({ error: 'Failed to reject recommendation' });

    if (recDetail) {
        await supabase.from('growth_decisions').insert({
            profile_id: profileId,
            decision_type: 'rejected',
            context: `Rejeitou definitivamente: "${recDetail.title}"${reason ? ` — motivo: "${reason}"` : ''}`,
            action_type: recDetail.type,
        });
    }

    res.json({ message: 'Recommendation rejected', id });
}

/**
 * POST /api/growth/recommendations/:id/cancel
 * Cancela uma execução em andamento (approved ou executing).
 * Nota: a execução async pode já ter completado — nesse caso retorna 409.
 */
export async function cancelRecommendation(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data: rec, error: fetchErr } = await supabase
        .from('growth_recommendations')
        .select('id, status')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (fetchErr || !rec) return res.status(404).json({ error: 'Recommendation not found' });
    if (rec.status !== 'approved' && rec.status !== 'executing') {
        return res.status(409).json({ error: `Cannot cancel recommendation in "${rec.status}" status` });
    }

    const { error } = await supabase
        .from('growth_recommendations')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', id)
        .eq('profile_id', profileId);

    if (error) return res.status(500).json({ error: 'Failed to cancel recommendation' });
    res.json({ message: 'Recommendation cancelled', id });
}

/**
 * GET /api/growth/metrics
 * Retorna snapshot de métricas de correlação para exibir no painel Growth.
 * Lê de: mv_campaign_ltv_performance, customers (segmentos RFM, CAC vs LTV, churn)
 */
export async function getGrowthMetrics(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    try {
        // Buscar tudo em paralelo (2 queries → 1 round-trip)
        const [{ data: channelPerf }, { data: customers }] = await Promise.all([
            supabase.from('mv_campaign_ltv_performance')
                .select('channel, customers_acquired, total_ltv_brl, avg_ltv_brl, total_spend_brl, true_roi, high_churn_count, avg_churn_probability')
                .eq('profile_id', profileId)
                .gt('customers_acquired', 0),
            supabase.from('customers')
                .select('rfm_score, total_ltv, cac, churn_probability, acquisition_channel')
                .eq('profile_id', profileId),
        ]);

        if (!customers) return res.json({ channel_performance: [], segments: {}, summary: {} });

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
                if (Number(c.total_ltv) < Number(c.cac)) cacDeficitCount++;
            }
            if (Number(c.churn_probability) >= 60) highChurnCount++;

            const rfm = c.rfm_score as string | null;
            if (rfm && rfm.length === 3) {
                const r = parseInt(rfm[0]!);
                const f = parseInt(rfm[1]!);
                const m = parseInt(rfm[2]!);
                const avg = (r + f + m) / 3;
                if (r >= 4 && f >= 3 && m >= 3) segments['Champions']++;
                else if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3)) segments['Em Risco']++;
                else if (avg <= 2) segments['Inativos']++;
                else segments['Novos Promissores']++;
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
    } catch (err: unknown) {
        console.error('[Growth] getGrowthMetrics error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * POST /api/growth/diagnostic
 * Executa o pipeline multi-agente de diagnóstico de growth para o período informado.
 * Body: { days?: number }  — default 30 dias. Retorna o JSON do diagnóstico estratégico.
 */
export async function runGrowthDiagnostic(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const days = Math.min(Number(req.body?.days ?? 30), 90);
    const end = new Date();
    const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);

    try {
        const diagnostic = await runDiagnostic(profileId, { start, end });
        res.json(diagnostic);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[Growth] runGrowthDiagnostic error:', msg);
        res.status(500).json({ error: msg });
    }
}

/**
 * GET /api/growth/diagnostic/latest
 * Retorna o diagnóstico mais recente salvo para o profile (sem re-rodar os agentes).
 */
export async function getGrowthDiagnosticLatest(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    try {
        const diagnostic = await getLatestDiagnostic(profileId);
        if (!diagnostic) return res.status(404).json({ error: 'Nenhum diagnóstico encontrado para este perfil' });
        res.json(diagnostic);
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[Growth] getGrowthDiagnosticLatest error:', msg);
        res.status(500).json({ error: msg });
    }
}

/**
 * GET /api/growth/execution-history
 * Retorna os últimos 20 growth_recommendations com status completed|failed|executing,
 * com counts agregados de growth_execution_items por status.
 */
export async function getExecutionHistory(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    try {
        // Busca as últimas 20 recomendações nos status relevantes
        const { data: recs, error: recsError } = await supabase
            .from('growth_recommendations')
            .select('id, type, title, status, created_at')
            .eq('profile_id', profileId)
            .in('status', ['completed', 'failed', 'executing'])
            .order('created_at', { ascending: false })
            .limit(20);

        if (recsError) {
            console.error('[Growth] getExecutionHistory recs error:', recsError);
            return res.status(500).json({ error: 'Failed to fetch execution history' });
        }

        if (!recs || recs.length === 0) {
            return res.json([]);
        }

        const recIds = recs.map(r => r.id);

        // Busca todos os execution items desses recommendations de uma vez
        const { data: items, error: itemsError } = await supabase
            .from('growth_execution_items')
            .select('recommendation_id, status, updated_at')
            .in('recommendation_id', recIds);

        if (itemsError) {
            console.error('[Growth] getExecutionHistory items error:', itemsError);
            return res.status(500).json({ error: 'Failed to fetch execution items' });
        }

        // Agrega counts por recommendation_id no Node (evita raw SQL)
        type ItemAgg = {
            total_items: number;
            sent_count: number;
            delivered_count: number;
            failed_count: number;
            converted_count: number;
            last_activity: string | null;
        };

        const agg = new Map<string, ItemAgg>();
        for (const recId of recIds) {
            agg.set(recId, {
                total_items: 0,
                sent_count: 0,
                delivered_count: 0,
                failed_count: 0,
                converted_count: 0,
                last_activity: null,
            });
        }

        for (const item of (items ?? [])) {
            const entry = agg.get(item.recommendation_id);
            if (!entry) continue;
            entry.total_items++;
            if (item.status === 'sent')      entry.sent_count++;
            if (item.status === 'delivered') entry.delivered_count++;
            if (item.status === 'failed')    entry.failed_count++;
            if (item.status === 'converted') entry.converted_count++;
            if (!entry.last_activity || item.updated_at > entry.last_activity) {
                entry.last_activity = item.updated_at;
            }
        }

        const result = recs.map(rec => ({
            recommendation_id: rec.id,
            type:              rec.type,
            title:             rec.title,
            rec_status:        rec.status,
            rec_created_at:    rec.created_at,
            ...(agg.get(rec.id) ?? {
                total_items: 0,
                sent_count: 0,
                delivered_count: 0,
                failed_count: 0,
                converted_count: 0,
                last_activity: null,
            }),
        }));

        res.json(result);
    } catch (err: unknown) {
        console.error('[Growth] getExecutionHistory error:', err);
        return res.status(500).json({ error: 'Internal server error' });
    }
}

/**
 * GET /api/growth/recommendations/:id/status
 * Retorna status atual + execution_log (usado no polling do frontend a cada 2s).
 */
export async function getRecommendationStatus(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    const { id } = req.params;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { data, error } = await supabase
        .from('growth_recommendations')
        .select('id, status, execution_log, updated_at')
        .eq('id', id)
        .eq('profile_id', profileId)
        .single();

    if (error || !data) return res.status(404).json({ error: 'Recommendation not found' });
    res.json(data);
}

/**
 * POST /api/growth/ai-analysis
 * Aciona analise on-demand pelo AI Alert Analyst.
 * Retorna os findings estruturados (alertas + recomendacoes).
 */
/**
 * POST /api/growth/engine/run
 * Força execução manual do growth engine (correlations job).
 */
export async function runEngine(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    // Import dinâmico para evitar circular deps
    const { runCorrelationsForProfile } = await import('../jobs/growth-correlations.job.js');
    runCorrelationsForProfile(profileId).catch(err => {
        console.error('[Growth] engine run error:', err);
    });

    res.status(202).json({ message: 'Growth engine executando...' });
}

/**
 * GET /api/growth/insights
 * Lista insights pendentes (growth_recommendations com status pending).
 */
export async function listInsights(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    try {
        const { data, error } = await supabase
            .from('growth_recommendations')
            .select('id, type, status, title, narrative, impact_estimate, sources, meta, created_at')
            .eq('profile_id', profileId)
            .eq('status', 'pending')
            .order('created_at', { ascending: false })
            .limit(10);

        if (error) return res.status(500).json({ error: error.message });
        res.json(data);
    } catch (err: unknown) {
        console.error('[Growth] listInsights error:', err);
        res.status(500).json({ error: 'Failed to fetch insights' });
    }
}

/**
 * GET /api/growth/memory
 * Retorna decisões históricas do founder para incluir no system prompt.
 */
export async function getMemory(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    try {
        const { data, error } = await supabase
            .from('growth_decisions')
            .select('decision_type, context, action_type, result_summary, created_at')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) return res.status(500).json({ error: error.message });
        res.json(data ?? []);
    } catch (err: unknown) {
        console.error('[Growth] getMemory error:', err);
        res.status(500).json({ error: 'Failed to fetch memory' });
    }
}

/**
 * POST /api/growth/memory
 * Registra instrução permanente do founder (ex: "nunca pausar campanhas durante lançamento").
 */
export async function addInstruction(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    const { instruction } = req.body;
    if (!instruction) return res.status(400).json({ error: 'instruction é obrigatório' });

    const { data, error } = await supabase
        .from('growth_decisions')
        .insert({
            profile_id: profileId,
            decision_type: 'instruction',
            context: instruction,
        })
        .select()
        .single();

    if (error) return res.status(500).json({ error: error.message });
    res.status(201).json(data);
}

export async function runAIAnalysis(req: Request, res: Response) {
    const profileId = req.headers['x-profile-id'] as string;
    if (!profileId) return res.status(400).json({ error: 'Missing x-profile-id' });

    try {
        console.log(`[Growth] AI Analysis on-demand para profile ${profileId}`);
        const output = await runAIAlertAnalyst(profileId);
        res.json({
            profile_id: profileId,
            findings: output.findings,
            findings_count: output.findings.length,
            generated_at: new Date().toISOString(),
        });
    } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Erro desconhecido';
        console.error('[Growth] runAIAnalysis error:', msg);
        res.status(500).json({ error: msg });
    }
}
