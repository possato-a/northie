import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
  name: 'revenue_trend',
  description: 'Calcula a tendência de receita comparando períodos — mês atual vs anterior, últimos 30 dias vs 30 dias anteriores, crescimento mensal composto. Use quando o founder perguntar sobre crescimento, tendências, se o negócio está evoluindo ou comparar períodos.',
  input_schema: {
    type: 'object',
    properties: {
      granularity: {
        type: 'string',
        enum: ['mensal', 'semanal'],
        description: 'Granularidade da análise de tendência (padrão: mensal)',
      },
      periods: {
        type: 'number',
        description: 'Número de períodos para analisar (padrão: 6)',
      },
    },
    required: [],
  },
};

export async function execute(input: { granularity?: string; periods?: number }, profileId: string): Promise<string> {
  const granularity = input.granularity ?? 'mensal';
  const periods = Math.min(input.periods ?? 6, 12);
  const daysPerPeriod = granularity === 'semanal' ? 7 : 30;
  const totalDays = daysPerPeriod * periods;

  const since = new Date(Date.now() - totalDays * 24 * 60 * 60 * 1000).toISOString();

  const { data: transactions } = await supabase
    .from('transactions')
    .select('amount_net, created_at')
    .eq('user_id', profileId)
    .eq('status', 'approved')
    .gte('created_at', since)
    .order('created_at', { ascending: true });

  const trans = transactions || [];
  if (trans.length === 0) {
    return `Sem transações nos últimos ${totalDays} dias para calcular tendência.`;
  }

  const buckets: Array<{ label: string; revenue: number; count: number }> = [];
  for (let i = periods - 1; i >= 0; i--) {
    const end = new Date(Date.now() - i * daysPerPeriod * 24 * 60 * 60 * 1000);
    const start = new Date(Date.now() - (i + 1) * daysPerPeriod * 24 * 60 * 60 * 1000);
    const label = granularity === 'semanal'
      ? `Semana ${periods - i} (${start.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`
      : start.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });

    const periodTrans = trans.filter(t => {
      const d = new Date(t.created_at as string);
      return d >= start && d < end;
    });

    buckets.push({
      label,
      revenue: periodTrans.reduce((s, t) => s + Number(t.amount_net), 0),
      count: periodTrans.length,
    });
  }

  const lines = buckets.map((b, i) => {
    const prev = buckets[i - 1];
    const growth = prev && prev.revenue > 0 ? ((b.revenue - prev.revenue) / prev.revenue * 100).toFixed(1) : null;
    const growthStr = growth != null ? ` (${Number(growth) >= 0 ? '+' : ''}${growth}%)` : '';
    return `${b.label}: R$ ${fmt(b.revenue)} | ${b.count} transações${growthStr}`;
  });

  const first = buckets[0];
  const last = buckets[buckets.length - 1];
  const overallGrowth = first && last && first.revenue > 0
    ? ((last.revenue - first.revenue) / first.revenue * 100).toFixed(1)
    : null;

  return `Tendência de receita por ${granularity} (${periods} períodos):
${lines.join('\n')}
${overallGrowth != null ? `\nCrescimento acumulado no período: ${Number(overallGrowth) >= 0 ? '+' : ''}${overallGrowth}%` : ''}`;
}
