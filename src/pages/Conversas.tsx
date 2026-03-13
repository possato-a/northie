import { useState } from 'react'
import { motion } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import { PageHeader, Divider, SectionLabel } from '../components/ui/shared'

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_LEADS = [
  { id: 1, name: 'Ana Beatriz Costa',   company: 'Studio AB',        stage: 'Fechado',          source: 'Formulário',  date: '10/03', value: 4800, days: 12 },
  { id: 2, name: 'Rafael Mendes',       company: 'Agência Mendes',   stage: 'Reunião Realizada', source: 'Indicação',   date: '08/03', value: 7200, days: 8  },
  { id: 3, name: 'Camila Torres',       company: 'CT Educação',      stage: 'Reunião Agendada',  source: 'Formulário',  date: '07/03', value: 3600, days: 5  },
  { id: 4, name: 'Bruno Figueiredo',    company: 'BF Soluções',      stage: 'Lead Capturado',   source: 'LinkedIn',    date: '06/03', value: 9600, days: 2  },
  { id: 5, name: 'Mariana Souza',       company: 'MS Digital',       stage: 'Fechado',          source: 'Formulário',  date: '04/03', value: 2400, days: 18 },
  { id: 6, name: 'Pedro Almeida',       company: 'PA Consultoria',   stage: 'Perdido',          source: 'Indicação',   date: '02/03', value: 6000, days: 22 },
  { id: 7, name: 'Fernanda Lima',       company: 'FL Marketing',     stage: 'Reunião Realizada', source: 'Formulário',  date: '01/03', value: 5400, days: 9  },
  { id: 8, name: 'Lucas Pereira',       company: 'LP Tech',          stage: 'Lead Capturado',   source: 'LinkedIn',    date: '28/02', value: 12000, days: 3 },
]

const MOCK_REUNIOES = [
  {
    id: 1, lead: 'Ana Beatriz Costa', company: 'Studio AB', date: '09/03', duration: '42min',
    result: 'Fechado', value: 4800,
    summary: 'Cliente demonstrou forte interesse na automação de reativação. Principal objeção: preço inicial. Resolvida após apresentar ROI histórico de clientes similares.',
    objections: ['Preço acima do esperado', 'Prazo de implementação'],
    tags: ['Alta intenção', 'Objeção de preço', 'Fechamento rápido'],
  },
  {
    id: 2, lead: 'Rafael Mendes', company: 'Agência Mendes', date: '07/03', duration: '58min',
    result: 'Em negociação', value: 7200,
    summary: 'Reunião técnica aprofundada sobre integrações com Meta Ads. Cliente solicitou proposta customizada para agência com múltiplos clientes.',
    objections: ['Precisa de multi-conta', 'Quer teste grátis'],
    tags: ['Ticket alto', 'Decisor presente', 'Multi-conta'],
  },
  {
    id: 3, lead: 'Mariana Souza', company: 'MS Digital', date: '03/03', duration: '35min',
    result: 'Fechado', value: 2400,
    summary: 'Ciclo curto — cliente já conhecia a Northie por indicação. Decisão tomada na própria reunião. Onboarding agendado para semana seguinte.',
    objections: [],
    tags: ['Indicação', 'Fechamento imediato', 'Sem objeções'],
  },
  {
    id: 4, lead: 'Pedro Almeida', company: 'PA Consultoria', date: '28/02', duration: '48min',
    result: 'Perdido', value: 0,
    summary: 'Cliente escolheu concorrente com integração nativa ao CRM legado. Abertura para revisitar em 6 meses quando renovar contrato.',
    objections: ['Integração com CRM legado', 'Lock-in contratual'],
    tags: ['CRM legado', 'Perdido', 'Follow-up em set/25'],
  },
  {
    id: 5, lead: 'Fernanda Lima', company: 'FL Marketing', date: '01/03', duration: '51min',
    result: 'Em negociação', value: 5400,
    summary: 'Apresentação do Growth Engine. Cliente ficou muito animado com a correlação LTV × canal. Solicitou apresentação para sócio na próxima semana.',
    objections: ['Precisa de aprovação do sócio'],
    tags: ['Múltiplos decisores', 'Alta intenção', 'Próxima reunião agendada'],
  },
]

