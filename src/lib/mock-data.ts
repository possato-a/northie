/**
 * Mock data for demo/screenshot mode.
 * Activated by setting DEMO_MODE = true in api.ts
 * DELETE THIS FILE after taking screenshots.
 */

// ── Helpers ────────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

function randomBetween(min: number, max: number): number {
  return Math.round(min + Math.random() * (max - min))
}

// ── Dashboard Full ──────────────────────────────────────────────────────────────

function generateChart(days: number) {
  const pts = []
  let base = 4200
  for (let i = days; i >= 0; i--) {
    base += randomBetween(-300, 600)
    if (base < 2000) base = 2000 + randomBetween(0, 500)
    pts.push({ date: daysAgo(i), amount: base })
  }
  return pts
}

function generateHeatmap() {
  const hm: Record<string, number> = {}
  for (let i = 365; i >= 0; i--) {
    const day = new Date()
    day.setDate(day.getDate() - i)
    const dow = day.getDay()
    const rand = Math.random()
    // ~25% of days have zero sales
    if (rand < 0.25) { hm[day.toISOString().slice(0, 10)] = 0; continue }
    // weekends: fewer sales (0-3), weekdays: more spread (0-12)
    let count: number
    if (dow === 0 || dow === 6) {
      count = randomBetween(0, 3)
    } else {
      // weighted distribution: most days 1-4, some 5-8, few 9-12
      const r = Math.random()
      if (r < 0.45) count = randomBetween(1, 3)
      else if (r < 0.75) count = randomBetween(3, 6)
      else if (r < 0.92) count = randomBetween(6, 10)
      else count = randomBetween(10, 14)
    }
    hm[day.toISOString().slice(0, 10)] = count
  }
  return hm
}

const MOCK_AD_CAMPAIGNS = [
  { campaign_id: 'c1', campaign_name: 'ESCRITA-MEMÓRIAS — Conversão', platform: 'meta_ads', spend_brl: 4892, roas: 3.47, impressions: 187420, clicks: 3218, ctr: 1.72, cpc_brl: 1.52, cpm_brl: 26.1, purchases: 47, purchase_value: 16976, leads: 0, results: 47, result_type: 'purchase', cost_per_result: 104.09, status: 'ACTIVE', objective: 'OUTCOME_SALES' },
  { campaign_id: 'c2', campaign_name: 'MENTORIA-PREMIUM — Tráfego', platform: 'meta_ads', spend_brl: 2340, roas: 2.89, impressions: 124500, clicks: 2890, ctr: 2.32, cpc_brl: 0.81, cpm_brl: 18.8, purchases: 18, purchase_value: 6763, leads: 0, results: 18, result_type: 'purchase', cost_per_result: 130.0, status: 'ACTIVE', objective: 'OUTCOME_SALES' },
  { campaign_id: 'c3', campaign_name: 'EBOOK-GRATIS — Leads', platform: 'meta_ads', spend_brl: 1580, roas: 0, impressions: 98700, clicks: 4120, ctr: 4.17, cpc_brl: 0.38, cpm_brl: 16.01, purchases: 0, purchase_value: 0, leads: 312, results: 312, result_type: 'lead', cost_per_result: 5.06, status: 'ACTIVE', objective: 'OUTCOME_LEADS' },
  { campaign_id: 'c4', campaign_name: 'RETARGETING-CARRINHO', platform: 'meta_ads', spend_brl: 890, roas: 5.12, impressions: 42300, clicks: 1280, ctr: 3.02, cpc_brl: 0.7, cpm_brl: 21.04, purchases: 23, purchase_value: 4557, leads: 0, results: 23, result_type: 'purchase', cost_per_result: 38.7, status: 'ACTIVE', objective: 'OUTCOME_SALES' },
  { campaign_id: 'c5', campaign_name: 'CURSO-COMPLETO — Search', platform: 'google_ads', spend_brl: 3210, roas: 2.64, impressions: 67800, clicks: 2450, ctr: 3.61, cpc_brl: 1.31, cpm_brl: 47.35, purchases: 28, purchase_value: 8474, leads: 0, results: 28, result_type: 'purchase', cost_per_result: 114.64, status: 'ACTIVE', objective: 'SEARCH' },
  { campaign_id: 'c6', campaign_name: 'BRAND-AWARENESS — Display', platform: 'google_ads', spend_brl: 1450, roas: 1.82, impressions: 312000, clicks: 1870, ctr: 0.6, cpc_brl: 0.78, cpm_brl: 4.65, purchases: 9, purchase_value: 2639, leads: 0, results: 9, result_type: 'purchase', cost_per_result: 161.11, status: 'ACTIVE', objective: 'DISPLAY' },
  { campaign_id: 'c7', campaign_name: 'YOUTUBE-DEPOIMENTOS', platform: 'google_ads', spend_brl: 980, roas: 2.18, impressions: 89400, clicks: 1340, ctr: 1.5, cpc_brl: 0.73, cpm_brl: 10.96, purchases: 7, purchase_value: 2136, leads: 0, results: 7, result_type: 'purchase', cost_per_result: 140.0, status: 'PAUSED', objective: 'VIDEO' },
  { campaign_id: 'c8', campaign_name: 'REMARKETING-COMPRADORES', platform: 'meta_ads', spend_brl: 670, roas: 4.21, impressions: 34200, clicks: 890, ctr: 2.6, cpc_brl: 0.75, cpm_brl: 19.59, purchases: 14, purchase_value: 2821, leads: 0, results: 14, result_type: 'purchase', cost_per_result: 47.86, status: 'ACTIVE', objective: 'OUTCOME_SALES' },
]

