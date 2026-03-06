import Anthropic from '@anthropic-ai/sdk';
// ─── Constants ────────────────────────────────────────────────────────────────
const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 30_000;
const SYSTEM_PROMPT = `Você é um especialista em conversão e métricas financeiras de negócios digitais brasileiros. Analise os dados de transações fornecidos e identifique: (1) taxa de aprovação por plataforma (aprovadas/total), (2) LTV médio por cliente, (3) ticket médio, (4) concentração de receita por produto ou canal. Considere o contexto de tráfego fornecido para cruzar com os dados de conversão. Responda APENAS em JSON válido com exatamente este schema:
{
  "taxa_aprovacao": number,
  "ltv_medio": number,
  "ticket_medio": number,
  "receita_recorrente_pct": number,
  "alertas": [{"tipo": string, "descricao": string, "impacto_brl": number}],
  "resumo": string
}`;
// ─── Agent ────────────────────────────────────────────────────────────────────
export async function runConversionAnalyst(client, transactions, trafficContext) {
    const userContent = `<dados_transacoes>
${JSON.stringify(transactions, null, 2)}
</dados_transacoes>

<contexto_trafego>
${JSON.stringify(trafficContext, null, 2)}
</contexto_trafego>

Analise as transações cruzando com o contexto de tráfego e retorne o JSON de diagnóstico de conversão.`;
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
            throw new Error('[ConversionAnalystAgent] Resposta inesperada da API Anthropic');
        }
        return block.text;
    });
    const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error('[ConversionAnalystAgent] Timeout após 30s')), TIMEOUT_MS));
    let rawText;
    try {
        rawText = await Promise.race([callApi(), timeout]);
    }
    catch (err) {
        throw new Error(`[ConversionAnalystAgent] Falha na chamada à API: ${err instanceof Error ? err.message : String(err)}`);
    }
    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('[ConversionAnalystAgent] JSON não encontrado na resposta do agente');
    }
    try {
        return JSON.parse(match[0]);
    }
    catch {
        throw new Error(`[ConversionAnalystAgent] Falha ao parsear JSON: ${match[0].slice(0, 120)}`);
    }
}
//# sourceMappingURL=conversion-analyst.agent.js.map