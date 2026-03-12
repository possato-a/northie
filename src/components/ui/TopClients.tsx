import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '../../lib/api'

interface TopCustomer {
  name: string
  email: string
  total_ltv: number
  cac: number
}

function fmtBR(v: number) {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 }).format(v)
}

export default function TopClients({ initialData }: { initialData?: TopCustomer[] } = {}) {
  const [clients, setClients] = useState<TopCustomer[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData) return
    dashboardApi.getTopCustomers()
      .then((res: { data: TopCustomer[] }) => setClients(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} style={{
          height: 40,
          background: 'var(--color-bg-secondary)',
          borderRadius: 'var(--radius-sm)',
          opacity: 1 - i * 0.15,
        }} />
      ))}
    </div>
  )

  return (
    <section>
      {/* Table header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '28px 1fr 100px',
        padding: '0 0 8px',
        borderBottom: '1px solid var(--color-border)',
      }}>
        {['#', 'Cliente', 'LTV'].map((h, idx) => (
          <span key={h} style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.03em',
            textTransform: 'uppercase',
            textAlign: idx === 2 ? 'right' : 'left',
          }}>
            {h}
          </span>
        ))}
      </div>

      {/* Table rows */}
      {clients.map((c, i) => (
        <motion.div
          key={c.email}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 + 0.05, ease: [0.25, 0.1, 0.25, 1] }}
          style={{
            display: 'grid',
            gridTemplateColumns: '28px 1fr 100px',
            alignItems: 'center',
            padding: '11px 0',
            borderBottom: i === clients.length - 1 ? 'none' : '1px solid var(--color-border)',
          }}
        >
          {/* Rank */}
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 400,
            color: 'var(--color-text-tertiary)',
          }}>
            {i + 1}
          </span>

          {/* Name */}
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            letterSpacing: '-0.1px',
          }}>
            {c.name || c.email}
          </span>

          {/* LTV */}
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            fontWeight: 500,
            color: 'var(--status-complete)',
            textAlign: 'right',
          }}>
            R$ {fmtBR(c.total_ltv)}
          </span>
        </motion.div>
      ))}
    </section>
  )
}
