// ── report-business-model.ts ──────────────────────────────────────────────────
// Funcoes puras para identificar modelo de negocio, consolidar receita,
// calcular health score, projecoes e detectar integracoes faltantes.
// Sem dependencia de Supabase ou IA — testavel isoladamente.

import type { BusinessModelType } from './report-severity.js';

export type { BusinessModelType };

// ── identifyBusinessModel ─────────────────────────────────────────────────────

export interface BusinessModelInfo {
    type: BusinessModelType;
    label: string;
    dominant_platform: string | null;
    distribution: Array<{ platform: string; label: string; pct: number }>;
    benchmark_note: string;
}

const PLATFORM_LABELS: Record<string, string> = {
    stripe: 'Stripe', hotmart: 'Hotmart', shopify: 'Shopify',
    meta: 'Meta Ads', meta_ads: 'Meta Ads', google: 'Google Ads', google_ads: 'Google Ads',
};

const PLATFORM_TO_MODEL: Record<string, BusinessModelType> = {
    stripe: 'saas', hotmart: 'infoproduto', shopify: 'ecommerce',
};

const MODEL_LABELS: Record<BusinessModelType, string> = {
    saas: 'SaaS / Recorrente', infoproduto: 'Infoproduto', ecommerce: 'E-commerce', hibrido: 'Hibrido',
};

const BENCHMARK_NOTES: Record<BusinessModelType, string> = {
    saas:        'Benchmarks aplicados: SaaS (churn, MRR, NRR, payback)',
    infoproduto: 'Benchmarks aplicados: Infoproduto (reembolso, ROAS, conversao)',
    ecommerce:   'Benchmarks aplicados: E-commerce (ROAS, recompra, ticket medio)',
    hibrido:     'Benchmarks aplicados: modelo hibrido (media ponderada)',
};

export function identifyBusinessModel(revenueByPlatform: Record<string, number>): BusinessModelInfo {
    const total = Object.values(revenueByPlatform).reduce((s, v) => s + v, 0);

    if (total === 0) {
        return {
            type: 'hibrido', label: MODEL_LABELS.hibrido, dominant_platform: null,
            distribution: [], benchmark_note: BENCHMARK_NOTES.hibrido,
        };
    }

    const distribution = Object.entries(revenueByPlatform)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([platform, amount]) => ({
            platform,
            label: PLATFORM_LABELS[platform] ?? platform,
            pct: (amount / total) * 100,
        }));

    const dominant = distribution[0];
    if (!dominant || dominant.pct < 50) {
        return {
            type: 'hibrido', label: MODEL_LABELS.hibrido,
            dominant_platform: dominant?.platform ?? null,
            distribution, benchmark_note: BENCHMARK_NOTES.hibrido,
        };
    }

    const type = PLATFORM_TO_MODEL[dominant.platform] ?? 'hibrido';
    return { type, label: MODEL_LABELS[type], dominant_platform: dominant.platform, distribution, benchmark_note: BENCHMARK_NOTES[type] };
}

// ── consolidateRevenue ────────────────────────────────────────────────────────

export interface ConsolidatedRevenue {
    total: number;
    by_source: Array<{ platform: string; label: string; amount: number; pct: number }>;
    is_multi_source: boolean;
    consolidation_note: string | null;
}

export function consolidateRevenue(revenueByPlatform: Record<string, number>): ConsolidatedRevenue {
    const total = Object.values(revenueByPlatform).reduce((s, v) => s + v, 0);
    const by_source = Object.entries(revenueByPlatform)
        .filter(([, v]) => v > 0)
        .sort(([, a], [, b]) => b - a)
        .map(([platform, amount]) => ({
            platform,
            label: PLATFORM_LABELS[platform] ?? platform,
            amount,
            pct: total > 0 ? (amount / total) * 100 : 0,
        }));

    const is_multi_source = by_source.length > 1;
    const consolidation_note = is_multi_source
        ? `Receita consolidada de ${by_source.length} plataformas (${by_source.map(s => s.label).join(', ')}). Valores ja deduplicados pela Northie — nao somar manualmente.`
        : null;

    return { total, by_source, is_multi_source, consolidation_note };
}

