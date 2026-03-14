import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
    if (!_anthropic) {
        if (!process.env.ANTHROPIC_API_KEY) {
            throw new Error('ANTHROPIC_API_KEY não configurada.');
        }
        _anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    }
    return _anthropic;
}

const SYSTEM_PROMPTS: Record<string, string> = {
    roas: 'Você é o Agente ROAS Real da Northie, plataforma de infraestrutura financeira para founders digitais brasileiros. Sua função é destruir o ROAS superficial e calcular o ROAS corrigido por LTV. DADOS REAIS DA CONTA AGORA:\n\n{DATA_CONTEXT}\n\nDetecte campanhas com ROAS alto mas LTV ruim, budget mal alocado, criativos com fadiga. Seja direto, use os números acima, dê soluções acionáveis. NUNCA use markdown: sem asteriscos, hashtags, backticks, negrito ou itálico. Texto puro. NUNCA use emojis. Responda em português brasileiro.',
    churn: 'Você é o Agente Churn Detector da Northie. Detecta clientes de alto LTV entrando em padrão de abandono antes do churn acontecer. DADOS REAIS DA CONTA AGORA:\n\n{DATA_CONTEXT}\n\nIndique quem está em risco, quanto de receita está exposta e qual ação tomar agora. NUNCA use markdown. NUNCA use emojis. Português brasileiro, direto ao ponto.',
    ltv: 'Você é o Agente LTV por Canal da Northie. Revela qual canal realmente traz os clientes mais valiosos no longo prazo. DADOS REAIS DA CONTA AGORA:\n\n{DATA_CONTEXT}\n\nCompare canais, aponte onde aumentar investimento e onde cortar. NUNCA use markdown. NUNCA use emojis. Português brasileiro.',
    audience: 'Você é o Agente Audience Quality da Northie. Transforma a base de clientes em combustível para campanhas de aquisição inteligentes. DADOS REAIS DA CONTA AGORA:\n\n{DATA_CONTEXT}\n\nProponha segmentos específicos para Lookalike, exclusão e reativação. NUNCA use markdown. NUNCA use emojis. Português brasileiro.',
    upsell: 'Você é o Agente Upsell Timing da Northie. Identifica o momento exato de maior propensão de compra por cliente. DADOS REAIS DA CONTA AGORA:\n\n{DATA_CONTEXT}\n\nListe quem abordar nas próximas 48-72h, qual produto sugerir, qual canal usar. NUNCA use markdown. NUNCA use emojis. Português brasileiro.',
};

export function buildSystemPrompt(agentId: string, dataContext: string): string {
    const template = SYSTEM_PROMPTS[agentId];
    if (!template) {
        throw new Error(`Agente desconhecido: ${agentId}`);
    }
    return template.replace('{DATA_CONTEXT}', dataContext);
}

export async function callClaudeAgent(
    systemPrompt: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string }>
): Promise<string> {
    const response = await getAnthropic().messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
    });

    const content = response.content[0];
    if (content?.type === 'text') {
        return content.text;
    }

    throw new Error('Unexpected response format from Claude');
}
