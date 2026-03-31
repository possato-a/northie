import { supabase } from '../lib/supabase.js';
import { criarAlerta, obterConfigs } from '../services/agentes.service.js';

export async function runAgenteGastos(profileId: string) {
    const configs = await obterConfigs(profileId);
    const config = configs.find(c => c.agent_type === 'gastos');
    if (!config?.is_active) return;

    const variacaoMax = config.thresholds.custo_variacao_pct ?? 20;

    const now = new Date();
    const inicioSemana = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7).toISOString();
    const inicioSemanaAnterior = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 14).toISOString();

    // Ads spend esta semana vs semana anterior
    const [adsAtual, adsAnterior, txAtual, txAnterior] = await Promise.all([
        supabase.from('ad_metrics').select('platform, spend_brl')
            .eq('profile_id', profileId).gte('date', inicioSemana),
        supabase.from('ad_metrics').select('platform, spend_brl')
            .eq('profile_id', profileId).gte('date', inicioSemanaAnterior).lt('date', inicioSemana),
        supabase.from('transactions').select('amount_gross')
            .eq('profile_id', profileId).eq('status', 'approved').gte('created_at', inicioSemana),
        supabase.from('transactions').select('amount_gross')
            .eq('profile_id', profileId).eq('status', 'approved').gte('created_at', inicioSemanaAnterior).lt('created_at', inicioSemana),
    ]);

    const spendAtual = (adsAtual.data ?? []).reduce((s, a) => s + Number(a.spend_brl ?? 0), 0);
    const spendAnterior = (adsAnterior.data ?? []).reduce((s, a) => s + Number(a.spend_brl ?? 0), 0);
    const receitaAtual = (txAtual.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);
    const receitaAnterior = (txAnterior.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);

    if (spendAnterior > 0) {
        const variacaoSpend = ((spendAtual - spendAnterior) / spendAnterior) * 100;
        const variacaoReceita = receitaAnterior > 0 ? ((receitaAtual - receitaAnterior) / receitaAnterior) * 100 : 0;

        // Spend cresceu sem receita proporcional
        if (variacaoSpend > variacaoMax && variacaoReceita < variacaoSpend / 2) {
            // Identificar plataforma com maior crescimento
            const byPlatform = new Map<string, number>();
            for (const a of adsAtual.data ?? []) {
                byPlatform.set(a.platform, (byPlatform.get(a.platform) ?? 0) + Number(a.spend_brl ?? 0));
            }
            const topPlatform = Array.from(byPlatform.entries()).sort((a, b) => b[1] - a[1])[0];

            await criarAlerta(profileId, 'gastos', 'atencao',
                `Ads spend cresceu ${Math.round(variacaoSpend)}% sem receita correspondente`,
                `Gasto em ads subiu de R$ ${spendAnterior.toFixed(2)} para R$ ${spendAtual.toFixed(2)} (${Math.round(variacaoSpend)}%), mas receita ${variacaoReceita > 0 ? `cresceu apenas ${Math.round(variacaoReceita)}%` : `caiu ${Math.round(Math.abs(variacaoReceita))}%`}.`,
                `Revise a performance das campanhas${topPlatform ? `, especialmente em ${topPlatform[0]}` : ''}. Considere pausar campanhas com ROAS < 1.5.`,
                { variacaoSpend, variacaoReceita, spendAtual, spendAnterior, topPlatform: topPlatform?.[0] });
        }
    }
}

export function startAgenteGastosJob() {
    console.log('[agente-gastos] Job registrado — roda semanalmente.');
    setInterval(async () => {
        console.log('[agente-gastos] Executando análise semanal...');
        try {
            const { data: profiles } = await supabase.from('profiles').select('id');
            for (const p of profiles ?? []) {
                await runAgenteGastos(p.id);
            }
        } catch (err) {
            console.error('[agente-gastos] Erro:', err);
        }
    }, 7 * 24 * 60 * 60 * 1000);
}
