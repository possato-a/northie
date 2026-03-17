import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { dashboardApi } from '../../lib/api'
import type { CohortRow } from '../../types'

// ── Config ────────────────────────────────────────────────────────────────────

const PERIOD_COLS: { key: keyof CohortRow['retentions']; label: string }[] = [
  { key: '30d',  label: '30 dias'  },
  { key: '60d',  label: '60 dias'  },
  { key: '90d',  label: '90 dias'  },
  { key: '180d', label: '180 dias' },
]

function cellStyle(v: number | null): React.CSSProperties {
  if (v === null || v === undefined) {
    return {
      background: 'transparent',
      border: '1px dashed var(--color-border)',
      color: 'var(--color-text-tertiary)',
    }
  }
  // Orange scale: 0–100% mapped to opacity 0.08–0.72
  const opacity = 0.06 + (v / 100) * 0.66
  const textLight = v >= 58
  return {
    background: `rgba(255, 89, 0, ${opacity.toFixed(2)})`,
    border: '1px solid transparent',
    color: textLight ? '#fff' : 'var(--color-text-primary)',
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function CohortHeatmap({ initialData }: { initialData?: CohortRow[] } = {}) {
  const [data, setData] = useState<CohortRow[]>(initialData ?? [])
  const [loading, setLoading] = useState(!initialData)

  useEffect(() => {
    if (initialData !== undefined) {
      setData(initialData)
      setLoading(false)
      return
    }
    setLoading(true)
    dashboardApi.getRetention()
      .then(res => { if (res.data?.length > 0) setData(res.data) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [initialData])

  if (loading) {
    return <div style={{ height: 240, background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)' }} />
  }

  if (data.length === 0) {
    return (
      <div style={{
        height: 140, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 8,
        background: 'var(--color-bg-secondary)', borderRadius: 'var(--radius-lg)',
      }}>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 13, color: 'var(--color-text-tertiary)', margin: 0 }}>
          Dados insuficientes para calcular cohorts.
        </p>
        <p style={{ fontFamily: 'var(--font-sans)', fontSize: 12, color: 'var(--color-text-tertiary)', margin: 0, opacity: 0.7 }}>
          Necessário pelo menos 2 meses de transações.
        </p>
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      {/* Explanation pill */}
      <p style={{
        fontFamily: 'var(--font-sans)', fontSize: 12,
        color: 'var(--color-text-tertiary)', margin: '0 0 20px',
        letterSpacing: '-0.1px', lineHeight: 1.5,
      }}>
        Percentual de clientes de cada safra que realizou uma nova compra após X dias da primeira compra.
        Células em branco ainda não têm dados suficientes.
      </p>

      {/* Grid */}
      <div style={{ minWidth: 520 }}>
        {/* Header row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '72px 44px repeat(4, 1fr)',
          gap: 6,
          marginBottom: 6,
          paddingBottom: 10,
          borderBottom: '1px solid var(--color-border)',
        }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em', textTransform: 'uppercase' }}>
            Safra
          </span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em', textTransform: 'uppercase', textAlign: 'center' }}>
            N
          </span>
          {PERIOD_COLS.map(p => (
            <span key={p.key} style={{ fontFamily: 'var(--font-sans)', fontSize: 11, fontWeight: 500, color: 'var(--color-text-tertiary)', letterSpacing: '0.02em', textTransform: 'uppercase', textAlign: 'center' }}>
              {p.label}
            </span>
          ))}
        </div>

        {/* Data rows */}
        {data.map((row, ri) => (
          <motion.div
            key={row.month}
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: ri * 0.05 }}
            style={{
              display: 'grid',
              gridTemplateColumns: '72px 44px repeat(4, 1fr)',
              gap: 6,
              marginBottom: 6,
              alignItems: 'center',
            }}
          >
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-primary)', fontWeight: 500,
            }}>
              {row.month}
            </span>
            <span style={{
              fontFamily: 'var(--font-sans)', fontSize: 'var(--text-sm)',
              color: 'var(--color-text-tertiary)', textAlign: 'center',
            }}>
              {row.n}
            </span>
            {PERIOD_COLS.map(p => {
              const val = row.retentions[p.key]
              return (
                <div
                  key={p.key}
                  title={val !== null && val !== undefined ? `${val}% retiveram após ${p.label}` : 'Dados ainda indisponíveis'}
                  style={{
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    ...cellStyle(val),
                    transition: 'opacity var(--transition-base)',
                  }}
                >
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 'var(--text-sm)',
                    fontWeight: val !== null ? 500 : 400,
                    letterSpacing: '0.01em',
                  }}>
                    {val !== null && val !== undefined ? `${val}%` : '—'}
                  </span>
                </div>
              )
            })}
          </motion.div>
        ))}
      </div>

      {/* Legend */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--color-border)',
      }}>
        <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)', letterSpacing: '0.03em', textTransform: 'uppercase', flexShrink: 0 }}>
          Retenção
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {[0.06, 0.18, 0.30, 0.44, 0.58, 0.72].map((op, i) => (
            <div key={i} style={{ width: 20, height: 10, borderRadius: 3, background: `rgba(255, 89, 0, ${op})` }} />
          ))}
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', flex: 1 }}>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>baixa</span>
          <span style={{ fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)' }}>alta</span>
        </div>
        <span style={{
          fontFamily: 'var(--font-sans)', fontSize: 10, color: 'var(--color-text-tertiary)',
          marginLeft: 8,
        }}>
          Células em branco = período ainda não completado
        </span>
      </div>
    </div>
  )
}
