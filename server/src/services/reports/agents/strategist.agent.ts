import type Anthropic from '@anthropic-ai/sdk';
import type { generateReportData } from '../report-generator.js';
import type { ReportAIAnalysis, ChannelDiagnosis } from '../report-ai-analyst.js';

type ReportData = Awaited<ReturnType<typeof generateReportData>>;

// ── Benchmarks por tipo de negócio ────────────────────────────────────────────

const BENCHMARKS: Record<string, string> = {
    saas:
        'LTV/CAC > 3x (regra de ouro) | Churn mensal aceitável < 2% (crítico > 5%) | Reembolso < 3% | MRR growth saudável > 10%/mês',
    ecommerce:
        'ROAS saudável 3-5x (crítico < 2x) | Reembolso < 5% (alto > 8%) | LTV/CAC > 2x | Repeat purchase > 30%',
    dtc:
        'ROAS 3-6x (crítico < 2.5x) | Reembolso < 5% | LTV/CAC > 3x | Recompra > 25%',
    infoprodutor_perpetuo:
        'ROAS > 3x | Reembolso < 7% | LTV/CAC > 2x | Recompra esperada > 20%',
    infoprodutor_lancamento:
        'ROAS > 5x durante lançamento | Reembolso < 10% | LTV/CAC > 1.5x | Foco em volume de novos clientes',
    startup:
        'Foco em crescimento — CAC alto é aceitável | LTV/CAC > 3x no longo prazo | Payback < 12 meses | Reembolso < 3%',
};

// ── Prompt ────────────────────────────────────────────────────────────────────

