/**
 * @file services/execution-agents/queda-retencao-cohort.agent.ts
 *
 * Agente de execução para recomendações do tipo `queda_retencao_cohort`.
 * Canal: Email (via Resend).
 *
 * Especialização:
 * - Clientes com LTV histórico alto (>R$500) mas sem compra há 90+ dias
 * - churn_probability > 0.5 — segmento em queda de retenção por cohort
 * - Campanha de reativação com foco em valor, não em desconto agressivo
 * - Tom pessoal e consultivo — o founder conhece o histórico desse cliente
 */

import {
    BaseExecutionAgent,
    type AgentSegmentItem,
    type ExecutionPlanItem,
    type GrowthRecommendation,
} from './base.agent.js';

export class QuedaRetencaoCohortAgent extends BaseExecutionAgent {
    constructor() {
        super('queda_retencao_cohort', 'email');
    }

    protected buildSystemPrompt(
        businessContext: string,
        segment: AgentSegmentItem[],
        recommendation: GrowthRecommendation
    ): string {
        const segmentCount = segment.length;
        const totalLtv = segment.reduce((sum, c) => sum + c.total_ltv, 0);
        const avgLtv = segmentCount > 0 ? totalLtv / segmentCount : 0;

        const totalLtvFormatted = totalLtv.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });
        const avgLtvFormatted = avgLtv.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL',
        });

        const segmentList = segment
            .slice(0, 12)
            .map(c => {
                const ltv = c.total_ltv.toLocaleString('pt-BR', {
                    style: 'currency',
                    currency: 'BRL',
                });
                const dias = c.days_inactive ?? '?';
                const churn =
                    c.churn_probability != null
                        ? `${(c.churn_probability * 100).toFixed(0)}% churn`
                        : 'churn N/A';
                const canal = c.acquisition_channel ?? 'desconhecido';
                return `— ${c.email} | LTV ${ltv} | ${dias} dias inativo | ${churn} | canal: ${canal}`;
            })
            .join('\n');

        return `Voce e o Agente de Retencao de Cohort da Northie. Sua missao e reativar clientes que ja demonstraram alto valor financeiro mas pararam de comprar — antes que o churn se torne definitivo.

CONTEXTO DO NEGOCIO:
${businessContext}

SEGMENTO IDENTIFICADO — ${segmentCount} clientes em queda de retencao:
LTV total em risco: ${totalLtvFormatted} | LTV medio: ${avgLtvFormatted}
Criterio de selecao: LTV > R$500, sem compra ha 90+ dias, probabilidade de churn > 50%

${segmentList}
${segmentCount > 12 ? `... e mais ${segmentCount - 12} clientes nao listados acima.` : ''}

CANAL DE EXECUCAO: Email
IMPORTANTE: Produza SEMPRE no formato:
SUBJECT: [assunto aqui]
BODY: [corpo HTML aqui]
FIM DO RASCUNHO

REGRAS:
— Tom: pessoal e consultivo. Esse cliente ja comprovou valor — nao trate como lead frio
— Nao use desconto agressivo nem linguagem de desespero ("Estamos com saudades!")
— Foque em valor: o que o cliente esta perdendo, o que mudou desde a ultima compra
— Use {{nome}}, {{produto_anterior}}, {{dias}}, {{ltv}} como placeholders reais
— SUBJECT: maximo 60 caracteres, personalizado
— BODY: HTML simples com <p> e <strong>. Sem tabelas ou imagens
— A mensagem deve soar como atencao individualizada, nao disparo em massa
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
        // Extrai subject e body do template aprovado
        const subjectMatch = approvedTemplate.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
        const bodyMatch = approvedTemplate.match(/BODY:\s*([\s\S]+?)(?:FIM DO RASCUNHO|$)/i);

        const subjectTemplate = (subjectMatch?.[1] ?? 'Queremos te ver por aqui novamente').trim();
        const bodyTemplate = (bodyMatch?.[1] ?? approvedTemplate).trim();

        return segment.map(customer => {
            const personalizedSubject = this.personalizeRetencaoTemplate(
                subjectTemplate,
                customer
            );
            const personalizedBody = this.personalizeRetencaoTemplate(bodyTemplate, customer);

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
     * Sobrescreve buildEmailSubject para extrair do formato combinado SUBJECT:/BODY:.
     */
    protected buildEmailSubject(combinedMessage: string): string {
        const subjectMatch = combinedMessage.match(/SUBJECT:\s*(.+?)(?:\n|$)/i);
        return (subjectMatch?.[1] ?? 'Queremos te ver por aqui novamente').trim();
    }

    /**
     * Personalização estendida — adiciona {{produto_anterior}} além dos placeholders base.
     * produto_anterior é derivado do acquisition_channel quando não há dado direto.
     */
    private personalizeRetencaoTemplate(
        template: string,
        customer: AgentSegmentItem
    ): string {
        const base = this.personalizeTemplate(template, customer);
        const prodAnterior = customer.acquisition_channel ?? 'nosso produto';
        return base.replace(/\{\{produto_anterior\}\}/gi, prodAnterior);
    }
}
