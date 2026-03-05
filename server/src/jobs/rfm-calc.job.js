/**
 * @file jobs/rfm-calc.job.ts
 * Calcula e persiste rfm_score, cac e churn_probability para todos os customers
 * de cada perfil ativo. Roda a cada 24 horas (ou sob demanda via API).
 *
 * Metodologia RFM:
 *   Recency  — dias desde a última compra (menos = melhor, score 1-5)
 *   Frequency — número de compras (mais = melhor, score 1-5)
 *   Monetary  — LTV total (mais = melhor, score 1-5)
 *   rfm_score = string "RFM" ex: "555" = Champion, "111" = Lost
 */
import { supabase } from '../lib/supabase.js';
// ── Scoring helpers ───────────────────────────────────────────────────────────
/**
 * Divide um array de valores em 5 quintis e retorna o score (1-5) de um valor.
 * Score 5 = melhor quintil, score 1 = pior.
 */
function quintileScore(value, sorted, ascending = true) {
    const n = sorted.length;
    if (n === 0)
        return 3;
    const rank = sorted.filter(v => (ascending ? v <= value : v >= value)).length;
    const pct = rank / n;
    if (pct <= 0.2)
        return ascending ? 1 : 5;
    if (pct <= 0.4)
        return ascending ? 2 : 4;
    if (pct <= 0.6)
        return 3;
    if (pct <= 0.8)
        return ascending ? 4 : 2;
    return ascending ? 5 : 1;
}
/**
 * Mapeia rfm_score (string "RFM") para um dos 4 segmentos da Northie.
 *
 * Champions       — compraram recentemente, frequência alta, alto valor
 * Em Risco        — alto valor histórico mas recência baixa (parou de comprar)
 * Novos Promissores — recentes com poucos pedidos ainda (potencial a explorar)
 * Inativos        — baixo score em todas as dimensões
 */
export function rfmSegment(score) {
    const [r, f, m] = score.split('').map(Number);
    const avg = (r + f + m) / 3;
    // Champions: top performers — recentes, frequentes e de alto valor
    if (r >= 4 && f >= 3 && m >= 3)
        return 'Champions';
    // Em Risco: valioso mas sumiu (ou alto valor + sem compra recente)
    if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3))
        return 'Em Risco';
    // Inativos: todos os scores baixos
    if (avg <= 2)
        return 'Inativos';
    // Novos Promissores: todo o resto (recentes com potencial)
    return 'Novos Promissores';
}
// ── CAC calculation ───────────────────────────────────────────────────────────
/**
 * Calcula o CAC de um customer somando o gasto de ads no canal de aquisição
 * no mês em que o cliente foi adquirido, dividido pelo número de novos clientes
 * adquiridos naquele canal/mês.
 *
 * Simplificação MVP: CAC = total_spend_canal / total_clientes_canal
 * (sem granularidade temporal por enquanto)
 */
async function buildChannelCacMap(profileId) {
    // Total de spend por plataforma
    const { data: metrics } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .eq('profile_id', profileId);
    const spendByChannel = {};
    for (const m of metrics || []) {
        const ch = m.platform === 'meta' ? 'meta_ads' : m.platform === 'google' ? 'google_ads' : m.platform;
        spendByChannel[ch] = (spendByChannel[ch] || 0) + Number(m.spend_brl);
    }
    // Total de clientes por canal
    const { data: customers } = await supabase
        .from('customers')
        .select('acquisition_channel')
        .eq('profile_id', profileId);
    const countByChannel = {};
    for (const c of customers || []) {
        const ch = c.acquisition_channel || 'desconhecido';
        countByChannel[ch] = (countByChannel[ch] || 0) + 1;
    }
    // CAC por canal
    const cacMap = {};
    for (const [ch, spend] of Object.entries(spendByChannel)) {
        const count = countByChannel[ch] || 1;
        cacMap[ch] = Number((spend / count).toFixed(2));
    }
    return cacMap;
}
// ── Churn probability ─────────────────────────────────────────────────────────
/**
 * Probabilidade de churn baseada em recência (dias sem comprar).
 * Modelo simples: curva logística calibrada em 90 dias = 50%.
 * Retorna 0-100 (inteiro).
 */
