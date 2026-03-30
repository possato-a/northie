import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
  name: 'business_overview',
  description: 'Retorna um panorama financeiro completo do negócio: receita total, receita recente, ticket médio, LTV médio, CAC estimado e saúde geral. Use quando o founder perguntar sobre performance geral, crescimento ou saúde do negócio.',
  input_schema: {
    type: 'object',
    properties: {
      period_days: {
        type: 'number',
        description: 'Período em dias para análise recente (padrão: 30)',
      },
    },
    required: [],
  },
};

export async function execute(input: { period_days?: number }, profileId: string): Promise<string> {
  const days = input.period_days ?? 30;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  const [transAll, transRecent, customers] = await Promise.all([
    supabase.from('transactions').select('amount_net, amount_gross, fee_platform, created_at').eq('user_id', profileId).eq('status', 'approved'),
    supabase.from('transactions').select('amount_net, created_at').eq('user_id', profileId).eq('status', 'approved').gte('created_at', since),
    supabase.from('customers').select('total_ltv, churn_probability').eq('user_id', profileId),
  ]);

  const all = transAll.data || [];
  const recent = transRecent.data || [];
  const custs = customers.data || [];

  const totalRevenue = all.reduce((s, t) => s + Number(t.amount_net), 0);
  const totalGross = all.reduce((s, t) => s + Number(t.amount_gross), 0);
  const totalFees = all.reduce((s, t) => s + Number(t.fee_platform || 0), 0);
  const recentRevenue = recent.reduce((s, t) => s + Number(t.amount_net), 0);
  const avgTicket = all.length > 0 ? totalRevenue / all.length : 0;
  const avgLtv = custs.length > 0 ? custs.reduce((s, c) => s + Number(c.total_ltv), 0) / custs.length : 0;
  const avgChurn = custs.length > 0 ? custs.reduce((s, c) => s + Number(c.churn_probability || 0), 0) / custs.length : 0;

  return `Panorama financeiro do negócio:
Receita total acumulada (líquida): R$ ${fmt(totalRevenue)}
Receita bruta total: R$ ${fmt(totalGross)}
Taxas de plataforma pagas: R$ ${fmt(totalFees)}
Receita últimos ${days} dias: R$ ${fmt(recentRevenue)} (${recent.length} transações)
Ticket médio: R$ ${fmt(avgTicket)}
Total de clientes: ${custs.length}
LTV médio da base: R$ ${fmt(avgLtv)}
Churn médio estimado: ${avgChurn.toFixed(1)}%
Total de transações aprovadas: ${all.length}`;
}
