import { supabase } from '../lib/supabase.js';

export interface ValuationResult {
    valuation_brl: number;
    multiple: number;
    arr_brl: number;
    mrr_brl: number;
    ltv_avg_brl: number;
    cac_avg_brl: number;
    ltv_cac_ratio: number;
    churn_rate: number;
    methodology: string;
    benchmark_percentile: number;
    snapshot_month: string;
    details: Record<string, unknown>;
}

export async function calculateValuation(profileId: string): Promise<ValuationResult> {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
    const thirtyDaysAgo = new Date(now);
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Parallel fetch
    const [txResult, customerResult, adResult, newCustResult] = await Promise.all([
        supabase
            .from('transactions')
            .select('amount_net, amount_gross, created_at')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .gte('created_at', twelveMonthsAgo.toISOString()),
        supabase
            .from('customers')
            .select('total_ltv, churn_probability')
            .eq('profile_id', profileId),
        supabase
            .from('ad_metrics')
            .select('spend_brl')
            .eq('profile_id', profileId)
            .gte('date', thirtyDaysAgo.toISOString().split('T')[0]),
        supabase
            .from('customers')
            .select('id', { count: 'exact', head: true })
            .eq('profile_id', profileId)
            .gte('created_at', thirtyDaysAgo.toISOString()),
    ]);

    const txData = txResult.data ?? [];
    const customerData = customerResult.data ?? [];
    const adData = adResult.data ?? [];
    const newCustomerCount = newCustResult.count ?? 0;

    // ── Monthly revenue buckets ──
    const monthlyNet: Record<string, number> = {};
    const monthlyGross: Record<string, number> = {};
    for (const tx of txData) {
        const key = (tx.created_at as string).substring(0, 7); // YYYY-MM
        monthlyNet[key] = (monthlyNet[key] ?? 0) + ((tx.amount_net as number) || 0);
        monthlyGross[key] = (monthlyGross[key] ?? 0) + ((tx.amount_gross as number) || 0);
    }

    const sortedKeys = Object.keys(monthlyNet).sort();

    // MRR = média dos últimos 3 meses disponíveis
    const last3Keys = sortedKeys.slice(-3);
    const mrr_brl = last3Keys.length > 0
        ? last3Keys.reduce((acc, k) => acc + (monthlyNet[k] ?? 0), 0) / last3Keys.length
        : 0;

    const arr_brl = mrr_brl * 12;

    // ── Gross margin ──
    const totalNet = Object.values(monthlyNet).reduce((a, b) => a + b, 0);
    const totalGross = Object.values(monthlyGross).reduce((a, b) => a + b, 0);
    const grossMarginPct = totalGross > 0 ? totalNet / totalGross : 0;

    // ── LTV avg ──
    const totalCustomers = customerData.length;
    const ltv_avg_brl = totalCustomers > 0
        ? customerData.reduce((acc, c) => acc + ((c.total_ltv as number) || 0), 0) / totalCustomers
        : 0;

    // ── Churn rate ──
    const churn_rate = totalCustomers > 0
        ? customerData.filter(c => ((c.churn_probability as number) || 0) > 0.5).length / totalCustomers
        : 0;

    // ── CAC ──
    const totalAdSpend = adData.reduce((acc, m) => acc + ((m.spend_brl as number) || 0), 0);
    const cac_avg_brl = newCustomerCount > 0 && totalAdSpend > 0
        ? totalAdSpend / newCustomerCount
        : 0;

    const ltv_cac_ratio = cac_avg_brl > 0 && ltv_avg_brl > 0
        ? ltv_avg_brl / cac_avg_brl
        : 0;

    // ── MoM growth (últimos 6 meses disponíveis) ──
    const last6Keys = sortedKeys.slice(-6);
    let growthMoMSum = 0;
    let growthMoMCount = 0;
    for (let i = 1; i < last6Keys.length; i++) {
        const prev = monthlyNet[last6Keys[i - 1] as string] ?? 0;
        const curr = monthlyNet[last6Keys[i] as string] ?? 0;
        if (prev > 0) {
            growthMoMSum += (curr - prev) / prev;
            growthMoMCount++;
        }
    }
    const growthMoMAvg = growthMoMCount > 0 ? growthMoMSum / growthMoMCount : 0;
    const annualGrowthRate = growthMoMAvg * 12 * 100; // percentual

    // ── Rule of 40 ──
    const ruleOf40 = annualGrowthRate + grossMarginPct * 100;

    // ── Methodology & Multiple ──
    const methodology: string = ltv_cac_ratio > 3 ? 'SaaS ARR Multiple' : 'Revenue Multiple';
    let baseMultiple: number;
    if (methodology === 'SaaS ARR Multiple') {
        baseMultiple = 6;
    } else {
        baseMultiple = 2.5;
    }

    // Ajuste pelo Rule of 40: +0.5× para cada 10 pontos acima de 40
    const ruleOf40Bonus = ruleOf40 > 40 ? Math.floor((ruleOf40 - 40) / 10) * 0.5 : 0;
    const multiple = baseMultiple + ruleOf40Bonus;

    const valuation_brl = arr_brl * multiple;

    // ── Benchmark percentile ──
    let benchmark_percentile: number;
    if (ruleOf40 >= 60) {
        benchmark_percentile = 80;
    } else if (ruleOf40 >= 40) {
        benchmark_percentile = 60;
    } else if (ruleOf40 >= 20) {
        benchmark_percentile = 40;
    } else {
        benchmark_percentile = 20;
    }

    // ── Snapshot month ──
    const snapshot_month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

    const details: Record<string, unknown> = {
        growthMoMAvg,
        annualGrowthRate,
        ruleOf40,
        grossMarginPct,
        totalCustomers,
        totalNet,
        totalGross,
        totalAdSpend,
        newCustomerCount,
        last3MonthsKeys: last3Keys,
        last6MonthsKeys: last6Keys,
        baseMultiple,
        ruleOf40Bonus,
        monthlyNetRevenue: monthlyNet,
    };

    // ── Persist to capital_score_history ──
    const snapshotDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
    await supabase
        .from('capital_score_history')
        .upsert(
            {
                profile_id: profileId,
                snapshot_month: snapshotDate,
                valuation_snapshot: {
                    valuation_brl,
                    multiple,
                    arr_brl,
                    mrr_brl,
                    ltv_avg_brl,
                    cac_avg_brl,
                    ltv_cac_ratio,
                    churn_rate,
                    methodology,
                    benchmark_percentile,
                    snapshot_month,
                    details,
                },
            },
            { onConflict: 'profile_id,snapshot_month' },
        );

    return {
        valuation_brl,
        multiple,
        arr_brl,
        mrr_brl,
        ltv_avg_brl,
        cac_avg_brl,
        ltv_cac_ratio,
        churn_rate,
        methodology,
        benchmark_percentile,
        snapshot_month,
        details,
    };
}
