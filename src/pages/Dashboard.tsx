import { useState, useEffect } from 'react'
import { KpiCard } from '../components/ui/KpiCard'
import TopBar from '../components/layout/TopBar'
import RevenueChart from '../components/charts/RevenueChart'
import ChannelChart from '../components/charts/ChannelChart'
import TopClients from '../components/ui/TopClients'
import SalesHeatmap from '../components/charts/SalesHeatmap'
import { dashboardApi } from '../lib/api'
import { PageHeader, KpiGrid, SkeletonKpi, SectionCard, Skeleton } from '../components/ui/shared'

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
        activeCustomers: data.active_customers || 0,
        churnRate: data.churn_rate || 0,
      })
      setChartData(full.chart ?? undefined)
      setAttribution(full.attribution ?? undefined)
      setHeatmap(full.heatmap ?? undefined)
      setTopCustomers(full.topCustomers ?? undefined)
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      setStats({ faturamento: 0, ticketMedio: 0, pedidos: 0, roi: 0, roasMeta: 0, roasGoogle: 0, activeCustomers: 0, churnRate: 0 })
    } finally {
      setLoading(false)
    }
  }

  const userName = user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Você'

  if (loading && !stats) {
    return (
      <div style={{ paddingBottom: 40 }}>
        <Skeleton width={200} height={36} style={{ marginBottom: 32 }} />
        <Skeleton width={350} height={14} style={{ marginBottom: 8 }} />
        <KpiGrid style={{ marginTop: 40 }}>
          {Array.from({ length: 6 }).map((_, i) => <SkeletonKpi key={i} />)}
        </KpiGrid>
        <div style={{ marginTop: 64 }}>
          <Skeleton width="100%" height={200} borderRadius="var(--radius-xl)" />
        </div>
      </div>
    )
  }

  return (
    <div style={{ paddingBottom: 40 }}>
      <TopBar onToggleChat={onToggleChat} />

      <PageHeader
        title={`Olá, ${userName}!`}
        subtitle="Visão consolidada do seu negócio — dados em tempo real."
      />

      {/* KPI section */}
      <KpiGrid style={{ marginTop: 40 }}>
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
        <KpiCard label="CLIENTES ATIVOS" value={stats?.activeCustomers || 0} decimals={0} delay={0.75} />
        <KpiCard label="CHURN RATE" value={stats?.churnRate || 0} suffix="%" decimals={1} delay={0.85} />
      </KpiGrid>

      {/* Charts section */}
      <div style={{ marginTop: 64, display: 'flex', flexDirection: 'column', gap: 40 }}>
        <SectionCard>
          <SalesHeatmap initialData={heatmap} />
        </SectionCard>
        <SectionCard>
          <RevenueChart initialData={chartData} />
        </SectionCard>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 40 }}>
          <SectionCard>
            <ChannelChart initialData={attribution} />
          </SectionCard>
          <SectionCard>
            <TopClients initialData={topCustomers} />
          </SectionCard>
        </div>
      </div>
    </div>
  )
}
