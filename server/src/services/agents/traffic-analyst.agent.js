import Anthropic from '@anthropic-ai/sdk';
// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 30_000;
const SYSTEM_PROMPT = `Você é um especialista em tráfego pago com foco em Meta Ads e Google Ads. Analise os dados de performance de campanhas fornecidos e identifique: (1) campanhas com CPC acima da média do período, (2) campanhas com CTR abaixo de 1%, (3) campanhas com ROAS abaixo de 1.5x, (4) distribuição de budget entre plataformas. Seja direto e quantitativo. Responda APENAS em JSON válido com exatamente este schema:
{
  "cpc_medio": number,
  "ctr_medio": number,
  "campanhas_problema": [{"campaign_id": string, "platform": string, "problema": string, "impacto_brl": number}],
  "melhor_canal": string,
  "resumo": string
}`;
// ─── Agent ────────────────────────────────────────────────────────────────────
export async function runTrafficAnalyst(client, metrics) {
    const userContent = `<dados_ad_metrics>
${JSON.stringify(metrics, null, 2)}
</dados_ad_metrics>

Analise os dados acima e retorne o JSON de diagnóstico de tráfego.`;
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
            throw new Error('[TrafficAnalystAgent] Resposta inesperada da API Anthropic');
        }
        return block.text;
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('[TrafficAnalystAgent] Timeout após 30s')), TIMEOUT_MS));
    let rawText;
    try {
        rawText = await Promise.race([callApi(), timeout]);
    }
    catch (err) {
        throw new Error(`[TrafficAnalystAgent] Falha na chamada à API: ${err instanceof Error ? err.message : String(err)}`);
    }
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('[TrafficAnalystAgent] JSON não encontrado na resposta do agente');
    }
    try {
        return JSON.parse(match[0]);
    }
    catch {
        throw new Error(`[TrafficAnalystAgent] Falha ao parsear JSON: ${match[0].slice(0, 120)}`);
    }
}
//# sourceMappingURL=traffic-analyst.agent.js.map