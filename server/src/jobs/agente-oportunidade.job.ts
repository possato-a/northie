import { supabase } from '../lib/supabase.js';
import { criarAlerta, obterConfigs } from '../services/agentes.service.js';

export async function runAgenteOportunidade(profileId: string) {
    const configs = await obterConfigs(profileId);
    const config = configs.find(c => c.agent_type === 'oportunidade');
    if (!config?.is_active) return;

    const ltvCacMin = config.thresholds.ltv_cac_ratio_min ?? 5;

    // Buscar LTV/CAC por canal
    const [custRes, adsRes] = await Promise.all([
        supabase.from('customers').select('acquisition_channel, total_ltv')
            .eq('profile_id', profileId),
        supabase.from('ad_metrics').select('platform, spend_brl')
            .eq('profile_id', profileId),
    ]);

    // Agrupar LTV por canal
    const channelLTV = new Map<string, { total_ltv: number; count: number }>();
    for (const c of custRes.data ?? []) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        const entry = channelLTV.get(ch) ?? { total_ltv: 0, count: 0 };
        entry.total_ltv += Number(c.total_ltv ?? 0);
        entry.count++;
        channelLTV.set(ch, entry);
    }

    // Spend total por canal de ads
    const channelSpend = new Map<string, number>();
    for (const a of adsRes.data ?? []) {
        const ch = `${a.platform}_ads`;
        channelSpend.set(ch, (channelSpend.get(ch) ?? 0) + Number(a.spend_brl ?? 0));
    }

    // Detectar canal com LTV/CAC alto e sub-explorado
    for (const [channel, data] of channelLTV) {
        const spend = channelSpend.get(channel) ?? 0;
        if (data.count < 3 || spend <= 0) continue;

        const avgLtv = data.total_ltv / data.count;
        const cac = spend / data.count;
        const ratio = cac > 0 ? avgLtv / cac : 0;

        if (ratio >= ltvCacMin) {
            // Verificar se spend é baixo comparado ao total
            const totalSpend = Array.from(channelSpend.values()).reduce((s, v) => s + v, 0);
            const shareOfSpend = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;

            if (shareOfSpend < 40) {
                await criarAlerta(profileId, 'oportunidade', 'info',
                    `${channel} com LTV/CAC de ${ratio.toFixed(1)}x — sub-explorado`,
                    `O canal ${channel} tem LTV médio de R$ ${avgLtv.toFixed(2)} e CAC de R$ ${cac.toFixed(2)} (ratio ${ratio.toFixed(1)}x), mas recebe apenas ${shareOfSpend.toFixed(0)}% do budget total de ads.`,
                    `Considere aumentar o budget neste canal. O retorno histórico justifica mais investimento.`,
                    { channel, avgLtv, cac, ratio, shareOfSpend });
            }
        }
    }

    // Detectar cohorts entrando na janela de recompra
    const { data: recompraData } = await supabase.from('customers')
        .select('id, email, last_purchase_at, total_ltv')
        .eq('profile_id', profileId)
        .not('last_purchase_at', 'is', null)
        .order('last_purchase_at', { ascending: true })
        .limit(100);

    if (recompraData && recompraData.length >= 5) {
        // Calcular intervalo médio (simplificado: dias desde última compra)
        const now = new Date();
        const diasSemCompra = recompraData.map(c => {
            const last = new Date(c.last_purchase_at);
            return (now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24);
        });

        const mediaIntervalo = diasSemCompra.reduce((s, d) => s + d, 0) / diasSemCompra.length;
        const prontos = recompraData.filter(c => {
            const dias = (now.getTime() - new Date(c.last_purchase_at).getTime()) / (1000 * 60 * 60 * 24);
            return dias >= mediaIntervalo * 0.8 && dias <= mediaIntervalo * 1.5;
        });

        if (prontos.length >= 3) {
            await criarAlerta(profileId, 'oportunidade', 'info',
                `${prontos.length} clientes prontos para recompra`,
                `${prontos.length} clientes estão na janela de recompra (intervalo médio: ${Math.round(mediaIntervalo)} dias). LTV médio: R$ ${(prontos.reduce((s, c) => s + Number(c.total_ltv ?? 0), 0) / prontos.length).toFixed(2)}.`,
                'Considere ativar uma campanha de reativação via WhatsApp ou email para estes clientes.',
                { count: prontos.length, mediaIntervalo: Math.round(mediaIntervalo) });
        }
    }
}

export function startAgenteOportunidadeJob() {
    console.log('[agente-oportunidade] Job registrado — roda semanalmente.');
    setInterval(async () => {
        console.log('[agente-oportunidade] Executando análise semanal...');
        try {
            const { data: profiles } = await supabase.from('profiles').select('id');
            for (const p of profiles ?? []) {
                await runAgenteOportunidade(p.id);
            }
        } catch (err) {
            console.error('[agente-oportunidade] Erro:', err);
        }
    }, 7 * 24 * 60 * 60 * 1000);
}
