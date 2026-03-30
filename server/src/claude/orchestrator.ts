import type Anthropic from '@anthropic-ai/sdk';
import { getAnthropicClient } from '../lib/anthropic.js';
import { supabase } from '../lib/supabase.js';
import { buildSystemPrompt } from './system-prompt.js';
import { executeTool, ALL_TOOLS } from './tools/executor.js';
import type { ChatRequest, ChatResponse, OrchestratorContext, ProfileContext, BusinessStats, RfmSegments, ChannelBreakdown } from './types.js';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOOL_ROUNDS = 6;
const HISTORY_LIMIT = 20;

const THINKING_KEYWORDS = [
  'por que', 'analise', 'compare', 'projeção', 'tendência', 'explica',
  'forecast', 'correlação', 'diagnóstico', 'estratégia', 'por quê',
];

export function needsDeepThinking(message: string): boolean {
  const lower = message.toLowerCase();
  return THINKING_KEYWORDS.some(kw => lower.includes(kw));
}

async function loadContext(profileId: string, mode: ChatRequest['mode'], pageContext: string): Promise<OrchestratorContext> {
  const [
    profileResult,
    historyResult,
    transResult,
    customersResult,
    recsCountResult,
    recsResult,
    channelPerfResult,
    adMetricsResult,
  ] = await Promise.all([
    supabase.from('profiles').select('id, business_type, business_context, ai_instructions').eq('id', profileId).single(),
    supabase.from('ai_chat_history').select('role, content').eq('user_id', profileId).eq('mode', mode).order('created_at', { ascending: false }).limit(HISTORY_LIMIT),
    supabase.from('transactions').select('amount_net, amount_gross, fee_platform, created_at').eq('user_id', profileId).eq('status', 'approved'),
    supabase.from('customers').select('acquisition_channel, total_ltv, churn_probability, rfm_score, last_purchase_at').eq('user_id', profileId),
    supabase.from('growth_recommendations').select('id', { count: 'exact', head: true }).eq('user_id', profileId).in('status', ['pending', 'approved', 'executing']),
    supabase.from('growth_recommendations').select('id, type, title, narrative, impact_estimate, meta, status').eq('user_id', profileId).in('status', ['pending', 'approved', 'executing']).order('created_at', { ascending: false }).limit(10),
    supabase.from('mv_campaign_ltv_performance').select('*').eq('user_id', profileId),
    supabase.from('ad_metrics').select('platform, spend_brl').eq('user_id', profileId).gte('date', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!),
  ]);

  const profile: ProfileContext = profileResult.data ?? { id: profileId, business_type: null, business_context: null, ai_instructions: null };
  const history = ((historyResult.data || []).reverse()) as Array<{ role: 'user' | 'assistant'; content: string }>;
  const allTrans = transResult.data || [];
  const customers = customersResult.data || [];

  const now = Date.now();
  const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000);
  const trans30d = allTrans.filter(t => new Date(t.created_at as string) >= thirtyDaysAgo);
  const totalRevenue = allTrans.reduce((s, t) => s + Number(t.amount_net), 0);
  const revenue30d = trans30d.reduce((s, t) => s + Number(t.amount_net), 0);
  const avgTicket = allTrans.length > 0 ? totalRevenue / allTrans.length : 0;
  const avgLtv = customers.length > 0 ? customers.reduce((s, c) => s + Number(c.total_ltv), 0) / customers.length : 0;
  const avgChurn = customers.length > 0 ? customers.reduce((s, c) => s + Number(c.churn_probability || 0), 0) / customers.length : 0;

  const activeChannels = [...new Set(customers.map(c => c.acquisition_channel as string).filter(Boolean))];

  const stats: BusinessStats = {
    total_revenue: totalRevenue,
    total_customers: customers.length,
    total_transactions: allTrans.length,
    avg_ticket: avgTicket,
    revenue_30d: revenue30d,
    transactions_30d: trans30d.length,
    avg_ltv: avgLtv,
    avg_churn: avgChurn / 100,
    active_channels: activeChannels,
  };

  // RFM segments
  const rfmAcc: RfmSegments = {
    Champions: { count: 0, avg_ltv: 0 },
    'Em Risco': { count: 0, avg_ltv: 0 },
    'Novos Promissores': { count: 0, avg_ltv: 0 },
    Inativos: { count: 0, avg_ltv: 0 },
  };
  const rfmLtvSum = { Champions: 0, 'Em Risco': 0, 'Novos Promissores': 0, Inativos: 0 };

  for (const c of customers) {
    const score = c.rfm_score as string;
    type SegKey = keyof typeof rfmAcc;
    let seg: SegKey;
    if (!score || score.length !== 3) {
      seg = 'Novos Promissores';
    } else {
      const r = parseInt(score[0]!), f = parseInt(score[1]!), m = parseInt(score[2]!);
      const avg = (r + f + m) / 3;
      if (r >= 4 && f >= 3 && m >= 3) seg = 'Champions';
      else if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3)) seg = 'Em Risco';
      else if (avg <= 2) seg = 'Inativos';
      else seg = 'Novos Promissores';
    }
    rfmAcc[seg].count++;
    rfmLtvSum[seg] += Number(c.total_ltv || 0);
  }

  for (const seg of Object.keys(rfmAcc) as Array<keyof typeof rfmAcc>) {
    rfmAcc[seg].avg_ltv = rfmAcc[seg].count > 0 ? rfmLtvSum[seg] / rfmAcc[seg].count : 0;
  }

  // Channel breakdown
  const channelMap: Record<string, { customers: number; ltvSum: number }> = {};
  for (const c of customers) {
    const ch = (c.acquisition_channel as string) || 'desconhecido';
    if (!channelMap[ch]) channelMap[ch] = { customers: 0, ltvSum: 0 };
    channelMap[ch]!.customers++;
    channelMap[ch]!.ltvSum += Number(c.total_ltv || 0);
  }
  const channelBreakdown: ChannelBreakdown[] = Object.entries(channelMap).map(([channel, d]) => ({
    channel,
    customers: d.customers,
    avg_ltv: d.customers > 0 ? d.ltvSum / d.customers : 0,
    revenue: d.ltvSum,
  })).sort((a, b) => b.avg_ltv - a.avg_ltv);

  const channelPerformance = (channelPerfResult.data || []).map(row => ({
    channel: (row.acquisition_channel || row.platform) as string,
    customers_acquired: Number(row.customers_acquired || 0),
    avg_ltv_brl: Number(row.avg_ltv_brl || 0),
    total_spend_brl: Number(row.total_spend_brl || 0),
    true_roi: row.true_roi != null ? Number(row.true_roi) : null,
  }));

  return {
    profileId,
    mode,
    pageContext,
    profile,
    stats,
    rfmSegments: rfmAcc,
    channelBreakdown,
    channelPerformance,
    pendingGrowthRecs: recsCountResult.count || 0,
    growthRecommendations: (recsResult.data || []) as OrchestratorContext['growthRecommendations'],
    history,
  };
}

