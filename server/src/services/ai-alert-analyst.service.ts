/**
 * @file services/ai-alert-analyst.service.ts
 *
 * Agente de IA que analisa o banco de dados da Northie via function calling
 * e gera alertas e recomendacoes contextuais — substituindo a dependencia
 * exclusiva de detectores com thresholds hardcoded.
 *
 * O agente:
 *   1. Recebe ferramentas de query no banco (function calling)
 *   2. Decide quais queries fazer para explorar os dados
 *   3. Identifica problemas e oportunidades
 *   4. Retorna findings estruturados com raciocinio explicito
 *
 * Limites defensivos:
 *   - Max 8 iteracoes de function calling
 *   - Timeout total de 60s
 *   - Falha graciosamente sem quebrar o job de alertas
 */

import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../lib/supabase.js';
import { getAnthropicClient, ANTHROPIC_MODELS } from '../lib/anthropic.js';
import type { AiClient } from '../lib/ai-adapter.js';

// ── Tipos ─────────────────────────────────────────────────────────────────────

export interface AIAnalystFinding {
    type: 'alert' | 'recommendation';
    severity?: 'info' | 'warning' | 'critical';
    title: string;
    body: string;
    rationale: string;
    rec_type?: string;
    rec_meta?: Record<string, unknown>;
}

export interface AIAnalystOutput {
    findings: AIAnalystFinding[];
}

// ── Constantes ───────────────────────────────────────────────────────────────

const MAX_TOOL_TURNS = 8;
const TIMEOUT_MS = 60_000;

// ── Ferramentas (function calling) ──────────────────────────────────────────

const ANALYST_TOOLS: Anthropic.Tool[] = [
    {
        name: 'query_transactions',
        description: 'Consulta transacoes agregadas do negocio. Retorna receita total, volume, ticket medio e distribuicao por status. Pode agrupar por dia ou plataforma.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
                days: { type: 'number', description: 'Ultimos N dias a consultar (max 90)' },
                group_by: { type: 'string', enum: ['day', 'platform', 'status'], description: 'Opcional: agrupamento' },
            },
            required: ['profile_id', 'days'],
        },
    },
    {
        name: 'query_ad_metrics',
        description: 'Consulta metricas de anuncios: spend total, ROAS, impressoes, cliques por campanha e plataforma.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
                days: { type: 'number', description: 'Ultimos N dias (max 90)' },
            },
            required: ['profile_id', 'days'],
        },
    },
    {
        name: 'query_customers',
        description: 'Consulta metricas da base de clientes: total, LTV medio, distribuicao RFM, churn medio. Pode filtrar por segmento RFM.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
                segment: { type: 'string', enum: ['champions', 'loyal', 'at_risk', 'hibernating', 'new'], description: 'Filtrar por segmento RFM' },
            },
            required: ['profile_id'],
        },
    },
    {
        name: 'query_top_customers',
        description: 'Retorna os top N clientes por LTV com detalhes: email anonimizado, LTV, ultimo compra, canal de aquisicao, churn probability.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
                limit: { type: 'number', description: 'Quantidade de clientes (max 20)' },
            },
            required: ['profile_id', 'limit'],
        },
    },
    {
        name: 'query_revenue_trend',
        description: 'Retorna tendencia de receita dia a dia para identificar padroes, quedas ou crescimento.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
                days: { type: 'number', description: 'Ultimos N dias (max 90)' },
            },
            required: ['profile_id', 'days'],
        },
    },
    {
        name: 'query_cac_by_channel',
        description: 'Calcula o CAC por canal de aquisicao nos ultimos N dias, cruzando ad_metrics com customers.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
                days: { type: 'number', description: 'Ultimos N dias (max 90)' },
            },
            required: ['profile_id', 'days'],
        },
    },
    {
        name: 'query_churn_risk',
        description: 'Retorna distribuicao de risco de churn: quantos clientes em cada faixa (0-25%, 25-50%, 50-75%, 75-100%) com LTV medio por faixa.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
            },
            required: ['profile_id'],
        },
    },
    {
        name: 'query_cohort_retention',
        description: 'Retorna retencao por cohort mensal: % de clientes que fizeram mais de 1 compra por mes de aquisicao.',
        input_schema: {
            type: 'object' as const,
            properties: {
                profile_id: { type: 'string', description: 'ID do profile' },
            },
            required: ['profile_id'],
        },
    },
];

