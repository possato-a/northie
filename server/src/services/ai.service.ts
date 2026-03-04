import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
});

console.log('[AI] Anthropic SDK initialized. Key present:', !!process.env.ANTHROPIC_API_KEY);
if (process.env.ANTHROPIC_API_KEY) {
    console.log('[AI] Key starts with:', process.env.ANTHROPIC_API_KEY.substring(0, 10));
}

export interface ChatContext {
    profileId: string;
    stats?: any;
    attribution?: any;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function generateAIResponse(message: string, context: ChatContext) {
    console.log(`[AI] Generating real response for profile ${context.profileId}`);

    // 1. Build System Prompt with Context
    const systemPrompt = `
You are Northie, a highly strategic and elite business AI for founders and CEOs.
Your goal is to provide blunt, data-driven, and actionable insights based on the workspace stats.
Always respond in Brazilian Portuguese (pt-BR).

Current workspace data for Profile ID ${context.profileId}:
- Total Approved Revenue: R$ ${(context.stats?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Total Customers: ${context.stats?.total_customers}
- Channel Attribution (Last Click): ${JSON.stringify(context.attribution)}

Rules:
1. If revenue is low, suggest aggressive scaling elsewhere or cost cutting.
2. If one channel dominates (e.g. Meta Ads), remind them about platform risk.
3. Be professional but direct. No fluff.
4. Use Markdown for formatting.
5. Maintain continuity — you have access to the recent conversation history.
    `.trim();

    // 2. Montar mensagens com histórico + mensagem atual
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...(context.history || []),
        { role: 'user', content: message },
    ];

    try {
        const response = await anthropic.messages.create({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 1024,
            system: systemPrompt,
            messages,
        });

        const content = response.content[0];
        if (content?.type === 'text') {
            return {
                role: 'assistant',
                content: content.text,
                model: response.model
            };
        }

        throw new Error('Unexpected response format from Claude');
    } catch (error: any) {
        console.error('--- Anthropic API Error Detail ---');
        if (error.status) console.error('Status:', error.status);
        if (error.error) console.error('Error Body:', JSON.stringify(error.error, null, 2));
        console.error('Message:', error.message);
        console.error('---------------------------------');

        return {
            role: 'assistant',
            content: 'Desculpe, tive um problema ao processar seu pedido agora. Verifique se minha chave API está ativa no servidor.',
            model: 'error'
        };
    }
}
