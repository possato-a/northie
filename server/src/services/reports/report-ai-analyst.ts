import Anthropic from '@anthropic-ai/sdk';
import type { generateReportData } from './report-generator.js';

export interface ReportAIAnalysis {
    executive_summary: string;
    highlights: string[];      // 3-5 sinais positivos
    alerts: string[];          // 1-3 riscos
    recommendations: string[]; // 2-4 ações concretas
    channel_insights: string;  // parágrafo sobre canais
    generated_at: string;
    model: string;
}

let _anthropic: Anthropic | null = null;

function getAnthropic(): Anthropic {
    if (!_anthropic) {
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return _anthropic;
}

const fmt = (n: number, decimals = 2) =>
    n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

const fmtBrl = (n: number) => `R$ ${fmt(n)}`;
const fmtPct = (n: number) => `${fmt(n)}%`;

function buildUserMessage(data: Awaited<ReturnType<typeof generateReportData>>): string {
    const { period, summary, revenue_by_platform, spend_by_platform, new_customers_by_channel, cac_by_channel } = data;

    const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-BR');
    const changeLine = summary.revenue_change_pct !== null
        ? `${fmtPct(summary.revenue_change_pct)} vs período anterior (${fmtBrl(summary.prev_revenue_net)})`
        : 'sem dados de período anterior para comparação';

    const platformRevLines = Object.entries(revenue_by_platform)
        .map(([k, v]) => `  - ${k}: ${fmtBrl(v as number)}`)
        .join('\n') || '  - nenhum dado';

    const spendLines = Object.entries(spend_by_platform)
        .map(([k, v]) => `  - ${k}: ${fmtBrl(v as number)}`)
        .join('\n') || '  - nenhum dado';

    const channelLines = Object.entries(new_customers_by_channel)
        .map(([k, v]) => `  - ${k}: ${v} clientes`)
        .join('\n') || '  - nenhum dado';

    const cacLines = Object.entries(cac_by_channel)
        .map(([k, v]) => `  - ${k}: ${fmtBrl(v as number)} por cliente`)
        .join('\n') || '  - nenhum dado';

    return `Analise os dados de negócio abaixo e gere uma análise executiva completa em JSON.

PERÍODO: ${fmtDate(period.start)} a ${fmtDate(period.end)} (${period.days} dias — ${period.frequency})

MÉTRICAS PRINCIPAIS:
- Receita líquida: ${fmtBrl(summary.revenue_net)}
- Receita bruta: ${fmtBrl(summary.revenue_gross)}
- Margem bruta: ${fmtPct(summary.gross_margin_pct)}
- Variação de receita: ${changeLine}
- Transações: ${summary.transactions}
- Ticket médio: ${fmtBrl(summary.aov)}
- Novos clientes: ${summary.new_customers}
- LTV médio dos novos clientes: ${fmtBrl(summary.ltv_avg)}

ADS:
- Investimento total: ${fmtBrl(summary.ad_spend)}
- ROAS: ${fmt(summary.roas)}x
- Impressões: ${summary.impressions.toLocaleString('pt-BR')}
- Cliques: ${summary.clicks.toLocaleString('pt-BR')}
- CTR: ${fmtPct(summary.ctr)}

RECEITA POR PLATAFORMA:
${platformRevLines}

INVESTIMENTO POR PLATAFORMA:
${spendLines}

NOVOS CLIENTES POR CANAL:
${channelLines}

CAC POR CANAL:
${cacLines}

Responda APENAS com JSON válido neste formato exato (sem markdown, sem fences, sem texto extra):
{
  "executive_summary": "parágrafo de 2-3 frases resumindo a performance do período",
  "highlights": ["sinal positivo 1", "sinal positivo 2", "sinal positivo 3"],
  "alerts": ["risco ou ponto de atenção 1"],
  "recommendations": ["ação concreta 1", "ação concreta 2", "ação concreta 3"],
  "channel_insights": "parágrafo analisando performance por canal e onde focar investimento"
}`;
}

const FALLBACK: Omit<ReportAIAnalysis, 'generated_at' | 'model'> = {
    executive_summary: 'Análise de IA indisponível. Consulte os dados numéricos do relatório.',
    highlights: [],
    alerts: [],
    recommendations: [],
    channel_insights: '',
};

export async function generateReportNarrative(
    data: Awaited<ReturnType<typeof generateReportData>>
): Promise<ReportAIAnalysis> {
    const generatedAt = new Date().toISOString();
    const model = 'claude-sonnet-4-6';

    try {
        const response = await getAnthropic().messages.create({
            model,
            max_tokens: 1500,
            system: 'Você é um analista financeiro especialista em negócios digitais brasileiros. Analise métricas de negócio e gere insights executivos precisos e acionáveis em português do Brasil. Nunca inclua dados pessoais identificáveis (PII). Responda SOMENTE com JSON válido, sem nenhum texto antes ou depois.',
            messages: [{ role: 'user', content: buildUserMessage(data) }],
        });

        const first = response.content[0];
        const raw = first && first.type === 'text' ? first.text : '';

        // Strip markdown fences if present
        const cleaned = raw
            .replace(/^```(?:json)?\s*/i, '')
            .replace(/\s*```\s*$/, '')
            .trim();

        const parsed = JSON.parse(cleaned) as Omit<ReportAIAnalysis, 'generated_at' | 'model'>;

        return {
            executive_summary: parsed.executive_summary ?? FALLBACK.executive_summary,
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
            alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
            recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
            channel_insights: parsed.channel_insights ?? '',
            generated_at: generatedAt,
            model,
        };
    } catch (err) {
        console.error('[ReportAI] Falha na análise narrativa:', err);
        return { ...FALLBACK, generated_at: generatedAt, model };
    }
}
