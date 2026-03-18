/**
 * @file services/execution-agents/em-risco.agent.ts
 *
 * Agente de execução para recomendações do tipo `em_risco_alto_valor`.
 * Canal primário: WhatsApp. Fallback: Email.
 *
 * Especialização:
 * - Clientes com M>=3 (alto valor histórico) mas R<=2 (silêncio recente)
 * - Tom urgente/exclusivo — tratamento VIP antes que o churn aconteça
 * - Reconhecimento explícito do histórico de compras na mensagem
 */

import {
    BaseExecutionAgent,
    type AgentSegmentItem,
    type ExecutionPlanItem,
    type GrowthRecommendation,
} from './base.agent.js';

export class EmRiscoAgent extends BaseExecutionAgent {
    constructor() {
        super('em_risco_alto_valor', 'whatsapp');
    }

    protected buildSystemPrompt(
        businessContext: string,
        segment: AgentSegmentItem[],
        recommendation: GrowthRecommendation
    ): string {
        const segmentCount = segment.length;
        const withPhone = segment.filter(c => c.phone && c.phone.trim().length > 0).length;
        const withoutPhone = segmentCount - withPhone;

        const totalLtvAtRisk = segment.reduce((sum, c) => sum + c.total_ltv, 0);
        const avgLtv = segmentCount > 0 ? totalLtvAtRisk / segmentCount : 0;

        const ltvAtRiskFormatted = totalLtvAtRisk.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
        const avgLtvFormatted = avgLtv.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });

        const segmentList = segment
            .slice(0, 15)
            .map(c => {
                const ltv = c.total_ltv.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                });
                const dias = c.days_inactive ?? '?';
                const churn = c.churn_probability != null
                    ? `${c.churn_probability.toFixed(0)}% churn`
                    : 'churn N/A';
                const rfm = c.rfm_score ?? 'N/A';
                const phone = c.phone ? 'tem telefone' : 'SEM telefone';
                return `— ${c.email} | LTV ${ltv} | inativo ha ${dias} dias | ${churn} | RFM ${rfm} | ${phone}`;
            })
            .join('\n');

        const phoneWarning =
            withoutPhone > 0
                ? `ATENCAO: ${withoutPhone} de ${segmentCount} clientes nao tem telefone cadastrado e serao contatados por email como fallback.`
                : '';

        return `Voce e o Agente VIP de Retencao da Northie. Sua missao e salvar clientes de alto valor historico que estao entrando em silencio — antes que o churn aconteca.

CONTEXTO DO NEGOCIO:
${businessContext}

SEGMENTO EM RISCO — ${segmentCount} clientes de alto valor com sinais de abandono:
LTV total em risco: ${ltvAtRiskFormatted} | LTV medio: ${avgLtvFormatted}

${segmentList}
${segmentCount > 15 ? `... e mais ${segmentCount - 15} clientes nao listados acima.` : ''}

${phoneWarning}

CANAL DE EXECUCAO: WhatsApp (fallback Email para sem telefone)
PERFIL DO SEGMENTO: Esses clientes tem score M>=3 (alto valor historico de compras) mas R<=2 (sem atividade recente). Eles nao sao inativos comuns — sao clientes VIP que pararam de comprar. Isso e sinal de alerta critico.

REGRAS:
— Tom: urgente e exclusivo. Esses clientes merecem atencao diferenciada — mencione o historico deles explicitamente
— A mensagem deve soar como atencao personalizada, nao campanha em massa
— Ofeca algo concreto: acesso prioritario, condicao exclusiva, ou simplesmente reconhecimento do valor deles para o negocio
— Inclua {{nome}} e {{ltv}} para personalizacao real
— WhatsApp: maximo 1024 caracteres, sem HTML
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
