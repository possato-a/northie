export type AgentId =
  | 'orchestrator'
  | 'roas' | 'cac' | 'audience' | 'creatives'
  | 'ltv' | 'mrr' | 'upsell' | 'margin'
  | 'churn' | 'rfm' | 'cohort' | 'reactivation'
  | 'ecommerce' | 'email' | 'pipeline'
  | 'whatsapp' | 'nps' | 'engagement'
  | 'valuation' | 'health'

export interface AgentInfo {
  id: AgentId
  name: string
  group: string
  description: string
  sources: string[]
  quickSuggestions: string[]
}

export const AGENT_LIST: AgentInfo[] = [
  // Orquestrador
  {
    id: 'orchestrator',
    name: 'Northie Growth',
    group: 'Orquestrador',
    description: 'Análise completa do negócio com dados de todas as fontes',
    sources: ['Todos'],
    quickSuggestions: [
      'Como está a saúde geral do negócio?',
      'Quais são as 3 maiores oportunidades agora?',
      'Onde estou perdendo mais dinheiro?',
      'O que devo priorizar essa semana?',
    ],
  },
  // Aquisição & Mídia Paga
  {
    id: 'roas',
    name: 'ROAS Real',
    group: 'Aquisição & Mídia Paga',
    description: 'ROAS superficial vs LTV real por campanha',
    sources: ['Meta Ads', 'Google Ads', 'Stripe', 'Hotmart'],
    quickSuggestions: [
      'Por que meu ROAS caiu?',
      'Qual campanha tem melhor ROAS real?',
      'Onde estou desperdiçando budget?',
      'Quais criativos estão em fadiga?',
    ],
  },
  {
    id: 'cac',
    name: 'CAC & Aquisição',
    group: 'Aquisição & Mídia Paga',
    description: 'Custo real de aquisição e qualidade por canal',
    sources: ['Meta Ads', 'Google Ads', 'Hotmart', 'Stripe'],
    quickSuggestions: [
      'Qual canal tem o menor CAC real?',
      'Meu LTV:CAC está saudável?',
      'Qual canal devo aumentar investimento?',
      'Qual canal tem pior qualidade de cliente?',
    ],
  },
  {
    id: 'audience',
    name: 'Audience Quality',
    group: 'Aquisição & Mídia Paga',
    description: 'Lookalike e segmentos de alta conversão',
    sources: ['Meta Ads', 'Google Ads'],
    quickSuggestions: [
      'Crie Lookalike só com Champions',
      'Há sobreposição nas minhas audiências?',
      'Qual segmento usar para reativação?',
      'Minha lista de exclusão está atualizada?',
    ],
  },
  {
    id: 'creatives',
    name: 'Criativos',
    group: 'Aquisição & Mídia Paga',
    description: 'Performance e fadiga de criativos por formato',
    sources: ['Meta Ads', 'Google Ads'],
    quickSuggestions: [
      'Quais criativos estão em fadiga?',
      'Qual formato está performando melhor?',
      'Qual criativo tem melhor ROAS real?',
      'Quando devo trocar os criativos ativos?',
    ],
  },
  // Financeiro & Receita
  {
    id: 'ltv',
    name: 'LTV por Canal',
    group: 'Financeiro & Receita',
    description: 'Valor do cliente no longo prazo por origem',
    sources: ['Stripe', 'Hotmart', 'Meta Ads', 'Google Ads'],
    quickSuggestions: [
      'Qual canal traz clientes com maior LTV?',
      'Meu LTV está melhorando ou piorando?',
      'Compare Meta vs Google em LTV real',
      'Qual oferta gera o maior LTV?',
    ],
  },
  {
    id: 'mrr',
    name: 'Receita & MRR',
    group: 'Financeiro & Receita',
    description: 'MRR, crescimento e saúde da receita recorrente',
    sources: ['Stripe', 'Hotmart', 'Shopify'],
    quickSuggestions: [
      'Como está meu MRR este mês?',
      'Qual produto gera mais receita?',
      'Como está minha concentração de receita?',
      'Qual é meu ARR atual?',
    ],
  },
  {
    id: 'upsell',
    name: 'Upsell Timing',
    group: 'Financeiro & Receita',
    description: 'Janela exata de máxima propensão por cliente',
    sources: ['Stripe', 'Hotmart', 'Shopify'],
    quickSuggestions: [
      'Quem devo abordar hoje para upsell?',
      'Qual a receita potencial desta semana?',
      'Monte sequência de reativação',
      'Qual produto fazer upsell agora?',
    ],
  },
  {
    id: 'margin',
    name: 'Margem Real',
    group: 'Financeiro & Receita',
    description: 'Margem líquida após taxas, CAC e custo de entrega',
    sources: ['Stripe', 'Hotmart', 'Shopify', 'Meta Ads', 'Google Ads'],
    quickSuggestions: [
      'Qual é minha margem real hoje?',
      'Qual canal tem melhor margem líquida?',
      'Quanto estou pagando de taxas por mês?',
      'Qual produto é mais rentável?',
    ],
  },
  // Retenção & Comportamento
  {
    id: 'churn',
    name: 'Churn Detector',
    group: 'Retenção & Comportamento',
    description: 'Detecta abandono de alto LTV antes que aconteça',
    sources: ['Stripe', 'Hotmart', 'Shopify'],
    quickSuggestions: [
      'Quem está prestes a churnar?',
      'Qual cohort tem maior churn?',
      'Qual a receita em risco esta semana?',
      'Meus top clientes estão ativos?',
    ],
  },
  {
    id: 'rfm',
    name: 'Segmentação RFM',
    group: 'Retenção & Comportamento',
    description: 'Segmentos por Recência, Frequência e Valor',
    sources: ['Stripe', 'Hotmart', 'Shopify'],
    quickSuggestions: [
      'Como está distribuída minha base?',
      'Quantos Champions eu tenho?',
      'Quais clientes estão em risco de cair de segmento?',
      'Qual segmento tem maior potencial?',
    ],
  },
  {
    id: 'cohort',
    name: 'Cohort & Retenção',
    group: 'Retenção & Comportamento',
    description: 'Retenção por período de aquisição',
    sources: ['Stripe', 'Hotmart', 'Shopify'],
    quickSuggestions: [
      'Qual cohort tem melhor retenção?',
      'Minha retenção está melhorando?',
      'Qual canal produz cohorts com maior LTV?',
      'Compare cohorts recentes vs antigos',
    ],
  },
  {
    id: 'reactivation',
    name: 'Reativação',
    group: 'Retenção & Comportamento',
    description: 'Recuperação de receita de clientes inativos',
    sources: ['Stripe', 'Hotmart', 'Shopify'],
    quickSuggestions: [
      'Quais clientes inativos vale reativar?',
      'Quanto de receita posso recuperar esta semana?',
      'Monte campanha para Hibernando',
      'Qual canal tem melhor taxa de reativação?',
    ],
  },
  // Produto & Operações
  {
    id: 'ecommerce',
    name: 'E-commerce',
    group: 'Produto & Operações',
    description: 'Performance da loja Shopify',
    sources: ['Shopify'],
    quickSuggestions: [
      'Qual é meu AOV atual?',
      'Qual produto está crescendo mais?',
      'Como está minha taxa de recompra?',
      'Qual fonte de tráfego converte mais?',
    ],
  },
  {
    id: 'email',
    name: 'Email & Comunicação',
    group: 'Produto & Operações',
    description: 'Receita por email e performance de campanhas',
    sources: ['Resend'],
    quickSuggestions: [
      'Como estão minhas taxas de abertura?',
      'Qual campanha gerou mais receita?',
      'Quando é o melhor horário para enviar?',
      'Qual segmento responde melhor?',
    ],
  },
  {
    id: 'pipeline',
    name: 'Pipeline de Vendas',
    group: 'Produto & Operações',
    description: 'Reuniões, show-up rate e fechamento',
    sources: ['Google Calendar', 'Google Meet'],
    quickSuggestions: [
      'Qual é meu show-up rate atual?',
      'Qual canal de lead converte mais?',
      'Quanto de receita tenho no pipeline?',
      'Qual é meu tempo médio de fechamento?',
    ],
  },
  // Relacionamento & CX
  {
    id: 'whatsapp',
    name: 'WhatsApp & Atendimento',
    group: 'Relacionamento & CX',
    description: 'Insights de retenção via atendimento',
    sources: ['WhatsApp Business'],
    quickSuggestions: [
      'Há clientes VIP sem resposta?',
      'Qual é meu tempo médio de resposta?',
      'Quais são os temas mais reclamados?',
      'O suporte está impactando o churn?',
    ],
  },
  {
    id: 'nps',
    name: 'NPS & Satisfação',
    group: 'Relacionamento & CX',
    description: 'Correlação satisfação e comportamento financeiro',
    sources: ['Resend', 'Hotmart'],
    quickSuggestions: [
      'Qual é meu NPS atual?',
      'Clientes insatisfeitos estão churnando mais?',
      'Qual produto tem melhor NPS?',
      'O que os detratores mais reclamam?',
    ],
  },
  {
    id: 'engagement',
    name: 'Engajamento com Produto',
    group: 'Relacionamento & CX',
    description: 'Uso do produto vs retenção e LTV',
    sources: ['Hotmart', 'Shopify'],
    quickSuggestions: [
      'Qual é minha taxa de ativação?',
      'Quais clientes têm baixo engajamento e alto valor?',
      'O engajamento está caindo?',
      'Qual produto tem melhor engajamento?',
    ],
  },
  // Valuation & Saúde
  {
    id: 'valuation',
    name: 'Valuation & Múltiplos',
    group: 'Valuation & Saúde',
    description: 'Valor do negócio e métricas para investidores',
    sources: ['Stripe', 'Hotmart', 'Shopify', 'Meta Ads', 'Google Ads'],
    quickSuggestions: [
      'Quanto vale meu negócio hoje?',
      'Passo no Rule of 40?',
      'Qual é meu NRR atual?',
      'Como melhorar meu múltiplo?',
    ],
  },
  {
    id: 'health',
    name: 'Saúde do Negócio',
    group: 'Valuation & Saúde',
    description: 'Diagnóstico executivo semanal completo',
    sources: ['Stripe', 'Hotmart', 'Shopify', 'Meta Ads', 'Google Ads'],
    quickSuggestions: [
      'Como está a saúde geral do negócio?',
      'Quais são os 3 maiores riscos agora?',
      'Qual é o forecast dos próximos 3 meses?',
      'O que devo priorizar essa semana?',
    ],
  },
]

export const AGENT_BY_ID: Record<string, AgentInfo> = Object.fromEntries(
  AGENT_LIST.map(a => [a.id, a])
)

export const AGENT_GROUPS: Record<string, AgentInfo[]> = AGENT_LIST.reduce(
  (acc, agent) => {
    if (!acc[agent.group]) acc[agent.group] = []
    acc[agent.group].push(agent)
    return acc
  },
  {} as Record<string, AgentInfo[]>
)