// ── computeHealthScore ────────────────────────────────────────────────────────

interface HealthBenchmarks {
    ltv_cac_excellent: number; ltv_cac_healthy: number;
    refund_excellent: number;  refund_attention: number;
    roas_excellent: number;    roas_healthy: number;    roas_attention: number;
}

const HEALTH_BM: Record<BusinessModelType, HealthBenchmarks> = {
    saas:        { ltv_cac_excellent: 5,  ltv_cac_healthy: 3, refund_excellent: 1,  refund_attention: 7,  roas_excellent: 5, roas_healthy: 3, roas_attention: 1.5 },
    infoproduto: { ltv_cac_excellent: 4,  ltv_cac_healthy: 2, refund_excellent: 3,  refund_attention: 15, roas_excellent: 7, roas_healthy: 4, roas_attention: 2   },
    ecommerce:   { ltv_cac_excellent: 5,  ltv_cac_healthy: 3, refund_excellent: 2,  refund_attention: 8,  roas_excellent: 5, roas_healthy: 3, roas_attention: 1.5 },
    hibrido:     { ltv_cac_excellent: 4,  ltv_cac_healthy: 3, refund_excellent: 3,  refund_attention: 12, roas_excellent: 5, roas_healthy: 3, roas_attention: 1.5 },
};

function scoreComponent(v: number, excellent: number, healthy: number, attention: number, higherBetter: boolean): number {
    if (higherBetter) {
        if (v >= excellent)  return 100;
        if (v >= healthy)    return 75;
        if (v >= attention)  return 40;
        if (v >= 1)          return 20;
        return 0;
    } else {
        if (v <= excellent)  return 100;
        if (v <= healthy)    return 75;
        if (v <= attention)  return 40;
        if (v <= attention * 2) return 20;
        return 0;
    }
}

export interface HealthScoreBreakdown {
    score: number; weight: number; label: string;
}

export interface HealthScore {
    score: number;
    label: string;
    color: string;
    breakdown: {
        ltv_cac: HealthScoreBreakdown;
        refund:  HealthScoreBreakdown;
        growth:  HealthScoreBreakdown;
        roas:    HealthScoreBreakdown;
    };
}

export function computeHealthScore(input: {
    ltv_cac_overall: number;
    refund_rate: number;
    revenue_change_pct: number | null;
    roas: number;
    business_model: BusinessModelType;
}): HealthScore {
    const bm = HEALTH_BM[input.business_model];

    const ltvCacScore = input.ltv_cac_overall > 0
        ? scoreComponent(input.ltv_cac_overall, bm.ltv_cac_excellent, bm.ltv_cac_healthy, 1.5, true)
        : 35; // neutro quando nao ha dados de CAC

    const refundScore = scoreComponent(input.refund_rate, bm.refund_excellent, bm.refund_excellent * 3, bm.refund_attention, false);

    let growthScore: number;
    if (input.revenue_change_pct === null) {
        growthScore = 50;
    } else {
        const g = input.revenue_change_pct;
        if (g >= 15)       growthScore = 100;
        else if (g >= 5)   growthScore = 75;
        else if (g >= 0)   growthScore = 50;
        else if (g >= -10) growthScore = 25;
        else               growthScore = 0;
    }

    const roasScore = input.roas === 0
        ? 50 // neutro quando nao ha ads
        : scoreComponent(input.roas, bm.roas_excellent, bm.roas_healthy, bm.roas_attention, true);

    // Pesos: LTV/CAC 30%, Reembolso 25%, Crescimento 25%, ROAS 20%
    const score = Math.round(ltvCacScore * 0.30 + refundScore * 0.25 + growthScore * 0.25 + roasScore * 0.20);

    let label: string, color: string;
    if (score >= 80)      { label = 'Negocio Saudavel';      color = '#16A34A'; }
    else if (score >= 60) { label = 'Requer Atencao';        color = '#D97706'; }
    else if (score >= 40) { label = 'Situacao Preocupante';  color = '#EA580C'; }
    else                  { label = 'Risco Critico';         color = '#DC2626'; }

    const bl = (s: number) => s >= 75 ? 'Otimo' : s >= 50 ? 'Regular' : s >= 25 ? 'Fraco' : 'Critico';

    return {
        score, label, color,
        breakdown: {
            ltv_cac: { score: ltvCacScore, weight: 30, label: bl(ltvCacScore) },
            refund:  { score: refundScore,  weight: 25, label: bl(refundScore)  },
            growth:  { score: growthScore,  weight: 25, label: bl(growthScore)  },
            roas:    { score: roasScore,    weight: 20, label: bl(roasScore)    },
        },
    };
}

