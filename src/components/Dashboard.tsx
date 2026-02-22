import { motion } from 'framer-motion'
import { KpiCard } from './KpiCard'
import TopBar from './TopBar'
import DatePicker from './DatePicker'
import RevenueChart from './RevenueChart'
import ChannelChart from './ChannelChart'
import TopClients from './TopClients'

interface DashboardProps {
  onToggleChat?: () => void
}

export default function Dashboard({ onToggleChat }: DashboardProps) {
  return (
    <div style={{ paddingTop: 28, paddingBottom: 80 }}>
      {/* Note: I removed paddingLeft/Right here because it's now handled by the parent container in App.tsx */}
      <TopBar onToggleChat={onToggleChat} />

      <motion.h1
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontWeight: 400, fontSize: 40,
          letterSpacing: '-1.6px', color: '#1E1E1E',
          lineHeight: 1, margin: 0,
        }}
      >
        Bem-vindo de volta Francisco!
      </motion.h1>

      {/* KPI section */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3, delay: 0.1 }}
        style={{ display: 'flex', flexDirection: 'column', gap: 32, marginTop: 40 }}
      >
        <DatePicker />

        <div style={{ display: 'flex', gap: 48, alignItems: 'center', flexWrap: 'wrap' }}>
          <KpiCard label="FATURAMENTO" value={240000} prefix="R$ " decimals={0} delay={0.15} />
          <KpiCard label="TICKET MÉDIO" value={192.9} prefix="R$ " decimals={2} delay={0.25} />
          <KpiCard label="TRANSAÇÕES" value={1244} decimals={0} delay={0.35} />
          <KpiCard label="CAC MÉDIO" value={310} prefix="R$ " decimals={0} delay={0.45} />
          <KpiCard label="LTV MÉDIO" value={37400} prefix="R$ " decimals={0} delay={0.55} />
        </div>
      </motion.div>

      {/* Charts section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.45, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ marginTop: 64 }}
      >
        <div style={{ height: 1, background: 'rgba(30,30,30,0.08)', marginBottom: 56 }} />
        <RevenueChart />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 64, marginTop: 64 }}>
          <ChannelChart />
          <TopClients />
        </div>
      </motion.div>
    </div>
  )
}
