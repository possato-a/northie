// ── report-severity.ts ────────────────────────────────────────────────────────
// Função utilitária reutilizável para classificar severidade de métricas.
// Uso: classifySeverity('roas', 1.8, 'ecommerce') → SeverityResult
// Testável isoladamente — sem dependência de Supabase ou IA.

export type BusinessModelType = 'saas' | 'infoproduto' | 'ecommerce' | 'hibrido';

export type MetricKey =
    | 'ltv_cac_ratio'
    | 'churn_monthly_pct'
    | 'refund_rate_pct'
    | 'roas'
    | 'revenue_growth_mom_pct'
    | 'repeat_purchase_rate_pct'
    | 'payback_months'
    | 'nrr_pct';

export interface SeverityResult {
    level: 'critical' | 'severe' | 'moderate' | 'light' | 'positive';
    label: string;       // ex: "Critico"
    color: string;       // hex
    icon: string;        // text symbol
    message: string;     // interpretacao em pt-BR com valor real
    recommendation: string;
}

// ── Thresholds por modelo de negocio ─────────────────────────────────────────

interface Thresholds {
    direction: 'higher_better' | 'lower_better';
    positive: number;
    light: number;
    moderate: number;
    severe: number;
}

type BenchmarkMap = Partial<Record<MetricKey, Thresholds>>;

const BENCHMARKS: Record<BusinessModelType, BenchmarkMap> = {
    saas: {
        ltv_cac_ratio:          { direction: 'higher_better', positive: 5,   light: 3,   moderate: 1.5, severe: 1   },
        churn_monthly_pct:      { direction: 'lower_better',  positive: 1,   light: 2,   moderate: 5,   severe: 10  },
        refund_rate_pct:        { direction: 'lower_better',  positive: 1,   light: 3,   moderate: 7,   severe: 15  },
        roas:                   { direction: 'higher_better', positive: 5,   light: 3,   moderate: 1.5, severe: 1   },
        revenue_growth_mom_pct: { direction: 'higher_better', positive: 15,  light: 10,  moderate: 5,   severe: 0   },
        payback_months:         { direction: 'lower_better',  positive: 6,   light: 12,  moderate: 18,  severe: 24  },
        nrr_pct:                { direction: 'higher_better', positive: 120, light: 100, moderate: 90,  severe: 80  },
    },
    infoproduto: {
        ltv_cac_ratio:          { direction: 'higher_better', positive: 4,  light: 2,  moderate: 1.5, severe: 1   },
        refund_rate_pct:        { direction: 'lower_better',  positive: 3,  light: 7,  moderate: 15,  severe: 20  },
        roas:                   { direction: 'higher_better', positive: 7,  light: 4,  moderate: 2,   severe: 1   },
        revenue_growth_mom_pct: { direction: 'higher_better', positive: 15, light: 5,  moderate: 0,   severe: -10 },
        payback_months:         { direction: 'lower_better',  positive: 3,  light: 6,  moderate: 12,  severe: 18  },
    },
    ecommerce: {
        ltv_cac_ratio:             { direction: 'higher_better', positive: 5,  light: 3,  moderate: 1.5, severe: 1   },
        refund_rate_pct:           { direction: 'lower_better',  positive: 2,  light: 5,  moderate: 8,   severe: 15  },
        roas:                      { direction: 'higher_better', positive: 5,  light: 3,  moderate: 1.5, severe: 1   },
        revenue_growth_mom_pct:    { direction: 'higher_better', positive: 10, light: 5,  moderate: 0,   severe: -5  },
        repeat_purchase_rate_pct:  { direction: 'higher_better', positive: 40, light: 20, moderate: 10,  severe: 5   },
        payback_months:            { direction: 'lower_better',  positive: 3,  light: 6,  moderate: 12,  severe: 18  },
    },
    hibrido: {
        ltv_cac_ratio:          { direction: 'higher_better', positive: 4,  light: 3,  moderate: 1.5, severe: 1   },
        refund_rate_pct:        { direction: 'lower_better',  positive: 3,  light: 7,  moderate: 12,  severe: 20  },
        roas:                   { direction: 'higher_better', positive: 5,  light: 3,  moderate: 1.5, severe: 1   },
        revenue_growth_mom_pct: { direction: 'higher_better', positive: 12, light: 5,  moderate: 0,   severe: -5  },
        payback_months:         { direction: 'lower_better',  positive: 6,  light: 12, moderate: 18,  severe: 24  },
    },
};

