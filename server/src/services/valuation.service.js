import { supabase } from '../lib/supabase.js';
function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}
export async function calculateValuation(profileId) {
    const now = new Date();
    const twelveMonthsAgo = new Date(now);
    twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1);
    const sixMonthsAgo = new Date(now);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    // ARR = sum of approved transactions last 12 months
    const { data: txData } = await supabase
        .from('transactions')
        .select('amount_net')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', twelveMonthsAgo.toISOString());
    const arr_brl = (txData || []).reduce((a, t) => a + (t.amount_net || 0), 0);
    const mrr_brl = arr_brl / 12;
    // Customer metrics
    const { data: customerData } = await supabase
        .from('customers')
        .select('total_ltv, churn_probability')
        .eq('profile_id', profileId);
    const customers = customerData || [];
    const ltv_avg_brl = customers.length > 0
        ? customers.reduce((a, c) => a + (c.total_ltv || 0), 0) / customers.length
        : 0;
    const churn_rate = customers.length > 0
        ? customers.reduce((a, c) => a + (c.churn_probability || 0), 0) / customers.length
        : 0;
    // CAC — spend last 6 months / new customers last 6 months
    const { data: adData } = await supabase
        .from('ad_metrics')
        .select('spend_brl')
        .eq('profile_id', profileId)
        .gte('date', sixMonthsAgo.toISOString().split('T')[0]);
    const totalSpend = (adData || []).reduce((a, m) => a + (m.spend_brl || 0), 0);
    const { data: newCustomers } = await supabase
        .from('customers')
        .select('id')
        .eq('profile_id', profileId)
        .gte('created_at', sixMonthsAgo.toISOString());
    const newCustomerCount = (newCustomers || []).length;
    const cac_avg_brl = newCustomerCount > 0 && totalSpend > 0 ? totalSpend / newCustomerCount : 0;
    const ltv_cac_ratio = cac_avg_brl > 0 && ltv_avg_brl > 0 ? ltv_avg_brl / cac_avg_brl : 0;
    // Profile business_type
    const { data: profileData } = await supabase
        .from('profiles')
        .select('business_type')
        .eq('id', profileId)
        .single();
    const businessType = profileData?.business_type || 'saas';
    // Calculate multiple and valuation by business type
    let multiple = 1;
    let valuation_brl = 0;
    let methodology = 'arr_multiple';
    if (businessType === 'saas') {
        const base = 10;
        // Growth bonus based on LTV/CAC
        const growth_bonus = clamp((ltv_cac_ratio / 5) * 3, 0, 3);
        // Churn penalty
        const churn_penalty = clamp(churn_rate * 3, 0, 3);
        multiple = clamp(base + growth_bonus - churn_penalty, 7, 13);
        valuation_brl = arr_brl * multiple;
        methodology = 'arr_multiple';
    }
    else if (businessType === 'ecommerce' || businessType === 'dtc') {
        // Range 1.5-4x based on LTV/CAC ratio
        multiple = clamp(1.5 + (ltv_cac_ratio / 3) * 2.5, 1.5, 4);
        valuation_brl = arr_brl * multiple;
        methodology = 'arr_multiple';
    }
    else if (businessType === 'infoprodutor_perpetuo') {
        // Same logic as ecommerce/dtc — recurring revenue from evergreen offers
        multiple = clamp(1.5 + (ltv_cac_ratio / 3) * 2.5, 1.5, 4);
        valuation_brl = arr_brl * multiple;
        methodology = 'arr_multiple';
    }
    else if (businessType === 'infoprodutor_lancamento') {
        // Conservative multiple: launch revenue is episodic, not recurring
        multiple = clamp(1 + (ltv_cac_ratio / 4) * 1.5, 1, 2.5);
        valuation_brl = arr_brl * multiple;
        methodology = 'arr_multiple';
    }
    else if (businessType === 'startup') {
        // Blended: ARR * 8 and LTV * customer count
        const ltv_total = ltv_avg_brl * customers.length;
        valuation_brl = (arr_brl * 8 + ltv_total * 2) / 2;
        multiple = arr_brl > 0 ? valuation_brl / arr_brl : 8;
        methodology = 'blended';
    }
    else {
        // Default: same as SaaS but conservative
        multiple = clamp(5 + ltv_cac_ratio, 5, 10);
        valuation_brl = arr_brl * multiple;
        methodology = 'arr_multiple';
    }
    multiple = Math.round(multiple * 10) / 10;
    valuation_brl = Math.round(valuation_brl);
    // Benchmark percentile — rank against other profiles with same business_type
    const snapshotDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const snapshot_month = snapshotDate.toISOString().split('T')[0];
    // Get previous month snapshots for same business_type
    const { data: otherSnapshots } = await supabase
        .from('valuation_snapshots')
        .select('valuation_brl, profile_id')
        .eq('business_type', businessType)
        .neq('profile_id', profileId);
    let benchmark_percentile = 50; // default if no data
    if (otherSnapshots && otherSnapshots.length > 0) {
        const otherValues = otherSnapshots.map(s => s.valuation_brl).sort((a, b) => a - b);
        const below = otherValues.filter(v => v < valuation_brl).length;
        benchmark_percentile = Math.round((below / otherValues.length) * 100);
    }
    const snapshot_month_label = snapshotDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' });
    // Upsert to valuation_snapshots
    await supabase
        .from('valuation_snapshots')
        .upsert({
        profile_id: profileId,
        snapshot_month,
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
        business_type: businessType,
    }, { onConflict: 'profile_id,snapshot_month' });
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
        snapshot_month: snapshot_month_label,
        details: { business_type: businessType },
    };
}
//# sourceMappingURL=valuation.service.js.map