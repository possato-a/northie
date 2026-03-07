import { supabase } from '../../lib/supabase.js';
import {
    identifyBusinessModel, consolidateRevenue, computeHealthScore,
    computeProjections, detectMissingIntegrations,
} from './report-business-model.js';

export type ReportFrequency = 'weekly' | 'monthly' | 'quarterly';
export type ReportFormat = 'xlsx' | 'json' | 'pdf';

export function getPeriodDays(frequency: ReportFrequency): number {
    switch (frequency) {
        case 'weekly': return 7;
        case 'monthly': return 30;
        case 'quarterly': return 90;
    }
}

// ── RFM segmentation ──────────────────────────────────────────────────────────

interface RfmEntry { rfm_score: string | null; total_ltv: number; acquisition_channel: string | null }

function categorizeRfm(customers: RfmEntry[]) {
    const segments: Record<string, { count: number; ltv: number }> = {
        champions: { count: 0, ltv: 0 },
        loyalists: { count: 0, ltv: 0 },
        em_risco: { count: 0, ltv: 0 },
        perdidos: { count: 0, ltv: 0 },
        novos: { count: 0, ltv: 0 },
        outros: { count: 0, ltv: 0 },
    };

    for (const c of customers) {
        const score = c.rfm_score ?? '';
        const r = parseInt(score[0] ?? '0');
        const f = parseInt(score[1] ?? '0');
        const m = parseInt(score[2] ?? '0');
        const ltv = c.total_ltv || 0;

        let seg: string;
        if (r >= 4 && f >= 4 && m >= 4) seg = 'champions';
        else if (f >= 3 && m >= 3) seg = 'loyalists';
        else if (r <= 2 && f >= 2) seg = 'em_risco';
        else if (r === 1) seg = 'perdidos';
        else if (f === 1) seg = 'novos';
        else seg = 'outros';

        segments[seg]!.count++;
        segments[seg]!.ltv += ltv;
    }

    return Object.entries(segments).map(([segment, data]) => ({ segment, ...data }));
}

// ── Inline RFM fallback ───────────────────────────────────────────────────────

function estimateRfmFromData(
    atRiskCustomers: { ltv: number | null; churn_probability: number | null }[],
    topCustomersLtv: number,
    topCustomersCount: number,
    newCustomersCount: number,
    totalCustomers: number,
): ReturnType<typeof categorizeRfm> {
    const riskLtv = atRiskCustomers.reduce((s, c) => s + (c.ltv ?? 0), 0);
    const em_risco = atRiskCustomers.filter(c => (c.churn_probability ?? 0) <= 80).length;
    const perdidos = atRiskCustomers.filter(c => (c.churn_probability ?? 0) > 80).length;
    const outros = Math.max(0, totalCustomers - topCustomersCount - em_risco - perdidos - newCustomersCount);

    return [
        { segment: 'champions', count: topCustomersCount, ltv: topCustomersLtv },
        { segment: 'loyalists', count: 0, ltv: 0 },
        { segment: 'em_risco', count: em_risco, ltv: riskLtv * 0.6 },
        { segment: 'perdidos', count: perdidos, ltv: riskLtv * 0.4 },
        { segment: 'novos', count: newCustomersCount, ltv: 0 },
        { segment: 'outros', count: Math.max(0, outros), ltv: 0 },
    ];
}

// ── Channel economics cross-reference ────────────────────────────────────────

const CHANNEL_TO_AD_PLATFORM: Record<string, string> = {
    meta_ads: 'meta',
    google_ads: 'google',
};

// ── Main data generator ───────────────────────────────────────────────────────