function churnProbability(daysSinceLastPurchase, frequency) {
    // Base: quanto mais tempo sem comprar, maior o churn
    const recencyFactor = 1 / (1 + Math.exp(-0.05 * (daysSinceLastPurchase - 90)));
    // Frequência alta mitiga o churn
    const frequencyMitigation = Math.min(frequency * 0.06, 0.35);
    const prob = Math.max(0, recencyFactor - frequencyMitigation);
    return Math.round(prob * 100);
}
// ── Main calculation ──────────────────────────────────────────────────────────
async function calcRfmForProfile(profileId) {
    console.log(`[RFM] Calculating for profile ${profileId}...`);
    // 1. Buscar todos os customers e suas transações
    const { data: customersRaw, error: cErr } = await supabase
        .from('customers')
        .select('id, email, acquisition_channel, created_at, last_purchase_at, total_ltv')
        .eq('profile_id', profileId);
    // Filtra clientes sem email (dados órfãos — NOT NULL constraint no banco)
    const customers = (customersRaw || []).filter(c => c.email);
    if (cErr || !customers.length) {
        console.log(`[RFM] No customers for profile ${profileId}`);
        return;
    }
    const { data: transactions } = await supabase
        .from('transactions')
        .select('customer_id, amount_net, created_at')
        .eq('profile_id', profileId)
        .eq('status', 'approved');
    // 2. Calcular métricas brutas por customer
    const now = Date.now();
    const customerMetrics = customers.map(c => {
        const txs = (transactions || []).filter(t => t.customer_id === c.id);
        const frequency = txs.length;
        const monetary = Number(c.total_ltv) || 0;
        const lastPurchase = c.last_purchase_at
            ? new Date(c.last_purchase_at).getTime()
            : new Date(c.created_at).getTime();
        const recencyDays = Math.floor((now - lastPurchase) / (1000 * 60 * 60 * 24));
        return { id: c.id, email: c.email, acquisition_channel: c.acquisition_channel, recencyDays, frequency, monetary };
    });
    // 3. Calcular quintis para scoring
    const recencies = customerMetrics.map(c => c.recencyDays).sort((a, b) => a - b);
    const frequencies = customerMetrics.map(c => c.frequency).sort((a, b) => a - b);
    const monetaries = customerMetrics.map(c => c.monetary).sort((a, b) => a - b);
    // 4. Calcular CAC por canal
    const cacMap = await buildChannelCacMap(profileId);
    // 5. Compor score e persistir em lotes de 50
    const BATCH = 50;
    for (let i = 0; i < customerMetrics.length; i += BATCH) {
        const batch = customerMetrics.slice(i, i + BATCH);
        const updates = batch.map(c => {
            // Recência: score alto = comprou recentemente (menor dias = melhor)
            const r = quintileScore(c.recencyDays, recencies, false); // false = menor é melhor
            const f = quintileScore(c.frequency, frequencies, true);
            const m = quintileScore(c.monetary, monetaries, true);
            const rfmScore = `${r}${f}${m}`;
            const cac = cacMap[c.acquisition_channel || 'desconhecido'] || 0;
            const churnProb = churnProbability(c.recencyDays, c.frequency);
            return {
                id: c.id,
                email: c.email,
                profile_id: profileId,
                rfm_score: rfmScore,
                cac,
                churn_probability: churnProb,
                rfm_updated_at: new Date().toISOString(),
            };
        });
        // Batch upsert — uma única requisição por lote de 50 em vez de N queries sequenciais
        const { error } = await supabase
            .from('customers')
            .upsert(updates, { onConflict: 'id' });
        if (error) {
            console.error(`[RFM] Failed to batch upsert customers (lote ${i / BATCH + 1}):`, error);
        }
    }
    console.log(`[RFM] Done. Processed ${customerMetrics.length} customers for profile ${profileId}.`);
}
async function runRfmForAllProfiles() {
    console.log('[RFM] Starting RFM calculation cycle...');
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id');
    if (error) {
        console.error('[RFM] Failed to fetch profiles:', error);
        return;
    }
    for (const profile of profiles || []) {
        try {
            await calcRfmForProfile(profile.id);
        }
        catch (err) {
            console.error(`[RFM] Error for profile ${profile.id}:`, err.message);
        }
    }
    console.log('[RFM] Cycle complete.');
}
// ── Job starter ───────────────────────────────────────────────────────────────
export function startRfmCalcJob() {
    console.log('[RFM] Job registered — will run every 24 hours.');
    // Rodar imediatamente
    runRfmForAllProfiles();
    // E a cada 24 horas
    setInterval(runRfmForAllProfiles, 24 * 60 * 60 * 1000);
}
export { runRfmForAllProfiles, calcRfmForProfile };
//# sourceMappingURL=rfm-calc.job.js.map