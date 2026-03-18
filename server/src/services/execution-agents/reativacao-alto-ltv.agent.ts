/**
 * @file services/execution-agents/reativacao-alto-ltv.agent.ts
 *
 * Agente de execução para recomendações do tipo `reativacao_alto_ltv`.
 * Canal primário: WhatsApp. Fallback: Email para clientes sem telefone.
 *
 * Especialização:
 * - Tom consultivo — clientes que já conhecem o produto
 * - Personalização por faixa de LTV (acima do threshold = abordagem diferenciada)
 * - Aviso explícito quando parte do segmento não tem telefone cadastrado
 */

import {
    BaseExecutionAgent,
    type AgentSegmentItem,
    type ExecutionPlanItem,
    type GrowthRecommendation,
} from './base.agent.js';

// LTV acima deste valor recebe abordagem diferenciada no prompt
const HIGH_LTV_THRESHOLD = 1500;

export class ReativacaoAltoLtvAgent extends BaseExecutionAgent {
    constructor() {
        super('reativacao_alto_ltv', 'whatsapp');
    }

    protected buildSystemPrompt(
        businessContext: string,
        segment: AgentSegmentItem[],
        recommendation: GrowthRecommendation
    ): string {
        const segmentCount = segment.length;
        const withPhone = segment.filter(c => c.phone && c.phone.trim().length > 0).length;
        const withoutPhone = segmentCount - withPhone;

        const segmentList = segment
            .slice(0, 15)
            .map(c => {
                const ltv = c.total_ltv.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                });
                const dias = c.days_inactive ?? '?';
                const rfm = c.rfm_score ?? 'N/A';
                const phone = c.phone ? 'tem telefone' : 'SEM telefone';
                return `— ${c.email} | LTV ${ltv} | inativo há ${dias} dias | RFM ${rfm} | ${phone}`;
            })
            .join('\n');

        const phoneWarning =
            withoutPhone > 0
                ? `ATENCAO: ${withoutPhone} de ${segmentCount} clientes nao tem telefone cadastrado. Eles serao excluidos desta campanha de WhatsApp. Deseja configurar um fallback por email para eles?`
                : '';

        return `Voce e o Agente de Reativacao da Northie. Sua missao e ajudar o founder a recuperar clientes de alto LTV que pararam de comprar.

CONTEXTO DO NEGOCIO:
${businessContext}

SEGMENTO IDENTIFICADO — ${segmentCount} clientes inativos ha 90+ dias:
${segmentList}
${segmentCount > 15 ? `... e mais ${segmentCount - 15} clientes nao listados acima.` : ''}

${phoneWarning}

CANAL DE EXECUCAO: WhatsApp
IMPORTANTE: WhatsApp permite mensagens livres dentro da janela de 24h. Para clientes inativos ha mais de 24h (caso de reativacao), voce PRECISA de um template aprovado pelo Meta. Vou ajuda-lo a criar uma mensagem que funcione como template.

REGRAS:
— A mensagem deve ter tom consultivo, nao promocional — esse cliente ja conhece o produto
— Personalize por LTV: clientes acima de R$ ${HIGH_LTV_THRESHOLD.toLocaleString('pt-BR')} merecem abordagem diferenciada (reconhecimento do historico, tom mais exclusivo)
— Inclua {{nome}} no inicio para personalizacao automatica
— WhatsApp: maximo 1024 caracteres, sem formatacao HTML
— O founder APROVA, voce EXECUTA. Nunca o contrario.
— Quando propor um rascunho, use o formato: RASCUNHO: [mensagem] FIM DO RASCUNHO
— NUNCA use emojis. Responda em portugues brasileiro. Texto puro, sem markdown.

DADOS DA RECOMENDACAO:
Titulo: ${recommendation.title}
Narrativa: ${recommendation.narrative}
Impacto estimado: ${recommendation.impact_estimate}`;
    }

    buildExecutionPlan(
        profileId: string,
        recommendation: GrowthRecommendation,
        approvedTemplate: string,
        segment: AgentSegmentItem[]
    ): ExecutionPlanItem[] {
        return segment.map(customer => {
            const hasPhone = !!(customer.phone && customer.phone.trim().length > 0);
            const channel: 'whatsapp' | 'email' = hasPhone ? 'whatsapp' : 'email';
            const personalizedMessage = this.personalizeTemplate(approvedTemplate, customer);

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
}
