import { supabase } from '../lib/supabase.js';
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export async function calculateCapitalScore(profileId) {
    const now = new Date();
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    // 1. Revenue consistency — last 6 months of monthly revenue
    const { data: txData } = await supabase
        .from('transactions')
        .select('amount_net, created_at')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', sixMonthsAgo.toISOString());
    // Group transactions by month to get monthly revenue
    const monthlyRevenue = {};
    for (const tx of txData || []) {
        const key = tx.created_at.substring(0, 7); // YYYY-MM
        monthlyRevenue[key] = (monthlyRevenue[key] || 0) + (tx.amount_net || 0);
    }
    const monthlyValues = Object.values(monthlyRevenue);
    const mrr_avg = monthlyValues.length > 0
        ? monthlyValues.reduce((a, b) => a + b, 0) / monthlyValues.length
        : 0;
    let variance_coeff = 0;
    if (mrr_avg > 0 && monthlyValues.length > 1) {
        const variance = monthlyValues.reduce((acc, v) => acc + Math.pow(v - mrr_avg, 2), 0) / monthlyValues.length;
        const stddev = Math.sqrt(variance);
        variance_coeff = clamp(stddev / mrr_avg, 0, 1);
    }
    const revenue_consistency = clamp(mrr_avg / 2000 * 15, 0, 15) + clamp((1 - variance_coeff) * 10, 0, 10);
    // 2. Customer quality — LTV avg + churn rate
    const { data: customerData } = await supabase
        .from('customers')
        .select('total_ltv, churn_probability')
        .eq('profile_id', profileId);
    const customers = customerData || [];
    const ltv_avg = customers.length > 0
        ? customers.reduce((a, c) => a + (c.total_ltv || 0), 0) / customers.length
        : 0;
    const churn_rate = customers.length > 0
        ? customers.reduce((a, c) => a + (c.churn_probability || 0), 0) / customers.length
        : 0;
    const customer_quality = clamp(ltv_avg / 500 * 15, 0, 15) + clamp((1 - churn_rate / 100) * 10, 0, 10);
    // 3. Acquisition efficiency — LTV/CAC ratio
    const { data: adData } = await supabase
        .from('ad_metrics')
        .select('spend_brl, date')
        .eq('profile_id', profileId)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0]);
    const totalSpend = (adData || []).reduce((a, m) => a + (m.spend_brl || 0), 0);
    const { data: newCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', profileId)
        .gte('created_at', sixMonthsAgo.toISOString());
    const newCustomerCount = (newCustomers || []).length;
    const cac = newCustomerCount > 0 && totalSpend > 0 ? totalSpend / newCustomerCount : 0;
    const ltv_cac_ratio = cac > 0 && ltv_avg > 0 ? ltv_avg / cac : 0;
    const acquisition_efficiency = clamp((ltv_cac_ratio / 3) * 25, 0, 25);
    // 4. Platform tenure — months since profile created_at
    const { data: profileData } = await supabase
        .from('profiles')
        .select('created_at')
        .eq('id', profileId)
        .single();
    let months_on_platform = 0;
    if (profileData?.created_at) {
        const created = new Date(profileData.created_at);
        months_on_platform = Math.max(0, (now.getFullYear() - created.getFullYear()) * 12 +
            (now.getMonth() - created.getMonth()));
    }
    const platform_tenure = clamp(months_on_platform / 12 * 25, 0, 25);
    // Total score
    const score = Math.round(revenue_consistency + customer_quality + acquisition_efficiency + platform_tenure);
    // Credit limit
    let credit_limit_brl = 0;
    if (score >= 70) {
        credit_limit_brl = Math.min(50000, Math.round(mrr_avg * (score / 100) * 3 / 100) * 100);
    }
    // Snapshot month (first day of current month)
    const snapshotDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const snapshot_month = snapshotDate.toISOString().split('T')[0];
    const snapshot_month_label = snapshotDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    const dimensions = {
        revenue_consistency: Math.round(revenue_consistency),
        customer_quality: Math.round(customer_quality),
        acquisition_efficiency: Math.round(acquisition_efficiency),
        platform_tenure: Math.round(platform_tenure),
    };
    // Upsert to capital_score_history
    await supabase
        .from('capital_score_history')
        .upsert({
        profile_id: profileId,
        snapshot_month,
        score,
        credit_limit_brl,
        score_revenue: dimensions.revenue_consistency,
        score_ltv_churn: dimensions.customer_quality,
        score_cac_ltv: dimensions.acquisition_efficiency,
        score_platform_age: dimensions.platform_tenure,
        dimensions,
        metrics: {
            mrr_avg,
            ltv_avg,
            churn_rate,
            ltv_cac_ratio,
            months_on_platform,
        },
    }, { onConflict: 'profile_id,snapshot_month' });
    return {
        score,
        dimensions,
        credit_limit_brl,
        snapshot_month: snapshot_month_label,
        metrics: {
            mrr_avg,
            ltv_avg,
            churn_rate,
            ltv_cac_ratio,
            months_on_platform,
        },
    };
}
//# sourceMappingURL=capital.service.js.map