function buildPrompt(data: ReportData, analystFindings: string): string {
    const fmtBrl = (n: number) =>
        `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmt = (n: number, d = 2) =>
        n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });

    const benchmark = data.business_type && BENCHMARKS[data.business_type]
        ? `BENCHMARKS (${data.business_type}):\n${BENCHMARKS[data.business_type]}`
        : 'BENCHMARKS GERAIS:\nLTV/CAC > 3x | ROAS > 3x | Reembolso < 5%';

    const channelLines = data.channel_economics
        .filter(c => c.channel !== 'desconhecido')
        .map(c =>
            `  ${c.channel}: status=${c.status} | ${c.new_customers} clientes | LTV ${fmtBrl(c.avg_ltv)} | CAC ${c.cac > 0 ? fmtBrl(c.cac) : 'orgânico'} | LTV/CAC ${c.ltv_cac_ratio ? fmt(c.ltv_cac_ratio) : '-'}`,
        )
        .join('\n');

    return `Você é um CFO/CMO sênior especialista em negócios digitais brasileiros.

Você recebeu os dados do período atual e uma análise histórica preparada por um analista quantitativo.
Sua tarefa é formular diagnósticos precisos, com causa raiz fundamentada em evidência histórica quando disponível.

${benchmark}

=== DADOS DO PERÍODO ATUAL ===
Período: ${data.period.start} a ${data.period.end} (${data.period.days} dias)
Receita líquida: ${fmtBrl(data.summary.revenue_net)} | Variação: ${data.summary.revenue_change_pct !== null ? `${fmt(data.summary.revenue_change_pct)}%` : 'sem histórico'}
ROAS: ${fmt(data.summary.roas)}x | Ad spend: ${fmtBrl(data.summary.ad_spend)}
Novos clientes: ${data.summary.new_customers} | LTV médio: ${fmtBrl(data.summary.ltv_avg)}
Taxa de reembolso: ${fmt(data.summary.refund_rate)}%
Clientes em risco de churn (>60%): ${data.at_risk_customers.length} | LTV em risco: ${fmtBrl(data.at_risk_customers.reduce((s, c) => s + (c.ltv ?? 0), 0))}

Canais:
${channelLines || '  - sem dados de canais'}

=== ANÁLISE HISTÓRICA DO ANALISTA DE DADOS ===
${analystFindings}

=== REGRAS PARA O DIAGNÓSTICO ===
- Quando o analista identificou tendência histórica, use-a para fundamentar a causa raiz
  (ex: "CAC subiu +65% em 3 meses segundo histórico" em vez de "CAC está alto")
- Calcule o impacto financeiro com base nos dados reais, não estimativas genéricas
- Ignore canais "desconhecido" no diagnóstico
- Priorize por severidade real: "critica" = impacto imediato e alto, não apenas "poderia melhorar"
- O resumo_executivo deve mencionar tendência histórica quando disponível
- proximos_passos devem ser ações concretas ordenadas por impacto financeiro

Responda SOMENTE com JSON válido, sem markdown, sem texto extra:
{
  "situacao_geral": "saudavel" | "atencao" | "critica",
  "resumo_executivo": "2-3 frases com contexto histórico quando disponível",
  "diagnosticos": [
    {
      "canal": "nome do canal ou situação (ex: meta_ads, base_em_risco, reembolsos)",
      "severidade": "critica" | "alta" | "media" | "ok",
      "sintoma": "o que os números mostram — objetivo, com dados históricos quando disponível",
      "causa_raiz": "hipótese fundamentada nos dados cruzados e no histórico",
      "consequencia": "impacto no negócio se não resolver",
      "consequencia_financeira_brl": 0,
      "acao_recomendada": "ação específica e executável",
      "prazo": "imediato" | "esta_semana" | "este_mes"
    }
  ],
  "proximos_passos": ["ação priorizada 1", "ação priorizada 2", "ação priorizada 3"]
}`;
}

// ── Parser ────────────────────────────────────────────────────────────────────

const VALID_SITUACAO  = ['saudavel', 'atencao', 'critica'] as const;
const VALID_SEV       = ['critica', 'alta', 'media', 'ok'] as const;
const VALID_PRAZO     = ['imediato', 'esta_semana', 'este_mes'] as const;

function parseOutput(raw: string): Omit<ReportAIAnalysis, 'generated_at' | 'model'> {
    const cleaned = raw
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/, '')
        .trim();

    const parsed = JSON.parse(cleaned);

    const diagnosticos: ChannelDiagnosis[] = Array.isArray(parsed.diagnosticos)
        ? parsed.diagnosticos
            .filter((d: unknown) => d && typeof d === 'object')
            .map((d: Record<string, unknown>) => ({
                canal:                      String(d.canal ?? ''),
                severidade:                 VALID_SEV.includes(d.severidade as typeof VALID_SEV[number]) ? d.severidade as ChannelDiagnosis['severidade'] : 'media',
                sintoma:                    String(d.sintoma ?? ''),
                causa_raiz:                 String(d.causa_raiz ?? ''),
                consequencia:               String(d.consequencia ?? ''),
                consequencia_financeira_brl: Math.max(0, Number(d.consequencia_financeira_brl ?? 0)),
                acao_recomendada:           String(d.acao_recomendada ?? ''),
                prazo:                      VALID_PRAZO.includes(d.prazo as typeof VALID_PRAZO[number]) ? d.prazo as ChannelDiagnosis['prazo'] : 'este_mes',
            }))
        : [];

    return {
        situacao_geral:   VALID_SITUACAO.includes(parsed.situacao_geral) ? parsed.situacao_geral : 'atencao',
        resumo_executivo: String(parsed.resumo_executivo ?? ''),
        diagnosticos,
        proximos_passos:  Array.isArray(parsed.proximos_passos) ? parsed.proximos_passos.map(String) : [],
    };
}

// ── Agent 2 ───────────────────────────────────────────────────────────────────

export async function runStrategistAgent(
    anthropic: Anthropic,
    data: ReportData,
    analystFindings: string,
): Promise<Omit<ReportAIAnalysis, 'generated_at' | 'model'>> {
    const response = await (anthropic.messages.create as Function)({
        model: 'claude-opus-4-6',
        max_tokens: 16000,
        thinking: { type: 'enabled', budget_tokens: 10000 },
        system: 'Você é um CFO/CMO sênior especialista em negócios digitais brasileiros. Analise dados cruzados e diagnostique com precisão clínica. Responda SOMENTE com JSON válido.',
        messages: [{ role: 'user', content: buildPrompt(data, analystFindings) }],
    });

    // Filtra blocos de thinking — só nos interessa o texto final
    const textBlock = response.content.find((b: { type: string }) => b.type === 'text');
    const raw = textBlock && textBlock.type === 'text' ? textBlock.text : '';

    return parseOutput(raw);
}
