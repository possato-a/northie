import { supabase } from '../../../lib/supabase.js';
import type {
    HistoricalSnapshot,
    ChannelCacTrend,
    ChurnRiskByChannel,
    CohortRepeatPurchase,
} from './report-tools.types.js';
import type { Tool } from '@anthropic-ai/sdk/resources.js';

// ── Anthropic tool definitions (schema para o Claude) ─────────────────────────

export const ANALYST_TOOLS: Tool[] = [
    {
        name: 'get_historical_snapshots',
        description: 'Busca snapshots históricos de relatórios anteriores. Use para identificar tendências de receita, ROAS, situação geral e número de críticos ao longo dos meses.',
        input_schema: {
            type: 'object' as const,
            properties: {
                months: { type: 'number', description: 'Quantos meses de histórico buscar (padrão: 6)' },
            },
            required: [],
        },
    },
    {
        name: 'calculate_channel_cac_trend',
        description: 'Calcula a evolução do CAC por canal mês a mês, cruzando novos clientes adquiridos com gasto em ads. Identifica deterioração ou melhora por canal.',
        input_schema: {
            type: 'object' as const,
            properties: {
                months: { type: 'number', description: 'Quantos meses analisar (padrão: 4)' },
            },
            required: [],
        },
    },
    {
        name: 'get_churn_risk_by_channel',
        description: 'Retorna distribuição de risco de churn por canal de aquisição: total de clientes, média de churn probability, clientes de alto risco e LTV em risco.',
        input_schema: {
            type: 'object' as const,
            properties: {},
            required: [],
        },
    },
    {
        name: 'get_cohort_repeat_purchase',
        description: 'Analisa taxa de recompra por canal e mês de aquisição. Identifica quais canais e períodos geram clientes com maior retenção e comportamento de recompra.',
        input_schema: {
            type: 'object' as const,
            properties: {
                months: { type: 'number', description: 'Quantos meses de cohort analisar (padrão: 4)' },
            },
            required: [],
        },
    },
];

// ── Tool implementations ──────────────────────────────────────────────────────

export async function getHistoricalSnapshots(
    profileId: string,
    months = 6,
): Promise<HistoricalSnapshot[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const { data } = await supabase
        .from('report_logs')
        .select('period_start, period_end, created_at, situacao_geral, snapshot')
        .eq('profile_id', profileId)
        .not('snapshot', 'is', null)
        .gte('created_at', since.toISOString())
        .order('created_at', { ascending: true })
        .limit(months * 4);

    if (!data?.length) return [];

    return data.map(row => {
        const s = (row.snapshot as Record<string, unknown>) ?? {};
        return {
            period_start:       String(row.period_start ?? ''),
            period_end:         String(row.period_end ?? ''),
            created_at:         String(row.created_at ?? ''),
            revenue_net:        Number(s.revenue_net ?? 0),
            ad_spend:           Number(s.ad_spend ?? 0),
            roas:               Number(s.roas ?? 0),
            new_customers:      Number(s.new_customers ?? 0),
            ltv_avg:            Number(s.ltv_avg ?? 0),
            revenue_change_pct: s.revenue_change_pct != null ? Number(s.revenue_change_pct) : null,
            situacao_geral:     row.situacao_geral ?? null,
            criticos:           Number(s.criticos ?? 0),
            at_risk_count:      Number(s.at_risk_count ?? 0),
            at_risk_ltv:        Number(s.at_risk_ltv ?? 0),
        };
    });
}

export async function calculateChannelCacTrend(
    profileId: string,
    months = 4,
): Promise<ChannelCacTrend[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    const sinceStr = since.toISOString();

    const [{ data: custData }, { data: adData }] = await Promise.all([
        supabase
            .from('customers')
            .select('acquisition_channel, created_at')
            .eq('profile_id', profileId)
            .gte('created_at', sinceStr)
            .neq('acquisition_channel', 'desconhecido'),
        supabase
            .from('ad_metrics')
            .select('platform, spend_brl, date')
            .eq('profile_id', profileId)
            .gte('date', sinceStr.slice(0, 10)),
    ]);

    if (!custData?.length) return [];

    const PLATFORM_TO_CHANNEL: Record<string, string> = {
        meta: 'meta_ads', google: 'google_ads',
    };

    // Agrupa clientes por canal e mês
    const custByChannelMonth: Record<string, Record<string, number>> = {};
    for (const c of custData) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        const month = String(c.created_at).slice(0, 7);
        if (!custByChannelMonth[ch]) custByChannelMonth[ch] = {};
        custByChannelMonth[ch][month] = (custByChannelMonth[ch][month] ?? 0) + 1;
    }

    // Agrupa spend por canal e mês
    const spendByChannelMonth: Record<string, Record<string, number>> = {};
    for (const a of (adData ?? [])) {
        const ch = PLATFORM_TO_CHANNEL[a.platform] ?? a.platform;
        const month = String(a.date).slice(0, 7);
        if (!spendByChannelMonth[ch]) spendByChannelMonth[ch] = {};
        spendByChannelMonth[ch][month] = (spendByChannelMonth[ch][month] ?? 0) + Number(a.spend_brl ?? 0);
    }

    const results: ChannelCacTrend[] = [];
    for (const [channel, monthMap] of Object.entries(custByChannelMonth)) {
        const sortedMonths = Object.keys(monthMap).sort();
        const channelMonths = sortedMonths.map(month => {
            const newCustomers = monthMap[month] ?? 0;
            const spendBrl = spendByChannelMonth[channel]?.[month] ?? 0;
            const cac = newCustomers > 0 && spendBrl > 0 ? spendBrl / newCustomers : 0;
            return { month, new_customers: newCustomers, spend_brl: spendBrl, cac };
        });

        const monthsWithCac = channelMonths.filter(m => m.cac > 0);
        const oldest = monthsWithCac[0]?.cac ?? 0;
        const newest = monthsWithCac[monthsWithCac.length - 1]?.cac ?? 0;
        const trendPct = oldest > 0 ? ((newest - oldest) / oldest) * 100 : null;

        results.push({ channel, months: channelMonths, cac_oldest: oldest, cac_newest: newest, cac_trend_pct: trendPct });
    }

    return results;
}

