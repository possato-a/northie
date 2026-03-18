/**
 * @file services/execution-agents/upsell-cohort.agent.ts
 *
 * Agente de execução para recomendações do tipo `upsell_cohort` e `queda_retencao_cohort`.
 * Canal: Email (via Resend).
 *
 * Especialização:
 * - Clientes dentro da janela de recompra estimada por cohort
 * - Mensagens com subject + corpo HTML (estrutura de email)
 * - Timing como argumento central: "você está no momento certo para o próximo passo"
 */

import {
    BaseExecutionAgent,
    type AgentSegmentItem,
    type ExecutionPlanItem,
    type GrowthRecommendation,
} from './base.agent.js';

export class UpsellCohortAgent extends BaseExecutionAgent {
    constructor() {
        super('upsell_cohort', 'email');
    }

    protected buildSystemPrompt(
        businessContext: string,
        segment: AgentSegmentItem[],
        recommendation: GrowthRecommendation
    ): string {
        const segmentCount = segment.length;
        const avgIntervalDays = (recommendation.meta.avg_interval_days as number | undefined) ?? 90;
        const suggestedProduct = (recommendation.meta.suggested_product as string | undefined) ?? 'próximo produto';

        const segmentList = segment
            .slice(0, 12)
            .map(c => {
                const ltv = c.total_ltv.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                });
                const dias = c.days_inactive ?? '?';
                const channel = c.acquisition_channel ?? 'desconhecido';
                return `— ${c.email} | LTV ${ltv} | ${dias} dias desde ultima compra | canal: ${channel}`;
            })
            .join('\n');

        return `Voce e o Agente de Upsell por Cohort da Northie. Sua missao e identificar o momento exato de maior propensao a compra e agir com uma oferta certeira.

CONTEXTO DO NEGOCIO:
${businessContext}

SEGMENTO IDENTIFICADO — ${segmentCount} clientes na janela de recompra:
Intervalo medio de recompra deste cohort: ${avgIntervalDays} dias
Produto sugerido: ${suggestedProduct}

${segmentList}
${segmentCount > 12 ? `... e mais ${segmentCount - 12} clientes nao listados acima.` : ''}

CANAL DE EXECUCAO: Email
IMPORTANTE: Emails de upsell precisam de subject linha atraente + corpo com contexto personalizado. Produza SEMPRE no formato:
SUBJECT: [assunto aqui]
BODY: [corpo HTML aqui]
FIM DO RASCUNHO

REGRAS:
— O argumento central e o TIMING: "voce esta no momento certo para o proximo passo"
— Mencione a jornada do cliente (quantas compras, quando comeou) sem revelar dados sensiveis
— O body deve ser HTML simples: <p>, <strong>, sem tabelas complexas
— Subject deve ter maximo 60 caracteres, direto ao ponto
— Inclua {{nome}} no body e no subject se possivel
— Nao use linguagem generica de marketing — seja especifico para este cohort
— O founder APROVA, voce EXECUTA. Nunca o contrario.
— NUNCA use emojis. Responda em portugues brasileiro.

DADOS DA RECOMENDACAO:
Titulo: ${recommendation.title}
Narrativa: ${recommendation.narrative}
Impacto estimado: ${recommendation.impact_estimate}`;
    }

    buildExecutionPlan(
        _profileId: string,
        _recommendation: GrowthRecommendation,
        approvedTemplate: string,
        segment: AgentSegmentItem[]
    ): ExecutionPlanItem[] {
        // Separa subject e body do template aprovado (formato: "SUBJECT: ...\nBODY: ...")
        const subjectMatch = approvedTemplate.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
        const bodyMatch = approvedTemplate.match(/BODY:\s*([\s\S]+?)(?:FIM DO RASCUNHO|$)/i);

        const subjectTemplate = (subjectMatch?.[1] ?? 'Uma oportunidade especial para você').trim();
        const bodyTemplate = (bodyMatch?.[1] ?? approvedTemplate).trim();

        return segment.map(customer => {
            const personalizedSubject = this.personalizeTemplate(subjectTemplate, customer);
            const personalizedBody = this.personalizeTemplate(bodyTemplate, customer);

            // Canal sempre email para este agente — não atribui customer_phone
            const item: ExecutionPlanItem = {
                customer_id: customer.id,
                customer_email: customer.email,
                channel: 'email' as const,
                // Combina subject e body em formato que o EmailExecutionService vai separar
                personalized_message: `SUBJECT: ${personalizedSubject}\nBODY: ${personalizedBody}`,
            };
            return item;
        });
    }

    /**
     * Sobrescreve buildEmailSubject para extrair do formato combinado.
     */
    protected buildEmailSubject(combinedMessage: string): string {
        const subjectMatch = combinedMessage.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
        return (subjectMatch?.[1] ?? 'Uma oportunidade especial para você').trim();
    }
}
