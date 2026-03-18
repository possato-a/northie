/**
 * @file services/execution-agents/base.agent.ts
 *
 * Classe base para todos os agentes de execução do Growth Engine.
 * Cada agente de execução especializado estende esta classe.
 *
 * Responsabilidades:
 * - Carregar contexto de negócio e segmento de clientes
 * - Gerenciar o loop multi-turn de function calling com Claude
 * - Construir o plano de execução personalizado por cliente
 * - Executar itens e atualizar status no banco
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';
import { getAnthropicClient, ANTHROPIC_MODELS } from '../../lib/anthropic.js';

// ── Tipos públicos ────────────────────────────────────────────────────────────

export interface AgentSegmentItem {
    id: string;
    email: string;
    phone?: string;
    total_ltv: number;
    rfm_score?: string;
    churn_probability?: number;
    last_purchase_at?: string;
    acquisition_channel?: string;
    days_inactive?: number;
}

export interface CollaborationMessage {
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
}

export interface OpenSessionResult {
    opening_message: string;
    segment_snapshot: AgentSegmentItem[];
    draft_message?: string;
    customers_with_phone: number;
    customers_without_phone: number;
}

export interface ExecutionPlanItem {
    customer_id?: string;
    customer_email: string;
    customer_phone?: string;
    channel: 'whatsapp' | 'email';
    personalized_message: string;
}

// Representação de uma recomendação de growth (subconjunto relevante)
export interface GrowthRecommendation {
    id: string;
    type: string;
    title: string;
    narrative: string;
    impact_estimate: string;
    meta: Record<string, unknown>;
    status: string;
}

// ── Ferramentas base (function calling) ──────────────────────────────────────

const BASE_TOOLS: Anthropic.Tool[] = [
    {
        name: 'draft_message',
        description: 'Cria um rascunho de mensagem para o canal de execução baseado no perfil do segmento',
        input_schema: {
            type: 'object',
            properties: {
                tone: {
                    type: 'string',
                    enum: ['consultivo', 'direto', 'urgente', 'exclusivo'],
                    description: 'Tom da mensagem',
                },
                highlight: {
                    type: 'string',
                    description: 'Ponto principal a destacar (ex: LTV histórico, tempo de inatividade, oferta específica)',
                },
                include_name: {
                    type: 'boolean',
                    description: 'Se deve incluir {{nome}} do cliente',
                },
                max_chars: {
                    type: 'number',
                    description: 'Limite de caracteres (WhatsApp: 1024, Email: sem limite)',
                },
            },
            required: ['tone'],
        },
    },
    {
        name: 'preview_personalized',
        description: 'Mostra como a mensagem atual ficaria para 3 clientes específicos do segmento com personalização real',
        input_schema: {
            type: 'object',
            properties: {
                template: {
                    type: 'string',
                    description: 'Template da mensagem com {{nome}}, {{ltv}}, {{dias}} como placeholders',
                },
            },
            required: ['template'],
        },
    },
    {
        name: 'get_customer_insight',
        description: 'Busca detalhes adicionais de um cliente específico do segmento',
        input_schema: {
            type: 'object',
            properties: {
                customer_email: { type: 'string' },
            },
            required: ['customer_email'],
        },
    },
];

// ── Cliente Anthropic centralizado ───────────────────────────────────────────

function getAnthropic(): Anthropic {
    return getAnthropicClient();
}

// ── Classe base ───────────────────────────────────────────────────────────────

export abstract class BaseExecutionAgent {
    protected readonly agentType: string;
    protected readonly executionChannel: 'whatsapp' | 'email' | 'meta_ads' | 'manual';

    // Segmento em memória durante o ciclo de colaboração — populado em openSession
    protected currentSegment: AgentSegmentItem[] = [];

    constructor(
        agentType: string,
        executionChannel: 'whatsapp' | 'email' | 'meta_ads' | 'manual'
    ) {
        this.agentType = agentType;
        this.executionChannel = executionChannel;
    }

    // ── Métodos abstratos ─────────────────────────────────────────────────────

    /**
     * System prompt especializado por agente concreto.
     * Recebe o contexto de negócio e segmento para injeção.
     */
    protected abstract buildSystemPrompt(
        businessContext: string,
        segment: AgentSegmentItem[],
        recommendation: GrowthRecommendation
    ): string;

    // ── Métodos públicos ──────────────────────────────────────────────────────

    /**
     * Abre uma sessão de colaboração para uma recomendação.
     * Carrega contexto de negócio e segmento de clientes, gera mensagem de abertura.
     */
    async openSession(
        profileId: string,
        recommendation: GrowthRecommendation
    ): Promise<OpenSessionResult> {
        const businessContext = await this.loadBusinessContext(profileId);
        const segment = await this.loadSegment(profileId, recommendation);

        // Guarda segmento em memória para uso nas tools
        this.currentSegment = segment;

        const withPhone = segment.filter(c => c.phone && c.phone.trim().length > 0).length;
        const withoutPhone = segment.length - withPhone;

        const systemPrompt = this.buildSystemPrompt(businessContext, segment, recommendation);

        const openingPrompt = `Sessão de colaboração iniciada para: "${recommendation.title}". Apresente o segmento identificado, explique o contexto da oportunidade com números específicos, e proponha um primeiro rascunho de mensagem para o founder revisar. Comece já com a análise do segmento e o rascunho.`;

        const response = await this.callClaude(systemPrompt, [
            { role: 'user', content: openingPrompt },
        ]);

        // Tenta extrair rascunho da resposta (seção demarcada)
        const draftMatch = response.match(/RASCUNHO:([\s\S]+?)(?:FIM DO RASCUNHO|$)/i);
        const draftMessage = draftMatch ? draftMatch[1]!.trim() : null;

        const result: OpenSessionResult = {
            opening_message: response,
            segment_snapshot: segment,
            customers_with_phone: withPhone,
            customers_without_phone: withoutPhone,
        };
        if (draftMessage) result.draft_message = draftMessage;
        return result;
    }

    /**
     * Processa uma mensagem do founder no loop de colaboração.
     * Executa o multi-turn com function calling até obter resposta textual final.
     */
    async handleMessage(
        _sessionId: string,
        userMessage: string,
        history: CollaborationMessage[],
        context: { recommendation: GrowthRecommendation; businessContext: string }
    ): Promise<string> {
        const systemPrompt = this.buildSystemPrompt(
            context.businessContext,
            this.currentSegment,
            context.recommendation
        );

        // Converte histórico para formato Anthropic
        const messages: Anthropic.MessageParam[] = [
            ...history.map(m => ({
                role: m.role as 'user' | 'assistant',
                content: m.content,
            })),
            { role: 'user' as const, content: userMessage },
        ];

        return this.callClaude(systemPrompt, messages);
    }

    /**
     * Gera o plano de execução com mensagem personalizada por cliente.
     * Pode ser sobrescrito por agentes especializados.
     */
    buildExecutionPlan(
        _profileId: string,
        _recommendation: GrowthRecommendation,
        approvedTemplate: string,
        segment: AgentSegmentItem[]
    ): ExecutionPlanItem[] {
        return segment.map(customer => {
            const personalizedMessage = this.personalizeTemplate(approvedTemplate, customer);
            const hasPhone = !!(customer.phone && customer.phone.trim().length > 0);
            const channel: 'whatsapp' | 'email' = hasPhone ? 'whatsapp' : 'email';

            const item: ExecutionPlanItem = {
                customer_id: customer.id,
                customer_email: customer.email,
                channel,
                personalized_message: personalizedMessage,
            };
            if (hasPhone && customer.phone) item.customer_phone = customer.phone;
            return item;
        });
    }

    /**
     * Executa os itens do plano de execução um a um.
     * Atualiza status em `growth_execution_items` conforme progresso.
     */
    async executeItems(
        items: ExecutionPlanItem[],
        profileId: string,
        recId: string
    ): Promise<void> {
        for (const item of items) {
            const { data: dbItem } = await supabase
                .from('growth_execution_items')
                .select('id')
                .eq('recommendation_id', recId)
                .eq('customer_email', item.customer_email)
                .single();

            const itemId = dbItem?.id as string | undefined;

            try {
                if (item.channel === 'whatsapp' && item.customer_phone) {
                    const { WhatsAppService } = await import('../whatsapp.service.js');
                    const result = await WhatsAppService.sendTextMessage(
                        item.customer_phone,
                        item.personalized_message,
                        profileId
                    );
                    if (!result.success) throw new Error(result.error ?? 'WhatsApp send failed');
                } else if (item.channel === 'email') {
                    const { EmailExecutionService } = await import('../email-execution.service.js');
                    const emailItem: import('../email-execution.service.js').EmailBatchItem = {
                        profileId,
                        to: item.customer_email,
                        subject: this.buildEmailSubject(item.personalized_message),
                        html: item.personalized_message,
                    };
                    if (item.customer_id) emailItem.customerId = item.customer_id;
                    if (recId) emailItem.growthActionId = recId;
                    await EmailExecutionService.sendSingle(emailItem);
                }

                await supabase
                    .from('growth_execution_items')
                    .update({ status: 'sent', updated_at: new Date().toISOString() })
                    .eq('id', itemId);
            } catch (err) {
                const errorMsg = err instanceof Error ? err.message : String(err);
                console.error(
                    `[ExecutionAgent:${this.agentType}] Falha ao executar item para ${item.customer_email}:`,
                    errorMsg
                );
                await supabase
                    .from('growth_execution_items')
                    .update({
                        status: 'failed',
                        error_message: errorMsg,
                        updated_at: new Date().toISOString(),
                    })
                    .eq('id', itemId);
            }
        }
    }

    // ── Métodos protegidos (utilitários para subclasses) ──────────────────────

    /**
     * Substitui placeholders no template com dados reais do cliente.
     */
    protected personalizeTemplate(template: string, customer: AgentSegmentItem): string {
        const name = customer.email.split('@')[0] ?? customer.email;
        const ltv = customer.total_ltv.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
        const dias = customer.days_inactive?.toString() ?? '?';

        return template
            .replace(/\{\{nome\}\}/gi, name)
            .replace(/\{\{ltv\}\}/gi, ltv)
            .replace(/\{\{dias\}\}/gi, dias);
    }

    /**
     * Extrai assunto de email a partir da primeira linha do corpo,
     * ou gera um fallback genérico.
     */
    protected buildEmailSubject(body: string): string {
        const firstLine = body.split('\n')[0]?.trim() ?? '';
        if (firstLine.length > 0 && firstLine.length <= 100) return firstLine;
        return 'Uma mensagem especial para você';
    }

    // ── Métodos privados ──────────────────────────────────────────────────────

    /**
     * Carrega contexto de negócio da tabela `business_context`.
     */
    private async loadBusinessContext(profileId: string): Promise<string> {
        const { data: ctx } = await supabase
            .from('business_context')
            .select('content, context_type')
            .eq('profile_id', profileId)
            .order('updated_at', { ascending: false });

        if (!ctx || ctx.length === 0) return 'Contexto de negócio não configurado.';

        return ctx
            .map(c => `[${c.context_type ?? 'geral'}]\n${c.content}`)
            .join('\n\n');
    }

    /**
     * Carrega o segmento de clientes a partir do meta da recomendação.
     */
    private async loadSegment(
        profileId: string,
        recommendation: GrowthRecommendation
    ): Promise<AgentSegmentItem[]> {
        const meta = recommendation.meta;
        const emails = Array.isArray(meta.customer_emails)
            ? (meta.customer_emails as string[])
            : [];

        if (emails.length === 0) {
            console.warn(
                `[ExecutionAgent:${this.agentType}] Recomendação ${recommendation.id} sem customer_emails no meta.`
            );
            return [];
        }

        const { data: customers, error } = await supabase
            .from('customers')
            .select('id, email, phone, total_ltv, rfm_score, churn_probability, last_purchase_at, acquisition_channel')
            .in('email', emails)
            .eq('profile_id', profileId);

        if (error) {
            console.error(
                `[ExecutionAgent:${this.agentType}] Erro ao carregar segmento:`,
                error.message
            );
            return [];
        }

        if (!customers) return [];

        const now = Date.now();

        return customers.map(c => {
            const lastPurchaseTs = c.last_purchase_at
                ? new Date(c.last_purchase_at as string).getTime()
                : null;
            const daysInactive = lastPurchaseTs
                ? Math.floor((now - lastPurchaseTs) / (1000 * 60 * 60 * 24))
                : null;

            const item: AgentSegmentItem = {
                id: c.id as string,
                email: c.email as string,
                total_ltv: Number(c.total_ltv) || 0,
            };
            const phone = c.phone as string | null;
            if (phone) item.phone = phone;
            const rfm = c.rfm_score as string | null;
            if (rfm) item.rfm_score = rfm;
            if (c.churn_probability != null) item.churn_probability = Number(c.churn_probability);
            const lpa = c.last_purchase_at as string | null;
            if (lpa) item.last_purchase_at = lpa;
            const acq = c.acquisition_channel as string | null;
            if (acq) item.acquisition_channel = acq;
            if (daysInactive !== null) item.days_inactive = daysInactive;
            return item;
        });
    }

    /**
     * Executa chamada ao Claude com suporte a multi-turn de function calling.
     * Loop: chama Claude → se stop_reason for 'tool_use', executa tool, retorna resultado → repete.
     */
    private async callClaude(
        systemPrompt: string,
        messages: Anthropic.MessageParam[]
    ): Promise<string> {
        const client = getAnthropic();
        let currentMessages = [...messages];

        // Limite de voltas para evitar loop infinito em caso de bug de tool
        const MAX_TOOL_TURNS = 8;
        let turns = 0;

        while (turns < MAX_TOOL_TURNS) {
            turns++;

            const response = await client.messages.create({
                model: ANTHROPIC_MODELS.SONNET,
                max_tokens: 4096,
                system: systemPrompt,
                messages: currentMessages,
                tools: BASE_TOOLS,
            });

            if (response.stop_reason !== 'tool_use') {
                // Extrai resposta textual final
                const textBlock = response.content.find(b => b.type === 'text');
                if (textBlock && textBlock.type === 'text') {
                    return textBlock.text;
                }
                throw new Error('[ExecutionAgent] Claude retornou sem bloco de texto.');
            }

            // Processa todas as tool_use calls do turn
            const toolUseBlocks = response.content.filter(
                (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
            );

            // Adiciona a resposta do assistant (com tool_use) ao histórico
            currentMessages = [
                ...currentMessages,
                { role: 'assistant' as const, content: response.content },
            ];

            // Executa as tools e acumula resultados
            const toolResults: Anthropic.ToolResultBlockParam[] = [];

            for (const toolBlock of toolUseBlocks) {
                const result = await this.executeTool(
                    toolBlock.name,
                    toolBlock.input as Record<string, unknown>
                );
                toolResults.push({
                    type: 'tool_result',
                    tool_use_id: toolBlock.id,
                    content: result,
                });
            }

            // Adiciona resultados das tools ao histórico para o próximo turn
            currentMessages = [
                ...currentMessages,
                { role: 'user' as const, content: toolResults },
            ];
        }

        throw new Error('[ExecutionAgent] Limite de turns de tool calling atingido.');
    }

    /**
     * Despacha execução da tool pelo nome.
     */
    private async executeTool(
        toolName: string,
        input: Record<string, unknown>
    ): Promise<string> {
        switch (toolName) {
            case 'draft_message':
                return this.toolDraftMessage(input);
            case 'preview_personalized':
                return this.toolPreviewPersonalized(input);
            case 'get_customer_insight':
                return await this.toolGetCustomerInsight(input);
            default:
                return `Tool desconhecida: ${toolName}`;
        }
    }

    private toolDraftMessage(input: Record<string, unknown>): string {
        const tone = (input.tone as string) ?? 'consultivo';
        const highlight = (input.highlight as string | undefined) ?? '';
        const includeName = input.include_name !== false;
        const maxChars = (input.max_chars as number | undefined)
            ?? (this.executionChannel === 'whatsapp' ? 1024 : 0);

        const segment = this.currentSegment;
        if (segment.length === 0) return 'Segmento vazio — impossível criar rascunho.';

        const avgLtv = segment.reduce((sum, c) => sum + c.total_ltv, 0) / segment.length;
        const avgDays = Math.round(
            segment.reduce((sum, c) => sum + (c.days_inactive ?? 90), 0) / segment.length
        );

        const toneMap: Record<string, string> = {
            consultivo: 'abordagem consultiva, mostrando que você conhece o histórico do cliente',
            direto: 'linguagem direta e objetiva, sem rodeios',
            urgente: 'senso de urgência e oportunidade limitada',
            exclusivo: 'tratamento VIP, benefício exclusivo para este cliente',
        };

        const toneDescription = toneMap[tone] ?? toneMap['consultivo'];
        const charLimit = maxChars > 0 ? `Limite: ${maxChars} caracteres.` : 'Sem limite de caracteres.';
        const highlightText = highlight ? `Destaque principal: ${highlight}.` : '';

        const ltvFormatted = avgLtv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const namePrefix = includeName ? 'Olá {{nome}}, ' : '';

        let draft: string;
        if (this.executionChannel === 'whatsapp') {
            draft = `${namePrefix}tudo bem?\n\nPercebemos que faz ${avgDays} dias ({{dias}}) desde sua última compra. Com um histórico de ${ltvFormatted} ({{ltv}}) conosco, gostaríamos de compartilhar algo especial.\n\n${highlight || 'Temos novidades que combinam com o seu perfil.'}\n\nQualquer dúvida, é só responder aqui.`;
        } else {
            draft = `${includeName ? '<p>Olá {{nome}},</p>' : ''}<p>Percebemos que faz {{dias}} dias desde seu último contato. Você tem um histórico de {{ltv}} conosco e queríamos chegar até você pessoalmente.</p><p>${highlight || 'Temos algo especial reservado para você.'}</p><p>Estamos aqui quando precisar.</p>`;
        }

        return JSON.stringify(
            {
                draft,
                tone,
                estimated_chars: draft.length,
                within_limit: maxChars > 0 ? draft.length <= maxChars : true,
                placeholders_used: ['{{nome}}', '{{ltv}}', '{{dias}}'],
                guidance: `Tom ${tone}: ${toneDescription}. ${charLimit} ${highlightText}`.trim(),
            },
            null,
            2
        );
    }

    private toolPreviewPersonalized(input: Record<string, unknown>): string {
        const template = (input.template as string | undefined) ?? '';
        if (!template) return 'Template vazio.';

        const sample = this.currentSegment.slice(0, 3);
        if (sample.length === 0) return 'Segmento vazio — nenhum preview disponível.';

        const previews = sample.map(c => ({
            email: c.email,
            ltv: c.total_ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
            days_inactive: c.days_inactive ?? 'N/A',
            preview: this.personalizeTemplate(template, c),
            char_count: this.personalizeTemplate(template, c).length,
        }));

        return JSON.stringify({ previews, sample_size: sample.length }, null, 2);
    }

    private async toolGetCustomerInsight(input: Record<string, unknown>): Promise<string> {
        const email = (input.customer_email as string | undefined) ?? '';
        const customer = this.currentSegment.find(
            c => c.email.toLowerCase() === email.toLowerCase()
        );

        if (!customer) return `Cliente ${email} não encontrado no segmento atual.`;

        return JSON.stringify(
            {
                email: customer.email,
                total_ltv: customer.total_ltv.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                }),
                rfm_score: customer.rfm_score ?? 'N/A',
                churn_probability:
                    customer.churn_probability != null
                        ? `${customer.churn_probability.toFixed(1)}%`
                        : 'N/A',
                days_inactive: customer.days_inactive ?? 'N/A',
                last_purchase_at: customer.last_purchase_at
                    ? new Date(customer.last_purchase_at).toLocaleDateString('pt-BR')
                    : 'N/A',
                acquisition_channel: customer.acquisition_channel ?? 'desconhecido',
                has_phone: !!(customer.phone && customer.phone.trim().length > 0),
            },
            null,
            2
        );
    }
}