const MOCK_ATTRIBUTION = [
  { channel: 'Meta Ads', revenue: 31117, spend: 10382, customers: 72, roas: 3.0, cac: 144.19, ltv: 432.18 },
  { channel: 'Google Ads', revenue: 13249, spend: 5640, customers: 31, roas: 2.35, cac: 181.94, ltv: 427.39 },
  { channel: 'Orgânico', revenue: 8940, spend: 0, customers: 24, roas: 0, cac: 0, ltv: 372.5 },
  { channel: 'Direto', revenue: 4120, spend: 0, customers: 15, roas: 0, cac: 0, ltv: 274.67 },
]

const MOCK_TOP_CUSTOMERS = [
  { name: 'Mariana Costa', email: 'mariana@email.com', total_ltv: 4890, cac: 127 },
  { name: 'Rafael Oliveira', email: 'rafael@email.com', total_ltv: 3760, cac: 89 },
  { name: 'Juliana Santos', email: 'juliana@email.com', total_ltv: 3420, cac: 156 },
  { name: 'Pedro Almeida', email: 'pedro@email.com', total_ltv: 2980, cac: 112 },
  { name: 'Camila Ferreira', email: 'camila@email.com', total_ltv: 2740, cac: 95 },
  { name: 'Lucas Mendes', email: 'lucas@email.com', total_ltv: 2310, cac: 143 },
  { name: 'Beatriz Lima', email: 'beatriz@email.com', total_ltv: 1890, cac: 78 },
  { name: 'Gabriel Rocha', email: 'gabriel@email.com', total_ltv: 1650, cac: 164 },
]

export function mockDashboardFull(_days: number) {
  return {
    stats: {
      total_revenue: 187426,
      total_customers: 142,
      total_transactions: 376,
      average_ticket: 498,
      active_customers: 142,
      churn_rate: 3.2,
    },
    adCampaigns: MOCK_AD_CAMPAIGNS,
    growth: { growth_percentage: 24.7 },
    chart: generateChart(30),
    attribution: MOCK_ATTRIBUTION,
    topCustomers: MOCK_TOP_CUSTOMERS,
    heatmap: generateHeatmap(),
  }
}

// ── Transactions (Vendas) ──────────────────────────────────────────────────────

const PRODUCTS = ['Mentoria Premium', 'Curso Completo', 'E-book Memórias', 'Workshop Intensivo', 'Consultoria 1:1', 'Assinatura Mensal']
const METHODS: Array<'Pix' | 'Cartão' | 'Boleto'> = ['Pix', 'Cartão', 'Cartão', 'Cartão', 'Pix', 'Boleto']
const STATUSES: Array<'Pago' | 'Pendente' | 'Reembolsado'> = ['Pago', 'Pago', 'Pago', 'Pago', 'Pago', 'Pago', 'Pago', 'Pendente', 'Reembolsado']
const CHANNELS: Array<'Meta Ads' | 'Google Ads' | 'Hotmart' | 'Direto'> = ['Meta Ads', 'Meta Ads', 'Google Ads', 'Hotmart', 'Direto']
const NAMES = [
  'Mariana Costa', 'Rafael Oliveira', 'Juliana Santos', 'Pedro Almeida',
  'Camila Ferreira', 'Lucas Mendes', 'Beatriz Lima', 'Gabriel Rocha',
  'Ana Paula Souza', 'Thiago Ribeiro', 'Fernanda Silva', 'Diego Nascimento',
  'Larissa Moura', 'Bruno Cardoso', 'Isabela Martins', 'Vinícius Pereira',
  'Carolina Gomes', 'Matheus Araújo', 'Amanda Barbosa', 'Henrique Dias',
  'Letícia Correia', 'Gustavo Nunes', 'Priscila Lopes', 'Rodrigo Teixeira',
]

