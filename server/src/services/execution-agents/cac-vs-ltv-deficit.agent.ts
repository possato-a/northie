/**
 * @file services/execution-agents/cac-vs-ltv-deficit.agent.ts
 *
 * Agente de execução para recomendações do tipo `cac_vs_ltv_deficit`.
 * Canal: Email — envia oferta de segunda compra para clientes em déficit (CAC > LTV).
 *
 * Especialização:
 * - Tom analítico e direto — foca no contexto financeiro do payback
 * - Personalização por produto anterior, valor gasto e oferta de segunda compra
 * - Formato com ASSUNTO separado do CORPO para facilitar envio via Resend
 */

import {
    BaseExecutionAgent,
    type AgentSegmentItem,
    type ExecutionPlanItem,
    type GrowthRecommendation,
} from './base.agent.js';

export class CacVsLtvDeficitAgent extends BaseExecutionAgent {
    constructor() {
        super('cac_vs_ltv_deficit', 'email');
    }

    protected buildSystemPrompt(
        businessContext: string,
        segment: AgentSegmentItem[],
        recommendation: GrowthRecommendation
    ): string {
        const segmentCount = segment.length;

        const meta = recommendation.meta as Record<string, unknown>;
        const totalDeficit = typeof meta.total_deficit === 'number'
            ? meta.total_deficit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
            : 'N/A';
        const unprofitableCount = typeof meta.unprofitable_count === 'number'
            ? meta.unprofitable_count
            : segmentCount;

        const segmentList = segment
            .slice(0, 15)
            .map(c => {
                const ltv = c.total_ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
                const channel = c.acquisition_channel ?? 'desconhecido';
                return `— ${c.email} | LTV atual ${ltv} | canal de aquisicao: ${channel}`;
            })
            .join('\n');

        return `Voce e o Agente de Analise Financeira da Northie. Sua missao e ajudar o founder a acelerar o payback de clientes cujo CAC superou o LTV atual — clientes nao lucrativos que precisam de uma segunda compra para se tornarem financeiramente viáveis.

CONTEXTO DO NEGOCIO:
${businessContext}

PROBLEMA IDENTIFICADO — ${unprofitableCount} clientes em déficit (CAC > LTV):
Déficit total do segmento: ${totalDeficit}
Esses clientes foram adquiridos a um custo maior do que o valor que geraram até agora. Uma segunda compra pode reverter essa equação.

SEGMENTO (primeiros 15 de ${segmentCount}):
${segmentList}
${segmentCount > 15 ? `... e mais ${segmentCount - 15} clientes nao listados acima.` : ''}

CANAL DE EXECUCAO: Email
FORMATO OBRIGATORIO do rascunho:
SUBJECT: [linha de assunto do email]
BODY:
[corpo completo do email em HTML simples]
FIM DO RASCUNHO

PLACEHOLDERS DISPONIVEIS:
— {{nome}} — primeiro nome do cliente (extraído do email)
— {{produto_anterior}} — produto mais recente comprado
— {{valor_gasto}} — LTV atual do cliente (quanto ele ja gastou)
— {{oferta}} — oferta de segunda compra a ser definida com o founder

REGRAS:
— Tom analitico e direto — o founder precisa entender o problema financeiro, nao apenas a oferta
— Foque no beneficio para o cliente (nao exponha o conceito de "déficit" na mensagem final ao cliente)
— Sugira uma oferta concreta de segunda compra: desconto progressivo, bundle, upgrade ou exclusividade
— A linha de assunto deve ser especifica e personalizada — evite genericos
— Sem markdown pesado no corpo — use HTML simples (<p>, <strong>, <a>)
— O founder APROVA, voce EXECUTA. Nunca o contrario.
— NUNCA use emojis. Responda em portugues brasileiro. Texto puro fora do HTML.

DADOS DA RECOMENDACAO:
Titulo: ${recommendation.title}
Narrativa: ${recommendation.narrative}
Impacto estimado: ${recommendation.impact_estimate}`;
    }

    /**
     * Plano de execução exclusivamente por email — sem fallback WhatsApp.
     * Usa o formato SUBJECT:/BODY: consistente com os demais agentes de email.
     */
    buildExecutionPlan(
        _profileId: string,
        _recommendation: GrowthRecommendation,
        approvedTemplate: string,
        segment: AgentSegmentItem[]
    ): ExecutionPlanItem[] {
        const subjectMatch = approvedTemplate.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
        const bodyMatch = approvedTemplate.match(/BODY:\s*([\s\S]+?)(?:FIM DO RASCUNHO|$)/i);

        const subjectTemplate = (subjectMatch?.[1] ?? 'Uma oportunidade especial para você').trim();
        const bodyTemplate = (bodyMatch?.[1] ?? approvedTemplate).trim();

        return segment.map(customer => {
            const personalizedSubject = this.personalizeDeficitTemplate(subjectTemplate, customer);
            const personalizedBody = this.personalizeDeficitTemplate(bodyTemplate, customer);

            const item: ExecutionPlanItem = {
                customer_id: customer.id,
                customer_email: customer.email,
                channel: 'email' as const,
                personalized_message: `SUBJECT: ${personalizedSubject}\nBODY: ${personalizedBody}`,
            };
            return item;
        });
    }

    /**
     * Substitui placeholders específicos do agente de déficit mais os placeholders base.
     */
    private personalizeDeficitTemplate(template: string, customer: AgentSegmentItem): string {
        const ltv = customer.total_ltv.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        return this.personalizeTemplate(template, customer)
            .replace(/\{\{valor_gasto\}\}/gi, ltv)
            .replace(/\{\{produto_anterior\}\}/gi, customer.acquisition_channel ?? 'produto adquirido')
            .replace(/\{\{oferta\}\}/gi, 'oferta especial');
    }

    /**
     * Extrai o assunto do formato SUBJECT: do template combinado.
     */
    protected buildEmailSubject(combinedMessage: string): string {
        const match = combinedMessage.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
        if (match && match[1] && match[1].trim().length > 0) {
            return match[1].trim();
        }
        return 'Uma oportunidade especial para você';
    }
}