const MOCK_INSIGHTS = [
  {
    id: 1, title: 'Objeção de preço em 60% dos leads de alto ticket',
    type: 'Padrão de Objeção',
    color: 'var(--accent-orange)',
    body: 'Leads com ticket acima de R$5k levantam objeção de preço em 3 de cada 5 reuniões. Mas quando o ROI histórico é apresentado nos primeiros 15 min, a taxa de fechamento sobe 40%.',
    action: 'Antecipar o ROI na apresentação para deals acima de R$5k',
  },
  {
    id: 2, title: 'Ciclo médio de indicações é 2.3x menor',
    type: 'Padrão de Canal',
    color: 'var(--status-complete)',
    body: 'Leads vindos por indicação fecham em 9 dias em média vs 21 dias via formulário. Eles chegam com intenção mais alta e raramente pedem desconto.',
    action: 'Criar programa de indicação estruturado com incentivo para clientes ativos',
  },
  {
    id: 3, title: 'Reuniões acima de 50 min têm 70% menos conversão',
    type: 'Padrão de Reunião',
    color: 'var(--accent-red)',
    body: 'Reuniões que ultrapassam 50 minutos tendem a indicar perda de foco ou múltiplas objeções não resolvidas. As reuniões que fecham duram entre 30 e 45 minutos.',
    action: 'Estabelecer agenda de 40 min com checkpoint de decisão aos 30 min',
  },
  {
    id: 4, title: 'Segunda-feira às 14h é o horário de maior taxa de fechamento',
    type: 'Padrão de Timing',
    color: 'var(--accent-blue)',
    body: '3 dos 5 fechamentos aconteceram em reuniões iniciadas segunda-feira entre 14h e 16h. Sexta após as 15h tem 0% de conversão até agora.',
    action: 'Priorizar slots de segunda à tarde para demos e reuniões de fechamento',
  },
]

const fmtBRL = (n: number) => `R$ ${new Intl.NumberFormat('pt-BR').format(n)}`

const STAGE_COLOR: Record<string, string> = {
  'Lead Capturado':    'var(--color-text-tertiary)',
  'Reunião Agendada':  'var(--accent-blue)',
  'Reunião Realizada': 'var(--accent-orange)',
  'Fechado':           'var(--status-complete)',
  'Perdido':           'var(--accent-red)',
}

const STAGE_BG: Record<string, string> = {
  'Lead Capturado':    'var(--color-bg-tertiary)',
  'Reunião Agendada':  'rgba(35,131,226,0.1)',
  'Reunião Realizada': 'rgba(217,115,13,0.1)',
  'Fechado':           'var(--status-complete-bg)',
  'Perdido':           'var(--priority-high-bg)',
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      ...style,
    }}>
      {children}
    </div>
  )
}

// ── Pipeline Stage ────────────────────────────────────────────────────────────

function PipelineStage({ label, count, delay, isLast = false }: {
  label: string; count: number; delay: number; isLast?: boolean
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] }}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '28px 20px', position: 'relative' }}
    >
      {!isLast && (
        <div style={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', width: 1, height: 40, background: 'var(--color-border)' }} />
      )}
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-3xl)', fontWeight: 500, color: count > 0 ? 'var(--color-primary)' : 'var(--color-text-primary)', letterSpacing: '-0.5px', lineHeight: 1 }}>
        {count}
      </span>
      <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.4 }}>
        {label}
      </span>
    </motion.div>
  )
}

// ── Pipeline View ─────────────────────────────────────────────────────────────

function PipelineView() {
  const stages = [
    { label: 'Lead Capturado',    count: MOCK_LEADS.filter(l => l.stage === 'Lead Capturado').length },
    { label: 'Reunião Agendada',  count: MOCK_LEADS.filter(l => l.stage === 'Reunião Agendada').length },
    { label: 'Reunião Realizada', count: MOCK_LEADS.filter(l => l.stage === 'Reunião Realizada').length },
    { label: 'Fechado / Perdido', count: MOCK_LEADS.filter(l => l.stage === 'Fechado' || l.stage === 'Perdido').length },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Funil */}
      <SectionCard>
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {stages.map((stage, i) => (
            <PipelineStage key={stage.label} label={stage.label} count={stage.count} delay={0.1 + i * 0.07} isLast={i === stages.length - 1} />
          ))}
        </div>
      </SectionCard>

      {/* Tabela de leads */}
      <SectionCard>
        {/* Header */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px 150px 90px 100px', gap: '0 16px', padding: '10px 20px', background: 'var(--color-bg-secondary)', borderBottom: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg) var(--radius-lg) 0 0' }}>
          {['Lead', 'Empresa', 'Estágio', 'Valor', 'Ciclo'].map(h => (
            <span key={h} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{h}</span>
          ))}
        </div>

        {MOCK_LEADS.map((lead, i) => (
          <motion.div
            key={lead.id}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.05 + i * 0.04 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 140px 150px 90px 100px',
              gap: '0 16px', padding: '12px 20px', alignItems: 'center',
              borderBottom: i < MOCK_LEADS.length - 1 ? '1px solid var(--color-border)' : 'none',
            }}
          >
            <div>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, margin: 0, color: 'var(--color-text-primary)' }}>{lead.name}</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{lead.source} · {lead.date}</p>
            </div>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{lead.company}</span>
            <span style={{
              display: 'inline-flex', alignItems: 'center',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500,
              padding: '3px 10px', borderRadius: 'var(--radius-full)',
              background: STAGE_BG[lead.stage], color: STAGE_COLOR[lead.stage],
              width: 'fit-content',
            }}>{lead.stage}</span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)' }}>
              {lead.value > 0 ? fmtBRL(lead.value) : '—'}
            </span>
            <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
              {lead.days}d
            </span>
          </motion.div>
        ))}
      </SectionCard>
    </div>
  )
}

// ── Reuniões View ─────────────────────────────────────────────────────────────

