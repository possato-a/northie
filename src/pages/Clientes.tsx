import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import DateRangePicker, { type DateRange } from '../components/ui/DateRangePicker'
import CohortHeatmap from '../components/charts/CohortHeatmap'
import RFMCards from '../components/ui/RFMCards'
import RFMSegmentDetail from '../components/ui/RFMSegmentDetail'
import ClientProfile from '../components/ui/ClientProfile'
import { dataApi, dashboardApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import type { ClientUI, ClientStatus, AcquisitionChannel, RFMSegment } from '../types'

// ── Helpers ───────────────────────────────────────────────────────────────────

function fadeUp(delay: number) {
  return {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.4, delay, ease: [0.25, 0.1, 0.25, 1] as const },
  }
}

function defaultRange(): DateRange {
  const end = new Date()
  end.setHours(0, 0, 0, 0)
  const start = new Date(end)
  start.setDate(start.getDate() - 29)
  return { start, end, label: 'Últimos 30 dias' }
}

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

// ── Business Logic ────────────────────────────────────────────────────────────

// Deriva o segmento RFM a partir do rfm_score (ex: "345" → 'Em Risco')
function rfmSegmentFromScore(rfmScore: string | null | undefined): RFMSegment {
  if (!rfmScore || rfmScore.length !== 3) return 'Novos Promissores'
  const r = parseInt(rfmScore[0])
  const f = parseInt(rfmScore[1])
  const m = parseInt(rfmScore[2])
  const avg = (r + f + m) / 3
  if (r >= 4 && f >= 3 && m >= 3) return 'Champions'
  if ((r <= 2 && m >= 3) || (r <= 2 && f >= 3)) return 'Em Risco'
  if (avg <= 2) return 'Inativos'
  return 'Novos Promissores'
}

