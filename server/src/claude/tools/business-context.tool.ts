import type Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../../lib/supabase.js';

export const definition: Anthropic.Tool = {
  name: 'business_context',
  description: 'Retorna o contexto qualitativo do negócio fornecido pelo founder: ICP, ciclo de vendas, sazonalidades, instruções personalizadas e arquivos de contexto. Use quando precisar de informações qualitativas sobre o negócio que não estão nos dados numéricos.',
  input_schema: {
    type: 'object',
    properties: {},
    required: [],
  },
};

export async function execute(_input: Record<string, never>, profileId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('business_type, business_context, ai_instructions')
    .eq('id', profileId)
    .single();

  if (!profile) return 'Sem perfil de negócio configurado.';

  const parts: string[] = [];

  if (profile.business_type) parts.push(`Tipo de negócio: ${profile.business_type}`);
  if (profile.business_context) parts.push(`Contexto do negócio:\n${profile.business_context}`);
  if (profile.ai_instructions) parts.push(`Instruções personalizadas do founder:\n${profile.ai_instructions}`);

  if (parts.length === 0) {
    return 'O founder ainda não configurou o contexto do negócio. Acesse a página "Contexto" para treinar a IA com informações sobre seu ICP, ciclo de vendas e sazonalidades.';
  }

  return parts.join('\n\n');
}