function generateTransactions(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: `tx_${String(i + 1).padStart(4, '0')}`,
    date: daysAgo(randomBetween(0, 89)),
    client: NAMES[i % NAMES.length],
    product: PRODUCTS[randomBetween(0, PRODUCTS.length - 1)],
    value: [197, 297, 497, 997, 1497, 47][randomBetween(0, 5)],
    method: METHODS[randomBetween(0, METHODS.length - 1)],
    status: STATUSES[randomBetween(0, STATUSES.length - 1)] as 'Pago' | 'Pendente' | 'Reembolsado',
    channel: CHANNELS[randomBetween(0, CHANNELS.length - 1)],
  })).sort((a, b) => b.date.localeCompare(a.date))
}

export function mockTransactions() {
  return generateTransactions(42)
}

export function mockDashboardStats(_days: number) {
  return {
    total_revenue: 187426,
    total_customers: 142,
    total_transactions: 376,
    average_ticket: 498,
    active_customers: 142,
    churn_rate: 3.2,
  }
}

// ── Customers (Clientes) ──────────────────────────────────────────────────────

function generateCustomers() {
  const rfmScores = ['554', '543', '445', '334', '233', '122', '455', '345', '234', '511']
  const channels = ['meta_ads', 'google_ads', 'meta_ads', 'organico', 'meta_ads', 'email', 'google_ads', 'direto', 'meta_ads', 'hotmart']

  return NAMES.map((name, i) => {
    const ltv = [4890, 3760, 3420, 2980, 2740, 2310, 1890, 1650, 1420, 980, 870, 750, 640, 520, 490, 380, 320, 270, 210, 150, 97, 47, 997, 497][i] || randomBetween(100, 2000)
    const rfm = rfmScores[i % rfmScores.length]
    return {
      id: `cust_${String(i + 1).padStart(3, '0')}`,
      email: `${name.split(' ')[0].toLowerCase()}@email.com`,
      name,
      phone: `+5511${randomBetween(90000, 99999)}${randomBetween(1000, 9999)}`,
      total_ltv: ltv,
      acquisition_channel: channels[i % channels.length],
      rfm_score: rfm,
      rfm_segment: (() => {
        const r = parseInt(rfm[0]), f = parseInt(rfm[1]), m = parseInt(rfm[2])
        if (r >= 4 && f >= 3 && m >= 3) return 'Champions'
        if (r <= 2 && (m >= 3 || f >= 3)) return 'Em Risco'
        if ((r + f + m) / 3 <= 2) return 'Inativos'
        return 'Novos Promissores'
      })(),
      churn_probability: parseFloat((Math.random() * 0.3).toFixed(2)),
      last_purchase_at: new Date(Date.now() - randomBetween(1, 60) * 86400000).toISOString(),
      cac: randomBetween(40, 200),
      created_at: new Date(Date.now() - randomBetween(30, 365) * 86400000).toISOString(),
    }
  })
}

export function mockCustomers() {
  return generateCustomers()
}

// ── Ad Campaigns (Canais) ──────────────────────────────────────────────────────

export function mockAdCampaigns() {
  return MOCK_AD_CAMPAIGNS
}

export function mockChannelTrends() {
  const gen = (base: number, variance: number) =>
    Array.from({ length: 30 }, () => Math.max(0, base + (Math.random() - 0.4) * variance))
  return {
    'meta ads': { roas: gen(3.2, 1.8), cac: gen(135, 60) },
    'google ads': { roas: gen(2.4, 1.4), cac: gen(170, 50) },
  }
}

export function mockAdCampaignDetail() {
  return {
    adsets: [
      { id: 'as1', name: 'Interesse — Escrita Criativa', spend_brl: 2100, impressions: 78400, clicks: 1820, purchases: 19, roas: 3.61, status: 'ACTIVE' },
      { id: 'as2', name: 'Lookalike — Compradores LTV Alto', spend_brl: 1680, impressions: 54200, clicks: 1120, purchases: 15, roas: 3.92, status: 'ACTIVE' },
      { id: 'as3', name: 'Remarketing — Visitantes 7d', spend_brl: 1112, impressions: 34800, clicks: 780, purchases: 13, roas: 4.78, status: 'ACTIVE' },
    ],
    ads: [
      { id: 'ad1', name: 'Video Depoimento — Ana', spend_brl: 1420, impressions: 52300, clicks: 1240, ctr: 2.37, cpc_brl: 1.15, purchases: 14, roas: 3.89, status: 'ACTIVE', creative_url: null },
      { id: 'ad2', name: 'Carrossel — Antes e Depois', spend_brl: 1180, impressions: 41200, clicks: 980, ctr: 2.38, cpc_brl: 1.2, purchases: 11, roas: 3.41, status: 'ACTIVE', creative_url: null },
      { id: 'ad3', name: 'Imagem Estática — Oferta', spend_brl: 890, impressions: 38700, clicks: 720, ctr: 1.86, cpc_brl: 1.24, purchases: 8, roas: 2.94, status: 'ACTIVE', creative_url: null },
    ],
  }
}

