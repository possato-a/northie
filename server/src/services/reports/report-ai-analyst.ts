import Anthropic from '@anthropic-ai/sdk';
import type { generateReportData } from './report-generator.js';
import { runOrchestratorPipeline } from './report-ai-orchestrator.js';

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface ChannelDiagnosis {
    canal: string;
    severidade: 'critica' | 'alta' | 'media' | 'ok';
    sintoma: string;
    causa_raiz: string;
    consequencia: string;
    consequencia_financeira_brl: number;
    acao_recomendada: string;
    prazo: 'imediato' | 'esta_semana' | 'este_mes';
}

export interface ReportAIAnalysis {
    situacao_geral: 'saudavel' | 'atencao' | 'critica';
    resumo_executivo: string;
    diagnosticos: ChannelDiagnosis[];
    proximos_passos: string[];
    generated_at: string;
    model: string;
    is_ai_fallback?: boolean;
}

// ── Anthropic client ──────────────────────────────────────────────────────────

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return _anthropic;
}

// ── Formatters ────────────────────────────────────────────────────────────────

const fmt = (n: number, decimals = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtBrl = (n: number) => `R$ ${fmt(n)}`;
const fmtPct = (n: number) => `${fmt(n)}%`;

// ── Prompt builder ────────────────────────────────────────────────────────────

function buildUserMessage(data: Awaited<ReturnType<typeof generateReportData>>): string {
    const { period, summary, channel_economics, rfm_distribution, at_risk_customers, business_type, top_products, revenue_trend, rfm_source } = data;

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
    const changeLine = summary.revenue_change_pct !== null
        ? `${fmtPct(summary.revenue_change_pct)} vs período anterior (${fmtBrl(summary.prev_revenue_net)})`
        : 'sem dados de período anterior para comparação';

    // Canal economics table
    const economicsTable = channel_economics.length > 0
        ? channel_economics.map(e => {
            const ltv_cac = e.ltv_cac_ratio !== null ? fmt(e.ltv_cac_ratio) : '-';
            const cacFmt = e.cac > 0 ? fmtBrl(e.cac) : 'sem spend';
            return `  ${e.channel}: ${e.new_customers} clientes | LTV médio ${fmtBrl(e.avg_ltv)} | CAC ${cacFmt} | LTV/CAC ${ltv_cac} | Valor criado ${fmtBrl(e.value_created)} | Status: ${e.status.toUpperCase()}`;
        }).join('\n')
        : '  - sem dados de novos clientes no período';

    // RFM summary
    const rfmSourceNote = rfm_source === 'estimated' ? ' (estimado a partir dos dados disponíveis — job de RFM não executado)' : '';
    const rfmLines = rfm_distribution.length > 0
        ? rfm_distribution
            .filter(s => s.count > 0)
            .map(s => `  ${s.segment}: ${s.count} clientes — LTV total ${fmtBrl(s.ltv)}`)
            .join('\n') + rfmSourceNote
        : '  - dados RFM ainda não calculados';

    // At-risk summary
    const atRiskTotalLtv = at_risk_customers.reduce((s, c) => s + (c.ltv ?? 0), 0);
    const atRiskLine = at_risk_customers.length > 0
        ? `${at_risk_customers.length} clientes com churn > 60% — LTV total em risco: ${fmtBrl(atRiskTotalLtv)}`
        : 'nenhum cliente com churn > 60% identificado';

    // Taxa de reembolso
    const refundStatus = summary.refund_rate > 10 ? 'CRÍTICA' : summary.refund_rate > 5 ? 'alta' : 'normal';
    const refundLine = `${fmtPct(summary.refund_rate)} (${fmtBrl(summary.refund_amount)}) — nível ${refundStatus}`;

    // Tendência de receita
    const trendLines = revenue_trend.length >= 2
        ? revenue_trend.map(t => {
            const change = t.change_pct !== null ? ` (${t.change_pct >= 0 ? '+' : ''}${fmt(t.change_pct)}%)` : '';
            return `  ${t.month}: ${fmtBrl(t.revenue)}${change}`;
        }).join(' → ')
        : '  - menos de 2 meses de dados disponíveis';

    // Top produtos
    const productsLines = top_products.length > 0
        ? top_products.slice(0, 5).map(p => `  ${p.product_name}: ${fmtBrl(p.revenue)} (${p.pct_of_total}%) — ${p.transactions} vendas`).join('\n')
        : '  - sem dados de produtos (plataformas sem product_name)';

    // Benchmarks por tipo de negócio
    const benchmarks: Record<string, string> = {
        saas: `BENCHMARKS PARA SAAS:
- LTV/CAC mínimo recomendado: > 3x (regra do ouro)
- Churn mensal aceitável: < 2% (crítico acima de 5%)
- Taxa de reembolso aceitável: < 3%
- MRR growth saudável: > 10% ao mês`,
        ecommerce: `BENCHMARKS PARA E-COMMERCE:
- ROAS saudável: 3-5x (crítico abaixo de 2x)
- Taxa de reembolso aceitável: < 5% (alta acima de 8%)
- LTV/CAC mínimo recomendado: > 2x
- Repeat purchase rate esperado: > 30%`,
        dtc: `BENCHMARKS PARA DTC:
- ROAS saudável: 3-6x (crítico abaixo de 2.5x)
- Taxa de reembolso aceitável: < 5%
- LTV/CAC mínimo recomendado: > 3x
- Taxa de recompra esperada: > 25%`,
        startup: `BENCHMARKS PARA STARTUP DIGITAL:
- Foco em crescimento: CAC pode ser alto nos primeiros meses
- LTV/CAC mínimo no longo prazo: > 3x
- Taxa de reembolso aceitável: < 3%
- Payback period ideal: < 12 meses`,
    };
    const benchmarkBlock = business_type && benchmarks[business_type]
        ? `\n${benchmarks[business_type]}\n`
        : '\nBENCHMARKS GERAIS:\n- LTV/CAC mínimo recomendado: > 3x\n- Taxa de reembolso aceitável: < 5%\n- ROAS saudável: > 3x\n';

    return `Você é um CFO/CMO sênior especialista em negócios digitais brasileiros.

Analise os dados cruzados abaixo e diagnostique cada problema como um médico — sintoma objetivo, causa raiz fundamentada nos dados, consequência em R$, ação executável.

PERÍODO: ${fmtDate(period.start)} a ${fmtDate(period.end)} (${period.days} dias — ${period.frequency})

TIPO DE NEGÓCIO: ${business_type ?? 'não informado'}
${benchmarkBlock}
MÉTRICAS GERAIS:
- Receita líquida: ${fmtBrl(summary.revenue_net)}
- Receita bruta: ${fmtBrl(summary.revenue_gross)}
- Margem bruta: ${fmtPct(summary.gross_margin_pct)}
- Variação de receita: ${changeLine}
- Taxa de reembolso: ${refundLine}
- Transações: ${summary.transactions}
- Ticket médio: ${fmtBrl(summary.aov)}
- Investimento total em ads: ${fmtBrl(summary.ad_spend)}
- ROAS geral: ${fmt(summary.roas)}x
- Novos clientes: ${summary.new_customers}
- LTV médio: ${fmtBrl(summary.ltv_avg)}
- Base total de clientes: ${summary.total_customers}
- CTR: ${fmtPct(summary.ctr)}

TENDÊNCIA DE RECEITA (últimos 6 meses):
${trendLines}

TOP PRODUTOS DO PERÍODO:
${productsLines}

ECONOMIA POR CANAL (cruzamento LTV dos clientes adquiridos × Spend de ads no período):
${economicsTable}

QUALIDADE DA BASE (RFM):
${rfmLines}

CLIENTES EM RISCO (churn > 60%):
${atRiskLine}

Para cada canal com status PREJUÍZO ou qualquer situação preocupante (ex: base em risco, churn alto, reembolsos elevados, tendência negativa), diagnostique com precisão.
Ignore canais "desconhecido" no diagnóstico.
Canais orgânicos (sem spend) podem ter diagnóstico positivo se o LTV for alto.
Use os benchmarks do tipo de negócio para contextualizar cada métrica.

Responda SOMENTE com JSON válido, sem markdown, sem texto extra:
{
  "situacao_geral": "saudavel" | "atencao" | "critica",
  "resumo_executivo": "2-3 frases sobre a performance geral do período, incluindo tendência e tipo de negócio",
  "diagnosticos": [
    {
      "canal": "nome do canal ou situação (ex: meta_ads, base_em_risco, reembolsos)",
      "severidade": "critica" | "alta" | "media" | "ok",
      "sintoma": "o que os números mostram — objetivo, sem interpretação",
      "causa_raiz": "hipótese fundamentada nos dados cruzados",
      "consequencia": "impacto no negócio se não resolver",
      "consequencia_financeira_brl": 1500,
      "acao_recomendada": "ação específica e executável",
      "prazo": "imediato" | "esta_semana" | "este_mes"
    }
  ],
  "proximos_passos": ["ação priorizada 1", "ação priorizada 2", "ação priorizada 3"]
}`;
}

// ── Fallback inteligente — gera narrativa a partir dos dados sem chamar IA ────

function generateFallbackNarrative(
    data: Awaited<ReturnType<typeof generateReportData>>,
): Omit<ReportAIAnalysis, 'generated_at' | 'model'> {
    const { summary, channel_economics, at_risk_customers } = data;

    const fmtBrl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { maximumFractionDigits: 0 })}`;

    const situacao_geral: 'saudavel' | 'atencao' | 'critica' =
        (summary.revenue_change_pct !== null && summary.revenue_change_pct < -20) ||
        channel_economics.filter(c => c.status === 'prejuizo').length >= 2
            ? 'critica'
            : channel_economics.some(c => c.status === 'prejuizo') || at_risk_customers.length > 5
                ? 'atencao'
                : 'saudavel';

    const changeText = summary.revenue_change_pct !== null
        ? `, ${summary.revenue_change_pct >= 0 ? 'crescimento' : 'queda'} de ${Math.abs(summary.revenue_change_pct).toFixed(1)}% vs período anterior`
        : '';

    const resumo_executivo = `Receita líquida de ${fmtBrl(summary.revenue_net)} no período${changeText}. ROAS geral de ${summary.roas.toFixed(1)}x com ${summary.new_customers} novos clientes adquiridos. ${at_risk_customers.length > 0 ? `${at_risk_customers.length} clientes com alto risco de churn identificados.` : 'Base de clientes estável no período.'}`;

    const diagnosticos: ChannelDiagnosis[] = channel_economics
        .filter(c => c.status === 'prejuizo' && c.channel !== 'desconhecido')
        .slice(0, 3)
        .map(c => ({
            canal: c.channel,
            severidade: c.value_created < -1000 ? 'critica' : 'alta',
            sintoma: `LTV/CAC de ${c.ltv_cac_ratio?.toFixed(2) ?? '0'}x — canal operando em prejuízo`,
            causa_raiz: `CAC (${fmtBrl(c.cac)}) superior ao LTV médio (${fmtBrl(c.avg_ltv)}) dos clientes adquiridos`,
            consequencia: `Perda de ${fmtBrl(Math.abs(c.value_created))} no período se não corrigido`,
            consequencia_financeira_brl: Math.abs(c.value_created),
            acao_recomendada: 'Revisar segmentação e criativos. Pausar grupos de anúncios com LTV/CAC < 1x.',
            prazo: 'esta_semana' as const,
        }));

    const proximos_passos: string[] = [];
    if (channel_economics.some(c => c.status === 'prejuizo')) {
        proximos_passos.push('Revisar canais com LTV/CAC < 1x e pausar campanhas não rentáveis');
    }
    if (at_risk_customers.length > 0) {
        proximos_passos.push(`Acionar campanha de reativação para os ${at_risk_customers.length} clientes em risco de churn`);
    }
    if (summary.revenue_change_pct !== null && summary.revenue_change_pct < 0) {
        proximos_passos.push('Investigar queda de receita e identificar principal causa na semana');
    }
    if (proximos_passos.length < 2) {
        proximos_passos.push('Manter monitoramento semanal das métricas de aquisição por canal');
    }

    return { situacao_geral, resumo_executivo, diagnosticos, proximos_passos, is_ai_fallback: true };
}

// ── Parser / validator ────────────────────────────────────────────────────────

function parseAnalysis(raw: string): Omit<ReportAIAnalysis, 'generated_at' | 'model'> {
    const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

    const parsed = JSON.parse(cleaned);

    const validSituacao = ['saudavel', 'atencao', 'critica'];
    const validSeveridade = ['critica', 'alta', 'media', 'ok'];
    const validPrazo = ['imediato', 'esta_semana', 'este_mes'];

    const diagnosticos: ChannelDiagnosis[] = Array.isArray(parsed.diagnosticos)
        ? parsed.diagnosticos
            .filter((d: unknown) => d && typeof d === 'object')
            .map((d: Record<string, unknown>) => ({
                canal: String(d.canal ?? ''),
                severidade: validSeveridade.includes(d.severidade as string) ? d.severidade as ChannelDiagnosis['severidade'] : 'media',
                sintoma: String(d.sintoma ?? ''),
                causa_raiz: String(d.causa_raiz ?? ''),
                consequencia: String(d.consequencia ?? ''),
                consequencia_financeira_brl: Math.max(0, Number(d.consequencia_financeira_brl ?? 0)),
                acao_recomendada: String(d.acao_recomendada ?? ''),
                prazo: validPrazo.includes(d.prazo as string) ? d.prazo as ChannelDiagnosis['prazo'] : 'este_mes',
            }))
        : [];

    return {
        situacao_geral: validSituacao.includes(parsed.situacao_geral) ? parsed.situacao_geral : 'atencao',
        resumo_executivo: parsed.resumo_executivo ?? 'Análise de IA indisponível. Consulte os dados numéricos do relatório.',
        diagnosticos,
        proximos_passos: Array.isArray(parsed.proximos_passos) ? parsed.proximos_passos.map(String) : [],
    };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateReportNarrative(
    data: Awaited<ReturnType<typeof generateReportData>>,
    profileId?: string,
): Promise<ReportAIAnalysis> {
    // Agente V2: pipeline de dois agentes com tool_use + extended thinking
    if (process.env.AI_AGENT_V2 === 'true' && profileId) {
        return runOrchestratorPipeline(data, profileId);
    }

    // Legacy: prompt único (default)
    const generatedAt = new Date().toISOString();
    const model = 'claude-sonnet-4-6';

    try {
        const aiPromise = getAnthropic().messages.create({
            model,
            max_tokens: 4000,
            system: 'Você é um CFO/CMO sênior especialista em negócios digitais brasileiros. Analise dados cruzados de múltiplas fontes e diagnostique problemas com precisão clínica — sintoma, causa raiz, consequência em R$, ação. Nunca inclua dados pessoais identificáveis (PII). Responda SOMENTE com JSON válido, sem nenhum texto antes ou depois.',
            messages: [{ role: 'user', content: buildUserMessage(data) }],
        });

        const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('AI_TIMEOUT')), 45_000)
        );

        const response = await Promise.race([aiPromise, timeoutPromise]);
        const first = response.content[0];
        const raw = first && first.type === 'text' ? first.text : '';

        const result = parseAnalysis(raw);
        return { ...result, generated_at: generatedAt, model };
    } catch (err) {
        const isTimeout = err instanceof Error && err.message === 'AI_TIMEOUT';
        if (isTimeout) {
            console.warn('[ReportAI] Timeout — usando narrativa fallback baseada em dados');
        } else {
            console.error('[ReportAI] Falha na análise narrativa:', err);
        }
        const fallback = generateFallbackNarrative(data);
        return { ...fallback, generated_at: generatedAt, model: isTimeout ? 'fallback-timeout' : 'fallback-error' };
    }
}
