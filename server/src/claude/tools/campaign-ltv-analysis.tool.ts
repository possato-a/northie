import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
    name: 'get_campaign_ltv_analysis',
    description: 'Cruza campanhas de ads com LTV dos clientes adquiridos por cada campanha. Mostra ROAS vs LTV real para detectar campanhas que trazem clientes de baixa qualidade apesar de bom ROAS.',
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

    const [metricsRes, customersRes] = await Promise.all([
        supabase.from('ad_metrics')
            .select('campaign_id, spend_brl, platform')
            .eq('user_id', profileId)
            .gte('date', since.split('T')[0]),
        supabase.from('customers')
            .select('total_ltv, acquisition_channel, acquisition_campaign_id')
            .eq('profile_id', profileId),
    ]);

    const metrics = metricsRes.data ?? [];
    const customers = customersRes.data ?? [];

    if (metrics.length === 0) return 'Sem dados de ads no período.';

    // Spend por campanha
    const spendBycamp = new Map<string, { spend: number; platform: string }>();
    for (const m of metrics) {
        if (!m.campaign_id) continue;
        const entry = spendBycamp.get(m.campaign_id) ?? { spend: 0, platform: m.platform as string };
        entry.spend += Number(m.spend_brl ?? 0);
        spendBycamp.set(m.campaign_id, entry);
    }

    // LTV por canal
    const ltvAll = customers.map(c => Number(c.total_ltv ?? 0));
    const avgLtvGlobal = ltvAll.length > 0 ? ltvAll.reduce((s, v) => s + v, 0) / ltvAll.length : 0;

    // LTV por canal de aquisição
    const ltvByChannel = new Map<string, { total: number; count: number }>();
    for (const c of customers) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        const entry = ltvByChannel.get(ch) ?? { total: 0, count: 0 };
        entry.total += Number(c.total_ltv ?? 0);
        entry.count++;
        ltvByChannel.set(ch, entry);
    }

    const lines: string[] = [`LTV médio global: R$ ${fmt(avgLtvGlobal)} (${customers.length} clientes)`];
    lines.push('');
    lines.push('LTV por canal de aquisição:');

    for (const [channel, data] of ltvByChannel) {
        const avgLtv = data.count > 0 ? data.total / data.count : 0;
        const spend = (() => {
            // Mapear canal para plataforma de ads
            const platformMap: Record<string, string> = { meta_ads: 'meta', google_ads: 'google' };
            const platform = platformMap[channel];
            if (!platform) return 0;
            let total = 0;
            for (const [, s] of spendBycamp) {
                if (s.platform === platform) total += s.spend;
            }
            return total;
        })();

        const roas = spend > 0 ? (data.total / spend) : 0;
        const ltvVsAvg = avgLtvGlobal > 0 ? ((avgLtv / avgLtvGlobal - 1) * 100) : 0;
        const flag = avgLtv < avgLtvGlobal * 0.7 && roas > 3 ? ' ⚠️ ROAS alto mas LTV baixo!' : '';

        lines.push(`  ${channel}: LTV médio R$ ${fmt(avgLtv)} (${ltvVsAvg > 0 ? '+' : ''}${ltvVsAvg.toFixed(0)}% vs média) | ${data.count} clientes | Spend R$ ${fmt(spend)} | ROAS ${fmt(roas)}x${flag}`);
    }

    return lines.join('\n');
}
