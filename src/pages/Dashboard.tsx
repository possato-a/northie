import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import RevenueChart from '../components/charts/RevenueChart'
import ChannelChart from '../components/charts/ChannelChart'
import TopClients from '../components/ui/TopClients'
import SalesHeatmap from '../components/charts/SalesHeatmap'
import DateRangePicker, { type DateRange } from '../components/ui/DateRangePicker'
import { dashboardApi } from '../lib/api'
import { type Page } from '../components/layout/Sidebar'

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardUser {
  id: string
  email?: string
  user_metadata?: {
    full_name?: string
  }
}

interface DashboardProps {
  onToggleChat?: () => void
  onNavigate?: (page: Page) => void
  user?: DashboardUser
}

interface DashboardStats {
  faturamento: number
  ticketMedio: number
  pedidos: number
  roi: number
  growthTrend?: string
  growthPositive?: boolean
  activeCustomers: number
  churnRate: number
}

interface ChartPoint {
  date: string
  amount: number
}

interface AttributionChannel {
  channel: string
  revenue: number
  customers: number
}

interface TopCustomer {
  name: string
  email: string
  total_ltv: number
  cac: number
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBR(v: number | null | undefined) {
  if (v === null || v === undefined) return '—'
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

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

// ── Sub-components ────────────────────────────────────────────────────────────

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

function SkeletonBlock({ height, width = '100%', style }: { height: number; width?: string | number; style?: React.CSSProperties }) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
      style={{
        height,
        width,
        background: 'var(--color-bg-secondary)',
        borderRadius: 'var(--radius-sm)',
        ...style,
      }}
    />
  )
}

function KpiSkeleton() {
  return (
    <div style={{
      background: 'var(--color-bg-primary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-lg)',
      boxShadow: 'var(--shadow-md)',
      padding: '18px 20px',
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
    }}>
      <SkeletonBlock height={10} width={80} />
      <SkeletonBlock height={24} width={120} />
    </div>
  )
}