function ReunioesView() {
  const [expanded, setExpanded] = useState<number | null>(1)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {MOCK_REUNIOES.map((r, i) => (
        <motion.div
          key={r.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <SectionCard>
            {/* Header */}
            <div
              onClick={() => setExpanded(expanded === r.id ? null : r.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '16px 20px', cursor: 'pointer' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 500, color: 'var(--color-text-primary)' }}>{r.lead}</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)' }}>·</span>
                  <span style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>{r.company}</span>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {r.tags.map(tag => (
                    <span key={tag} style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, padding: '2px 8px', borderRadius: 'var(--radius-full)', background: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{tag}</span>
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 24, alignItems: 'center', flexShrink: 0 }}>
                <div style={{ textAlign: 'right' }}>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', margin: 0 }}>{r.date} · {r.duration}</p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, margin: 0, color: r.result === 'Fechado' ? 'var(--status-complete)' : r.result === 'Perdido' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>{r.result}{r.value > 0 ? ` · ${fmtBRL(r.value)}` : ''}</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--color-text-tertiary)', transform: expanded === r.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </div>

            {/* Expanded */}
            {expanded === r.id && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                style={{ borderTop: '1px solid var(--color-border)', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 14 }}
              >
                <div>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Resumo da IA</p>
                  <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>{r.summary}</p>
                </div>
                {r.objections.length > 0 && (
                  <div>
                    <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 6 }}>Objeções levantadas</p>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {r.objections.map(obj => (
                        <span key={obj} style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, padding: '3px 10px', borderRadius: 'var(--radius-full)', background: 'var(--priority-high-bg)', color: 'var(--accent-red)' }}>{obj}</span>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </SectionCard>
        </motion.div>
      ))}
    </div>
  )
}

// ── Insights View ─────────────────────────────────────────────────────────────

function InsightsView() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {MOCK_INSIGHTS.map((insight, i) => (
        <motion.div
          key={insight.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: i * 0.07 }}
        >
          <SectionCard style={{ padding: '20px 24px', height: '100%' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 4, height: 40, borderRadius: 2, background: insight.color, flexShrink: 0, marginTop: 2 }} />
              <div>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{insight.type}</span>
                <h3 style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', fontWeight: 600, color: 'var(--color-text-primary)', margin: '4px 0 0', lineHeight: 1.3 }}>{insight.title}</h3>
              </div>
            </div>
            <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 14px' }}>{insight.body}</p>
            <div style={{ padding: '10px 14px', background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)', fontWeight: 500, color: 'var(--color-text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', margin: '0 0 3px' }}>Ação recomendada</p>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--color-text-primary)', margin: 0 }}>{insight.action}</p>
            </div>
          </SectionCard>
        </motion.div>
      ))}
    </div>
  )
}

// ── Page Component ────────────────────────────────────────────────────────────

const TABS = ['Pipeline', 'Reuniões', 'Insights']

export default function Conversas({ onToggleChat }: { onToggleChat?: () => void }) {
  const [activeTab, setActiveTab] = useState('Pipeline')

  const fechados = MOCK_LEADS.filter(l => l.stage === 'Fechado').length
  const total = MOCK_LEADS.length
  const cicloMedio = Math.round(MOCK_LEADS.filter(l => l.stage === 'Fechado').reduce((acc, l) => acc + l.days, 0) / fechados)

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title="Conversas"
        subtitle="Pipeline de vendas e inteligência de reuniões."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32 }}>
        <KpiCard label="LEADS CAPTURADOS"    value={total}       decimals={0}  delay={0.05} />
        <KpiCard label="REUNIÕES REALIZADAS" value={MOCK_REUNIOES.length} decimals={0} delay={0.1} />
        <KpiCard label="TAXA DE CONVERSÃO"   value={(fechados / total) * 100} suffix="%" decimals={1} delay={0.15} />
        <KpiCard label="CICLO MÉDIO"         value={cicloMedio}  suffix=" dias" decimals={0} delay={0.2} />
      </div>

      <Divider margin="32px 0" />

      {/* Pill subnav — idêntico ao Growth */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '4px', background: 'var(--color-bg-secondary)', borderRadius: 10, width: 'fit-content', border: '1px solid var(--color-border)' }}>
        {TABS.map(tab => {
          const isActive = activeTab === tab
          return (
            <motion.button
              key={tab}
              onClick={() => setActiveTab(tab)}
              whileTap={{ scale: 0.97 }}
              style={{
                fontFamily: 'var(--font-sans)', fontSize: 13,
                fontWeight: isActive ? 500 : 400,
                color: isActive ? 'var(--color-text-primary)' : 'var(--color-text-tertiary)',
                background: isActive ? 'var(--color-bg-primary)' : 'transparent',
                border: isActive ? '1px solid var(--color-border)' : '1px solid transparent',
                borderRadius: 7, padding: '6px 16px', cursor: 'pointer',
                transition: 'all 0.15s ease', letterSpacing: '-0.1px',
              }}
            >
              {tab}
            </motion.button>
          )
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 20 }}
      >
        {activeTab === 'Pipeline'  && <PipelineView />}
        {activeTab === 'Reuniões'  && <ReunioesView />}
        {activeTab === 'Insights'  && <InsightsView />}
      </motion.div>
    </div>
  )
}
