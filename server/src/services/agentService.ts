import { AGENT_DEFINITIONS } from '../agents/agentDefinitions.js';
import type { AgentId } from '../agents/agentDefinitions.js';
import { getAnthropicClient } from '../lib/anthropic.js';

function getAnthropic() {
    return getAnthropicClient();
}

export function buildSystemPrompt(agentId: string, dataContext: string): string {
    const agent = AGENT_DEFINITIONS[agentId as AgentId];
    if (!agent) throw new Error(`Agente desconhecido: ${agentId}`);
    return agent.systemPrompt.replace('{DATA_CONTEXT}', dataContext);
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
