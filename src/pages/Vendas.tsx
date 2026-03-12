import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import DateRangePicker, { type DateRange } from '../components/ui/DateRangePicker'
import { Input } from '../components/ui/shared'
import { dashboardApi, dataApi } from '../lib/api'
import { fmtBR } from '../lib/utils'
import type { Transaction, TransactionStatus } from '../types'

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_TRANSACTIONS: Transaction[] = [
  { id: '1',  date: '09/03/2026', client: 'Rafael Mendes',     product: 'Método Escrita Avançada', value: 497,  method: 'Pix',    status: 'Pago',        channel: 'Meta Ads' },
  { id: '2',  date: '09/03/2026', client: 'Ana Paula Costa',   product: 'Mentoria Individual',      value: 1200, method: 'Cartão', status: 'Pago',        channel: 'Google Ads' },
  { id: '3',  date: '08/03/2026', client: 'Bruno Oliveira',    product: 'Copywriting na Prática',   value: 297,  method: 'Pix',    status: 'Pago',        channel: 'Meta Ads' },
  { id: '4',  date: '08/03/2026', client: 'Carla Santos',      product: 'Pack Templates Premium',   value: 197,  method: 'Boleto', status: 'Pendente',    channel: 'Direto' },
  { id: '5',  date: '07/03/2026', client: 'Diego Ferreira',    product: 'Método Escrita Avançada', value: 497,  method: 'Cartão', status: 'Pago',        channel: 'Meta Ads' },
  { id: '6',  date: '07/03/2026', client: 'Fernanda Lima',     product: 'Acesso Comunidade VIP',   value: 97,   method: 'Pix',    status: 'Pago',        channel: 'Email' },
  { id: '7',  date: '06/03/2026', client: 'Gabriel Rocha',     product: 'Mentoria Individual',      value: 1200, method: 'Cartão', status: 'Pago',        channel: 'Google Ads' },
  { id: '8',  date: '06/03/2026', client: 'Helena Martins',    product: 'Copywriting na Prática',   value: 297,  method: 'Pix',    status: 'Reembolsado', channel: 'Meta Ads' },
  { id: '9',  date: '05/03/2026', client: 'Igor Souza',        product: 'Método Escrita Avançada', value: 497,  method: 'Boleto', status: 'Pago',        channel: 'Meta Ads' },
  { id: '10', date: '05/03/2026', client: 'Juliana Pereira',   product: 'Pack Templates Premium',   value: 197,  method: 'Pix',    status: 'Pago',        channel: 'Direto' },
  { id: '11', date: '04/03/2026', client: 'Lucas Almeida',     product: 'Acesso Comunidade VIP',   value: 97,   method: 'Cartão', status: 'Pago',        channel: 'Meta Ads' },
  { id: '12', date: '04/03/2026', client: 'Marina Castro',     product: 'Método Escrita Avançada', value: 497,  method: 'Pix',    status: 'Pago',        channel: 'Google Ads' },
  { id: '13', date: '03/03/2026', client: 'Nicolas Barbosa',   product: 'Mentoria Individual',      value: 1200, method: 'Cartão', status: 'Pendente',    channel: 'Google Ads' },
  { id: '14', date: '03/03/2026', client: 'Olivia Torres',     product: 'Copywriting na Prática',   value: 297,  method: 'Pix',    status: 'Pago',        channel: 'Meta Ads' },
  { id: '15', date: '02/03/2026', client: 'Paulo Gomes',       product: 'Pack Templates Premium',   value: 197,  method: 'Boleto', status: 'Pago',        channel: 'Direto' },
  { id: '16', date: '02/03/2026', client: 'Renata Nunes',      product: 'Método Escrita Avançada', value: 497,  method: 'Pix',    status: 'Pago',        channel: 'Meta Ads' },
  { id: '17', date: '01/03/2026', client: 'Samuel Freitas',    product: 'Acesso Comunidade VIP',   value: 97,   method: 'Cartão', status: 'Reembolsado', channel: 'Email' },
  { id: '18', date: '01/03/2026', client: 'Tatiane Ramos',     product: 'Copywriting na Prática',   value: 297,  method: 'Pix',    status: 'Pago',        channel: 'Meta Ads' },
  { id: '19', date: '28/02/2026', client: 'Ubirajara Silva',   product: 'Método Escrita Avançada', value: 497,  method: 'Cartão', status: 'Pago',        channel: 'Google Ads' },
  { id: '20', date: '28/02/2026', client: 'Vanessa Cardoso',   product: 'Mentoria Individual',      value: 1200, method: 'Pix',    status: 'Pago',        channel: 'Meta Ads' },
]