// ── computeProjections ────────────────────────────────────────────────────────

export interface ProjectionScenario {
    month1: number;
    month2: number;
    month3: number;
    rate_pct: number;
    label: string;
    color: string;
}

export interface Projections {
    base_monthly: number;
    trend_rate_pct: number;
    conservative: ProjectionScenario;
    moderate:     ProjectionScenario;
    optimistic:   ProjectionScenario;
    trajectory_note: string;
}

export function computeProjections(
    revenueTrend: Array<{ revenue: number; change_pct: number | null }>,
    currentRevenue: number,
    periodDays: number,
): Projections {
    const monthlyBase = currentRevenue * (30 / Math.max(1, periodDays));

    const validChanges = revenueTrend
        .filter(t => t.change_pct !== null)
        .map(t => t.change_pct as number);

    // Usa ultimos 3 meses para calcular tendencia
    const recentChanges = validChanges.slice(-3);
    const avgTrendPct = recentChanges.length > 0
        ? recentChanges.reduce((s, v) => s + v, 0) / recentChanges.length
        : 0;

    const project = (base: number, ratePct: number): { month1: number; month2: number; month3: number } => {
        const r = ratePct / 100;
        return {
            month1: base * (1 + r),
            month2: base * Math.pow(1 + r, 2),
            month3: base * Math.pow(1 + r, 3),
        };
    };

    // Conservador: tendencia atual (entre -20% e +5%)
    const conservativeRate = Math.max(-20, Math.min(5, avgTrendPct));
    // Moderado: +5% ao mes (crescimento sustentavel)
    const moderateRate = 5;
    // Otimista: max(15%, tendencia*1.5) limitado a 50%
    const optimisticRate = Math.min(50, Math.max(15, avgTrendPct * 1.5));

    const trajectory_note = avgTrendPct > 5
        ? `No ritmo atual (+${avgTrendPct.toFixed(1)}%/mes), o negocio dobra de receita em ${Math.round(70 / avgTrendPct)} meses.`
        : avgTrendPct > 0
        ? `Crescimento estavel de +${avgTrendPct.toFixed(1)}%/mes. Consistencia e o caminho para escala.`
        : avgTrendPct < 0
        ? `Tendencia de queda de ${Math.abs(avgTrendPct).toFixed(1)}%/mes. Acao corretiva necessaria.`
        : 'Receita estavel. Identificar oportunidades de aceleracao.';

    return {
        base_monthly: monthlyBase,
        trend_rate_pct: avgTrendPct,
        conservative: { ...project(monthlyBase, conservativeRate), rate_pct: conservativeRate, label: 'Conservador', color: '#DC2626' },
        moderate:     { ...project(monthlyBase, moderateRate),     rate_pct: moderateRate,     label: 'Moderado',    color: '#D97706' },
        optimistic:   { ...project(monthlyBase, optimisticRate),   rate_pct: optimisticRate,   label: 'Otimista',    color: '#16A34A' },
        trajectory_note,
    };
}

// ── detectMissingIntegrations ─────────────────────────────────────────────────

export interface MissingIntegration {
    platform: string;
    benefit: string;
    priority: 'alta' | 'media';
}

