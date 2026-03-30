import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
  name: 'customer_segments',
  description: 'Retorna análise detalhada dos segmentos de clientes por RFM (Recência, Frequência, Valor) com LTV médio e receita por segmento. Use quando o founder perguntar sobre clientes, segmentos, quem são os melhores clientes ou qual segmento focar.',
  input_schema: {
    type: 'object',
    properties: {
      segment: {
        type: 'string',
        enum: ['Champions', 'Em Risco', 'Novos Promissores', 'Inativos', 'todos'],
        description: 'Segmento específico para detalhar, ou "todos" para visão completa',
      },
    },
    required: [],
  },
};

export async function execute(input: { segment?: string }, profileId: string): Promise<string> {
  const { data: customers } = await supabase
    .from('customers')
    .select('acquisition_channel, total_ltv, churn_probability, rfm_score, last_purchase_at')
    .eq('user_id', profileId);

  const custs = customers || [];
  if (custs.length === 0) return 'Sem clientes cadastrados ainda.';

  type SegKey = 'Champions' | 'Em Risco' | 'Novos Promissores' | 'Inativos';
  const segments: Record<SegKey, { count: number; ltvSum: number; churnSum: number; channels: Record<string, number> }> = {
    Champions: { count: 0, ltvSum: 0, churnSum: 0, channels: {} },
    'Em Risco': { count: 0, ltvSum: 0, churnSum: 0, channels: {} },
    'Novos Promissores': { count: 0, ltvSum: 0, churnSum: 0, channels: {} },
    Inativos: { count: 0, ltvSum: 0, churnSum: 0, channels: {} },
  };

  for (const c of custs) {
    const score = c.rfm_score as string;
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

    const s = segments[seg];
    s.count++;
    s.ltvSum += Number(c.total_ltv || 0);
    s.churnSum += Number(c.churn_probability || 0);
    const ch = (c.acquisition_channel as string) || 'desconhecido';
    s.channels[ch] = (s.channels[ch] || 0) + 1;
  }

  const targetSegs: SegKey[] = input.segment && input.segment !== 'todos'
    ? [input.segment as SegKey]
    : ['Champions', 'Em Risco', 'Novos Promissores', 'Inativos'];

  const lines = targetSegs.map(seg => {
    const s = segments[seg];
    if (s.count === 0) return `${seg}: sem clientes neste segmento`;
    const avgLtv = s.ltvSum / s.count;
    const avgChurn = s.churnSum / s.count;
    const topChannel = Object.entries(s.channels).sort((a, b) => b[1] - a[1])[0];
    return `${seg}: ${s.count} clientes | LTV médio R$ ${fmt(avgLtv)} | LTV total R$ ${fmt(s.ltvSum)} | churn médio ${avgChurn.toFixed(1)}% | canal principal: ${topChannel ? `${topChannel[0]} (${topChannel[1]})` : 'N/A'}`;
  });

  return `Segmentação RFM da base de ${custs.length} clientes:\n${lines.join('\n')}`;
}