// Mapeia o valor da DB (snake_case) para o nome de exibição da UI
function mapChannel(raw: string | undefined): AcquisitionChannel {
  const s = (raw || '').toLowerCase()
  if (s === 'meta_ads' || s === 'meta') return 'Meta Ads'
  if (s === 'google_ads' || s === 'google') return 'Google Ads'
  if (s === 'hotmart') return 'Hotmart'
  if (s === 'organico' || s === 'organic') return 'Google Orgânico'
  if (s === 'email' || s === 'newsletter') return 'Email'
  if (s === 'afiliado' || s === 'affiliate') return 'Direto'
  if (s === 'shopify') return 'Direto'
  if (s === 'stripe') return 'Direto'
  return 'Direto'
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_CLIENTS: ClientUI[] = [
  { id: '1',  name: 'Rafael Mendes',      channel: 'Meta Ads',      totalSpent: 1491, cac: 87,  ltv: 1491, margin: 94, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '09/03', churnProb: 0.05, purchases: [{ date: '09/03/26', product: 'Método Escrita Avançada', value: 497 }, { date: '02/02/26', product: 'Copywriting na Prática', value: 297 }, { date: '10/01/26', product: 'Pack Templates Premium', value: 697 }] },
  { id: '2',  name: 'Ana Paula Costa',    channel: 'Google Ads',    totalSpent: 2400, cac: 142, ltv: 2400, margin: 94, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '09/03', churnProb: 0.03, purchases: [{ date: '09/03/26', product: 'Mentoria Individual', value: 1200 }, { date: '15/01/26', product: 'Mentoria Individual', value: 1200 }] },
  { id: '3',  name: 'Bruno Oliveira',     channel: 'Meta Ads',      totalSpent: 594,  cac: 91,  ltv: 594,  margin: 85, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '08/03', churnProb: 0.22, purchases: [{ date: '08/03/26', product: 'Copywriting na Prática', value: 297 }, { date: '20/02/26', product: 'Acesso Comunidade VIP', value: 297 }] },
  { id: '4',  name: 'Carla Santos',       channel: 'Direto',        totalSpent: 197,  cac: 0,   ltv: 197,  margin: 70, status: 'Payback',   segment: 'Novos Promissores', lastPurchase: '08/03', churnProb: 0.41, purchases: [{ date: '08/03/26', product: 'Pack Templates Premium', value: 197 }] },
  { id: '5',  name: 'Diego Ferreira',     channel: 'Meta Ads',      totalSpent: 994,  cac: 87,  ltv: 994,  margin: 91, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '07/03', churnProb: 0.08, purchases: [{ date: '07/03/26', product: 'Método Escrita Avançada', value: 497 }, { date: '14/02/26', product: 'Método Escrita Avançada', value: 497 }] },
  { id: '6',  name: 'Fernanda Lima',      channel: 'Email',         totalSpent: 194,  cac: 12,  ltv: 194,  margin: 94, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '07/03', churnProb: 0.33, purchases: [{ date: '07/03/26', product: 'Acesso Comunidade VIP', value: 97 }, { date: '10/02/26', product: 'Acesso Comunidade VIP', value: 97 }] },
  { id: '7',  name: 'Gabriel Rocha',      channel: 'Google Ads',    totalSpent: 3600, cac: 142, ltv: 3600, margin: 96, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '06/03', churnProb: 0.04, purchases: [{ date: '06/03/26', product: 'Mentoria Individual', value: 1200 }, { date: '06/01/26', product: 'Mentoria Individual', value: 1200 }, { date: '06/11/25', product: 'Mentoria Individual', value: 1200 }] },
  { id: '8',  name: 'Helena Martins',     channel: 'Meta Ads',      totalSpent: 297,  cac: 91,  ltv: 297,  margin: 69, status: 'Payback',   segment: 'Em Risco',          lastPurchase: '06/03', churnProb: 0.67, purchases: [{ date: '06/03/26', product: 'Copywriting na Prática', value: 297 }] },
  { id: '9',  name: 'Igor Souza',         channel: 'Meta Ads',      totalSpent: 994,  cac: 87,  ltv: 994,  margin: 91, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '05/03', churnProb: 0.11, purchases: [{ date: '05/03/26', product: 'Método Escrita Avançada', value: 497 }, { date: '05/01/26', product: 'Método Escrita Avançada', value: 497 }] },
  { id: '10', name: 'Juliana Pereira',    channel: 'Direto',        totalSpent: 394,  cac: 0,   ltv: 394,  margin: 70, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '05/03', churnProb: 0.19, purchases: [{ date: '05/03/26', product: 'Pack Templates Premium', value: 197 }, { date: '20/01/26', product: 'Pack Templates Premium', value: 197 }] },
  { id: '11', name: 'Lucas Almeida',      channel: 'Meta Ads',      totalSpent: 194,  cac: 91,  ltv: 194,  margin: 53, status: 'Payback',   segment: 'Novos Promissores', lastPurchase: '04/03', churnProb: 0.38, purchases: [{ date: '04/03/26', product: 'Acesso Comunidade VIP', value: 97 }, { date: '10/02/26', product: 'Acesso Comunidade VIP', value: 97 }] },
  { id: '12', name: 'Marina Castro',      channel: 'Google Ads',    totalSpent: 994,  cac: 142, ltv: 994,  margin: 86, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '04/03', churnProb: 0.07, purchases: [{ date: '04/03/26', product: 'Método Escrita Avançada', value: 497 }, { date: '04/01/26', product: 'Método Escrita Avançada', value: 497 }] },
  { id: '13', name: 'Nicolas Barbosa',    channel: 'Google Ads',    totalSpent: 1200, cac: 142, ltv: 1200, margin: 88, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '03/03', churnProb: 0.27, purchases: [{ date: '03/03/26', product: 'Mentoria Individual', value: 1200 }] },
  { id: '14', name: 'Olivia Torres',      channel: 'Meta Ads',      totalSpent: 594,  cac: 87,  ltv: 594,  margin: 85, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '03/03', churnProb: 0.20, purchases: [{ date: '03/03/26', product: 'Copywriting na Prática', value: 297 }, { date: '03/01/26', product: 'Copywriting na Prática', value: 297 }] },
  { id: '15', name: 'Paulo Gomes',        channel: 'Direto',        totalSpent: 591,  cac: 0,   ltv: 591,  margin: 70, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '02/03', churnProb: 0.15, purchases: [{ date: '02/03/26', product: 'Pack Templates Premium', value: 197 }, { date: '02/01/26', product: 'Pack Templates Premium', value: 197 }, { date: '02/11/25', product: 'Pack Templates Premium', value: 197 }] },
  { id: '16', name: 'Renata Nunes',       channel: 'Meta Ads',      totalSpent: 994,  cac: 87,  ltv: 994,  margin: 91, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '02/03', churnProb: 0.06, purchases: [{ date: '02/03/26', product: 'Método Escrita Avançada', value: 497 }, { date: '02/01/26', product: 'Método Escrita Avançada', value: 497 }] },
  { id: '17', name: 'Samuel Freitas',     channel: 'Email',         totalSpent: 97,   cac: 12,  ltv: 97,   margin: 88, status: 'Risco',     segment: 'Inativos',          lastPurchase: '01/03', churnProb: 0.78, purchases: [{ date: '01/03/26', product: 'Acesso Comunidade VIP', value: 97 }] },
  { id: '18', name: 'Tatiane Ramos',      channel: 'Meta Ads',      totalSpent: 594,  cac: 87,  ltv: 594,  margin: 85, status: 'Lucrativo', segment: 'Novos Promissores', lastPurchase: '01/03', churnProb: 0.18, purchases: [{ date: '01/03/26', product: 'Copywriting na Prática', value: 297 }, { date: '01/01/26', product: 'Copywriting na Prática', value: 297 }] },
  { id: '19', name: 'Ubirajara Silva',    channel: 'Google Ads',    totalSpent: 994,  cac: 142, ltv: 994,  margin: 86, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '28/02', churnProb: 0.09, purchases: [{ date: '28/02/26', product: 'Método Escrita Avançada', value: 497 }, { date: '28/12/25', product: 'Método Escrita Avançada', value: 497 }] },
  { id: '20', name: 'Vanessa Cardoso',    channel: 'Meta Ads',      totalSpent: 2400, cac: 87,  ltv: 2400, margin: 96, status: 'Lucrativo', segment: 'Champions',        lastPurchase: '28/02', churnProb: 0.04, purchases: [{ date: '28/02/26', product: 'Mentoria Individual', value: 1200 }, { date: '28/12/25', product: 'Mentoria Individual', value: 1200 }] },
]

// ── Filter Constants ───────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<ClientStatus | 'Todos'> = ['Todos', 'Lucrativo', 'Payback', 'Risco']
const CHANNELS: Array<AcquisitionChannel | 'Todos'> = ['Todos', 'Meta Ads', 'Google Ads', 'Hotmart', 'Google Orgânico', 'Email', 'Direto']
const SEGMENTS: Array<RFMSegment | 'Todos'> = ['Todos', 'Champions', 'Em Risco', 'Novos Promissores', 'Inativos']
const PAGE_SIZE = 6

// ── Status Badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: ClientStatus }) {
  const cls = status === 'Lucrativo' ? 'tag-complete' : status === 'Payback' ? 'tag-planning' : 'tag-neutral'
  return <span className={`tag ${cls}`}>{status}</span>
}