async function persistMessages(profileId: string, mode: ChatRequest['mode'], userMessage: string, assistantContent: string): Promise<void> {
  await Promise.all([
    supabase.from('ai_chat_history').insert({ user_id: profileId, role: 'user', content: userMessage, mode }),
    supabase.from('ai_chat_history').insert({ user_id: profileId, role: 'assistant', content: assistantContent, mode }),
  ]);
}

/**
 * Executa o agentic loop: chama Claude, processa tool_use, repete até stop_end ou MAX_TOOL_ROUNDS.
 */
export async function chat(profileId: string, request: ChatRequest): Promise<ChatResponse> {
  const ctx = await loadContext(profileId, request.mode, request.pageContext ?? 'Visão Geral');
  const systemBlocks = buildSystemPrompt(ctx);

  const useThinking = needsDeepThinking(request.message);
  const messages: Anthropic.MessageParam[] = [
    ...ctx.history.map(h => ({ role: h.role, content: h.content } as Anthropic.MessageParam)),
    { role: 'user', content: request.message },
  ];

  const client = getAnthropicClient() as Anthropic;
  const usedTools: string[] = [];
  let rounds = 0;

  let currentMessages = messages;

  while (rounds < MAX_TOOL_ROUNDS) {
    rounds++;

    const createParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: MODEL,
      max_tokens: useThinking ? 16000 : 4096,
      system: systemBlocks as Anthropic.TextBlockParam[],
      messages: currentMessages,
      tools: ALL_TOOLS,
    };

    if (useThinking) {
      (createParams as unknown as Record<string, unknown>).thinking = { type: 'enabled', budget_tokens: 10000 };
    }

    const response = await client.messages.create(createParams);

    if (response.stop_reason === 'end_turn' || response.stop_reason === 'max_tokens') {
      const textBlock = response.content.find(b => b.type === 'text');
      const text = textBlock && textBlock.type === 'text' ? textBlock.text : '';

      void persistMessages(profileId, request.mode, request.message, text).catch(e =>
        console.error('[claude/orchestrator] Falha ao persistir mensagens:', e)
      );

      const response_: ChatResponse = { role: 'assistant', content: text, model: MODEL };
      if (usedTools.length > 0) response_.usedTools = usedTools;
      return response_;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(b => b.type === 'tool_use') as Anthropic.ToolUseBlock[];

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async block => {
          usedTools.push(block.name);
          const result = await executeTool(block.name, block.input as Record<string, unknown>, profileId);
          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: result,
          };
        })
      );

      currentMessages = [
        ...currentMessages,
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults },
      ];
      continue;
    }

    // Fallback inesperado
    break;
  }

  // Se chegou aqui por max rounds sem end_turn, extrai o último texto disponível
  const lastAssistant = [...currentMessages].reverse().find(m => m.role === 'assistant');
  let fallbackText = 'Não consegui concluir a análise no tempo disponível. Tente reformular a pergunta.';
  if (lastAssistant && typeof lastAssistant.content === 'string') {
    fallbackText = lastAssistant.content;
  } else if (lastAssistant && Array.isArray(lastAssistant.content)) {
    const tb = (lastAssistant.content as Anthropic.ContentBlock[]).find(b => b.type === 'text');
    if (tb && tb.type === 'text') fallbackText = tb.text;
  }

  void persistMessages(profileId, request.mode, request.message, fallbackText).catch(() => {});

  return { role: 'assistant', content: fallbackText, model: MODEL, usedTools };
}
