import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../lib/anthropic.js';

function getAnthropic() {
    return getAnthropicClient();
}

export interface CustomerEntry {
    email: string;
    ltv: number;
    rfm: string;
    churn: number;
    channel: string;
    lastPurchase: string;
}

export interface ChatContext {
    profileId: string;
    pageContext?: string;
    model?: string;
    stats: {
        total_revenue: number;
        total_customers: number;
        total_transactions: number;
        avg_ticket: number;
        revenue_30d: number;
        transactions_30d: number;
    };
    rfmSegments: {
        Champions: { count: number; avg_ltv: number; revenue: number };
        'Em Risco': { count: number; avg_ltv: number; revenue: number };
        'Novos Promissores': { count: number; avg_ltv: number; revenue: number };
        Inativos: { count: number; avg_ltv: number; revenue: number };
    };
    channelBreakdown: Array<{ channel: string; customers: number; avg_ltv: number; revenue: number }>;
    pendingGrowthRecs: number;
    customerList?: CustomerEntry[];
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const MODEL_MAP: Record<string, string> = {
    sonnet: 'claude-sonnet-4-6',
    opus: 'claude-opus-4-6',
    haiku: 'claude-haiku-4-5-20251001',
};

export async function generateAIResponse(message: string, context: ChatContext) {
    const modelId = MODEL_MAP[context.model || 'sonnet'] ?? 'claude-sonnet-4-6';
    console.log(`[AI] Generating response for profile ${context.profileId} — model: ${modelId}`);

    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const channelLines = context.channelBreakdown.length > 0
        ? context.channelBreakdown.map(c => `— ${c.channel}: ${c.customers} clientes | LTV médio R$ ${fmt(c.avg_ltv)} | receita R$ ${fmt(c.revenue)}`).join('\n')
        : '— Sem dados de canal disponíveis ainda';

    const rfm = context.rfmSegments;

    const customerLines = (context.customerList || []).length > 0
        ? (context.customerList || []).map((c, i) =>
            `${i + 1}. ${c.email} | LTV R$ ${fmt(c.ltv)} | RFM ${c.rfm || 'N/A'} | Churn ${c.churn.toFixed(0)}% | ${c.channel} | última compra ${c.lastPurchase ? new Date(c.lastPurchase).toLocaleDateString('pt-BR') : 'N/A'}`
          ).join('\n')
        : '— Sem clientes cadastrados ainda';

    const systemPrompt = `Você é a Northie AI — a inteligência financeira e estratégica do sistema Northie, infraestrutura de receita para founders de negócios digitais.

IDENTIDADE:
Você conhece este negócio de dentro. Tem acesso às transações reais, à base de clientes com score RFM, aos gastos por canal de ads e aos sinais do motor de correlações. Você não é um chatbot genérico — é o analista mais afiado que esse founder tem.

DADOS REAIS DO NEGÓCIO:
— Receita total acumulada: R$ ${fmt(context.stats.total_revenue)}
— Receita últimos 30 dias: R$ ${fmt(context.stats.revenue_30d)} (${context.stats.transactions_30d} transações | ticket médio R$ ${fmt(context.stats.avg_ticket)})
— Base total: ${context.stats.total_customers} clientes | ${context.stats.total_transactions} transações aprovadas

SEGMENTAÇÃO RFM:
— Champions: ${rfm.Champions.count} clientes | LTV médio R$ ${fmt(rfm.Champions.avg_ltv)}
— Em Risco: ${rfm['Em Risco'].count} clientes | LTV médio R$ ${fmt(rfm['Em Risco'].avg_ltv)}
— Novos Promissores: ${rfm['Novos Promissores'].count} clientes | LTV médio R$ ${fmt(rfm['Novos Promissores'].avg_ltv)}
— Inativos: ${rfm.Inativos.count} clientes | LTV médio R$ ${fmt(rfm.Inativos.avg_ltv)}

CANAIS DE AQUISIÇÃO:
${channelLines}

MOTOR DE GROWTH: ${context.pendingGrowthRecs} ações identificadas aguardando aprovação na página Northie Growth.

LISTA DE CLIENTES (top ${(context.customerList || []).length} por LTV):
${customerLines}

CONTEXTO ATUAL: ${context.pageContext || 'Visão Geral'}

REGRAS INVIOLÁVEIS:
1. NUNCA use markdown: sem asteriscos, sem hashtags, sem backticks, sem traços como bullet points markdown, sem negrito, sem itálico. Resposta em texto puro simples.
2. NUNCA use emojis.
3. Só comenta números que existem nos dados acima. Se não tiver, diga "não tenho esse dado ainda".
4. Direto ao ponto. Máximo 4 parágrafos curtos. Sem enrolação, sem disclaimers.
5. Cite números específicos. "Seus 8 clientes Em Risco têm LTV médio de R$ 510" é o padrão mínimo.
6. Se a pergunta puder virar ação executável, mencione que há ações prontas na página Growth.
7. Termine com 1 próximo passo concreto.
8. Responda SEMPRE em português brasileiro.`;

    // Montar mensagens com histórico + mensagem atual
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...(context.history || []),
        { role: 'user', content: message },
    ];