// ── Filter Button ─────────────────────────────────────────────────────────────

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      style={{
        padding: '4px 10px',
        background: active ? 'var(--color-bg-tertiary)' : 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-sm)',
        fontWeight: active ? 500 : 400,
        color: active ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
        letterSpacing: '-0.1px',
        transition: 'background var(--transition-fast), color var(--transition-fast)',
      }}
    >
      {children}
    </motion.button>
  )
}

// ── Dropdown ──────────────────────────────────────────────────────────────────

function Dropdown<T extends string>({ value, options, label, open, onToggle, onSelect }: {
  value: T; options: T[]; label: string; open: boolean
  onToggle: () => void; onSelect: (v: T) => void
}) {
  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        onClick={onToggle}
        whileTap={{ scale: 0.97 }}
        style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', letterSpacing: '-0.1px',
          padding: '4px 10px', borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-border)',
          background: 'var(--color-bg-secondary)', cursor: 'pointer',
          color: value !== 'Todos' ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
          transition: 'background var(--transition-fast)',
        }}
      >
        {value === 'Todos' ? label : value}
        <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </motion.button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute', top: 'calc(100% + 6px)', right: 0,
              background: 'var(--color-bg-primary)',
              border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-lg)',
              padding: '6px 0', zIndex: 200, minWidth: 170,
              boxShadow: 'var(--shadow-lg)',
            }}
          >
            {options.map(opt => (
              <motion.button
                key={opt}
                onClick={() => { onSelect(opt); onToggle() }}
                whileHover={{ background: 'var(--color-bg-secondary)' }}
                style={{
                  display: 'block', width: '100%', textAlign: 'left',
                  padding: '8px 14px', background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)', letterSpacing: '-0.1px',
                  color: value === opt ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
                  fontWeight: value === opt ? 500 : 400,
                }}
              >
                {opt}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Client List ───────────────────────────────────────────────────────────────

function ClientList({ clients, loading, onSelect }: { clients: ClientUI[]; loading: boolean; onSelect: (c: ClientUI) => void }) {
  const [statusFilter, setStatusFilter] = useState<ClientStatus | 'Todos'>('Todos')
  const [channelOpen, setChannelOpen] = useState(false)
  const [segmentOpen, setSegmentOpen] = useState(false)
  const [channelFilter, setChannelFilter] = useState<AcquisitionChannel | 'Todos'>('Todos')
  const [segmentFilter, setSegmentFilter] = useState<RFMSegment | 'Todos'>('Todos')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)

  const filtered = useMemo(() => clients.filter(c => {
    if (statusFilter !== 'Todos' && c.status !== statusFilter) return false
    if (channelFilter !== 'Todos' && c.channel !== channelFilter) return false
    if (segmentFilter !== 'Todos' && c.segment !== segmentFilter) return false
    if (search && !c.name.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [clients, statusFilter, channelFilter, segmentFilter, search])

  const paginated = useMemo(() => filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filtered, page])
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  useEffect(() => { setPage(0) }, [statusFilter, channelFilter, segmentFilter, search])

  return (
    <div>
      {/* Section header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
            color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Clientes
          </p>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
          }}>
            {filtered.length} resultado{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
        <span style={{
          fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22,
          letterSpacing: '-0.4px', color: 'var(--color-text-primary)', display: 'block',
        }}>
          {clients.length} cadastrado{clients.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 4, flex: 1 }}>
          {STATUS_FILTERS.map(s => (
            <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
              {s}
            </FilterButton>
          ))}
        </div>
        <Dropdown
          value={segmentFilter} options={SEGMENTS} label="Segmento" open={segmentOpen}
          onToggle={() => { setSegmentOpen(o => !o); setChannelOpen(false) }}
          onSelect={setSegmentFilter}
        />
        <Dropdown
          value={channelFilter} options={CHANNELS} label="Canal" open={channelOpen}
          onToggle={() => { setChannelOpen(o => !o); setSegmentOpen(false) }}
          onSelect={setChannelFilter}
        />
        <div style={{
          display: 'flex', alignItems: 'center', gap: 7,
          border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-secondary)',
          padding: '4px 10px', height: 30,
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ color: 'var(--color-text-tertiary)', flexShrink: 0 }}>
            <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.3" />
            <line x1="8.5" y1="8.5" x2="11" y2="11" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar..."
            style={{
              border: 'none', background: 'transparent', outline: 'none',
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              letterSpacing: '-0.1px', color: 'var(--color-text-primary)', width: 90,
            }}
          />
        </div>
      </div>

      {/* Table header */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 64px 90px',
        gap: '0 12px', paddingBottom: 10,
        borderBottom: '1px solid var(--color-border)', marginBottom: 0,
      }}>
        {['Nome', 'LTV', 'CAC', 'Margem', 'Últ. Compra', 'Status'].map((h, i) => (
          <span key={h} style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
            color: 'var(--color-text-tertiary)', letterSpacing: '0.02em',
            textTransform: 'uppercase', textAlign: i > 0 && i < 5 ? 'right' : 'left',
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Rows */}
      <div style={{ minHeight: PAGE_SIZE * 50 }}>
        <AnimatePresence mode="wait" initial={false}>
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ padding: '40px 0', textAlign: 'center' }}
            >
              <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                Carregando clientes...
              </p>
            </motion.div>
          ) : filtered.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              style={{ padding: '40px 0', textAlign: 'center' }}
            >
              <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                Nenhum cliente encontrado.
              </p>
              <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 12, margin: '4px 0 0' }}>
                Tente ajustar os filtros ou pesquisar outro nome.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key={`page-${page}`}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
            >
              {paginated.map(c => (
                <motion.div
                  key={c.id}
                  onClick={() => onSelect(c)}
                  whileHover={{ background: 'var(--color-bg-secondary)' }}
                  style={{
                    display: 'grid', gridTemplateColumns: '1fr 90px 90px 70px 64px 90px',
                    gap: '0 12px', alignItems: 'center',
                    padding: '13px 6px', borderBottom: '1px solid var(--color-border)',
                    cursor: 'pointer', borderRadius: 'var(--radius-sm)', margin: '0 -6px',
                    transition: 'background var(--transition-fast)',
                  }}
                >
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
                      fontWeight: 500, color: 'var(--color-text-primary)',
                      margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {c.name}
                    </p>
                    <p style={{
                      fontFamily: 'var(--font-sans)', fontSize: 'var(--text-xs)',
                      color: 'var(--color-text-tertiary)', margin: '2px 0 0',
                    }}>
                      {c.channel}
                    </p>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)', textAlign: 'right',
                  }}>
                    R$ {fmtBR(c.ltv)}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)', textAlign: 'right',
                  }}>
                    {c.cac > 0 ? `R$ ${fmtBR(c.cac)}` : '—'}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)', textAlign: 'right',
                  }}>
                    {c.margin}%
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-secondary)', textAlign: 'right',
                  }}>
                    {c.lastPurchase}
                  </span>
                  <StatusBadge status={c.status} />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          paddingTop: 14, marginTop: 2, borderTop: '1px solid var(--color-border)',
        }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)' }}>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                background: 'transparent', cursor: page === 0 ? 'default' : 'pointer',
                color: 'var(--color-text-secondary)', opacity: page === 0 ? 0.35 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              style={{
                width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                background: 'transparent', cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                color: 'var(--color-text-secondary)', opacity: page >= totalPages - 1 ? 0.35 : 1,
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </motion.button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Clientes({ onToggleChat }: { onToggleChat?: () => void }) {
  const [selectedClient, setSelectedClient] = useState<ClientUI | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<RFMSegment | null>(null)
  const [clients, setClients] = useState<ClientUI[]>(MOCK_CLIENTS)
  const [loading, setLoading] = useState(false)
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange)

  useEffect(() => {
    const custPromise = dataApi.getCustomers().catch(() => ({ data: [] }))
    const attrPromise = dashboardApi.getAttribution().catch(() => ({ data: [] }))
    const txPromise = dataApi.getTransactions(365).catch(() => ({ data: [] }))

    Promise.all([custPromise, attrPromise, txPromise]).then(([custRes, attrRes, txRes]) => {
      // Monta mapa canal → CAC a partir dos dados de Meta/Google Ads
      const cacByChannel: Record<string, number> = {}
      for (const stat of (attrRes.data || [])) {
        const ch = (stat.channel || '').toLowerCase().replace(' ', '_')
        if (stat.cac > 0) cacByChannel[ch] = stat.cac
      }
      for (const stat of (attrRes.data || [])) {
        if (stat.cac > 0) cacByChannel[stat.channel] = stat.cac
      }

      // Monta mapa customer_id → lista de compras (apenas aprovadas)
      const purchasesByCustomer = new Map<string, Array<{ date: string; product: string; value: number; _sortDate: number }>>()
      const rawTx = Array.isArray(txRes.data) ? txRes.data : []
      for (const tx of rawTx) {
        if (tx.status !== 'approved') continue
        const list = purchasesByCustomer.get(tx.customer_id) || []
        list.push({
          date: new Date(tx.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }),
          product: tx.product_name || '—',
          value: Number(tx.amount_net),
          _sortDate: new Date(tx.created_at).getTime(),
        })
        purchasesByCustomer.set(tx.customer_id, list)
      }

      const rawCust = Array.isArray(custRes.data) ? custRes.data : []
      const mapped = rawCust.map((c: any) => {
        const channel = mapChannel(c.acquisition_channel)
        const cac = cacByChannel[channel] || cacByChannel[c.acquisition_channel] || 0
        const ltv = Number(c.total_ltv)
        const margin = cac > 0 && ltv > 0 ? Math.round(((ltv - cac) / ltv) * 100) : (ltv > 0 ? 70 : 0)
        const status: ClientStatus = cac > 0 && ltv > cac ? 'Lucrativo' : cac > 0 && ltv <= cac ? 'Payback' : ltv > 0 ? 'Lucrativo' : 'Risco'
        // Ordena compras da mais recente para a mais antiga
        const purchases = (purchasesByCustomer.get(c.id) || [])
          .sort((a, b) => b._sortDate - a._sortDate)
        return {
          id: c.id,
          name: c.name || c.email || 'Cliente',
          channel,
          totalSpent: ltv,
          cac,
          ltv,
          margin,
          status,
          segment: rfmSegmentFromScore(c.rfm_score),
          lastPurchase: c.last_purchase_at ? new Date(c.last_purchase_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) : 'N/A',
          purchases,
          churnProb: Number(c.churn_probability || 0),
        }
      })
      if (mapped.length > 0) setClients(mapped)
    }).finally(() => setLoading(false))
  }, [])

  const kpis = useMemo(() => {
    const total = clients.length || 1
    return {
      ativos: clients.length,
      ltvMedio: clients.reduce((sum, c) => sum + c.ltv, 0) / total,
      churnMedio: clients.reduce((sum, c) => sum + c.churnProb, 0) / total * 100,
      lucrativos: clients.filter(c => c.status === 'Lucrativo').length,
    }
  }, [clients])

  return (
    <div>
      <TopBar onToggleChat={onToggleChat} />

      {/* Page header */}
      <motion.div
        {...fadeUp(0)}
        style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}
      >
        <div>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)',
            letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 5px',
          }}>
            Clientes
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)', margin: 0, letterSpacing: '-0.1px',
          }}>
            Acompanhe o ciclo de vida e unit economics da sua base.
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </motion.div>

      {/* KPI grid — 4 cards */}
      <motion.div
        {...fadeUp(0.06)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}
      >
        <KpiCard label="Clientes Ativos" value={kpis.ativos} decimals={0} delay={0.08} />
        <KpiCard label="LTV Médio" value={kpis.ltvMedio} prefix="R$ " decimals={0} delay={0.13} />
        <KpiCard label="Churn Médio" value={kpis.churnMedio} suffix="%" decimals={1} delay={0.18} />
        <KpiCard label="Lucrativos" value={kpis.lucrativos} decimals={0} delay={0.23} />
      </motion.div>

      {/* Cohort Heatmap — full width */}
      <motion.div {...fadeUp(0.28)} style={{ marginBottom: 14 }}>
        <SectionCard style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', margin: 0,
              }}>
                Retenção por Cohort
              </p>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
              }}>
                {clients.length} clientes · {new Date().getFullYear()}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22,
              letterSpacing: '-0.4px', color: 'var(--color-text-primary)', display: 'block',
            }}>
              Cohort de Recompra
            </span>
          </div>
          <CohortHeatmap />
        </SectionCard>
      </motion.div>

      {/* Two-column: ClientList (left) + RFM Analysis (right) */}
      <motion.div
        {...fadeUp(0.36)}
        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}
      >
        <SectionCard style={{ padding: '20px 24px' }}>
          <ClientList clients={clients} loading={loading} onSelect={setSelectedClient} />
        </SectionCard>

        <SectionCard style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', margin: 0,
              }}>
                Segmentação
              </p>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
              }}>
                RFM
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22,
              letterSpacing: '-0.4px', color: 'var(--color-text-primary)', display: 'block',
            }}>
              Análise RFM
            </span>
          </div>
          <RFMCards clients={clients} onSelect={setSelectedSegment} />
        </SectionCard>
      </motion.div>

      {/* Client profile drawer */}
      <AnimatePresence>
        {selectedClient && (
          <ClientProfile client={selectedClient} onClose={() => setSelectedClient(null)} />
        )}
      </AnimatePresence>

      {/* RFM segment detail drawer */}
      <AnimatePresence>
        {selectedSegment && (
          <RFMSegmentDetail
            segment={selectedSegment}
            clients={clients}
            onClose={() => setSelectedSegment(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