// ── Card ────────────────────────────────────────────────────────────────────────

export function mockCardScore() {
  return {
    score: 78,
    dimensions: {
      revenue_consistency: 82,
      customer_quality: 75,
      acquisition_efficiency: 71,
      platform_tenure: 84,
    },
    credit_limit_brl: 50000,
    snapshot_month: '2026-03',
    metrics: {
      mrr_avg: 15620,
      ltv_avg: 432,
      churn_rate: 3.2,
      ltv_cac_ratio: 3.1,
      months_on_platform: 8,
    },
  }
}

export function mockCardHistory() {
  return [
    { month: '2025-08', score: 42, credit_limit_brl: 15000 },
    { month: '2025-09', score: 48, credit_limit_brl: 18000 },
    { month: '2025-10', score: 55, credit_limit_brl: 25000 },
    { month: '2025-11', score: 61, credit_limit_brl: 30000 },
    { month: '2025-12', score: 64, credit_limit_brl: 32000 },
    { month: '2026-01', score: 70, credit_limit_brl: 40000 },
    { month: '2026-02', score: 74, credit_limit_brl: 45000 },
    { month: '2026-03', score: 78, credit_limit_brl: 50000 },
  ]
}

export function mockCardApplication() {
  return {
    id: 'app_001',
    status: 'approved',
    requested_limit_brl: 50000,
    approved_limit_brl: 50000,
    used_limit_brl: 12400,
    split_rate: 0.08,
    created_at: '2026-02-15T10:00:00Z',
    updated_at: '2026-02-17T14:30:00Z',
  }
}

// ── Growth ──────────────────────────────────────────────────────────────────────

export function mockGrowthRecommendations() {
  return [
    {
      id: 'rec_001',
      type: 'reativacao_alto_ltv',
      status: 'pending',
      title: 'Reativar 8 clientes Champions inativos via WhatsApp',
      narrative: '8 clientes com LTV médio de R$ 2.840 não compram há mais de 45 dias. O histórico mostra que 62% dos Champions reativados por WhatsApp voltam a comprar em até 14 dias. Impacto estimado: R$ 12.400 em receita incremental.',
      impact_estimate: 'R$ 12.400',
      sources: ['hotmart', 'meta_ads'],
      execution_log: [],
      meta: { customer_count: 8, avg_ltv: 2840 },
      created_at: daysAgo(0) + 'T08:00:00Z',
      updated_at: daysAgo(0) + 'T08:00:00Z',
    },
    {
      id: 'rec_002',
      type: 'pausa_campanha_ltv_baixo',
      status: 'pending',
      title: 'Pausar "BRAND-AWARENESS" — LTV dos compradores 68% abaixo da média',
      narrative: 'A campanha "BRAND-AWARENESS — Display" tem ROAS de 1.82x, mas o LTV médio dos clientes adquiridos é R$ 138 vs R$ 432 da base geral. Clientes dessa campanha têm 2.4x mais chance de churn em 60 dias. Realocar o budget para Retargeting aumentaria o ROI projetado em 47%.',
      impact_estimate: 'Economia de R$ 1.450/mês',
      sources: ['google_ads', 'stripe'],
      execution_log: [],
      meta: { campaign_name: 'BRAND-AWARENESS — Display', campaign_ltv: 138, avg_ltv: 432 },
      created_at: daysAgo(1) + 'T10:00:00Z',
      updated_at: daysAgo(1) + 'T10:00:00Z',
    },
    {
      id: 'rec_003',
      type: 'audience_sync_champions',
      status: 'completed',
      title: 'Sync de audiência Champions para Lookalike no Meta Ads',
      narrative: 'Foram sincronizados 47 clientes Champions (LTV > R$ 2.000) como Custom Audience no Meta Ads. Lookalike gerado com 1% de semelhança para otimizar aquisição de clientes de alto valor.',
      impact_estimate: 'CAC projetado -23%',
      sources: ['meta_ads', 'hotmart'],
      execution_log: [
        { step: 'Extrair lista de Champions', status: 'done', timestamp: daysAgo(3) + 'T09:00:00Z' },
        { step: 'Upload Custom Audience no Meta', status: 'done', timestamp: daysAgo(3) + 'T09:02:00Z' },
        { step: 'Criar Lookalike 1%', status: 'done', timestamp: daysAgo(3) + 'T09:05:00Z' },
      ],
      meta: { audience_size: 47 },
      created_at: daysAgo(3) + 'T08:00:00Z',
      updated_at: daysAgo(3) + 'T09:05:00Z',
    },
    {
      id: 'rec_004',
      type: 'realocacao_budget',
      status: 'executing',
      title: 'Realocar R$ 890 de Display para Retargeting',
      narrative: 'O canal Retargeting tem ROAS de 5.12x vs 1.82x do Display. Realocar o budget excedente do Display para Retargeting otimiza o ROAS global em 31%. Baseado no histórico de 90 dias de ambas as campanhas.',
      impact_estimate: '+R$ 2.670/mês incremental',
      sources: ['meta_ads', 'google_ads'],
      execution_log: [
        { step: 'Reduzir budget Display para R$ 560/dia', status: 'done', timestamp: daysAgo(0) + 'T07:00:00Z' },
        { step: 'Aumentar budget Retargeting para R$ 1.760/dia', status: 'running', timestamp: daysAgo(0) + 'T07:02:00Z' },
      ],
      meta: { from_campaign: 'BRAND-AWARENESS', to_campaign: 'RETARGETING-CARRINHO', amount: 890 },
      created_at: daysAgo(0) + 'T06:00:00Z',
      updated_at: daysAgo(0) + 'T07:02:00Z',
    },
    {
      id: 'rec_005',
      type: 'upsell_cohort',
      status: 'pending',
      title: 'Upsell de Mentoria Premium para cohort de março',
      narrative: 'O cohort de março tem 18 compradores de "Curso Completo" com ticket médio de R$ 497. Historicamente, 34% dos compradores do curso fazem upgrade para Mentoria Premium (R$ 1.497) quando contatados por email entre 21-30 dias após a compra. Janela ideal: próximos 9 dias.',
      impact_estimate: 'R$ 9.162 potencial',
      sources: ['hotmart', 'stripe'],
      execution_log: [],
      meta: { cohort_size: 18, upgrade_rate: 0.34 },
      created_at: daysAgo(0) + 'T12:00:00Z',
      updated_at: daysAgo(0) + 'T12:00:00Z',
    },
    {
      id: 'rec_006',
      type: 'em_risco_alto_valor',
      status: 'dismissed',
      title: '3 clientes VIP com sinais de churn — ação preventiva',
      narrative: 'Mariana Costa (LTV R$ 4.890), Rafael Oliveira (LTV R$ 3.760) e Juliana Santos (LTV R$ 3.420) não interagem há 38 dias e a probabilidade de churn subiu para 28%. Mensagem personalizada via WhatsApp pode reduzir a probabilidade de churn em 45%.',
      impact_estimate: 'Proteger R$ 12.070 em LTV',
      sources: ['hotmart', 'meta_ads'],
      execution_log: [],
      meta: { customers: ['Mariana Costa', 'Rafael Oliveira', 'Juliana Santos'] },
      created_at: daysAgo(5) + 'T15:00:00Z',
      updated_at: daysAgo(4) + 'T09:00:00Z',
    },
  ]
}

