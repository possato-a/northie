import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

dotenv.config();

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
        const response = await getAnthropic().messages.create({
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

export interface GrowthChatContext {
    profileId: string;
    businessStats?: {
        total_revenue: number;
        avg_ltv: number;
        avg_churn: number;
        active_channels: string[];
    };
    pendingRecs?: Array<{
        id: string;
        type: string;
        title: string;
        narrative: string;
        impact_estimate: string;
        meta: any;
    }>;
    recentRecs?: Array<{
        id: string;
        type: string;
        title: string;
        status: string;
    }>;
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function generateGrowthAIResponse(message: string, context: GrowthChatContext) {
    console.log(`[AI] Generating Growth response for profile ${context.profileId}`);

    const pendingRecsText = (context.pendingRecs || []).map(r =>
        `- [${r.type}] "${r.title}"\n  Narrativa: ${r.narrative}\n  Impacto: ${r.impact_estimate}`
    ).join('\n') || 'Nenhuma recomendação pendente no momento.';

    const recentRecsText = (context.recentRecs || []).map(r =>
        `- [${r.status}] "${r.title}"`
    ).join('\n') || 'Nenhuma ação recente.';

    const systemPrompt = `
Você é Northie Growth, o motor de crescimento inteligente da Northie.
Responda sempre em português brasileiro (pt-BR). Seja direto, estratégico e baseado em dados.
Use Markdown para formatar a resposta quando útil.

DADOS DO WORKSPACE:
- Receita total: R$ ${(context.businessStats?.total_revenue || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- LTV médio: R$ ${(context.businessStats?.avg_ltv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
- Churn médio: ${((context.businessStats?.avg_churn || 0) * 100).toFixed(1)}%
- Canais ativos: ${(context.businessStats?.active_channels || []).join(', ') || 'Nenhum'}

RECOMENDAÇÕES PENDENTES:
${pendingRecsText}

AÇÕES RECENTES:
${recentRecsText}

REGRA CRÍTICA: NUNCA sugira ou execute qualquer ação de marketing sem que o founder confirme explicitamente
clicando no botão "Aprovar" no card de recomendação. Você pode explicar, detalhar e recomendar — mas
a execução sempre exige aprovação explícita. Se o founder pedir para executar algo, direcione-o ao card
correspondente na interface.
    `.trim();

    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...(context.history || []),
        { role: 'user', content: message },
    ];

    const tools = [
        {
            name: 'get_recommendation_detail',
            description: 'Retorna detalhes completos de uma recomendação de growth específica, incluindo métricas do segmento e dados de contexto.',
            input_schema: {
                type: 'object' as const,
                properties: {
                    recommendation_type: {
                        type: 'string',
                        enum: ['reativacao_alto_ltv', 'pausa_campanha_ltv_baixo', 'audience_sync_champions', 'realocacao_budget', 'upsell_cohort'],
                        description: 'Tipo da recomendação para detalhar',
                    },
                },
                required: ['recommendation_type'],
            },
        },
        {
            name: 'get_segment_preview',
            description: 'Retorna preview agregado (sem PII) do segmento de uma recomendação — quantidade, LTV médio, etc.',
            input_schema: {
                type: 'object' as const,
                properties: {
                    recommendation_type: {
                        type: 'string',
                        enum: ['reativacao_alto_ltv', 'pausa_campanha_ltv_baixo', 'audience_sync_champions', 'realocacao_budget', 'upsell_cohort'],
                    },
                    limit: { type: 'number', description: 'Máximo de registros no preview (default 10)' },
                },
                required: ['recommendation_type'],
            },
        },
        {
            name: 'explain_correlation',
            description: 'Explica em detalhes a correlação entre fontes de dados que gerou uma recomendação específica.',
            input_schema: {
                type: 'object' as const,
                properties: {
                    recommendation_type: {
                        type: 'string',
                        enum: ['reativacao_alto_ltv', 'pausa_campanha_ltv_baixo', 'audience_sync_champions', 'realocacao_budget', 'upsell_cohort'],
                    },
                },
                required: ['recommendation_type'],
            },
        },
    ];

    try {
        const response = await getAnthropic().messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
            system: systemPrompt,
            messages,
            tools,
        });

        // Handle tool use
        if (response.stop_reason === 'tool_use') {
            const toolUseBlock = response.content.find(b => b.type === 'tool_use');
            if (toolUseBlock && toolUseBlock.type === 'tool_use') {
                const toolInput = toolUseBlock.input as any;
                const recType = toolInput.recommendation_type;
                const matchingRec = (context.pendingRecs || []).find(r => r.type === recType);

                let toolResult = '';
                if (toolUseBlock.name === 'get_recommendation_detail') {
                    toolResult = matchingRec
                        ? `Detalhes de "${matchingRec.title}":\n${matchingRec.narrative}\nImpacto: ${matchingRec.impact_estimate}\nMeta: ${JSON.stringify(matchingRec.meta, null, 2)}`
                        : `Nenhuma recomendação ativa do tipo ${recType}.`;
                } else if (toolUseBlock.name === 'get_segment_preview') {
                    if (matchingRec?.meta) {
                        const m = matchingRec.meta;
                        toolResult = `Preview do segmento (${recType}):\n- Total: ${m.segment_count || m.champion_count || m.campaigns?.length || 'N/A'}\n- LTV médio: R$ ${(m.avg_ltv || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Fontes: ${matchingRec.impact_estimate}`;
                    } else {
                        toolResult = `Sem dados de segmento para ${recType}.`;
                    }
                } else if (toolUseBlock.name === 'explain_correlation') {
                    toolResult = matchingRec
                        ? `Correlação para "${matchingRec.title}":\nEssa recomendação cruzou as seguintes fontes: ${(matchingRec as any).sources?.join(', ') || 'N/A'}.\n${matchingRec.narrative}`
                        : `Nenhuma recomendação ativa do tipo ${recType}.`;
                }

                // Segunda chamada com resultado da tool
                const followUp = await getAnthropic().messages.create({
                    model: 'claude-sonnet-4-6',
                    max_tokens: 2048,
                    system: systemPrompt,
                    messages: [
                        ...messages,
                        { role: 'assistant', content: response.content },
                        {
                            role: 'user',
                            content: [{ type: 'tool_result', tool_use_id: toolUseBlock.id, content: toolResult }],
                        },
                    ] as any,
                });

                const followUpText = followUp.content.find(b => b.type === 'text');
                if (followUpText && followUpText.type === 'text') {
                    return { role: 'assistant', content: followUpText.text, model: followUp.model };
                }
            }
        }

        const content = response.content[0];
        if (content?.type === 'text') {
            return { role: 'assistant', content: content.text, model: response.model };
        }

        throw new Error('Unexpected response format');
    } catch (error: any) {
        console.error('[AI Growth] Error:', error.message);
        return {
            role: 'assistant',
            content: 'Desculpe, tive um problema ao processar sua pergunta. Tente novamente.',
            model: 'error',
        };
    }
}
