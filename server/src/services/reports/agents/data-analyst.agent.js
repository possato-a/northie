import { ANALYST_TOOLS, executeTool } from '../tools/report-tools.js';
const MAX_TOOL_ROUNDS = 5;
// ── Prompt ────────────────────────────────────────────────────────────────────
function buildPrompt(data) {
    const fmtBrl = (n) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    const fmt = (n, d = 2) => n.toLocaleString('pt-BR', { minimumFractionDigits: d, maximumFractionDigits: d });
    const channelLines = data.channel_economics
        .filter(c => c.channel !== 'desconhecido')
        .map(c => `  ${c.channel}: ${c.new_customers} clientes | LTV ${fmtBrl(c.avg_ltv)} | CAC ${c.cac > 0 ? fmtBrl(c.cac) : 'orgânico'} | LTV/CAC ${c.ltv_cac_ratio ? fmt(c.ltv_cac_ratio) : '-'} | ${c.status}`)
        .join('\n');
    return `Você é um analista quantitativo especializado em negócios digitais brasileiros.

Sua função é coletar dados históricos com as ferramentas disponíveis e identificar FATOS OBJETIVOS.
Não faça recomendações — apenas descreva o que os números mostram com precisão.

DADOS DO PERÍODO ATUAL:
- Período: ${data.period.start} a ${data.period.end} (${data.period.days} dias, ${data.period.frequency})
- Tipo de negócio: ${data.business_type ?? 'não informado'}
- Receita líquida: ${fmtBrl(data.summary.revenue_net)} (variação: ${data.summary.revenue_change_pct !== null ? `${fmt(data.summary.revenue_change_pct)}%` : 'sem histórico'})
- ROAS: ${fmt(data.summary.roas)}x | Ad spend: ${fmtBrl(data.summary.ad_spend)}
- Novos clientes: ${data.summary.new_customers} | LTV médio: ${fmtBrl(data.summary.ltv_avg)}
- Clientes em risco de churn (>60%): ${data.at_risk_customers.length}
- Taxa de reembolso: ${fmt(data.summary.refund_rate)}%
- Transações: ${data.summary.transactions} | AOV: ${fmtBrl(data.summary.aov)}

CANAIS DO PERÍODO:
${channelLines || '  - sem dados de canais no período'}

INSTRUÇÕES:
1. Chame get_historical_snapshots para ver a evolução de receita/ROAS/situação nos últimos meses
2. Chame calculate_channel_cac_trend para identificar deterioração ou melhora de CAC por canal
3. Chame get_churn_risk_by_channel para mapear onde está concentrado o risco de churn
4. Opcionalmente, chame get_cohort_repeat_purchase se precisar entender retenção por canal

Após coletar os dados, escreva um relatório de findings estruturado com estas seções:

## TENDÊNCIA HISTÓRICA
Quantos meses de dados disponíveis. Como evoluiu a receita, ROAS e situação geral.
Se não há histórico, declare explicitamente.

## CAC POR CANAL
Evolução mês a mês do CAC por canal. Identifique aceleração de deterioração (ex: "CAC do meta_ads subiu +65% em 3 meses, de R$120 para R$198").

## RISCO DE CHURN E BASE
Distribuição de risco por canal. Total de LTV em risco. Qual canal concentra mais clientes de alto risco.

## RETENÇÃO E RECOMPRA
Taxa de recompra por canal e cohort. Quais canais geram clientes que voltam a comprar.

## ANOMALIAS
O que destoa do padrão histórico neste período (ex: queda brusca, spike inesperado).

Use números reais dos dados coletados. Seja específico e direto.`;
}
// ── Agent 1 ───────────────────────────────────────────────────────────────────
export async function runDataAnalystAgent(anthropic, data, profileId) {
    const messages = [
        { role: 'user', content: buildPrompt(data) },
    ];
    for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const response = await anthropic.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 4000,
            tools: ANALYST_TOOLS,
            messages,
        });
        messages.push({ role: 'assistant', content: response.content });
        if (response.stop_reason === 'end_turn') {
            const textBlock = response.content.find(b => b.type === 'text');
            return textBlock && textBlock.type === 'text' ? textBlock.text : '';
        }
        if (response.stop_reason === 'tool_use') {
            const toolResults = [];
            for (const block of response.content) {
                if (block.type === 'tool_use') {
                    const result = await executeTool(block.name, block.input, profileId);
                    toolResults.push({
                        type: 'tool_result',
                        tool_use_id: block.id,
                        content: JSON.stringify(result),
                    });
                }
            }
            messages.push({ role: 'user', content: toolResults });
        }
    }
    // Força resposta final se atingiu o limite de rounds
    const finalResponse = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 3000,
        messages,
    });
    const textBlock = finalResponse.content.find(b => b.type === 'text');
    return textBlock && textBlock.type === 'text'
        ? textBlock.text
        : 'Sem dados históricos suficientes para análise.';
}
//# sourceMappingURL=data-analyst.agent.js.map