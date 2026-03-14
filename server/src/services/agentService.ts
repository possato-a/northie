import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';
import { AGENT_DEFINITIONS } from '../agents/agentDefinitions.js';
import type { AgentId } from '../agents/agentDefinitions.js';

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
