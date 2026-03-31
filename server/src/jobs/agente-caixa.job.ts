import { supabase } from '../lib/supabase.js';
import { criarAlerta, obterConfigs } from '../services/agentes.service.js';
import { calcularPosicaoCaixa, calcularForecast } from '../services/financeiro.service.js';

export async function runAgenteCaixa(profileId: string) {
    const configs = await obterConfigs(profileId);
    const config = configs.find(c => c.agent_type === 'caixa');
    if (!config?.is_active) return;

    const runwayMin = config.thresholds.runway_minimo_meses ?? 3;
    const forecastRatio = config.thresholds.forecast_custos_ratio ?? 2;

    const [posicao, forecast] = await Promise.all([
        calcularPosicaoCaixa(profileId),
        calcularForecast(profileId),
    ]);

    // Runway baixo
    if (posicao.runway_meses < runwayMin && posicao.runway_meses >= 0) {
        await criarAlerta(profileId, 'caixa', 'critico',
            `Runway de apenas ${posicao.runway_meses} meses`,
            `Com os custos atuais (R$ ${(posicao.custos_fixos_mensais + posicao.media_ads_spend).toFixed(2)}/mês), seu caixa estimado cobre ${posicao.runway_meses} meses.`,
            'Considere reduzir ads spend, renegociar fornecedores ou antecipar recebíveis via Northie Card.',
            { runway: posicao.runway_meses, custos: posicao.custos_fixos_mensais + posicao.media_ads_spend });
    }

    // Forecast 30d < 2x custos fixos
    const base30 = forecast.find(f => f.cenario === 'base');
    if (base30 && posicao.custos_fixos_mensais > 0 && base30.projecao_30d < posicao.custos_fixos_mensais * forecastRatio) {
        await criarAlerta(profileId, 'caixa', 'atencao',
            'Projeção 30d abaixo do limite de segurança',
            `Projeção base 30d: R$ ${base30.projecao_30d.toFixed(2)}, enquanto ${forecastRatio}x custos fixos = R$ ${(posicao.custos_fixos_mensais * forecastRatio).toFixed(2)}.`,
            'Revise sua estratégia de ads ou considere antecipar receita via Northie Card.',
            { forecast_30d: base30.projecao_30d, threshold: posicao.custos_fixos_mensais * forecastRatio });
    }

    // Salvar snapshot
    const today = new Date().toISOString().slice(0, 10);
    await supabase.from('cashflow_snapshots').upsert({
        profile_id: profileId,
        snapshot_date: today,
        caixa_estimado_brl: posicao.caixa_estimado,
        forecast_30d_base: base30?.projecao_30d ?? 0,
        forecast_30d_otimista: forecast.find(f => f.cenario === 'otimista')?.projecao_30d ?? 0,
        forecast_30d_pessimista: forecast.find(f => f.cenario === 'pessimista')?.projecao_30d ?? 0,
        forecast_60d_base: base30?.projecao_60d ?? 0,
        runway_meses: posicao.runway_meses,
        custos_fixos_mensais: posicao.custos_fixos_mensais,
        media_ads_spend_mensal: posicao.media_ads_spend,
    }, { onConflict: 'profile_id,snapshot_date' });
}

export function startAgenteCaixaJob() {
    console.log('[agente-caixa] Job registrado — roda diariamente.');
    setInterval(async () => {
        console.log('[agente-caixa] Executando análise diária...');
        try {
            const { data: profiles } = await supabase.from('profiles').select('id');
            for (const p of profiles ?? []) {
                await runAgenteCaixa(p.id);
            }
        } catch (err) {
            console.error('[agente-caixa] Erro:', err);
        }
    }, 24 * 60 * 60 * 1000);
}
