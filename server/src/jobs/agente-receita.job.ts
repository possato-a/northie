import { supabase } from '../lib/supabase.js';
import { criarAlerta, obterConfigs } from '../services/agentes.service.js';

export async function runAgenteReceita(profileId: string) {
    const configs = await obterConfigs(profileId);
    const config = configs.find(c => c.agent_type === 'receita');
    if (!config?.is_active) return;

    const threshold = config.thresholds.queda_receita_pct ?? 15;
    const spikeMultiplier = config.thresholds.spike_multiplicador ?? 3;

    const now = new Date();
    const inicioMes = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const fimMes = now.toISOString();
    const inicioMesAnterior = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    const fimMesAnterior = new Date(now.getFullYear(), now.getMonth(), 0).toISOString();

    const [currentRes, prevRes] = await Promise.all([
        supabase.from('transactions').select('amount_gross, platform')
            .eq('profile_id', profileId).eq('status', 'approved')
            .gte('created_at', inicioMes).lte('created_at', fimMes),
        supabase.from('transactions').select('amount_gross, platform')
            .eq('profile_id', profileId).eq('status', 'approved')
            .gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior),
    ]);

    const currentTotal = (currentRes.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);
    const prevTotal = (prevRes.data ?? []).reduce((s, t) => s + Number(t.amount_gross ?? 0), 0);

    // Queda MoM
    if (prevTotal > 0) {
        const variacao = ((currentTotal - prevTotal) / prevTotal) * 100;
        if (variacao < -threshold) {
            await criarAlerta(profileId, 'receita', 'critico',
                `Receita caiu ${Math.abs(Math.round(variacao))}% vs mês anterior`,
                `Receita atual: R$ ${currentTotal.toFixed(2)} vs R$ ${prevTotal.toFixed(2)} no mês anterior.`,
                'Verifique se alguma campanha foi pausada ou se houve problema com integrações.',
                { variacao, currentTotal, prevTotal });
        }
    }

    // Spike anormal
    if (prevTotal > 0 && currentTotal > prevTotal * spikeMultiplier) {
        await criarAlerta(profileId, 'receita', 'info',
            `Spike de receita: ${Math.round(currentTotal / prevTotal)}x o mês anterior`,
            `Receita atual R$ ${currentTotal.toFixed(2)} é ${(currentTotal / prevTotal).toFixed(1)}x o mês anterior.`,
            'Verifique se é um lançamento ou sazonalidade. Aproveite para escalar.',
            { ratio: currentTotal / prevTotal });
    }

    // Canal que zerou
    const prevByPlatform = new Map<string, number>();
    for (const t of prevRes.data ?? []) {
        prevByPlatform.set(t.platform, (prevByPlatform.get(t.platform) ?? 0) + Number(t.amount_gross ?? 0));
    }
    const currByPlatform = new Map<string, number>();
    for (const t of currentRes.data ?? []) {
        currByPlatform.set(t.platform, (currByPlatform.get(t.platform) ?? 0) + Number(t.amount_gross ?? 0));
    }

    for (const [platform, prevAmount] of prevByPlatform) {
        if (prevAmount > 100 && !currByPlatform.has(platform)) {
            await criarAlerta(profileId, 'receita', 'atencao',
                `Canal ${platform} zerou receita este mês`,
                `${platform} gerou R$ ${prevAmount.toFixed(2)} no mês anterior mas R$ 0 este mês.`,
                'Verifique se a integração está ativa e se há problemas na plataforma.',
                { platform, prevAmount });
        }
    }
}

export function startAgenteReceitaJob() {
    console.log('[agente-receita] Job registrado — roda diariamente.');
    setInterval(async () => {
        console.log('[agente-receita] Executando análise diária...');
        try {
            const { data: profiles } = await supabase.from('profiles').select('id');
            for (const p of profiles ?? []) {
                await runAgenteReceita(p.id);
            }
        } catch (err) {
            console.error('[agente-receita] Erro:', err);
        }
    }, 24 * 60 * 60 * 1000);
}
