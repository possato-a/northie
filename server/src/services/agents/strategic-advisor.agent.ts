import Anthropic from '@anthropic-ai/sdk';
import type { TrafficAnalysis } from './traffic-analyst.agent.js';
import type { ConversionAnalysis } from './conversion-analyst.agent.js';
import type { AttributionAnalysis } from './attribution.agent.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GrowthDiagnostic {
    status_geral: 'otimo' | 'bom' | 'atencao' | 'critico';
    pontos_positivos: Array<{
        titulo: string;
        descricao: string;
        impacto_brl: number;
    }>;
    diagnosticos: Array<{
        canal: string;
        severidade: 'critica' | 'alta' | 'media' | 'ok';
        sintoma: string;
        causa_raiz: string;
        consequencia: string;
        acao_recomendada: string;
        consequencia_financeira_brl: number;
        prazo: 'Imediato' | 'Esta semana' | 'Este mês';
    }>;
    proximos_passos: Array<{
        ordem: number;
        acao: string;
        impacto_estimado_brl: number;
        prazo: string;
    }>;
    resumo_executivo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 2000;
const TIMEOUT_MS = 30_000;

const SYSTEM_PROMPT = `Você é o consultor estratégico da Northie, plataforma de inteligência financeira para founders digitais brasileiros. Receba os diagnósticos dos agentes de tráfego, conversão e atribuição e sintetize em um diagnóstico executivo acionável. Estruture em: (1) O que está funcionando, (2) Problemas críticos identificados, (3) Plano de ação priorizado por impacto financeiro estimado. Seja específico, quantitativo e direto. Evite generalidades. Responda APENAS em JSON válido com exatamente este schema:
{
  "status_geral": "otimo" | "bom" | "atencao" | "critico",
  "pontos_positivos": [{"titulo": string, "descricao": string, "impacto_brl": number}],
  "diagnosticos": [{"canal": string, "severidade": "critica" | "alta" | "media" | "ok", "sintoma": string, "causa_raiz": string, "consequencia": string, "acao_recomendada": string, "consequencia_financeira_brl": number, "prazo": "Imediato" | "Esta semana" | "Este mês"}],
  "proximos_passos": [{"ordem": number, "acao": string, "impacto_estimado_brl": number, "prazo": string}],
  "resumo_executivo": string
}`;

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runStrategicAdvisor(
    client: Anthropic,
    businessType: string,
    trafficAnalysis: TrafficAnalysis,
    conversionAnalysis: ConversionAnalysis,
    attributionAnalysis: AttributionAnalysis,
): Promise<GrowthDiagnostic> {
    const userContent = `<perfil_founder>
tipo_negocio: ${businessType}
</perfil_founder>

<diagnostico_trafego>
${JSON.stringify(trafficAnalysis, null, 2)}
</diagnostico_trafego>

<diagnostico_conversao>
${JSON.stringify(conversionAnalysis, null, 2)}
</diagnostico_conversao>

<diagnostico_atribuicao>
${JSON.stringify(attributionAnalysis, null, 2)}
</diagnostico_atribuicao>

Com base nos três diagnósticos e no perfil do founder, gere o diagnóstico estratégico executivo completo em JSON.`;

    const callApi = (): Promise<string> =>
        client.messages
            .create({
                model: MODEL,
                max_tokens: MAX_TOKENS,
                system: SYSTEM_PROMPT,
                messages: [{ role: 'user', content: userContent }],
            })
            .then((res) => {
                const block = res.content[0];
                if (!block || block.type !== 'text') {
                    throw new Error('[StrategicAdvisorAgent] Resposta inesperada da API Anthropic');
                }
                return block.text;
            });

    const timeout = new Promise<never>((_, reject) =>
        setTimeout(
            () => reject(new Error('[StrategicAdvisorAgent] Timeout após 30s')),
            TIMEOUT_MS,
        ),
    );

    let rawText: string;
    try {
        rawText = await Promise.race([callApi(), timeout]);
    } catch (err: unknown) {
        throw new Error(
            `[StrategicAdvisorAgent] Falha na chamada à API: ${err instanceof Error ? err.message : String(err)}`,
        );
    }

    const match = rawText.match(/\{[\s\S]*\}/);
    if (!match) {
        throw new Error('[StrategicAdvisorAgent] JSON não encontrado na resposta do agente');
    }

    try {
        return JSON.parse(match[0]) as GrowthDiagnostic;
    } catch {
        throw new Error(
            `[StrategicAdvisorAgent] Falha ao parsear JSON: ${match[0].slice(0, 120)}`,
        );
    }
}