// ── System prompt ──────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Voce e um analista financeiro senior da Northie. Sua funcao e analisar os dados de um negocio digital e identificar problemas, oportunidades e padroes que o founder precisa saber.

## Sua abordagem

1. Comece explorando os dados gerais: receita, clientes, ads.
2. Aprofunde em areas que parecem anomalas ou interessantes.
3. Cruze pelo menos 2 fontes de dados para cada finding — esse e o diferencial da Northie.
4. Priorize findings que requerem acao imediata.

## Regras

- Nunca gere um finding baseado em apenas 1 fonte de dados. Sempre cruze pelo menos 2.
- Inclua numeros especificos no titulo e body (ex: "ROAS Meta caiu 43%", nao "ROAS caiu").
- O rationale deve explicar POR QUE isso importa para o negocio, nao apenas o que aconteceu.
- Severity: 'critical' = precisa agir HOJE, 'warning' = precisa atencao esta semana, 'info' = bom saber.
- Se nao houver dados suficientes para uma analise, diga isso — nao invente.
- Limite-se a no maximo 5 findings por analise.

## Tipos de recomendacao validos (rec_type)

Use estes quando o finding for do tipo 'recommendation':
- reativacao_alto_ltv — clientes de alto valor inativos
- pausa_campanha_ltv_baixo — campanha adquirindo clientes ruins
- audience_sync_champions — sync de melhores clientes para lookalike
- realocacao_budget — mover budget de canal ruim para bom
- upsell_cohort — clientes na janela de recompra
- divergencia_roi_canal — ROI divergente entre canais
- canal_alto_ltv_underinvested — canal bom com pouco investimento
- cac_vs_ltv_deficit — CAC acima do LTV
- em_risco_alto_valor — clientes valiosos em risco de churn

## Output

Ao finalizar sua analise, retorne APENAS um JSON valido com a estrutura:
{
  "findings": [
    {
      "type": "alert" | "recommendation",
      "severity": "info" | "warning" | "critical",
      "title": "string curto e especifico",
      "body": "descricao completa com numeros",
      "rationale": "por que isso importa para o negocio",
      "rec_type": "tipo_se_for_recommendation",
      "rec_meta": { dados_adicionais_para_execucao }
    }
  ]
}

