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

export default function TopClients() {
  const [clients, setClients] = useState<TopCustomer[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    dashboardApi.getTopCustomers()
      .then((res: { data: TopCustomer[] }) => setClients(res.data))
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{
      height: 280,
      background: 'var(--color-bg-secondary)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--color-border)',
    }} />
  )

  return (
    <section>
      {/* Section header — Notion style */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-4)',
      }}>
        <p style={{
          fontFamily: 'var(--font-sans)',
          fontSize: 'var(--text-sm)',
          fontWeight: 500,
          color: 'var(--color-text-secondary)',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
        }}>
          Top Clientes do Período
        </p>
        <span className="tag tag-neutral">{clients.length} clientes</span>
      </div>

      {/* Table header — Notion style */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 110px 90px 110px',
          padding: '0 var(--space-3) var(--space-2)',
          borderBottom: '1px solid var(--color-border)',
          marginBottom: 'var(--space-1)',
        }}
      >
        {['Nome', 'Valor', 'CAC', 'LTV'].map(h => (
          <span key={h} style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-xs)',
            fontWeight: 500,
            color: 'var(--color-text-tertiary)',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            textAlign: h === 'Nome' ? 'left' : 'right',
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
          transition={{ duration: 0.3, delay: i * 0.05 + 0.1, ease: [0.25, 0.1, 0.25, 1] }}
          className="notion-row"
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 110px 90px 110px',
            alignItems: 'center',
            padding: '0 var(--space-3)',
            cursor: 'default',
          }}
          onHoverStart={e => (e.target as HTMLElement).style.background = 'var(--color-bg-secondary)'}
          onHoverEnd={e => (e.target as HTMLElement).style.background = 'transparent'}
        >
          {/* Name */}
          <span style={{
            fontFamily: 'var(--font-sans)',
            fontSize: 'var(--text-base)',
            fontWeight: 400,
            color: 'var(--color-text-primary)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {c.name || c.email}
          </span>

          {/* Valor (última compra) */}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            textAlign: 'right',
          }}>
            R$ {fmtBR(c.total_ltv - (c.cac || 0))}
          </span>

          {/* CAC */}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
            color: 'var(--color-text-secondary)',
            textAlign: 'right',
          }}>
            R$ {fmtBR(c.cac || 0)}
          </span>

          {/* LTV */}
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
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
