import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

export const definition: Anthropic.Tool = {
  name: 'growth_recommendations',
  description: 'Retorna as recomendações do Northie Growth Engine com detalhes completos: narrativa, impacto estimado, dados que geraram a recomendação e segmentos envolvidos. Use quando o founder perguntar sobre ações de growth, recomendações pendentes ou quiser entender o raciocínio por trás de uma ação específica.',
  input_schema: {
    type: 'object',
    properties: {
      status_filter: {
        type: 'string',
        enum: ['pending', 'all', 'completed'],
        description: 'Filtrar por status (padrão: pending)',
      },
      type_filter: {
        type: 'string',
        description: 'Tipo específico de recomendação para detalhar (ex: reativacao_alto_ltv)',
      },
    },
    required: [],
  },
};

export async function execute(input: { status_filter?: string; type_filter?: string }, profileId: string): Promise<string> {
  const statusFilter = input.status_filter ?? 'pending';

  let query = supabase
    .from('growth_recommendations')
    .select('id, type, title, narrative, impact_estimate, meta, status, created_at')
    .eq('user_id', profileId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (statusFilter === 'pending') {
    query = query.in('status', ['pending', 'approved', 'executing']);
  } else if (statusFilter === 'completed') {
    query = query.in('status', ['completed', 'failed']);
  }

  if (input.type_filter) {
    query = query.eq('type', input.type_filter);
  }

  const { data: recs } = await query;
  const list = recs || [];

  if (list.length === 0) {
    return statusFilter === 'pending'
      ? 'Sem recomendações pendentes no momento. O motor de correlações analisa os dados automaticamente e gera novas ações quando identifica oportunidades.'
      : 'Sem recomendações encontradas com esses filtros.';
  }

  const lines = list.map(r => {
    const meta = r.meta as Record<string, unknown> | null;
    const sources = Array.isArray(meta?.sources) ? (meta.sources as string[]).join(' × ') : 'múltiplas fontes';
    return `[${r.status}] ${r.title} (tipo: ${r.type})
Narrativa: ${r.narrative}
Impacto estimado: ${r.impact_estimate}
Fontes cruzadas: ${sources}
ID: ${r.id}`;
  });

  return `Recomendações do Growth Engine (${statusFilter}):\n\n${lines.join('\n\n')}`;
}
