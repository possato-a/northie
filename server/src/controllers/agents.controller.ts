import type { Request, Response } from 'express';
import { getAgentContext } from '../services/agentDataService.js';
import { buildSystemPrompt, callClaudeAgent } from '../services/agentService.js';

const VALID_AGENT_IDS = ['roas', 'churn', 'ltv', 'audience', 'upsell'] as const;
type AgentId = typeof VALID_AGENT_IDS[number];

function isValidAgentId(value: unknown): value is AgentId {
    return typeof value === 'string' && (VALID_AGENT_IDS as readonly string[]).includes(value);
}

export async function chatWithAgent(req: Request, res: Response): Promise<void> {
    const { agentId, message, conversationHistory } = req.body;

    if (!isValidAgentId(agentId)) {
        res.status(400).json({ error: `agentId inválido. Valores aceitos: ${VALID_AGENT_IDS.join(', ')}` });
        return;
    }

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
        res.status(400).json({ error: 'message é obrigatório e deve ser uma string não vazia.' });
        return;
    }

    if (conversationHistory !== undefined && !Array.isArray(conversationHistory)) {
        res.status(400).json({ error: 'conversationHistory deve ser um array.' });
        return;
    }

    const userId = req.headers['x-profile-id'] as string;

    try {
        const dataContext = await getAgentContext(userId, agentId);
        const systemPrompt = buildSystemPrompt(agentId, dataContext);

        const history: Array<{ role: 'user' | 'assistant'; content: string }> = Array.isArray(conversationHistory)
            ? conversationHistory
            : [];

        const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
            ...history,
            { role: 'user', content: message },
        ];

        const reply = await callClaudeAgent(systemPrompt, messages);

        res.json({ reply });
    } catch (err: any) {
        console.error('[Agents] chatWithAgent error:', err.message || err);
        res.status(500).json({ error: 'Falha ao processar mensagem do agente. Tente novamente.' });
    }
}
