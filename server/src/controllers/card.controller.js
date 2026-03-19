import { supabase } from '../lib/supabase.js';
import { calculateCapitalScore } from '../services/capital.service.js';
/**
 * Retorna o status da aplicação de crédito do founder (se existir).
 * O frontend usa isso para determinar o estado da página (eligible → pending → approved).
 */
export async function getCardApplication(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    try {
        const { data, error } = await supabase
            .from('card_applications')
            .select('id, status, requested_limit_brl, approved_limit_brl, used_limit_brl, split_rate, created_at, updated_at')
            .eq('profile_id', profileId)
            .single();
        if (error && error.code !== 'PGRST116')
            throw error;
        return res.status(200).json(data ?? null);
    }
    catch (err) {
        console.error('[card.controller] getCardApplication error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch card application' });
    }
}
/**
 * Registra solicitação de crédito do founder.
 * Cria ou atualiza o registro em card_applications com status pending_review.
 * Idempotente: founders que já solicitaram recebem os dados atuais de volta.
 */
export async function requestCard(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    const { requested_limit_brl, purposes, term_months } = req.body;
    if (!requested_limit_brl || !term_months) {
        return res.status(400).json({ error: 'requested_limit_brl e term_months são obrigatórios' });
    }
    // Split rate decresce com prazo mais longo (alinhado com a lógica do frontend)
    const splitRateByTerm = { 6: 0.18, 12: 0.12, 18: 0.09, 24: 0.07 };
    const splitRate = splitRateByTerm[term_months] ?? 0.12;
    try {
        // Busca o Capital Score atual para snapshot
        const scoreData = await calculateCapitalScore(profileId);
        const scoreSnapshot = scoreData?.score ?? 0;
        if (scoreSnapshot < 70) {
            return res.status(403).json({ error: 'Capital Score insuficiente. Mínimo de 70 pontos necessário.' });
        }
        const notes = purposes?.length
            ? `Finalidades: ${purposes.join(', ')}. Prazo: ${term_months} meses.`
            : `Prazo: ${term_months} meses.`;
        const { data, error } = await supabase
            .from('card_applications')
            .upsert({
            profile_id: profileId,
            status: 'pending_review',
            capital_score_snapshot: scoreSnapshot,
            requested_limit_brl,
            split_rate: splitRate,
            notes,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'profile_id' })
            .select()
            .single();
        if (error)
            throw error;
        console.log(`[card.controller] Card request submitted for profile ${profileId} — limit R$${requested_limit_brl}`);
        return res.status(201).json(data);
    }
    catch (err) {
        console.error('[card.controller] requestCard error:', err.message);
        return res.status(500).json({ error: 'Failed to submit card request' });
    }
}
export async function getCapitalScore(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    try {
        // Try to fetch latest snapshot first
        const { data, error } = await supabase
            .from('capital_score_history')
            .select('snapshot_month, score, credit_limit_brl, dimensions, metrics')
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
    }
    catch (err) {
        console.error('[card.controller] getCapitalScore error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch capital score' });
    }
}
export async function getScoreHistory(req, res) {
    const profileId = req.headers['x-profile-id'];
    if (!profileId)
        return res.status(400).json({ error: 'Missing x-profile-id header' });
    try {
        const { data, error } = await supabase
            .from('capital_score_history')
            .select('snapshot_month, score, credit_limit_brl, dimensions, metrics')
            .eq('profile_id', profileId)
            .order('snapshot_month', { ascending: false })
            .limit(12);
        if (error)
            throw error;
        return res.status(200).json(data ?? []);
    }
    catch (err) {
        console.error('[card.controller] getScoreHistory error:', err.message);
        return res.status(500).json({ error: 'Failed to fetch score history' });
    }
}
//# sourceMappingURL=card.controller.js.map