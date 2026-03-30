import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 2 });

export const definition: Anthropic.Tool = {
  name: 'channel_economics',
  description: 'Retorna o ROI real por canal de aquisição cruzando LTV dos clientes adquiridos com gasto em ads. Diferente do ROAS simples — usa LTV histórico real, não apenas a receita imediata. Use quando o founder perguntar sobre qual canal tem melhor retorno, onde investir mais ou comparar canais.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function execute(_input: Record<string, never>, profileId: string): Promise<string> {
  const [channelPerf, adSpend] = await Promise.all([
    supabase.from('mv_campaign_ltv_performance').select('*').eq('user_id', profileId),
    supabase.from('ad_metrics')
      .select('platform, spend_brl, date, campaign_id')
      .eq('user_id', profileId)
      .gte('date', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]!),
  ]);

  const perf = channelPerf.data || [];
  const spend = adSpend.data || [];

  const spendByPlatform: Record<string, number> = {};
  for (const row of spend) {
    const p = row.platform as string;
    spendByPlatform[p] = (spendByPlatform[p] || 0) + Number(row.spend_brl || 0);
  }

  if (perf.length === 0 && Object.keys(spendByPlatform).length === 0) {
    return 'Sem dados de performance por canal disponíveis. Conecte Meta Ads ou Google Ads em Integrações para calcular o ROI real por canal.';
  }

  const lines = perf.map(row => {
    const roi = row.true_roi != null ? `${Number(row.true_roi).toFixed(2)}x` : 'N/A (sem dados de spend)';
    const ltv = Number(row.avg_ltv_brl || 0);
    const spendV = Number(row.total_spend_brl || 0);
    const cac = Number(row.customers_acquired || 0) > 0 ? spendV / Number(row.customers_acquired) : 0;
    const ltvCacRatio = cac > 0 ? ltv / cac : null;
    const health = ltvCacRatio == null ? 'sem dados de CAC' : ltvCacRatio >= 3 ? 'saudável (LTV/CAC >= 3x)' : ltvCacRatio >= 1 ? 'atenção (LTV/CAC 1-3x)' : 'crítico (LTV < CAC)';

    return `${row.acquisition_channel || row.platform}: ${row.customers_acquired} clientes adquiridos | LTV médio R$ ${fmt(ltv)} | gasto total R$ ${fmt(spendV)} | CAC R$ ${fmt(cac)} | ROI real ${roi} | status: ${health}`;
  });

  if (lines.length === 0) {
    const spendLines = Object.entries(spendByPlatform).map(([p, s]) => `${p}: gasto R$ ${fmt(s)} nos últimos 90 dias (sem dados de clientes adquiridos ainda)`);
    return `Gastos por plataforma (últimos 90 dias):\n${spendLines.join('\n')}\n\nPara calcular ROI real, o motor de atribuição precisa de mais dados de clientes vinculados a campanhas.`;
  }

  return `ROI real por canal de aquisição (LTV-based):\n${lines.join('\n')}`;
}
