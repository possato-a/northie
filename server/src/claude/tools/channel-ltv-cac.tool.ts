import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
    name: 'get_channel_ltv_cac',
    description: 'Calcula LTV/CAC ratio por canal de aquisição com distribuição de budget. Identifica canais sub-explorados com alto retorno.',
    input_schema: {
        type: 'object',
        properties: {
            period_days: {
                type: 'number',
                description: 'Período em dias (padrão: 90)',
            },
        },
        required: [],
    },
};

export async function execute(input: { period_days?: number }, profileId: string): Promise<string> {
    const days = input.period_days ?? 90;
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    const [customersRes, adsRes] = await Promise.all([
        supabase.from('customers')
            .select('total_ltv, acquisition_channel')
            .eq('profile_id', profileId),
        supabase.from('ad_metrics')
            .select('platform, spend_brl')
            .eq('user_id', profileId)
            .gte('date', since.split('T')[0]),
    ]);

    const customers = customersRes.data ?? [];
    const ads = adsRes.data ?? [];

    if (customers.length === 0) return 'Sem dados de clientes.';

    // LTV por canal
    const channelData = new Map<string, { ltv_total: number; count: number }>();
    for (const c of customers) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        const entry = channelData.get(ch) ?? { ltv_total: 0, count: 0 };
        entry.ltv_total += Number(c.total_ltv ?? 0);
        entry.count++;
        channelData.set(ch, entry);
    }

    // Spend por plataforma
    const spendByPlatform = new Map<string, number>();
    for (const a of ads) {
        const p = a.platform as string;
        spendByPlatform.set(p, (spendByPlatform.get(p) ?? 0) + Number(a.spend_brl ?? 0));
    }
    const totalSpend = Array.from(spendByPlatform.values()).reduce((s, v) => s + v, 0);

    // Mapear canais para plataformas
    const channelToPlatform: Record<string, string> = { meta_ads: 'meta', google_ads: 'google' };

    const lines = [`LTV/CAC por canal (últimos ${days} dias):`];
    const results: Array<{ channel: string; ratio: number; ltv: number; cac: number; share: number; count: number }> = [];

    for (const [channel, data] of channelData) {
        const avgLtv = data.ltv_total / data.count;
        const platform = channelToPlatform[channel];
        const spend = platform ? (spendByPlatform.get(platform) ?? 0) : 0;
        const cac = spend > 0 && data.count > 0 ? spend / data.count : 0;
        const ratio = cac > 0 ? avgLtv / cac : 0;
        const share = totalSpend > 0 ? (spend / totalSpend) * 100 : 0;
        results.push({ channel, ratio, ltv: avgLtv, cac, share, count: data.count });
    }

    results.sort((a, b) => b.ratio - a.ratio);

    for (const r of results) {
        const flag = r.ratio > 4 && r.share < 30 ? ' ⚠️ SUB-EXPLORADO' : '';
        lines.push(`  ${r.channel}: LTV/CAC ${fmt(r.ratio)}x | LTV médio R$ ${fmt(r.ltv)} | CAC R$ ${fmt(r.cac)} | ${r.share.toFixed(0)}% do budget | ${r.count} clientes${flag}`);
    }

    lines.push('');
    lines.push(`Budget total no período: R$ ${fmt(totalSpend)}`);

    return lines.join('\n');
}