// ── Mensagens por metrica ─────────────────────────────────────────────────────

type LevelKey = 'positive' | 'light' | 'moderate' | 'severe' | 'critical';

interface MetricMessages {
    msg: Record<LevelKey, (v: number) => string>;
    rec: Record<LevelKey, string>;
}

const MESSAGES: Partial<Record<MetricKey, MetricMessages>> = {
    ltv_cac_ratio: {
        msg: {
            positive: v => `LTV/CAC de ${v.toFixed(1)}x — retorno excelente sobre aquisicao`,
            light:    v => `LTV/CAC de ${v.toFixed(1)}x — saudavel, ha espaco para crescer`,
            moderate: v => `LTV/CAC de ${v.toFixed(1)}x — abaixo do recomendado (minimo 3x)`,
            severe:   v => `LTV/CAC de ${v.toFixed(1)}x — cada real investido em aquisicao mal se paga`,
            critical: v => `LTV/CAC de ${v.toFixed(1)}x — clientes custam mais do que geram`,
        },
        rec: {
            positive: 'Mantenha os canais de aquisicao e busque aumentar o LTV com upsell.',
            light:    'Explore retencao para aumentar o LTV medio da base.',
            moderate: 'Revise canais de aquisicao e adicione sequencias de upsell.',
            severe:   'Pause canais nao rentaveis e foque em reduzir o CAC urgentemente.',
            critical: 'Parar investimento em aquisicao ate o LTV superar o CAC.',
        },
    },
    refund_rate_pct: {
        msg: {
            positive: v => `Taxa de reembolso de ${v.toFixed(1)}% — excelente satisfacao do cliente`,
            light:    v => `Taxa de reembolso de ${v.toFixed(1)}% — dentro do normal`,
            moderate: v => `Taxa de reembolso de ${v.toFixed(1)}% — acima do saudavel`,
            severe:   v => `Taxa de reembolso de ${v.toFixed(1)}% — sinal de problema no produto ou entrega`,
            critical: v => `Taxa de reembolso de ${v.toFixed(1)}% — crise de satisfacao`,
        },
        rec: {
            positive: 'Continue coletando feedback para manter a satisfacao alta.',
            light:    'Monitore os motivos de reembolso para identificar padroes.',
            moderate: 'Implemente pesquisa pos-reembolso e revise a jornada do cliente.',
            severe:   'Revisao urgente do produto, entrega e suporte.',
            critical: 'Investigacao imediata: entrevistar clientes que solicitaram reembolso nos ultimos 30 dias.',
        },
    },
    roas: {
        msg: {
            positive: v => `ROAS de ${v.toFixed(1)}x — campanhas extremamente rentaveis`,
            light:    v => `ROAS de ${v.toFixed(1)}x — campanhas saudaveis`,
            moderate: v => `ROAS de ${v.toFixed(1)}x — margem apertada em ads`,
            severe:   v => `ROAS de ${v.toFixed(1)}x — ads custando mais do que geram`,
            critical: v => `ROAS de ${v.toFixed(1)}x — cada real em ads destroe valor`,
        },
        rec: {
            positive: 'Escale o budget nos criativos de melhor performance.',
            light:    'Otimize criativos e segmentacoes para elevar o ROAS.',
            moderate: 'Revise criativos, ofertas e landing pages. Considere reduzir budget ate otimizar.',
            severe:   'Pause campanha por campanha para identificar o que consome budget sem retorno.',
            critical: 'Parar todos os ads e revisitar estrategia de aquisicao.',
        },
    },
    revenue_growth_mom_pct: {
        msg: {
            positive: v => `Crescimento MoM de +${v.toFixed(1)}% — negocio em expansao acelerada`,
            light:    v => `Crescimento MoM de +${v.toFixed(1)}% — crescimento saudavel`,
            moderate: v => `Variacao MoM de ${v.toFixed(1)}% — crescimento abaixo do esperado`,
            severe:   v => `Queda MoM de ${Math.abs(v).toFixed(1)}% — receita em declinio`,
            critical: v => `Queda MoM de ${Math.abs(v).toFixed(1)}% — queda acentuada de receita`,
        },
        rec: {
            positive: 'Capitalize no momentum: invista em aquisicao enquanto o crescimento esta forte.',
            light:    'Mantenha o ritmo e identifique oportunidades de aceleracao.',
            moderate: 'Identifique o gargalo: aquisicao ou retencao? Atue no maior gap.',
            severe:   'Diagnostico de causa raiz urgente. Entreviste clientes recentes e perdidos.',
            critical: 'Revisao completa de produto, canal e oferta.',
        },
    },
    payback_months: {
        msg: {
            positive: v => `Payback de ${v.toFixed(1)} meses — rapida recuperacao do investimento`,
            light:    v => `Payback de ${v.toFixed(1)} meses — dentro do saudavel`,
            moderate: v => `Payback de ${v.toFixed(1)} meses — acima do recomendado`,
            severe:   v => `Payback de ${v.toFixed(1)} meses — capital preso por muito tempo`,
            critical: v => `Payback de ${v.toFixed(1)} meses — risco alto de insolvencia`,
        },
        rec: {
            positive: 'Reinvista o capital recuperado rapidamente em novos clientes.',
            light:    'Monitore o payback mensalmente para nao deixar piorar.',
            moderate: 'Busque aumentar o LTV medio ou reduzir o CAC para comprimir o payback.',
            severe:   'Revisao urgente de precificacao e canais de aquisicao.',
            critical: 'Parar crescimento acelerado ate resolver o payback — risco de caixa.',
        },
    },
};