const MOCK_STATS = {
  total_revenue: 8854,
  average_ticket: 443,
  convRate: 3.8,
}

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

// ── Status Tag ────────────────────────────────────────────────────────────────

function StatusTag({ status }: { status: TransactionStatus }) {
  const cls = status === 'Pago' ? 'tag-complete' : status === 'Pendente' ? 'tag-planning' : 'tag-neutral'
  return <span className={`tag ${cls}`}>{status}</span>
}

// ── Status Distribution Bar ───────────────────────────────────────────────────

function StatusDistributionBar({ transactions }: { transactions: Transaction[] }) {
  const total = transactions.length
  if (total === 0) return null

  const pago = transactions.filter(t => t.status === 'Pago').length
  const pendente = transactions.filter(t => t.status === 'Pendente').length
  const reembolsado = transactions.filter(t => t.status === 'Reembolsado').length

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        height: 4, borderRadius: 4, overflow: 'hidden',
        display: 'flex', background: 'var(--color-bg-secondary)', marginBottom: 8,
      }}>
        <motion.div style={{ height: '100%', background: 'var(--status-complete)', flexShrink: 0 }}
          initial={{ width: 0 }} animate={{ width: `${(pago / total) * 100}%` }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }} />
        <motion.div style={{ height: '100%', background: 'var(--status-planning)', flexShrink: 0 }}
          initial={{ width: 0 }} animate={{ width: `${(pendente / total) * 100}%` }}
          transition={{ duration: 0.8, delay: 0.05, ease: [0.25, 0.1, 0.25, 1] }} />
        <motion.div style={{ height: '100%', background: 'var(--accent-red)', flexShrink: 0 }}
          initial={{ width: 0 }} animate={{ width: `${(reembolsado / total) * 100}%` }}
          transition={{ duration: 0.8, delay: 0.1, ease: [0.25, 0.1, 0.25, 1] }} />
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {[
          { label: `${pago} Pago`, color: 'var(--status-complete)' },
          { label: `${pendente} Pendente`, color: 'var(--status-planning)' },
          { label: `${reembolsado} Reembolsado`, color: 'var(--accent-red)' },
        ].map(({ label, color }) => (
          <span key={label} style={{
            display: 'inline-flex', alignItems: 'center', gap: 5,
            fontFamily: 'var(--font-sans)', fontSize: 11,
            color: 'var(--color-text-tertiary)', fontWeight: 400,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            {label}
          </span>
        ))}
      </div>
    </div>
  )
}

// ── Filter Buttons ────────────────────────────────────────────────────────────

const STATUS_FILTERS: Array<TransactionStatus | 'Todos'> = ['Todos', 'Pago', 'Pendente', 'Reembolsado']

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

// ── Daily Revenue Chart ───────────────────────────────────────────────────────

