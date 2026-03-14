import { getAgentContext } from '../services/agentDataService.js';
import { buildSystemPrompt, callClaudeAgent } from '../services/agentService.js';
const VALID_AGENT_IDS = ['roas', 'churn', 'ltv', 'audience', 'upsell'];
function isValidAgentId(value) {
    return typeof value === 'string' && VALID_AGENT_IDS.includes(value);
}
export async function chatWithAgent(req, res) {
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
//# sourceMappingURL=agents.controller.js.map