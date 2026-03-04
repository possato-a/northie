import { supabase } from '../../lib/supabase.js';

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly';
export type ReportFormat = 'csv' | 'json';

export function getPeriodDays(frequency: ReportFrequency): number {
    switch (frequency) {
        case 'weekly': return 7;
        case 'monthly': return 30;
        case 'quarterly': return 90;
    }
}

export async function generateReportData(profileId: string, frequency: ReportFrequency) {
    const days = getPeriodDays(frequency);
    const periodStart = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const periodEnd = new Date();

    const [{ data: transactions }, { data: adMetrics }, { data: newCustomers }] = await Promise.all([
        supabase
            .from('transactions')
            .select('amount_net, amount_gross, fee_platform, platform, created_at, customer_id')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', periodStart.toISOString()),
        supabase
            .from('ad_metrics')
            .select('platform, spend_brl, impressions, clicks, date')
            .eq('profile_id', profileId)
            .gte('date', periodStart.toISOString().split('T')[0]),
        supabase
            .from('customers')
            .select('id, acquisition_channel, total_ltv')
            .eq('profile_id', profileId)
            .gte('created_at', periodStart.toISOString()),
    ]);

    const revenue = transactions?.reduce((s, t) => s + (t.amount_net || 0), 0) ?? 0;
    const grossRevenue = transactions?.reduce((s, t) => s + (t.amount_gross || 0), 0) ?? 0;
    const totalSpend = adMetrics?.reduce((s, m) => s + (m.spend_brl || 0), 0) ?? 0;
    const txCount = transactions?.length ?? 0;

    const revenueByPlatform: Record<string, number> = {};
    for (const t of transactions ?? []) {
        revenueByPlatform[t.platform] = (revenueByPlatform[t.platform] ?? 0) + (t.amount_net ?? 0);
    }

    const spendByPlatform: Record<string, number> = {};
    for (const m of adMetrics ?? []) {
        spendByPlatform[m.platform] = (spendByPlatform[m.platform] ?? 0) + (m.spend_brl ?? 0);
    }

    const channelCustomers: Record<string, number> = {};
    for (const c of newCustomers ?? []) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        channelCustomers[ch] = (channelCustomers[ch] ?? 0) + 1;
    }

    return {
        period: { start: periodStart.toISOString(), end: periodEnd.toISOString(), days, frequency },
        summary: {
            revenue_net: revenue,
            revenue_gross: grossRevenue,
            transactions: txCount,
            aov: txCount > 0 ? revenue / txCount : 0,
            ad_spend: totalSpend,
            roas: totalSpend > 0 ? revenue / totalSpend : 0,
            new_customers: newCustomers?.length ?? 0,
        },
        revenue_by_platform: revenueByPlatform,
        spend_by_platform: spendByPlatform,
        new_customers_by_channel: channelCustomers,
    };
}

export function formatAsCsv(data: Awaited<ReturnType<typeof generateReportData>>): string {
    const { period, summary, revenue_by_platform, spend_by_platform, new_customers_by_channel } = data;
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');

    return [
        'RELATÓRIO NORTHIE',
        `Período;${fmtDate(period.start)} - ${fmtDate(period.end)} (${period.days} dias)`,
        '',
        'RESUMO',
        'Métrica;Valor',
        `Receita Líquida (R$);${fmt(summary.revenue_net)}`,
        `Receita Bruta (R$);${fmt(summary.revenue_gross)}`,
        `Transações;${summary.transactions}`,
        `Ticket Médio (R$);${fmt(summary.aov)}`,
        `Investimento em Ads (R$);${fmt(summary.ad_spend)}`,
        `ROAS;${fmt(summary.roas)}`,
        `Novos Clientes;${summary.new_customers}`,
        '',
        'RECEITA POR PLATAFORMA',
        'Plataforma;Receita Líquida (R$)',
        ...Object.entries(revenue_by_platform).map(([k, v]) => `${k};${fmt(v as number)}`),
        '',
        'INVESTIMENTO POR PLATAFORMA',
        'Plataforma;Gasto (R$)',
        ...Object.entries(spend_by_platform).map(([k, v]) => `${k};${fmt(v as number)}`),
        '',
        'NOVOS CLIENTES POR CANAL',
        'Canal;Clientes',
        ...Object.entries(new_customers_by_channel).map(([k, v]) => `${k};${v}`),
    ].join('\n');
}

export function computeNextSendAt(frequency: string): string {
    const now = new Date();
    switch (frequency) {
        case 'weekly': {
            const next = new Date(now);
            next.setDate(now.getDate() + 7);
            next.setHours(8, 0, 0, 0);
            return next.toISOString();
        }
        case 'quarterly': {
            const next = new Date(now);
            next.setMonth(now.getMonth() + 3, 1);
            next.setHours(8, 0, 0, 0);
            return next.toISOString();
        }
        default: {
            const next = new Date(now);
            next.setMonth(now.getMonth() + 1, 1);
            next.setHours(8, 0, 0, 0);
            return next.toISOString();
        }
    }
}