// ── Level metadata ────────────────────────────────────────────────────────────

export const LEVEL_META: Record<SeverityResult['level'], { label: string; color: string; icon: string }> = {
    critical: { label: 'Critico',    color: '#DC2626', icon: '[!]' },
    severe:   { label: 'Grave',      color: '#EA580C', icon: '[!]' },
    moderate: { label: 'Moderado',   color: '#D97706', icon: '[~]' },
    light:    { label: 'Leve',       color: '#2563EB', icon: '[i]' },
    positive: { label: 'Positivo',   color: '#16A34A', icon: '[+]' },
};

// ── Core function ─────────────────────────────────────────────────────────────

function getLevelFromThresholds(value: number, t: Thresholds): SeverityResult['level'] {
    if (t.direction === 'higher_better') {
        if (value >= t.positive) return 'positive';
        if (value >= t.light)    return 'light';
        if (value >= t.moderate) return 'moderate';
        if (value >= t.severe)   return 'severe';
        return 'critical';
    } else {
        if (value <= t.positive) return 'positive';
        if (value <= t.light)    return 'light';
        if (value <= t.moderate) return 'moderate';
        if (value <= t.severe)   return 'severe';
        return 'critical';
    }
}

export function classifySeverity(
    metric: MetricKey,
    value: number,
    businessModel: BusinessModelType,
    _context?: { valueFormatted?: string },
): SeverityResult {
    const thresholds = BENCHMARKS[businessModel][metric] ?? BENCHMARKS.hibrido[metric];

    if (!thresholds) {
        return {
            level: 'light',
            ...LEVEL_META.light,
            message: `${metric}: ${value}`,
            recommendation: 'Monitorar.',
        };
    }

    const level = getLevelFromThresholds(value, thresholds);
    const meta  = LEVEL_META[level];
    const msgs  = MESSAGES[metric];

    const message        = msgs ? msgs.msg[level](value) : `${metric}: ${value.toFixed(2)}`;
    const recommendation = msgs ? msgs.rec[level]        : 'Monitorar.';

    return { level, ...meta, message, recommendation };
}

// ── Benchmark label para exibicao ─────────────────────────────────────────────

export function getBenchmarkLabel(metric: MetricKey, businessModel: BusinessModelType): string | null {
    const t = BENCHMARKS[businessModel][metric] ?? BENCHMARKS.hibrido[metric];
    if (!t) return null;

    const fmt = (v: number) => Number.isInteger(v) ? `${v}` : `${v.toFixed(1)}`;

    if (t.direction === 'higher_better') {
        return `Bom: >${fmt(t.light)} | Otimo: >${fmt(t.positive)}`;
    } else {
        return `Bom: <${fmt(t.light)} | Otimo: <${fmt(t.positive)}`;
    }
}
