import { getAgentContext } from '../services/agentDataService.js';
import { buildSystemPrompt, callClaudeAgent } from '../services/agentService.js';
import { AGENT_DEFINITIONS } from '../agents/agentDefinitions.js';
function isValidAgentId(value) {
    return typeof value === 'string' && Object.prototype.hasOwnProperty.call(AGENT_DEFINITIONS, value);
}
export async function chatWithAgent(req, res) {
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
    const userId = req.headers['x-profile-id'];
    try {
        const dataContext = await getAgentContext(userId, agentId);
        const systemPrompt = buildSystemPrompt(agentId, dataContext);
        const history = Array.isArray(conversationHistory)
            ? conversationHistory
            : [];
        const messages = [
            ...history,
            { role: 'user', content: message },
        ];
        const reply = await callClaudeAgent(systemPrompt, messages);
        res.json({ reply });
    }
    catch (err) {
        console.error('[Agents] chatWithAgent error:', err.message || err);
        res.status(500).json({ error: 'Falha ao processar mensagem do agente. Tente novamente.' });
    }
}
export function listAgents(req, res) {
    const agents = Object.values(AGENT_DEFINITIONS).map((agent) => ({
        id: agent.id,
        name: agent.name,
        group: agent.group,
        sources: agent.sources,
        quickSuggestions: agent.quickSuggestions,
    }));
    res.json({ agents });
}
//# sourceMappingURL=agents.controller.js.map