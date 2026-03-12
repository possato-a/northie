import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import RevenueChart from '../components/charts/RevenueChart'
import ChannelChart from '../components/charts/ChannelChart'
import TopClients from '../components/ui/TopClients'
import SalesHeatmap from '../components/charts/SalesHeatmap'
import DateRangePicker, { type DateRange } from '../components/ui/DateRangePicker'
import { dashboardApi } from '../lib/api'

interface DashboardProps {
  onToggleChat?: () => void
  user?: any
}

// ── Mock data ─────────────────────────────────────────────────────────────────

const MOCK_STATS = {
  faturamento: 87340,
  ticketMedio: 297,
  pedidos: 294,
  roi: 3.2,
  growthTrend: '18.4%',
  growthPositive: true,
  activeCustomers: 214,
  churnRate: 4.2,
}

const MOCK_CHART_DATA = [
  { date: '2026-02-08', amount: 1840 },
  { date: '2026-02-09', amount: 2980 },
  { date: '2026-02-10', amount: 1420 },
  { date: '2026-02-11', amount: 3100 },
  { date: '2026-02-12', amount: 2750 },
  { date: '2026-02-13', amount: 4200 },
  { date: '2026-02-14', amount: 3640 },
  { date: '2026-02-15', amount: 2100 },
  { date: '2026-02-16', amount: 2890 },
  { date: '2026-02-17', amount: 3340 },
  { date: '2026-02-18', amount: 2680 },
  { date: '2026-02-19', amount: 3900 },
  { date: '2026-02-20', amount: 4100 },
  { date: '2026-02-21', amount: 3250 },
  { date: '2026-02-22', amount: 2100 },
  { date: '2026-02-23', amount: 2840 },
  { date: '2026-02-24', amount: 3560 },
  { date: '2026-02-25', amount: 4780 },
  { date: '2026-02-26', amount: 3920 },
  { date: '2026-02-27', amount: 2340 },
  { date: '2026-02-28', amount: 3100 },
  { date: '2026-03-01', amount: 4200 },
  { date: '2026-03-02', amount: 5100 },
  { date: '2026-03-03', amount: 3800 },
  { date: '2026-03-04', amount: 2900 },
  { date: '2026-03-05', amount: 3600 },
  { date: '2026-03-06', amount: 4400 },
  { date: '2026-03-07', amount: 3200 },
  { date: '2026-03-08', amount: 4840 },
  { date: '2026-03-09', amount: 3680 },
]

const MOCK_ATTRIBUTION = [
  { channel: 'Meta Ads', revenue: 52400, customers: 128 },
  { channel: 'Google Ads', revenue: 21300, customers: 67 },
  { channel: 'Orgânico', revenue: 9800, customers: 19 },
  { channel: 'Email', revenue: 3840, customers: 12 },
]

const MOCK_TOP_CLIENTS = [
  { name: 'Rafael Mendes', email: 'rafael@mendes.com', total_ltv: 4200, cac: 180 },
  { name: 'Ana Paula Costa', email: 'ana@costa.com', total_ltv: 3750, cac: 220 },
  { name: 'Bruno Oliveira', email: 'bruno@email.com', total_ltv: 2980, cac: 150 },
  { name: 'Carla Santos', email: 'carla@email.com', total_ltv: 2640, cac: 195 },
  { name: 'Diego Ferreira', email: 'diego@email.com', total_ltv: 2100, cac: 130 },
]

const MOCK_HEATMAP: Record<string, number> = (() => {
  const result: Record<string, number> = {}
  const today = new Date('2026-03-09')
  const seed = [3, 0, 8, 0, 5, 2, 0, 11, 0, 4, 7, 0, 2, 0, 6, 9, 0, 3, 1, 0, 5, 0, 8, 4, 0, 2, 12, 0, 6, 3]
  for (let i = 364; i >= 0; i--) {
    const d = new Date(today)
    d.setDate(today.getDate() - i)
    const dateStr = d.toISOString().split('T')[0]!
    const base = seed[i % seed.length]!
    if (base > 0 && i < 90) result[dateStr] = base
    else if (base > 4 && i < 180) result[dateStr] = Math.floor(base / 2)
    else if (base > 8) result[dateStr] = 1
  }
  return result
})()

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtBR(v: number) {
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

// ── Component ─────────────────────────────────────────────────────────────────

export default function Dashboard({ onToggleChat, user }: DashboardProps) {
  const [dateRange, setDateRange] = useState<DateRange>(defaultRange)
  const [stats, setStats] = useState<any>(MOCK_STATS)
  const [chartData, setChartData] = useState<any>(MOCK_CHART_DATA)
  const [attribution, setAttribution] = useState<any>(MOCK_ATTRIBUTION)
  const [heatmap] = useState<any>(MOCK_HEATMAP)
  const [topCustomers, setTopCustomers] = useState<any>(MOCK_TOP_CLIENTS)

  useEffect(() => {
    if (!user?.id) return
    const days = Math.round((dateRange.end.getTime() - dateRange.start.getTime()) / 86400000) + 1
    dashboardApi.getFull(days).then(({ data: full }) => {
      const data = full.stats ?? {}
      const campaigns: any[] = full.adCampaigns ?? []
      const growth = full.growth
      const totalSpend = campaigns.reduce((s: number, c: any) => s + (c.spend_brl || 0), 0)
      const totalRevenue = campaigns.reduce((s: number, c: any) => s + (c.purchase_value || 0), 0)
      const growthPct = growth?.growth_percentage ?? null
      setStats({
        faturamento: data.total_revenue || 0,
        ticketMedio: data.average_ticket || 0,
        pedidos: data.total_transactions || 0,
        roi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        growthTrend: growthPct !== null ? `${Math.abs(growthPct).toFixed(1)}%` : undefined,
        growthPositive: growthPct !== null ? growthPct >= 0 : undefined,
        activeCustomers: data.active_customers || 0,
        churnRate: data.churn_rate || 0,
      })
      if (full.chart) setChartData(full.chart)
      if (full.attribution) setAttribution(full.attribution)
      if (full.topCustomers) setTopCustomers(full.topCustomers)
    }).catch(console.error)
  }, [user?.id, dateRange])

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'você'
  const totalChannelRevenue = attribution?.reduce((s: number, c: any) => s + c.revenue, 0) || stats.faturamento

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

      {/* ── KPI Grid — 4 cards ── */}
      <motion.div
        {...fadeUp(0.06)}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}
      >
        <KpiCard label="Faturamento" value={stats.faturamento} prefix="R$ " decimals={0} delay={0.08} trend={stats.growthTrend} positive={stats.growthPositive} />
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
          <SalesHeatmap initialData={heatmap} />
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
          <RevenueChart initialData={chartData} />
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
            R$ {fmtBR(totalChannelRevenue)}
          </p>
          <ChannelChart initialData={attribution} />
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
            {topCustomers?.length || 0} clientes
          </p>
          <TopClients initialData={topCustomers} />
        </SectionCard>
      </motion.div>
    </div>
  )
}