function EmptyState({ onNavigate }: { onNavigate?: (page: Page) => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '80px 32px',
        gap: 16,
        textAlign: 'center',
      }}
    >
      <div style={{
        width: 48,
        height: 48,
        borderRadius: '50%',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4,
      }}>
        <span style={{ fontSize: 22, lineHeight: 1 }}>∅</span>
      </div>
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontWeight: 500,
        fontSize: 'var(--text-lg)',
        letterSpacing: '-0.3px',
        color: 'var(--color-text-primary)',
        margin: 0,
      }}>
        Nenhum dado no período
      </p>
      <p style={{
        fontFamily: 'var(--font-sans)',
        fontSize: 'var(--text-base)',
        color: 'var(--color-text-secondary)',
        margin: 0,
        maxWidth: 360,
        lineHeight: 1.5,
      }}>
        Conecte suas integrações para ver dados reais de faturamento, clientes e canais aqui.
      </p>
      {onNavigate && (
        <motion.button
          onClick={() => onNavigate('app-store')}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          style={{
            marginTop: 8,
            padding: '9px 20px',
            background: 'var(--color-bg-primary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-md)',
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-sm)',
            fontWeight: 500,
            color: 'var(--color-text-primary)',
            cursor: 'pointer',
            letterSpacing: '-0.1px',
          }}
        >
          Conectar integrações
        </motion.button>
      )}
    </motion.div>
  )
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard({ onToggleChat, onNavigate, user }: DashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange)
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [chartData, setChartData] = useState<ChartPoint[] | null>(null)
  const [attribution, setAttribution] = useState<AttributionChannel[] | null>(null)
  const [heatmap, setHeatmap] = useState<Record<string, number> | null>(null)
  const [topCustomers, setTopCustomers] = useState<TopCustomer[] | null>(null)

  const load = useCallback(() => {
    if (!user?.id) return
    setLoading(true)
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1

    dashboardApi.getFull(days)
      .then(({ data: full }) => {
        const raw = full.stats ?? {}
        const campaigns: Array<{ spend_brl?: number; purchase_value?: number }> = full.adCampaigns ?? []
        const growth = full.growth

        const totalSpend = campaigns.reduce((s, c) => s + (c.spend_brl ?? 0), 0)
        const totalRevenue = campaigns.reduce((s, c) => s + (c.purchase_value ?? 0), 0)
        const growthPct: number | null = growth?.growth_percentage ?? null

        setStats({
          faturamento: raw.total_revenue ?? 0,
          ticketMedio: raw.average_ticket ?? 0,
          pedidos: raw.total_transactions ?? 0,
          roi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
          growthTrend: growthPct !== null ? `${Math.abs(growthPct).toFixed(1)}%` : undefined,
          growthPositive: growthPct !== null ? growthPct >= 0 : undefined,
          activeCustomers: raw.active_customers ?? 0,
          churnRate: raw.churn_rate ?? 0,
        })

        setChartData(Array.isArray(full.chart) && full.chart.length > 0 ? full.chart : null)
        setAttribution(Array.isArray(full.attribution) && full.attribution.length > 0 ? full.attribution : null)
        setTopCustomers(Array.isArray(full.topCustomers) && full.topCustomers.length > 0 ? full.topCustomers : null)

        // heatmap pode vir junto ou ser chamado separadamente
        if (full.heatmap && Object.keys(full.heatmap).length > 0) {
          setHeatmap(full.heatmap)
        } else {
          dashboardApi.getHeatmap()
            .then(({ data: hm }) => {
              setHeatmap(hm && Object.keys(hm).length > 0 ? hm : {})
            })
            .catch(() => setHeatmap({}))
        }
      })
      .catch(err => {
        console.error('[Dashboard] getFull falhou:', err)
        setStats(null)
        setChartData(null)
        setAttribution(null)
        setTopCustomers(null)
        setHeatmap({})
      })
      .finally(() => setLoading(false))
  }, [user?.id, dateRange])

  useEffect(() => {
    load()
  }, [load])

  const userName = user?.user_metadata?.full_name?.split(' ')[0] ?? user?.email?.split('@')[0] ?? 'você'
  const totalChannelRevenue = attribution?.reduce((s, c) => s + c.revenue, 0) ?? stats?.faturamento ?? 0
  const hasData = stats !== null && stats.faturamento > 0

  return (
    <div>
      <TopBar onToggleChat={onToggleChat} />

      {/* ── Page Header ── */}
      <motion.div {...fadeUp(0)} style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: 'var(--text-3xl)',
            letterSpacing: '-0.5px',
            color: 'var(--color-text-primary)',
            lineHeight: 1.1,
            margin: '0 0 5px',
          }}>
            Olá, {userName}
          </h1>
          <p style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            color: 'var(--color-text-secondary)',
            margin: '0 0 10px',
            letterSpacing: '-0.1px',
          }}>
            Visão consolidada do seu negócio.
          </p>

          {/* ── Integration source pills ── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {['Meta Ads', 'Hotmart', 'Google Ads'].map(src => (
              <span key={src} style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 9px',
                background: 'var(--color-bg-primary)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-full)',
                fontFamily: 'var(--font-sans)',
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                fontWeight: 400,
                boxShadow: 'var(--shadow-sm)',
              }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--color-primary)', display: 'block', flexShrink: 0 }} />
                {src}
              </span>
            ))}
          </div>
        </div>
        <DateRangePicker value={dateRange} onChange={setDateRange} />
      </motion.div>

      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {/* ── KPI Skeleton ── */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
              {[0, 1, 2, 3].map(i => <KpiSkeleton key={i} />)}
            </div>

            {/* ── Heatmap Skeleton ── */}
            <div style={{ marginBottom: 14 }}>
              <SectionCard style={{ padding: '20px 24px' }}>
                <SkeletonBlock height={12} width={140} style={{ marginBottom: 16 }} />
                <SkeletonBlock height={80} />
              </SectionCard>
            </div>

            {/* ── Chart Skeleton ── */}
            <div style={{ marginBottom: 14 }}>
              <SectionCard style={{ padding: '20px 24px 16px' }}>
                <SkeletonBlock height={12} width={160} style={{ marginBottom: 10 }} />
                <SkeletonBlock height={28} width={200} style={{ marginBottom: 20 }} />
                <SkeletonBlock height={180} />
              </SectionCard>
            </div>

            {/* ── Bottom row Skeleton ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[0, 1].map(i => (
                <SectionCard key={i} style={{ padding: '20px 24px' }}>
                  <SkeletonBlock height={12} width={120} style={{ marginBottom: 10 }} />
                  <SkeletonBlock height={28} width={160} style={{ marginBottom: 20 }} />
                  <SkeletonBlock height={160} />
                </SectionCard>
              ))}
            </div>
          </motion.div>
        ) : !hasData ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <SectionCard>
              <EmptyState onNavigate={onNavigate} />
            </SectionCard>
          </motion.div>
        ) : (
          <motion.div
            key="content"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {/* ── KPI Grid — 4 cards ── */}
            <motion.div
              {...fadeUp(0.06)}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}
            >
              <KpiCard
                label="Faturamento"
                value={stats.faturamento}
                prefix="R$ "
                decimals={0}
                delay={0.08}
                trend={stats.growthTrend}
                positive={stats.growthPositive}
              />
              <KpiCard label="Ticket Médio" value={stats.ticketMedio} prefix="R$ " decimals={0} delay={0.13} />
              <KpiCard label="ROAS Geral" value={stats.roi} suffix="x" decimals={2} delay={0.18} />
              <KpiCard label="Clientes Ativos" value={stats.activeCustomers} decimals={0} delay={0.23} />
            </motion.div>

            {/* ── Heatmap — primeiro após os KPIs ── */}
            <motion.div {...fadeUp(0.2)} style={{ marginBottom: 14 }}>
              <SectionCard style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    fontWeight: 400,
                    color: 'var(--color-text-secondary)',
                    letterSpacing: '0.02em',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}>
                    Atividade de Vendas
                  </p>
                  <span style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 11,
                    color: 'var(--color-text-tertiary)',
                    background: 'var(--color-bg-secondary)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-full)',
                    padding: '1px 7px',
                    fontWeight: 400,
                  }}>
                    365 dias
                  </span>
                </div>
                <SalesHeatmap initialData={heatmap ?? {}} />
              </SectionCard>
            </motion.div>

            {/* ── Revenue chart card ── */}
            <motion.div {...fadeUp(0.28)} style={{ marginBottom: 14 }}>
              <SectionCard style={{ padding: '20px 24px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20 }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                      <p style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        fontWeight: 400,
                        color: 'var(--color-text-secondary)',
                        letterSpacing: '0.02em',
                        textTransform: 'uppercase',
                        margin: 0,
                      }}>
                        Receita no período
                      </p>
                      <span style={{
                        fontFamily: 'var(--font-sans)',
                        fontSize: 11,
                        color: 'var(--color-text-tertiary)',
                        background: 'var(--color-bg-secondary)',
                        border: '1px solid var(--color-border)',
                        borderRadius: 'var(--radius-full)',
                        padding: '1px 7px',
                        fontWeight: 400,
                      }}>
                        {dateRange.label ?? `${Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1} dias`}
                      </span>
                    </div>
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      fontSize: 22,
                      letterSpacing: '-0.4px',
                      color: 'var(--color-text-primary)',
                      display: 'block',
                    }}>
                      R$ {fmtBR(stats.faturamento)}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      color: 'var(--color-text-tertiary)',
                      letterSpacing: '-0.1px',
                      marginTop: 3,
                      display: 'block',
                    }}>
                      {fmtBR(stats.pedidos)} pedidos · R$ {fmtBR(stats.ticketMedio)} ticket médio
                    </span>
                  </div>
                  {stats.growthTrend && (
                    <span style={{
                      fontFamily: 'var(--font-sans)',
                      fontSize: 12,
                      fontWeight: 500,
                      color: stats.growthPositive ? 'var(--status-complete)' : 'var(--accent-red)',
                      background: stats.growthPositive ? 'var(--status-complete-bg)' : 'var(--priority-high-bg)',
                      padding: '3px 8px',
                      borderRadius: 'var(--radius-sm)',
                      marginTop: 4,
                    }}>
                      {stats.growthPositive ? '↑' : '↓'} {stats.growthTrend} vs período anterior
                    </span>
                  )}
                </div>
                <RevenueChart initialData={chartData ?? []} />
              </SectionCard>
            </motion.div>

            {/* ── Canais + Top Clientes ── */}
            <motion.div
              {...fadeUp(0.36)}
              style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}
            >
              <SectionCard style={{ padding: '20px 24px' }}>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  margin: '0 0 4px',
                }}>
                  Receita por Canal
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.4px',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 16px',
                }}>
                  {attribution ? `R$ ${fmtBR(totalChannelRevenue)}` : '—'}
                </p>
                {attribution ? (
                  <ChannelChart initialData={attribution} />
                ) : (
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-tertiary)',
                    margin: 0,
                  }}>
                    Sem dados de atribuição no período.
                  </p>
                )}
              </SectionCard>

              <SectionCard style={{ padding: '20px 24px' }}>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 11,
                  fontWeight: 400,
                  color: 'var(--color-text-secondary)',
                  letterSpacing: '0.02em',
                  textTransform: 'uppercase',
                  margin: '0 0 4px',
                }}>
                  Top Clientes
                </p>
                <p style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: 22,
                  fontWeight: 500,
                  letterSpacing: '-0.4px',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 16px',
                }}>
                  {topCustomers ? `${topCustomers.length} clientes` : '—'}
                </p>
                {topCustomers ? (
                  <TopClients initialData={topCustomers} />
                ) : (
                  <p style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-text-tertiary)',
                    margin: 0,
                  }}>
                    Sem clientes no período.
                  </p>
                )}
              </SectionCard>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