export function mockGrowthMetrics() {
  return {
    total_actions: 12,
    completed_actions: 7,
    pending_actions: 3,
    revenue_generated: 34200,
    revenue_protected: 18400,
    avg_impact: 4371,
  }
}

export function mockGrowthExecutionHistory() {
  return [
    { id: 'exec_001', type: 'audience_sync_champions', title: 'Sync Champions → Meta Lookalike', status: 'completed', impact: 'CAC -19% na primeira semana', completed_at: daysAgo(3) + 'T09:05:00Z' },
    { id: 'exec_002', type: 'reativacao_alto_ltv', title: 'Reativação de 5 Champions via WhatsApp', status: 'completed', impact: 'R$ 7.480 em vendas recuperadas', completed_at: daysAgo(7) + 'T14:20:00Z' },
    { id: 'exec_003', type: 'pausa_campanha_ltv_baixo', title: 'Pausa campanha "AWARENESS-GENÉRICA"', status: 'completed', impact: 'Economia de R$ 2.100/mês', completed_at: daysAgo(14) + 'T11:00:00Z' },
    { id: 'exec_004', type: 'upsell_cohort', title: 'Upsell fevereiro — Curso → Mentoria', status: 'completed', impact: 'R$ 5.988 em upgrades (4 clientes)', completed_at: daysAgo(21) + 'T16:45:00Z' },
  ]
}

export function mockGrowthDiagnostic() {
  return {
    id: 'diag_001',
    created_at: daysAgo(0) + 'T06:00:00Z',
    summary: 'Negócio em crescimento saudável. LTV/CAC de 3.1x está acima do benchmark (2.5x). Principal oportunidade: reativar Champions inativos e otimizar budget de Display para Retargeting.',
    health_score: 82,
    key_insights: [
      'LTV/CAC ratio de 3.1x — acima do benchmark de 2.5x para infoprodutos',
      'Meta Ads responsável por 54% da receita com ROAS de 3.0x',
      'Campanha Display com LTV dos compradores 68% abaixo da média',
      '8 Champions inativos representam R$ 22.720 em LTV acumulado',
    ],
  }
}

// ── Reports ─────────────────────────────────────────────────────────────────────