export async function generateReportData(
    profileId: string,
    frequency: ReportFrequency,
    dates?: { start: Date; end: Date },
) {
    const days = getPeriodDays(frequency);
    const periodEnd   = dates?.end   ?? new Date();
    const periodStart = dates?.start ?? new Date(periodEnd.getTime() - days * 24 * 60 * 60 * 1000);
    const prevPeriodStart = new Date(periodStart.getTime() - days * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(periodEnd);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    // Run main queries and customer count in parallel
    const [mainResults, custCountResult] = await Promise.all([
        Promise.all([
            supabase
                .from('transactions')
                .select('amount_net, amount_gross, fee_platform, platform, created_at, customer_id')
                .eq('profile_id', profileId)
                .eq('status', 'approved')
                .gte('created_at', periodStart.toISOString())
                .lte('created_at', periodEnd.toISOString()),
            supabase
                .from('ad_metrics')
                .select('platform, spend_brl, impressions, clicks, date')
                .eq('profile_id', profileId)
                .gte('date', periodStart.toISOString().split('T')[0])
                .lte('date', periodEnd.toISOString().split('T')[0]),
            supabase
                .from('customers')
                .select('id, acquisition_channel, total_ltv')
                .eq('profile_id', profileId)
                .gte('created_at', periodStart.toISOString())
                .lte('created_at', periodEnd.toISOString()),
            supabase
                .from('customers')
                .select('id, total_ltv, acquisition_channel, last_purchase_at')
                .eq('profile_id', profileId)
                .order('total_ltv', { ascending: false })
                .limit(5),
            supabase
                .from('transactions')
                .select('amount_net')
                .eq('profile_id', profileId)
                .eq('status', 'approved')
                .gte('created_at', prevPeriodStart.toISOString())
                .lt('created_at', periodStart.toISOString()),
            // Q6 — clientes em risco (churn > 60%), sem PII
            supabase
                .from('customers')
                .select('total_ltv, acquisition_channel, churn_probability, last_purchase_at, rfm_score, email')
                .eq('profile_id', profileId)
                .gt('churn_probability', 60)
                .order('total_ltv', { ascending: false })
                .limit(20),
            // Q7 — base completa para distribuição RFM
            supabase
                .from('customers')
                .select('rfm_score, total_ltv, acquisition_channel')
                .eq('profile_id', profileId)
                .not('rfm_score', 'is', null),
            // Q8 — tipo de negócio + nome do founder
            supabase
                .from('profiles')
                .select('business_type, full_name, company_name')
                .eq('id', profileId)
                .single(),
            // Q9 — top produtos por receita (crucial para Hotmart)
            supabase
                .from('transactions')
                .select('product_name, amount_net')
                .eq('profile_id', profileId)
                .eq('status', 'approved')
                .gte('created_at', periodStart.toISOString())
                .lte('created_at', periodEnd.toISOString())
                .not('product_name', 'is', null)
                .limit(500),
            // Q10 — tendência histórica (6 meses até o fim do período)
            supabase
                .from('transactions')
                .select('amount_net, created_at')
                .eq('profile_id', profileId)
                .eq('status', 'approved')
                .gte('created_at', sixMonthsAgo.toISOString())
                .lte('created_at', periodEnd.toISOString())
                .limit(500),
            // Q11 — reembolsos do período
            supabase
                .from('transactions')
                .select('amount_gross')
                .eq('profile_id', profileId)
                .eq('status', 'refunded')
                .gte('created_at', periodStart.toISOString())
                .lte('created_at', periodEnd.toISOString()),
        ]),
        // Q12 — contagem total de clientes (paralelo)
        supabase
            .from('customers')
            .select('*', { count: 'exact', head: true })
            .eq('profile_id', profileId),
    ]);

    const [
        { data: transactions },
        { data: adMetrics },
        { data: newCustomers },
        { data: topCustomers },
        { data: prevTransactions },
        { data: atRiskCustomers },
        { data: rfmBase },
        { data: profileData },
        { data: productTransactions },
        { data: trendTransactions },
        { data: refundTransactions },
    ] = mainResults;

    const totalCustomers = custCountResult.count ?? 0;

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

    // LTV médio dos novos clientes do período
    const ltvAvg = (newCustomers?.length ?? 0) > 0
        ? (newCustomers ?? []).reduce((s, c) => s + (c.total_ltv || 0), 0) / newCustomers!.length
        : 0;

    // CAC por canal: spend do canal / novos clientes daquele canal
    const cacByChannel: Record<string, number> = {};
    for (const [channel, count] of Object.entries(channelCustomers)) {
        const platformKey = channel.replace('_ads', '');
        const spend = spendByPlatform[platformKey] ?? spendByPlatform[channel] ?? 0;
        if (count > 0 && spend > 0) cacByChannel[channel] = spend / count;
    }

    // Margem bruta = receita_net / receita_gross
    const grossMarginPct = grossRevenue > 0 ? (revenue / grossRevenue) * 100 : 0;

    // Comparativo de período
    const prevRevenue = prevTransactions?.reduce((s, t) => s + (t.amount_net || 0), 0) ?? 0;
    const revenueChangePct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : null;

    // Ads: impressões, cliques, CTR
    const totalImpressions = adMetrics?.reduce((s, m) => s + (m.impressions || 0), 0) ?? 0;
    const totalClicks = adMetrics?.reduce((s, m) => s + (m.clicks || 0), 0) ?? 0;
    const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;

    // ── Channel economics — cruzamento real ads × LTV ─────────────────────────
    const channelMap: Record<string, { new_customers: number; total_ltv: number; total_spend: number }> = {};

    for (const c of newCustomers ?? []) {
        const ch = c.acquisition_channel ?? 'desconhecido';
        if (!channelMap[ch]) channelMap[ch] = { new_customers: 0, total_ltv: 0, total_spend: 0 };
        channelMap[ch].new_customers++;
        channelMap[ch].total_ltv += c.total_ltv || 0;
    }

    for (const [ch, platformKey] of Object.entries(CHANNEL_TO_AD_PLATFORM)) {
        if (channelMap[ch]) {
            channelMap[ch].total_spend = spendByPlatform[platformKey] ?? 0;
        }
    }

    const channelEconomics = Object.entries(channelMap).map(([channel, data]) => {
        const avgLtv = data.new_customers > 0 ? data.total_ltv / data.new_customers : 0;
        const cac = data.new_customers > 0 && data.total_spend > 0
            ? data.total_spend / data.new_customers : 0;
        const ltvCacRatio = cac > 0 ? avgLtv / cac : null;
        const valueCreated = data.total_ltv - data.total_spend;
        const status: 'organico' | 'lucrativo' | 'prejuizo' =
            cac === 0 ? 'organico' : avgLtv > cac ? 'lucrativo' : 'prejuizo';
        return {
            channel,
            new_customers: data.new_customers,
            total_ltv: data.total_ltv,
            avg_ltv: avgLtv,
            total_spend: data.total_spend,
            cac,
            ltv_cac_ratio: ltvCacRatio,
            value_created: valueCreated,
            status,
        };
    });

    // ── At-risk customers (sem PII) ───────────────────────────────────────────
    const atRiskSummary = (atRiskCustomers ?? []).map(c => ({
        ltv: c.total_ltv,
        channel: c.acquisition_channel,
        churn_probability: c.churn_probability,
        days_since_purchase: c.last_purchase_at
            ? Math.floor((Date.now() - new Date(c.last_purchase_at).getTime()) / 86400000)
            : null,
        rfm_score: c.rfm_score,
        email: (c as unknown as { email?: string | null }).email ?? null,
    }));

    // ── RFM distribution (com fallback inline) ────────────────────────────────
    let rfmDistribution: ReturnType<typeof categorizeRfm>;
    let rfmSource: 'calculated' | 'estimated' = 'calculated';

    if ((rfmBase ?? []).length > 0) {
        rfmDistribution = categorizeRfm(rfmBase as RfmEntry[]);
    } else {
        rfmSource = 'estimated';
        const topLtv = (topCustomers ?? []).reduce((s, c) => s + (c.total_ltv ?? 0), 0);
        rfmDistribution = estimateRfmFromData(
            atRiskSummary,
            topLtv,
            topCustomers?.length ?? 0,
            newCustomers?.length ?? 0,
            totalCustomers,
        );
    }

    // ── Top produtos por receita ───────────────────────────────────────────────
    const productMap = new Map<string, { revenue: number; transactions: number }>();
    for (const t of (productTransactions ?? []) as { product_name: string; amount_net: number }[]) {
        const name = t.product_name;
        const existing = productMap.get(name) ?? { revenue: 0, transactions: 0 };
        existing.revenue += t.amount_net ?? 0;
        existing.transactions++;
        productMap.set(name, existing);
    }
    const totalProductRevenue = Array.from(productMap.values()).reduce((s, p) => s + p.revenue, 0);
    const topProducts = Array.from(productMap.entries())
        .sort(([, a], [, b]) => b.revenue - a.revenue)
        .slice(0, 8)
        .map(([product_name, data]) => ({
            product_name,
            revenue: data.revenue,
            transactions: data.transactions,
            pct_of_total: totalProductRevenue > 0 ? Math.round((data.revenue / totalProductRevenue) * 100) : 0,
        }));

    // ── Tendência de receita (6 meses) ────────────────────────────────────────
    const MONTH_NAMES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const monthMap = new Map<string, number>();
    for (const t of (trendTransactions ?? []) as { amount_net: number; created_at: string }[]) {
        const date = new Date(t.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthMap.set(key, (monthMap.get(key) ?? 0) + (t.amount_net ?? 0));
    }
    const sortedMonths = Array.from(monthMap.entries()).sort(([a], [b]) => a.localeCompare(b));
    const revenueTrend = sortedMonths.map(([key, rev], i) => {
        const [year, month] = key.split('-');
        const label = `${MONTH_NAMES[parseInt(month!) - 1]}/${String(year!).slice(2)}`;
        const prev = i > 0 ? sortedMonths[i - 1]![1] : null;
        const changePct = prev !== null && prev > 0 ? ((rev - prev) / prev) * 100 : null;
        return { month: label, revenue: rev, change_pct: changePct };
    });

    // ── Transactions detail, refunds by product, cohort data ─────────────────
    const [{ data: txDetailRaw }, { data: refundsByProductRaw }, { data: cohortCustomers }] = await Promise.all([
        supabase
            .from('transactions')
            .select('id, customer_id, platform, amount_net, status, created_at, product_name')
            .eq('profile_id', profileId)
            .order('created_at', { ascending: false })
            .limit(100),
        supabase
            .from('transactions')
            .select('product_name, amount_gross')
            .eq('profile_id', profileId)
            .eq('status', 'refunded')
            .gte('created_at', periodStart.toISOString())
            .lte('created_at', periodEnd.toISOString())
            .not('product_name', 'is', null)
            .limit(200),
        supabase
            .from('customers')
            .select('id, created_at, last_purchase_at')
            .eq('profile_id', profileId)
            .gte('created_at', sixMonthsAgo.toISOString())
            .lte('created_at', periodEnd.toISOString())
            .limit(1000),
    ]);

    const txCustomerIds = [...new Set(
        (txDetailRaw ?? []).map(t => t.customer_id).filter((id): id is string => id != null),
    )];

    let custInfoMap: Record<string, { email: string | null; channel: string | null }> = {};
    if (txCustomerIds.length > 0) {
        const { data: custInfo } = await supabase
            .from('customers')
            .select('id, email, acquisition_channel')
            .in('id', txCustomerIds);
        for (const c of (custInfo ?? [])) {
            const cc = c as { id: string; email?: string | null; acquisition_channel?: string | null };
            custInfoMap[cc.id] = { email: cc.email ?? null, channel: cc.acquisition_channel ?? null };
        }
    }

    const transactionsDetail = (txDetailRaw ?? []).map(t => ({
        id: String(t.id),
        customer_email: custInfoMap[String(t.customer_id)]?.email ?? null,
        customer_channel: custInfoMap[String(t.customer_id)]?.channel ?? null,
        platform: String(t.platform ?? ''),
        amount_net: (t.amount_net as number) ?? 0,
        status: String(t.status ?? ''),
        created_at: String(t.created_at ?? ''),
        product_name: String((t as unknown as { product_name?: string | null }).product_name ?? ''),
    }));

    const cacOverall = (newCustomers?.length ?? 0) > 0 && totalSpend > 0
        ? totalSpend / newCustomers!.length
        : 0;

    // ── Reembolsos ────────────────────────────────────────────────────────────
    const refundAmount = (refundTransactions ?? []).reduce(
        (s, t) => s + ((t as { amount_gross: number }).amount_gross ?? 0), 0
    );
    const refundCount = refundTransactions?.length ?? 0;
    const refundRate = Math.min(100, Math.max(0,
        (txCount + refundCount) > 0 ? (refundCount / (txCount + refundCount)) * 100 : 0
    ));

    // ── Daily revenue aggregation ──────────────────────────────────────────────
    const dailyMap = new Map<string, { revenue: number; transactions: number }>();
    for (const t of (transactions ?? []) as { amount_net: number; created_at: string }[]) {
        const date = t.created_at.split('T')[0]!;
        const existing = dailyMap.get(date) ?? { revenue: 0, transactions: 0 };
        existing.revenue += t.amount_net ?? 0;
        existing.transactions++;
        dailyMap.set(date, existing);
    }
    const dailyRevenue = Array.from(dailyMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, dayData], i, arr) => {
            const prevRev = i > 0 ? arr[i - 1]![1].revenue : null;
            const changePct = prevRev !== null && prevRev > 0
                ? ((dayData.revenue - prevRev) / prevRev) * 100
                : null;
            return {
                date,
                revenue: dayData.revenue,
                transactions: dayData.transactions,
                aov: dayData.transactions > 0 ? dayData.revenue / dayData.transactions : 0,
                change_pct: changePct,
            };
        });

    // ── Cohort retention (simplified — uses last_purchase_at as retention proxy) ──
    const cohortMap2 = new Map<string, { total: number; retained: Record<number, number> }>();
    for (const c of (cohortCustomers ?? []) as { id: string; created_at: string | null; last_purchase_at: string | null }[]) {
        if (!c.created_at) continue;
        const cohortDate = new Date(c.created_at);
        const cohortKey = `${cohortDate.getFullYear()}-${String(cohortDate.getMonth() + 1).padStart(2, '0')}`;
        const entry = cohortMap2.get(cohortKey) ?? { total: 0, retained: {} };
        entry.total++;
        if (c.last_purchase_at) {
            const lastPurchase = new Date(c.last_purchase_at);
            const monthsDiff = (lastPurchase.getFullYear() - cohortDate.getFullYear()) * 12
                + (lastPurchase.getMonth() - cohortDate.getMonth());
            for (let m = 0; m <= Math.min(monthsDiff, 5); m++) {
                entry.retained[m] = (entry.retained[m] ?? 0) + 1;
            }
        } else {
            entry.retained[0] = (entry.retained[0] ?? 0) + 1;
        }
        cohortMap2.set(cohortKey, entry);
    }
    const cohortRetention = Array.from(cohortMap2.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => {
            const [year, month] = key.split('-');
            const label = `${MONTH_NAMES[parseInt(month!) - 1]}/${String(year!).slice(2)}`;
            const pct = (m: number) => entry.total > 0
                ? Math.round(((entry.retained[m] ?? 0) / entry.total) * 100)
                : null;
            return { cohort: label, total: entry.total, m0: 100, m1: pct(1), m2: pct(2), m3: pct(3), m4: pct(4), m5: pct(5) };
        });

    // ── Refunds by product ─────────────────────────────────────────────────────
    const refundsByProductMap = new Map<string, number>();
    for (const t of (refundsByProductRaw ?? []) as { product_name: string; amount_gross: number }[]) {
        refundsByProductMap.set(t.product_name, (refundsByProductMap.get(t.product_name) ?? 0) + (t.amount_gross ?? 0));
    }
    const refundsByProduct: Record<string, number> = Object.fromEntries(refundsByProductMap);

    const profileInfo = profileData as { business_type?: string | null; full_name?: string | null; company_name?: string | null } | null;

    return {
        period: { start: periodStart.toISOString(), end: periodEnd.toISOString(), days, frequency },
        business_type: profileInfo?.business_type ?? null,
        profile_name: profileInfo?.company_name ?? profileInfo?.full_name ?? null,
        transactions_detail: transactionsDetail,
        cac_overall: cacOverall,
        margin_contribution_brl: revenue - totalSpend,
        margin_contribution_pct: revenue > 0 ? ((revenue - totalSpend) / revenue) * 100 : 0,
        summary: {
            revenue_net: revenue,
            revenue_gross: grossRevenue,
            transactions: txCount,
            aov: txCount > 0 ? revenue / txCount : 0,
            ad_spend: totalSpend,
            roas: totalSpend > 0 ? revenue / totalSpend : 0,
            new_customers: newCustomers?.length ?? 0,
            ltv_avg: ltvAvg,
            gross_margin_pct: grossMarginPct,
            impressions: totalImpressions,
            clicks: totalClicks,
            ctr,
            revenue_change_pct: revenueChangePct,
            prev_revenue_net: prevRevenue,
            refund_rate: refundRate,
            refund_amount: refundAmount,
            total_customers: totalCustomers,
        },
        revenue_by_platform: revenueByPlatform,
        spend_by_platform: spendByPlatform,
        new_customers_by_channel: channelCustomers,
        cac_by_channel: cacByChannel,
        top_customers: (topCustomers ?? []).map(c => ({
            id: c.id,
            ltv: c.total_ltv,
            channel: c.acquisition_channel,
            last_purchase_at: c.last_purchase_at,
        })),
        channel_economics: channelEconomics,
        rfm_distribution: rfmDistribution,
        rfm_source: rfmSource,
        at_risk_customers: atRiskSummary,
        top_products: topProducts,
        revenue_trend: revenueTrend,
        // ── Metricas derivadas ─────────────────────────────────────────────────
        business_model_info:  identifyBusinessModel(revenueByPlatform),
        consolidated_revenue: consolidateRevenue(revenueByPlatform),
        ltv_cac_overall:      cacOverall > 0 && ltvAvg > 0 ? ltvAvg / cacOverall : null,
        mrr_projected:        revenue * (30 / Math.max(1, days)),
        arr_projected:        revenue * (30 / Math.max(1, days)) * 12,
        payback_months:       (() => {
            // Payback = CAC / (receita mensal por cliente ativo)
            const mRev = revenue * (30 / Math.max(1, days));
            const monthly = totalCustomers > 0 ? mRev / totalCustomers : 0;
            return cacOverall > 0 && monthly > 0
                ? Math.round((cacOverall / monthly) * 10) / 10
                : null;
        })(),
        health_score: computeHealthScore({
            ltv_cac_overall:    cacOverall > 0 && ltvAvg > 0 ? ltvAvg / cacOverall : 0,
            refund_rate:        refundRate,
            revenue_change_pct: revenueChangePct,
            roas:               totalSpend > 0 ? revenue / totalSpend : 0,
            business_model:     identifyBusinessModel(revenueByPlatform).type,
        }),
        projections:          computeProjections(revenueTrend, revenue, days),
        daily_revenue: dailyRevenue,
        cohort_retention: cohortRetention,
        refunds_by_product: refundsByProduct,
        missing_integrations: detectMissingIntegrations(revenueByPlatform, spendByPlatform),
        integrations_active: [
            ...Object.keys(revenueByPlatform).filter(k => (revenueByPlatform[k] ?? 0) > 0),
            ...Object.keys(spendByPlatform).filter(k => (spendByPlatform[k] ?? 0) > 0),
        ].filter((v, i, a) => a.indexOf(v) === i),
    };
}