export function detectMissingIntegrations(
    revenueByPlatform: Record<string, number>,
    spendByPlatform: Record<string, number>,
): MissingIntegration[] {
    const active = new Set([
        ...Object.keys(revenueByPlatform).filter(k => (revenueByPlatform[k] ?? 0) > 0),
        ...Object.keys(spendByPlatform).filter(k => (spendByPlatform[k] ?? 0) > 0),
    ]);

    const checks: Array<{ keys: string[]; platform: string; benefit: string; priority: 'alta' | 'media' }> = [
        { keys: ['stripe'],             platform: 'Stripe',     benefit: 'MRR, ARR, churn de assinaturas e NRR',                         priority: 'alta'  },
        { keys: ['hotmart'],            platform: 'Hotmart',    benefit: 'vendas, reembolsos e dados de afiliados',                        priority: 'alta'  },
        { keys: ['shopify'],            platform: 'Shopify',    benefit: 'pedidos, ticket medio e taxa de recompra',                       priority: 'alta'  },
        { keys: ['meta', 'meta_ads'],   platform: 'Meta Ads',   benefit: 'ROAS real, CPL e performance de campanhas',                      priority: 'alta'  },
        { keys: ['google','google_ads'],platform: 'Google Ads', benefit: 'comparativo Meta vs Google e performance de palavras-chave',     priority: 'media' },
    ];

    // Mostra apenas integracoes que fariam sentido dado o contexto
    const hasAnySalesData = active.has('stripe') || active.has('hotmart') || active.has('shopify');
    const hasAnyAdsData   = active.has('meta') || active.has('meta_ads') || active.has('google') || active.has('google_ads');

    return checks.filter(c => {
        const missing = !c.keys.some(k => active.has(k));
        if (!missing) return false;
        // Se nao tem nenhuma plataforma de vendas, mostrar todas
        if (!hasAnySalesData) return true;
        // Se tem vendas mas nao tem ads, mostrar apenas ads
        if (hasAnySalesData && !hasAnyAdsData && (c.keys.includes('meta') || c.keys.includes('google'))) return true;
        // Mostrar plataformas de vendas faltantes como sugestao
        if (c.keys.includes('stripe') || c.keys.includes('hotmart') || c.keys.includes('shopify')) return true;
        return false;
    }).map(c => ({ platform: c.platform, benefit: c.benefit, priority: c.priority }));
}

// ── generateExecutiveSummary ──────────────────────────────────────────────────
// Gera resumo executivo baseado em dados quando IA nao esta disponivel.

export function generateExecutiveSummary(data: {
    summary: {
        revenue_net: number;
        revenue_change_pct: number | null;
        roas: number;
        new_customers: number;
        refund_rate: number;
        ad_spend: number;
    };
    health_score: HealthScore;
    business_model_info: BusinessModelInfo;
    at_risk_count: number;
    period_days: number;
}): string {
    const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 0 });
    const fmtBrl = (n: number) => `R$ ${fmt(n)}`;

    const { summary, health_score, business_model_info, at_risk_count } = data;

    const changeText = summary.revenue_change_pct !== null
        ? summary.revenue_change_pct >= 0
            ? `, crescimento de ${Math.abs(summary.revenue_change_pct).toFixed(1)}% em relacao ao periodo anterior`
            : `, queda de ${Math.abs(summary.revenue_change_pct).toFixed(1)}% em relacao ao periodo anterior`
        : '';

    const roasText = summary.roas > 0 && summary.ad_spend > 0
        ? ` O ROAS consolidado foi de ${summary.roas.toFixed(1)}x sobre ${fmtBrl(summary.ad_spend)} investidos.`
        : '';

    const atRiskText = at_risk_count > 0
        ? ` ${at_risk_count} ${at_risk_count === 1 ? 'cliente esta' : 'clientes estao'} em risco de churn e precisam de acao imediata.`
        : ' A base de clientes esta estavel.';

    const refundText = summary.refund_rate > 7
        ? ` A taxa de reembolso de ${summary.refund_rate.toFixed(1)}% esta acima do saudavel e merece investigacao.`
        : '';

    return `${business_model_info.label} com receita liquida de ${fmtBrl(summary.revenue_net)}${changeText}. `
        + `${summary.new_customers} novos clientes foram adquiridos no periodo.${roasText}${atRiskText}${refundText} `
        + `Saude geral do negocio: ${health_score.label} (${health_score.score}/100).`;
}