export function mockReportsConfig() {
  return {
    enabled: true,
    frequency: 'semanal',
    format: 'pdf',
    email: 'francisco@northie.com.br',
    next_send_at: (() => {
      const d = new Date()
      d.setDate(d.getDate() + (8 - d.getDay()) % 7 || 7)
      return d.toISOString()
    })(),
    period_type: 'last_7_days',
  }
}

export function mockReportsLogs() {
  return [
    {
      id: 'rpt_001', created_at: daysAgo(0) + 'T06:00:00Z', frequency: 'semanal', format: 'pdf', status: 'success', situacao_geral: 'saudavel', email_status: 'sent', triggered_by: 'automatic',
      period_start: daysAgo(7), period_end: daysAgo(0),
      snapshot: { revenue_net: 47200, ad_spend: 16022, roas: 2.95, new_customers: 38, ltv_avg: 432, revenue_change_pct: 12.4, situacao_geral: 'saudavel', resumo_executivo: 'Semana forte com crescimento de 12.4% na receita. Meta Ads lidera com ROAS 3.0x. 8 Champions inativos identificados para reativação.', top_channel: { channel: 'Meta Ads', value_created: 31117, status: 'Excelente' }, worst_channel: { channel: 'Display', value_created: 2639, status: 'Atenção' }, at_risk_count: 3, at_risk_ltv: 12070, diagnosticos_count: 4, criticos: 0 },
    },
    {
      id: 'rpt_002', created_at: daysAgo(7) + 'T06:00:00Z', frequency: 'semanal', format: 'pdf', status: 'success', situacao_geral: 'saudavel', email_status: 'sent', triggered_by: 'automatic',
      period_start: daysAgo(14), period_end: daysAgo(7),
      snapshot: { revenue_net: 42000, ad_spend: 14800, roas: 2.84, new_customers: 31, ltv_avg: 418, revenue_change_pct: 8.7, situacao_geral: 'saudavel', resumo_executivo: 'Crescimento consistente de 8.7%. Google Ads melhorou ROAS após pausa de campanha genérica.', top_channel: { channel: 'Meta Ads', value_created: 27400, status: 'Excelente' }, worst_channel: null, at_risk_count: 2, at_risk_ltv: 8200, diagnosticos_count: 3, criticos: 0 },
    },
    {
      id: 'rpt_003', created_at: daysAgo(14) + 'T06:00:00Z', frequency: 'semanal', format: 'xlsx', status: 'success', situacao_geral: 'atencao', email_status: 'sent', triggered_by: 'manual',
      period_start: daysAgo(21), period_end: daysAgo(14),
      snapshot: { revenue_net: 38600, ad_spend: 15200, roas: 2.54, new_customers: 28, ltv_avg: 395, revenue_change_pct: -3.2, situacao_geral: 'atencao', resumo_executivo: 'Leve queda de 3.2% na receita. Campanha AWARENESS-GENÉRICA estava consumindo budget com LTV baixo — pausada.', top_channel: { channel: 'Meta Ads', value_created: 24800, status: 'Bom' }, worst_channel: { channel: 'Display', value_created: 1800, status: 'Fraco' }, at_risk_count: 5, at_risk_ltv: 14300, diagnosticos_count: 5, criticos: 1 },
    },
  ]
}

// ── Integrations ────────────────────────────────────────────────────────────────

export function mockIntegrationStatus() {
  return [
    { platform: 'meta_ads', status: 'active', connected_at: '2025-07-15T10:00:00Z', last_sync: daysAgo(0) + 'T06:00:00Z' },
    { platform: 'google_ads', status: 'active', connected_at: '2025-08-20T14:00:00Z', last_sync: daysAgo(0) + 'T06:00:00Z' },
    { platform: 'hotmart', status: 'active', connected_at: '2025-07-10T09:00:00Z', last_sync: daysAgo(0) + 'T04:00:00Z' },
    { platform: 'stripe', status: 'active', connected_at: '2025-09-01T11:00:00Z', last_sync: daysAgo(0) + 'T05:30:00Z' },
    { platform: 'shopify', status: 'inactive' },
  ]
}

// ── Pipeline (Conversas) ────────────────────────────────────────────────────────

