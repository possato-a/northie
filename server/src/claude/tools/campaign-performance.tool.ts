import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
  name: 'campaign_performance',
  description: 'Retorna performance detalhada de campanhas de ads por plataforma com métricas de spend, impressões, cliques, CTR e CPC. Use quando o founder perguntar sobre campanhas específicas, desempenho de anúncios ou métricas de topo de funil.',
  input_schema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['meta_ads', 'google_ads', 'todos'],
        description: 'Plataforma para filtrar (padrão: todos)',
      },
      period_days: {
        type: 'number',
        description: 'Período em dias para análise (padrão: 30)',
      },
    },
    required: [],
  },
};

export async function execute(input: { platform?: string; period_days?: number }, profileId: string): Promise<string> {
  const days = input.period_days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;

  let query = supabase
    .from('ad_metrics')
    .select('platform, spend_brl, impressions, clicks, date, campaign_id')
    .eq('user_id', profileId)
    .gte('date', since);

  if (input.platform && input.platform !== 'todos') {
    query = query.eq('platform', input.platform);
  }

  const [metricsResult, campaignsResult] = await Promise.all([
    query,
    supabase.from('ad_campaigns').select('id, name, platform, status').eq('user_id', profileId),
  ]);

  const metrics = metricsResult.data || [];
  const campaigns = campaignsResult.data || [];

  if (metrics.length === 0) {
    return `Sem dados de campanhas nos últimos ${days} dias. Conecte Meta Ads ou Google Ads em Integrações.`;
  }

  const campaignMap: Record<string, string> = {};
  for (const c of campaigns) campaignMap[c.id] = c.name as string;

  const byPlatform: Record<string, { spend: number; impressions: number; clicks: number; campaigns: Set<string> }> = {};
  for (const m of metrics) {
    const p = m.platform as string;
    if (!byPlatform[p]) byPlatform[p] = { spend: 0, impressions: 0, clicks: 0, campaigns: new Set() };
    byPlatform[p]!.spend += Number(m.spend_brl || 0);
    byPlatform[p]!.impressions += Number(m.impressions || 0);
    byPlatform[p]!.clicks += Number(m.clicks || 0);
    if (m.campaign_id) byPlatform[p]!.campaigns.add(m.campaign_id as string);
  }

  const lines = Object.entries(byPlatform).map(([platform, d]) => {
    const ctr = d.impressions > 0 ? ((d.clicks / d.impressions) * 100).toFixed(2) : '0.00';
    const cpc = d.clicks > 0 ? d.spend / d.clicks : 0;
    return `${platform}: gasto R$ ${fmt(d.spend)} | ${d.impressions.toLocaleString('pt-BR')} impressões | ${d.clicks.toLocaleString('pt-BR')} cliques | CTR ${ctr}% | CPC R$ ${fmt(cpc)} | ${d.campaigns.size} campanhas ativas`;
  });

  const totalSpend = Object.values(byPlatform).reduce((s, d) => s + d.spend, 0);

  return `Performance de campanhas (últimos ${days} dias):
Gasto total: R$ ${fmt(totalSpend)}
${lines.join('\n')}`;
}
