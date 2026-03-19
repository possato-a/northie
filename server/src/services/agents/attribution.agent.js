import Anthropic from '@anthropic-ai/sdk';
// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 30_000;
const SYSTEM_PROMPT = `Você é um especialista em atribuição de marketing. Analise a jornada real de compra cruzando dados de visitas, UTMs e transações. Identifique: (1) quais canais geraram vendas rastreadas vs não rastreadas, (2) discrepâncias entre ROAS reportado pelos Ads e receita real atribuída, (3) canais com melhor LTV real dos clientes adquiridos. Responda APENAS em JSON válido com exatamente este schema:
{
  "atribuicao_por_canal": [{"canal": string, "vendas_atribuidas": number, "receita_atribuida_brl": number, "ltv_medio_canal": number, "roas_real": number}],
  "vendas_sem_atribuicao_pct": number,
  "melhor_canal_por_ltv": string,
  "resumo": string
}`;
// ─── Agent ────────────────────────────────────────────────────────────────────
export async function runAttributionAgent(client, attributionData, trafficContext, conversionContext) {
    const userContent = `<dados_atribuicao>
${JSON.stringify(attributionData, null, 2)}
</dados_atribuicao>

<contexto_trafego>
${JSON.stringify(trafficContext, null, 2)}
</contexto_trafego>

<contexto_conversao>
${JSON.stringify(conversionContext, null, 2)}
</contexto_conversao>

Analise os dados de atribuição cruzando com os contextos de tráfego e conversão e retorne o JSON de diagnóstico de atribuição.`;
    const callApi = () => client.messages
        .create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userContent }],
    })
        .then((res) => {
        const block = res.content[0];
        if (!block || block.type !== 'text') {
            throw new Error('[AttributionAgent] Resposta inesperada da API Anthropic');
        }
        return block.text;
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('[AttributionAgent] Timeout após 30s')), TIMEOUT_MS));
    let rawText;
    try {
        rawText = await Promise.race([callApi(), timeout]);
    }
    catch (err) {
        throw new Error(`[AttributionAgent] Falha na chamada à API: ${err instanceof Error ? err.message : String(err)}`);
    }
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('[AttributionAgent] JSON não encontrado na resposta do agente');
    }
    try {
        return JSON.parse(match[0]);
    }
    catch {
        throw new Error(`[AttributionAgent] Falha ao parsear JSON: ${match[0].slice(0, 120)}`);
    }
}
//# sourceMappingURL=attribution.agent.js.map