Se nao encontrar nada relevante, retorne: { "findings": [] }`;

// ── Implementacao das ferramentas ─────────────────────────────────────────

async function executeQueryTransactions(
    profileId: string,
    days: number,
    groupBy?: string
): Promise<string> {
    const since = new Date(Date.now() - Math.min(days, 90) * 24 * 60 * 60 * 1000).toISOString();

    const { data: txs, error } = await supabase
        .from('transactions')
        .select('amount_net, amount_gross, fee_platform, status, platform, created_at')
        .eq('profile_id', profileId)
        .gte('created_at', since);

    if (error) return JSON.stringify({ error: error.message });
    if (!txs || txs.length === 0) return JSON.stringify({ message: 'Nenhuma transacao encontrada no periodo', count: 0 });

    const approved = txs.filter(t => t.status === 'approved');
    const totalRevenue = approved.reduce((s, t) => s + Number(t.amount_net), 0);
    const totalGross = approved.reduce((s, t) => s + Number(t.amount_gross), 0);
    const totalFees = approved.reduce((s, t) => s + Number(t.fee_platform), 0);
    const avgTicket = approved.length > 0 ? totalRevenue / approved.length : 0;

    const result: Record<string, unknown> = {
        period_days: days,
        total_transactions: txs.length,
        approved_count: approved.length,
        refunded_count: txs.filter(t => t.status === 'refunded').length,
        pending_count: txs.filter(t => t.status === 'pending').length,
        total_revenue_net: Math.round(totalRevenue * 100) / 100,
        total_gross: Math.round(totalGross * 100) / 100,
        total_fees: Math.round(totalFees * 100) / 100,
        avg_ticket: Math.round(avgTicket * 100) / 100,
    };

    if (groupBy === 'day') {
        const byDay: Record<string, { count: number; revenue: number }> = {};
        for (const t of approved) {
            const day = (t.created_at as string).split('T')[0]!;
            if (!byDay[day]) byDay[day] = { count: 0, revenue: 0 };
            byDay[day].count++;
            byDay[day].revenue += Number(t.amount_net);
        }
        result.by_day = Object.entries(byDay)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([day, v]) => ({ day, count: v.count, revenue: Math.round(v.revenue * 100) / 100 }));
    } else if (groupBy === 'platform') {
        const byPlatform: Record<string, { count: number; revenue: number }> = {};
        for (const t of approved) {
            const p = (t.platform as string) || 'unknown';
            if (!byPlatform[p]) byPlatform[p] = { count: 0, revenue: 0 };
            byPlatform[p].count++;
            byPlatform[p].revenue += Number(t.amount_net);
        }
        result.by_platform = byPlatform;
    } else if (groupBy === 'status') {
        const byStatus: Record<string, number> = {};
        for (const t of txs) {
            const s = (t.status as string) || 'unknown';
            byStatus[s] = (byStatus[s] || 0) + 1;
        }
        result.by_status = byStatus;
    }

    return JSON.stringify(result);
}

async function executeQueryAdMetrics(profileId: string, days: number): Promise<string> {
    const since = new Date(Date.now() - Math.min(days, 90) * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

    const { data: metrics, error } = await supabase
        .from('ad_metrics')
        .select('platform, campaign_id, spend_brl, impressions, clicks, date')
        .eq('profile_id', profileId)
        .gte('date', since);

    if (error) return JSON.stringify({ error: error.message });
    if (!metrics || metrics.length === 0) return JSON.stringify({ message: 'Nenhuma metrica de ads encontrada', count: 0 });

    // Tambem buscar receita por canal para calcular ROAS
    const { data: txs } = await supabase
        .from('transactions')
        .select('amount_net, customers!inner(acquisition_channel)')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', since + 'T00:00:00Z');

    const channelMap: Record<string, string> = { meta: 'meta_ads', google: 'google_ads' };

    const byPlatform: Record<string, { spend: number; impressions: number; clicks: number; days: Set<string> }> = {};
    for (const m of metrics) {
        const p = m.platform as string;
        if (!byPlatform[p]) byPlatform[p] = { spend: 0, impressions: 0, clicks: 0, days: new Set() };
        byPlatform[p].spend += Number(m.spend_brl);
        byPlatform[p].impressions += Number(m.impressions);
        byPlatform[p].clicks += Number(m.clicks);
        byPlatform[p].days.add(m.date as string);
    }

    const platformSummaries = Object.entries(byPlatform).map(([platform, data]) => {
        const channelKey = channelMap[platform] || platform;
        const channelRevenue = (txs || [])
            .filter(t => (t as unknown as { customers?: { acquisition_channel?: string } }).customers?.acquisition_channel === channelKey)
            .reduce((s, t) => s + Number(t.amount_net), 0);

        const roas = data.spend > 0 ? channelRevenue / data.spend : 0;
        const ctr = data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0;
        const cpc = data.clicks > 0 ? data.spend / data.clicks : 0;
        const avgDailySpend = data.days.size > 0 ? data.spend / data.days.size : 0;

        return {
            platform,
            total_spend: Math.round(data.spend * 100) / 100,
            total_impressions: data.impressions,
            total_clicks: data.clicks,
            ctr_pct: Math.round(ctr * 100) / 100,
            cpc: Math.round(cpc * 100) / 100,
            roas: Math.round(roas * 100) / 100,
            channel_revenue: Math.round(channelRevenue * 100) / 100,
            avg_daily_spend: Math.round(avgDailySpend * 100) / 100,
            active_days: data.days.size,
        };
    });

    return JSON.stringify({
        period_days: days,
        total_entries: metrics.length,
        platforms: platformSummaries,
    });
}

async function executeQueryCustomers(profileId: string, segment?: string): Promise<string> {
    let query = supabase
        .from('customers')
        .select('total_ltv, rfm_score, churn_probability, acquisition_channel, last_purchase_at, created_at')
        .eq('profile_id', profileId);

    if (segment) {
        // Map segment name to RFM scores
        const rfmMap: Record<string, string[]> = {
            champions: ['555', '554', '545', '544'],
            loyal: ['543', '534', '533', '453', '444', '443'],
            at_risk: ['255', '254', '245', '244', '155', '154', '145', '144'],
            hibernating: ['111', '112', '121', '122', '211', '212', '221', '222'],
            new: ['511', '512', '521', '522'],
        };
        const scores = rfmMap[segment];
        if (scores) {
            query = query.in('rfm_score', scores);
        }
    }

    const { data: customers, error } = await query;
    if (error) return JSON.stringify({ error: error.message });
    if (!customers || customers.length === 0) return JSON.stringify({ message: 'Nenhum cliente encontrado', count: 0 });

    const ltvValues = customers.map(c => Number(c.total_ltv) || 0);
    const avgLtv = ltvValues.reduce((s, v) => s + v, 0) / ltvValues.length;
    const medianLtv = ltvValues.sort((a, b) => a - b)[Math.floor(ltvValues.length / 2)] || 0;

    const churnValues = customers.filter(c => c.churn_probability != null).map(c => Number(c.churn_probability));
    const avgChurn = churnValues.length > 0 ? churnValues.reduce((s, v) => s + v, 0) / churnValues.length : null;

    // Distribuicao por canal de aquisicao
    const byChannel: Record<string, number> = {};
    for (const c of customers) {
        const ch = (c.acquisition_channel as string) || 'desconhecido';
        byChannel[ch] = (byChannel[ch] || 0) + 1;
    }

    // Clientes ativos vs inativos (ultima compra > 30 dias = inativo)
    const now = Date.now();
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
    let activeCount = 0;
    let inactiveCount = 0;
    for (const c of customers) {
        if (c.last_purchase_at && (now - new Date(c.last_purchase_at as string).getTime()) < thirtyDaysMs) {
            activeCount++;
        } else {
            inactiveCount++;
        }
    }

    return JSON.stringify({
        total_customers: customers.length,
        avg_ltv: Math.round(avgLtv * 100) / 100,
        median_ltv: Math.round(medianLtv * 100) / 100,
        avg_churn_probability: avgChurn !== null ? Math.round(avgChurn * 100) / 100 : null,
        active_last_30d: activeCount,
        inactive_over_30d: inactiveCount,
        by_acquisition_channel: byChannel,
        segment_filter: segment || 'all',
    });
}

async function executeQueryTopCustomers(profileId: string, limit: number): Promise<string> {
    const cappedLimit = Math.min(limit, 20);

    const { data: customers, error } = await supabase
        .from('customers')
        .select('id, email, total_ltv, last_purchase_at, acquisition_channel, churn_probability, rfm_score')
        .eq('profile_id', profileId)
        .order('total_ltv', { ascending: false })
        .limit(cappedLimit);

    if (error) return JSON.stringify({ error: error.message });
    if (!customers || customers.length === 0) return JSON.stringify({ message: 'Nenhum cliente encontrado', count: 0 });

    const now = Date.now();

    // Anonimizar emails: mostrar apenas dominio
    const anonymized = customers.map(c => {
        const email = c.email as string;
        const domain = email.split('@')[1] || 'unknown';
        const lastPurchase = c.last_purchase_at ? new Date(c.last_purchase_at as string) : null;
        const daysInactive = lastPurchase ? Math.floor((now - lastPurchase.getTime()) / (1000 * 60 * 60 * 24)) : null;

        return {
            customer_ref: `customer_${(c.id as string).substring(0, 8)}`,
            email_domain: domain,
            total_ltv: Math.round(Number(c.total_ltv) * 100) / 100,
            days_since_last_purchase: daysInactive,
            acquisition_channel: c.acquisition_channel || 'desconhecido',
            churn_probability: c.churn_probability != null ? Math.round(Number(c.churn_probability) * 10) / 10 : null,
            rfm_score: c.rfm_score || null,
        };
    });

    return JSON.stringify({ top_customers: anonymized, count: anonymized.length });
}

async function executeQueryRevenueTrend(profileId: string, days: number): Promise<string> {
    const since = new Date(Date.now() - Math.min(days, 90) * 24 * 60 * 60 * 1000).toISOString();

    const { data: txs, error } = await supabase
        .from('transactions')
        .select('amount_net, created_at')
        .eq('profile_id', profileId)
        .eq('status', 'approved')
        .gte('created_at', since);

    if (error) return JSON.stringify({ error: error.message });
    if (!txs || txs.length === 0) return JSON.stringify({ message: 'Nenhuma transacao no periodo', count: 0 });

    const byDay: Record<string, { count: number; revenue: number }> = {};
    for (const t of txs) {
        const day = (t.created_at as string).split('T')[0]!;
        if (!byDay[day]) byDay[day] = { count: 0, revenue: 0 };
        byDay[day].count++;
        byDay[day].revenue += Number(t.amount_net);
    }

    const trend = Object.entries(byDay)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([day, v]) => ({ day, transactions: v.count, revenue: Math.round(v.revenue * 100) / 100 }));

    // Calcular variacao semana a semana
    const revenues = trend.map(d => d.revenue);
    const lastWeek = revenues.slice(-7);
    const prevWeek = revenues.slice(-14, -7);
    const lastWeekTotal = lastWeek.reduce((s, v) => s + v, 0);
    const prevWeekTotal = prevWeek.reduce((s, v) => s + v, 0);
    const weekOverWeekChange = prevWeekTotal > 0
        ? Math.round(((lastWeekTotal - prevWeekTotal) / prevWeekTotal) * 10000) / 100
        : null;

    return JSON.stringify({
        period_days: days,
        daily_trend: trend,
        last_7d_total: Math.round(lastWeekTotal * 100) / 100,
        prev_7d_total: Math.round(prevWeekTotal * 100) / 100,
        week_over_week_change_pct: weekOverWeekChange,
    });
}

async function executeQueryCacByChannel(profileId: string, days: number): Promise<string> {
    const since = new Date(Date.now() - Math.min(days, 90) * 24 * 60 * 60 * 1000);
    const sinceDate = since.toISOString().split('T')[0]!;
    const sinceIso = since.toISOString();

    // Spend por plataforma
    const { data: metrics } = await supabase
        .from('ad_metrics')
        .select('platform, spend_brl')
        .eq('profile_id', profileId)
        .gte('date', sinceDate);

    // Novos clientes por canal
    const { data: newCustomers } = await supabase
        .from('customers')
        .select('acquisition_channel, total_ltv')
        .eq('profile_id', profileId)
        .gte('created_at', sinceIso);

    if (!metrics?.length && !newCustomers?.length) {
        return JSON.stringify({ message: 'Dados insuficientes para calcular CAC por canal', count: 0 });
    }

    const spendByPlatform: Record<string, number> = {};
    for (const m of metrics || []) {
        const p = m.platform as string;
        spendByPlatform[p] = (spendByPlatform[p] || 0) + Number(m.spend_brl);
    }

    const customersByChannel: Record<string, { count: number; avg_ltv: number; total_ltv: number }> = {};
    for (const c of newCustomers || []) {
        const ch = (c.acquisition_channel as string) || 'desconhecido';
        if (!customersByChannel[ch]) customersByChannel[ch] = { count: 0, avg_ltv: 0, total_ltv: 0 };
        customersByChannel[ch].count++;
        customersByChannel[ch].total_ltv += Number(c.total_ltv) || 0;
    }

    // Mapear plataformas para canais
    const platformToChannel: Record<string, string> = { meta: 'meta_ads', google: 'google_ads' };

    const channels = Object.entries(customersByChannel).map(([channel, data]) => {
        const avgLtv = data.count > 0 ? data.total_ltv / data.count : 0;

        // Encontrar spend correspondente
        let spend = 0;
        for (const [platform, s] of Object.entries(spendByPlatform)) {
            if (platformToChannel[platform] === channel) spend += s;
        }

        const cac = data.count > 0 && spend > 0 ? spend / data.count : 0;
        const profitable = avgLtv > cac;

        return {
            channel,
            new_customers: data.count,
            total_spend: Math.round(spend * 100) / 100,
            cac: Math.round(cac * 100) / 100,
            avg_ltv: Math.round(avgLtv * 100) / 100,
            ltv_to_cac_ratio: cac > 0 ? Math.round((avgLtv / cac) * 100) / 100 : null,
            profitable,
        };
    });

    return JSON.stringify({ period_days: days, channels });
}

async function executeQueryChurnRisk(profileId: string): Promise<string> {
    const { data: customers, error } = await supabase
        .from('customers')
        .select('churn_probability, total_ltv')
        .eq('profile_id', profileId)
        .not('churn_probability', 'is', null);

    if (error) return JSON.stringify({ error: error.message });
    if (!customers || customers.length === 0) return JSON.stringify({ message: 'Nenhum cliente com churn calculado', count: 0 });

    const bands = [
        { label: '0-25%', min: 0, max: 25, count: 0, totalLtv: 0 },
        { label: '25-50%', min: 25, max: 50, count: 0, totalLtv: 0 },
        { label: '50-75%', min: 50, max: 75, count: 0, totalLtv: 0 },
        { label: '75-100%', min: 75, max: 100, count: 0, totalLtv: 0 },
    ];

    for (const c of customers) {
        const prob = Number(c.churn_probability);
        const ltv = Number(c.total_ltv) || 0;
        for (const band of bands) {
            if (prob >= band.min && prob < (band.max === 100 ? 101 : band.max)) {
                band.count++;
                band.totalLtv += ltv;
                break;
            }
        }
    }

    return JSON.stringify({
        total_customers_with_churn: customers.length,
        bands: bands.map(b => ({
            range: b.label,
            count: b.count,
            pct_of_total: Math.round((b.count / customers.length) * 10000) / 100,
            avg_ltv: b.count > 0 ? Math.round((b.totalLtv / b.count) * 100) / 100 : 0,
            total_ltv_at_risk: Math.round(b.totalLtv * 100) / 100,
        })),
    });
}

async function executeQueryCohortRetention(profileId: string): Promise<string> {
    const { data: customers, error } = await supabase
        .from('customers')
        .select('id, created_at')
        .eq('profile_id', profileId);

    if (error) return JSON.stringify({ error: error.message });
    if (!customers || customers.length === 0) return JSON.stringify({ message: 'Nenhum cliente encontrado', count: 0 });

    // Agrupar por cohort mensal (mes de criacao)
    const cohorts: Record<string, string[]> = {};
    for (const c of customers) {
        const month = (c.created_at as string).substring(0, 7);
        if (!cohorts[month]) cohorts[month] = [];
        cohorts[month].push(c.id as string);
    }

    // Para cada cohort, verificar quantos fizeram mais de 1 transacao
    const cohortResults: Array<{ month: string; total: number; retained: number; retention_pct: number }> = [];

    for (const [month, customerIds] of Object.entries(cohorts).sort(([a], [b]) => a.localeCompare(b))) {
        if (customerIds.length < 3) continue; // cohorts muito pequenos nao sao significativos

        // Buscar transacoes desses clientes (count > 1)
        const { data: txCounts } = await supabase
            .from('transactions')
            .select('customer_id')
            .eq('profile_id', profileId)
            .eq('status', 'approved')
            .in('customer_id', customerIds.slice(0, 100)); // limitar para performance

        if (!txCounts) continue;

        const txByCustomer: Record<string, number> = {};
        for (const tx of txCounts) {
            const cid = tx.customer_id as string;
            txByCustomer[cid] = (txByCustomer[cid] || 0) + 1;
        }

        const retained = Object.values(txByCustomer).filter(count => count > 1).length;
        const total = Math.min(customerIds.length, 100);
        const retentionPct = total > 0 ? Math.round((retained / total) * 10000) / 100 : 0;

        cohortResults.push({ month, total, retained, retention_pct: retentionPct });
    }

    return JSON.stringify({ cohorts: cohortResults });
}

// ── Dispatcher de ferramentas ─────────────────────────────────────────────

async function executeTool(name: string, input: Record<string, unknown>): Promise<string> {
    const profileId = input.profile_id as string;

    switch (name) {
        case 'query_transactions':
            return executeQueryTransactions(profileId, Number(input.days) || 30, input.group_by as string | undefined);
        case 'query_ad_metrics':
            return executeQueryAdMetrics(profileId, Number(input.days) || 30);
        case 'query_customers':
            return executeQueryCustomers(profileId, input.segment as string | undefined);
        case 'query_top_customers':
            return executeQueryTopCustomers(profileId, Number(input.limit) || 10);
        case 'query_revenue_trend':
            return executeQueryRevenueTrend(profileId, Number(input.days) || 30);
        case 'query_cac_by_channel':
            return executeQueryCacByChannel(profileId, Number(input.days) || 30);
        case 'query_churn_risk':
            return executeQueryChurnRisk(profileId);
        case 'query_cohort_retention':
            return executeQueryCohortRetention(profileId);
        default:
            return JSON.stringify({ error: `Ferramenta desconhecida: ${name}` });
    }
}

// ── Loop principal do agente ──────────────────────────────────────────────

export async function runAIAlertAnalyst(profileId: string): Promise<AIAnalystOutput> {
    const client = getAnthropicClient() as AiClient;
    const startTime = Date.now();

    const userPrompt = `Analise os dados do negocio com profile_id "${profileId}". Explore receita, clientes, ads e retenção. Identifique problemas e oportunidades cruzando pelo menos 2 fontes de dados. Retorne seus findings em JSON.`;

    let messages: Anthropic.MessageParam[] = [
        { role: 'user', content: userPrompt },
    ];

    let turns = 0;

    while (turns < MAX_TOOL_TURNS) {
        // Timeout defensivo
        if (Date.now() - startTime > TIMEOUT_MS) {
            console.warn(`[AIAlertAnalyst] Timeout atingido (${TIMEOUT_MS}ms) para profile ${profileId}`);
            return { findings: [] };
        }

        turns++;

        const response = await client.messages.create({
            model: ANTHROPIC_MODELS.SONNET,
            max_tokens: 4096,
            system: SYSTEM_PROMPT,
            messages,
            tools: ANALYST_TOOLS,
        });

        // Se nao precisa de mais ferramentas, extrair resposta final
        if (response.stop_reason !== 'tool_use') {
            const textBlock = response.content.find(b => b.type === 'text');
            if (textBlock && textBlock.type === 'text') {
                return parseAnalystOutput(textBlock.text);
            }
            console.warn('[AIAlertAnalyst] Resposta sem bloco de texto');
            return { findings: [] };
        }

        // Processar tool_use blocks
        const toolUseBlocks = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
        );

        // Adicionar resposta do assistant ao historico
        messages = [
            ...messages,
            { role: 'assistant' as const, content: response.content },
        ];

        // Executar ferramentas em paralelo
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
            toolUseBlocks.map(async (toolBlock) => {
                const result = await executeTool(
                    toolBlock.name,
                    toolBlock.input as Record<string, unknown>
                );
                return {
                    type: 'tool_result' as const,
                    tool_use_id: toolBlock.id,
                    content: result,
                };
            })
        );

        // Adicionar resultados ao historico
        messages = [
            ...messages,
            { role: 'user' as const, content: toolResults },
        ];
    }

    console.warn(`[AIAlertAnalyst] Limite de ${MAX_TOOL_TURNS} turns atingido para profile ${profileId}`);
    return { findings: [] };
}

// ── Parser do output ──────────────────────────────────────────────────────

function parseAnalystOutput(text: string): AIAnalystOutput {
    // Tentar extrair JSON do texto (pode estar dentro de markdown code block)
    const jsonMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/) || text.match(/(\{[\s\S]*\})/);
    const jsonStr = jsonMatch ? jsonMatch[1]!.trim() : text.trim();

    try {
        const parsed = JSON.parse(jsonStr) as AIAnalystOutput;

        // Validar e filtrar findings
        if (!Array.isArray(parsed.findings)) {
            console.warn('[AIAlertAnalyst] Output sem array de findings');
            return { findings: [] };
        }

        const validFindings = parsed.findings.filter(f => {
            if (!f.type || !f.title || !f.body || !f.rationale) {
                console.warn(`[AIAlertAnalyst] Finding invalido descartado: ${JSON.stringify(f).substring(0, 100)}`);
                return false;
            }
            if (f.type !== 'alert' && f.type !== 'recommendation') return false;
            if (f.severity && !['info', 'warning', 'critical'].includes(f.severity)) {
                f.severity = 'info';
            }
            return true;
        });

        // Limitar a 5 findings
        return { findings: validFindings.slice(0, 5) };
    } catch (err) {
        console.error('[AIAlertAnalyst] Falha ao parsear JSON do agente:', err instanceof Error ? err.message : String(err));
        console.error('[AIAlertAnalyst] Texto recebido (primeiros 500 chars):', text.substring(0, 500));
        return { findings: [] };
    }
}