export function mockPipelineLeads() {
  return [
    { id: 'lead_001', name: 'André Nascimento', email: 'andre@empresa.com', phone: '+5511987654321', company: 'TechStart', source: 'meta_ads', status: 'fechado', value_estimate: 4970, notes: 'Fechou Mentoria Premium após 2 reuniões', meta: null, created_at: daysAgo(18) + 'T10:00:00Z', updated_at: daysAgo(5) + 'T16:00:00Z' },
    { id: 'lead_002', name: 'Patrícia Lemos', email: 'patricia@agencia.com', phone: '+5511912345678', company: 'Agência Digital', source: 'google_ads', status: 'reuniao_realizada', value_estimate: 2970, notes: 'Interessada no Curso Completo + Mentoria', meta: null, created_at: daysAgo(12) + 'T14:00:00Z', updated_at: daysAgo(2) + 'T11:00:00Z' },
    { id: 'lead_003', name: 'Felipe Torres', email: 'felipe@startup.io', phone: '+5511998765432', company: 'StartupIO', source: 'organico', status: 'reuniao_agendada', value_estimate: 1497, notes: 'Reunião marcada para quinta-feira', meta: null, created_at: daysAgo(5) + 'T09:00:00Z', updated_at: daysAgo(1) + 'T15:00:00Z' },
    { id: 'lead_004', name: 'Renata Vieira', email: 'renata@ecommerce.com.br', phone: '+5521976543210', company: 'LojaBR', source: 'meta_ads', status: 'lead', value_estimate: 997, notes: 'Baixou o e-book, demonstrou interesse no Workshop', meta: null, created_at: daysAgo(2) + 'T08:00:00Z', updated_at: daysAgo(2) + 'T08:00:00Z' },
    { id: 'lead_005', name: 'Marcos Silva', email: 'marcos@consultoria.com', phone: '+5511954321098', company: 'SilvaConsult', source: 'email', status: 'lead', value_estimate: 497, notes: null, meta: null, created_at: daysAgo(1) + 'T11:00:00Z', updated_at: daysAgo(1) + 'T11:00:00Z' },
    { id: 'lead_006', name: 'Daniela Moreira', email: 'daniela@tech.com', phone: null, company: null, source: 'meta_ads', status: 'perdido', value_estimate: 1497, notes: 'Achou caro, vai pensar', meta: null, created_at: daysAgo(25) + 'T10:00:00Z', updated_at: daysAgo(10) + 'T14:00:00Z' },
  ]
}

export function mockPipelineMeetings() {
  return [
    { id: 'meet_001', lead_id: 'lead_001', title: 'Discovery — André Nascimento', scheduled_at: daysAgo(14) + 'T14:00:00Z', duration_minutes: 45, status: 'realizada', notes: 'Explicou produto, interessado na Mentoria Premium', transcript_summary: 'André tem um SaaS de gestão de estoque com 200 clientes. Fatura R$ 48k/mês. Precisa de ajuda com growth — marketing e retenção. Mencionou que já gastou R$ 15k em Meta sem resultado claro. Objeção: não quer perder tempo com ferramenta que não entende seu contexto.', created_at: daysAgo(14) + 'T14:00:00Z', updated_at: daysAgo(14) + 'T15:00:00Z' },
    { id: 'meet_002', lead_id: 'lead_001', title: 'Fechamento — André Nascimento', scheduled_at: daysAgo(7) + 'T10:00:00Z', duration_minutes: 30, status: 'realizada', notes: 'Fechou Mentoria Premium R$ 4.970', transcript_summary: 'André voltou decidido. Tirou dúvidas sobre o formato (4 encontros + acesso ao grupo). Fechou no Pix com desconto. Vai começar semana que vem.', created_at: daysAgo(7) + 'T10:00:00Z', updated_at: daysAgo(7) + 'T10:30:00Z' },
    { id: 'meet_003', lead_id: 'lead_002', title: 'Discovery — Patrícia Lemos', scheduled_at: daysAgo(4) + 'T15:00:00Z', duration_minutes: 40, status: 'realizada', notes: 'Muito interessada, pediu proposta formal', transcript_summary: 'Patrícia tem uma agência digital com 12 funcionários. Quer o curso para capacitar a equipe e a mentoria para ela. Budget aprovado internamente. Vai confirmar na próxima semana.', created_at: daysAgo(4) + 'T15:00:00Z', updated_at: daysAgo(4) + 'T15:45:00Z' },
    { id: 'meet_004', lead_id: 'lead_003', title: 'Discovery — Felipe Torres', scheduled_at: daysAgo(-2) + 'T11:00:00Z', duration_minutes: null, status: 'agendada', notes: null, transcript_summary: null, created_at: daysAgo(1) + 'T15:00:00Z', updated_at: daysAgo(1) + 'T15:00:00Z' },
  ]
}

// ── Context ─────────────────────────────────────────────────────────────────────

