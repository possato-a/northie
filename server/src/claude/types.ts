import type Anthropic from '@anthropic-ai/sdk';

export type ChatMode = 'general' | 'growth';

export interface ChatRequest {
  message: string;
  mode: ChatMode;
  pageContext?: string;
  model?: string;
}

export interface ChatResponse {
  role: 'assistant';
  content: string;
  model: string;
  usedTools?: string[];
}

export interface ProfileContext {
  id: string;
  business_type: string | null;
  business_context: string | null;
  ai_instructions: string | null;
}

export interface BusinessStats {
  total_revenue: number;
  total_customers: number;
  total_transactions: number;
  avg_ticket: number;
  revenue_30d: number;
  transactions_30d: number;
  avg_ltv: number;
  avg_churn: number;
  active_channels: string[];
}

export interface RfmSegments {
  Champions: { count: number; avg_ltv: number };
  'Em Risco': { count: number; avg_ltv: number };
  'Novos Promissores': { count: number; avg_ltv: number };
  Inativos: { count: number; avg_ltv: number };
}

export interface ChannelBreakdown {
  channel: string;
  customers: number;
  avg_ltv: number;
  revenue: number;
}

export interface GrowthRecommendation {
  id: string;
  type: string;
  title: string;
  narrative: string;
  impact_estimate: string;
  meta: Record<string, unknown>;
  status: string;
}

export interface ChannelPerformance {
  channel: string;
  customers_acquired: number;
  avg_ltv_brl: number;
  total_spend_brl: number;
  true_roi: number | null;
}

export interface OrchestratorContext {
  profileId: string;
  mode: ChatMode;
  pageContext: string;
  profile: ProfileContext;
  stats: BusinessStats;
  rfmSegments: RfmSegments;
  channelBreakdown: ChannelBreakdown[];
  channelPerformance: ChannelPerformance[];
  pendingGrowthRecs: number;
  growthRecommendations: GrowthRecommendation[];
  growthDecisions: Array<{ decision_type: string; context: string; created_at: string }>;
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

export type SystemBlock = Anthropic.TextBlockParam & {
  cache_control?: { type: 'ephemeral' };
};
