/**
 * @file services/execution-agents/index.ts
 *
 * Registry de agentes de execução.
 * Mapeia tipos de recomendação para instâncias de agente concretas.
 *
 * Tipos que exigem colaboração interativa antes da execução:
 * - reativacao_alto_ltv → ReativacaoAltoLtvAgent (WhatsApp)
 * - em_risco_alto_valor → EmRiscoAgent (WhatsApp)
 * - upsell_cohort → UpsellCohortAgent (Email)
 * - queda_retencao_cohort → UpsellCohortAgent (Email — reutilizado)
 * - cac_vs_ltv_deficit → ReativacaoAltoLtvAgent (reutilizado)
 */

import { BaseExecutionAgent } from './base.agent.js';
import { ReativacaoAltoLtvAgent } from './reativacao-alto-ltv.agent.js';
import { EmRiscoAgent } from './em-risco.agent.js';
import { UpsellCohortAgent } from './upsell-cohort.agent.js';

export { BaseExecutionAgent };
export type { AgentSegmentItem, CollaborationMessage, OpenSessionResult, ExecutionPlanItem, GrowthRecommendation } from './base.agent.js';

// ── Serviços de execução de plataforma (Sprint 3A) ────────────────────────────
export { GoogleAdsExecutionService } from '../google-ads-execution.service.js';
export type { GoogleAdsAudienceResult, GoogleAdsCampaignResult } from '../google-ads-execution.service.js';

export { ShopifyExecutionService } from '../shopify-execution.service.js';
export type { ShopifyDiscountResult, ShopifyTagResult, ShopifyCustomerResult } from '../shopify-execution.service.js';

// ── Tipos de recomendação que exigem fluxo de colaboração ────────────────────

export type CollaborationRequiredType =
    | 'reativacao_alto_ltv'
    | 'em_risco_alto_valor'
    | 'upsell_cohort'
    | 'queda_retencao_cohort'
    | 'cac_vs_ltv_deficit';

export const COLLABORATION_REQUIRED: CollaborationRequiredType[] = [
    'reativacao_alto_ltv',
    'em_risco_alto_valor',
    'upsell_cohort',
    'queda_retencao_cohort',
    'cac_vs_ltv_deficit',
];

// ── Registry ─────────────────────────────────────────────────────────────────

const agentRegistry: Record<CollaborationRequiredType, BaseExecutionAgent> = {
    reativacao_alto_ltv: new ReativacaoAltoLtvAgent(),
    em_risco_alto_valor: new EmRiscoAgent(),
    upsell_cohort: new UpsellCohortAgent(),
    queda_retencao_cohort: new UpsellCohortAgent(),   // reutiliza agente de email
    cac_vs_ltv_deficit: new ReativacaoAltoLtvAgent(), // reutiliza agente WhatsApp
};

// ── Funções públicas ──────────────────────────────────────────────────────────

/**
 * Retorna o agente de execução para um tipo de recomendação,
 * ou null se o tipo não exige colaboração.
 */
export function getExecutionAgent(type: string): BaseExecutionAgent | null {
    return agentRegistry[type as CollaborationRequiredType] ?? null;
}

/**
 * Retorna true se o tipo de recomendação exige fluxo de colaboração interativa
 * antes da execução.
 */
export function requiresCollaboration(type: string): boolean {
    return COLLABORATION_REQUIRED.includes(type as CollaborationRequiredType);
}