export function mockContext() {
  return {
    business_name: 'Escola de Escrita Criativa',
    segmento: 'Infoproduto / Educação',
    icp: 'Profissionais 30-50 anos que querem escrever memórias familiares ou autobiografias como legado. Classe A/B, maioria mulheres (68%), regiões Sul e Sudeste.',
    ciclo_vendas: 'Curto para e-book (impulsivo, 1-3 dias) e médio para mentoria (7-21 dias com reunião).',
    sazonalidades: 'Pico em maio (Dia das Mães) e dezembro (presentes de fim de ano). Janeiro é o mês mais fraco.',
    prioridades: 'Aumentar a conversão de compradores de e-book para mentoria. Testar Google Ads como canal secundário. Reduzir churn da assinatura mensal.',
    instrucoes_ia: 'Sempre considerar que meus clientes são emocionalmente conectados ao produto — não é uma compra racional. O tom das mensagens de reativação deve ser empático, nunca agressivo comercialmente.',
    arquivos: ['pitch-deck-2026.pdf', 'tabela-precos-v3.xlsx', 'pesquisa-clientes-jan2026.pdf'],
    updated_at: daysAgo(3) + 'T10:00:00Z',
  }
}

// ── Alerts ───────────────────────────────────────────────────────────────────────

export function mockAlerts() {
  return [
    { id: 'alert_001', type: 'growth_recommendation', title: '3 novas recomendações de growth', message: 'O motor identificou 3 ações baseadas nos seus dados mais recentes.', read: false, created_at: daysAgo(0) + 'T08:00:00Z' },
    { id: 'alert_002', type: 'report_generated', title: 'Relatório semanal gerado', message: 'Situação geral: Saudável. Receita +12.4% vs semana anterior.', read: false, created_at: daysAgo(0) + 'T06:00:00Z' },
    { id: 'alert_003', type: 'execution_complete', title: 'Sync Champions → Meta concluído', message: '47 clientes sincronizados como Custom Audience. Lookalike 1% criado.', read: true, created_at: daysAgo(3) + 'T09:05:00Z' },
  ]
}

// ── Route Matcher ───────────────────────────────────────────────────────────────

export function matchMockRoute(url: string, _params?: Record<string, string>): unknown | null {
  // Dashboard
  if (url.includes('/dashboard/full')) return mockDashboardFull(30)
  if (url.includes('/dashboard/stats')) return mockDashboardStats(30)
  if (url.includes('/dashboard/chart')) return generateChart(30)
  if (url.includes('/dashboard/heatmap')) return generateHeatmap()
  if (url.includes('/dashboard/attribution')) return MOCK_ATTRIBUTION
  if (url.includes('/dashboard/top-customers')) return MOCK_TOP_CUSTOMERS
  if (url.includes('/dashboard/ad-campaigns/')) return mockAdCampaignDetail()
  if (url.includes('/dashboard/ad-campaigns')) return MOCK_AD_CAMPAIGNS
  if (url.includes('/dashboard/channel-trends')) return mockChannelTrends()
  if (url.includes('/dashboard/growth')) return { growth_percentage: 24.7 }
  if (url.includes('/dashboard/retention')) return [
    { month: '2025-10', n: 42, retentions: { '30d': 0.78, '60d': 0.61, '90d': 0.52, '180d': null } },
    { month: '2025-11', n: 38, retentions: { '30d': 0.82, '60d': 0.65, '90d': 0.48, '180d': null } },
    { month: '2025-12', n: 45, retentions: { '30d': 0.85, '60d': 0.68, '90d': null, '180d': null } },
    { month: '2026-01', n: 51, retentions: { '30d': 0.80, '60d': 0.62, '90d': null, '180d': null } },
    { month: '2026-02', n: 47, retentions: { '30d': 0.84, '60d': null, '90d': null, '180d': null } },
    { month: '2026-03', n: 38, retentions: { '30d': null, '60d': null, '90d': null, '180d': null } },
  ]

  // Data
  if (url.includes('/data/transactions')) return mockTransactions()
  if (url.includes('/data/customers')) return mockCustomers()

  // Growth
  if (url.includes('/growth/recommendations')) return mockGrowthRecommendations()
  if (url.includes('/growth/metrics')) return mockGrowthMetrics()
  if (url.includes('/growth/execution-history')) return mockGrowthExecutionHistory()
  if (url.includes('/growth/diagnostic/latest')) return mockGrowthDiagnostic()

  // Card
  if (url.includes('/card/score')) return mockCardScore()
  if (url.includes('/card/history')) return mockCardHistory()
  if (url.includes('/card/application')) return mockCardApplication()

  // Reports
  if (url.includes('/reports/config')) return mockReportsConfig()
  if (url.includes('/reports/logs')) return mockReportsLogs()
  if (url.includes('/reports/preview')) return { html: '<p>Preview do relatório</p>' }

  // Integrations
  if (url.includes('/integrations/status')) return mockIntegrationStatus()

  // Pipeline
  if (url.includes('/pipeline/leads')) return mockPipelineLeads()
  if (url.includes('/pipeline/meetings')) return mockPipelineMeetings()

  // Context
  if (url === '/context' || url.includes('/context')) return mockContext()

  // Alerts
  if (url.includes('/alerts')) return mockAlerts()

  // Calendar
  if (url.includes('/calendar/events')) return []
  if (url.includes('/calendar/status')) return { connected: false }

  return null
}