function DailyRevenueChart({ transactions }: { transactions: Transaction[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerW, setContainerW] = useState(600)
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const obs = new ResizeObserver(([entry]) => setContainerW(entry.contentRect.width))
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  const daily = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.status === 'Pago').forEach(t => {
      map.set(t.date, (map.get(t.date) || 0) + t.value)
    })
    return Array.from(map.entries())
      .map(([date, revenue]) => ({ date, revenue }))
      .sort((a, b) => {
        const parse = (s: string) => { const [d, m, y] = s.split('/').map(Number); return new Date(y, m - 1, d).getTime() }
        return parse(a.date) - parse(b.date)
      })
  }, [transactions])

  const n = daily.length
  const max = Math.max(1, ...daily.map(d => d.revenue))
  const totalRevenue = daily.reduce((s, d) => s + d.revenue, 0)
  const avgRevenue = n > 0 ? totalRevenue / n : 0
  const peakDay = daily.reduce<{ date: string; revenue: number } | null>((best, d) =>
    !best || d.revenue > best.revenue ? d : best, null)

  const H = 96
  const PAD_T = 6
  const PAD_B = 0

  function xOf(i: number) {
    if (n <= 1) return containerW / 2
    return (i / (n - 1)) * containerW
  }
  function yOf(v: number) {
    return PAD_T + (1 - v / max) * (H - PAD_T - PAD_B)
  }

  const linePath = daily.map((d, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)},${yOf(d.revenue).toFixed(1)}`).join(' ')
  const areaPath = n > 0
    ? `${linePath} L${xOf(n - 1).toFixed(1)},${H} L${xOf(0).toFixed(1)},${H}Z`
    : ''
  const avgY = yOf(avgRevenue)

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const relX = e.clientX - rect.left
    let best = 0, bestDist = Infinity
    daily.forEach((_, i) => {
      const dist = Math.abs(xOf(i) - relX)
      if (dist < bestDist) { bestDist = dist; best = i }
    })
    setHoveredIdx(best)
  }

  // date labels: show first, last, and every ~3 days in between
  const labelEvery = Math.max(1, Math.floor(n / 5))
  const labelIndices = new Set<number>([0, n - 1])
  for (let i = labelEvery; i < n - 1; i += labelEvery) labelIndices.add(i)

  if (n === 0) return null

  return (
    <SectionCard style={{ padding: '20px 24px 16px', marginBottom: 14 }}>
      {/* Header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
            color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
            textTransform: 'uppercase', margin: 0,
          }}>
            Receita Diária
          </p>
          <span style={{
            fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
            background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-full)', padding: '1px 7px',
          }}>
            {n} dias com vendas
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
          <span style={{
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22,
            letterSpacing: '-0.4px', color: 'var(--color-text-primary)',
          }}>
            R$ {fmtBR(totalRevenue)}
          </span>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
            {peakDay && (
              <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)',
                  letterSpacing: '0.04em', textTransform: 'uppercase',
                }}>Pico</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                  R$ {fmtBR(peakDay.revenue)}
                </span>
                <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>
                  {peakDay.date}
                </span>
              </span>
            )}
            <span style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)',
                letterSpacing: '0.04em', textTransform: 'uppercase',
              }}>Média/dia</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 500, color: 'var(--color-text-secondary)' }}>
                R$ {fmtBR(Math.round(avgRevenue))}
              </span>
            </span>
          </div>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ position: 'relative', height: H + 20 }}>
        {containerW > 0 && (
          <svg
            width={containerW}
            height={H}
            style={{ display: 'block', overflow: 'visible', cursor: 'crosshair' }}
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <defs>
              <linearGradient id="drc-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#FF5900" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#FF5900" stopOpacity="0.01" />
              </linearGradient>
            </defs>

            {/* Horizontal grid lines */}
            {[0.25, 0.5, 0.75, 1].map(pct => (
              <line
                key={pct}
                x1={0} y1={yOf(max * pct).toFixed(1)}
                x2={containerW} y2={yOf(max * pct).toFixed(1)}
                stroke="var(--color-border)" strokeWidth={1}
              />
            ))}

            {/* Average dashed reference line */}
            <line
              x1={0} y1={avgY.toFixed(1)} x2={containerW} y2={avgY.toFixed(1)}
              stroke="#FF5900" strokeWidth={1} strokeDasharray="4 4" opacity={0.35}
            />
            <text
              x={4} y={(avgY - 4).toFixed(1)}
              fontFamily="var(--font-mono)" fontSize={9} fill="#FF5900" opacity={0.5}
            >
              média
            </text>

            {/* Area fill */}
            <motion.path
              d={areaPath} fill="url(#drc-grad)"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.6 }}
            />

            {/* Line */}
            <motion.path
              d={linePath} fill="none"
              stroke="#FF5900" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.1, ease: [0.25, 0.1, 0.25, 1] }}
            />

            {/* Hover crosshair */}
            {hoveredIdx !== null && (
              <line
                x1={xOf(hoveredIdx).toFixed(1)} y1={0}
                x2={xOf(hoveredIdx).toFixed(1)} y2={H}
                stroke="var(--color-text-tertiary)" strokeWidth={1} strokeDasharray="3 3"
              />
            )}

            {/* Data dots — always rendered, opacity controlled */}
            {daily.map((d, i) => (
              <circle
                key={i}
                cx={xOf(i).toFixed(1)} cy={yOf(d.revenue).toFixed(1)}
                r={hoveredIdx === i ? 3.5 : 2}
                fill={hoveredIdx === i ? '#FF5900' : 'var(--color-bg-primary)'}
                stroke="#FF5900"
                strokeWidth={1.5}
                style={{ transition: 'r 0.12s ease, fill 0.12s ease' }}
              />
            ))}
          </svg>
        )}

        {/* Tooltip */}
        {hoveredIdx !== null && containerW > 0 && (() => {
          const d = daily[hoveredIdx]
          const pctX = (xOf(hoveredIdx) / containerW) * 100
          const isRight = pctX > 75
          return (
            <div style={{
              position: 'absolute',
              top: Math.max(0, yOf(d.revenue) - 52),
              left: isRight ? 'auto' : `${pctX}%`,
              right: isRight ? `${100 - pctX}%` : 'auto',
              transform: isRight ? 'translateX(50%)' : 'translateX(-50%)',
              background: 'var(--color-text-primary)',
              color: 'var(--color-bg-primary)',
              padding: '6px 10px',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-lg)',
              pointerEvents: 'none',
              zIndex: 10,
              whiteSpace: 'nowrap',
            }}>
              <p style={{ fontFamily: 'var(--font-sans)', fontSize: 10, opacity: 0.6, margin: '0 0 2px' }}>{d.date}</p>
              <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, margin: 0 }}>
                R$ {fmtBR(d.revenue)}
              </p>
            </div>
          )
        })()}

        {/* Date axis labels */}
        <div style={{ position: 'absolute', top: H + 4, left: 0, right: 0, pointerEvents: 'none' }}>
          {daily.map((d, i) => {
            if (!labelIndices.has(i)) return null
            const pctX = (xOf(i) / containerW) * 100
            return (
              <span key={i} style={{
                position: 'absolute',
                left: `${pctX}%`,
                transform: 'translateX(-50%)',
                fontFamily: 'var(--font-sans)',
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                whiteSpace: 'nowrap',
              }}>
                {d.date.slice(0, 5)}
              </span>
            )
          })}
        </div>
      </div>
    </SectionCard>
  )
}

// ── Constants ─────────────────────────────────────────────────────────────────

const PAGE_SIZE = 5

// ── Page Component ────────────────────────────────────────────────────────────

export default function Vendas({ onToggleChat, user }: { onToggleChat?: () => void; user?: any }) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange)
  const [transactions, setTransactions] = useState<Transaction[]>(MOCK_TRANSACTIONS)
  const [stats, setStats] = useState<any>(MOCK_STATS)
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TransactionStatus | 'Todos'>('Todos')
  const [search, setSearch] = useState('')
  const [currentPage, setCurrentPage] = useState(0)

  useEffect(() => {
    if (!user?.id) return
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1
    setLoading(true)

    const txPromise = dataApi.getTransactions(days).catch(() => ({ data: [] }))
    const statsPromise = dashboardApi.getStats().catch(() => ({ data: {} }))
    const campaignsPromise = dashboardApi.getAdCampaigns(days).catch(() => ({ data: [] }))

    Promise.all([txPromise, statsPromise, campaignsPromise]).then(([txRes, statsRes, campaignsRes]) => {
      const rawTx = Array.isArray(txRes.data) ? txRes.data : []
      const mapped = rawTx.map((t: any) => ({
        id: t.id,
        date: new Date(t.created_at).toLocaleDateString('pt-BR'),
        client: t.customers?.name || t.customers?.email || 'Desconhecido',
        product: t.product_name || '—',
        value: Number(t.amount_net),
        method: t.payment_method || '—',
        status: (({ approved: 'Pago', pending: 'Pendente', refunded: 'Reembolsado', cancelled: 'Cancelado', chargeback: 'Estorno' } as Record<string, string>)[t.status] ?? 'Pendente') as TransactionStatus,
        channel: (t.customers?.acquisition_channel || 'Direto') as any,
      }))
      if (mapped.length > 0) setTransactions(mapped)

      const campaigns: any[] = Array.isArray(campaignsRes.data) ? campaignsRes.data : []
      const totalLeads = campaigns.reduce((s: number, c: any) => s + (c.leads || 0), 0)
      const totalPurchases = campaigns.reduce((s: number, c: any) => s + (c.purchases || 0), 0)
      const convRate = totalLeads > 0 ? (totalPurchases / totalLeads) * 100 : null
      const statsData = statsRes.data as any
      if (statsData?.total_revenue) setStats({ ...statsData, convRate })
    }).finally(() => setLoading(false))
  }, [user?.id, dateRange])

  // ── Derived data ────────────────────────────────────────────────────────────

  const filtered = useMemo(() => transactions.filter(t => {
    if (statusFilter !== 'Todos' && t.status !== statusFilter) return false
    if (search && !t.client.toLowerCase().includes(search.toLowerCase()) &&
      !t.product.toLowerCase().includes(search.toLowerCase())) return false
    return true
  }), [transactions, statusFilter, search])

  const products = useMemo(() => {
    const map = new Map<string, { qty: number; revenue: number }>()
    transactions.filter(t => t.status === 'Pago').forEach(t => {
      const prev = map.get(t.product) || { qty: 0, revenue: 0 }
      map.set(t.product, { qty: prev.qty + 1, revenue: prev.revenue + t.value })
    })
    return Array.from(map.entries())
      .map(([name, s]) => ({ name, ...s }))
      .sort((a, b) => b.revenue - a.revenue)
  }, [transactions])

  const maxRevenue = useMemo(() => Math.max(0, ...products.map(p => p.revenue)), [products])

  // Reset page when filters change
  useEffect(() => { setCurrentPage(0) }, [statusFilter, search])

  const pagedRows = useMemo(
    () => filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE),
    [filtered, currentPage]
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

  const periodLabel = dateRange.label ?? `${Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1} dias`

  return (
    <div>
      <TopBar onToggleChat={onToggleChat} />

      {/* ── Page Header ── */}
      <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 'var(--text-3xl)',
            letterSpacing: '-0.5px', color: 'var(--color-text-primary)', lineHeight: 1.1, margin: '0 0 5px',
          }}>
            Vendas
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)', margin: 0, letterSpacing: '-0.1px',
          }}>
            Analise cada transação e o desempenho dos seus produtos.
          </p>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </motion.div>

      {/* ── KPI Grid — 4 cards ── */}
      <motion.div
        {...fadeUp(0.06)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}
      >
        <KpiCard label="Faturamento" value={stats?.total_revenue || 0} prefix="R$ " decimals={0} delay={0.08} />
        <KpiCard label="Ticket Médio" value={stats?.average_ticket || 0} prefix="R$ " decimals={0} delay={0.13} />
        <KpiCard label="Transações" value={transactions.length} decimals={0} delay={0.18} />
        <KpiCard label="Taxa Conversão" value={stats?.convRate ?? 0} suffix="%" decimals={1} delay={0.23} />
      </motion.div>

      {/* ── Daily Revenue Chart ── */}
      <motion.div {...fadeUp(0.26)}>
        <DailyRevenueChart transactions={transactions} />
      </motion.div>

      {/* ── Two-column layout ── */}
      <motion.div
        {...fadeUp(0.32)}
        style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}
      >
        {/* ── Left: Transactions ── */}
        <SectionCard style={{ padding: '20px 24px' }}>
          {/* Section header */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', margin: 0,
              }}>
                Transações
              </p>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
              }}>
                {periodLabel}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22,
              letterSpacing: '-0.4px', color: 'var(--color-text-primary)', display: 'block',
            }}>
              {filtered.length} transações
            </span>
          </div>

          {/* Status distribution bar */}
          <StatusDistributionBar transactions={transactions} />

          {/* Filter row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 4, flex: 1 }}>
              {STATUS_FILTERS.map(s => (
                <FilterButton key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)}>
                  {s}
                </FilterButton>
              ))}
            </div>
            <div style={{ flexShrink: 0, width: 140 }}>
              <Input
                placeholder="Filtrar..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                icon={
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                }
              />
            </div>
          </div>

          {/* Table header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 80px 72px 90px',
            gap: '0 16px', paddingBottom: 10,
            borderBottom: '1px solid var(--color-border)', marginBottom: 0,
          }}>
            {(['Cliente', 'Produto', 'Valor', 'Método', 'Status'] as const).map((h, i) => (
              <span key={h} style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                color: 'var(--color-text-tertiary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', textAlign: i === 2 ? 'right' : 'left',
              }}>
                {h}
              </span>
            ))}
          </div>

          {/* Table rows — animated as a single batch per page */}
          <div style={{ minHeight: PAGE_SIZE * 44 }}>
            <AnimatePresence mode="wait" initial={false}>
              {loading ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  style={{ padding: '40px 0', textAlign: 'center' }}
                >
                  <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                    Carregando...
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
                    Nenhuma transação encontrada.
                  </p>
                  <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 12, margin: '4px 0 0' }}>
                    Tente ajustar os filtros ou pesquisar outro termo.
                  </p>
                </motion.div>
              ) : (
                <motion.div
                  key={`page-${currentPage}`}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -5 }}
                  transition={{ duration: 0.18, ease: [0.25, 0.1, 0.25, 1] }}
                >
                  {pagedRows.map((t) => (
                    <motion.div
                      key={t.id}
                      whileHover={{ background: 'var(--color-bg-secondary)' }}
                      style={{
                        display: 'grid', gridTemplateColumns: '1fr 1fr 80px 72px 90px',
                        gap: '0 16px', padding: '11px 6px',
                        borderBottom: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-sm)',
                        cursor: 'default', alignItems: 'center',
                      }}
                    >
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)',
                        fontWeight: 500, color: 'var(--color-text-primary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.client}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-secondary)',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {t.product}
                      </span>
                      <span style={{
                        fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                        color: 'var(--color-text-primary)', textAlign: 'right',
                      }}>
                        R$ {fmtBR(t.value)}
                      </span>
                      <span className="tag tag-neutral">{t.method}</span>
                      <StatusTag status={t.status} />
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
                {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, filtered.length)} de {filtered.length}
              </span>
              <div style={{ display: 'flex', gap: 4 }}>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(p => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    background: 'transparent', cursor: currentPage === 0 ? 'default' : 'pointer',
                    color: 'var(--color-text-secondary)', opacity: currentPage === 0 ? 0.35 : 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setCurrentPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={currentPage >= totalPages - 1}
                  style={{
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    border: '1px solid var(--color-border)', borderRadius: 'var(--radius-md)',
                    background: 'transparent', cursor: currentPage >= totalPages - 1 ? 'default' : 'pointer',
                    color: 'var(--color-text-secondary)', opacity: currentPage >= totalPages - 1 ? 0.35 : 1,
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </motion.button>
              </div>
            </div>
          )}
        </SectionCard>

        {/* ── Right: Product Revenue ── */}
        <SectionCard style={{ padding: '20px 24px' }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
              <p style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 400,
                color: 'var(--color-text-secondary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', margin: 0,
              }}>
                Por Produto
              </p>
              <span style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, color: 'var(--color-text-tertiary)',
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)', padding: '1px 7px', fontWeight: 400,
              }}>
                {periodLabel}
              </span>
            </div>
            <span style={{
              fontFamily: 'var(--font-sans)', fontWeight: 500, fontSize: 22,
              letterSpacing: '-0.4px', color: 'var(--color-text-primary)', display: 'block',
            }}>
              {products.length} produtos
            </span>
          </div>

          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 44px 90px', gap: '0 12px',
            paddingBottom: 10, borderBottom: '1px solid var(--color-border)', marginBottom: 2,
          }}>
            {(['Produto', 'Qtd', 'Receita'] as const).map((h, i) => (
              <span key={h} style={{
                fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500,
                color: 'var(--color-text-tertiary)', letterSpacing: '0.02em',
                textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left',
              }}>
                {h}
              </span>
            ))}
          </div>

          {products.length === 0 ? (
            <div style={{ padding: '40px 0', textAlign: 'center' }}>
              <p style={{ fontFamily: 'var(--font-sans)', color: 'var(--color-text-tertiary)', fontSize: 'var(--text-sm)', margin: 0 }}>
                Nenhum produto encontrado.
              </p>
            </div>
          ) : products.map((p, i) => (
            <div key={p.name} style={{ padding: '12px 0', borderBottom: '1px solid var(--color-border)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 44px 90px', gap: '0 12px', marginBottom: 8, alignItems: 'center' }}>
                <span style={{
                  fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-primary)',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {p.name}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--color-text-tertiary)', textAlign: 'right' }}>
                  {p.qty}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)', textAlign: 'right' }}>
                  R$ {fmtBR(p.revenue)}
                </span>
              </div>
              <div style={{ height: 3, background: 'var(--color-bg-secondary)', borderRadius: 4 }}>
                <motion.div
                  style={{ height: '100%', background: 'var(--color-primary)', borderRadius: 4 }}
                  initial={{ width: 0 }}
                  animate={{ width: `${maxRevenue > 0 ? (p.revenue / maxRevenue) * 100 : 0}%` }}
                  transition={{ duration: 0.9, delay: i * 0.08, ease: [0.25, 0.1, 0.25, 1] }}
                />
              </div>
            </div>
          ))}
        </SectionCard>
      </motion.div>
    </div>
  )
}
