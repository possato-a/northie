import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { KpiCard } from './KpiCard'
import TopBar from './TopBar'
import RevenueChart from './RevenueChart'
import ChannelChart from './ChannelChart'
import TopClients from './TopClients'
import SalesHeatmap from './SalesHeatmap'
import { dashboardApi } from '../lib/api'

interface DashboardProps {
  onToggleChat?: () => void
  user?: any
}

export default function Dashboard({ onToggleChat, user }: DashboardProps) {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    if (user?.id) {
      fetchDashboardData()
    }
  }, [user])

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [statsRes] = await Promise.all([
        dashboardApi.getStats(),
        dashboardApi.getChart()
      ])

      // Map backend fields to frontend expected fields
      // Backend: total_revenue, average_ticket, total_customers
      // Frontend: faturamento, ticketMedio, pedidos
      const data = statsRes.data
      setStats({
        faturamento: data.total_revenue || 0,
        ticketMedio: data.average_ticket || 0,
        pedidos: data.total_customers || 0,
        roi: 0 // Will focus on ROI in next step
      })
    } catch (err: any) {
      console.error('Error fetching dashboard data:', err)
      setStats({
        faturamento: 0,
        ticketMedio: 0,
        pedidos: 0,
        roi: 0
      })
    } finally {
      setLoading(false)
    }
  }

  if (loading && !stats) {
    return (
      <div style={{ padding: '100px 0', textAlign: 'center', color: 'rgba(var(--fg-rgb), 0.3)' }}>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14 }}>Carregando dados...</p>
      </div>
    )
  }

  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      <TopBar onToggleChat={onToggleChat} />

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 400, fontSize: 40,
          letterSpacing: '-1.6px', color: 'var(--fg)',
          lineHeight: 1, margin: 0,
        }}
      >
        Olá, {user?.user_metadata?.full_name?.split(' ')[0] || user?.email?.split('@')[0] || 'Francisco'}!
      </motion.h1>

      {/* KPI section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}
      >
        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <KpiCard
            label="FATURAMENTO"
            value={stats?.faturamento || 0}
            prefix="R$ "
            decimals={0}
            delay={0.15}
          />
          <KpiCard
            label="TICKET MÉDIO"
            value={stats?.ticketMedio || 0}
            prefix="R$ "
            decimals={2}
            delay={0.25}
          />
          <KpiCard
            label="PEDIDOS"
            value={stats?.pedidos || 0}
            decimals={0}
            delay={0.35}
          />
          <KpiCard
            label="ROI MÉDIO"
            value={stats?.roi || 0}
            prefix=""
            suffix="x"
            decimals={2}
            delay={0.45}
          />
        </div>
      </motion.div>

      {/* Charts section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 64 }}
      >
        <div style={{ height: 1, background: 'rgba(var(--fg-rgb), 0.08)', marginBottom: 56 }} />
        <SalesHeatmap />
        <div style={{ marginTop: 64 }}>
          <RevenueChart />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginTop: 64 }}>
          <ChannelChart />
          <TopClients />
        </div>
      </motion.div>
    </div>
  )
}
