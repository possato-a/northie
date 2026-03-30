import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
  name: 'churn_risk',
  description: 'Identifica clientes com maior risco de churn, cruzando probabilidade de churn com LTV para priorizar quem vale reativar. Retorna segmento de alto risco com LTV elevado — o grupo prioritário para ação de retenção. Use quando o founder perguntar sobre perda de clientes, retenção ou quem pode cancelar.',
  input_schema: {
    type: 'object',
    properties: {
      churn_threshold: {
        type: 'number',
        description: 'Probabilidade mínima de churn para incluir no resultado (0-100, padrão: 50)',
      },
      ltv_percentile: {
        type: 'string',
        enum: ['top_25', 'top_50', 'todos'],
        description: 'Filtrar apenas clientes de alto LTV (padrão: top_50)',
      },
    },
    required: [],
  },
};

export async function execute(input: { churn_threshold?: number; ltv_percentile?: string }, profileId: string): Promise<string> {
  const churnThreshold = input.churn_threshold ?? 50;

  const { data: customers } = await supabase
    .from('customers')
    .select('total_ltv, churn_probability, acquisition_channel, rfm_score, last_purchase_at')
    .eq('user_id', profileId)
    .gte('churn_probability', churnThreshold)
    .order('total_ltv', { ascending: false });

  const custs = customers || [];
  if (custs.length === 0) {
    return `Sem clientes com probabilidade de churn acima de ${churnThreshold}% na base.`;
  }

  const ltvValues = custs.map(c => Number(c.total_ltv || 0)).sort((a, b) => b - a);
  const cutoff = input.ltv_percentile === 'top_25'
    ? ltvValues[Math.floor(ltvValues.length * 0.25)] ?? 0
    : input.ltv_percentile === 'todos'
    ? 0
    : ltvValues[Math.floor(ltvValues.length * 0.5)] ?? 0;

  const filtered = custs.filter(c => Number(c.total_ltv || 0) >= cutoff);
  const totalLtvAtRisk = filtered.reduce((s, c) => s + Number(c.total_ltv || 0), 0);
  const avgChurn = filtered.length > 0 ? filtered.reduce((s, c) => s + Number(c.churn_probability || 0), 0) / filtered.length : 0;
  const avgLtv = filtered.length > 0 ? totalLtvAtRisk / filtered.length : 0;

  const channelBreakdown: Record<string, number> = {};
  for (const c of filtered) {
    const ch = (c.acquisition_channel as string) || 'desconhecido';
    channelBreakdown[ch] = (channelBreakdown[ch] || 0) + 1;
  }
  const topChannels = Object.entries(channelBreakdown).sort((a, b) => b[1] - a[1]).slice(0, 3);

  return `Clientes em risco de churn (prob >= ${churnThreshold}%, LTV filtro: ${input.ltv_percentile ?? 'top_50'}):
Total identificado: ${filtered.length} clientes
LTV médio em risco: R$ ${fmt(avgLtv)}
LTV total em risco: R$ ${fmt(totalLtvAtRisk)}
Probabilidade média de churn: ${avgChurn.toFixed(1)}%
Canais de origem: ${topChannels.map(([ch, n]) => `${ch} (${n})`).join(', ')}

Estes ${filtered.length} clientes representam R$ ${fmt(totalLtvAtRisk)} de receita recorrente em risco. Uma campanha de reativação direcionada a este segmento é recomendável — acesse Northie Growth para ver ações disponíveis.`;
}
