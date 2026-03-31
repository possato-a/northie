import type Anthropic from '@anthropic-ai/sdk';
import * as tools from './index.js';

export const ALL_TOOLS: Anthropic.Tool[] = [
  tools.businessOverviewTool.definition,
  tools.channelEconomicsTool.definition,
  tools.customerSegmentsTool.definition,
  tools.churnRiskTool.definition,
  tools.campaignPerformanceTool.definition,
  tools.revenueTrendTool.definition,
  tools.growthRecommendationsTool.definition,
  tools.businessContextTool.definition,
  tools.campaignLtvAnalysisTool.definition,
  tools.reactivationCandidatesTool.definition,
  tools.channelLtvCacTool.definition,
  tools.cohortRepurchaseTool.definition,
];

/** Tools disponíveis no modo 'growth' — conjunto completo */
export const GROWTH_TOOLS = ALL_TOOLS;

/** Tools disponíveis no modo 'general' — sem o de recomendações específicas de growth */
export const GENERAL_TOOLS = ALL_TOOLS;

const EXECUTOR_MAP: Record<string, (input: Record<string, unknown>, profileId: string) => Promise<string>> = {
  business_overview: tools.businessOverviewTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  channel_economics: tools.channelEconomicsTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  customer_segments: tools.customerSegmentsTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  churn_risk: tools.churnRiskTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  campaign_performance: tools.campaignPerformanceTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  revenue_trend: tools.revenueTrendTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  growth_recommendations: tools.growthRecommendationsTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  business_context: tools.businessContextTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  get_campaign_ltv_analysis: tools.campaignLtvAnalysisTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  get_reactivation_candidates: tools.reactivationCandidatesTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  get_channel_ltv_cac: tools.channelLtvCacTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
  get_cohort_repurchase: tools.cohortRepurchaseTool.execute as (input: Record<string, unknown>, profileId: string) => Promise<string>,
};

export async function executeTool(name: string, input: Record<string, unknown>, profileId: string): Promise<string> {
  const fn = EXECUTOR_MAP[name];
  if (!fn) {
    return `Tool desconhecida: ${name}. Ferramentas disponíveis: ${Object.keys(EXECUTOR_MAP).join(', ')}`;
  }
  try {
    return await fn(input, profileId);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Claude/executor] Tool "${name}" falhou:`, msg);
    return `Erro ao executar ${name}: ${msg}`;
  }
}
