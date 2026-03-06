// ── Historical snapshots ───────────────────────────────────────────────────────

export interface HistoricalSnapshot {
    period_start: string;
    period_end: string;
    created_at: string;
    revenue_net: number;
    ad_spend: number;
    roas: number;
    new_customers: number;
    ltv_avg: number;
    revenue_change_pct: number | null;
    situacao_geral: string | null;
    criticos: number;
    at_risk_count: number;
    at_risk_ltv: number;
}

// ── CAC trend ─────────────────────────────────────────────────────────────────

export interface ChannelCacMonth {
    month: string;           // 'YYYY-MM'
    new_customers: number;
    spend_brl: number;
    cac: number;
}

export interface ChannelCacTrend {
    channel: string;
    months: ChannelCacMonth[];
    cac_oldest: number;
    cac_newest: number;
    cac_trend_pct: number | null;  // % variação do mais antigo pro mais recente
}

// ── Churn risk ────────────────────────────────────────────────────────────────

export interface ChurnRiskByChannel {
    channel: string;
    total_customers: number;
    avg_churn_probability: number;
    high_risk_count: number;    // churn_probability > 0.6
    high_risk_ltv: number;      // LTV total em risco
}

// ── Cohort repeat purchase ────────────────────────────────────────────────────

export interface CohortRepeatPurchase {
    channel: string;
    cohort_month: string;   // 'YYYY-MM'
    new_customers: number;
    repeat_buyers: number;
    repeat_rate_pct: number;
}