// ── CSV formatter ─────────────────────────────────────────────────────────────

export function formatAsCsv(
    data: Awaited<ReturnType<typeof generateReportData>>,
    ai?: import('./report-ai-analyst.js').ReportAIAnalysis,
): string {
    const {
        period, summary, revenue_by_platform, spend_by_platform,
        channel_economics, rfm_distribution, at_risk_customers,
        top_products, revenue_trend, rfm_source,
    } = data;
    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
    const fmtBrl = (n: number) => `R$ ${fmt(n)}`;

    const changeLine = summary.revenue_change_pct !== null
        ? `Variação vs período anterior;${fmt(summary.revenue_change_pct)}%`
        : 'Variação vs período anterior;sem dados anteriores';

    const situacaoGeral = ai?.situacao_geral
        ? { saudavel: 'SAUDÁVEL ✓', atencao: 'ATENÇÃO ⚠', critica: 'CRÍTICA ✗' }[ai.situacao_geral] ?? ai.situacao_geral
        : null;

    // ── Economia por canal ────────────────────────────────────────────────────
    const economicsHeader = 'Canal;Novos Clientes;LTV Médio;CAC;LTV/CAC;Receita Total (LTV);Spend;Valor Criado;Status';
    const economicsRows = channel_economics.map(e => {
        const statusLabel = e.status === 'lucrativo' ? 'LUCRATIVO ✓'
            : e.status === 'prejuizo' ? 'PREJUÍZO ✗'
            : 'ORGÂNICO';
        const ltv_cac = e.ltv_cac_ratio !== null ? fmt(e.ltv_cac_ratio) : '-';
        const cacFmt = e.cac > 0 ? fmtBrl(e.cac) : '-';
        return `${e.channel};${e.new_customers};${fmtBrl(e.avg_ltv)};${cacFmt};${ltv_cac};${fmtBrl(e.total_ltv)};${fmtBrl(e.total_spend)};${fmtBrl(e.value_created)};${statusLabel}`;
    });

    // ── RFM distribution ──────────────────────────────────────────────────────
    const rfmLabels: Record<string, string> = {
        champions: 'Compram muito, recentemente e gastam alto',
        loyalists: 'Compram frequentemente e gastam bem',
        em_risco: 'Compraram antes mas estão sumindo',
        perdidos: 'Sem compras recentes — possivelmente churnados',
        novos: 'Primeira compra recente',
        outros: 'Perfil misto',
    };
    const rfmRows = rfm_distribution
        .filter(s => s.count > 0)
        .map(s => `${s.segment};${s.count};${fmtBrl(s.ltv)};${rfmLabels[s.segment] ?? ''}`);
    const rfmNote = rfm_source === 'estimated'
        ? 'Nota;Segmentação estimada — ative o job de RFM para dados precisos'
        : '';

    // ── Clientes em risco ─────────────────────────────────────────────────────
    const atRiskRows = at_risk_customers.map(c =>
        `${fmtBrl(c.ltv ?? 0)};${c.channel ?? 'desconhecido'};${c.churn_probability ?? '-'}%;${c.days_since_purchase ?? '-'} dias;${c.rfm_score ?? '-'}`
    );

    // ── Tendência de receita ───────────────────────────────────────────────────
    const trendRows = revenue_trend.map(t => {
        const change = t.change_pct !== null ? `${t.change_pct >= 0 ? '+' : ''}${fmt(t.change_pct)}%` : '-';
        return `${t.month};${fmtBrl(t.revenue)};${change}`;
    });

    // ── Top produtos ──────────────────────────────────────────────────────────
    const productRows = top_products.map(p =>
        `${p.product_name};${fmtBrl(p.revenue)};${p.transactions};${p.pct_of_total}%`
    );

    // ── Diagnóstico de IA ─────────────────────────────────────────────────────
    const aiLines: string[] = [];
    if (ai) {
        aiLines.push('', '=== DIAGNÓSTICO DE IA ===');
        if (situacaoGeral) aiLines.push(`Situação Geral;${situacaoGeral}`);
        if (ai.resumo_executivo) aiLines.push(`Resumo;${ai.resumo_executivo}`);

        for (const d of ai.diagnosticos) {
            const severityLabel = { critica: 'CRÍTICA ✗', alta: 'ALTA ⚠', media: 'MÉDIA', ok: 'OK ✓' }[d.severidade] ?? d.severidade;
            aiLines.push(
                '',
                `DIAGNÓSTICO: Canal ${d.canal}`,
                `Severidade;${severityLabel}`,
                `Sintoma;${d.sintoma}`,
                `Causa Raiz;${d.causa_raiz}`,
                `Consequência;${d.consequencia}`,
                `Impacto Financeiro;${fmtBrl(d.consequencia_financeira_brl)}`,
                `Ação Recomendada;${d.acao_recomendada}`,
                `Prazo;${{ imediato: 'Imediato', esta_semana: 'Esta semana', este_mes: 'Este mês' }[d.prazo] ?? d.prazo}`,
            );
        }

        if (ai.proximos_passos.length > 0) {
            aiLines.push('', 'PRÓXIMOS PASSOS');
            ai.proximos_passos.forEach((p, i) => aiLines.push(`${i + 1};${p}`));
        }
    }

    return [
        'NORTHIE — RELATÓRIO DE PERFORMANCE',
        `Gerado em;${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}`,
        `Período;${fmtDate(period.start)} a ${fmtDate(period.end)} (${period.days} dias)`,
        '',
        '=== RESUMO DO PERÍODO ===',
        'Métrica;Valor;Observação',
        `Receita Líquida;${fmtBrl(summary.revenue_net)};${summary.revenue_change_pct !== null ? `${summary.revenue_change_pct >= 0 ? '+' : ''}${fmt(summary.revenue_change_pct)}% vs período anterior` : 'sem comparativo'}`,
        `Receita Bruta;${fmtBrl(summary.revenue_gross)};`,
        `Margem Bruta;${fmt(summary.gross_margin_pct)}%;receita_net / receita_bruta`,
        `Transações;${summary.transactions};`,
        `Ticket Médio (AOV);${fmtBrl(summary.aov)};receita_net / transações`,
        `Taxa de Reembolso;${fmt(summary.refund_rate)}%;${summary.refund_rate > 5 ? '⚠ ACIMA DE 5% — ATENÇÃO' : 'dentro do normal'}`,
        `Valor Reembolsado;${fmtBrl(summary.refund_amount)};`,
        '',
        '=== AQUISIÇÃO E CRESCIMENTO ===',
        'Métrica;Valor',
        `Novos Clientes;${summary.new_customers}`,
        `LTV Médio (novos clientes);${fmtBrl(summary.ltv_avg)}`,
        `Base Total de Clientes;${summary.total_customers}`,
        `Investimento em Ads;${fmtBrl(summary.ad_spend)}`,
        `ROAS;${fmt(summary.roas)}x`,
        `Impressões;${summary.impressions.toLocaleString('pt-BR')}`,
        `Cliques;${summary.clicks.toLocaleString('pt-BR')}`,
        `CTR;${fmt(summary.ctr)}%`,
        '',
        '=== ECONOMIA POR CANAL ===',
        economicsHeader,
        ...economicsRows,
        '',
        ...(trendRows.length >= 2 ? [
            '=== TENDÊNCIA DE RECEITA ===',
            'Mês;Receita Líquida;Variação',
            ...trendRows,
            '',
        ] : []),
        ...(productRows.length > 0 ? [
            '=== TOP PRODUTOS ===',
            'Produto;Receita;Transações;% do Total',
            ...productRows,
            '',
        ] : []),
        ...(rfmRows.length > 0 ? [
            '=== QUALIDADE DA BASE (RFM) ===',
            'Segmento;Clientes;LTV Total;Descrição',
            ...rfmRows,
            ...(rfmNote ? [rfmNote] : []),
            '',
        ] : []),
        ...(atRiskRows.length > 0 ? [
            '=== CLIENTES EM RISCO (churn > 60%) ===',
            'LTV;Canal;Prob. Churn;Dias s/ Compra;RFM Score',
            ...atRiskRows,
            '',
        ] : []),
        ...aiLines,
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