    try {
        const response = await getAnthropic().messages.create({
            model: modelId,
            max_tokens: 2048,
            system: systemPrompt,
            messages,
        });

        const content = response.content[0];
        if (content?.type === 'text') {
            return {
                role: 'assistant',
                content: content.text,
                model: modelId
            };
        }

        throw new Error('Unexpected response format from Claude');
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[AI Chat] Erro:', msg);
        // Diagnóstico rápido da causa
        if (msg.includes('credit') || msg.includes('balance')) {
            console.error('[AI Chat] Causa: saldo Anthropic esgotado. Configure GROQ_API_KEY no servidor.');
        } else if (msg.includes('GROQ_API_KEY') || msg.includes('provider') || msg.includes('configurada')) {
            console.error('[AI Chat] Causa: nenhum provider de IA configurado. Adicione GROQ_API_KEY nas env vars.');
        }

        return {
            role: 'assistant',
            content: 'Desculpe, tive um problema ao processar sua pergunta.',
            model: 'error'
        };
    }
}

export interface GrowthChatContext {
    profileId: string;
    model?: string;
    businessStats?: {
        total_revenue: number;
        avg_ltv: number;
        avg_churn: number;
        active_channels: string[];
    };
    rfmSegments?: {
        Champions: number;
        'Em Risco': number;
        'Novos Promissores': number;
        Inativos: number;
    };
    channelPerformance?: Array<{
        channel: string;
        customers_acquired: number;
        avg_ltv_brl: number;
        total_spend_brl: number;
        true_roi: number | null;
    }>;
    pendingRecs?: Array<{
        id: string;
        type: string;
        title: string;
        narrative: string;
        impact_estimate: string;
        meta: Record<string, unknown>;
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
    const growthModelId = MODEL_MAP[context.model || 'sonnet'] ?? 'claude-sonnet-4-6';
    console.log(`[AI] Generating Growth response for profile ${context.profileId} — model: ${growthModelId}`);

    const pendingRecsText = (context.pendingRecs || []).map(r =>
        `- [${r.type}] "${r.title}"\n  Narrativa: ${r.narrative}\n  Impacto: ${r.impact_estimate}`
    ).join('\n') || 'Nenhuma recomendação pendente no momento.';

    const recentRecsText = (context.recentRecs || []).map(r =>
        `- [${r.status}] "${r.title}"`
    ).join('\n') || 'Nenhuma ação recente.';

    const fmtG = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    const rfm = context.rfmSegments;
    const channelPerfLines = (context.channelPerformance || []).length > 0
        ? (context.channelPerformance || []).map(c =>
            `— ${c.channel}: ${c.customers_acquired} clientes | LTV médio R$ ${fmtG(c.avg_ltv_brl)} | gasto R$ ${fmtG(c.total_spend_brl)} | ROI real ${c.true_roi != null ? c.true_roi.toFixed(2) + 'x' : 'N/A'}`
          ).join('\n')
        : '— Dados de performance por canal ainda não disponíveis';

    const systemPrompt = `Você é o Northie Growth — o motor de crescimento inteligente que cruza dados de múltiplas fontes para identificar e executar ações de alto impacto.

COMO VOCÊ OPERA:
Cada recomendação que você analisa foi gerada cruzando pelo menos 2 fontes de dados distintas (ex: LTV de clientes × gastos por canal, ou score RFM × histórico de transações). Você conhece exatamente o raciocínio por trás de cada uma.

DADOS DO WORKSPACE:
— Receita total: R$ ${fmtG(context.businessStats?.total_revenue || 0)}
— LTV médio: R$ ${fmtG(context.businessStats?.avg_ltv || 0)}
— Churn médio: ${((context.businessStats?.avg_churn || 0) * 100).toFixed(1)}%
— Canais ativos: ${(context.businessStats?.active_channels || []).join(', ') || 'Nenhum'}

SEGMENTOS RFM:
— Champions: ${rfm?.Champions ?? 0} clientes
— Em Risco: ${rfm?.['Em Risco'] ?? 0} clientes
— Novos Promissores: ${rfm?.['Novos Promissores'] ?? 0} clientes
— Inativos: ${rfm?.Inativos ?? 0} clientes

PERFORMANCE DE CANAIS:
${channelPerfLines}

RECOMENDAÇÕES PENDENTES (aguardando aprovação do founder):
${pendingRecsText}

AÇÕES RECENTES:
${recentRecsText}

REGRAS INVIOLÁVEIS:
1. NUNCA use markdown: sem asteriscos, sem hashtags, sem backticks, sem negrito, sem itálico, sem tabelas markdown. Resposta em texto puro.
2. NUNCA use emojis.
3. Quando perguntado sobre uma recomendação, explique os dados exatos que a geraram — cite números do meta da recomendação.
4. Se o founder quiser executar algo, ele precisa clicar em "Aprovar e executar" no card. NUNCA execute ou simule execução via chat.
5. Nunca use linguagem vaga. "Seus 12 clientes Champions têm LTV 3x acima da média" é correto. "Você tem clientes valiosos" não é.
6. Responda sempre em português brasileiro.`;

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
                        enum: ['reativacao_alto_ltv', 'pausa_campanha_ltv_baixo', 'audience_sync_champions', 'realocacao_budget', 'upsell_cohort', 'divergencia_roi_canal', 'queda_retencao_cohort', 'canal_alto_ltv_underinvested', 'cac_vs_ltv_deficit', 'em_risco_alto_valor'],
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
                        enum: ['reativacao_alto_ltv', 'pausa_campanha_ltv_baixo', 'audience_sync_champions', 'realocacao_budget', 'upsell_cohort', 'divergencia_roi_canal', 'queda_retencao_cohort', 'canal_alto_ltv_underinvested', 'cac_vs_ltv_deficit', 'em_risco_alto_valor'],
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
                        enum: ['reativacao_alto_ltv', 'pausa_campanha_ltv_baixo', 'audience_sync_champions', 'realocacao_budget', 'upsell_cohort', 'divergencia_roi_canal', 'queda_retencao_cohort', 'canal_alto_ltv_underinvested', 'cac_vs_ltv_deficit', 'em_risco_alto_valor'],
                    },
                },
                required: ['recommendation_type'],
            },
        },
    ];

    try {
        const response = await getAnthropic().messages.create({
            model: growthModelId,
            max_tokens: 2048,
            system: systemPrompt,
            messages,
            tools,
        });

        // Handle tool use
        if (response.stop_reason === 'tool_use') {
            const toolUseBlock = response.content.find(b => b.type === 'tool_use');
            if (toolUseBlock && toolUseBlock.type === 'tool_use') {
                const toolInput = toolUseBlock.input as Record<string, unknown>;
                const recType = toolInput.recommendation_type as string;
                const matchingRec = (context.pendingRecs || []).find(r => r.type === recType);

                let toolResult = '';
                if (toolUseBlock.name === 'get_recommendation_detail') {
                    toolResult = matchingRec
                        ? `Detalhes de "${matchingRec.title}":\n${matchingRec.narrative}\nImpacto: ${matchingRec.impact_estimate}\nMeta: ${JSON.stringify(matchingRec.meta, null, 2)}`
                        : `Nenhuma recomendação ativa do tipo ${recType}.`;
                } else if (toolUseBlock.name === 'get_segment_preview') {
                    if (matchingRec?.meta) {
                        const m = matchingRec.meta;
                        const campaignsArr = Array.isArray(m.campaigns) ? m.campaigns : [];
                        const total = m.segment_count || m.champion_count || campaignsArr.length || 'N/A';
                        const avgLtv = Number(m.avg_ltv || 0);
                        toolResult = `Preview do segmento (${recType}):\n- Total: ${total}\n- LTV médio: R$ ${avgLtv.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}\n- Fontes: ${matchingRec.impact_estimate}`;
                    } else {
                        toolResult = `Sem dados de segmento para ${recType}.`;
                    }
                } else if (toolUseBlock.name === 'explain_correlation') {
                    toolResult = matchingRec
                        ? `Correlação para "${matchingRec.title}":\nEssa recomendação cruzou as seguintes fontes: ${(Array.isArray(matchingRec.meta?.sources) ? (matchingRec.meta.sources as string[]).join(', ') : 'N/A')}.\n${matchingRec.narrative}`
                        : `Nenhuma recomendação ativa do tipo ${recType}.`;
                }

                // Segunda chamada com resultado da tool
                const followUp = await getAnthropic().messages.create({
                    model: growthModelId,
                    max_tokens: 2048,
                    system: systemPrompt,
                    messages: [
                        ...messages,
                        { role: 'assistant' as const, content: response.content },
                        {
                            role: 'user' as const,
                            content: [{ type: 'tool_result' as const, tool_use_id: toolUseBlock.id, content: toolResult }],
                        },
                    ] as Anthropic.MessageParam[],
                });

                const followUpText = followUp.content.find(b => b.type === 'text');
                if (followUpText && followUpText.type === 'text') {
                    return { role: 'assistant', content: followUpText.text, model: growthModelId };
                }
            }
        }

        const content = response.content[0];
        if (content?.type === 'text') {
            return { role: 'assistant', content: content.text, model: growthModelId };
        }

        throw new Error('Unexpected response format');
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error('[AI Growth] Erro:', msg);
        if (msg.includes('credit') || msg.includes('balance')) {
            console.error('[AI Growth] Causa: saldo Anthropic esgotado. Configure GROQ_API_KEY nas env vars.');
        }
        return {
            role: 'assistant',
            content: 'Desculpe, tive um problema ao processar sua pergunta. Tente novamente.',
            model: 'error',
        };
    }
}
