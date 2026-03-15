import type { Request, Response } from 'express';
import { getAgentContext } from '../services/agentDataService.js';
import { buildSystemPrompt, callClaudeAgent } from '../services/agentService.js';
import { AGENT_DEFINITIONS } from '../agents/agentDefinitions.js';
import type { AgentId } from '../agents/agentDefinitions.js';

function isValidAgentId(value: unknown): value is AgentId {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AGENT_DEFINITIONS, value);
}

export async function chatWithAgent(req: Request, res: Response): Promise<void> {
    const { agentId, message, conversationHistory } = req.body;

    if (!isValidAgentId(agentId)) {
        const validIds = Object.keys(AGENT_DEFINITIONS).join(', ');
        res.status(400).json({ error: `agentId inválido. Valores aceitos: ${validIds}` });
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

export function listAgents(req: Request, res: Response): void {
    const agents = Object.values(AGENT_DEFINITIONS).map((agent) => ({
        id: agent.id,
        name: agent.name,
        group: agent.group,

        sources: agent.sources,
        quickSuggestions: agent.quickSuggestions,
    }));

    res.json({ agents });
}
