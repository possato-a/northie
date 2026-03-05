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
    pageContext?: string;
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
    history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export async function generateAIResponse(message: string, context: ChatContext) {
    console.log(`[AI] Generating real response for profile ${context.profileId}`);

    const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

    const channelLines = context.channelBreakdown.length > 0
        ? context.channelBreakdown.map(c => `— ${c.channel}: ${c.customers} clientes | LTV médio R$ ${fmt(c.avg_ltv)} | receita R$ ${fmt(c.revenue)}`).join('\n')
        : '— Sem dados de canal disponíveis ainda';

    const rfm = context.rfmSegments;

    const systemPrompt = `Você é a Northie AI — a inteligência financeira e estratégica do sistema Northie, infraestrutura de receita para founders de negócios digitais.

IDENTIDADE:
Você conhece este negócio de dentro. Tem acesso às transações reais, à base de clientes com score RFM, aos gastos por canal de ads e aos sinais do motor de correlações. Você não é um chatbot genérico — é o analista mais afiado que esse founder tem.

DADOS REAIS DO NEGÓCIO (perfil ${context.profileId}):
— Receita total acumulada: R$ ${fmt(context.stats.total_revenue)}
— Receita últimos 30 dias: R$ ${fmt(context.stats.revenue_30d)} (${context.stats.transactions_30d} transações | ticket médio R$ ${fmt(context.stats.avg_ticket)})
— Base total: ${context.stats.total_customers} clientes | ${context.stats.total_transactions} transações aprovadas

SEGMENTAÇÃO RFM (baseada em score real):
— Champions: ${rfm.Champions.count} clientes | LTV médio R$ ${fmt(rfm.Champions.avg_ltv)}
— Em Risco: ${rfm['Em Risco'].count} clientes | LTV médio R$ ${fmt(rfm['Em Risco'].avg_ltv)}
— Novos Promissores: ${rfm['Novos Promissores'].count} clientes | LTV médio R$ ${fmt(rfm['Novos Promissores'].avg_ltv)}
— Inativos: ${rfm.Inativos.count} clientes | LTV médio R$ ${fmt(rfm.Inativos.avg_ltv)}

CANAIS DE AQUISIÇÃO (por LTV médio):
${channelLines}

MOTOR DE GROWTH: ${context.pendingGrowthRecs} ações identificadas aguardando aprovação na página Northie Growth.

CONTEXTO ATUAL DA INTERFACE: ${context.pageContext || 'Visão Geral'}

REGRAS DE RESPOSTA:
1. Você só comenta números que existem nos dados acima. Se não tiver dado, diga "não tenho esse dado disponível ainda" e explique o que precisaria.
2. Direto ao ponto. Máximo 3-4 parágrafos ou lista com bullets. Sem enrolação, sem disclaimers, sem "é importante considerar que...".
3. Cite os números específicos do negócio. "Seus 8 clientes Em Risco têm LTV médio de R$ 510" é infinitamente melhor que "você tem clientes em risco".
4. Se a pergunta puder virar uma ação de growth executável (reativar clientes, pausar campanha, sincronizar audience), mencione que o motor já identificou ações prontas para aprovação na página Growth.
5. Sempre termine com 1 próximo passo concreto e específico.
6. Responda SEMPRE em português brasileiro.`;

    // Montar mensagens com histórico + mensagem atual
    const messages: Array<{ role: 'user' | 'assistant'; content: string }> = [
        ...(context.history || []),
        { role: 'user', content: message },
    ];

    try {
        const response = await getAnthropic().messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 2048,
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

REGRAS:
1. Quando perguntado sobre uma recomendação, explique exatamente os dados que a geraram — cite os números específicos do meta da recomendação.
2. Se o founder quiser executar algo, ele precisa clicar em "Aprovar e executar" no card correspondente na tela. NUNCA execute ou simule execução via chat.
3. Se o founder perguntar "por que essa recomendação?" ou "como isso foi gerado?", use a ferramenta explain_correlation.
4. Se o founder perguntar sobre um segmento específico, use get_segment_preview.
5. Nunca use linguagem vaga. "Seus 12 clientes Champions têm LTV 3x acima da média" é correto. "Você tem clientes valiosos" não é aceitável.
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
