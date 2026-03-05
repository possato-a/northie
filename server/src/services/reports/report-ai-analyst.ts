import Anthropic from '@anthropic-ai/sdk';
import type { generateReportData } from './report-generator.js';

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
    const { period, summary, channel_economics, rfm_distribution, at_risk_customers } = data;

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
    const rfmLines = rfm_distribution.length > 0
        ? rfm_distribution
            .filter(s => s.count > 0)
            .map(s => `  ${s.segment}: ${s.count} clientes — LTV total ${fmtBrl(s.ltv)}`)
            .join('\n')
        : '  - dados RFM ainda não calculados';

    // At-risk summary
    const atRiskTotalLtv = at_risk_customers.reduce((s, c) => s + (c.ltv ?? 0), 0);
    const atRiskLine = at_risk_customers.length > 0
        ? `${at_risk_customers.length} clientes com churn > 60% — LTV total em risco: ${fmtBrl(atRiskTotalLtv)}`
        : 'nenhum cliente com churn > 60% identificado';

    return `Você é um CFO/CMO sênior especialista em negócios digitais brasileiros.

Analise os dados cruzados abaixo e diagnostique cada problema como um médico — sintoma objetivo, causa raiz fundamentada nos dados, consequência em R$, ação executável.

PERÍODO: ${fmtDate(period.start)} a ${fmtDate(period.end)} (${period.days} dias — ${period.frequency})

MÉTRICAS GERAIS:
- Receita líquida: ${fmtBrl(summary.revenue_net)}
- Receita bruta: ${fmtBrl(summary.revenue_gross)}
- Margem bruta: ${fmtPct(summary.gross_margin_pct)}
- Variação de receita: ${changeLine}
- Transações: ${summary.transactions}
- Ticket médio: ${fmtBrl(summary.aov)}
- Investimento total em ads: ${fmtBrl(summary.ad_spend)}
- ROAS geral: ${fmt(summary.roas)}x
- Novos clientes: ${summary.new_customers}
- LTV médio: ${fmtBrl(summary.ltv_avg)}
- CTR: ${fmtPct(summary.ctr)}

ECONOMIA POR CANAL (cruzamento LTV dos clientes adquiridos × Spend de ads no período):
${economicsTable}

QUALIDADE DA BASE (RFM):
${rfmLines}

CLIENTES EM RISCO (churn > 60%):
${atRiskLine}

Para cada canal com status PREJUÍZO ou qualquer situação preocupante (ex: base em risco, churn alto), diagnostique com precisão.
Ignore canais "desconhecido" no diagnóstico.
Canais orgânicos (sem spend) podem ter diagnóstico positivo se o LTV for alto.

Responda SOMENTE com JSON válido, sem markdown, sem texto extra:
{
  "situacao_geral": "saudavel" | "atencao" | "critica",
  "resumo_executivo": "2-3 frases sobre a performance geral do período",
  "diagnosticos": [
    {
      "canal": "nome do canal ou situação (ex: meta_ads, base_em_risco)",
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

// ── Fallback ──────────────────────────────────────────────────────────────────

const FALLBACK: Omit<ReportAIAnalysis, 'generated_at' | 'model'> = {
    situacao_geral: 'atencao',
    resumo_executivo: 'Análise de IA indisponível. Consulte os dados numéricos do relatório.',
    diagnosticos: [],
    proximos_passos: [],
};

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
        resumo_executivo: parsed.resumo_executivo ?? FALLBACK.resumo_executivo,
        diagnosticos,
        proximos_passos: Array.isArray(parsed.proximos_passos) ? parsed.proximos_passos.map(String) : [],
    };
}

// ── Main export ───────────────────────────────────────────────────────────────

export async function generateReportNarrative(
    data: Awaited<ReturnType<typeof generateReportData>>
): Promise<ReportAIAnalysis> {
    const generatedAt = new Date().toISOString();
    const model = 'claude-sonnet-4-6';

    try {
        const response = await getAnthropic().messages.create({
            model,
            max_tokens: 2000,
            system: 'Você é um CFO/CMO sênior especialista em negócios digitais brasileiros. Analise dados cruzados de múltiplas fontes e diagnostique problemas com precisão clínica — sintoma, causa raiz, consequência em R$, ação. Nunca inclua dados pessoais identificáveis (PII). Responda SOMENTE com JSON válido, sem nenhum texto antes ou depois.',
            messages: [{ role: 'user', content: buildUserMessage(data) }],
        });

        const first = response.content[0];
        const raw = first && first.type === 'text' ? first.text : '';

        const result = parseAnalysis(raw);
        return { ...result, generated_at: generatedAt, model };
    } catch (err) {
        console.error('[ReportAI] Falha na análise narrativa:', err);
        return { ...FALLBACK, generated_at: generatedAt, model };
    }
}