export async function getChurnRiskByChannel(
    profileId: string,
): Promise<ChurnRiskByChannel[]> {
    const { data } = await supabase
        .from('customers')
        .select('acquisition_channel, churn_probability, total_ltv')
        .eq('profile_id', profileId)
        .neq('acquisition_channel', 'desconhecido');

    if (!data?.length) return [];

    const byChannel: Record<string, { total: number; probSum: number; highRisk: number; highRiskLtv: number }> = {};
    for (const c of data) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        if (!byChannel[ch]) byChannel[ch] = { total: 0, probSum: 0, highRisk: 0, highRiskLtv: 0 };
        const prob = Number(c.churn_probability ?? 0);
        const ltv  = Number(c.total_ltv ?? 0);
        byChannel[ch].total++;
        byChannel[ch].probSum += prob;
        if (prob > 60) { byChannel[ch].highRisk++; byChannel[ch].highRiskLtv += ltv; }
    }

    return Object.entries(byChannel).map(([channel, v]) => ({
        channel,
        total_customers:       v.total,
        avg_churn_probability: v.total > 0 ? v.probSum / v.total : 0,
        high_risk_count:       v.highRisk,
        high_risk_ltv:         v.highRiskLtv,
    }));
}

export async function getCohortRepeatPurchase(
    profileId: string,
    months = 4,
): Promise<CohortRepeatPurchase[]> {
    const since = new Date();
    since.setMonth(since.getMonth() - months);

    const { data: custData } = await supabase
        .from('customers')
        .select('id, acquisition_channel, created_at')
        .eq('profile_id', profileId)
        .gte('created_at', since.toISOString())
        .neq('acquisition_channel', 'desconhecido');

    if (!custData?.length) return [];

    const customerIds = custData.map(c => c.id);

    const { data: txData } = await supabase
        .from('transactions')
        .select('customer_id')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .in('customer_id', customerIds);

    const txCountByCust: Record<string, number> = {};
    for (const tx of (txData ?? [])) {
        txCountByCust[tx.customer_id] = (txCountByCust[tx.customer_id] ?? 0) + 1;
    }

    const groups: Record<string, { total: number; repeat: number }> = {};
    for (const c of custData) {
        const key = `${c.acquisition_channel}__${String(c.created_at).slice(0, 7)}`;
        if (!groups[key]) groups[key] = { total: 0, repeat: 0 };
        groups[key].total++;
        if ((txCountByCust[c.id] ?? 0) > 1) groups[key].repeat++;
    }

    return Object.entries(groups).map(([key, v]) => {
        const [channel, cohortMonth] = key.split('__');
        return {
            channel:         channel ?? '',
            cohort_month:    cohortMonth ?? '',
            new_customers:   v.total,
            repeat_buyers:   v.repeat,
            repeat_rate_pct: v.total > 0 ? (v.repeat / v.total) * 100 : 0,
        };
    });
}

// ── Dispatcher ────────────────────────────────────────────────────────────────

export async function executeTool(
    name: string,
    input: Record<string, unknown>,
    profileId: string,
): Promise<unknown> {
    try {
        switch (name) {
            case 'get_historical_snapshots':
                return await getHistoricalSnapshots(profileId, Number(input.months ?? 6));
            case 'calculate_channel_cac_trend':
                return await calculateChannelCacTrend(profileId, Number(input.months ?? 4));
            case 'get_churn_risk_by_channel':
                return await getChurnRiskByChannel(profileId);
            case 'get_cohort_repeat_purchase':
                return await getCohortRepeatPurchase(profileId, Number(input.months ?? 4));
            default:
                return { error: `Tool desconhecida: ${name}` };
        }
    } catch (err) {
        console.error(`[ReportTools] Erro na tool ${name}:`, err);
        return { error: 'Falha ao executar tool', tool: name };
    }
}
