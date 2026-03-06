import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import RevenueChart from '../components/charts/RevenueChart'
import ChannelChart from '../components/charts/ChannelChart'
import TopClients from '../components/ui/TopClients'
import SalesHeatmap from '../components/charts/SalesHeatmap'
import { dashboardApi } from '../lib/api'
import { PageHeader, Divider } from '../components/ui/shared'

interface DashboardProps {
  onToggleChat?: () => void
  user?: any
}

export default function Dashboard({ onToggleChat, user }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)
  const [chartData, setChartData] = useState<any>(null)
  const [attribution, setAttribution] = useState<any>(null)
  const [heatmap, setHeatmap] = useState<any>(null)
  const [topCustomers, setTopCustomers] = useState<any>(null)

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData()
    }
  }, [user?.id])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const { data: full } = await dashboardApi.getFull(30)

      const data = full.stats ?? {}
      const campaigns: any[] = full.adCampaigns ?? []
      const growth = full.growth

      const calcRoas = (platform: string) => {
        const filtered = campaigns.filter((c: any) => c.platform === platform)
        const spend = filtered.reduce((s: number, c: any) => s + (c.spend_brl || 0), 0)
        const revenue = filtered.reduce((s: number, c: any) => s + (c.purchase_value || 0), 0)
        return spend > 0 ? revenue / spend : 0
      }

      const totalSpend = campaigns.reduce((s: number, c: any) => s + (c.spend_brl || 0), 0)
      const totalRevenue = campaigns.reduce((s: number, c: any) => s + (c.purchase_value || 0), 0)

      const growthPct = growth?.growth_percentage ?? null
      const growthTrend = growthPct !== null ? `${Math.abs(growthPct).toFixed(1)}%` : undefined

      setStats({
        faturamento: data.total_revenue || 0,
        ticketMedio: data.average_ticket || 0,
        pedidos: data.total_transactions || 0,
        roi: totalSpend > 0 ? totalRevenue / totalSpend : 0,
        roasMeta: calcRoas('meta'),
        roasGoogle: calcRoas('google'),
        growthTrend,
        growthPositive: growthPct !== null ? growthPct >= 0 : undefined,
      })
      setChartData(full.chart ?? undefined)
      setAttribution(full.attribution ?? undefined)
      setHeatmap(full.heatmap ?? undefined)
      setTopCustomers(full.topCustomers ?? undefined)
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      setStats({ faturamento: 0, ticketMedio: 0, pedidos: 0, roi: 0, roasMeta: 0, roasGoogle: 0 })
    } finally {
      setLoading(false)
    }
  }

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Você'

  if (loading && !stats) {
    return (
      <div style={{ padding: '100px 0', textAlign: 'center' }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 'var(--text-base)', color: 'var(--color-text-tertiary)' }}>
          Carregando dados...
        </p>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title={`Olá, ${userName}!`}
        subtitle="Visão consolidada do seu negócio — dados em tempo real."
      />

      {/* KPI section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}
      >
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <KpiCard label="FATURAMENTO" value={stats?.faturamento || 0} prefix="R$ " decimals={0} delay={0.15} trend={stats?.growthTrend} positive={stats?.growthPositive} />
          <KpiCard label="TICKET MÉDIO" value={stats?.ticketMedio || 0} prefix="R$ " decimals={2} delay={0.25} />
          <KpiCard label="PEDIDOS" value={stats?.pedidos || 0} decimals={0} delay={0.35} />
          <KpiCard label="ROAS GERAL (30d)" value={stats?.roi || 0} suffix="x" decimals={2} delay={0.45} />
          {(stats?.roasMeta || 0) > 0 && (
            <KpiCard label="ROAS META (30d)" value={stats.roasMeta} suffix="x" decimals={2} delay={0.55} />
          )}
          {(stats?.roasGoogle || 0) > 0 && (
            <KpiCard label="ROAS GOOGLE (30d)" value={stats.roasGoogle} suffix="x" decimals={2} delay={0.65} />
          )}
        </div>
      </motion.div>

      {/* Charts section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 64 }}
      >
        <Divider margin="0 0 56px" />
        <SalesHeatmap initialData={heatmap} />
        <div style={{ marginTop: 64 }}>
          <RevenueChart initialData={chartData} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginTop: 64 }}>
          <ChannelChart initialData={attribution} />
          <TopClients initialData={topCustomers} />
        </div>
      </motion.div>
    </div>
  )
}
